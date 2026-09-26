import React, { useState, useMemo, useCallback } from 'react';
import { 
  ClothItem, 
  Rental, 
  Sale, 
  Expense, 
  Credit, 
  StaffPayout, 
  MaintenanceOrder, 
  DailyCaisseClosure 
} from '../types';
import { downloadElementAsPng } from '../utils/pngDownload';
import { openPrintInterface } from '../utils/printInterface';
import { 
  Calendar, 
  Download, 
  Printer, 
  TrendingUp, 
  Shirt, 
  ShoppingBag, 
  Droplets, 
  CreditCard, 
  Users, 
  Scissors, 
  Package, 
  Search, 
  DollarSign, 
  CheckCircle2,
  AlertTriangle,
  Scale,
  FileText
} from 'lucide-react';

interface FullReportProps {
  clothes: ClothItem[];
  rentals: Rental[];
  sales: Sale[];
  expenses: Expense[];
  credits: Credit[];
  staffPayouts: StaffPayout[];
  maintenanceOrders?: MaintenanceOrder[];
  caisseClosures?: DailyCaisseClosure[];
  hideFinances: boolean;
}

type PeriodType = 'today' | 'last7' | 'this_month' | 'last_month' | 'this_year' | 'all' | 'custom';
type TabType = 'overview_all' | 'rentals' | 'sales' | 'expenses' | 'tailoring' | 'credits' | 'staff' | 'inventory';

