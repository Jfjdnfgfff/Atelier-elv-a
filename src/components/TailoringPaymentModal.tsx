import React, { useMemo, useState } from 'react';
import { MaintenanceOrder, TailoringPayment, TailoringPaymentMethod } from '../types';
import { Modal } from './Shared';
import { Banknote, Calendar, Check, CreditCard, Trash2, Wallet, AlertTriangle, Info, ChevronDown, Landmark } from 'lucide-react';
import {
  TAILORING_PAYMENT_METHODS,
  tailoringPaymentMethodLabel,
  getTailoringPayments,
  getTailoringPaidTotal,
  getTailoringRemaining,
  tailoringPriceOf,
} from '../utils/tailoringPayments';

export interface TailoringPaymentInput {
  amount: number;
  date: string;
  method: TailoringPaymentMethod;
  note?: string;
  countsInCaisse: boolean;
  reduceLinkedCredit?: boolean;
}

interface TailoringPaymentModalProps {
  order: MaintenanceOrder;
  /** الدين المرتبط في سجل الديون (إن وُجد) لتجنب الاحتساب المزدوج */
  linkedCreditRemaining?: number | null;
  onSave: (payment: TailoringPaymentInput) => void;
  onDeletePayment: (paymentId: string) => void;
  onClose: () => void;
}

const formatMoney = (value: number) => (Number(value) || 0).toLocaleString('fr-DZ');

