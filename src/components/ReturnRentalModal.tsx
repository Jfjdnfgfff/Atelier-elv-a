import React, { useState } from 'react';
import { Rental } from '../types';

interface ReturnRentalModalProps {
  rental: Rental;
  onConfirmReturn: (rentalId: string, returnData: {
    condition: 'perfect' | 'needs_cleaning' | 'damaged';
    cautionAction: 'refund' | 'deduct' | 'keep';
    penaltyAmount: number;
    collectedRemaining: number;
    sendToCleaning: boolean;
    notes: string;
  }) => void;
  onCancel: () => void;
}

export const ReturnRentalModal: React.FC<ReturnRentalModalProps> = ({ rental, onConfirmReturn, onCancel }) => {
  const [condition, setCondition] = useState<'perfect' | 'needs_cleaning' | 'damaged'>('perfect');
  const [cautionAction, setCautionAction] = useState<'refund' | 'deduct' | 'keep'>('refund');
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [collectedRemaining, setCollectedRemaining] = useState<number>(rental.remainingAmount || 0);
  const [sendToCleaning, setSendToCleaning] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmReturn(rental.id, {
      condition,
      cautionAction,
      penaltyAmount: Number(penaltyAmount),
      collectedRemaining: Number(collectedRemaining),
      sendToCleaning,
      notes
    });
  };

  return (
    <form onSubmit={handleConfirm} className="space-y-4" dir="rtl">
      {/* Summary Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-black text-slate-800 text-sm">👗 {rental.itemName}</h4>
            <p className="text-xs text-slate-500 font-bold">الزبون: {rental.customerName} ({rental.customerPhone})</p>
          </div>
          <span className="bg-rose-100 text-rose-800 text-[11px] font-black px-2.5 py-1 rounded-lg">
            كراء #{rental.id.substring(0, 6)}
          </span>
        </div>

        {/* Accessory Check Reminder */}
        {rental.hasAccessories && (
          <div className="bg-amber-100/80 border border-amber-300 p-2.5 rounded-xl text-xs font-bold text-amber-950 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base">👑</span>
              <span>الإكسسوار المرفق للكراء: <strong>{rental.accessoryName || 'إكسسوار'}</strong></span>
            </div>
            <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-lg text-[10px]">
              يرجى التأكد من استلامه مع الفستان
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">تاريخ الإرجاع المحدد:</span>
            <span className="font-black text-slate-700">{rental.expectedReturnDate}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">مبلغ الضمان (العربون):</span>
            <span className="font-black text-amber-600">{rental.cautionAmount?.toLocaleString() || 0} دج</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">المتبقي للدفع:</span>
            <span className="font-black text-rose-600">{rental.remainingAmount?.toLocaleString() || 0} دج</span>
          </div>
        </div>
      </div>

      {/* Item Condition */}
      <div>
        <label className="block text-xs font-black text-slate-700 mb-2">حالة القطعة عند الإرجاع *</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => { setCondition('perfect'); setSendToCleaning(false); }}
            className={`p-3 rounded-2xl border text-center transition-all text-xs font-bold ${
              condition === 'perfect' 
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20' 
                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className="text-base mb-1">✨</div>
            حالة ممتازة وجاهزة
          </button>
          
          <button
            type="button"
            onClick={() => { setCondition('needs_cleaning'); setSendToCleaning(true); }}
            className={`p-3 rounded-2xl border text-center transition-all text-xs font-bold ${
              condition === 'needs_cleaning' 
                ? 'bg-sky-50 border-sky-500 text-sky-800 ring-2 ring-sky-500/20' 
                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className="text-base mb-1">🧼</div>
            تحتاج غسيل جاف (Pressing)
          </button>

          <button
            type="button"
            onClick={() => { setCondition('damaged'); setCautionAction('deduct'); }}
            className={`p-3 rounded-2xl border text-center transition-all text-xs font-bold ${
              condition === 'damaged' 
                ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20' 
                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className="text-base mb-1">⚠️</div>
            تلف أو بقع صعبة
          </button>
        </div>
      </div>

      {/* Caution & Settlement */}
      <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-3">
        <h5 className="text-xs font-black text-amber-900">تسوية مبلغ الضمان (العربون - {rental.cautionAmount || 0} دج)</h5>
        <div className="grid grid-cols-3 gap-2">
          <label className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold cursor-pointer ${cautionAction === 'refund' ? 'bg-white border-amber-500 text-amber-900 shadow-xs' : 'border-transparent text-slate-600'}`}>
            <input 
              type="radio" 
              name="cautionAction" 
              checked={cautionAction === 'refund'} 
              onChange={() => setCautionAction('refund')} 
            />
            استرجاع للزبون كاملاً
          </label>
          <label className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold cursor-pointer ${cautionAction === 'deduct' ? 'bg-white border-amber-500 text-amber-900 shadow-xs' : 'border-transparent text-slate-600'}`}>
            <input 
              type="radio" 
              name="cautionAction" 
              checked={cautionAction === 'deduct'} 
              onChange={() => setCautionAction('deduct')} 
            />
            خصم غرامة / مصاريف
          </label>
          <label className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold cursor-pointer ${cautionAction === 'keep' ? 'bg-white border-amber-500 text-amber-900 shadow-xs' : 'border-transparent text-slate-600'}`}>
            <input 
              type="radio" 
              name="cautionAction" 
              checked={cautionAction === 'keep'} 
              onChange={() => setCautionAction('keep')} 
            />
            احتجاز كامل العربون
          </label>
        </div>

        {cautionAction === 'deduct' && (
          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">المبلغ المخصوم كتعويض عن الضرر/التأخير (دج)</label>
            <input
              type="number"
              min="0"
              max={rental.cautionAmount || 0}
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(Number(e.target.value))}
              className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-rose-700 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Collect Remaining Debt */}
      {rental.remainingAmount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2">
          <label className="block text-xs font-black text-rose-900">تحصيل المبلغ المتبقي للكراء (المتبقي: {rental.remainingAmount} دج)</label>
          <input
            type="number"
            min="0"
            max={rental.remainingAmount}
            value={collectedRemaining}
            onChange={(e) => setCollectedRemaining(Number(e.target.value))}
            className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-sm font-black text-emerald-700 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500">أدخل المبلغ المستلم الآن من الزبون عند تسليم الفستان.</p>
        </div>
      )}

      {/* Cleaning toggle */}
      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <span className="text-xs font-bold text-slate-700">تحويل القطعة مباشرة إلى سجل التنظيف الجاف (Pressing)</span>
        <input
          type="checkbox"
          checked={sendToCleaning}
          onChange={(e) => setSendToCleaning(e.target.checked)}
          className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظات الإرجاع</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثال: تم إرجاع الفستان نظيفاً مع المعلاق والغلاف..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors"
        >
          إلغاء
        </button>
        <button
          type="submit"
          className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs transition-all shadow-lg shadow-emerald-100 active:scale-[0.98]"
        >
          تأكيد استرجاع الفستان وتسوية الحساب ✓
        </button>
      </div>
    </form>
  );
};