export const FullReport: React.FC<FullReportProps> = React.memo(({
  clothes = [],
  rentals = [],
  sales = [],
  expenses = [],
  credits = [],
  staffPayouts = [],
  maintenanceOrders = [],
  caisseClosures = [],
  hideFinances
}) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // State
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [activeTab, setActiveTab] = useState<TabType>('overview_all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState('');
  const [rentalStatusFilter, setRentalStatusFilter] = useState<'all' | 'active' | 'reserved' | 'overdue' | 'returned'>('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  const [downloadNote, setDownloadNote] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Helper date range calculator
  const dateRange = useMemo(() => {
    const curr = new Date();
    if (period === 'today') {
      return { start: todayStr, end: todayStr, label: 'اليوم' };
    }
    if (period === 'last7') {
      const past = new Date(curr);
      past.setDate(curr.getDate() - 7);
      return { start: past.toISOString().split('T')[0], end: todayStr, label: 'آخر 7 أيام' };
    }
    if (period === 'this_month') {
      const start = new Date(curr.getFullYear(), curr.getMonth(), 1).toISOString().split('T')[0];
      return { start, end: todayStr, label: 'هذا الشهر' };
    }
    if (period === 'last_month') {
      const start = new Date(curr.getFullYear(), curr.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(curr.getFullYear(), curr.getMonth(), 0).toISOString().split('T')[0];
      return { start, end, label: 'الشهر الماضي' };
    }
    if (period === 'this_year') {
      const start = new Date(curr.getFullYear(), 0, 1).toISOString().split('T')[0];
      return { start, end: todayStr, label: 'هذا العام' };
    }
    if (period === 'custom') {
      return { start: startDate, end: endDate, label: `من ${startDate} إلى ${endDate}` };
    }
    return { start: '2000-01-01', end: '2099-12-31', label: 'كامل الفترات' };
  }, [period, startDate, endDate, todayStr]);

  const isDateInRange = useCallback((dateStr?: string) => {
    if (!dateStr) return false;
    if (period === 'all') return true;
    const d = dateStr.slice(0, 10);
    return d >= dateRange.start && d <= dateRange.end;
  }, [period, dateRange]);

  // Filtered Datasets based on Date Range
  const filteredRentals = useMemo(() => {
    return rentals.filter(r => {
      const date = r.bookingDate || r.startDate || r.createdAt || r.paymentDate;
      return isDateInRange(date);
    });
  }, [rentals, isDateInRange]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => isDateInRange(s.date));
  }, [sales, isDateInRange]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => isDateInRange(e.date));
  }, [expenses, isDateInRange]);

  const filteredCredits = useMemo(() => {
    return credits.filter(c => isDateInRange(c.date));
  }, [credits, isDateInRange]);

  const filteredStaffPayouts = useMemo(() => {
    return staffPayouts.filter(p => isDateInRange(p.date));
  }, [staffPayouts, isDateInRange]);

  const filteredTailoring = useMemo(() => {
    return maintenanceOrders.filter(o => isDateInRange(o.receivedDate || o.createdAt));
  }, [maintenanceOrders, isDateInRange]);

  const filteredCaisse = useMemo(() => {
    return caisseClosures.filter(c => isDateInRange(c.date));
  }, [caisseClosures, isDateInRange]);

  // Expense categories
  const expenseCategories = useMemo(() => {
    const cats = new Set<string>();
    expenses.forEach(e => { if (e.category) cats.add(e.category); });
    return Array.from(cats);
  }, [expenses]);

  // Financial Metrics Calculations
  const metrics = useMemo(() => {
    const totalRentalIncome = filteredRentals.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
    const totalRentalBookedValue = filteredRentals.reduce((sum, r) => sum + (r.rentPrice || 0), 0);
    const activeRentalsCount = filteredRentals.filter(r => r.status === 'active').length;
    const reservedRentalsCount = filteredRentals.filter(r => r.status === 'reserved').length;
    const returnedRentalsCount = filteredRentals.filter(r => r.status === 'returned').length;
    const overdueRentalsCount = filteredRentals.filter(r => {
      if (r.status === 'returned' || r.status === 'cancelled') return false;
      return r.expectedReturnDate && r.expectedReturnDate < todayStr;
    }).length;
    const totalHeldCautions = filteredRentals
      .filter(r => r.status !== 'returned' && r.status !== 'cancelled' && r.cautionStatus === 'held')
      .reduce((sum, r) => sum + (r.cautionAmount || 0), 0);
    const remainingRentalDebts = filteredRentals
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (r.remainingAmount || 0), 0);

    const totalSalesRevenue = filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalSalesPaid = filteredSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
    const totalSalesProfit = filteredSales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const totalSalesDebt = filteredSales.reduce((sum, s) => sum + (s.debtAmount || 0), 0);
    const totalItemsSold = filteredSales.reduce((sum, s) => sum + (s.items?.reduce((is, i) => is + (i.qty || 1), 0) || 0), 0);

    const totalTailoringRevenue = filteredTailoring.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
    const totalTailoringTotalVal = filteredTailoring.reduce((sum, o) => sum + (o.price || 0), 0);
    const totalTailoringCosts = filteredTailoring.reduce((sum, o) => sum + (o.cost || 0), 0);
    const totalTailoringNet = totalTailoringRevenue - totalTailoringCosts;

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalStaffPayouts = filteredStaffPayouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalCustomerCredits = filteredCredits.filter(c => !c.supplierDebt).reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const totalSupplierDebts = filteredCredits.filter(c => c.supplierDebt).reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const grossInflow = totalRentalIncome + totalSalesPaid + totalTailoringRevenue;
    const totalOutflow = totalExpenses + totalStaffPayouts;
    const netProfit = (totalRentalIncome + totalSalesProfit + totalTailoringNet) - totalOutflow;

    const totalStockQty = clothes.reduce((sum, c) => sum + (c.stock || 0), 0);
    const totalRentedCount = clothes.reduce((sum, c) => sum + (c.rentedCount || 0), 0);
    const totalAvailableStock = totalStockQty - totalRentedCount;
    const totalStockBuyCost = clothes.reduce((sum, c) => sum + ((c.buyCost || 0) * (c.stock || 0)), 0);
    const totalStockSellValue = clothes.reduce((sum, c) => sum + ((c.sellPrice || 0) * (c.stock || 0)), 0);

    return {
      totalRentalIncome,
      totalRentalBookedValue,
      activeRentalsCount,
      reservedRentalsCount,
      returnedRentalsCount,
      overdueRentalsCount,
      totalHeldCautions,
      remainingRentalDebts,
      totalSalesRevenue,
      totalSalesPaid,
      totalSalesProfit,
      totalSalesDebt,
      totalItemsSold,
      totalTailoringRevenue,
      totalTailoringTotalVal,
      totalTailoringCosts,
      totalTailoringNet,
      totalExpenses,
      totalStaffPayouts,
      totalCustomerCredits,
      totalSupplierDebts,
      grossInflow,
      totalOutflow,
      netProfit,
      totalStockQty,
      totalRentedCount,
      totalAvailableStock,
      totalStockBuyCost,
      totalStockSellValue
    };
  }, [
    filteredRentals,
    filteredSales,
    filteredExpenses,
    filteredCredits,
    filteredStaffPayouts,
    filteredTailoring,
    clothes,
    todayStr
  ]);

  const fileName = `التقرير_الشامل_للبوتيك_${dateRange.label.replace(/\s+/g, '_')}_${todayStr}`;

  const renderMoney = (amount: number, suffix = 'دج') => {
    if (hideFinances) return '•••••• دج';
    return `${(amount || 0).toLocaleString()} ${suffix}`;
  };

  // Searching in tables
  const searchedRentals = useMemo(() => {
    return filteredRentals.filter(r => {
      if (rentalStatusFilter !== 'all') {
        if (rentalStatusFilter === 'overdue') {
          if (r.status === 'returned' || r.status === 'cancelled') return false;
          if (!r.expectedReturnDate || r.expectedReturnDate >= todayStr) return false;
        } else if (r.status !== rentalStatusFilter) {
          return false;
        }
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        r.customerName?.toLowerCase().includes(term) ||
        r.customerPhone?.includes(term) ||
        r.itemName?.toLowerCase().includes(term) ||
        r.notes?.toLowerCase().includes(term)
      );
    });
  }, [filteredRentals, rentalStatusFilter, searchTerm, todayStr]);

  const searchedSales = useMemo(() => {
    return filteredSales.filter(s => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        s.customerName?.toLowerCase().includes(term) ||
        s.customerPhone?.includes(term) ||
        s.items?.some(i => i.name?.toLowerCase().includes(term))
      );
    });
  }, [filteredSales, searchTerm]);

  const searchedExpenses = useMemo(() => {
    return filteredExpenses.filter(e => {
      if (expenseCategoryFilter !== 'all' && e.category !== expenseCategoryFilter) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        e.desc?.toLowerCase().includes(term) ||
        e.category?.toLowerCase().includes(term) ||
        e.supplierName?.toLowerCase().includes(term)
      );
    });
  }, [filteredExpenses, expenseCategoryFilter, searchTerm]);

  const searchedTailoring = useMemo(() => {
    if (!searchTerm) return filteredTailoring;
    const term = searchTerm.toLowerCase();
    return filteredTailoring.filter(o =>
      o.customerName?.toLowerCase().includes(term) ||
      o.itemName?.toLowerCase().includes(term) ||
      o.orderNumber?.toLowerCase().includes(term) ||
      o.tailorName?.toLowerCase().includes(term)
    );
  }, [filteredTailoring, searchTerm]);

  const searchedCredits = useMemo(() => {
    if (!searchTerm) return filteredCredits;
    const term = searchTerm.toLowerCase();
    return filteredCredits.filter(c =>
      c.name?.toLowerCase().includes(term) ||
      c.phone?.includes(term) ||
      c.desc?.toLowerCase().includes(term)
    );
  }, [filteredCredits, searchTerm]);

  const searchedStaff = useMemo(() => {
    if (!searchTerm) return filteredStaffPayouts;
    const term = searchTerm.toLowerCase();
    return filteredStaffPayouts.filter(p =>
      p.name?.toLowerCase().includes(term) ||
      p.type?.toLowerCase().includes(term) ||
      p.notes?.toLowerCase().includes(term)
    );
  }, [filteredStaffPayouts, searchTerm]);

  const searchedClothes = useMemo(() => {
    if (!searchTerm) return clothes;
    const term = searchTerm.toLowerCase();
    return clothes.filter(c => 
      c.name.toLowerCase().includes(term) ||
      c.barcode?.includes(term) ||
      c.category?.toLowerCase().includes(term) ||
      c.size?.toLowerCase().includes(term)
    );
  }, [clothes, searchTerm]);

  // Export handlers
  const exportToImage = async () => {
    const element = document.getElementById('boutiqueFullReportDetailedContent');
    if (!element) return;
    setIsExporting(true);
    setDownloadNote('جاري إنشاء صورة عالية الدقة للملخص العام وجميع التقارير...');
    try {
      await downloadElementAsPng(element, fileName);
      setDownloadNote('تم تنزيل التقرير الشامل كاملاً كصورة PNG بنجاح');
    } catch (error) {
      console.error('Error exporting report to image:', error);
      setDownloadNote('تعذر تنزيل الصورة، يرجى المحاولة لاحقاً');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    openPrintInterface({
      title: `التقرير المالي والإداري الشامل والمفصل (${dateRange.label})`,
      fileName,
      sourceElement: document.getElementById('boutiqueFullReportDetailedContent'),
    });
  };

  return (
    <div className="space-y-4 max-w-full text-slate-800" dir="rtl">
      {/* Top Action Bar (Controls & Multi-Format Download Buttons) */}
      <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl shadow-xs space-y-3 no-print">
        {/* Row 1: Time Filters & Download Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 shrink-0 ml-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              الفترة:
            </span>
            {(['today', 'last7', 'this_month', 'last_month', 'this_year', 'all', 'custom'] as PeriodType[]).map((p) => {
              const labels: Record<PeriodType, string> = {
                today: 'اليوم',
                last7: '7 أيام',
                this_month: 'هذا الشهر',
                last_month: 'الشهر الماضي',
                this_year: 'هذا العام',
                all: 'كل الفترات',
                custom: 'مخصص'
              };
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                    active 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* Quick Action Download Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {/* Download PNG image */}
            <button
              onClick={exportToImage}
              disabled={isExporting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
              title="تنزيل التقرير الشامل كصورة PNG عالية الدقة"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'جاري التنزيل...' : 'تنزيل صورة PNG'}</span>
            </button>

            {/* Print Full Report */}
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* Row 2: Custom Date Range Pickers (Visible only when custom is selected) */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-600">من تاريخ:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold"
            />
            <span className="font-bold text-slate-600">إلى تاريخ:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold"
            />
          </div>
        )}

        {/* Row 3: Tab Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-slate-100 pt-2.5 hide-scrollbar">
          {[
            { id: 'overview_all', label: '📊 الملخص العام الشامل (جميع التقارير)', count: null, isPrimary: true },
            { id: 'rentals', label: '👗 الكراء', count: filteredRentals.length },
            { id: 'sales', label: '🛍️ المبيعات', count: filteredSales.length },
            { id: 'expenses', label: '💸 المصاريف', count: filteredExpenses.length },
            { id: 'tailoring', label: '✂️ الخياطة', count: filteredTailoring.length },
            { id: 'credits', label: '💳 الديون', count: filteredCredits.length },
            { id: 'staff', label: '👥 العمال', count: filteredStaffPayouts.length },
            { id: 'inventory', label: '📦 المخزون', count: clothes.length },
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  active 
                    ? tab.isPrimary ? 'bg-blue-600 text-white shadow-xs font-black' : 'bg-slate-900 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${active ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Row 4: Search & Filters */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ابحث بالاسم، الهاتف، القطعة، رقم الطلب، أو البيان في جميع الجداول..."
              className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-600 focus:bg-white outline-none"
            />
          </div>
          {(activeTab === 'overview_all' || activeTab === 'rentals') && (
            <select
              value={rentalStatusFilter}
              onChange={e => setRentalStatusFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 outline-none"
            >
              <option value="all">حالات الكراء (الكل)</option>
              <option value="active">كراء ساري</option>
              <option value="reserved">حجز قادم</option>
              <option value="overdue">متأخر</option>
              <option value="returned">تم الإرجاع</option>
            </select>
          )}
        </div>

        {downloadNote && (
          <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center justify-between">
            <span>{downloadNote}</span>
            <button onClick={() => setDownloadNote('')} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>
        )}
      </div>

      {/* Main Printable & Exportable Mega Container */}
      <div 
        id="boutiqueFullReportDetailedContent" 
        className="space-y-6 text-slate-800 p-4 sm:p-7 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-xs"
      >
        {/* Report Official Header */}
        <div className="border-b-2 border-slate-900 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs">
                  <Shirt className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                    الملخص العام الشامل وكشف التقارير الكامل للبوتيك
                  </h1>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">
                    كشف حساب جامع لعمليات الكراء، المبيعات، المصاريف، الخياطة، الديون، أجور العمال، وجرد المخزون
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-left self-stretch sm:self-auto">
              <span className="text-xs font-black text-blue-900">{dateRange.label}</span>
              <span className="text-[10px] text-slate-500 font-bold mt-0.5">
                تاريخ التقرير: {now.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Global Financial KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Net Profit Card */}
          <div className="p-3.5 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl shadow-xs">
            <div className="flex items-center justify-between opacity-80 mb-1">
              <span className="text-[11px] font-bold">صافي الأرباح الحقيقية</span>
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-xl font-black font-mono">
              {renderMoney(metrics.netProfit)}
            </div>
            <div className="text-[10px] opacity-80 mt-1">
              (مداخيل النشاط - التكاليف والمصاريف)
            </div>
          </div>

          {/* Rental Inflow */}
          <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl">
            <div className="flex items-center justify-between text-blue-800 mb-1">
              <span className="text-[11px] font-bold">مداخيل الكراء</span>
              <Shirt className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-base sm:text-xl font-black font-mono text-blue-950">
              {renderMoney(metrics.totalRentalIncome)}
            </div>
            <div className="text-[10px] text-blue-600 font-bold mt-1">
              {metrics.activeRentalsCount} كراء ساري • {metrics.reservedRentalsCount} حجز
            </div>
          </div>

          {/* Sales Revenue */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center justify-between text-slate-700 mb-1">
              <span className="text-[11px] font-bold">مبيعات الملابس</span>
              <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-base sm:text-xl font-black font-mono text-slate-900">
              {renderMoney(metrics.totalSalesRevenue)}
            </div>
            <div className="text-[10px] text-emerald-700 font-bold mt-1">
              أرباح المبيعات: {renderMoney(metrics.totalSalesProfit)}
            </div>
          </div>

          {/* Total Expenses & Payouts */}
          <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl">
            <div className="flex items-center justify-between text-rose-800 mb-1">
              <span className="text-[11px] font-bold">المصاريف والرواتب</span>
              <Droplets className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-base sm:text-xl font-black font-mono text-rose-950">
              {renderMoney(metrics.totalOutflow)}
            </div>
            <div className="text-[10px] text-rose-600 font-bold mt-1">
              مصاريف: {renderMoney(metrics.totalExpenses)} • أجور: {renderMoney(metrics.totalStaffPayouts)}
            </div>
          </div>
        </div>

        {/* Secondary Financial Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500">الضمانات المالية المحجوزة:</span>
            <span className="font-black text-slate-900 font-mono mt-0.5">{renderMoney(metrics.totalHeldCautions)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500">ديون الزبائن غير المحصلة:</span>
            <span className="font-black text-amber-700 font-mono mt-0.5">{renderMoney(metrics.totalCustomerCredits + metrics.remainingRentalDebts + metrics.totalSalesDebt)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500">مداخيل الخياطة والتعديل:</span>
            <span className="font-black text-indigo-900 font-mono mt-0.5">{renderMoney(metrics.totalTailoringRevenue)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500">رأس مال المخزون (شراء):</span>
            <span className="font-black text-slate-900 font-mono mt-0.5">{renderMoney(metrics.totalStockBuyCost)}</span>
          </div>
        </div>

        {/* 1. EXECUTIVE FINANCIAL BALANCE TABLE */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 font-black text-xs text-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              <span>كشف الموازنة المالية الشاملة ({dateRange.label})</span>
            </div>
            <span className="text-[11px] text-slate-500 font-normal">المبالغ بالدينار الجزائري</span>
          </div>
          <div className="p-3 sm:p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="font-bold text-slate-700">مقبوضات الكراء (العربون + التتمة):</span>
              <span className="font-black font-mono text-blue-900">{renderMoney(metrics.totalRentalIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="font-bold text-slate-700">مقبوضات مبيعات الملابس:</span>
              <span className="font-black font-mono text-emerald-900">{renderMoney(metrics.totalSalesPaid)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="font-bold text-slate-700">مقبوضات الخياطة والتعديل:</span>
              <span className="font-black font-mono text-indigo-900">{renderMoney(metrics.totalTailoringRevenue)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 bg-slate-50 px-2 rounded-lg font-bold">
              <span className="text-slate-900">إجمالي التدفق النقدي المقبوض:</span>
              <span className="font-black font-mono text-slate-900">{renderMoney(metrics.grossInflow)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 text-rose-700">
              <span className="font-bold">المصاريف التشغيلية والغسيل (Pressing):</span>
              <span className="font-black font-mono">- {renderMoney(metrics.totalExpenses)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 text-rose-700">
              <span className="font-bold">رواتب وخلاص العمال:</span>
              <span className="font-black font-mono">- {renderMoney(metrics.totalStaffPayouts)}</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-blue-50 px-3 rounded-xl border border-blue-200 text-sm font-black text-blue-900">
              <span>الربح الصافي للبوتيك:</span>
              <span className="font-mono text-base">{renderMoney(metrics.netProfit)}</span>
            </div>
          </div>
        </div>

        {/* ================= ALL COMPREHENSIVE TABLES IN OVERVIEW ================= */}

        {/* 2. RENTALS REPORT TABLE (Visible in Overview or Rentals Tab) */}
        {(activeTab === 'overview_all' || activeTab === 'rentals') && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Shirt className="w-4 h-4 text-blue-600" />
                <span>1. تقرير عقود الكراء والحجوزات ({searchedRentals.length} عقد)</span>
              </h3>
              <span className="text-xs font-bold text-blue-900">
                المداخيل: {renderMoney(searchedRentals.reduce((s, r) => s + (r.paidAmount || 0), 0))}
              </span>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-right text-xs table-auto divide-y divide-slate-200 min-w-[650px]">
                <thead className="bg-slate-100 text-slate-700 font-black">
                  <tr>
                    <th className="p-2.5">القطعة / الفستان</th>
                    <th className="p-2.5">الزبون والهاتف</th>
                    <th className="p-2.5">الاستلام</th>
                    <th className="p-2.5">الإرجاع</th>
                    <th className="p-2.5 text-center">الحالة</th>
                    <th className="p-2.5 text-left">السعر</th>
                    <th className="p-2.5 text-left">المدفوع</th>
                    <th className="p-2.5 text-left">المتبقي</th>
                    <th className="p-2.5 text-left">الضمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {searchedRentals.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-slate-400 font-bold">
                        لا توجد عقود كراء مسجلة في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    searchedRentals.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80">
                        <td className="p-2 font-black text-slate-900">
                          <div>{r.itemName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">مقاس {r.itemSize} • {r.itemColor}</div>
                        </td>
                        <td className="p-2">
                          <div className="font-bold text-slate-800">{r.customerName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{r.customerPhone}</div>
                        </td>
                        <td className="p-2 text-slate-600 font-mono text-[11px]">{r.startDate || '-'}</td>
                        <td className="p-2 text-slate-900 font-bold font-mono text-[11px]">{r.expectedReturnDate}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            r.status === 'active' ? 'bg-blue-100 text-blue-800' :
                            r.status === 'reserved' ? 'bg-amber-100 text-amber-800' :
                            r.status === 'overdue' ? 'bg-rose-100 text-rose-800' :
                            r.status === 'returned' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {r.status === 'active' ? 'ساري' :
                             r.status === 'reserved' ? 'محجوز' :
                             r.status === 'overdue' ? 'متأخر' :
                             r.status === 'returned' ? 'تم الإرجاع' : r.status}
                          </span>
                        </td>
                        <td className="p-2 text-left font-mono font-bold">{renderMoney(r.rentPrice)}</td>
                        <td className="p-2 text-left font-mono font-black text-blue-900">{renderMoney(r.paidAmount || 0)}</td>
                        <td className="p-2 text-left font-mono font-bold text-rose-600">{renderMoney(r.remainingAmount || 0)}</td>
                        <td className="p-2 text-left font-mono text-slate-600">{renderMoney(r.cautionAmount || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. SALES REPORT TABLE (Visible in Overview or Sales Tab) */}
        {(activeTab === 'overview_all' || activeTab === 'sales') && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>2. تقرير مبيعات الملابس ({searchedSales.length} عملية)</span>
              </h3>
              <span className="text-xs font-bold text-emerald-800">
                المبيعات: {renderMoney(searchedSales.reduce((s, sl) => s + (sl.totalAmount || 0), 0))} (الأرباح: {renderMoney(searchedSales.reduce((s, sl) => s + (sl.profit || 0), 0))})
              </span>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-right text-xs table-auto divide-y divide-slate-200 min-w-[650px]">
                <thead className="bg-slate-100 text-slate-700 font-black">
                  <tr>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">الزبون</th>
                    <th className="p-2.5">القطع المشتراة</th>
                    <th className="p-2.5 text-center">الكمية</th>
                    <th className="p-2.5 text-left">المبلغ الإجمالي</th>
                    <th className="p-2.5 text-left">المدفوع</th>
                    <th className="p-2.5 text-left">الكريدي</th>
                    <th className="p-2.5 text-left">الربح الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {searchedSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-slate-400 font-bold">
                        لا توجد مبيعات مسجلة في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    searchedSales.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/80">
                        <td className="p-2 font-mono text-slate-600 text-[11px]">{s.date?.slice(0, 10)}</td>
                        <td className="p-2 font-bold text-slate-900">{s.customerName || 'زبون عام'}</td>
                        <td className="p-2">
                          {s.items?.map((it, idx) => (
                            <span key={idx} className="block text-[11px] text-slate-700">
                              • {it.name} ({it.size || '-'}) × {it.qty}
                            </span>
                          )) || '-'}
                        </td>
                        <td className="p-2 text-center font-bold font-mono">
                          {s.items?.reduce((q, it) => q + (it.qty || 1), 0) || 1}
                        </td>
                        <td className="p-2 text-left font-mono font-black text-slate-900">{renderMoney(s.totalAmount)}</td>
                        <td className="p-2 text-left font-mono font-bold text-blue-900">{renderMoney(s.paidAmount || 0)}</td>
                        <td className="p-2 text-left font-mono font-bold text-rose-600">{renderMoney(s.debtAmount || 0)}</td>
                        <td className="p-2 text-left font-mono font-black text-emerald-700">{renderMoney(s.profit || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. EXPENSES REPORT TABLE (Visible in Overview or Expenses Tab) */}
        {(activeTab === 'overview_all' || activeTab === 'expenses') && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-rose-600" />
                <span>3. تقرير المصاريف والتشغيل والغسيل ({searchedExpenses.length} قيد)</span>
              </h3>
              <span className="text-xs font-bold text-rose-800">
                المجموع: {renderMoney(searchedExpenses.reduce((s, e) => s + Number(e.amount || 0), 0))}
              </span>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-right text-xs table-auto divide-y divide-slate-200 min-w-[600px]">
                <thead className="bg-slate-100 text-slate-700 font-black">
                  <tr>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">التصنيف</th>
                    <th className="p-2.5">البيان والتفاصيل</th>
                    <th className="p-2.5">المورد / الجهة</th>
                    <th className="p-2.5 text-left">المبلغ المصروف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {searchedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 font-bold">
                        لا توجد مصاريف مسجلة في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    searchedExpenses.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50/80">
                        <td className="p-2 font-mono text-slate-600 text-[11px]">{e.date?.slice(0, 10)}</td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800">
                            {e.category}
                          </span>
                        </td>
                        <td className="p-2 font-bold text-slate-800">{e.desc}</td>
                        <td className="p-2 text-slate-600">{e.supplierName || '-'}</td>
                        <td className="p-2 text-left font-mono font-black text-rose-700">{renderMoney(e.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. TAILORING REPORT TABLE (Visible in Overview or Tailoring Tab) */}
        {(activeTab === 'overview_all' || activeTab === 'tailoring') && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-purple-600" />
                <span>4. تقرير طلبات الخياطة والتعديل ({searchedTailoring.length} طلب)</span>
              </h3>
              <span className="text-xs font-bold text-purple-900">
                المقبوض: {renderMoney(metrics.totalTailoringRevenue)}
              </span>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-right text-xs table-auto divide-y divide-slate-200 min-w-[650px]">
                <thead className="bg-slate-100 text-slate-700 font-black">
                  <tr>
                    <th className="p-2.5">رقم الطلب</th>
                    <th className="p-2.5">القطعة والخدمة</th>
                    <th className="p-2.5">الزبون / الخياطة</th>
                    <th className="p-2.5">تاريخ التسليم</th>
                    <th className="p-2.5 text-center">الحالة</th>
                    <th className="p-2.5 text-left">السعر الإجمالي</th>
                    <th className="p-2.5 text-left">المدفوع</th>
                    <th className="p-2.5 text-left">المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {searchedTailoring.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-slate-400 font-bold">
                        لا توجد طلبات خياطة مسجلة في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    searchedTailoring.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/80">
                        <td className="p-2 font-mono text-slate-600 text-[11px]">#{o.orderNumber}</td>
                        <td className="p-2 font-bold text-slate-900">
                          <div>{o.itemName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{o.description || o.serviceType}</div>
                        </td>
                        <td className="p-2">
                          <div className="font-bold text-slate-800">{o.customerName || 'داخلي'}</div>
                          <div className="text-[10px] text-slate-500">الخياطة: {o.tailorName || '-'}</div>
                        </td>
                        <td className="p-2 font-mono text-[11px] text-slate-700">{o.expectedDeliveryDate}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            o.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                            o.status === 'ready' ? 'bg-blue-100 text-blue-800' :
                            o.status === 'in_progress' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {o.status === 'delivered' ? 'تم التسليم' :
                             o.status === 'ready' ? 'جاهز' :
                             o.status === 'in_progress' ? 'قيد التنفيذ' : 'معلق'}
                          </span>
                        </td>
                        <td className="p-2 text-left font-mono font-bold text-slate-800">{renderMoney(o.price)}</td>
                        <td className="p-2 text-left font-mono font-black text-blue-900">{renderMoney(o.paidAmount || 0)}</td>
                        <td className="p-2 text-left font-mono font-bold text-rose-600">{renderMoney(o.remainingAmount || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. CREDITS REPORT TABLE (Visible in Overview or Credits Tab) */}
        {(activeTab === 'overview_all' || activeTab === 'credits') && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <span>5. تقرير الديون والمستحقات ({searchedCredits.length} قيد)</span>
              </h3>
              <span className="text-xs font-bold text-amber-800">
                ديون الزبائن: {renderMoney(metrics.totalCustomerCredits)} • ديون الموردين: {renderMoney(metrics.totalSupplierDebts)}
              </span>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-right text-xs table-auto divide-y divide-slate-200 min-w-[600px]">
                <thead className="bg-slate-100 text-slate-700 font-black">
                  <tr>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">الاسم والجهة</th>
                    <th className="p-2.5">الهاتف</th>
                    <th className="p-2.5">النوع والتفاصيل</th>
                    <th className="p-2.5 text-left">مبلغ الدين المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {searchedCredits.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 font-bold">
                        لا توجد ديون مسجلة في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    searchedCredits.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/80">
                        <td className="p-2 font-mono text-slate-600 text-[11px]">{c.date?.slice(0, 10)}</td>
                        <td className="p-2 font-bold text-slate-900">
                          {c.name}
                          {c.supplierDebt && <span className="mr-1 text-[10px] text-amber-600 font-bold">(مورد)</span>}
                        </td>
                        <td className="p-2 font-mono text-slate-500">{c.phone || '-'}</td>
                        <td className="p-2 text-slate-700">{c.desc || c.type}</td>
                        <td className="p-2 text-left font-mono font-black text-rose-600">{renderMoney(c.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. STAFF PAYOUTS TABLE (Visible in Overview or Staff Tab) */}
        {(activeTab === 'overview_all' || activeTab === 'staff') && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-600" />
                <span>6. تقرير أجور ومسحوبات العمال ({searchedStaff.length} دفعة)</span>
              </h3>
              <span className="text-xs font-bold text-violet-900">
                المجموع المدفوع: {renderMoney(metrics.totalStaffPayouts)}
              </span>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-right text-xs table-auto divide-y divide-slate-200 min-w-[600px]">
                <thead className="bg-slate-100 text-slate-700 font-black">
                  <tr>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">اسم الموظف</th>
                    <th className="p-2.5">نوع الدفعة</th>
                    <th className="p-2.5">الخصومات / المكافآت</th>
                    <th className="p-2.5">ملاحظات</th>
                    <th className="p-2.5 text-left">المبلغ الصافي المدفوع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {searchedStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400 font-bold">
                        لا توجد دفعات رواتب مسجلة في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    searchedStaff.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="p-2 font-mono text-slate-600 text-[11px]">{p.date?.slice(0, 10)}</td>
                        <td className="p-2 font-bold text-slate-900">{p.name}</td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800">
                            {p.type || 'راتب'}
                          </span>
                        </td>
                        <td className="p-2 text-slate-600 text-[11px]">
                          {p.absenceDeduction ? `خصم غياب: ${renderMoney(p.absenceDeduction)} ` : ''}
                          {p.advancesDeduction ? `تسديد تسبيق: ${renderMoney(p.advancesDeduction)} ` : ''}
                          {p.bonus ? `مكافأة: ${renderMoney(p.bonus)}` : ''}
                          {!p.absenceDeduction && !p.advancesDeduction && !p.bonus ? '-' : ''}
                        </td>
                        <td className="p-2 text-slate-500 text-[11px]">{p.notes || '-'}</td>
                        <td className="p-2 text-left font-mono font-black text-rose-700">{renderMoney(p.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. INVENTORY VALUATION TABLE (Visible in Overview or Inventory Tab) */}
        {(activeTab === 'overview_all' || activeTab === 'inventory') && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span>7. تقرير جرد وتقييم المخزون ورأس المال ({searchedClothes.length} موديل)</span>
              </h3>
              <span className="text-xs font-bold text-slate-900">
                رأس المال في المخزون: {renderMoney(metrics.totalStockBuyCost)}
              </span>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-right text-xs table-auto divide-y divide-slate-200 min-w-[650px]">
                <thead className="bg-slate-100 text-slate-700 font-black">
                  <tr>
                    <th className="p-2.5">الموديل / الفستان</th>
                    <th className="p-2.5">الباركود والتصنيف</th>
                    <th className="p-2.5 text-center">المقاس / اللون</th>
                    <th className="p-2.5 text-center">المتوفر / الكلي</th>
                    <th className="p-2.5 text-left">سعر الشراء</th>
                    <th className="p-2.5 text-left">سعر الكراء</th>
                    <th className="p-2.5 text-left">سعر البيع</th>
                    <th className="p-2.5 text-left">إجمالي رأس المال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {searchedClothes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-slate-400 font-bold">
                        لا توجد قطع ملابس مطابقة
                      </td>
                    </tr>
                  ) : (
                    searchedClothes.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/80">
                        <td className="p-2 font-black text-slate-900">{c.name}</td>
                        <td className="p-2">
                          <div className="font-mono text-[11px] text-slate-500">#{c.barcode}</div>
                          <div className="text-[10px] text-slate-400">{c.category}</div>
                        </td>
                        <td className="p-2 text-center font-bold text-slate-700">
                          {c.size} • {c.color}
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-blue-900">
                          {c.stock - (c.rentedCount || 0)} / {c.stock}
                        </td>
                        <td className="p-2 text-left font-mono font-bold text-slate-700">{renderMoney(c.buyCost)}</td>
                        <td className="p-2 text-left font-mono font-bold text-blue-800">{renderMoney(c.rentPrice)}</td>
                        <td className="p-2 text-left font-mono font-bold text-slate-900">{renderMoney(c.sellPrice)}</td>
                        <td className="p-2 text-left font-mono font-black text-slate-900">
                          {renderMoney((c.buyCost || 0) * (c.stock || 0))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Official Footer */}
        <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between sm:items-center gap-1 text-[11px] text-slate-400 font-medium">
          <span>بوتيك مانجر برو - نظام إدارة وتأجير الملابس والأزياء والمحاسبة</span>
          <span>صفحة التقرير الشامل والمفصل • تم توليد البيانات آلياً من قاعدة البيانات</span>
        </div>
      </div>
    </div>
  );
});
