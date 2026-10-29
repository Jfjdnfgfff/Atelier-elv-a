import React, { useState, useMemo, useEffect } from 'react';
import { Supplier, Seamstress, SeamstressPayment, Expense, MaintenanceOrder, Credit } from '../types';
import { LettersInput, NumbersInput } from './Shared';
import { buildSimplePrintHtml, openPrintInterface } from '../utils/printInterface';
import { 
  Building2, 
  Scissors, 
  Phone, 
  MapPin, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  MessageSquare, 
  CreditCard, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Wallet,
  Banknote,
  AlertCircle,
  Printer
} from 'lucide-react';

interface PartnersViewProps {
  suppliers: Supplier[];
  seamstresses: Seamstress[];
  seamstressPayments?: SeamstressPayment[];
  expenses: Expense[];
  maintenanceOrders: MaintenanceOrder[];
  credits?: Credit[];
  onAddSupplier: (sup: Supplier) => void;
  onUpdateSupplier: (id: string, sup: Partial<Supplier>) => void;
  onDeleteSupplier: (id: string) => void;
  onAddSeamstress: (seam: Seamstress) => void;
  onUpdateSeamstress: (id: string, seam: Partial<Seamstress>) => void;
  onDeleteSeamstress: (id: string) => void;
  onAddSeamstressPayment?: (payment: SeamstressPayment) => void;
  onDeleteSeamstressPayment?: (id: string) => void;
  onSettleSupplierCredit?: (expenseId: string, paidNow: number) => void;
  focusTab?: { tab: 'suppliers' | 'seamstresses'; requestId: number };
}

