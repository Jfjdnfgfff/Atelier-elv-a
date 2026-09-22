import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Scissors,
  ShoppingBag,
  Receipt,
  CreditCard,
  Users,
  TrendingUp,
  AlertTriangle,
  Scale,
  Eye,
  EyeOff,
  Plus,
  MessageCircle,
  Phone,
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarRange,
  Shirt,
} from 'lucide-react';
import { Rental, ClothItem, ViewType, MaintenanceOrder, DailyCaisseClosure, Sale, Expense, StaffPayout, Credit } from '../types';
import { StatCard } from './Shared';
import { useDashboardStats } from '../hooks/dashboardStatsHook';

interface DashboardViewProps {
  rentals: Rental[];
  maintenanceOrders?: MaintenanceOrder[];
  clothes: ClothItem[];
  caisseClosures?: DailyCaisseClosure[];
  sales?: Sale[];
  expenses?: Expense[];
  staffPayouts?: StaffPayout[];
  credits?: Credit[];
  hideFinances: boolean;
  onPrivacyToggle: () => void;
  onNavigate: (view: ViewType) => void;
  onOpenAddRental: () => void;
  onOpenReturnModal: (rental: Rental) => void;
  onSendMessage: (rental: Rental) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = React.memo(({
  rentals,
  maintenanceOrders = [],
  clothes,
  caisseClosures = [],
  sales = [],
  expenses = [],
  staffPayouts = [],
  credits = [],
  hideFinances,
  onPrivacyToggle,
  onNavigate,
  onOpenAddRental,
  onOpenReturnModal,
  onSendMessage
}) => {
  const [financePeriod, setFinancePeriod] = useState<'monthly' | 'yearly' | 'all'>('monthly');
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Use the optimized stats hook
  const stats = useDashboardStats(rentals, sales, expenses, credits, staffPayouts, maintenanceOrders);

  const calculateDaysDiff = (expectedDate: string) => {
    const exp = new Date(expectedDate);
    const now = new Date(today);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Urgent rentals: Overdue or due today (only for active rentals)
  const urgentRentals = useMemo(() => {
    return rentals.filter(r => {
      if (r.status !== 'active') return false;
      const exp = new Date(r.expectedReturnDate);
      const now = new Date(today);
      return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 0;
    });
  }, [rentals, today]);

  // Tailoring due within 10 days
  const urgentTailoringOrders = useMemo(() => {
    return maintenanceOrders.filter(o => {
      if (o.status === 'delivered') return false;
      const exp = new Date(o.expectedDeliveryDate);
      const now = new Date(today);
      return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 10;
    });
  }, [maintenanceOrders, today]);

  const activeRentals = useMemo(() => rentals.filter(r => r.status === 'active'), [rentals]);
  const reservedRentals = useMemo(() => rentals.filter(r => r.status === 'reserved'), [rentals]);

  // Values based on selected period
  const currentRentalIncome = financePeriod === 'monthly' 
    ? (stats.monthlyRentalIncome || 0) 
    : financePeriod === 'yearly' 
    ? (stats.yearlyRentalIncome || 0) 
    : (stats.totalRentalIncome || 0);

  const currentSalesRevenue = financePeriod === 'monthly'
    ? (stats.monthlySalesRevenue || 0)
    : financePeriod === 'yearly'
    ? (stats.yearlySalesRevenue || 0)
    : (stats.totalSalesRevenue || 0);

  const currentTailoringIncome = financePeriod === 'monthly'
    ? (stats.monthlyTailoringIncome || 0)
    : financePeriod === 'yearly'
    ? (stats.yearlyTailoringIncome || 0)
    : (stats.totalTailoringIncome || 0);

  const currentExpenses = financePeriod === 'monthly'
    ? (stats.monthlyExpenses || 0)
    : financePeriod === 'yearly'
    ? (stats.yearlyExpenses || 0)
    : (stats.totalExpenses || 0);

  const currentStaffPayouts = financePeriod === 'monthly'
    ? (stats.monthlyStaffPayouts || 0)
    : financePeriod === 'yearly'
    ? (stats.yearlyStaffPayouts || 0)
    : (stats.totalStaffPayouts || 0);

  const currentGrossRevenue = currentRentalIncome + currentSalesRevenue + currentTailoringIncome;
  const currentNetProfit = financePeriod === 'monthly'
    ? (stats.monthlyNetProfit || 0)
    : financePeriod === 'yearly'
    ? (stats.yearlyNetProfit || 0)
    : (stats.netProfit || 0);

  // Today's Caisse calculations for dashboard banner
  const { todayIncome, todayExpectedCash, todayClosure, monthVariance } = useMemo(() => {
    const todaySales = sales.filter(s => s.date && s.date.startsWith(today)).reduce((sum, s) => sum + (s.paidAmount !== undefined ? s.paidAmount : s.totalAmount || 0), 0);
    const todayRentals = rentals.filter(r => (r.createdAt && r.createdAt.startsWith(today)) || (r.startDate && r.startDate.startsWith(today))).reduce((sum, r) => sum + (r.paidAmount || 0), 0);
    const todayTailoring = maintenanceOrders.filter(o => (o.receivedDate && o.receivedDate.startsWith(today)) || (o.createdAt && o.createdAt.startsWith(today))).reduce((sum, o) => sum + (o.paidAmount || 0), 0);
    const todayExp = expenses.filter(e => e.date && e.date.startsWith(today)).reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const todayStf = staffPayouts.filter(p => p.date && p.date.startsWith(today)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const inc = todaySales + todayRentals + todayTailoring;
    const expCash = inc - (todayExp + todayStf);

    const closure = caisseClosures.find(c => c.date === today);
    const currentMonth = today.substring(0, 7);
    const mClosures = caisseClosures.filter(c => c.date.startsWith(currentMonth));
    const mVariance = mClosures.reduce((s, c) => s + (c.difference || 0), 0);

    return {
      todayIncome: inc,
      todayExpectedCash: expCash,
      todayClosure: closure,
      monthVariance: mVariance
    };
  }, [sales, rentals, maintenanceOrders, expenses, staffPayouts, caisseClosures, today]);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6" dir="rtl">
      {/* Top Welcome & Controls Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              لوحة التحكم والمداخيل الرئيسية
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            متابعة شاملة لمداخيل الكراء، الخياطة الشهرية والسنوية، مبيعات الملابس، وصافي الأرباح.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Period Selector Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setFinancePeriod('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                financePeriod === 'monthly' ? 'bg-slate-900 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setFinancePeriod('yearly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                financePeriod === 'yearly' ? 'bg-slate-900 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              هذه السنة
            </button>
            <button
              onClick={() => setFinancePeriod('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                financePeriod === 'all' ? 'bg-slate-900 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الإجمالي
            </button>
          </div>

          <button
            onClick={onPrivacyToggle}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[36px] active:scale-95 ${
              hideFinances 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-2xs'
            }`}
            title={hideFinances ? 'إظهار الأرقام' : 'إخفاء الأرقام'}
          >
            {hideFinances ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{hideFinances ? 'إظهار' : 'إخفاء'}</span>
          </button>

          <button
            onClick={onOpenAddRental}
            className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs min-h-[36px] active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>كراء جديد</span>
          </button>
        </div>
      </div>

      {/* Daily Cash Register & Shortage Monitoring Banner (La Caisse du Jour) */}
      <div className="bg-white text-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm border border-slate-200/60">
              <Scale className="w-4 h-4 text-slate-700" />
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              صندوق اليومية ومتابعة العجز (La Caisse)
            </h3>
            {todayClosure ? (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                تم إقفال صندوق اليوم
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                الصندوق قيد النشاط
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-normal">
            متابعة إجمالي مدخول اليوم وتسجيل المبلغ الفعلي في الدرج لاحتساب فارق وعجز الصندوق (اليوم، الشهر، والسنة)
          </p>
        </div>

        {/* 3 Quick stats and CTA button */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 text-center min-w-[95px]">
            <div className="text-[10px] text-slate-500 font-medium">مدخول اليوم:</div>
            <div className="text-sm font-bold text-slate-900 font-mono">
              {hideFinances ? '••••' : `${todayIncome.toLocaleString()} دج`}
            </div>
          </div>

          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 text-center min-w-[105px]">
            <div className="text-[10px] text-slate-500 font-medium">
              {todayClosure ? 'فارق اليوم:' : 'المتوقع في الدرج:'}
            </div>
            <div className={`text-sm font-bold font-mono ${
              todayClosure ? (todayClosure.difference < 0 ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-900'
            }`}>
              {hideFinances ? '••••' : (
                todayClosure ? (
                  todayClosure.difference > 0 ? `+${todayClosure.difference.toLocaleString()} دج` : `${todayClosure.difference.toLocaleString()} دج`
                ) : `${todayExpectedCash.toLocaleString()} دج`
              )}
            </div>
          </div>

          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 text-center min-w-[105px]">
            <div className="text-[10px] text-slate-500 font-medium">عجز/فارق الشهر:</div>
            <div className={`text-sm font-bold font-mono ${
              monthVariance < 0 ? 'text-rose-600' : monthVariance > 0 ? 'text-emerald-600' : 'text-slate-900'
            }`}>
              {hideFinances ? '••••' : (
                monthVariance > 0 ? `+${monthVariance.toLocaleString()} دج` : `${monthVariance.toLocaleString()} دج`
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('caisse')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>فتح الصندوق</span>
          </button>
        </div>
      </div>

      {/* Main Income & Financial StatCards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. مداخيل الكراء والتأجير */}
        <StatCard
          title="مداخيل الكراء والتأجير"
          value={currentRentalIncome}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => onNavigate('rentals')}
          icon={<Sparkles className="w-4 h-4 text-slate-700" />}
        />

        {/* 2. مداخيل الخياطة الشهرية */}
        <StatCard
          title="مداخيل الخياطة الشهرية"
          value={stats.monthlyTailoringIncome || 0}
          subtitle="هذا الشهر"
          hideValue={hideFinances}
          onClick={() => onNavigate('tailoring')}
          icon={<Scissors className="w-4 h-4 text-slate-700" />}
        />

        {/* 3. مداخيل الخياطة السنوية */}
        <StatCard
          title="مداخيل الخياطة السنوية"
          value={stats.yearlyTailoringIncome || 0}
          subtitle="هذه السنة"
          hideValue={hideFinances}
          onClick={() => onNavigate('tailoring')}
          icon={<Scissors className="w-4 h-4 text-slate-700" />}
        />

        {/* 4. مداخيل مبيعات الملابس */}
        <StatCard
          title="مبيعات الملابس (الكاشير)"
          value={currentSalesRevenue}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => onNavigate('sales')}
          icon={<ShoppingBag className="w-4 h-4 text-slate-700" />}
        />

        {/* 5. المصاريف والغسيل */}
        <StatCard
          title="المصاريف والغسيل (Pressing)"
          value={currentExpenses}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => onNavigate('expenses')}
          icon={<Receipt className="w-4 h-4 text-slate-700" />}
        />

        {/* 6. الديون والكريدي المتبقي */}
        <StatCard
          title="الكريدي والديون المتبقية"
          value={stats.totalDebt}
          subtitle="متبقي على الزبائن"
          hideValue={hideFinances}
          onClick={() => onNavigate('credits')}
          icon={<CreditCard className="w-4 h-4 text-slate-700" />}
        />

        {/* 7. رواتب ومستحقات العمال */}
        <StatCard
          title="رواتب ومسحوبات العمال"
          value={currentStaffPayouts}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => onNavigate('customers')}
          icon={<Users className="w-4 h-4 text-slate-700" />}
        />

        {/* 8. صافي الأرباح الكلية */}
        <StatCard
          title="صافي الأرباح الصافية"
          value={currentNetProfit}
          subtitle="بعد كل التكاليف"
          hideValue={hideFinances}
          onClick={() => onNavigate('dashboard')}
          icon={<TrendingUp className="w-4 h-4 text-slate-700" />}
        />
      </div>

      {/* التفصيل المالي الدقيق لكل نشاط (كراء، بيع، خياطة) شهرياً وسنوياً */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                <BarChart3 className="w-4 h-4 text-slate-700" />
              </span>
              <span>التقرير المالي المفصل للأنشطة الثلاثة (الأرباح والمصاريف الشهرية والسنوية)</span>
            </h3>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              متابعة دقيقة لأرباح ومصاريف كل قسم على حدة (كراء فساتين، بيع فساتين، وخياطة وتفصيل).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. نشاط كراء الفساتين */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shadow-2xs">
                  <Shirt className="w-4 h-4 text-slate-700" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">نشاط كراء وتأجير الفساتين</h4>
                  <span className="text-[10px] text-slate-500 font-medium">Rentals & Locations</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('rentals')}
                className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                عرض القسم ←
              </button>
            </div>

            {/* Monthly Rentals */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>أرباح ومصاريف هذا الشهر:</span>
                </span>
                <span className="font-medium text-slate-500">{today.substring(0, 7)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مداخيل الكراء</span>
                  <span className="font-bold text-slate-900 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.monthlyRentalIncome || 0).toLocaleString()} دج`}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مصاريف وغسيل الكراء</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.monthlyRentalExpenses || 0).toLocaleString()} دج`}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center bg-slate-900 text-white p-2.5 rounded-lg text-xs font-semibold shadow-xs">
                <span>الربح الشهري الصافي:</span>
                <span className="font-mono text-white font-bold">
                  {hideFinances ? '••••' : `${((stats.monthlyRentalIncome || 0) - (stats.monthlyRentalExpenses || 0)).toLocaleString()} دج`}
                </span>
              </div>
            </div>

            {/* Yearly Rentals */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <CalendarRange className="w-3.5 h-3.5 text-slate-500" />
                  <span>أرباح ومصاريف هذه السنة:</span>
                </span>
                <span className="font-medium text-slate-500">{today.substring(0, 4)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مداخيل الكراء السنوية</span>
                  <span className="font-bold text-slate-900 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.yearlyRentalIncome || 0).toLocaleString()} دج`}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مصاريف الكراء السنوية</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.yearlyRentalExpenses || 0).toLocaleString()} دج`}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center bg-slate-900 text-white p-2.5 rounded-lg text-xs font-semibold shadow-xs">
                <span>الربح السنوي الصافي:</span>
                <span className="font-mono text-white font-bold">
                  {hideFinances ? '••••' : `${((stats.yearlyRentalIncome || 0) - (stats.yearlyRentalExpenses || 0)).toLocaleString()} دج`}
                </span>
              </div>
            </div>
          </div>

          {/* 2. نشاط بيع الفساتين والملابس */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shadow-2xs">
                  <ShoppingBag className="w-4 h-4 text-slate-700" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">نشاط بيع الملابس والفساتين</h4>
                  <span className="text-[10px] text-slate-500 font-medium">Ventes & Prêt-à-porter</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('sales')}
                className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                عرض القسم ←
              </button>
            </div>

            {/* Monthly Sales */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>مبيعات ومصاريف هذا الشهر:</span>
                </span>
                <span className="font-medium text-slate-500">{today.substring(0, 7)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مبيعات الملابس</span>
                  <span className="font-bold text-slate-900 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.monthlySalesRevenue || 0).toLocaleString()} دج`}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مصاريف وتكاليف البيع</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.monthlySalesExpenses || 0).toLocaleString()} دج`}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center bg-slate-900 text-white p-2.5 rounded-lg text-xs font-semibold shadow-xs">
                <span>الربح الشهري من البيع:</span>
                <span className="font-mono text-white font-bold">
                  {hideFinances ? '••••' : `${(stats.monthlySalesProfit || 0).toLocaleString()} دج`}
                </span>
              </div>
            </div>

            {/* Yearly Sales */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <CalendarRange className="w-3.5 h-3.5 text-slate-500" />
                  <span>مبيعات ومصاريف هذه السنة:</span>
                </span>
                <span className="font-medium text-slate-500">{today.substring(0, 4)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مبيعات الملابس السنوية</span>
                  <span className="font-bold text-slate-900 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.yearlySalesRevenue || 0).toLocaleString()} دج`}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مصاريف البيع السنوية</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.yearlySalesExpenses || 0).toLocaleString()} دج`}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center bg-slate-900 text-white p-2.5 rounded-lg text-xs font-semibold shadow-xs">
                <span>الربح السنوي من البيع:</span>
                <span className="font-mono text-white font-bold">
                  {hideFinances ? '••••' : `${(stats.yearlySalesProfit || 0).toLocaleString()} دج`}
                </span>
              </div>
            </div>
          </div>

          {/* 3. نشاط الخياطة والتفصيل والصيانة */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shadow-2xs">
                  <Scissors className="w-4 h-4 text-slate-700" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">نشاط الخياطة والتفصيل</h4>
                  <span className="text-[10px] text-slate-500 font-medium">Couture & Atelier</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('tailoring')}
                className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                عرض القسم ←
              </button>
            </div>

            {/* Monthly Tailoring */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>خياطة ومصاريف هذا الشهر:</span>
                </span>
                <span className="font-medium text-slate-500">{today.substring(0, 7)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مداخيل الخياطة</span>
                  <span className="font-bold text-slate-900 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.monthlyTailoringIncome || 0).toLocaleString()} دج`}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مصاريف وأقمشة الخياطة</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.monthlyTailoringExpenses || 0).toLocaleString()} دج`}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center bg-slate-900 text-white p-2.5 rounded-lg text-xs font-semibold shadow-xs">
                <span>الربح الشهري من الخياطة:</span>
                <span className="font-mono text-white font-bold">
                  {hideFinances ? '••••' : `${(stats.monthlyTailoringProfit || 0).toLocaleString()} دج`}
                </span>
              </div>
            </div>

            {/* Yearly Tailoring */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <CalendarRange className="w-3.5 h-3.5 text-slate-500" />
                  <span>خياطة ومصاريف هذه السنة:</span>
                </span>
                <span className="font-medium text-slate-500">{today.substring(0, 4)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مداخيل الخياطة السنوية</span>
                  <span className="font-bold text-slate-900 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.yearlyTailoringIncome || 0).toLocaleString()} دج`}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">مصاريف الخياطة السنوية</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">
                    {hideFinances ? '••••' : `${(stats.yearlyTailoringExpenses || 0).toLocaleString()} دج`}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center bg-slate-900 text-white p-2.5 rounded-lg text-xs font-semibold shadow-xs">
                <span>الربح السنوي من الخياطة:</span>
                <span className="font-mono text-white font-bold">
                  {hideFinances ? '••••' : `${(stats.yearlyTailoringProfit || 0).toLocaleString()} دج`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Urgent Returns Alert Banner */}
      {urgentRentals.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-amber-100 rounded-lg text-amber-900">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  تنبيهات إرجاع الملابس والمواعيد العاجلة ({urgentRentals.length})
                </h3>
                <p className="text-xs text-slate-600 font-normal">
                  قطع ملابس يجب استرجاعها اليوم أو متأخرة عن الموعد المحدد.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('rentals')}
              className="text-xs font-semibold text-slate-800 bg-white border border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
            >
              عرض قسم الكراء ←
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {urgentRentals.map(rental => {
              const diff = calculateDaysDiff(rental.expectedReturnDate);
              const isOverdue = diff < 0;
              const cloth = clothes.find(c => c.id === rental.itemId);

              return (
                <div key={rental.id} className="bg-white p-3.5 rounded-xl border border-slate-200/90 flex justify-between items-center text-xs gap-2 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {cloth?.imageUrl ? (
                      <img src={cloth.imageUrl} alt={rental.itemName} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{rental.itemName}</div>
                      <div className="text-slate-500 text-[11px] font-normal truncate flex items-center gap-1 mt-0.5">
                        <span>{rental.customerName}</span>
                        <span>(</span>
                        <Phone className="w-3 h-3 text-slate-400 inline" />
                        <span>{rental.customerPhone})</span>
                      </div>
                      <div className="text-[10px] font-semibold mt-1">
                        {isOverdue ? (
                          <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                            متأخر بـ {Math.abs(diff)} أيام عن الموعد
                          </span>
                        ) : (
                          <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100">
                            موعد الإرجاع اليوم!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => onOpenReturnModal(rental)}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95"
                    >
                      استرجاع
                    </button>
                    <button
                      onClick={() => onSendMessage(rental)}
                      className="bg-white text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-medium hover:bg-slate-50 flex items-center gap-1 shadow-2xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>واتساب</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Urgent Tailoring Orders Alert Banner (Within 10 Days) */}
      {urgentTailoringOrders.length > 0 && (
        <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-sky-100 rounded-lg text-sky-800">
                <Scissors className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  تنبيهات تسليم طلبات الخياطة والصيانة ({urgentTailoringOrders.length})
                </h3>
                <p className="text-xs text-slate-600 font-normal">
                  طلبات خياطة موعد تسليمها يقترب خلال 10 أيام أو اليوم.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('tailoring')}
              className="text-xs font-semibold text-slate-800 bg-white border border-sky-200 hover:bg-sky-50 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
            >
              عرض قسم الخياطة ←
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {urgentTailoringOrders.map(order => {
              const diff = calculateDaysDiff(order.expectedDeliveryDate);
              const isOverdue = diff < 0;

              return (
                <div key={order.id} className="bg-white p-3 rounded-xl border border-slate-200/90 flex justify-between items-center text-xs gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{order.orderNumber}</span>
                      <span className="font-bold text-slate-900 truncate">• {order.itemName}</span>
                    </div>
                    <div className="text-slate-500 text-[11px] font-normal mt-0.5 truncate">
                      {order.customerName ? `الزبونة: ${order.customerName}` : 'مخزن المحل'}
                      {order.tailorName && ` | الخياطة: ${order.tailorName}`}
                    </div>
                    <div className="text-[11px] font-semibold mt-1">
                      {isOverdue ? (
                        <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                          متأخر بـ {Math.abs(diff)} يوم!
                        </span>
                      ) : diff === 0 ? (
                        <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                          موعد التسليم اليوم!
                        </span>
                      ) : (
                        <span className="text-sky-700">
                          موعد التسليم: {order.expectedDeliveryDate} (متبقي {diff} أيام)
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate('tailoring')}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all shadow-xs"
                  >
                    متابعة
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Rentals Summary Table */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <span>القطع المؤجرة حالياً في المحل</span>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
              {activeRentals.length}
            </span>
          </h3>
          <button
            onClick={() => onNavigate('rentals')}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            عرض الكل ←
          </button>
        </div>

        {activeRentals.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">لا توجد أي قطع ملابس مؤجرة حالياً.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeRentals.slice(0, 5).map(rental => {
              const cloth = clothes.find(c => c.id === rental.itemId);
              return (
                <div key={rental.id} className="py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {cloth?.imageUrl ? (
                      <img src={cloth.imageUrl} alt={rental.itemName} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm sm:text-xs truncate">{rental.itemName}</div>
                      <div className="text-slate-500 text-[11px] font-normal mt-0.5 truncate">
                        الزبون: <span className="font-semibold text-slate-800">{rental.customerName}</span> • المقاس: {rental.itemSize} ({rental.itemColor})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
                    <div className="text-right sm:text-left">
                      <div className="font-semibold text-slate-800 text-xs">موعد الإرجاع: {rental.expectedReturnDate}</div>
                      <div className="text-[10px] text-slate-500 font-medium">العربون: {(rental.cautionAmount || 0).toLocaleString()} دج</div>
                    </div>
                    <button
                      onClick={() => onOpenReturnModal(rental)}
                      className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 px-3 py-1.5 rounded-xl font-semibold transition-all text-xs"
                    >
                      استرجاع
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
