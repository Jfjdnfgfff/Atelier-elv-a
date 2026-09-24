import React, { useState, useMemo, useCallback } from 'react';
import { AsyncProductImage } from './AsyncProductImage';
import { getListImage } from '../utils/imageUtils';
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
  History,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  Trash2,
  Filter,
  Search,
  PlusCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  FileText,
  RefreshCw,
  Tag,
  Package,
  ExternalLink,
  X
} from 'lucide-react';
import { 
  Rental, 
  ClothItem, 
  ViewType, 
  MaintenanceOrder, 
  DailyCaisseClosure, 
  Sale, 
  Expense, 
  StaffPayout, 
  Credit,
  ActivityLog,
  ActivityActionType,
  ActivityCategory
} from '../types';
import { StatCard, Modal } from './Shared';
import { useDashboardStats } from '../hooks/dashboardStatsHook';
import { verifyAdminPin, getAdminPin, setAdminPin } from '../utils/security';

interface DashboardViewProps {
  stats?: ReturnType<typeof useDashboardStats>;
  rentals: Rental[];
  maintenanceOrders?: MaintenanceOrder[];
  clothes: ClothItem[];
  caisseClosures?: DailyCaisseClosure[];
  sales?: Sale[];
  expenses?: Expense[];
  staffPayouts?: StaffPayout[];
  credits?: Credit[];
  activityLogs?: ActivityLog[];
  hideFinances: boolean;
  onPrivacyToggle: () => void;
  onNavigate: (view: ViewType) => void;
  onOpenAddRental: () => void;
  onOpenReturnModal: (rental: Rental) => void;
  onSendMessage: (rental: Rental) => void;
  onOpenStaffPayoutsModal?: () => void;
  onOpenFullReportModal?: () => void;
  onDeleteLog?: (id: string, passwordVerified: boolean) => void;
  onClearAllLogs?: (passwordVerified: boolean) => void;
  onAddManualLog?: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = React.memo(({
  stats: externalStats,
  rentals,
  maintenanceOrders = [],
  clothes,
  caisseClosures = [],
  sales = [],
  expenses = [],
  staffPayouts = [],
  credits = [],
  activityLogs = [],
  hideFinances,
  onPrivacyToggle,
  onNavigate,
  onOpenAddRental,
  onOpenReturnModal,
  onSendMessage,
  onOpenStaffPayoutsModal,
  onOpenFullReportModal,
  onDeleteLog,
  onClearAllLogs,
  onAddManualLog,
}) => {
  const [financePeriod, setFinancePeriod] = useState<'monthly' | 'yearly' | 'all'>('monthly');
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const internalStats = useDashboardStats(rentals, sales, expenses, credits, staffPayouts, maintenanceOrders);
  const stats = externalStats || internalStats;

  // ==========================
  // ACTIVITY LOGS STATE & PIN
  // ==========================
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logCategoryFilter, setLogCategoryFilter] = useState<ActivityCategory | 'all'>('all');
  const [logActionFilter, setLogActionFilter] = useState<ActivityActionType | 'all'>('all');
  const [visibleLogsCount, setVisibleLogsCount] = useState(12);

  // Security PIN Modal State
  const [pinModalOpen, setPinModalOpen] = useState<{ type: 'single' | 'all'; targetId?: string } | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPinText, setShowPinText] = useState(false);

  // Change PIN Modal State
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');

  // Add Manual Log State
  const [isAddManualLogOpen, setIsAddManualLogOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDetails, setManualDetails] = useState('');
  const [manualCategory, setManualCategory] = useState<ActivityCategory>('inventory');
  const [manualActionType, setManualActionType] = useState<ActivityActionType>('create');
  const [manualAmount, setManualAmount] = useState<number | undefined>(undefined);

  const handleVerifyPinAndExecute = useCallback(() => {
    if (verifyAdminPin(enteredPin)) {
      if (pinModalOpen?.type === 'single' && pinModalOpen.targetId) {
        onDeleteLog?.(pinModalOpen.targetId, true);
      } else if (pinModalOpen?.type === 'all') {
        onClearAllLogs?.(true);
      }
      setPinModalOpen(null);
      setEnteredPin('');
      setPinError('');
    } else {
      setPinError('كلمة المرور غير صحيحة! يرجى إدخال كلمة المرور الصحيحة لحذف السجل.');
    }
  }, [enteredPin, pinModalOpen, onDeleteLog, onClearAllLogs]);

  const handleChangePinSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setChangePinError('');
    setChangePinSuccess('');

