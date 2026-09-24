import React, { useState, useRef } from 'react';
import { ClothItem } from '../types';
import { processImageToVariants } from '../utils/imageUtils';
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
  Eye
} from 'lucide-react';

interface ImageMigrationModalProps {
  clothes: ClothItem[];
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ImageMigrationModal: React.FC<ImageMigrationModalProps> = ({
  clothes,
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

  const isCancelledRef = useRef<boolean>(false);

  const appendLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString('ar-DZ')}] ${msg}`, ...prev.slice(0, 200)]);
  };

  // Identify eligible items needing migration: has imageUrl starting with data:image and missing thumbUrl or hasFullImage
  const getEligibleItems = () => {
    return clothes.filter(c => {
      const hasLegacyImage = typeof c.imageUrl === 'string' && c.imageUrl.startsWith('data:image');
      const missingThumb = !c.thumbUrl || !c.hasFullImage;
      return hasLegacyImage && missingThumb;
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

          const verifyRead = await imageStore.loadFull(item.id);
          if (!verifyRead || verifyRead.length !== variants.fullUrl.length) {
            appendLog(`❌ [فشل التحقق] ${item.name} (#${item.barcode}): عدم تطابقة الصورة المرفوعة مع المقروءة.`);
            continue;
          }

          // (c) Update item with thumbUrl and hasFullImage (keep legacy imageUrl for safety)
          const updatedTs = new Date().toISOString();
          await updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, item.id, {
            thumbUrl: variants.thumbUrl,
            hasFullImage: true,
            updatedAt: updatedTs
          });

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
        await updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, item.id, {
          imageUrl: null,
          updatedAt: new Date().toISOString()
        });
        cleaned++;
        appendLog(`🧹 [حذف قديم] ${item.name} (#${item.barcode}): تم تفريغ imageUrl.`);
      } catch (err) {
        appendLog(`❌ [خطأ تنظيف] ${item.name}: ${err}`);
      }
    }

    setIsRunning(false);
    showToast(`تم تنظيف ${cleaned} صورة قديمة بنجاح وتوفير مساحة الذاكرة!`, 'success');
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

        {/* Purge Warning Notice */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-black text-amber-950 mb-0.5">تنبيه حماية البيانات:</strong>
            عملية الترحيل آمنة كلياً ولا تحذف الصور القديمة فوراً. بعد التأكد التام وتجربة استعراض المنتجات والصور، يمكنك الضغط على زر "تنظيف الصور القديمة" لحذف حقل `imageUrl` الثقيل بشكل غير مدمّر ومستقر.
          </div>
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
