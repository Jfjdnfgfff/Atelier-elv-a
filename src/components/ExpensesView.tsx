import React, { useState, useMemo, useEffect } from 'react';
import { Expense, Supplier, Credit } from '../types';
import { LettersInput, NumbersInput } from './Shared';
import { sanitizeName, sanitizePhone, sanitizeText } from '../utils/security';
import {
  Building2,
  Receipt,
  Clock,
  Printer,
  FileText,
  DollarSign,
  Phone,
  Calendar,
  MessageSquare,
  AlertCircle,
  Plus,
  Check,
  Trash2,
  Search,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface ExpensesViewProps {
  expenses: Expense[];
  suppliers?: Supplier[];
  credits?: Credit[];
  onAddExpense: (exp: any) => void;
  onDeleteExpense: (id: string) => void;
  onSettleSupplierCredit?: (expenseId: string, paidNow: number) => void;
  onAddSupplier?: (sup: Supplier) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = React.memo(({
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
    'كراء المحل (إيجار)',
    'فاتورة الكهرباء',
    'فاتورة الماء',
    'فاتورة الغاز',
    'الإنترنت والهاتف',
    'غسيل وتنظيف جاف (Pressing)',
    'تغليف وأكياس فساتين ومستلزمات',
    'خياطة وتعديل مقاسات خارجية',
    'صيانة وتجهيزات وديكور المحل',
    'تسويق وإعلانات',
    'مصاريف نقل وتوصيل السلعة',
    'ضرائب ورسوم وتأمين',
    'أكل وشرب ومصاريف يومية',
    'مصاريف تشغيلية أخرى'
  ];
  const [customCategory, setCustomCategory] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

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
      category: generalCategory === '__custom__' ? (customCategory.trim() || 'مصاريف أخرى') : generalCategory,
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
    if (categoryFilter !== 'all' && (exp.isSupplierPurchase || exp.category !== categoryFilter)) return false;

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

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, search]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredExpenses.slice(start, start + PAGE_SIZE);
  }, [filteredExpenses, currentPage]);

  return (
    <div className="space-y-6 p-3 sm:p-6" dir="rtl">
      {/* Top Banner & Financial Metrics */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-blue-600 flex items-center gap-2">
              <span>مصاريف البوتيك وخلاص الموردين</span>
              <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-xl font-bold">
                {expenses.length} عملية
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              إدارة فواتير السلعة، خلاص الموردين كاش أو كريدي، مصاريف التنظيف، الكراء والتغليف.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFormTab('supplier')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeFormTab === 'supplier'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>خلاص وشراء من مورد</span>
            </button>
            <button
              onClick={() => setActiveFormTab('general')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeFormTab === 'general'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>مصاريف المحل العامة</span>
            </button>
          </div>
        </div>

        {/* 4 Financial Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
            <span className="text-[11px] text-slate-500 font-normal block mb-0.5">مشتريات الموردين (كاش):</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {totalPaidSupplier.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">({supplierExpenses.length} فاتورة شراء)</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
            <span className="text-[11px] text-slate-500 font-normal block mb-0.5">ديون الموردين المتبقية:</span>
            <span className="text-base sm:text-lg font-bold text-rose-600 font-mono">
              {totalSupplierDebts.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              ({supplierExpenses.filter(e => (e.creditAmount || 0) > 0).length} موردين بانتظار الخلاص)
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
            <span className="text-[11px] text-slate-500 font-normal block mb-0.5">مصاريف المحل والتشغيل:</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {totalPaidGeneral.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">({generalExpensesList.length} بنود مصاريف)</span>
          </div>

          <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xs">
            <span className="text-[11px] text-slate-300 font-normal block mb-0.5">المجموع الكلي المدفوع:</span>
            <span className="text-base sm:text-lg font-bold text-white font-mono">
              {totalCashOut.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">إجمالي السيولة الخارجة من الصندوق</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Add Form */}
      {activeFormTab === 'supplier' ? (
        /* Form 1: Supplier Purchase & Payout (خلاص وشراء السلعة من المورد) */
        <form onSubmit={handleSupplierSubmit} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                <Building2 className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">تسجيل خلاص وشراء سلعة من مورد</h3>
                <p className="text-[11px] text-slate-500">سجل ماذا شريت على المورد، المبلغ المدفوع، والمتبقي كريدي.</p>
              </div>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg font-medium">
              سلعة وفواتير موردين
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Supplier Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                اسم المورد *
              </label>
              <div className="space-y-1.5">
                <select
                  value={selectedSupplierName}
                  onChange={(e) => handleSupplierSelect(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-slate-400"
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
                  <LettersInput
                    required
                    value={customSupplierName}
                    onChange={setCustomSupplierName}
                    placeholder="اكتب اسم المورد (أحرف فقط)..."
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white"
                  />
                )}
              </div>
            </div>

            {/* Supplier Phone */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                هاتف المورد (أرقام فقط)
              </label>
              <NumbersInput
                allowPlus
                value={supplierPhone}
                onChange={setSupplierPhone}
                placeholder="05 / 06 / 07..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-slate-400"
              />
            </div>

            {/* Date & Invoice Number */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">تاريخ المعاملة</label>
                <input
                  type="date"
                  value={supplierDate}
                  onChange={(e) => setSupplierDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">رقم الفاتورة/الوصل</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="مثال: #INV-402"
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Goods Description (ماذا شريت عليه) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-slate-800">
                ماذا شريت عليه (تفاصيل السلعة المشتراة) *
              </label>
              <span className="text-[10px] text-slate-400 font-normal">يمكنك النقر على الاقتراحات السريعة أدناه</span>
            </div>
            <textarea
              required
              rows={2}
              value={goodsDescription}
              onChange={(e) => setGoodsDescription(e.target.value)}
              placeholder="مثال: 5 فساتين سهرة تركية موديل 2026 + 3 قفاطين ملكية مطرزة باليد + 10 حقائب سهرة..."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-normal focus:outline-none focus:border-slate-400"
            />
            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {quickGoodsSuggestions.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleQuickGoodsAdd(item)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all"
                >
                  + {item}
                </button>
              ))}
            </div>
          </div>

          {/* Financial Calculation Box: Total vs Paid vs Credit */}
          <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="text-xs font-medium text-slate-800 flex items-center justify-between">
              <span>الحساب المالي للسلعة (الخلاص والكريدي):</span>
              <span className="text-[11px] text-slate-600 font-medium">
                {calculatedCredit > 0 ? `متبقي كريدي: ${calculatedCredit.toLocaleString()} دج` : 'خالص بالكامل كاش'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Total Invoice */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
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
                    if (supplierPaidAmount === '' && typeof val === 'number') {
                      setSupplierPaidAmount(val);
                    }
                  }}
                  placeholder="0"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              {/* Amount Paid Now (شحال خلصته) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    2. شحال خلصته كاش (المدفوع) (دج) *
                  </label>
                  {typeof totalInvoiceAmount === 'number' && (
                    <button
                      type="button"
                      onClick={() => setSupplierPaidAmount(totalInvoiceAmount)}
                      className="text-[10px] text-slate-600 hover:text-slate-900 font-bold underline"
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              {/* Remaining Credit (شحال كريدي) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  3. شحال كريدي (دين متبقي للمورد)
                </label>
                <div className="w-full rounded-xl px-3 py-2 text-xs font-bold border border-slate-200 bg-white flex items-center justify-between text-slate-900">
                  <span>{calculatedCredit.toLocaleString()} دج</span>
                  <span className={`text-[10px] font-bold ${calculatedCredit > 0 ? 'text-black' : 'text-slate-400'}`}>
                    {calculatedCredit > 0 ? 'دين للمورد' : 'صافي 0 دج'}
                  </span>
                </div>
              </div>
            </div>

            {calculatedCredit > 0 && (
              <div className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
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
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span className="text-center">حفظ عملية شراء السلعة وتسجيل خلاص المورد</span>
          </button>
        </form>
      ) : (
        /* Form 2: General Boutique Expenses (مصاريف عامة وتشغيلية) */
        <form onSubmit={handleGeneralSubmit} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                <Receipt className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">تسجيل مصروف عام للمحل</h3>
                <p className="text-[11px] text-slate-500 font-normal">مصاريف التنظيف الجاف (Pressing)، الكراء، الفواتير، التغليف، والصيانة.</p>
              </div>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg font-medium">
              مصاريف عامة
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">بيان المصروف * (حروف فقط)</label>
              <LettersInput
                required
                value={generalDesc}
                onChange={setGeneralDesc}
                placeholder="مثال: تنظيف جاف لفساتين سهرة بعد الكراء..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal focus:outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">المبلغ (دج) *</label>
              <input
                type="number"
                required
                min="1"
                value={generalAmount}
                onChange={(e) => setGeneralAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">التصنيف</label>
              <select
                value={generalCategory}
                onChange={(e) => setGeneralCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-slate-400"
              >
                {generalCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom__">+ تصنيف آخر (اكتبه يدوياً)</option>
              </select>
              {generalCategory === '__custom__' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="اسم التصنيف..."
                  className="mt-1.5 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-slate-400"
                />
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 sm:py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة المصروف العام للمحل</span>
          </button>
        </form>
      )}

      {/* Expenses breakdown by category */}
      {(() => {
        const totals: Record<string, number> = {};
        expenses.forEach(exp => {
          const key = exp.isSupplierPurchase ? 'خلاص وشراء سلعة من المورد' : (exp.category || 'غير مصنف');
          const val = exp.isSupplierPurchase ? (exp.paidAmount ?? exp.amount ?? 0) : (exp.amount || 0);
          totals[key] = (totals[key] || 0) + Number(val || 0);
        });
        const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const grand = entries.reduce((a, [, v]) => a + v, 0);
        if (entries.length === 0) return null;
        return (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">تفصيل المصاريف حسب النوع</h3>
              <span className="text-xs font-bold text-rose-700">المجموع: {grand.toLocaleString()} دج</span>
            </div>
            <div className="space-y-1.5">
              {entries.map(([cat, val]) => {
                const pct = grand > 0 ? Math.round((val / grand) * 100) : 0;
                const clickable = cat !== 'خلاص وشراء سلعة من المورد';
                const active = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => clickable ? setCategoryFilter(active ? 'all' : cat) : setFilterTab('suppliers')}
                    className={`w-full text-right rounded-xl px-3 py-2 border transition-colors ${active ? 'border-slate-900 bg-slate-50' : 'border-slate-100 hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800">{cat}</span>
                      <span className="font-bold text-slate-900">{val.toLocaleString()} دج <span className="text-slate-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
            {categoryFilter !== 'all' && (
              <button type="button" onClick={() => setCategoryFilter('all')} className="text-xs text-slate-600 underline">
                إلغاء التصفية ({categoryFilter})
              </button>
            )}
          </div>
        );
      })()}

      {/* Expenses History & Supplier Log */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">سجل المصاريف ومشتريات الموردين</h3>
            <p className="text-xs text-slate-500 font-normal">تتبع كافة المدفوعات، تفاصيل السلع المشتراة، والكريدي المتبقي.</p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterTab === 'all' ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({expenses.length})
            </button>
            <button
              onClick={() => setFilterTab('suppliers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                filterTab === 'suppliers' ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>مشتريات الموردين ({supplierExpenses.length})</span>
            </button>
            <button
              onClick={() => setFilterTab('has_credit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                filterTab === 'has_credit' ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>متبقي كريدي للمورد ({supplierExpenses.filter(e => (e.creditAmount || 0) > 0).length})</span>
            </button>
            <button
              onClick={() => setFilterTab('general')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                filterTab === 'general' ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>مصاريف عامة ({generalExpensesList.length})</span>
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
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-400"
          />
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-medium">لا توجد أي مصاريف أو فواتير مطابقة للبحث.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedExpenses.map(exp => {
              const isSupplier = exp.isSupplierPurchase;
              const hasCredit = isSupplier && (exp.creditAmount || 0) > 0;
              const paidVal = exp.paidAmount !== undefined ? exp.paidAmount : exp.amount;

              return (
                <div
                  key={exp.id}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-white transition-all hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    {/* Main Details */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isSupplier ? (
                          <span className="bg-slate-100 text-slate-800 border border-slate-200/70 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            <span>مورد:</span>
                            <span className="font-bold">{exp.supplierName || 'مورد'}</span>
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-800 border border-slate-200/70 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Receipt className="w-3 h-3 text-slate-500" />
                            <span className="font-bold">{exp.category}</span>
                          </span>
                        )}

                        {exp.supplierPhone && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{exp.supplierPhone}</span>
                          </span>
                        )}

                        {exp.invoiceNumber && (
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono font-medium">
                            وصل #{exp.invoiceNumber}
                          </span>
                        )}

                        <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(exp.date).toLocaleDateString('ar-DZ')}</span>
                        </span>
                      </div>

                      {/* Description / Goods */}
                      {isSupplier ? (
                        <div>
                          <div className="text-xs font-bold text-slate-900 mt-1">
                            <span className="text-slate-500 font-normal">السلعة المشتراة: </span>
                            {exp.goodsDescription || exp.desc}
                          </div>
                          {exp.notes && (
                            <div className="text-[11px] text-slate-500 font-normal mt-0.5 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-slate-400" />
                              <span>ملاحظة: {exp.notes}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-slate-800 mt-1">
                          {exp.desc}
                        </div>
                      )}
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      {isSupplier ? (
                        <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
                          {exp.totalInvoiceAmount && (
                            <div className="text-center">
                              <span className="text-[9px] text-slate-400 font-normal block">إجمالي السلعة</span>
                              <span className="text-xs font-bold text-slate-800 font-mono">
                                {exp.totalInvoiceAmount.toLocaleString()} دج
                              </span>
                            </div>
                          )}

                          <div className="text-center border-r border-slate-200 pr-3">
                            <span className="text-[9px] text-slate-500 font-normal block">المسدد كاش</span>
                            <span className="text-xs font-bold text-slate-900 font-mono">
                              {paidVal.toLocaleString()} دج
                            </span>
                          </div>

                          <div className="text-center border-r border-slate-200 pr-3">
                            <span className="text-[9px] text-slate-500 font-normal block">الكريدي المتبقي</span>
                            <span className={`text-xs font-bold font-mono ${
                              (exp.creditAmount || 0) > 0 ? 'text-rose-600' : 'text-slate-400'
                            }`}>
                              {(exp.creditAmount || 0).toLocaleString()} دج
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-left">
                          <span className="text-sm font-bold text-slate-900 font-mono">
                            {exp.amount.toLocaleString()} دج
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {isSupplier && hasCredit && (
                          <button
                            onClick={() => handleOpenSettle(exp)}
                            className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all shadow-xs flex items-center gap-1 active:scale-95"
                            title="تسديد الكريدي المتبقي للمورد"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>تسديد كريدي</span>
                          </button>
                        )}

                        {isSupplier && (
                          <button
                            onClick={() => setVoucherExpense(exp)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="عرض وطباعة وصل الشراء"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteExpense(exp.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="حذف السجل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mt-4">
            <div className="text-xs text-slate-500 font-medium">
              عرض {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, filteredExpenses.length)} من إجمالي {filteredExpenses.length} عملية
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>
              
              <div className="flex items-center gap-1 text-xs font-bold text-slate-800 px-2">
                <span>صفحة</span>
                <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-lg">{currentPage}</span>
                <span>من</span>
                <span className="font-mono">{totalPages}</span>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settle Supplier Debt Modal */}
      {settleModalExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" dir="rtl">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-xl border border-slate-200/80 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-700" />
                  <span>تسديد كريدي المورد</span>
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  تسجيل دفعة نقدية جديدة للمورد لتخفيض أو تصفية الدين المتبقي.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-normal">المورد:</span>
                <span className="font-bold text-slate-900">{settleModalExpense.supplierName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-normal">السلعة المشتراة:</span>
                <span className="font-medium text-slate-800 line-clamp-1">{settleModalExpense.goodsDescription || settleModalExpense.desc}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-normal">إجمالي الفاتورة:</span>
                <span className="font-bold text-slate-900 font-mono">{settleModalExpense.totalInvoiceAmount?.toLocaleString()} دج</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-normal">المدفوع سابقاً:</span>
                <span className="font-bold text-slate-900 font-mono">{(settleModalExpense.paidAmount || settleModalExpense.amount).toLocaleString()} دج</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-700 font-medium">الكريدي المتبقي حالياً:</span>
                <span className="font-bold text-rose-600 font-mono text-sm">{(settleModalExpense.creditAmount || 0).toLocaleString()} دج</span>
              </div>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    المبلغ المسدد الآن (دج) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setSettleAmount(settleModalExpense.creditAmount || 0)}
                    className="text-[10px] text-slate-600 hover:text-slate-900 font-medium underline"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>تأكيد خلاص المبلغ للمورد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettleModalExpense(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-all"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" dir="rtl">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl border border-slate-200/80 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-700" />
                  <span>وصل شراء وخلاص من المورد</span>
                </h3>
                <p className="text-[11px] text-slate-400">وثيقة إثبات استلام السلعة والمدفوعات</p>
              </div>
              <button
                onClick={() => setVoucherExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-3 text-xs border border-slate-200/80">
              <div className="flex justify-between">
                <span className="text-slate-500 font-normal">اسم المورد:</span>
                <span className="font-bold text-slate-900">{voucherExpense.supplierName}</span>
              </div>
              {voucherExpense.supplierPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-normal">هاتف المورد:</span>
                  <span className="font-mono text-slate-700">{voucherExpense.supplierPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-normal">تاريخ الشراء:</span>
                <span className="font-mono font-medium text-slate-700">{new Date(voucherExpense.date).toLocaleDateString('ar-DZ')}</span>
              </div>
              <div className="border-t border-slate-200/80 pt-2">
                <span className="text-slate-500 font-normal block mb-1">السلعة المشتراة:</span>
                <p className="bg-white p-2.5 rounded-lg border border-slate-200 font-medium text-slate-800">
                  {voucherExpense.goodsDescription || voucherExpense.desc}
                </p>
              </div>

              <div className="border-t border-slate-200/80 pt-2 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-normal">إجمالي قيمة السلعة:</span>
                  <span className="font-bold font-mono">{voucherExpense.totalInvoiceAmount?.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-slate-900">
                  <span className="font-normal">المبلغ المسدد كاش:</span>
                  <span className="font-bold font-mono">{(voucherExpense.paidAmount || voucherExpense.amount).toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-slate-900">
                  <span className="font-normal">المتبقي كريدي للمورد:</span>
                  <span className="font-bold text-rose-600 font-mono">{(voucherExpense.creditAmount || 0).toLocaleString()} دج</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الوصل</span>
              </button>
              <button
                onClick={() => setVoucherExpense(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