    if (!verifyAdminPin(currentPinInput)) {
      setChangePinError('كلمة المرور الحالية غير صحيحة');
      return;
    }
    if (newPinInput.length < 4) {
      setChangePinError('كلمة المرور الجديدة يجب أن تتكون من 4 خانات على الأقل');
      return;
    }
    if (newPinInput !== confirmNewPinInput) {
      setChangePinError('كلمة المرور الجديدة غير متطابقة مع التأكيد');
      return;
    }

    setAdminPin(newPinInput);
    setChangePinSuccess('تم تغيير كلمة المرور بنجاح');
    setTimeout(() => {
      setIsChangePinOpen(false);
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmNewPinInput('');
      setChangePinSuccess('');
    }, 1200);
  }, [currentPinInput, newPinInput, confirmNewPinInput]);

  const handleSaveManualLog = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    onAddManualLog?.({
      actionType: manualActionType,
      category: manualCategory,
      title: manualTitle.trim(),
      details: manualDetails.trim() || undefined,
      amount: manualAmount ? Number(manualAmount) : undefined,
      user: 'المسؤول'
    });

    setIsAddManualLogOpen(false);
    setManualTitle('');
    setManualDetails('');
    setManualAmount(undefined);
  }, [manualTitle, manualDetails, manualCategory, manualActionType, manualAmount, onAddManualLog]);

  // Filtered Activity Logs
  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      const matchSearch =
        !logSearchTerm.trim() ||
        log.title.toLowerCase().includes(logSearchTerm.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(logSearchTerm.toLowerCase())) ||
        (log.user && log.user.toLowerCase().includes(logSearchTerm.toLowerCase()));

      const matchCat = logCategoryFilter === 'all' || log.category === logCategoryFilter;
      const matchAction = logActionFilter === 'all' || log.actionType === logActionFilter;

      return matchSearch && matchCat && matchAction;
    });
  }, [activityLogs, logSearchTerm, logCategoryFilter, logActionFilter]);

  const todayLogsCount = useMemo(() => {
    return activityLogs.filter(log => log.timestamp?.startsWith(today)).length;
  }, [activityLogs, today]);

  const formatLogTime = useCallback((isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const isToday = isoStr.startsWith(today);
      const timeStr = d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (isToday) return `اليوم ${timeStr}`;
      return `${d.toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' })} - ${timeStr}`;
    } catch {
      return isoStr;
    }
  }, [today]);

  const getActionBadge = useCallback((action: ActivityActionType) => {
    switch (action) {
      case 'create':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">إضافة</span>;
      case 'update':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">تعديل</span>;
      case 'delete':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">حذف</span>;
      case 'deal':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">صفقة</span>;
      case 'return':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">استرجاع</span>;
      case 'payment':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">تسديد / سحب</span>;
      case 'closure':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">إغلاق صندوق</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">نشاط</span>;
    }
  }, []);

  const getCategoryLabel = useCallback((cat: ActivityCategory) => {
    switch (cat) {
      case 'inventory': return 'المخزون';
      case 'rentals': return 'الكراء والحجوزات';
      case 'sales': return 'المبيعات';
      case 'tailoring': return 'الخياطة';
      case 'expenses': return 'المصاريف';
      case 'credits': return 'الديون';
      case 'caisse': return 'الصندوق';
      case 'staff': return 'العمال';
      case 'partners': return 'الشركاء';
      default: return 'عام';
    }
  }, []);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/70 p-4 sm:p-5 rounded-2xl border border-blue-100 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              لوحة التحكم والمداخيل الرئيسية
            </h2>
          </div>
          <p className="text-xs text-slate-600 font-normal mt-1 mr-10">
            متابعة شاملة لمداخيل الكراء، الخياطة الشهرية والسنوية، مبيعات الملابس، وصافي الأرباح.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Period Selector Toggle */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl text-xs font-medium border border-slate-200/60">
            <button
              onClick={() => setFinancePeriod('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                financePeriod === 'monthly' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-blue-700'
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setFinancePeriod('yearly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                financePeriod === 'yearly' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-blue-700'
              }`}
            >
              هذه السنة
            </button>
            <button
              onClick={() => setFinancePeriod('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                financePeriod === 'all' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-blue-700'
              }`}
            >
              الإجمالي
            </button>
          </div>

          <button
            onClick={onPrivacyToggle}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[36px] active:scale-95 border ${
              hideFinances 
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-2xs hover:text-blue-700'
            }`}
            title={hideFinances ? 'إظهار الأرقام' : 'إخفاء الأرقام'}
          >
            {hideFinances ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{hideFinances ? 'إظهار' : 'إخفاء'}</span>
          </button>

          <button
            onClick={onOpenAddRental}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md hover:shadow-blue-500/20 min-h-[36px] active:scale-95"
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
          iconBg="bg-sky-100 text-sky-700"
          icon={<Sparkles className="w-4 h-4 text-sky-700" />}
        />

        {/* 2. مداخيل الخياطة الشهرية */}
        <StatCard
          title="مداخيل الخياطة الشهرية"
          value={stats.monthlyTailoringIncome || 0}
          subtitle="هذا الشهر"
          hideValue={hideFinances}
          onClick={() => onNavigate('tailoring')}
          iconBg="bg-purple-100 text-purple-700"
          icon={<Scissors className="w-4 h-4 text-purple-700" />}
        />

        {/* 3. مداخيل الخياطة السنوية */}
        <StatCard
          title="مداخيل الخياطة السنوية"
          value={stats.yearlyTailoringIncome || 0}
          subtitle="هذه السنة"
          hideValue={hideFinances}
          onClick={() => onNavigate('tailoring')}
          iconBg="bg-purple-100 text-purple-700"
          icon={<Scissors className="w-4 h-4 text-purple-700" />}
        />

        {/* 4. مداخيل مبيعات الملابس */}
        <StatCard
          title="مبيعات الملابس (الكاشير)"
          value={currentSalesRevenue}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => onNavigate('sales')}
          iconBg="bg-emerald-100 text-emerald-700"
          icon={<ShoppingBag className="w-4 h-4 text-emerald-700" />}
        />

        {/* 5. المصاريف والغسيل */}
        <StatCard
          title="المصاريف والغسيل (Pressing)"
          value={currentExpenses}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => onNavigate('expenses')}
          iconBg="bg-rose-100 text-rose-700"
          icon={<Receipt className="w-4 h-4 text-rose-700" />}
        />

        {/* 6. الديون والكريدي المتبقي */}
        <StatCard
          title="الكريدي والديون المتبقية"
          value={stats.totalDebt}
          subtitle="متبقي على الزبائن"
          hideValue={hideFinances}
          onClick={() => onNavigate('credits')}
          iconBg="bg-amber-100 text-amber-700"
          icon={<CreditCard className="w-4 h-4 text-amber-700" />}
        />

        {/* 7. رواتب ومستحقات العمال */}
        <StatCard
          title="رواتب ومسحوبات العمال"
          value={currentStaffPayouts}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => {
            if (onOpenStaffPayoutsModal) {
              onOpenStaffPayoutsModal();
            } else {
              onNavigate('customers');
            }
          }}
          iconBg="bg-violet-100 text-violet-700"
          icon={<Users className="w-4 h-4 text-violet-700" />}
        />

        {/* 8. صافي الأرباح الكلية */}
        <StatCard
          title="صافي الأرباح الصافية"
          value={currentNetProfit}
          subtitle="بعد كل التكاليف"
          hideValue={hideFinances}
          onClick={() => {
            if (onOpenFullReportModal) {
              onOpenFullReportModal();
            } else {
              onNavigate('caisse');
            }
          }}
          iconBg="bg-blue-100 text-blue-700"
          icon={<TrendingUp className="w-4 h-4 text-blue-700" />}
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
                    {cloth && (getListImage(cloth) || cloth.imageUrl) ? (
                      <AsyncProductImage item={cloth} mode="thumb" className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 shrink-0 p-0.5" />
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
                    {cloth && (getListImage(cloth) || cloth.imageUrl) ? (
                      <AsyncProductImage item={cloth} mode="thumb" className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 shrink-0 p-0.5" />
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

      {/* ========================================================================= */}
      {/* ACTIVITY LOG SECTION (سجل العمليات والنشاطات الشامل والمحمي بكلمة مرور) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs mt-6 space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base sm:text-lg">سجل العمليات والنشاطات المباشر</h3>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {activityLogs.length} سجل
                </span>
                {todayLogsCount > 0 && (
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {todayLogsCount} اليوم
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                توثيق فوري لكافة الإضافات، التعديلات، الحذف والعمليات المالية في البوتيك (محمي بكلمة مرور)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsChangePinOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
              title="تغيير كلمة مرور حذف السجلات"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>كلمة المرور</span>
            </button>

            <button
              onClick={() => setIsAddManualLogOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>إضافة ملاحظة / قيد</span>
            </button>

            <button
              onClick={() => onNavigate('logs')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all"
            >
              <span>عرض موسع</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 pt-1">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث في السجل عن اسم قطعة، زبون، نوع العملية أو التفاصيل..."
              value={logSearchTerm}
              onChange={e => setLogSearchTerm(e.target.value)}
              className="w-full pl-8 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
            {logSearchTerm && (
              <button
                onClick={() => setLogSearchTerm('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Filter */}
          <div className="shrink-0 flex items-center gap-2">
            <select
              value={logActionFilter}
              onChange={e => setLogActionFilter(e.target.value as any)}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">كافة أنواع العمليات</option>
              <option value="create">إضافة (+)</option>
              <option value="update">تعديل (✎)</option>
              <option value="delete">حذف (✕)</option>
              <option value="deal">صفقة (✓)</option>
              <option value="return">استرجاع (↶)</option>
              <option value="payment">تسديد / سحب</option>
              <option value="closure">إغلاق صندوق</option>
            </select>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'inventory', label: 'المخزون' },
            { id: 'rentals', label: 'الكراء والحجوزات' },
            { id: 'sales', label: 'المبيعات' },
            { id: 'tailoring', label: 'الخياطة والصيانة' },
            { id: 'expenses', label: 'المصاريف' },
            { id: 'credits', label: 'الديون' },
            { id: 'caisse', label: 'الصندوق' },
            { id: 'staff', label: 'العمال' },
            { id: 'partners', label: 'الشركاء' },
          ].map(cat => {
            const isSelected = logCategoryFilter === cat.id;
            const count = cat.id === 'all'
              ? activityLogs.length
              : activityLogs.filter(l => l.category === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => setLogCategoryFilter(cat.id as any)}
                className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Logs List Table / Cards */}
        {filteredLogs.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
            <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">لا توجد عمليات مسجلة تطابق التصفية</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {activityLogs.length === 0 ? 'سيتم تسجيل أي إضافة أو تعديل أو حذف في النظام تلقائياً هنا.' : 'جرب تغيير شروط البحث أو التصفية أعلاه.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
            {filteredLogs.slice(0, visibleLogsCount).map(log => {
              return (
                <div
                  key={log.id}
                  className="py-3 px-2.5 rounded-xl hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row justify-between sm:items-start gap-2.5 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {getActionBadge(log.actionType)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {log.title}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md">
                          {getCategoryLabel(log.category)}
                        </span>
                        {log.amount !== undefined && (
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            {log.amount.toLocaleString()} دج
                          </span>
                        )}
                      </div>

                      {log.details && (
                        <p className="text-xs text-slate-600 font-normal mt-1 leading-relaxed break-words">
                          {log.details}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatLogTime(log.timestamp)}
                        </span>
                        <span>•</span>
                        <span>بواسطة: <strong className="text-slate-600 font-semibold">{log.user || 'المسؤول'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Lock Protected Delete Log Button */}
                  <div className="flex items-center justify-end shrink-0 pt-1 sm:pt-0">
                    <button
                      onClick={() => {
                        setEnteredPin('');
                        setPinError('');
                        setPinModalOpen({ type: 'single', targetId: log.id });
                      }}
                      className="opacity-80 sm:opacity-40 group-hover:opacity-100 hover:opacity-100 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 p-1.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-semibold"
                      title="حذف هذا السجل (محمي برمز سري)"
                    >
                      <Lock className="w-3 h-3 text-slate-400" />
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">حذف السجل</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More / Footer Actions */}
        {filteredLogs.length > visibleLogsCount && (
          <div className="pt-2 text-center border-t border-slate-100">
            <button
              onClick={() => setVisibleLogsCount(prev => prev + 15)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/70 px-4 py-2 rounded-xl transition-all"
            >
              عرض المزيد من السجلات ({filteredLogs.length - visibleLogsCount} متبقية) ↓
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SECURITY PIN VERIFICATION (حذف سجل محمي بكلمة مرور) */}
      {/* ========================================================================= */}
      {pinModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setPinModalOpen(null);
            setEnteredPin('');
            setPinError('');
          }}
          title={pinModalOpen.type === 'all' ? 'تأكيد تفريغ كامل السجل بكلمة المرور' : 'تأكيد حذف السجل بكلمة المرور'}
        >
          <div className="space-y-4 text-right">
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">منطقة أمان مشددة</p>
                <p className="text-amber-700 mt-0.5">
                  {pinModalOpen.type === 'all'
                    ? 'أنت على وشك مسح كامل سجل النشاطات والعمليات. أدخل كلمة المرور للتأكيد.'
                    : 'لا يمكن حذف أي قيد من السجل إلا بعد إدخال كلمة المرور الخاصة بالإدارة.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                أدخل كلمة المرور / الرمز السري:
              </label>
              <div className="relative">
                <input
                  type={showPinText ? 'text' : 'password'}
                  value={enteredPin}
                  onChange={e => {
                    setEnteredPin(e.target.value);
                    setPinError('');
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleVerifyPinAndExecute();
                    }
                  }}
                  autoFocus
                  placeholder="أدخل كلمة المرور"
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-center tracking-widest font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPinText(prev => !prev)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPinText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pinError && (
                <p className="text-xs font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {pinError}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleVerifyPinAndExecute}
                className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف الآن</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPinModalOpen(null);
                  setEnteredPin('');
                  setPinError('');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl font-bold text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHANGE SECURITY PIN (تغيير كلمة المرور) */}
      {/* ========================================================================= */}
      {isChangePinOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsChangePinOpen(false);
            setCurrentPinInput('');
            setNewPinInput('');
            setConfirmNewPinInput('');
            setChangePinError('');
            setChangePinSuccess('');
          }}
          title="تغيير كلمة مرور السجل والأمان"
        >
          <form onSubmit={handleChangePinSubmit} className="space-y-3 text-right">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                كلمة المرور الحالية:
              </label>
              <input
                type="password"
                required
                value={currentPinInput}
                onChange={e => setCurrentPinInput(e.target.value)}
                placeholder="أدخل كلمة المرور الحالية"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                كلمة المرور الجديدة:
              </label>
              <input
                type="password"
                required
                value={newPinInput}
                onChange={e => setNewPinInput(e.target.value)}
                placeholder="4 خانات أو أحرف على الأقل"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تأكيد كلمة المرور الجديدة:
              </label>
              <input
                type="password"
                required
                value={confirmNewPinInput}
                onChange={e => setConfirmNewPinInput(e.target.value)}
                placeholder="أعد كتابة كلمة المرور الجديدة"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            {changePinError && (
              <p className="text-xs font-bold text-rose-600 mt-1">{changePinError}</p>
            )}
            {changePinSuccess && (
              <p className="text-xs font-bold text-emerald-600 mt-1">{changePinSuccess}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-xs transition-all"
              >
                حفظ كلمة المرور الجديدة
              </button>
              <button
                type="button"
                onClick={() => setIsChangePinOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl font-bold text-xs"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD MANUAL LOG ENTRY (إضافة قيد يدوي في السجل) */}
      {/* ========================================================================= */}
      {isAddManualLogOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddManualLogOpen(false)}
          title="إضافة ملاحظة أو قيد يدوي في السجل"
        >
          <form onSubmit={handleSaveManualLog} className="space-y-3 text-right">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عنوان القيد / العملية:
              </label>
              <input
                type="text"
                required
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                placeholder="مثال: مراجعة الجرد اليدوي أو ملاحظة إدارية"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  القسم:
                </label>
                <select
                  value={manualCategory}
                  onChange={e => setManualCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="inventory">المخزون</option>
                  <option value="rentals">الكراء</option>
                  <option value="sales">المبيعات</option>
                  <option value="tailoring">الخياطة</option>
                  <option value="expenses">المصاريف</option>
                  <option value="credits">الديون</option>
                  <option value="caisse">الصندوق</option>
                  <option value="staff">العمال</option>
                  <option value="partners">الشركاء</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نوع الحركة:
                </label>
                <select
                  value={manualActionType}
                  onChange={e => setManualActionType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="create">إضافة</option>
                  <option value="update">تعديل / ملاحظة</option>
                  <option value="payment">دفع / سحب</option>
                  <option value="closure">إغلاق</option>
                  <option value="delete">حذف</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المبلغ المرتبط (اختياري - دج):
              </label>
              <input
                type="number"
                value={manualAmount === undefined ? '' : manualAmount}
                onChange={e => setManualAmount(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="مثال: 5000"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                التفاصيل والملاحظات:
              </label>
              <textarea
                rows={3}
                value={manualDetails}
                onChange={e => setManualDetails(e.target.value)}
                placeholder="اكتب أي توضيحات إضافية..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-xs transition-all"
              >
                تسجيل في السجل
              </button>
              <button
                type="button"
                onClick={() => setIsAddManualLogOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl font-bold text-xs"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
});
