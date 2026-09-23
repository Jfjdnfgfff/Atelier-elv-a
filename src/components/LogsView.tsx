import React, { useState, useMemo } from 'react';
import { 
  ActivityLog, 
  ActivityCategory, 
  ActivityActionType 
} from '../types';
import { 
  History, 
  Search, 
  Trash2, 
  Filter, 
  Calendar, 
  Lock, 
  KeyRound, 
  ShieldCheck, 
  Download, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  ShoppingBag, 
  Scissors, 
  Receipt, 
  CreditCard, 
  Scale, 
  Users, 
  Clock, 
  PlusCircle, 
  Edit3, 
  Sparkles,
  Eye,
  EyeOff,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Modal } from './Shared';

interface LogsViewProps {
  logs: ActivityLog[];
  onDeleteLog: (id: string, passwordVerified: boolean) => void;
  onClearAllLogs: (passwordVerified: boolean) => void;
  onAddManualLog?: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const LogsView: React.FC<LogsViewProps> = React.memo(({
  logs,
  onDeleteLog,
  onClearAllLogs,
  onAddManualLog,
  showToast
}) => {
  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  
  // Selection for bulk actions
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // Password / PIN Verification Modal State
  const [pendingDeleteAction, setPendingDeleteAction] = useState<{
    type: 'single' | 'bulk' | 'all';
    targetId?: string;
  } | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [showPinText, setShowPinText] = useState(false);
  const [pinError, setPinError] = useState('');

  // Change Password Modal State
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [changePinError, setChangePinError] = useState('');

  // Add Manual Log Modal State
  const [isAddManualLogOpen, setIsAddManualLogOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDetails, setManualDetails] = useState('');
  const [manualCategory, setManualCategory] = useState<ActivityCategory>('inventory');
  const [manualActionType, setManualActionType] = useState<ActivityActionType>('update');

  // Master PIN (stored in localStorage or fallback '9296')
  const getStoredPin = (): string => {
    return localStorage.getItem('bm_security_pin') || '9296';
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return logs.filter(log => {
      // Category filter
      if (selectedCategory !== 'all' && log.category !== selectedCategory) {
        return false;
      }

      // Action type filter
      if (selectedActionType !== 'all') {
        if (selectedActionType === 'create_or_update' && log.actionType !== 'create' && log.actionType !== 'update') return false;
        if (selectedActionType === 'delete' && log.actionType !== 'delete') return false;
        if (selectedActionType === 'deal_return' && log.actionType !== 'deal' && log.actionType !== 'return') return false;
        if (selectedActionType === 'payment_closure' && log.actionType !== 'payment' && log.actionType !== 'closure') return false;
      }

      // Date filter
      if (dateFilter === 'today') {
        if (!log.timestamp.startsWith(todayStr)) return false;
      } else if (dateFilter === 'week') {
        const logDate = new Date(log.timestamp);
        if (logDate < sevenDaysAgo) return false;
      } else if (dateFilter === 'month') {
        const logDate = new Date(log.timestamp);
        if (logDate < monthStart) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = log.title?.toLowerCase().includes(term);
        const matchDetails = log.details?.toLowerCase().includes(term);
        const matchCode = log.itemCodeOrId?.toLowerCase().includes(term);
        const matchUser = log.performedBy?.toLowerCase().includes(term);
        if (!matchTitle && !matchDetails && !matchCode && !matchUser) return false;
      }

      return true;
    });
  }, [logs, selectedCategory, selectedActionType, dateFilter, searchTerm]);

  // Metric stats
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = logs.filter(l => l.timestamp.startsWith(todayStr)).length;
    const updatesCount = logs.filter(l => l.actionType === 'update' || l.actionType === 'create').length;
    const deletesCount = logs.filter(l => l.actionType === 'delete').length;

    return {
      total: logs.length,
      today: todayCount,
      updates: updatesCount,
      deletes: deletesCount
    };
  }, [logs]);

  // Handle PIN submission for deletion
  const handleVerifyPinAndExecuteDelete = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const correctPin = getStoredPin();

    if (enteredPin.trim() === correctPin) {
      // Pin is correct! Execute deletion
      if (pendingDeleteAction?.type === 'single' && pendingDeleteAction.targetId) {
        onDeleteLog(pendingDeleteAction.targetId, true);
        showToast('تم حذف السجل بنجاح بعد التحقق من كلمة السر');
      } else if (pendingDeleteAction?.type === 'all') {
        onClearAllLogs(true);
        setSelectedLogIds([]);
        showToast('تم مسح جميع سجلات العمليات بنجاح');
      } else if (pendingDeleteAction?.type === 'bulk') {
        selectedLogIds.forEach(id => onDeleteLog(id, true));
        setSelectedLogIds([]);
        showToast(`تم حذف ${selectedLogIds.length} سجلات بنجاح`);
      }

      setPendingDeleteAction(null);
      setEnteredPin('');
      setPinError('');
    } else {
      setPinError('كلمة السر غير صحيحة! لا يمكن حذف أي سجل إلا بإدخال كلمة السر المعتمدة.');
      showToast('كلمة السر غير صحيحة', 'error');
    }
  };

  // Handle changing password
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = getStoredPin();

    if (currentPinInput !== correctPin) {
      setChangePinError('كلمة السر الحالية غير صحيحة');
      return;
    }
    if (newPinInput.length < 4) {
      setChangePinError('يجب أن تتكون كلمة السر الجديدة من 4 أرقام أو أحرف على الأقل');
      return;
    }
    if (newPinInput !== confirmNewPinInput) {
      setChangePinError('كلمة السر الجديدة وتأكيدها غير متطابقين');
      return;
    }

    localStorage.setItem('bm_security_pin', newPinInput);
    setIsChangePasswordModalOpen(false);
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmNewPinInput('');
    setChangePinError('');
    showToast('تم تحديث كلمة سر الأمان وحذف السجلات بنجاح!');
  };

  // Handle adding manual log
  const handleAddManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) {
      showToast('الرجاء إدخال عنوان العملية أو الملاحظة', 'error');
      return;
    }

    if (onAddManualLog) {
      onAddManualLog({
        actionType: manualActionType,
        category: manualCategory,
        title: manualTitle.trim(),
        details: manualDetails.trim() || 'تسجيل يدوي بواسطة الإدارة',
        performedBy: 'مسؤول البوتيك'
      });
      showToast('تمت إضافة القيد في السجل بنجاح');
    }

    setIsAddManualLogOpen(false);
    setManualTitle('');
    setManualDetails('');
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      showToast('لا توجد سجلات لتصديرها', 'error');
      return;
    }

    const headers = ['التاريخ والوقت', 'القسم', 'نوع العملية', 'العنوان', 'التفاصيل الدقيقة', 'المبلغ (دج)', 'القائم بالعملية'];
    const rows = filteredLogs.map(l => [
      `"${new Date(l.timestamp).toLocaleString('ar-DZ')}"`,
      `"${getCategoryLabel(l.category)}"`,
      `"${getActionLabel(l.actionType)}"`,
      `"${(l.title || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      l.amount ? `"${l.amount}"` : '""',
      `"${l.performedBy || 'المسؤول'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `سجل_عمليات_البوتيك_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير ملف سجل العمليات (CSV) بنجاح');
  };

  // Print Logs
  const handlePrint = () => {
    window.print();
  };

  // Helper labels & icons
  const getCategoryLabel = (cat: ActivityCategory): string => {
    switch (cat) {
      case 'inventory': return 'المخزون والقطع';
      case 'rentals': return 'الكراء والحجوزات';
      case 'sales': return 'المبيعات والصندوق';
      case 'tailoring': return 'الخياطة والصيانة';
      case 'expenses': return 'المصاريف والمشتريات';
      case 'credits': return 'الديون والكريدي';
      case 'caisse': return 'الصندوق اليومي';
      case 'staff': return 'العمال والرواتب';
      case 'partners': return 'الموردين والخياطات';
      default: return 'عام';
    }
  };

  const getCategoryIcon = (cat: ActivityCategory) => {
    switch (cat) {
      case 'inventory': return <Package className="w-4 h-4 text-blue-600" />;
      case 'rentals': return <Calendar className="w-4 h-4 text-purple-600" />;
      case 'sales': return <ShoppingBag className="w-4 h-4 text-emerald-600" />;
      case 'tailoring': return <Scissors className="w-4 h-4 text-pink-600" />;
      case 'expenses': return <Receipt className="w-4 h-4 text-amber-600" />;
      case 'credits': return <CreditCard className="w-4 h-4 text-red-600" />;
      case 'caisse': return <Scale className="w-4 h-4 text-indigo-600" />;
      case 'staff': return <Users className="w-4 h-4 text-cyan-600" />;
      default: return <History className="w-4 h-4 text-blue-600" />;
    }
  };

  const getActionBadge = (type: ActivityActionType) => {
    switch (type) {
      case 'create':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">إضافة جديدة</span>;
      case 'update':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">تحديث وتعديل</span>;
      case 'delete':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-50 text-red-700 border border-red-200">عملية حذف</span>;
      case 'deal':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">إتمام كراء / تسليم</span>;
      case 'return':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">استرجاع فستان</span>;
      case 'payment':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">تسديد / صرف</span>;
      case 'closure':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">إقفال صندوق</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">عملية</span>;
    }
  };

  const getActionLabel = (type: ActivityActionType): string => {
    switch (type) {
      case 'create': return 'إضافة جديدة';
      case 'update': return 'تعديل وتحديث';
      case 'delete': return 'حذف';
      case 'deal': return 'كراء / تسليم';
      case 'return': return 'استرجاع';
      case 'payment': return 'تسديد';
      case 'closure': return 'إقفال الصندوق';
      default: return 'عملية';
    }
  };

  const formatLogDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const today = new Date().toISOString().split('T')[0];
      const isToday = isoStr.startsWith(today);
      const timeStr = d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      if (isToday) {
        return `اليوم ${timeStr}`;
      }
      return `${d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric' })} - ${timeStr}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5" dir="rtl">
      
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shrink-0 shadow-2xs">
            <History className="w-5 h-5 text-slate-800" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">سجل النشاطات والتعديلات (Journal d'audit)</h2>
              <span className="flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3 text-slate-500" />
                محمي بكلمة سر
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              متابعة وتوثيق كل الإضافات، التعديلات، الحجوزات، والمبيعات مع حماية الحذف برمز سري
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsAddManualLogOpen(true)}
            className="flex-1 sm:flex-none h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>تسجيل ملاحظة</span>
          </button>

          <button
            onClick={() => setIsChangePasswordModalOpen(true)}
            title="تغيير رمز المرور لحماية الحذف"
            className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">كلمة السر</span>
          </button>

          <button
            onClick={handleExportCSV}
            title="تصدير السجل كملف CSV"
            className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">تصدير CSV</span>
          </button>

          <button
            onClick={handlePrint}
            title="طباعة تقرير السجل"
            className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">طباعة</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 flex items-center justify-center shrink-0">
            <History className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-medium block">إجمالي السجلات</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-medium block">عمليات اليوم</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">{stats.today}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 flex items-center justify-center shrink-0">
            <Edit3 className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-medium block">تحديثات وإضافات</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">{stats.updates}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-medium block">عمليات الحذف</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">{stats.deletes}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Search Bar + Quick Category Select */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث في السجل (العنوان، التفاصيل، كود القطعة، الزبون...)"
              className="w-full h-9 pr-9 pl-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-slate-400 transition-colors"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
              >
                مسح
              </button>
            )}
          </div>

          {/* Action Type Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="all">كل أنواع العمليات</option>
              <option value="create_or_update">الإضافات والتعديلات فقط</option>
              <option value="deal_return">الكراء والاسترجاع فقط</option>
              <option value="payment_closure">المدفوعات وإقفال الصندوق</option>
              <option value="delete">عمليات الحذف فقط</option>
            </select>

            {/* Date Range Selector */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="all">كل الفترات الزمنية</option>
              <option value="today">سجلات اليوم فقط</option>
              <option value="week">آخر 7 أيام</option>
              <option value="month">هذا الشهر الحالي</option>
            </select>
          </div>
        </div>

        {/* Category Horizontal Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 custom-scrollbar text-xs">
          {[
            { id: 'all', label: 'كافة الأقسام', count: logs.length },
            { id: 'inventory', label: 'المخزون والفساتين', count: logs.filter(l => l.category === 'inventory').length },
            { id: 'rentals', label: 'الكراء والحجوزات', count: logs.filter(l => l.category === 'rentals').length },
            { id: 'sales', label: 'المبيعات', count: logs.filter(l => l.category === 'sales').length },
            { id: 'tailoring', label: 'الخياطة والتعديل', count: logs.filter(l => l.category === 'tailoring').length },
            { id: 'expenses', label: 'المصاريف', count: logs.filter(l => l.category === 'expenses').length },
            { id: 'credits', label: 'الديون', count: logs.filter(l => l.category === 'credits').length },
            { id: 'caisse', label: 'الصندوق', count: logs.filter(l => l.category === 'caisse').length },
            { id: 'staff', label: 'العمال', count: logs.filter(l => l.category === 'staff').length },
            { id: 'partners', label: 'الموردين', count: logs.filter(l => l.category === 'partners').length }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as ActivityCategory)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap text-xs transition-colors shrink-0 flex items-center gap-1.5 border ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-semibold'
                  : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                selectedCategory === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Items Bulk Bar */}
      {selectedLogIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">تم تحديد {selectedLogIds.length} سجل(ات)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPendingDeleteAction({ type: 'bulk' });
                setEnteredPin('');
                setPinError('');
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف المحدد بكلمة السر</span>
            </button>
            <button
              onClick={() => setSelectedLogIds([])}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Logs Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
              <History className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">لا توجد سجلات مطابقة لخيارات البحث</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              تظهر هنا جميع التعديلات والإضافات المسجلة في النظام تلقائياً وبشكل دوري.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const isSelected = selectedLogIds.includes(log.id);
              return (
                <div 
                  key={log.id} 
                  className={`p-3.5 sm:p-4 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3 ${
                    isSelected ? 'bg-slate-50' : ''
                  }`}
                >
                  {/* Left Column: Checkbox & Category Icon */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLogIds(prev => [...prev, log.id]);
                        } else {
                          setSelectedLogIds(prev => prev.filter(id => id !== log.id));
                        }
                      }}
                      className="mt-1 w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-500"
                    />

                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/70 flex items-center justify-center shrink-0 mt-0.5">
                      {getCategoryIcon(log.category)}
                    </div>

                    {/* Middle Column: Details & Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Top Row: Title, Action Badge, Category Badge */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                          {log.title}
                        </h4>
                        {getActionBadge(log.actionType)}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {getCategoryLabel(log.category)}
                        </span>
                        {log.amount !== undefined && log.amount > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                            {log.amount.toLocaleString('ar-DZ')} دج
                          </span>
                        )}
                      </div>

                      {/* Detailed Description */}
                      <p className="text-xs text-slate-600 leading-relaxed break-words font-normal">
                        {log.details}
                      </p>

                      {/* Footer Info: Timestamp, Code, User */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5 font-normal">
                        <span className="flex items-center gap-1 font-mono text-slate-600">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatLogDate(log.timestamp)}
                        </span>
                        {log.itemCodeOrId && (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-600 border border-slate-200/60">
                            مرجع: {log.itemCodeOrId}
                          </span>
                        )}
                        <span className="text-slate-400">
                          بواسطة: <strong className="text-slate-700 font-medium">{log.performedBy || 'المسؤول'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Delete Button with Lock Indicator */}
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => {
                        setPendingDeleteAction({ type: 'single', targetId: log.id });
                        setEnteredPin('');
                        setPinError('');
                      }}
                      title="حذف هذا السجل (يتطلب كلمة السر)"
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-400 hover:border-rose-200 border border-transparent flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* PIN Verification Modal for Deletion */}
      {pendingDeleteAction && (
        <Modal 
          title="التحقق من كلمة السر لحذف السجل" 
          onClose={() => {
            setPendingDeleteAction(null);
            setEnteredPin('');
            setPinError('');
          }}
        >
          <form onSubmit={handleVerifyPinAndExecuteDelete} className="space-y-4 text-center py-2" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-1">
              <Lock className="w-5 h-5 text-rose-600" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                {pendingDeleteAction.type === 'all' 
                  ? 'تأكيد مسح كافة سجلات النشاط' 
                  : pendingDeleteAction.type === 'bulk' 
                  ? `تأكيد حذف ${selectedLogIds.length} سجل(ات) محددة` 
                  : 'تأكيد حذف هذا السجل'}
              </h4>
              <p className="text-xs text-slate-500 font-normal">
                السجلات محمية لحفظ تاريخ العمليات، أدخل كلمة السر لتأكيد عملية الحذف:
              </p>
            </div>

            {/* PIN Input */}
            <div className="relative max-w-xs mx-auto">
              <input
                type={showPinText ? 'text' : 'password'}
                value={enteredPin}
                autoFocus
                onChange={(e) => {
                  setEnteredPin(e.target.value);
                  setPinError('');
                }}
                placeholder="أدخل كلمة السر / PIN"
                className="w-full border border-slate-300 focus:border-slate-800 rounded-xl px-4 py-2.5 text-center text-lg font-bold font-mono outline-none tracking-widest transition-colors bg-slate-50 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPinText(!showPinText)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPinText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {pinError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>تأكيد الحذف</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingDeleteAction(null);
                  setEnteredPin('');
                  setPinError('');
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Change Security PIN Modal */}
      {isChangePasswordModalOpen && (
        <Modal 
          title="تغيير كلمة سر الأمان وحذف السجلات" 
          onClose={() => {
            setIsChangePasswordModalOpen(false);
            setChangePinError('');
          }}
        >
          <form onSubmit={handleChangePassword} className="space-y-4 py-2" dir="rtl">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed font-normal">
              كلمة السر تُستخدم لحماية حذف السجلات، إظهار المبالغ المالية المحمية، وإجراء العمليات الحساسة في التطبيق.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة السر الحالية</label>
              <input
                type="password"
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value)}
                placeholder="أدخل كلمة السر الحالية"
                className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 bg-slate-50 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة السر الجديدة</label>
              <input
                type="password"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                placeholder="كلمة السر الجديدة (أرقام أو حروف)"
                className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 bg-slate-50 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">تأكيد كلمة السر الجديدة</label>
              <input
                type="password"
                value={confirmNewPinInput}
                onChange={(e) => setConfirmNewPinInput(e.target.value)}
                placeholder="أعد كتابة كلمة السر الجديدة"
                className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 bg-slate-50 focus:bg-white"
                required
              />
            </div>

            {changePinError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700">
                {changePinError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                حفظ كلمة السر الجديدة
              </button>
              <button
                type="button"
                onClick={() => setIsChangePasswordModalOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Manual Log Modal */}
      {isAddManualLogOpen && (
        <Modal 
          title="تسجيل قيد أو ملاحظة يدوية في السجل" 
          onClose={() => setIsAddManualLogOpen(false)}
        >
          <form onSubmit={handleAddManualSubmit} className="space-y-4 py-2" dir="rtl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">القسم المستهدف</label>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value as ActivityCategory)}
                className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 bg-slate-50 focus:bg-white"
              >
                <option value="inventory">المخزون والفساتين</option>
                <option value="rentals">الكراء والحجوزات</option>
                <option value="sales">المبيعات والصندوق</option>
                <option value="tailoring">الخياطة والتعديل</option>
                <option value="expenses">المصاريف والمشتريات</option>
                <option value="credits">الديون والكريدي</option>
                <option value="caisse">الصندوق اليومي</option>
                <option value="staff">العمال والرواتب</option>
                <option value="partners">الموردين والخياطات</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">نوع العملية</label>
              <select
                value={manualActionType}
                onChange={(e) => setManualActionType(e.target.value as ActivityActionType)}
                className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 bg-slate-50 focus:bg-white"
              >
                <option value="update">تحديث / جرد / تعديل</option>
                <option value="create">إضافة جديدة</option>
                <option value="payment">تسديد / صرف</option>
                <option value="deal">صفقة / تسليم</option>
                <option value="closure">ملاحظة إقفال</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">عنوان العملية أو الملاحظة *</label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="مثال: جرد يدوي لفساتين السهرة، استلام شحنة جديدة..."
                className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 bg-slate-50 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">التفاصيل والشرح</label>
              <textarea
                value={manualDetails}
                onChange={(e) => setManualDetails(e.target.value)}
                placeholder="اكتب التفاصيل الكاملة للإجراء..."
                rows={3}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-slate-400 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                حفظ في السجل
              </button>
              <button
                type="button"
                onClick={() => setIsAddManualLogOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
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
