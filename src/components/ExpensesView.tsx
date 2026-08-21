import React, { useState } from 'react';
import { Expense, Supplier, Credit } from '../types';

interface ExpensesViewProps {
  expenses: Expense[];
  suppliers?: Supplier[];
  credits?: Credit[];
  onAddExpense: (exp: any) => void;
  onDeleteExpense: (id: string) => void;
  onSettleSupplierCredit?: (expenseId: string, paidNow: number) => void;
  onAddSupplier?: (sup: Supplier) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  suppliers = [],
  credits = [],
  onAddExpense,
  onDeleteExpense,
  onSettleSupplierCredit,
  onAddSupplier
}) => {
  // Mode: 'supplier' (خلاص وشراء من المورد) vs 'general' (مصاريف عامة وتجهيزات)
  const [activeFormTab, setActiveFormTab] = useState<'supplier' | 'general'>('supplier');
  const [filterTab, setFilterTab] = useState<'all' | 'suppliers' | 'general' | 'has_credit'>('all');
  const [search, setSearch] = useState('');

  // General Expense Form State
  const [generalDesc, setGeneralDesc] = useState('');
  const [generalAmount, setGeneralAmount] = useState<number | ''>('');
  const [generalCategory, setGeneralCategory] = useState('غسيل وتنظيف جاف (Pressing)');
  const [generalDate, setGeneralDate] = useState(new Date().toISOString().split('T')[0]);

  // Supplier Expense Form State
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [customSupplierName, setCustomSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [goodsDescription, setGoodsDescription] = useState('');
  const [totalInvoiceAmount, setTotalInvoiceAmount] = useState<number | ''>('');
  const [supplierPaidAmount, setSupplierPaidAmount] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [supplierDate, setSupplierDate] = useState(new Date().toISOString().split('T')[0]);

  // Quick Settle Modal State
  const [settleModalExpense, setSettleModalExpense] = useState<Expense | null>(null);
  const [settleAmount, setSettleAmount] = useState<number | ''>('');

  // Voucher Print Modal State
  const [voucherExpense, setVoucherExpense] = useState<Expense | null>(null);

  const generalCategories = [
    'غسيل وتنظيف جاف (Pressing)',
    'كراء المحل وفواتير (كهرباء، ماء، إنترنت)',
    'تغليف وأكياس فساتين ومستلزمات',
    'خياطة وتعديل مقاسات خارجية',
    'صيانة وتجهيزات وديكور المحل',
    'تسويق وإعلانات',
    'مصاريف نقل وتوصيل السلعة',
    'مصاريف تشغيلية أخرى'
  ];

  const quickGoodsSuggestions = [
    'فساتين سهرة وأعراس جديدة',
    'قفاطين ملكية ومطرزة',
    'أطقم رسمية وبليزرات',
    'أقمشة حرير، ساتان ودانتيل',
    'طرحات وإكسسوارات وحقائب سهرة',
    'برنوس وكراكو تقليدي'
  ];

  // Calculated remaining credit for supplier form
  const safeTotal = typeof totalInvoiceAmount === 'number' ? totalInvoiceAmount : 0;
  const safePaid = typeof supplierPaidAmount === 'number' ? supplierPaidAmount : 0;
  const calculatedCredit = Math.max(0, safeTotal - safePaid);

  const handleSupplierSelect = (name: string) => {
    setSelectedSupplierName(name);
    if (name === '__new__') {
      setCustomSupplierName('');
      setSupplierPhone('');
    } else {
      const sup = suppliers.find(s => s.name === name);
      if (sup) {
        setCustomSupplierName(sup.name);
        setSupplierPhone(sup.phone || '');
      }
    }
  };

  const handleQuickGoodsAdd = (item: string) => {
    if (!goodsDescription) {
      setGoodsDescription(item);
    } else if (!goodsDescription.includes(item)) {
      setGoodsDescription(prev => `${prev} + ${item}`);
    }
  };

  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalDesc.trim() || !generalAmount) return;

    onAddExpense({
      desc: generalDesc.trim(),
      amount: Number(generalAmount),
      category: generalCategory,
      date: new Date(generalDate).toISOString(),
      isSupplierPurchase: false
    });

    setGeneralDesc('');
    setGeneralAmount('');
  };

  const handleSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSupplierName = selectedSupplierName === '__new__' 
      ? customSupplierName.trim() 
      : (selectedSupplierName.trim() || customSupplierName.trim());

    if (!finalSupplierName) {
      alert('يرجى اختيار أو كتابة اسم المورد');
      return;
    }
    if (!goodsDescription.trim()) {
      alert('يرجى توضيح ماذا شريت على المورد (تفاصيل السلعة)');
      return;
    }
    if (!totalInvoiceAmount || Number(totalInvoiceAmount) <= 0) {
      alert('يرجى إدخال إجمالي مبلغ السلعة / الفاتورة');
      return;
    }

    const totalVal = Number(totalInvoiceAmount);
    const paidVal = supplierPaidAmount === '' ? 0 : Number(supplierPaidAmount);
    const creditVal = Math.max(0, totalVal - paidVal);

    // Save new supplier if not already in list
    if (onAddSupplier && finalSupplierName && !suppliers.some(s => s.name.toLowerCase() === finalSupplierName.toLowerCase())) {
      onAddSupplier({
        id: 'sup_' + Date.now(),
        name: finalSupplierName,
        phone: supplierPhone.trim() || undefined,
        category: goodsDescription.substring(0, 30)
      });
    }

    onAddExpense({
      category: 'خلاص وشراء سلعة من المورد',
      desc: `شراء من المورد (${finalSupplierName}): ${goodsDescription.trim()}`,
      amount: paidVal, // Actual cash spent now
      date: new Date(supplierDate).toISOString(),
      isSupplierPurchase: true,
      supplierName: finalSupplierName,
      supplierPhone: supplierPhone.trim(),
      goodsDescription: goodsDescription.trim(),
      totalInvoiceAmount: totalVal,
      paidAmount: paidVal,
      creditAmount: creditVal,
      invoiceNumber: invoiceNumber.trim() || undefined,
      notes: supplierNotes.trim() || undefined
    });

    // Reset Form
    setSelectedSupplierName('');
    setCustomSupplierName('');
    setSupplierPhone('');
    setGoodsDescription('');
    setTotalInvoiceAmount('');
    setSupplierPaidAmount('');
    setInvoiceNumber('');
    setSupplierNotes('');
  };

  // Settle Debt for a supplier purchase
  const handleOpenSettle = (exp: Expense) => {
    setSettleModalExpense(exp);
    setSettleAmount(exp.creditAmount || 0);
  };

  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleModalExpense || !settleAmount || Number(settleAmount) <= 0) return;
    
    if (onSettleSupplierCredit) {
      onSettleSupplierCredit(settleModalExpense.id, Number(settleAmount));
    }
    setSettleModalExpense(null);
    setSettleAmount('');
  };

  // Calculations for stats
  const supplierExpenses = expenses.filter(e => e.isSupplierPurchase);
  const generalExpensesList = expenses.filter(e => !e.isSupplierPurchase);

  const totalPaidSupplier = supplierExpenses.reduce((s, e) => s + (e.paidAmount !== undefined ? e.paidAmount : e.amount), 0);
  const totalPaidGeneral = generalExpensesList.reduce((s, e) => s + Number(e.amount), 0);
  const totalCashOut = totalPaidSupplier + totalPaidGeneral;
  
  // Total outstanding supplier debt from expenses
  const totalSupplierDebts = supplierExpenses.reduce((s, e) => s + (e.creditAmount || 0), 0);

  // Filtered List
  const filteredExpenses = expenses.filter(exp => {
    if (filterTab === 'suppliers' && !exp.isSupplierPurchase) return false;
    if (filterTab === 'general' && exp.isSupplierPurchase) return false;
    if (filterTab === 'has_credit' && (!exp.isSupplierPurchase || (exp.creditAmount || 0) <= 0)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchDesc = exp.desc?.toLowerCase().includes(q);
      const matchCat = exp.category?.toLowerCase().includes(q);
      const matchSup = exp.supplierName?.toLowerCase().includes(q);
      const matchGoods = exp.goodsDescription?.toLowerCase().includes(q);
      const matchInvoice = exp.invoiceNumber?.toLowerCase().includes(q);
      return matchDesc || matchCat || matchSup || matchGoods || matchInvoice;
    }
    return true;
  });

  return (
    <div className="space-y-6 p-3 sm:p-6" dir="rtl">
      {/* Top Banner & Financial Metrics */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>مصاريف البوتيك وخلاص الموردين</span>
              <span className="text-xs bg-rose-100 text-rose-800 px-3 py-1 rounded-xl font-black">
                {expenses.length} عملية
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              إدارة فواتير السلعة، خلاص الموردين كاش أو كريدي، مصاريف التنظيف، الكراء والتغليف.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFormTab('supplier')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeFormTab === 'supplier'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>🏢</span>
              <span>خلاص وشراء من مورد</span>
            </button>
            <button
              onClick={() => setActiveFormTab('general')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeFormTab === 'general'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-100'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>🧾</span>
              <span>مصاريف المحل العامة</span>
            </button>
          </div>
        </div>

        {/* 4 Financial Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="bg-indigo-50/80 border border-indigo-100 p-3.5 rounded-2xl">
            <span className="text-[11px] text-indigo-700 font-bold block mb-0.5">مشتريات الموردين (المسدد كاش):</span>
            <span className="text-base sm:text-lg font-black text-indigo-950 font-mono">
              {totalPaidSupplier.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-indigo-500 block mt-0.5">({supplierExpenses.length} فاتورة شراء)</span>
          </div>

          <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-2xl">
            <span className="text-[11px] text-amber-800 font-bold block mb-0.5">كريدي وديون الموردين المتبقية:</span>
            <span className="text-base sm:text-lg font-black text-amber-900 font-mono">
              {totalSupplierDebts.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-amber-600 block mt-0.5">
              ({supplierExpenses.filter(e => (e.creditAmount || 0) > 0).length} موردين بانتظار الخلاص)
            </span>
          </div>

          <div className="bg-rose-50/80 border border-rose-100 p-3.5 rounded-2xl">
            <span className="text-[11px] text-rose-700 font-bold block mb-0.5">مصاريف المحل والتشغيل:</span>
            <span className="text-base sm:text-lg font-black text-rose-950 font-mono">
              {totalPaidGeneral.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-rose-500 block mt-0.5">({generalExpensesList.length} بنود مصاريف)</span>
          </div>

          <div className="bg-slate-900 text-white p-3.5 rounded-2xl">
            <span className="text-[11px] text-slate-300 font-bold block mb-0.5">المجموع الكلي المدفوع كاش:</span>
            <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
              {totalCashOut.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">إجمالي السيولة الخارجة من الصندوق</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Add Form */}
      {activeFormTab === 'supplier' ? (
        /* Form 1: Supplier Purchase & Payout (خلاص وشراء السلعة من المورد) */
        <form onSubmit={handleSupplierSubmit} className="bg-white p-5 rounded-3xl border-2 border-indigo-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                🏢
              </span>
              <div>
                <h3 className="font-black text-slate-900 text-sm">تسجيل خلاص وشراء سلعة من مورد</h3>
                <p className="text-[11px] text-slate-500">سجل ماذا شريت على المورد، المبلغ المدفوع، والمتبقي كريدي.</p>
              </div>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-xl font-bold">
              سلعة وفواتير موردين
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Supplier Selection */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                اسم المورد *
              </label>
              <div className="space-y-1.5">
                <select
                  value={selectedSupplierName}
                  onChange={(e) => handleSupplierSelect(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- اختر من قائمة الموردين أو اكتب جديد --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name} {s.phone ? `(${s.phone})` : ''} {s.addressOrCity ? `[${s.addressOrCity}]` : ''}
                    </option>
                  ))}
                  <option value="__new__">+ كتابة اسم مورد جديد يدويًا</option>
                </select>

                {(selectedSupplierName === '__new__' || selectedSupplierName === '' || !suppliers.some(s => s.name === selectedSupplierName)) && (
                  <input
                    type="text"
                    required
                    value={customSupplierName}
                    onChange={(e) => setCustomSupplierName(e.target.value)}
                    placeholder="اكتب اسم المورد أو الشركة..."
                    className="w-full border border-indigo-200 bg-indigo-50/30 rounded-xl px-3 py-2 text-xs font-black text-indigo-900 focus:outline-none focus:border-indigo-500"
                  />
                )}
              </div>
            </div>

            {/* Supplier Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                هاتف المورد (اختياري)
              </label>
              <input
                type="tel"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                placeholder="05 / 06 / 07..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Date & Invoice Number */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ المعاملة</label>
                <input
                  type="date"
                  value={supplierDate}
                  onChange={(e) => setSupplierDate(e.target.value)}
                  className="w-[145px] sm:w-[155px] border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الفاتورة/الوصل</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="مثال: #INV-402"
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Goods Description (ماذا شريت عليه) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-black text-slate-800">
                ماذا شريت عليه (تفاصيل السلعة المشتراة) *
              </label>
              <span className="text-[10px] text-slate-400 font-bold">يمكنك النقر على الاقتراحات السريعة أدناه</span>
            </div>
            <textarea
              required
              rows={2}
              value={goodsDescription}
              onChange={(e) => setGoodsDescription(e.target.value)}
              placeholder="مثال: 5 فساتين سهرة تركية موديل 2026 + 3 قفاطين ملكية مطرزة باليد + 10 حقائب سهرة..."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
            />
            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {quickGoodsSuggestions.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleQuickGoodsAdd(item)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all"
                >
                  + {item}
                </button>
              ))}
            </div>
          </div>

          {/* Financial Calculation Box: Total vs Paid vs Credit */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-slate-50 to-amber-50/90 p-4 rounded-2xl border border-indigo-100 space-y-3">
            <div className="text-xs font-black text-slate-800 flex items-center justify-between">
              <span>الحساب المالي للسلعة (الخلاص والكريدي):</span>
              <span className="text-[11px] text-indigo-700 font-bold">
                {calculatedCredit > 0 ? `⚠️ متبقي كريدي: ${calculatedCredit.toLocaleString()} دج` : '✓ خالص بالكامل كاش'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Total Invoice */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  1. إجمالي مبلغ السلعة / الفاتورة (دج) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={totalInvoiceAmount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setTotalInvoiceAmount(val);
                    // Default paid to full amount if not set
                    if (supplierPaidAmount === '' && typeof val === 'number') {
                      setSupplierPaidAmount(val);
                    }
                  }}
                  placeholder="0"
                  className="w-full bg-white border-2 border-indigo-200 rounded-xl px-3 py-2 text-xs font-black text-indigo-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Amount Paid Now (شحال خلصته) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-black text-slate-700">
                    2. شحال خلصته كاش (المدفوع) (دج) *
                  </label>
                  {typeof totalInvoiceAmount === 'number' && (
                    <button
                      type="button"
                      onClick={() => setSupplierPaidAmount(totalInvoiceAmount)}
                      className="text-[10px] text-emerald-700 font-bold underline"
                    >
                      خلاص كامل
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  max={safeTotal || undefined}
                  value={supplierPaidAmount}
                  onChange={(e) => setSupplierPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white border-2 border-emerald-300 rounded-xl px-3 py-2 text-xs font-black text-emerald-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Remaining Credit (شحال كريدي) */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  3. شحال كريدي (دين متبقي للمورد)
                </label>
                <div className={`w-full rounded-xl px-3 py-2 text-xs font-black border-2 flex items-center justify-between ${
                  calculatedCredit > 0 
                    ? 'bg-amber-100/60 border-amber-300 text-amber-900' 
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  <span>{calculatedCredit.toLocaleString()} دج</span>
                  <span className="text-[10px] font-bold">
                    {calculatedCredit > 0 ? 'دين للمورد ⏳' : 'صافي 0 دج ✓'}
                  </span>
                </div>
              </div>
            </div>

            {calculatedCredit > 0 && (
              <div className="bg-amber-500/10 border border-amber-300 p-2.5 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <span className="text-base shrink-0">💡</span>
                <span>
                  <strong>تنبيه الديون:</strong> سيتم تسجيل مبلغ <strong>{calculatedCredit.toLocaleString()} دج</strong> تلقائياً في <u>سجل الديون (كريدي الموردين)</u> حتى تتمكن من متابعته وتسديده لاحقاً بدقة.
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظات إضافية (اختياري)</label>
            <input
              type="text"
              value={supplierNotes}
              onChange={(e) => setSupplierNotes(e.target.value)}
              placeholder="مثال: دفعة أولى كاش والباقي عند وصول شحنة الأسبوع القادم..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-black transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-center">حفظ عملية شراء السلعة وتسجيل خلاص المورد</span>
          </button>
        </form>
      ) : (
        /* Form 2: General Boutique Expenses (مصاريف عامة وتشغيلية) */
        <form onSubmit={handleGeneralSubmit} className="bg-white p-5 rounded-3xl border-2 border-rose-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-rose-100">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-sm">
                🧾
              </span>
              <div>
                <h3 className="font-black text-slate-900 text-sm">تسجيل مصروف عام للمحل</h3>
                <p className="text-[11px] text-slate-500">مصاريف التنظيف الجاف (Pressing)، الكراء، الفواتير، التغليف، والصيانة.</p>
              </div>
            </div>
            <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-xl font-bold">
              مصاريف عامة
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">بيان المصروف *</label>
              <input
                type="text"
                required
                value={generalDesc}
                onChange={(e) => setGeneralDesc(e.target.value)}
                placeholder="مثال: تنظيف جاف لـ 4 فساتين سهرة بعد الكراء..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">المبلغ (دج) *</label>
              <input
                type="number"
                required
                min="1"
                value={generalAmount}
                onChange={(e) => setGeneralAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-rose-700 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">التصنيف</label>
              <select
                value={generalCategory}
                onChange={(e) => setGeneralCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-rose-500"
              >
                {generalCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-rose-100 active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <span>+</span>
            <span>إضافة المصروف العام للمحل</span>
          </button>
        </form>
      )}

      {/* Expenses History & Supplier Log */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-black text-slate-900 text-base">سجل المصاريف ومشتريات الموردين</h3>
            <p className="text-xs text-slate-400">تتبع كافة المدفوعات، تفاصيل السلع المشتراة، والكريدي المتبقي.</p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterTab === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({expenses.length})
            </button>
            <button
              onClick={() => setFilterTab('suppliers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                filterTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <span>🏢 مشتريات الموردين</span>
              <span className="bg-white/20 px-1 rounded-full text-[10px]">{supplierExpenses.length}</span>
            </button>
            <button
              onClick={() => setFilterTab('has_credit')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                filterTab === 'has_credit' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <span>⚠️ متبقي كريدي للمورد</span>
              <span className="bg-white/20 px-1 rounded-full text-[10px]">
                {supplierExpenses.filter(e => (e.creditAmount || 0) > 0).length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('general')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterTab === 'general' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              🧾 مصاريف عامة ({generalExpensesList.length})
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المورد، السلعة المشتراة، رقم الفاتورة، أو بيان المصروف..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
          />
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <div className="text-3xl mb-2">🧾</div>
            <p className="text-xs font-bold">لا توجد أي مصاريف أو فواتير مطابقة للبحث.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map(exp => {
              const isSupplier = exp.isSupplierPurchase;
              const hasCredit = isSupplier && (exp.creditAmount || 0) > 0;
              const paidVal = exp.paidAmount !== undefined ? exp.paidAmount : exp.amount;

              return (
                <div
                  key={exp.id}
                  className={`p-4 rounded-2xl border transition-all hover:shadow-sm ${
                    isSupplier 
                      ? hasCredit 
                        ? 'bg-amber-50/20 border-amber-200 ring-1 ring-amber-100' 
                        : 'bg-indigo-50/20 border-indigo-100'
                      : 'bg-white border-slate-100'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    {/* Main Details */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isSupplier ? (
                          <span className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                            <span>🏢 مورد:</span>
                            <span>{exp.supplierName || 'مورد'}</span>
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                            🧾 {exp.category}
                          </span>
                        )}

                        {exp.supplierPhone && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                            📞 {exp.supplierPhone}
                          </span>
                        )}

                        {exp.invoiceNumber && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-mono font-bold">
                            وصل #{exp.invoiceNumber}
                          </span>
                        )}

                        <span className="text-[10px] text-slate-400 font-bold">
                          📅 {new Date(exp.date).toLocaleDateString('ar-DZ')}
                        </span>
                      </div>

                      {/* Description / Goods */}
                      {isSupplier ? (
                        <div>
                          <div className="text-xs font-black text-slate-900 mt-1">
                            <span className="text-slate-500 font-normal">السلعة المشتراة: </span>
                            {exp.goodsDescription || exp.desc}
                          </div>
                          {exp.notes && (
                            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                              💬 ملاحظة: {exp.notes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs font-black text-slate-800 mt-1">
                          {exp.desc}
                        </div>
                      )}
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      {isSupplier ? (
                        <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-slate-200">
                          {exp.totalInvoiceAmount && (
                            <div className="text-center">
                              <span className="text-[9px] text-slate-400 font-bold block">إجمالي السلعة</span>
                              <span className="text-xs font-black text-slate-800 font-mono">
                                {exp.totalInvoiceAmount.toLocaleString()} دج
                              </span>
                            </div>
                          )}

                          <div className="text-center border-r border-slate-100 pr-3">
                            <span className="text-[9px] text-emerald-600 font-bold block">المسدد كاش</span>
                            <span className="text-xs font-black text-emerald-800 font-mono">
                              {paidVal.toLocaleString()} دج
                            </span>
                          </div>

                          <div className="text-center border-r border-slate-100 pr-3">
                            <span className="text-[9px] text-amber-700 font-bold block">الكريدي المتبقي</span>
                            <span className={`text-xs font-black font-mono ${
                              (exp.creditAmount || 0) > 0 ? 'text-amber-700 font-black' : 'text-slate-400'
                            }`}>
                              {(exp.creditAmount || 0).toLocaleString()} دج
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-left">
                          <span className="text-sm font-black text-rose-700 font-mono">
                            {exp.amount.toLocaleString()} دج
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {isSupplier && hasCredit && (
                          <button
                            onClick={() => handleOpenSettle(exp)}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black px-2.5 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1 active:scale-95"
                            title="تسديد الكريدي المتبقي للمورد"
                          >
                            <span>💰</span>
                            <span>تسديد كريدي</span>
                          </button>
                        )}

                        {isSupplier && (
                          <button
                            onClick={() => setVoucherExpense(exp)}
                            className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                            title="عرض وطباعة وصل الشراء"
                          >
                            📄
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteExpense(exp.id)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="حذف السجل"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settle Supplier Debt Modal */}
      {settleModalExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>💰 تسديد كريدي المورد</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تسجيل دفعة نقدية جديدة للمورد لتخفيض أو تصفية الدين المتبقي.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">المورد:</span>
                <span className="font-black text-slate-900">{settleModalExpense.supplierName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">السلعة المشتراة:</span>
                <span className="font-bold text-slate-800 line-clamp-1">{settleModalExpense.goodsDescription || settleModalExpense.desc}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">إجمالي الفاتورة:</span>
                <span className="font-bold text-slate-900 font-mono">{settleModalExpense.totalInvoiceAmount?.toLocaleString()} دج</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">المدفوع سابقاً:</span>
                <span className="font-black text-emerald-700 font-mono">{(settleModalExpense.paidAmount || settleModalExpense.amount).toLocaleString()} دج</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-indigo-200/60">
                <span className="text-amber-800 font-bold">الكريدي المتبقي حالياً:</span>
                <span className="font-black text-amber-900 font-mono text-sm">{(settleModalExpense.creditAmount || 0).toLocaleString()} دج</span>
              </div>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    المبلغ المسدد الآن (دج) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setSettleAmount(settleModalExpense.creditAmount || 0)}
                    className="text-[10px] text-indigo-600 font-bold underline"
                  >
                    تسديد كامل الكريدي
                  </button>
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max={settleModalExpense.creditAmount || undefined}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-emerald-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <span>✓</span>
                  <span>تأكيد خلاص المبلغ للمورد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettleModalExpense(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Purchase Voucher Print Modal */}
      {voucherExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">📄 وصل شراء وخلاص من المورد</h3>
                <p className="text-[11px] text-slate-400">وثيقة إثبات استلام السلعة والمدفوعات</p>
              </div>
              <button
                onClick={() => setVoucherExpense(null)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-3 text-xs border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">اسم المورد:</span>
                <span className="font-black text-indigo-900">{voucherExpense.supplierName}</span>
              </div>
              {voucherExpense.supplierPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">هاتف المورد:</span>
                  <span className="font-bold text-slate-700">{voucherExpense.supplierPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">تاريخ الشراء:</span>
                <span className="font-mono font-bold text-slate-700">{new Date(voucherExpense.date).toLocaleDateString('ar-DZ')}</span>
              </div>
              <div className="border-t pt-2">
                <span className="text-slate-500 font-bold block mb-1">السلعة المشتراة:</span>
                <p className="bg-white p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800">
                  {voucherExpense.goodsDescription || voucherExpense.desc}
                </p>
              </div>

              <div className="border-t pt-2 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">إجمالي قيمة السلعة:</span>
                  <span className="font-black font-mono">{voucherExpense.totalInvoiceAmount?.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span className="font-bold">المبلغ المسدد كاش:</span>
                  <span className="font-black font-mono">{(voucherExpense.paidAmount || voucherExpense.amount).toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span className="font-bold">المتبقي كريدي للمورد:</span>
                  <span className="font-black font-mono">{(voucherExpense.creditAmount || 0).toLocaleString()} دج</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-black transition-all flex items-center justify-center gap-1"
              >
                <span>🖨️</span>
                <span>طباعة الوصل</span>
              </button>
              <button
                onClick={() => setVoucherExpense(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