export const TailoringPaymentModal: React.FC<TailoringPaymentModalProps> = ({
  order,
  linkedCreditRemaining,
  onSave,
  onDeletePayment,
  onClose,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const price = tailoringPriceOf(order);
  const payments = useMemo(() => getTailoringPayments(order), [order]);
  const paidTotal = getTailoringPaidTotal(order);
  const remaining = getTailoringRemaining(order);

  const [amount, setAmount] = useState<number | ''>(remaining > 0 ? remaining : '');
  const [date, setDate] = useState<string>(today);
  const [method, setMethod] = useState<TailoringPaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [countsInCaisse, setCountsInCaisse] = useState(true);
  const [reduceLinkedCredit, setReduceLinkedCredit] = useState(false);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const safeAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const newPaidTotal = paidTotal + safeAmount;
  const newRemaining = Math.max(0, price - newPaidTotal);

  const hasLinkedCredit = typeof linkedCreditRemaining === 'number' && linkedCreditRemaining > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (safeAmount <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    if (!date) {
      setError('يرجى تحديد تاريخ استلام المبلغ (يوم دخوله إلى الصندوق)');
      return;
    }
    if (safeAmount > remaining + 0.001) {
      const confirmed = window.confirm(
        `المبلغ المُدخل (${formatMoney(safeAmount)} دج) أكبر من المتبقي على الزبون (${formatMoney(remaining)} دج).\n` +
        'هل تريد تسجيل المبلغ كما هو؟',
      );
      if (!confirmed) return;
    }

    onSave({
      amount: safeAmount,
      date,
      method,
      note: note.trim() || undefined,
      countsInCaisse,
      reduceLinkedCredit: hasLinkedCredit && reduceLinkedCredit && countsInCaisse,
    });

    // تفريغ الحقول ومنع التسجيل بالخطأ مرتين لنفس الدفعة
    setLastSaved(safeAmount);
    setAmount('');
    setNote('');
    setReduceLinkedCredit(false);
    setError('');
  };

  const handleDelete = (payment: TailoringPayment) => {
    if (window.confirm(
      `هل أنت متأكد من حذف هذه الدفعة (${formatMoney(payment.amount)} دج بتاريخ ${payment.date})؟\n` +
      'سيُعاد احتساب المدفوع والمتبقي على الطلب، وسيُخصم المبلغ من صندوق ذلك اليوم.',
    )) {
      onDeletePayment(payment.id);
    }
  };

  return (
    <Modal title={`تسجيل فارسمو (دفعة) — طلب ${order.orderNumber}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
        {/* ملخص الطلب */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-bold text-sm text-slate-900 block truncate">
                {order.customerName || 'طلب داخلي للمحل'}
              </span>
              <span className="text-[11px] text-slate-500 block truncate">
                {order.itemName} • {order.description}
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-lg shrink-0">
              {payments.length} دفعة مسجلة
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-white p-2 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 block">سعر الخدمة</span>
              <span className="font-bold font-mono text-slate-900 text-xs">{formatMoney(price)} دج</span>
            </div>
            <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
              <span className="text-[10px] text-emerald-800 block font-bold">المدفوع</span>
              <span className="font-bold font-mono text-emerald-900 text-xs">{formatMoney(paidTotal)} دج</span>
            </div>
            <div className="bg-rose-50 p-2 rounded-xl border border-rose-200">
              <span className="text-[10px] text-rose-800 block font-bold">المتبقي</span>
              <span className="font-bold font-mono text-rose-900 text-xs">{formatMoney(remaining)} دج</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            مبلغ الفارسمو (الدفعة) بالدينار *
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              step="any"
              autoFocus
              value={amount}
              onChange={(e) => { setAmount(e.target.value === '' ? '' : Number(e.target.value)); setError(''); setLastSaved(null); }}
              placeholder="1000"
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold font-mono text-slate-900 focus:border-slate-800 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { setAmount(remaining); setLastSaved(null); }}
              className="px-3 py-2 rounded-xl text-[11px] font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all shrink-0"
            >
              المتبقي كامل
            </button>
            <button
              type="button"
              onClick={() => { setAmount(Math.round(remaining / 2)); setLastSaved(null); }}
              className="px-3 py-2 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 transition-all shrink-0"
            >
              النصف
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {[500, 1000, 2000, 5000].map(quick => (
              <button
                key={quick}
                type="button"
                onClick={() => { setAmount(quick); setLastSaved(null); }}
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all font-mono"
              >
                {quick.toLocaleString('fr-DZ')} دج
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>تاريخ استلام المال (يوم دخوله إلى الصندوق) *</span>
          </label>
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {[
              { value: today, label: 'اليوم' },
              { value: yesterday, label: 'أمس' },
              { value: order.receivedDate, label: `تاريخ الاستلام (${order.receivedDate})` },
            ].filter((option, index, arr) => option.value && arr.findIndex(o => o.value === option.value) === index).map(option => (
              <button
                key={option.label}
                type="button"
                onClick={() => setDate(option.value)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                  date === option.value
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => { setDate(e.target.value); setError(''); }}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold font-mono text-slate-900 focus:border-slate-800 focus:outline-none"
          />
          <span className="text-[10px] text-slate-500 block mt-1">
            يُحتسب هذا الفارسمو في صندوق يوم <strong className="font-mono">{date}</strong> بالضبط.
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">طريقة الدفع</label>
          <div className="grid grid-cols-2 gap-2">
            {TAILORING_PAYMENT_METHODS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border text-right ${
                  method === m.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظة / مرجع الوصل (اختياري)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: دفعة ثانية عند القياس، رقم وصل 2210..."
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:border-slate-800 focus:outline-none"
          />
        </div>

        {/* خيارات متقدمة: تجنب الاحتساب المزدوج مع سجل الديون */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setAdvancedOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-all text-[11px] font-bold text-slate-700"
          >
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>خيارات متقدمة (لتجنب الاحتساب المزدوج في الصندوق)</span>
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </button>

          {advancedOpen && (
            <div className="p-3 space-y-2 bg-white">
              <label className="flex items-start gap-2 text-[11px] text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={!countsInCaisse}
                  onChange={(e) => setCountsInCaisse(!e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-slate-900 shrink-0"
                />
                <span>
                  هذا المبلغ <strong>محصَّل مسبقاً عبر سجل الديون (الكريدي)</strong> ولا يجب احتسابه مرة ثانية في صندوق اليوم.
                  سيُسجَّل في سجل دفعات الطلب فقط لإبراء ذمة الزبون.
                </span>
              </label>

              {hasLinkedCredit && (
                <label className="flex items-start gap-2 text-[11px] text-slate-700 font-medium pt-2 border-t border-slate-100">
                  <input
                    type="checkbox"
                    checked={reduceLinkedCredit}
                    disabled={!countsInCaisse}
                    onChange={(e) => setReduceLinkedCredit(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-slate-900 shrink-0"
                  />
                  <span>
                    خصم هذا المبلغ من الدين المرتبط في سجل الديون (المتبقي حالياً{' '}
                    <strong className="font-mono">{formatMoney(linkedCreditRemaining || 0)} دج</strong>) دون احتسابه مرتين في الصندوق.
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* نتيجة العملية */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-950">
            <Wallet className="w-3.5 h-3.5 text-blue-700" />
            <span>بعد تسجيل هذا الفارسمو:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white rounded-lg border border-blue-200 px-2 py-1.5">
              <span className="text-slate-500 block">إجمالي المدفوع</span>
              <span className="font-bold font-mono text-emerald-800">{formatMoney(newPaidTotal)} دج</span>
            </div>
            <div className="bg-white rounded-lg border border-blue-200 px-2 py-1.5">
              <span className="text-slate-500 block">المتبقي بعد الدفعة</span>
              <span className={`font-bold font-mono ${newRemaining > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {newRemaining > 0 ? `${formatMoney(newRemaining)} دج` : 'خالص بالكامل ✓'}
              </span>
            </div>
          </div>
        </div>

        {lastSaved !== null && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-3 py-2 text-[11px] font-bold flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>تم تسجيل فارسمو {formatMoney(lastSaved)} دج بنجاح وتحديث سجل الدفعات — يمكنك تسجيل دفعة أخرى أو الإغلاق.</span>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-3 py-2 text-[11px] font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* سجل الدفعات السابقة */}
        {payments.length > 0 && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-100/70 px-3 py-1.5 text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-slate-500" />
              <span>سجل الفارمسوات السابقة ({payments.length})</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
              {payments.map(payment => (
                <div key={payment.id} className="p-2 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <span className="font-bold font-mono text-xs text-slate-900 block">
                      +{formatMoney(payment.amount)} دج
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      <span className="font-mono">{payment.date}</span> • {tailoringPaymentMethodLabel(payment.method)}
                      {payment.legacy ? ' • دفعة أصلية' : ''}
                      {payment.countsInCaisse === false ? ' • غير محتسبة في الصندوق' : ''}
                      {payment.note ? ` • ${payment.note}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(payment)}
                    title="حذف هذه الدفعة (تصحيح قيد)"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-xs min-h-[44px] flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>تسجيل الفارسمو</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all min-h-[44px]"
          >
            إلغاء
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 font-medium pt-1">
          <span className="flex items-center gap-1"><Banknote className="w-3 h-3" /> كاش / تحويل / شيك</span>
          <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> يُسجَّل في صندوق يوم الاستلام</span>
        </div>
      </form>
    </Modal>
  );
};
