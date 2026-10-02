import React from 'react';
import { Wallet, Landmark } from 'lucide-react';
import { FundSource } from '../types';

interface FundSourcePickerProps {
  value: FundSource;
  onChange: (source: FundSource) => void;
  /** الرصيد الحالي للصندوق العام (الخزينة) */
  generalFundBalance?: number;
  /** المبلغ المُدخل (لتنبيه تجاوز الرصيد عند الخصم) */
  amount?: number | '';
  /** السؤال المعروض أعلى الأزرار */
  question?: string;
  /** شرح ما سيحدث عند اختيار صندوق اليوم */
  dailyHint?: string;
  /** شرح ما سيحدث عند اختيار الصندوق العام */
  generalHint?: string;
  /** هل ننبّه عند تجاوز رصيد الصندوق العام؟ (يُستعمل عند الخصم فقط) */
  warnOnInsufficient?: boolean;
  compact?: boolean;
}

export const FundSourcePicker: React.FC<FundSourcePickerProps> = ({
  value,
  onChange,
  generalFundBalance,
  amount = '',
  question = 'من أين يتم خصم هذا المصروف؟ *',
  dailyHint = 'سيُخصم المبلغ من مبلغ الدرج اليومي وسيظهر ضمن فارق صندوق اليوم (Fi Nhar).',
  generalHint = 'سيُخصم المبلغ من رصيد الصندوق العام مباشرة، ولن يتأثر حساب فارق صندوق اليوم.',
  warnOnInsufficient = true,
  compact = false
}) => {
  const balance = Number(generalFundBalance) || 0;
  const entered = typeof amount === 'number' ? amount : 0;
  const isOverBalance = warnOnInsufficient && value === 'general' && entered > 0 && entered > balance;

  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-slate-50/70 ${compact ? 'p-2.5' : 'p-3'} space-y-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5 text-slate-500" />
          <span>{question}</span>
        </span>
        {value === 'general' && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
            isOverBalance
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            رصيد الصندوق العام: {balance.toLocaleString()} دج
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('daily')}
          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
            value === 'daily'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>صندوق اليوم (الدرج)</span>
        </button>
        <button
          type="button"
          onClick={() => onChange('general')}
          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
            value === 'general'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>الصندوق العام (الخزينة)</span>
        </button>
      </div>

      <p className={`text-[11px] font-medium ${isOverBalance ? 'text-rose-600' : 'text-slate-500'}`}>
        {value === 'daily'
          ? dailyHint
          : isOverBalance
            ? `تنبيه: المبلغ المُدخل (${entered.toLocaleString()} دج) أكبر من رصيد الصندوق العام المتوفر (${balance.toLocaleString()} دج). سيصبح الرصيد بالسالب.`
            : generalHint}
      </p>
    </div>
  );
};
