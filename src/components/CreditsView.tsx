import React, { useState, useMemo, useEffect } from 'react';
import { Credit, Supplier, FundSource, CreditPayment } from '../types';
import { VirtualizedList } from './VirtualizedList';
import type { ExtractedCustomerData } from './CustomerIdScannerModal';
const CustomerIdScannerModal = React.lazy(() => import('./CustomerIdScannerModal').then(m => ({ default: m.CustomerIdScannerModal })));
import { LettersInput, NumbersInput } from './Shared';
import { sanitizeName, sanitizePhone, sanitizeText } from '../utils/security';
import { FundSourcePicker } from './FundSourcePicker';
import { creditTotalPaid, creditRemaining, isCreditSettled } from '../utils/fundBalance';
import {
  Users,
  Building2,
  Scale,
  CreditCard,
  Phone,
  Calendar,
  Check,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Wallet,
  Landmark,
  CalendarDays,
  History
} from 'lucide-react';

interface CreditsViewProps {
  credits: Credit[];
  suppliers?: Supplier[];
  onAddCredit: (data: any) => void;
  /** تسجيل دفعة تسديد (كاملة أو جزئية) مع تاريخها والصندوق الذي دخلت/خرجت منه */
  onSettleCredit: (creditId: string, payment: { amount: number; date: string; fundSource: FundSource; note?: string }) => void;
  onDeleteCredit: (id: string) => void;
  /** الرصيد الحالي للصندوق العام (الخزينة) */
  generalFundBalance?: number;
}

const todayDateString = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().split('T')[0];
};

