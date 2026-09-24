import React, { useState, useRef } from 'react';
import { ClothItem, Sale } from '../types';
import { processImageToVariants, getListImage, THUMB_MAX_DIM, THUMB_QUALITY } from '../utils/imageUtils';
import { imageStore } from '../utils/imageStore';
import { updateItemInFirebase, FIREBASE_COLLECTIONS } from '../firebase';
import { Modal } from './Shared';
import { 
  Sparkles, 
  Play, 
  Pause, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ShieldAlert,
  Loader2,
  Eye,
  ShoppingBag
} from 'lucide-react';

interface ImageMigrationModalProps {
  clothes: ClothItem[];
  sales?: Sale[];
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ImageMigrationModal: React.FC<ImageMigrationModalProps> = ({
  clothes,
  sales = [],
  onClose,
  showToast
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [totalToMigrate, setTotalToMigrate] = useState<number>(0);
  const [isDryRun, setIsDryRun] = useState<boolean>(false);
  const [dryRunReport, setDryRunReport] = useState<{
    eligibleCount: number;
    alreadyMigratedCount: number;
    noImageCount: number;
    estimatedSavings: string;
  } | null>(null);

  const [salesDryRunReport, setSalesDryRunReport] = useState<{
    eligibleSalesCount: number;
    totalHeavyImages: number;
    estimatedSavings: string;
  } | null>(null);

  const isCancelledRef = useRef<boolean>(false);

  const appendLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString('ar-DZ')}] ${msg}`, ...prev.slice(0, 200)]);
  };

  // Threshold size (in bytes) based on THUMB_MAX_DIM & THUMB_QUALITY
  // 200px max edge at quality 0.6 produces ~12KB - 15KB base64 strings
  const THUMB_BYTES_THRESHOLD = Math.max(12000, Math.round(THUMB_MAX_DIM * THUMB_MAX_DIM * THUMB_QUALITY * 0.5));

  // Identify eligible items needing migration: has imageUrl starting with data:image and missing thumbUrl or hasFullImage, or oversized thumb
  const getEligibleItems = () => {
    return clothes.filter(c => {
      const hasLegacyImage = typeof c.imageUrl === 'string' && c.imageUrl.startsWith('data:image');
      const missingThumb = !c.thumbUrl || !c.hasFullImage;
      const oversizedThumb = typeof c.thumbUrl === 'string' && c.thumbUrl.length > THUMB_BYTES_THRESHOLD;
      return (hasLegacyImage && missingThumb) || oversizedThumb;
    });
  };

  // Identify eligible sales needing migration: contains item with heavy imageUrl (> 20KB)
  const getEligibleSales = () => {
    if (!sales || !Array.isArray(sales)) return [];
    return sales.filter(s => {
      if (!s.items || !Array.isArray(s.items)) return false;
      return s.items.some(item => typeof item.imageUrl === 'string' && item.imageUrl.length > 20000);
    });
  };

  const handleDryRun = () => {
    setIsDryRun(true);
    const eligible = getEligibleItems();
    const alreadyMigrated = clothes.filter(c => c.thumbUrl && c.hasFullImage).length;
    const noImage = clothes.filter(c => !c.imageUrl && !c.thumbUrl).length;

    // Estimate legacy payload vs new payload
    let totalLegacyBytes = 0;
    eligible.forEach(c => {
      totalLegacyBytes += (c.imageUrl?.length || 0);
    });

    const estMb = (totalLegacyBytes / (1024 * 1024)).toFixed(2);
    const estThumbMb = ((eligible.length * 12 * 1024) / (1024 * 1024)).toFixed(2);

    setDryRunReport({
      eligibleCount: eligible.length,
      alreadyMigratedCount: alreadyMigrated,
      noImageCount: noImage,
      estimatedSavings: `من ~${estMb}MB إلى ~${estThumbMb}MB (تخفيض ~90% في الذاكرة الرئيسية)`
    });

    appendLog(`🔍 [Dry Run] تم التحقق من ${clothes.length} منتج: ${eligible.length} منتج بحاجة لترحيل الصور.`);
  };

  const handleStartMigration = async () => {
    const eligible = getEligibleItems();
    if (eligible.length === 0) {
      showToast('جميع المنتجات مرحَّلة ومحسَّنة بالفعل!', 'info');
      return;
    }

    setIsRunning(true);
    isCancelledRef.current = false;
    setTotalToMigrate(eligible.length);
    setProcessedCount(0);
    setProgress(0);

    appendLog(`🚀 بدء عملية ترحيل الصور لـ ${eligible.length} منتج (دفعات من 20 قطعة)...`);

    const BATCH_SIZE = 20;
    let count = 0;

    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      if (isCancelledRef.current) {
        appendLog('⏹️ تم إيقاف عملية الترحيل بطلب من المستخدم.');
        break;
      }

      const batch = eligible.slice(i, i + BATCH_SIZE);
      appendLog(`📦 معالجة الدفعة رقم ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} منتج)...`);

      for (const item of batch) {
        if (isCancelledRef.current) break;

        try {
          if (!item.imageUrl) continue;

          // (a) Generate thumb and full
          const variants = await processImageToVariants(item.imageUrl);

          // (b) Write clothImages/{id} and verify read back
          const savedFull = await imageStore.saveFull(item.id, variants.fullUrl);
          if (!savedFull) {
            appendLog(`❌ [فشل] ${item.name} (#${item.barcode}): فشل حفظ الصورة الكاملة.`);
            continue;
          }

          const verifyRead = await imageStore.loadFull(item.id, true);
          if (!verifyRead || verifyRead.length !== variants.fullUrl.length) {
            appendLog(`❌ [فشل التحقق] ${item.name} (#${item.barcode}): عدم تطابقة الصورة المرفوعة مع المقروءة.`);
            continue;
          }

          // (c) Update item with thumbUrl and hasFullImage (keep legacy imageUrl for safety)
          const updatedTs = new Date().toISOString();
          const updateOk = await updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, item.id, {
            thumbUrl: variants.thumbUrl,
            hasFullImage: true,
            updatedAt: updatedTs
          });

          if (!updateOk) {
            appendLog(`❌ [فشل التحديث] ${item.name} (#${item.barcode}): فشل تحديث السجل في قاعدة البيانات.`);
            continue;
          }

          count++;
          setProcessedCount(count);
          setProgress(Math.round((count / eligible.length) * 100));

          const thumbKb = Math.round(variants.thumbUrl.length / 1024);
          const fullKb = Math.round(variants.fullUrl.length / 1024);
          appendLog(`✅ [تم] ${item.name} (#${item.barcode || 'بدون باركود'}) -> مصغّرة: ${thumbKb}KB | كاملة: ${fullKb}KB`);

        } catch (err) {
          appendLog(`❌ [خطأ] ${item.name}: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
        }
      }

      // Small delay between batches to allow UI re-renders and avoid browser throttling
      await new Promise(r => setTimeout(r, 150));
    }

    setIsRunning(false);
    if (!isCancelledRef.current) {
      showToast(`تم اكتشاف وتحديث ${count} منتج بنجاح!`, 'success');
      appendLog(`🎉 اكتملت عملية الترحيل بنجاح لـ ${count} منتج.`);
    }
  };

  const handlePause = () => {
    isCancelledRef.current = true;
    setIsRunning(false);
  };

  // Check if purge button can be enabled
  const itemsWithLegacyImage = clothes.filter(c => typeof c.imageUrl === 'string' && c.imageUrl.length > 500);
  const unmigratedCount = itemsWithLegacyImage.filter(c => !c.thumbUrl || !c.hasFullImage).length;
  const isPurgeEligible = itemsWithLegacyImage.length > 0 && unmigratedCount === 0;

  const handlePurgeLegacyImages = async () => {
    if (!isPurgeEligible) return;

    const totalToPurge = itemsWithLegacyImage.length;
    const confirmed = window.confirm(
      `⚠️ تحذير مهم جداً وحاسم:\n\nسيتم حذف حقل imageUrl القديم الثقيل من ${totalToPurge} منتج نهائياً لتقليل حجم الذاكرة وتخفيف الاستعلامات.\n\nهل قمت بتصدير نسخة احتياطية (Export JSON) من Firebase Console أولاً؟\n\nإرادياً: اضغط OK للمتابعة وتأكيد التنظيف النهائي.`
    );

    if (!confirmed) {
      showToast('تم إلغاء عملية تنظيف الصور القديمة', 'info');
      return;
    }

    setIsRunning(true);
    appendLog(`🧹 بدء تنظيف حقل imageUrl القديم لـ ${totalToPurge} منتج...`);

    let cleaned = 0;
    for (const item of itemsWithLegacyImage) {
      try {
        // Direct read check for clothImages/{id}.full bypassing cache
        const fullExists = await imageStore.loadFull(item.id, true);
        if (!fullExists || fullExists.length < 50) {
          appendLog(`⚠️ [تخطي] ${item.name} (#${item.barcode}): لم يتم العثور على الصورة الكاملة في clothImages/${item.id}.full (تم إلغاء الحذف للحماية).`);
          continue;
        }

        const purgeOk = await updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, item.id, {
          imageUrl: null,
          updatedAt: new Date().toISOString()
        });

        if (purgeOk) {
          cleaned++;
          appendLog(`🧹 [حذف قديم] ${item.name} (#${item.barcode}): تم تفريغ imageUrl بنجاح.`);
        } else {
          appendLog(`❌ [فشل الحذف] ${item.name} (#${item.barcode}): فشل التحديث في قاعدة البيانات.`);
        }
      } catch (err) {
        appendLog(`❌ [خطأ تنظيف] ${item.name}: ${err}`);
      }
    }

    setIsRunning(false);
    showToast(`تم تنظيف ${cleaned} صورة قديمة بنجاح وتوفير مساحة الذاكرة!`, 'success');
  };

  const handleDryRunSales = () => {
    const eligibleSales = getEligibleSales();
    let totalHeavy = 0;
    let totalBytes = 0;

    eligibleSales.forEach(s => {
      s.items?.forEach(item => {
        if (typeof item.imageUrl === 'string' && item.imageUrl.length > 20000) {
          totalHeavy++;
          totalBytes += item.imageUrl.length;
        }
      });
    });

    const estMb = (totalBytes / (1024 * 1024)).toFixed(2);
    const estNewMb = ((totalHeavy * 12 * 1024) / (1024 * 1024)).toFixed(2);

    setSalesDryRunReport({
      eligibleSalesCount: eligibleSales.length,
      totalHeavyImages: totalHeavy,
      estimatedSavings: `تخفيض حجم سجلات المبيعات من ~${estMb}MB إلى ~${estNewMb}MB`
    });

    appendLog(`🔎 [Dry Run مبيعات] تم فحص ${sales.length} عملية بيع: ${eligibleSales.length} عملية تحتوي على ${totalHeavy} صورة ثقيلة (>20KB).`);
  };

  const handleStartSalesMigration = async () => {
    const eligibleSales = getEligibleSales();
    if (eligibleSales.length === 0) {
      showToast('جميع سجلات المبيعات خفيفة ولا تحتوي على صور ثقيلة!', 'info');
      return;
    }

    setIsRunning(true);
    isCancelledRef.current = false;
    setTotalToMigrate(eligibleSales.length);
    setProcessedCount(0);
    setProgress(0);

    appendLog(`🚀 بدء ترحيل واستبدال صور سجلات المبيعات لـ ${eligibleSales.length} عملية بيع...`);

    const clothesMap = new Map<string, ClothItem>();
    clothes.forEach(c => {
      if (c.id) clothesMap.set(c.id, c);
      if (c.barcode) clothesMap.set(c.barcode.trim().toLowerCase(), c);
    });

    const BATCH_SIZE = 10;
    let updatedCount = 0;

    for (let i = 0; i < eligibleSales.length; i += BATCH_SIZE) {
      if (isCancelledRef.current) {
        appendLog('⏹️ تم إيقاف ترحيل سجلات المبيعات بطلب من المستخدم.');
        break;
      }

      const batch = eligibleSales.slice(i, i + BATCH_SIZE);
      appendLog(`📦 [دفعة مبيعات] معالجة ${batch.length} عملية بيع...`);

      for (const sale of batch) {
        if (isCancelledRef.current) break;

        try {
          if (!sale.items || !Array.isArray(sale.items)) continue;

          let hasChanges = false;
          const updatedItems = await Promise.all(
            sale.items.map(async (item) => {
              if (typeof item.imageUrl === 'string' && item.imageUrl.length > 20000) {
                const matchedCloth = (item.itemId ? clothesMap.get(item.itemId) : null) || 
                                     (item.barcode ? clothesMap.get(item.barcode.trim().toLowerCase()) : null);

                let newThumbUrl = getListImage(matchedCloth);
                if (!newThumbUrl && item.imageUrl.startsWith('data:image')) {
                  try {
                    const variants = await processImageToVariants(item.imageUrl);
                    newThumbUrl = variants.thumbUrl;
                  } catch (e) {
                    newThumbUrl = item.imageUrl;
                  }
                }

                if (newThumbUrl && newThumbUrl !== item.imageUrl) {
                  hasChanges = true;
                  return { ...item, imageUrl: newThumbUrl };
                }
              }
              return item;
            })
          );

          if (hasChanges) {
            const updateOk = await updateItemInFirebase(FIREBASE_COLLECTIONS.SALES, sale.id, {
              items: updatedItems,
              updatedAt: new Date().toISOString()
            });

            if (updateOk) {
              updatedCount++;
              appendLog(`✅ [مبيعات] عملية بيع #${sale.id.slice(-6)}: تم استبدال الصور الثقيلة بالمصغّرة الخفيفة.`);
            } else {
              appendLog(`❌ [مبيعات] فشل تحديث عملية البيع #${sale.id.slice(-6)}`);
            }
          }
        } catch (err) {
          appendLog(`❌ [خطأ مبيعات] #${sale.id}: ${err}`);
        }

        setProcessedCount(updatedCount);
        setProgress(Math.round((updatedCount / eligibleSales.length) * 100));
      }

      await new Promise(r => setTimeout(r, 150));
    }

    setIsRunning(false);
    if (!isCancelledRef.current) {
      showToast(`تم تحديث ${updatedCount} سجل بيع بنجاح واستبدال الصور الثقيلة!`, 'success');
      appendLog(`🎉 اكتمل ترحيل المبيعات بنجاح لـ ${updatedCount} عملية بيع.`);
    }
  };

  return (
    <Modal title="تحسين وتوزيع صور المنتجات (إخراج الصور من السجلات)" onClose={onClose} wide>
      <div className="space-y-5 text-slate-800" dir="rtl">
        {/* Intro Banner */}
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 text-xs leading-relaxed space-y-2">
          <div className="flex items-center gap-2 text-blue-900 font-black text-sm">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>تسريع وتحسين أداء المخزنون (الصور المصغّرة والكاملة)</span>
          </div>
          <p className="text-blue-800 font-medium">
            يقوم هذا الإجراء بتحويل الصور الضخمة داخل سجلات المنتجات إلى صور مصغّرة خفيفة (Thumbnails ~10KB) لعرض القوائم بسرعة فائقة، مع تخزين الصورة الكاملة الجودة في مسار منفصل يُقرأ عند المعاينة فقط.
          </p>
        </div>

        {/* Action Controls & Dry Run */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={handleDryRun}
            disabled={isRunning}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200 disabled:opacity-50"
          >
            <Eye className="w-4 h-4 text-slate-600" />
            <span>تشغيل تجريبي (Dry Run)</span>
          </button>

          {!isRunning ? (
            <button
              type="button"
              onClick={handleStartMigration}
              className="p-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>بدء ترحيل وتحسين الصور</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              className="p-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>إيقاف مؤقت</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePurgeLegacyImages}
            disabled={!isPurgeEligible || isRunning}
            className={`p-3 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 border ${
              isPurgeEligible 
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-sm active:scale-95' 
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
            }`}
            title={!isPurgeEligible ? 'ينشط فقط بعد ترحيل جميع الصور بنجاح والتحقق منها' : 'تفريغ الصور القديمة الثقيلة'}
          >
            <Trash2 className="w-4 h-4" />
            <span>تنظيف الصور القديمة (Purge)</span>
          </button>
        </div>

        {/* Dry Run Report Panel */}
        {dryRunReport && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
            <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>نتائج الفحص التجريبي (Dry Run Report):</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-bold">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">منتجات بحاجة لترحيل:</span>
                <span className="text-blue-900 text-sm font-black">{dryRunReport.eligibleCount}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">منتجات مرحَّلة سابقاً:</span>
                <span className="text-emerald-700 text-sm font-black">{dryRunReport.alreadyMigratedCount}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-slate-500 block">منتجات بدون صورة:</span>
                <span className="text-slate-700 text-sm font-black">{dryRunReport.noImageCount}</span>
              </div>
            </div>
            <p className="text-indigo-900 font-bold bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
              ⚡ توفير المساحة المتوقع: {dryRunReport.estimatedSavings}
            </p>
          </div>
        )}

        {/* Progress Bar */}
        {isRunning && (
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex justify-between items-center text-xs font-black text-slate-800">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>جاري معالجة الصور دفعة بعد دفعة... ({processedCount} / {totalToMigrate})</span>
              </span>
              <span className="font-mono text-blue-700">{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden p-0.5">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Sales Records Image Migration Section */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-black text-xs">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>ترحيل واستبدال صور سجلات المبيعات القديمة (اختياري)</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDryRunSales}
              disabled={isRunning}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5 text-slate-600" />
              <span>فحص المبيعات (Dry Run Sales)</span>
            </button>

            <button
              type="button"
              onClick={handleStartSalesMigration}
              disabled={isRunning}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>بدء ترحيل صور المبيعات (&gt;20KB)</span>
            </button>
          </div>

          {/* Sales Dry Run Report Panel */}
          {salesDryRunReport && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1.5">
              <h5 className="font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>نتائج فحص المبيعات القديمة:</span>
              </h5>
              <div className="flex items-center gap-4 text-emerald-900 font-bold">
                <span>عمليات بيع قابلة للتخفيف: <strong>{salesDryRunReport.eligibleSalesCount}</strong></span>
                <span>•</span>
                <span>إجمالي الصور الثقيلة: <strong>{salesDryRunReport.totalHeavyImages}</strong></span>
              </div>
              <p className="text-emerald-800 text-[11px] font-medium pt-0.5">
                ⚡ {salesDryRunReport.estimatedSavings}
              </p>
            </div>
          )}
        </div>

        {/* Live Logs Window */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>سجل العمليات المباشر (Log):</span>
            </span>
            <span className="text-[10px] text-slate-400">{logs.length} إدخال</span>
          </div>
          <div className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-3 rounded-2xl h-44 overflow-y-auto space-y-1 dir-ltr text-left border border-slate-800">
            {logs.length === 0 ? (
              <span className="text-slate-500 italic">بانتظار بدء التشغيل أو الفحص التجريبي...</span>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-tight">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