export const PartnersView: React.FC<PartnersViewProps> = React.memo(({
  suppliers,
  seamstresses,
  seamstressPayments = [],
  expenses,
  maintenanceOrders,
  credits = [],
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onAddSeamstress,
  onUpdateSeamstress,
  onDeleteSeamstress,
  onAddSeamstressPayment,
  onDeleteSeamstressPayment,
  onSettleSupplierCredit,
  focusTab
}) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'seamstresses'>('suppliers');
  const [search, setSearch] = useState('');
  const [onlyDueSeamstresses, setOnlyDueSeamstresses] = useState(false);

  // التنقل المباشر إلى تبويب الخياطات عند القدوم من قسم الخياطة
  useEffect(() => {
    if (focusTab && focusTab.requestId > 0) {
      setActiveTab(focusTab.tab);
      setSearch('');
    }
  }, [focusTab]);
  
  // Modals & Expansion State
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showAddSeamstressModal, setShowAddSeamstressModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingSeamstress, setEditingSeamstress] = useState<Seamstress | null>(null);
  const [selectedSupplierHistory, setSelectedSupplierHistory] = useState<Supplier | null>(null);
  const [selectedSeamstressHistory, setSelectedSeamstressHistory] = useState<Seamstress | null>(null);

  // Supplier Form State
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supCategory, setSupCategory] = useState('فساتين سهرة وأعراس جاهزة');
  const [supNotes, setSupNotes] = useState('');

  // Seamstress Form State
  const [seamName, setSeamName] = useState('');
  const [seamPhone, setSeamPhone] = useState('');
  const [seamSpecialty, setSeamSpecialty] = useState('تعديل مقاسات وفساتين سهرة');
  const [seamAddress, setSeamAddress] = useState('');
  const [seamRate, setSeamRate] = useState('بالقطعة (800 - 3000 دج)');
  const [seamNotes, setSeamNotes] = useState('');

  // Settle Debt Modal State
  const [settleExpense, setSettleExpense] = useState<Expense | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');

  // Seamstress Payment Modal State
  const [paySeamstress, setPaySeamstress] = useState<Seamstress | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payFundSource, setPayFundSource] = useState<'daily' | 'general'>('daily');
  const [payNote, setPayNote] = useState<string>('');
  const [payError, setPayError] = useState<string>('');

  // --- Calculations for Suppliers ---
  const supplierAnalytics = useMemo(() => {
    // Single-pass index mapping supplier key -> expenses list
    const expensesMap = new Map<string, Expense[]>();
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      if (!e.isSupplierPurchase) continue;
      const nameKey = e.supplierName ? e.supplierName.trim().toLowerCase() : '';
      const phoneKey = e.supplierPhone ? e.supplierPhone.trim() : '';

      if (nameKey) {
        let list = expensesMap.get(nameKey);
        if (!list) { list = []; expensesMap.set(nameKey, list); }
        list.push(e);
      }
      if (phoneKey && phoneKey !== nameKey) {
        let list = expensesMap.get(phoneKey);
        if (!list) { list = []; expensesMap.set(phoneKey, list); }
        list.push(e);
      }
    }

    return suppliers.map(sup => {
      const nameKey = sup.name ? sup.name.trim().toLowerCase() : '';
      const phoneKey = sup.phone ? sup.phone.trim() : '';

      const matchedSet = new Set<Expense>();
      if (nameKey && expensesMap.has(nameKey)) {
        expensesMap.get(nameKey)!.forEach(e => matchedSet.add(e));
      }
      if (phoneKey && expensesMap.has(phoneKey)) {
        expensesMap.get(phoneKey)!.forEach(e => matchedSet.add(e));
      }
      const supExpenses = Array.from(matchedSet);

      const totalInvoices = supExpenses.length;
      let totalBilled = 0;
      let totalPaid = 0;
      let remainingDebt = 0;

      for (let j = 0; j < supExpenses.length; j++) {
        const e = supExpenses[j];
        totalBilled += (e.totalInvoiceAmount || e.amount || 0);
        totalPaid += (e.paidAmount !== undefined ? e.paidAmount : e.amount || 0);
        remainingDebt += (e.creditAmount || 0);
      }

      return {
        ...sup,
        totalInvoices,
        totalBilled,
        totalPaid,
        remainingDebt,
        expenses: supExpenses
      };
    });
  }, [suppliers, expenses]);

  const totalSupplierDebtsAll = supplierAnalytics.reduce((s, sup) => s + sup.remainingDebt, 0);
  const totalSupplierPurchasesAll = supplierAnalytics.reduce((s, sup) => s + sup.totalBilled, 0);

  // --- Calculations for Seamstresses ---
  const seamstressAnalytics = useMemo(() => {
    // Single-pass index mapping tailorName -> maintenance orders list
    const ordersMap = new Map<string, MaintenanceOrder[]>();
    for (let i = 0; i < maintenanceOrders.length; i++) {
      const o = maintenanceOrders[i];
      const nameKey = o.tailorName ? o.tailorName.trim().toLowerCase() : '';
      if (nameKey) {
        let list = ordersMap.get(nameKey);
        if (!list) { list = []; ordersMap.set(nameKey, list); }
        list.push(o);
      }
    }

    // فهرسة الدفعات بالمعرف وبالاسم لضمان ربطها حتى مع السجلات القديمة
    const paymentsById = new Map<string, SeamstressPayment[]>();
    const paymentsByName = new Map<string, SeamstressPayment[]>();
    for (let i = 0; i < seamstressPayments.length; i++) {
      const p = seamstressPayments[i];
      if (!p) continue;
      if (p.seamstressId) {
        let list = paymentsById.get(p.seamstressId);
        if (!list) { list = []; paymentsById.set(p.seamstressId, list); }
        list.push(p);
      }
      const nameKey = p.seamstressName ? p.seamstressName.trim().toLowerCase() : '';
      if (nameKey) {
        let list = paymentsByName.get(nameKey);
        if (!list) { list = []; paymentsByName.set(nameKey, list); }
        list.push(p);
      }
    }

    return seamstresses.map(seam => {
      const nameKey = seam.name ? seam.name.trim().toLowerCase() : '';
      const orders = ordersMap.get(nameKey) || [];

      const paymentSet = new Set<SeamstressPayment>();
      (paymentsById.get(seam.id) || []).forEach(p => paymentSet.add(p));
      (paymentsByName.get(nameKey) || []).forEach(p => paymentSet.add(p));
      const payments = Array.from(paymentSet).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      const totalOrders = orders.length;
      let activeOrders = 0;
      let deliveredOrders = 0;
      let totalOrdersValue = 0;
      let earnedDues = 0; // أتعاب الطلبيات المسلّمة (أصبحت مستحقة للخياطة)
      let pendingDues = 0; // أتعاب طلبيات لازالت قيد الإنجاز
      let totalTailorCost = 0;

      for (let j = 0; j < orders.length; j++) {
        const o = orders[j];
        const orderCost = o.cost || 0;
        if (o.status === 'delivered') {
          deliveredOrders++;
          earnedDues += orderCost;
        } else {
          activeOrders++;
          pendingDues += orderCost;
        }
        totalOrdersValue += (o.price || 0);
        totalTailorCost += orderCost;
      }

      let totalPaid = 0;
      for (let j = 0; j < payments.length; j++) {
        totalPaid += Number(payments[j].amount) || 0;
      }

      const rawBalance = Math.round((earnedDues - totalPaid) * 100) / 100;
      const remainingDue = rawBalance > 0 ? rawBalance : 0; // متبقي عليها لنا
      const advancePaid = rawBalance < 0 ? Math.abs(rawBalance) : 0; // سلفة مدفوعة مسبقاً

      return {
        ...seam,
        totalOrders,
        activeOrders,
        deliveredOrders,
        totalOrdersValue,
        totalTailorCost,
        earnedDues,
        pendingDues,
        totalPaid,
        remainingDue,
        advancePaid,
        payments,
        orders
      };
    });
  }, [seamstresses, maintenanceOrders, seamstressPayments]);

  const totalTailoringOrdersCount = seamstressAnalytics.reduce((s, seam) => s + seam.totalOrders, 0);
  const totalActiveTailoringCount = seamstressAnalytics.reduce((s, seam) => s + seam.activeOrders, 0);
  const totalSeamstressDues = seamstressAnalytics.reduce((s, seam) => s + seam.earnedDues, 0);
  const totalSeamstressPaid = seamstressAnalytics.reduce((s, seam) => s + seam.totalPaid, 0);
  const totalSeamstressRemaining = seamstressAnalytics.reduce((s, seam) => s + seam.remainingDue, 0);
  const totalPendingSeamstressDues = seamstressAnalytics.reduce((s, seam) => s + seam.pendingDues, 0);

  // Filtered Suppliers
  const filteredSuppliers = supplierAnalytics.filter(sup => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return sup.name.toLowerCase().includes(q) ||
      (sup.phone && sup.phone.includes(q)) ||
      (sup.addressOrCity && sup.addressOrCity.toLowerCase().includes(q)) ||
      (sup.category && sup.category.toLowerCase().includes(q));
  });

  // Filtered Seamstresses
  const filteredSeamstresses = seamstressAnalytics.filter(seam => {
    if (onlyDueSeamstresses && seam.remainingDue <= 0) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return seam.name.toLowerCase().includes(q) ||
      (seam.phone && seam.phone.includes(q)) ||
      (seam.addressOrCity && seam.addressOrCity.toLowerCase().includes(q)) ||
      (seam.specialty && seam.specialty.toLowerCase().includes(q));
  });

  // Handlers for Supplier
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;

    if (editingSupplier) {
      onUpdateSupplier(editingSupplier.id, {
        name: supName.trim(),
        phone: supPhone.trim() || undefined,
        addressOrCity: supAddress.trim() || undefined,
        category: supCategory.trim() || undefined,
        notes: supNotes.trim() || undefined
      });
      setEditingSupplier(null);
    } else {
      onAddSupplier({
        id: 'sup_' + Date.now(),
        name: supName.trim(),
        phone: supPhone.trim() || undefined,
        addressOrCity: supAddress.trim() || undefined,
        category: supCategory.trim() || undefined,
        notes: supNotes.trim() || undefined
      });
    }

    // Reset Form
    setSupName('');
    setSupPhone('');
    setSupAddress('');
    setSupNotes('');
    setShowAddSupplierModal(false);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupPhone(sup.phone || '');
    setSupAddress(sup.addressOrCity || '');
    setSupCategory(sup.category || 'فساتين سهرة وأعراس جاهزة');
    setSupNotes(sup.notes || '');
    setShowAddSupplierModal(true);
  };

  // Handlers for Seamstress
  const handleSaveSeamstress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seamName.trim()) return;

    if (editingSeamstress) {
      onUpdateSeamstress(editingSeamstress.id, {
        name: seamName.trim(),
        phone: seamPhone.trim() || undefined,
        specialty: seamSpecialty.trim() || undefined,
        addressOrCity: seamAddress.trim() || undefined,
        ratePerPieceOrSalary: seamRate.trim() || undefined,
        notes: seamNotes.trim() || undefined
      });
      setEditingSeamstress(null);
    } else {
      onAddSeamstress({
        id: 'seam_' + Date.now(),
        name: seamName.trim(),
        phone: seamPhone.trim() || undefined,
        specialty: seamSpecialty.trim() || undefined,
        addressOrCity: seamAddress.trim() || undefined,
        ratePerPieceOrSalary: seamRate.trim() || undefined,
        notes: seamNotes.trim() || undefined,
        createdAt: new Date().toISOString()
      });
    }

    // Reset Form
    setSeamName('');
    setSeamPhone('');
    setSeamAddress('');
    setSeamRate('بالقطعة (800 - 3000 دج)');
    setSeamNotes('');
    setShowAddSeamstressModal(false);
  };

  const handleOpenEditSeamstress = (seam: Seamstress) => {
    setEditingSeamstress(seam);
    setSeamName(seam.name);
    setSeamPhone(seam.phone || '');
    setSeamSpecialty(seam.specialty || 'تعديل مقاسات وفساتين سهرة');
    setSeamAddress(seam.addressOrCity || '');
    setSeamRate(seam.ratePerPieceOrSalary || 'بالقطعة (800 - 3000 دج)');
    setSeamNotes(seam.notes || '');
    setShowAddSeamstressModal(true);
  };

  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleExpense || !settleAmount || Number(settleAmount) <= 0) return;
    if (onSettleSupplierCredit) {
      onSettleSupplierCredit(settleExpense.id, Number(settleAmount));
    }
    setSettleExpense(null);
    setSettleAmount('');
  };

  const handleOpenSeamstressPayment = (seam: Seamstress) => {
    const data = seamstressAnalytics.find(s => s.id === seam.id);
    setPaySeamstress(seam);
    setPayAmount(data && data.remainingDue > 0 ? String(Math.round(data.remainingDue)) : '');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayFundSource('daily');
    setPayNote('');
    setPayError('');
  };

  const handleConfirmSeamstressPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySeamstress) return;
    if (!onAddSeamstressPayment) {
      setPayError('تعذر الوصول إلى خدمة الحفظ. أعد تحميل الصفحة وحاول مرة أخرى.');
      return;
    }
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError('أدخل مبلغاً صحيحاً أكبر من صفر لتسجيل الدفعة.');
      return;
    }

    onAddSeamstressPayment({
      id: 'seampay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      seamstressId: paySeamstress.id,
      seamstressName: paySeamstress.name,
      amount,
      date: payDate || new Date().toISOString().split('T')[0],
      fundSource: payFundSource,
      note: payNote.trim() || undefined,
      createdAt: new Date().toISOString()
    });

    setPaySeamstress(null);
    setPayAmount('');
    setPayNote('');
    setPayError('');
  };

  // طباعة كشف حساب الخياطة (أتعاب + دفعات + المتبقي)
  const handlePrintSeamstressStatement = (seam: Seamstress) => {
    const data = seamstressAnalytics.find(s => s.id === seam.id);
    if (!data) return;

    const rows: Array<Array<string | number>> = [];

    for (const p of [...data.payments].sort((a, b) => (a.date || '').localeCompare(b.date || ''))) {
      rows.push([
        p.date || '-',
        'دفعة مسددة',
        `${Number(p.amount || 0).toLocaleString()} دج`,
        p.fundSource === 'general' ? 'الصندوق العام' : 'صندوق اليوم',
        p.note || '-'
      ]);
    }

    for (const o of [...data.orders].sort((a, b) => (a.receivedDate || '').localeCompare(b.receivedDate || ''))) {
      rows.push([
        o.receivedDate || '-',
        `طلبية ${o.orderNumber} — ${o.itemName}`,
        `${(o.cost || 0).toLocaleString()} دج`,
        o.status === 'delivered' ? 'مسلّمة (مستحقة)' : 'قيد الإنجاز (غير مستحقة)',
        o.description || '-'
      ]);
    }

    rows.push(['—', 'إجمالي الأتعاب المستحقة (المسلّمة)', `${data.earnedDues.toLocaleString()} دج`, '', '']);
    rows.push(['—', 'إجمالي المسدد', `${data.totalPaid.toLocaleString()} دج`, '', '']);
    rows.push([
      '—',
      'المتبقي بذمة المحل',
      `${data.remainingDue.toLocaleString()} دج`,
      data.advancePaid > 0 ? `سلفة ${data.advancePaid.toLocaleString()} دج` : '',
      ''
    ]);

    openPrintInterface({
      title: `كشف حساب الخياطة — ${seam.name}`,
      fileName: `كشف_حساب_الخياطة_${seam.name}_${new Date().toISOString().split('T')[0]}`,
      html: buildSimplePrintHtml({
        heading: `كشف حساب الخياطة: ${seam.name}`,
        subtitle: [
          seam.specialty ? `الاختصاص: ${seam.specialty}` : '',
          seam.phone ? `الهاتف: ${seam.phone}` : '',
          `المسدد: ${data.totalPaid.toLocaleString()} دج | المتبقي: ${data.remainingDue.toLocaleString()} دج`
        ].filter(Boolean).join(' • '),
        headers: ['التاريخ', 'البيان', 'المبلغ', 'الحالة / المصدر', 'ملاحظات'],
        rows
      })
    });
  };

  const handleWhatsApp = (phone?: string, name?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.startsWith('0') ? '213' + cleanPhone.substring(1) : cleanPhone;
    const msg = encodeURIComponent(`السلام عليكم ${name || ''}، بخصوص تعاملاتنا في البوتيك...`);
    window.open(`https://wa.me/${waPhone}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-4 pb-8" dir="rtl">
      <div className="bg-gradient-to-r from-teal-50/70 via-white to-cyan-50/70 p-4 sm:p-5 rounded-2xl border border-teal-100 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <Building2 className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>شركاء العمل: تتبع الموردين والخياطات</span>
              </h2>
            </div>
            <p className="text-xs text-slate-600 font-normal mt-1 mr-10">
              متابعة متطابقة وشاملة لحسابات الموردين (فواتير، دفعات، ديون متبقية) والخياطات (طلبيات، إنجاز، ومستحقات).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-slate-100/90 p-1 rounded-xl text-xs font-semibold w-full sm:w-auto border border-slate-200/60">
              <button
                onClick={() => {
                  setActiveTab('suppliers');
                  setSearch('');
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === 'suppliers'
                    ? 'bg-teal-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-teal-700'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>الموردين ({suppliers.length})</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('seamstresses');
                  setSearch('');
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === 'seamstresses'
                    ? 'bg-teal-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-teal-700'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>الخياطات ({seamstresses.length})</span>
              </button>
            </div>

            {activeTab === 'suppliers' ? (
              <button
                onClick={() => {
                  setEditingSupplier(null);
                  setSupName('');
                  setSupPhone('');
                  setSupAddress('');
                  setSupNotes('');
                  setShowAddSupplierModal(true);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md hover:shadow-teal-500/20 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مورد جديد</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditingSeamstress(null);
                  setSeamName('');
                  setSeamPhone('');
                  setSeamAddress('');
                  setSeamNotes('');
                  setShowAddSeamstressModal(true);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md hover:shadow-teal-500/20 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة خياطة جديدة</span>
              </button>
            )}
          </div>
        </div>

        {activeTab === 'suppliers' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-500 font-medium block mb-0.5">عدد الموردين المسجلين:</span>
              <span className="text-lg sm:text-xl font-bold text-slate-900">{suppliers.length} موردين</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">أقمشة وفساتين جاهزة</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-500 font-medium block mb-0.5">إجمالي المشتريات المفوترة:</span>
              <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono">{totalSupplierPurchasesAll.toLocaleString()} دج</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">قيمة السلع المشتراة</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-500 font-medium block mb-0.5">إجمالي المدفوع للموردين:</span>
              <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
                {supplierAnalytics.reduce((s, sup) => s + sup.totalPaid, 0).toLocaleString()} دج
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">مسدد كاش من الصندوق</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-500 font-medium block mb-0.5">الديون والكريدي المتبقي للموردين:</span>
              <span className="text-lg sm:text-xl font-bold text-rose-600 font-mono">{totalSupplierDebtsAll.toLocaleString()} دج</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">مستحقات بانتظار السداد</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 font-medium block mb-0.5">عدد الخياطات في الفريق:</span>
                <span className="text-lg sm:text-xl font-bold text-slate-900">{seamstresses.length} خياطات</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {totalTailoringOrdersCount} طلبية مسندة • {totalActiveTailoringCount} قيد الإنجاز
                </span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 font-medium block mb-0.5">الأتعاب المستحقة (طلبيات مسلّمة):</span>
                <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono">{totalSeamstressDues.toLocaleString()} دج</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  + {totalPendingSeamstressDues.toLocaleString()} دج قيد الإنجاز
                </span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 font-medium block mb-0.5">إجمالي المسدد للخياطات:</span>
                <span className="text-lg sm:text-xl font-bold text-emerald-700 font-mono">{totalSeamstressPaid.toLocaleString()} دج</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {seamstressPayments.length} دفعة مسجلة
                </span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 font-medium block mb-0.5">المتبقي بذمة المحل للخياطات:</span>
                <span className={`text-lg sm:text-xl font-bold font-mono ${totalSeamstressRemaining > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {totalSeamstressRemaining.toLocaleString()} دج
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">مستحقات بانتظار السداد</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOnlyDueSeamstresses(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                onlyDueSeamstresses
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-rose-700'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>{onlyDueSeamstresses ? 'عرض كل الخياطات' : 'عرض من عليهن مستحقات فقط'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'suppliers' ? 'بحث باسم المورد، الهاتف، الولاية، أو صنف السلعة...' : 'بحث باسم الخياطة، الهاتف، الاختصاص، أو المدينة...'}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>
      </div>

      {activeTab === 'suppliers' && (
        <div className="space-y-3">
          {filteredSuppliers.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400 space-y-2">
              <p className="text-xs font-medium text-slate-600">لا يوجد موردين مطابقين للبحث</p>
              <button
                onClick={() => {
                  setEditingSupplier(null);
                  setShowAddSupplierModal(true);
                }}
                className="text-xs text-slate-900 font-bold hover:underline"
              >
                + إضافة مورد جديد الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSuppliers.map(sup => (
                <div
                  key={sup.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200/70">
                          {sup.category || 'مورد عام'}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base mt-1.5">{sup.name}</h3>
                      </div>
                      {sup.remainingDebt > 0 ? (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                          كريدي: {sup.remainingDebt.toLocaleString()} دج
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium px-2 py-0.5 rounded-md">
                          خالص 0 دج
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      {sup.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-slate-700" dir="ltr">{sup.phone}</span>
                        </div>
                      )}
                      {sup.addressOrCity && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{sup.addressOrCity}</span>
                        </div>
                      )}
                    </div>

                    {sup.notes && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {sup.notes}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-normal">الفواتير</span>
                        <span className="font-bold text-slate-800">{sup.totalInvoices}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-normal">إجمالي السلعة</span>
                        <span className="font-bold text-slate-900 font-mono">{sup.totalBilled.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-normal">المدفوع كاش</span>
                        <span className="font-bold text-slate-900 font-mono">{sup.totalPaid.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {sup.phone && (
                        <button
                          onClick={() => handleWhatsApp(sup.phone, sup.name)}
                          className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all"
                          title="مراسلة واتساب"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {sup.phone && (
                        <a
                          href={`tel:${sup.phone}`}
                          className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-all"
                          title="اتصال هاتفي"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedSupplierHistory(sup)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>سجل الفواتير ({sup.totalInvoices})</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditSupplier(sup)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all"
                        title="تعديل بيانات المورد"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteSupplier(sup.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'seamstresses' && (
        <div className="space-y-3">
          {filteredSeamstresses.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400 space-y-2">
              <p className="text-xs font-medium text-slate-600">لا توجد خياطات مطابقة للبحث</p>
              <button
                onClick={() => {
                  setEditingSeamstress(null);
                  setShowAddSeamstressModal(true);
                }}
                className="text-xs text-slate-900 font-bold hover:underline"
              >
                + إضافة خياطة جديدة الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSeamstresses.map(seam => (
                <div
                  key={seam.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200/70">
                          {seam.specialty || 'خياطة عامة'}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base mt-1.5">{seam.name}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {seam.remainingDue > 0 ? (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                            مستحق {seam.remainingDue.toLocaleString()} دج
                          </span>
                        ) : seam.advancePaid > 0 ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                            سلفة {seam.advancePaid.toLocaleString()} دج
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            خالص ✓
                          </span>
                        )}
                        {seam.activeOrders > 0 ? (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                            {seam.activeOrders} طلبيات جارية
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium px-2 py-0.5 rounded-md">
                            {seam.totalOrders > 0 ? 'كل الطلبيات مسلّمة' : 'بلا طلبيات'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      {seam.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-slate-700" dir="ltr">{seam.phone}</span>
                        </div>
                      )}
                      {seam.addressOrCity && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{seam.addressOrCity}</span>
                        </div>
                      )}
                      {seam.ratePerPieceOrSalary && (
                        <div className="text-[11px] font-normal text-slate-600">
                          نظام التسعير: <span className="font-semibold text-slate-800">{seam.ratePerPieceOrSalary}</span>
                        </div>
                      )}
                    </div>

                    {seam.notes && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {seam.notes}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-normal">الطلبيات</span>
                        <span className="font-bold text-slate-800">{seam.totalOrders}</span>
                        <span className="text-[9px] text-slate-400 block font-normal">{seam.deliveredOrders} مسلّمة</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-normal">أتعاب مستحقة</span>
                        <span className="font-bold text-slate-900 font-mono">{seam.earnedDues.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 block font-normal">دج</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-normal">المتبقي</span>
                        <span className={`font-bold font-mono ${seam.remainingDue > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {seam.remainingDue.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-normal">دج</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 bg-white border border-slate-100 rounded-lg px-2.5 py-1.5">
                      <span>المسدد: <span className="font-bold text-emerald-700 font-mono">{seam.totalPaid.toLocaleString()} دج</span></span>
                      <span>{seam.payments.length} دفعة</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {seam.phone && (
                        <button
                          onClick={() => handleWhatsApp(seam.phone, seam.name)}
                          className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all"
                          title="مراسلة واتساب"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {seam.phone && (
                        <a
                          href={`tel:${seam.phone}`}
                          className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-all"
                          title="اتصال هاتفي"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenSeamstressPayment(seam)}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                        title="تسجيل دفعة مسددة لهذه الخياطة"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>تسديد دفعة</span>
                      </button>
                      <button
                        onClick={() => setSelectedSeamstressHistory(seam)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span>كشف الحساب ({seam.payments.length})</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditSeamstress(seam)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all"
                        title="تعديل بيانات الخياطة"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteSeamstress(seam.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-xl border border-slate-200/80 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد أزياء وأقمشة جديد'}
              </h3>
              <button
                onClick={() => setShowAddSupplierModal(false)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  اسم المورد / الشركة / الورشة <span className="text-rose-500">*</span>
                </label>
                <LettersInput
                  value={supName}
                  onChange={setSupName}
                  placeholder="مثال: مؤسسة الأناقة، شركة النسيج الملكي..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    رقم الهاتف
                  </label>
                  <NumbersInput
                    value={supPhone}
                    onChange={setSupPhone}
                    placeholder="0550123456"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 font-mono focus:bg-white focus:border-slate-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    الولاية / العنوان
                  </label>
                  <LettersInput
                    value={supAddress}
                    onChange={setSupAddress}
                    placeholder="مثال: الجزائر، وهران، سطيف..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  صنف ونوع السلع الموردة
                </label>
                <select
                  value={supCategory}
                  onChange={(e) => setSupCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                >
                  <option value="فساتين سهرة وأعراس جاهزة">فساتين سهرة وأعراس جاهزة</option>
                  <option value="أقمشة، حرير وتطريزات بالرولو">أقمشة، حرير وتطريزات بالرولو</option>
                  <option value="قفاطين وكراكو وأزياء تقليدية">قفاطين وكراكو وأزياء تقليدية</option>
                  <option value="بدلات وأطقم رجالية رسمية">بدلات وأطقم رجالية رسمية</option>
                  <option value="إكسسوارات، تيجان وحقائب">إكسسوارات، تيجان وحقائب</option>
                  <option value="لوازم خياطة وسحابات وخيوط">لوازم خياطة وسحابات وخيوط</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ملاحظات إضافية
                </label>
                <textarea
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  rows={2}
                  placeholder="ملاحظات حول طريقة السداد، جودة السلعة، المواعيد..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddSeamstressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-xl border border-slate-200/80 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {editingSeamstress ? 'تعديل بيانات الخياطة' : 'إضافة خياطة جديدة للفريق'}
              </h3>
              <button
                onClick={() => setShowAddSeamstressModal(false)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSeamstress} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  اسم الخياطة <span className="text-rose-500">*</span>
                </label>
                <LettersInput
                  value={seamName}
                  onChange={setSeamName}
                  placeholder="مثال: حليمة بوزيد، فاطمة ناصري..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    رقم الهاتف
                  </label>
                  <NumbersInput
                    value={seamPhone}
                    onChange={setSeamPhone}
                    placeholder="0661223344"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 font-mono focus:bg-white focus:border-slate-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    المدينة / الورشة
                  </label>
                  <LettersInput
                    value={seamAddress}
                    onChange={setSeamAddress}
                    placeholder="مثال: ورشة المحل، الجزائر، البليدة..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  الاختصاص والمهارة
                </label>
                <select
                  value={seamSpecialty}
                  onChange={(e) => setSeamSpecialty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                >
                  <option value="تعديل مقاسات وفساتين سهرة">تعديل مقاسات وتضييق فساتين سهرة</option>
                  <option value="قفاطين وكراكو وتطريز تقليدي">قفاطين، كراكو وتطريز تقليدي بالفتلة</option>
                  <option value="تفصيل فساتين أعراس وسواريه">تفصيل فساتين أعراس وسواريه من الصفر</option>
                  <option value="صيانة، سحابات وكي وتجهيز">صيانة سحابات، أزرار وكي وتجهيز للكراء</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  نظام الأتعاب / التسعير
                </label>
                <input
                  type="text"
                  value={seamRate}
                  onChange={(e) => setSeamRate(e.target.value)}
                  placeholder="مثال: بالقطعة (800 - 3000 دج) أو راتب شهري..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ملاحظات
                </label>
                <textarea
                  value={seamNotes}
                  onChange={(e) => setSeamNotes(e.target.value)}
                  rows={2}
                  placeholder="ملاحظات حول التفرغ وسرعة التسليم..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSeamstressModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  {editingSeamstress ? 'حفظ التعديلات' : 'إضافة الخياطة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedSupplierHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 sm:p-6 shadow-xl border border-slate-200/80 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md border border-slate-200/70">
                  كشف حساب المورد
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-1">
                  {selectedSupplierHistory.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSupplierHistory(null)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(() => {
                const supData = supplierAnalytics.find(s => s.id === selectedSupplierHistory.id);
                const supExp = supData?.expenses || [];

                if (supExp.length === 0) {
                  return (
                    <p className="text-xs text-slate-400 text-center py-8">
                      لا توجد فواتير أو عمليات شراء مسجلة مع هذا المورد حتى الآن.
                    </p>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100">
                    {supExp.map(exp => (
                      <div key={exp.id} className="py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{exp.goodsDescription || exp.desc}</span>
                            {exp.invoiceNumber && (
                              <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200/70">
                                N° {exp.invoiceNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 text-[11px] mt-0.5">
                            التاريخ: {exp.date?.split('T')[0]} {exp.notes && `• ${exp.notes}`}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <div className="text-right sm:text-left">
                            <div className="font-bold text-slate-900 font-mono">
                              الإجمالي: {(exp.totalInvoiceAmount || exp.amount || 0).toLocaleString()} دج
                            </div>
                            <div className="text-[11px]">
                              <span className="text-slate-600">المدفوع: {(exp.paidAmount !== undefined ? exp.paidAmount : exp.amount).toLocaleString()} دج</span>
                              {(exp.creditAmount || 0) > 0 && (
                                <span className="text-rose-600 font-bold mr-2">متبقي: {(exp.creditAmount || 0).toLocaleString()} دج</span>
                              )}
                            </div>
                          </div>

                          {(exp.creditAmount || 0) > 0 && (
                            <button
                              onClick={() => {
                                setSettleExpense(exp);
                                setSettleAmount(String(exp.creditAmount || 0));
                              }}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs shrink-0 transition-colors"
                            >
                              تسديد الدين
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {selectedSeamstressHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 sm:p-6 shadow-xl border border-slate-200/80 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 gap-2">
              <div>
                <span className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md border border-slate-200/70">
                  كشف حساب الخياطة
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-1">
                  {selectedSeamstressHistory.name}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedSeamstressHistory.specialty || 'خياطة عامة'}
                  {selectedSeamstressHistory.phone ? ` • ${selectedSeamstressHistory.phone}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedSeamstressHistory(null)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const seamData = seamstressAnalytics.find(s => s.id === selectedSeamstressHistory.id);
              const seamOrders = seamData?.orders || [];
              const seamPayments = seamData?.payments || [];
              const earnedDues = seamData?.earnedDues || 0;
              const pendingDues = seamData?.pendingDues || 0;
              const totalPaid = seamData?.totalPaid || 0;
              const remainingDue = seamData?.remainingDue || 0;
              const advancePaid = seamData?.advancePaid || 0;

              return (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
                      <span className="text-[10px] text-slate-500 block">أتعاب مستحقة</span>
                      <span className="text-sm font-bold text-slate-900 font-mono">{earnedDues.toLocaleString()} دج</span>
                      {pendingDues > 0 && (
                        <span className="text-[9px] text-slate-400 block mt-0.5">+{pendingDues.toLocaleString()} قيد الإنجاز</span>
                      )}
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 text-center">
                      <span className="text-[10px] text-emerald-700 block">المسدد</span>
                      <span className="text-sm font-bold text-emerald-800 font-mono">{totalPaid.toLocaleString()} دج</span>
                      <span className="text-[9px] text-emerald-600/80 block mt-0.5">{seamPayments.length} دفعة</span>
                    </div>
                    <div className={`rounded-xl p-3 text-center border ${remainingDue > 0 ? 'bg-rose-50 border-rose-200/80' : 'bg-slate-50 border-slate-200/80'}`}>
                      <span className={`text-[10px] block ${remainingDue > 0 ? 'text-rose-700' : 'text-slate-500'}`}>المتبقي</span>
                      <span className={`text-sm font-bold font-mono ${remainingDue > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{remainingDue.toLocaleString()} دج</span>
                      {advancePaid > 0 && (
                        <span className="text-[9px] text-amber-600 block mt-0.5">سلفة {advancePaid.toLocaleString()} دج</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {seamData && (
                      <button
                        onClick={() => handleOpenSeamstressPayment(seamData)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>تسجيل دفعة / تسديد</span>
                      </button>
                    )}
                    {selectedSeamstressHistory.phone && (
                      <button
                        onClick={() => handleWhatsApp(selectedSeamstressHistory.phone, selectedSeamstressHistory.name)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>واتساب</span>
                      </button>
                    )}
                    <button
                      onClick={() => handlePrintSeamstressStatement(selectedSeamstressHistory)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة كشف الحساب</span>
                    </button>
                    {selectedSeamstressHistory.ratePerPieceOrSalary && (
                      <span className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
                        التسعير: <span className="font-semibold text-slate-800">{selectedSeamstressHistory.ratePerPieceOrSalary}</span>
                      </span>
                    )}
                  </div>

                  {/* الدفعات المسجلة */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-slate-500" />
                        <span>الدفعات المسجلة</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">{seamPayments.length} دفعة</span>
                    </div>

                    {seamPayments.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        لا توجد دفعات مسجلة لهذه الخياطة حتى الآن.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                        {seamPayments.map(payment => (
                          <div key={payment.id} className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs bg-white hover:bg-slate-50/70 transition-colors">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 font-mono">
                                {Number(payment.amount || 0).toLocaleString()} دج
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {payment.date}
                                <span className={`mr-1.5 inline-block px-1.5 py-0.5 rounded border ${
                                  payment.fundSource === 'general'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {payment.fundSource === 'general' ? 'الصندوق العام' : 'صندوق اليوم'}
                                </span>
                                {payment.note && <span className="mr-1.5 text-slate-500">• {payment.note}</span>}
                              </div>
                            </div>
                            {onDeleteSeamstressPayment && (
                              <button
                                onClick={() => onDeleteSeamstressPayment(payment.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all shrink-0"
                                title="حذف الدفعة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* الطلبيات */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-slate-500" />
                        <span>الطلبيات المسندة</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">{seamOrders.length} طلبية</span>
                    </div>

                    {seamOrders.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        لا توجد طلبيات خياطة مسندة لهذه الخياطة حتى الآن. تأكد من كتابة اسمها في حقل «الخياطة المسؤولة» عند إنشاء طلب.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                        {seamOrders.map(order => (
                          <div key={order.id} className="px-3 py-2.5 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs bg-white hover:bg-slate-50/70 transition-colors">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-200/70">
                                  {order.orderNumber}
                                </span>
                                <span className="truncate">{order.itemName}</span>
                              </div>
                              <div className="text-slate-400 text-[10px] mt-0.5">
                                {order.customerName ? `الزبونة: ${order.customerName}` : 'المحل'} • موعد التسليم: {order.expectedDeliveryDate}
                              </div>
                            </div>

                            <div className="text-right sm:text-left shrink-0">
                              <div className="text-[11px] text-slate-600 font-medium">
                                أتعاب الخياطة: <span className="font-bold text-slate-900 font-mono">{(order.cost || 0).toLocaleString()} دج</span>
                              </div>
                              <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                                order.status === 'delivered'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : order.status === 'ready'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {order.status === 'delivered'
                                  ? 'مسلّمة — ضمن المستحق'
                                  : order.status === 'ready'
                                  ? 'جاهزة — غير مستحقة بعد'
                                  : 'قيد الإنجاز — غير مستحقة بعد'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {settleExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl border border-slate-200/80 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-700" />
                <span>تسديد دين / دفعة للمورد</span>
              </h3>
              <button
                onClick={() => setSettleExpense(null)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1">
                <div>المورد: <span className="font-bold text-slate-900">{settleExpense.supplierName}</span></div>
                <div>السلعة: <span className="font-medium text-slate-700">{settleExpense.goodsDescription || settleExpense.desc}</span></div>
                <div className="text-rose-600 font-bold font-mono">
                  الدين المتبقي: {(settleExpense.creditAmount || 0).toLocaleString()} دج
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  المبلغ المدفوع كاش الآن (دج)
                </label>
                <NumbersInput
                  value={settleAmount}
                  onChange={setSettleAmount}
                  placeholder="المبلغ المراد تسديده"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 font-mono focus:bg-white focus:border-slate-400 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettleExpense(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  تأكيد تسديد المبلغ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paySeamstress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl border border-slate-200/80 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Banknote className="w-4 h-4 text-slate-700" />
                <span>تسجيل دفعة للخياطة</span>
              </h3>
              <button
                onClick={() => setPaySeamstress(null)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const data = seamstressAnalytics.find(s => s.id === paySeamstress.id);
              const remaining = data?.remainingDue || 0;
              const amount = Number(payAmount) || 0;
              const afterPay = Math.round((remaining - amount) * 100) / 100;

              return (
                <form onSubmit={handleConfirmSeamstressPayment} className="space-y-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1">
                    <div>الخياطة: <span className="font-bold text-slate-900">{paySeamstress.name}</span></div>
                    <div>الأتعاب المستحقة: <span className="font-mono font-bold text-slate-800">{(data?.earnedDues || 0).toLocaleString()} دج</span></div>
                    <div>المسدد سابقاً: <span className="font-mono font-bold text-emerald-700">{(data?.totalPaid || 0).toLocaleString()} دج</span></div>
                    <div className={remaining > 0 ? 'text-rose-600 font-bold font-mono' : 'text-slate-600 font-bold font-mono'}>
                      الدين المتبقي: {remaining.toLocaleString()} دج
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      المبلغ المدفوع (دج) <span className="text-rose-500">*</span>
                    </label>
                    <NumbersInput
                      value={payAmount}
                      onChange={(val) => {
                        setPayAmount(val);
                        if (payError) setPayError('');
                      }}
                      placeholder="المبلغ المراد تسديده"
                      className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-sm font-bold text-slate-900 font-mono focus:bg-white focus:outline-none ${
                        payError ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-slate-400'
                      }`}
                      required
                    />
                    {payError && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1">{payError}</p>
                    )}
                    {remaining <= 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-2 py-1.5 mt-1.5">
                        {`لا توجد أتعاب مستحقة حالياً (تُحتسب عند تسليم الطلبية). أي دفعة الآن تُحسب سلفة للخياطة.`}
                      </p>
                    )}
                    {remaining > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setPayAmount(String(Math.round(remaining)))}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 transition-colors"
                        >
                          كامل المتبقي ({remaining.toLocaleString()} دج)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayAmount(String(Math.round(remaining / 2)))}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 transition-colors"
                        >
                          النصف
                        </button>
                      </div>
                    )}
                    {amount > 0 && (
                      <p className={`text-[11px] mt-1.5 font-medium ${afterPay > 0 ? 'text-rose-600' : afterPay < 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {afterPay > 0
                          ? `المتبقي بعد هذه الدفعة: ${afterPay.toLocaleString()} دج`
                          : afterPay < 0
                          ? `دفعة زائدة تُحسب سلفة للخياطة: ${Math.abs(afterPay).toLocaleString()} دج`
                          : 'بهذه الدفعة يصبح حسابها خالصاً ✓'}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">تاريخ الدفع</label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">مصدر الدفع</label>
                      <select
                        value={payFundSource}
                        onChange={(e) => setPayFundSource(e.target.value as 'daily' | 'general')}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                      >
                        <option value="daily">صندوق اليوم (الدرج)</option>
                        <option value="general">الصندوق العام (الخزينة)</option>
                      </select>
                    </div>
                  </div>

                  {payFundSource === 'general' && (
                    <div className="flex items-start gap-1.5 bg-indigo-50 border border-indigo-200/80 rounded-xl px-3 py-2 text-[11px] text-indigo-800">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>سيُخصم المبلغ مباشرة من رصيد الصندوق العام (الخزينة). تأكد من كفاية الرصيد قبل التسديد.</span>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">ملاحظة (اختياري)</label>
                    <textarea
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                      rows={2}
                      placeholder="مثال: دفعة أولى عن طلبية الفستان، أو خلاص أتعاب الأسبوع..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPaySeamstress(null)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors active:scale-95"
                    >
                      تأكيد تسجيل الدفعة
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
});