export const CreditsView: React.FC<CreditsViewProps> = React.memo(({
  credits,
  suppliers = [],
  onAddCredit,
  onSettleCredit,
  onDeleteCredit,
  generalFundBalance = 0
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'customers' | 'suppliers'>('all');
  const [debtCategory, setDebtCategory] = useState<'customer' | 'supplier'>('customer');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState('دين كراء فستان');
  const [creditDate, setCreditDate] = useState<string>(todayDateString());
  const [showScanner, setShowScanner] = useState(false);

  // نافذة تسديد الكريدي: المبلغ + التاريخ + الصندوق
  const [settleCredit, setSettleCredit] = useState<Credit | null>(null);
  const [settleAmount, setSettleAmount] = useState<number | ''>('');
  const [settlementMode, setSettlementMode] = useState<'partial' | 'full'>('full');
  const [settleDate, setSettleDate] = useState<string>(todayDateString());
  const [settleFund, setSettleFund] = useState<FundSource>('daily');

  const openSettleModal = (credit: Credit, mode: 'partial' | 'full') => {
    setSettleCredit(credit);
    setSettlementMode(mode);
    setSettleAmount(mode === 'full' ? creditRemaining(credit) : '');
    setSettleDate(todayDateString());
    setSettleFund('daily');
  };

  const confirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleCredit) return;
    const value = Number(settleAmount) || 0;
    if (value <= 0) return;
    if (value > creditRemaining(settleCredit) && !window.confirm(
      `المبلغ المُدخل (${value.toLocaleString()} دج) أكبر من المتبقي (${creditRemaining(settleCredit).toLocaleString()} دج). هل تريد المتابعة؟`
    )) {
      return;
    }
    onSettleCredit(settleCredit.id, {
      amount: value,
      date: settleDate,
      fundSource: settleFund
    });
    setSettleCredit(null);
    setSettleAmount('');
  };

  const customerCreditTypes = [
    'دين كراء فستان',
    'دين شراء ملابس',
    'متبقي حجز فستان',
    'دين تعديل وخياطة',
    'دين زبون آخر'
  ];

  const supplierCreditTypes = [
    'دين للمورد (كريدي سلعة)',
    'متبقي فاتورة مورد',
    'دين قماش ومستلزمات',
    'دين مورد آخر'
  ];

  const handleCustomerExtracted = (data: ExtractedCustomerData) => {
    if (data.name) setName(data.name);
    if (data.phone) setPhone(data.phone);
    if (data.idNumber && !desc) setDesc(`بطاقة تعريف: ${data.idNumber}`);
  };

  const handleSupplierSelect = (supName: string) => {
    setName(supName);
    const sup = suppliers.find(s => s.name === supName);
    if (sup && sup.phone) setPhone(sup.phone);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;

    const isSup = debtCategory === 'supplier';

    onAddCredit({
      name: name.trim(),
      phone: phone.trim(),
      desc: desc.trim(),
      amount: Number(amount),
      type: isSup ? (type.includes('مورد') ? type : 'دين للمورد (كريدي سلعة)') : type,
      supplierDebt: isSup,
      supplierName: isSup ? name.trim() : undefined,
      goodsDescription: isSup ? desc.trim() : undefined,
      date: new Date(creditDate || todayDateString()).toISOString()
    });

    setName('');
    setPhone('');
    setDesc('');
    setAmount('');
    setCreditDate(todayDateString());
  };

  // Calculations
  const customerDebts = credits.filter(c => !c.supplierDebt);
  const supplierDebts = credits.filter(c => !!c.supplierDebt);

  const totalCustomerDebt = customerDebts.reduce((s, c) => s + Number(c.amount), 0);
  const totalSupplierDebt = supplierDebts.reduce((s, c) => s + Number(c.amount), 0);
  const netDebtBalance = totalCustomerDebt - totalSupplierDebt;

  const filteredCredits = credits.filter(c => {
    if (filterTab === 'customers') return !c.supplierDebt;
    if (filterTab === 'suppliers') return !!c.supplierDebt;
    return true;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab]);

  const totalPages = Math.max(1, Math.ceil(filteredCredits.length / PAGE_SIZE));
  const paginatedCredits = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCredits.slice(start, start + PAGE_SIZE);
  }, [filteredCredits, currentPage]);

  return (
    <div className="space-y-4 pb-8" dir="rtl">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-amber-50/70 via-white to-orange-50/70 p-4 sm:p-5 rounded-2xl border border-amber-100 shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                <Scale className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">سجل الديون والكريدي الشامل</h2>
            </div>
            <p className="text-xs text-slate-600 font-normal mt-1 mr-10">
              متابعة ديون الزبائن (أموال لنا في الخارج) وديون الموردين (التزامات شراء السلعة).
            </p>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-white/90 border border-amber-100 p-3.5 rounded-xl shadow-2xs">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-amber-900 font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600" />
                <span>ديون على الزبائن (لنا):</span>
              </span>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold">
                {customerDebts.length} زبائن
              </span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
              {totalCustomerDebt.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">مبالغ كراء وبيع بانتظار التحصيل</span>
          </div>

          <div className="bg-white/90 border border-rose-100 p-3.5 rounded-xl shadow-2xs">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-rose-900 font-bold flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-rose-600" />
                <span>ديون للموردين (علينا):</span>
              </span>
              <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-bold">
                {supplierDebts.length} موردين
              </span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-rose-600 font-mono">
              {totalSupplierDebt.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">متبقي كريدي شراء سلع وفواتير</span>
          </div>

          <div className="bg-white/90 border border-slate-200/80 p-3.5 rounded-xl shadow-2xs">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-slate-600" />
                <span>صافي الميزان الائتماني:</span>
              </span>
              <span className="text-[10px] font-normal text-slate-500">(لنا - علينا)</span>
            </div>
            <span className={`text-lg sm:text-xl font-bold font-mono ${
              netDebtBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {netDebtBalance >= 0 ? `+${netDebtBalance.toLocaleString()}` : netDebtBalance.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {netDebtBalance >= 0 ? 'رصيد إيجابي لصالح البوتيك' : 'التزامات الموردين تتجاوز ديون الزبائن'}
            </span>
          </div>
        </div>
      </div>

      {/* Add Debt Form */}
      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">تسجيل دين / كريدي جديد</h3>
            <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => { setDebtCategory('customer'); setType('دين كراء فستان'); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  debtCategory === 'customer' ? 'bg-amber-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-amber-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>على زبون (لنا)</span>
              </button>
              <button
                type="button"
                onClick={() => { setDebtCategory('supplier'); setType('دين للمورد (كريدي سلعة)'); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  debtCategory === 'supplier' ? 'bg-rose-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-rose-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>للمورد (علينا)</span>
              </button>
            </div>
          </div>

          {debtCategory === 'customer' && (
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 active:scale-95 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-700" />
              <span>مسح بطاقة الهوية / الباركود</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {debtCategory === 'supplier' ? 'اسم المورد *' : 'اسم الزبون *'}
            </label>
            {debtCategory === 'supplier' && suppliers.length > 0 ? (
              <div className="space-y-1">
                <select
                  onChange={(e) => handleSupplierSelect(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium bg-white focus:outline-none focus:border-slate-400"
                >
                  <option value="">-- اختر مورد أو اكتب أدناه --</option>
                  {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <LettersInput
                  required
                  value={name}
                  onChange={setName}
                  placeholder="اسم المورد (أحرف فقط)..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal focus:outline-none focus:border-slate-400"
                />
              </div>
            ) : (
              <LettersInput
                required
                value={name}
                onChange={setName}
                placeholder="الاسم واللقب (أحرف فقط)..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal focus:outline-none focus:border-slate-400"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">رقم الهاتف (أرقام فقط)</label>
            <NumbersInput
              allowPlus
              value={phone}
              onChange={setPhone}
              placeholder="05 / 06 / 07..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">مبلغ الدين (دج) *</label>
            <input
              type="number"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">نوع الدين</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-slate-400"
            >
              {(debtCategory === 'supplier' ? supplierCreditTypes : customerCreditTypes).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
              <CalendarDays className="w-3 h-3 text-slate-400" />
              <span>تاريخ الدين / الكريدي</span>
            </label>
            <input
              type="date"
              value={creditDate}
              onChange={(e) => setCreditDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:border-slate-400"
            />
          </div>
        </div>

        {creditDate !== todayDateString() && (
          <div className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2">
            <span>التاريخ المحدد للدين هو {creditDate} (وليس اليوم).</span>
            <button
              type="button"
              onClick={() => setCreditDate(todayDateString())}
              className="text-[10px] bg-white border border-amber-300 text-amber-800 px-2 py-0.5 rounded-md font-bold hover:bg-amber-100 transition-colors"
            >
              العودة لتاريخ اليوم
            </button>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {debtCategory === 'supplier' ? 'تفاصيل السلعة المشتراة أو الفاتورة' : 'البيان / ملاحظات'}
          </label>
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={debtCategory === 'supplier' ? "مثال: متبقي شراء 3 فساتين سهرة تركية..." : "مثال: متبقي كراء فستان أسود..."}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal focus:outline-none focus:border-slate-400"
          />
        </div>

        <button
          type="submit"
          className={`w-full py-2.5 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-[0.98] flex items-center justify-center gap-1.5 ${
            debtCategory === 'customer' 
              ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' 
              : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{debtCategory === 'supplier' ? 'تسجيل دين للمورد' : 'تسجيل دين على الزبون'}</span>
        </button>
      </form>

      {/* Scanner Modal */}
      {showScanner && (
        <React.Suspense fallback={null}>
          <CustomerIdScannerModal
            title="مسح بطاقة هوية أو باركود الزبون (كريدي)"
            onExtract={handleCustomerExtracted}
            onClose={() => setShowScanner(false)}
          />
        </React.Suspense>
      )}

      {/* Settle Credit Modal: المبلغ + التاريخ + الصندوق */}
      {settleCredit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" dir="rtl">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-xl border border-slate-200/80 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>
                    {settleCredit.supplierDebt
                      ? settlementMode === 'partial' ? 'تسديد جزء من دين المورد' : 'تسديد كامل دين المورد'
                      : settlementMode === 'partial' ? 'تحصيل جزء من دين الزبون' : 'تحصيل كامل دين الزبون'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  {settleCredit.supplierDebt
                    ? 'سيُخصم المبلغ من الصندوق الذي تختاره.'
                    : 'سيُضاف المبلغ إلى الصندوق الذي تختاره.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettleCredit(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-normal">{settleCredit.supplierDebt ? 'المورد:' : 'الزبون:'}</span>
                <span className="font-bold text-slate-900">{settleCredit.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-normal">البيان:</span>
                <span className="font-medium text-slate-800 line-clamp-1">{settleCredit.desc || settleCredit.type}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-normal">إجمالي الدين:</span>
                <span className="font-bold text-slate-900 font-mono">{Number(settleCredit.amount).toLocaleString()} دج</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-normal">المسدَّد سابقاً:</span>
                <span className="font-bold text-slate-900 font-mono">{creditTotalPaid(settleCredit).toLocaleString()} دج</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-700 font-medium">المتبقي حالياً:</span>
                <span className="font-bold text-rose-600 font-mono text-sm">{creditRemaining(settleCredit).toLocaleString()} دج</span>
              </div>
            </div>

            <form onSubmit={confirmSettle} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-medium text-slate-700">المبلغ (دج) *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setSettlementMode('full');
                        setSettleAmount(creditRemaining(settleCredit));
                      }}
                      className="text-[10px] text-slate-600 hover:text-slate-900 font-medium underline"
                    >
                      تسديد كامل المتبقي
                    </button>
                  </div>
                  <input
                    type="number"
                    required
                    min="1"
                    value={settleAmount}
                    onChange={(e) => {
                      const value = e.target.value === '' ? '' : Number(e.target.value);
                      setSettleAmount(value);
                      setSettlementMode(
                        value !== '' && value >= creditRemaining(settleCredit) ? 'full' : 'partial',
                      );
                    }}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3 text-slate-400" />
                    <span>تاريخ استلام / دفع المال *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white"
                  />
                </div>
              </div>

              <FundSourcePicker
                value={settleFund}
                onChange={setSettleFund}
                generalFundBalance={generalFundBalance}
                amount={settleAmount}
                warnOnInsufficient={!!settleCredit.supplierDebt}
                question={settleCredit.supplierDebt ? 'من أي صندوق يُخصم المبلغ؟ *' : 'إلى أي صندوق يُضاف المبلغ؟ *'}
                dailyHint={
                  settleCredit.supplierDebt
                    ? 'سيُخصم المبلغ من درج اليوم ويُحسب ضمن مصاريف ذلك اليوم في الصندوق.'
                    : 'سيُضاف المبلغ إلى مدخول درج اليوم ويُحسب ضمن مداخيل ذلك التاريخ في الصندوق.'
                }
                generalHint={
                  settleCredit.supplierDebt
                    ? 'سيُخصم المبلغ من رصيد الصندوق العام، ولن يتأثر درج اليوم.'
                    : 'سيُضاف المبلغ إلى رصيد الصندوق العام مباشرة، ولن يتأثر درج اليوم.'
                }
              />

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 ${
                    settleFund === 'general' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {settleFund === 'general' ? <Landmark className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                  <span>
                    {settleCredit.supplierDebt ? 'تأكيد الدفع من ' : 'تأكيد التحصيل في '}
                    {settleFund === 'general' ? 'الصندوق العام (الخزينة)' : 'صندوق اليوم (الدرج)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettleCredit(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit List with Filters */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">قائمة الديون المسجلة</h3>
          
          <div className="flex gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filterTab === 'all' ? 'bg-amber-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-amber-800'
              }`}
            >
              الكل ({credits.length})
            </button>
            <button
              onClick={() => setFilterTab('customers')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                filterTab === 'customers' ? 'bg-amber-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-amber-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>ديون الزبائن ({customerDebts.length})</span>
            </button>
            <button
              onClick={() => setFilterTab('suppliers')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                filterTab === 'suppliers' ? 'bg-rose-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-rose-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>ديون الموردين ({supplierDebts.length})</span>
            </button>
          </div>
        </div>

        <VirtualizedList<Credit>
          items={filteredCredits}
          getItemKey={(credit) => credit.id}
          estimateSize={70}
          emptyMessage="لا توجد أي ديون مسجلة في هذا القسم."
          renderItem={(credit) => {
            const isSupplierDebt = credit.supplierDebt;

            return (
              <div className="py-3 px-3 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{credit.name}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/70">
                      {isSupplierDebt ? 'دين مورد (علينا)' : 'دين زبون (لنا)'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-normal mt-1 flex flex-wrap items-center gap-2">
                    {credit.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{credit.phone}</span>
                      </span>
                    )}
                    <span>• {credit.type}</span>
                    {credit.desc && <span className="text-slate-700">({credit.desc})</span>}
                    <span className="flex items-center gap-1">
                      • <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{new Date(credit.date).toLocaleDateString('ar-DZ')}</span>
                    </span>
                  </div>

                  {/* سجل دفعات التسديد مع التاريخ والصندوق */}
                  {Array.isArray(credit.payments) && credit.payments.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {credit.payments.map(payment => (
                        <div key={payment.id} className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="flex items-center gap-1 text-slate-500 font-mono">
                            <History className="w-3 h-3 text-slate-400" />
                            <span>{payment.date}</span>
                          </span>
                          <span className="font-bold font-mono text-emerald-700">
                            {credit.supplierDebt ? '-' : '+'}{Number(payment.amount).toLocaleString()} دج
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-md font-bold border flex items-center gap-1 ${
                            payment.fundSource === 'general'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {payment.fundSource === 'general'
                              ? <><Landmark className="w-2.5 h-2.5" /><span>الصندوق العام</span></>
                              : <><Wallet className="w-2.5 h-2.5" /><span>صندوق اليوم</span></>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <span className="font-bold text-sm font-mono text-slate-900 block">
                      {credit.amount.toLocaleString()} دج
                    </span>
                    {creditTotalPaid(credit) > 0 && (
                      <span className="text-[10px] font-mono text-slate-500 block">
                        مسدد: {creditTotalPaid(credit).toLocaleString()} • المتبقي: {creditRemaining(credit).toLocaleString()} دج
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {isCreditSettled(credit) ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>مسدّد بالكامل</span>
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openSettleModal(credit, 'partial')}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all text-[11px] sm:text-xs flex items-center gap-1 active:scale-95 ${
                            isSupplierDebt
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>تسديد جزء</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openSettleModal(credit, 'full')}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all text-[11px] sm:text-xs flex items-center gap-1 active:scale-95 ${
                            isSupplierDebt
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>تسديد بالكامل</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => {
                        const paid = creditTotalPaid(credit);
                        const message = paid > 0
                          ? `هذا الدين مسدَّد منه ${paid.toLocaleString()} دج.\nحذفه سيعكس أثر الدفعات على الصندوق ويعيد المتبقي كدين كامل.\nهل تريد المتابعة؟`
                          : `هل أنت متأكد من حذف دين (${credit.name}) بمبلغ ${Number(credit.amount).toLocaleString()} دج؟`;
                        if (window.confirm(message)) onDeleteCredit(credit.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
});
