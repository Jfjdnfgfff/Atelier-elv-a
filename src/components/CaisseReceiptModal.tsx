import React, { useState } from 'react';
import { DailyCaisseClosure } from '../types';
import { Download, Printer, Scale, Calendar, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';
import { downloadElementAsPng } from '../utils/pngDownload';
import { openPrintInterface } from '../utils/printInterface';

interface CaisseReceiptModalProps {
  closure: DailyCaisseClosure;
  onClose: () => void;
}

export const CaisseReceiptModal: React.FC<CaisseReceiptModalProps> = ({ closure, onClose }) => {
  const [downloadNote, setDownloadNote] = useState('');
  const fileName = `وصل_إقفال_صندوق_${closure.date}`;

  const exportAsImage = async () => {
    const el = document.getElementById('caisseReceiptPrintArea');
    if (!el) return;
    setDownloadNote('جاري تنزيل الصورة بصيغة PNG...');
    try {
      await downloadElementAsPng(el, fileName);
      setDownloadNote('تم تنزيل الصورة بصيغة PNG');
    } catch (error) {
      console.error('Error generating receipt image:', error);
      setDownloadNote('تعذر تنزيل الصورة بصيغة PNG');
    }
  };

  const handlePrint = () => {
    openPrintInterface({
      title: `وصل إقفال الصندوق ${closure.date}`,
      fileName,
      sourceElement: document.getElementById('caisseReceiptPrintArea'),
    });
  };

  const isShortage = closure.difference < 0;
  const isSurplus = closure.difference > 0;
  const isBalanced = closure.difference === 0;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Action Controls */}
      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 no-print">
        <span className="text-xs font-bold text-slate-600">{downloadNote || 'تنزيل الوصل صورة PNG، أو الانتقال إلى واجهة الطباعة'}</span>
        <div className="flex gap-2">
          <button
            onClick={exportAsImage}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تنزيل صور PNG</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700" />
            <span>طباعة الوصل</span>
          </button>
        </div>
      </div>

      {/* Printable Receipt Area */}
      <div 
        id="caisseReceiptPrintArea" 
        className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm max-w-md mx-auto text-slate-900 font-sans print:border-none print:shadow-none print:p-2"
      >
        {/* Receipt Header */}
        <div className="text-center pb-4 border-b-2 border-dashed border-slate-300">
          <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-2xl mx-auto flex items-center justify-center text-xl font-bold mb-1 border border-slate-200">
            <Scale className="w-6 h-6 text-slate-700" />
          </div>
          <h2 className="text-lg font-black text-blue-600">بوتيك مانجر برو</h2>
          <p className="text-xs font-bold text-slate-500">وصل إقفال ومطابقة الصندوق اليومي (Ticket de Caisse)</p>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>تاريخ الصندوق: {closure.date}</span>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`mt-4 p-3 rounded-xl text-center border ${
          isShortage ? 'bg-slate-50 border-slate-300 text-slate-900' :
          isSurplus ? 'bg-slate-50 border-slate-300 text-slate-900' :
          'bg-slate-50 border-slate-200 text-slate-900'
        }`}>
          <div className="text-xs font-bold text-slate-600">حالة الصندوق المحسوبة:</div>
          <div className="text-sm font-bold mt-1 flex items-center justify-center gap-1.5">
            {isShortage && (
              <>
                <AlertTriangle className="w-4 h-4 text-slate-700" />
                <span>عجز في الصندوق (Manque): {Math.abs(closure.difference).toLocaleString()} دج</span>
              </>
            )}
            {isSurplus && (
              <>
                <TrendingUp className="w-4 h-4 text-slate-700" />
                <span>فائض في الصندوق (Excédent): +{closure.difference.toLocaleString()} دج</span>
              </>
            )}
            {isBalanced && (
              <>
                <CheckCircle className="w-4 h-4 text-slate-700" />
                <span>الصندوق مطابق تماماً (0 دج فارق)</span>
              </>
            )}
          </div>
        </div>

        {/* Cash Breakdown Table */}
        <div className="mt-4 space-y-2 text-xs">
          <div className="font-black text-slate-700 pb-1 border-b border-slate-200">
            1. حركة المداخيل والمقبوضات (Entrées)
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-600">رصيد الافتتاح (Fond de caisse):</span>
            <span className="font-bold font-mono">{(closure.openingBalance || 0).toLocaleString()} دج</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-600">مبيعات كاش (Ventes):</span>
            <span className="font-bold text-blue-700 font-mono">+{(closure.salesIncome || 0).toLocaleString()} دج</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-600">مقبوضات كراء (Locations):</span>
            <span className="font-bold text-blue-700 font-mono">+{(closure.rentalsIncome || 0).toLocaleString()} دج</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-600">مقبوضات خياطة وصيانة (Retouches):</span>
            <span className="font-bold text-blue-700 font-mono">+{(closure.tailoringIncome || 0).toLocaleString()} دج</span>
          </div>
          {(closure.cautionsReceived || 0) > 0 && (
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">ضمانات مستلمة (Cautions):</span>
              <span className="font-bold text-blue-700 font-mono">+{(closure.cautionsReceived || 0).toLocaleString()} دج</span>
            </div>
          )}
          <div className="flex justify-between py-1.5 bg-slate-50 px-2 rounded-lg font-black text-slate-900">
            <span>إجمالي المداخيل النقدية:</span>
            <span className="font-mono">{closure.totalInflow.toLocaleString()} دج</span>
          </div>

          <div className="font-black text-slate-700 pt-2 pb-1 border-b border-slate-200">
            2. حركة المصاريف والخوارج (Sorties)
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-600">مصاريف المحل المسددة كاش:</span>
            <span className="font-bold text-black font-mono">-{(closure.expensesPaid || 0).toLocaleString()} دج</span>
          </div>
          {(closure.staffPayoutsPaid || 0) > 0 && (
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">دفعات وأجور العمال كاش:</span>
              <span className="font-bold text-black font-mono">-{(closure.staffPayoutsPaid || 0).toLocaleString()} دج</span>
            </div>
          )}
          {(closure.cautionsRefunded || 0) > 0 && (
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">ضمانات تم إرجاعها كاش:</span>
              <span className="font-bold text-black font-mono">-{(closure.cautionsRefunded || 0).toLocaleString()} دج</span>
            </div>
          )}
          <div className="flex justify-between py-1.5 bg-slate-50 px-2 rounded-lg font-black text-slate-900">
            <span>إجمالي المصاريف النقدية:</span>
            <span className="font-mono">{closure.totalOutflow.toLocaleString()} دج</span>
          </div>

          {/* Balance Comparison */}
          <div className="mt-4 pt-3 border-t-2 border-dashed border-slate-300 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-bold">المبلغ النظري المتوقع (Théorique):</span>
              <span className="text-slate-900 font-black font-mono">{closure.theoreticalAmount.toLocaleString()} دج</span>
            </div>
            <div className="flex justify-between items-center text-xs bg-slate-100 p-2 rounded-lg">
              <span className="text-slate-800 font-black">المبلغ الفعلي المحسوب (Réel en caisse):</span>
              <span className="text-slate-900 font-black text-sm font-mono">{closure.actualAmount.toLocaleString()} دج</span>
            </div>
            <div className={`flex justify-between items-center text-sm p-2 rounded-lg font-black ${
              isShortage ? 'bg-black text-white' :
              isSurplus ? 'bg-blue-50 text-blue-700' :
              'bg-slate-100 text-slate-900'
            }`}>
              <span>الفارق والعجز (Écart / Manque):</span>
              <span className="font-mono text-base">
                {closure.difference > 0 ? `+${closure.difference.toLocaleString()}` : closure.difference.toLocaleString()} دج
              </span>
            </div>
          </div>

          {closure.notes && (
            <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
              <span className="font-bold">ملاحظات الإقفال: </span>
              <span>{closure.notes}</span>
            </div>
          )}
        </div>

        {/* Footer & Signatures */}
        <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-center text-[10px] text-slate-500">
          <div>
            <div className="font-bold text-slate-700 mb-6">توقيع أمين الصندوق / البائع</div>
            <div className="border-t border-dotted border-slate-300 pt-1">الاسم والصفة</div>
          </div>
          <div>
            <div className="font-bold text-slate-700 mb-6">توقيع مسؤول / صاحب المحل</div>
            <div className="border-t border-dotted border-slate-300 pt-1">المصادقة والاعتماد</div>
          </div>
        </div>

        <div className="mt-4 text-center text-[9px] text-slate-400">
          تم الإقفال آلياً عبر نظام بوتيك مانجر برو في: {new Date(closure.closedAt).toLocaleString('fr-DZ')}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onClose}
          className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
        >
          إغلاق النافذة
        </button>
      </div>
    </div>
  );
};
