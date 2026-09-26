import React, { useState, useMemo } from 'react';
import { StaffMember, StaffPayout, StaffAbsence } from '../types';
import { 
  User, 
  Calendar, 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  Printer, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  X, 
  Plus, 
  Phone, 
  Briefcase,
  Banknote,
  Percent,
  Sparkles
} from 'lucide-react';
import { buildSimplePrintHtml, openPrintInterface } from '../utils/printInterface';

interface StaffMemberLedgerModalProps {
  member: StaffMember;
  allMembers: StaffMember[];
  staffPayouts: StaffPayout[];
  staffAbsences: StaffAbsence[];
  onClose: () => void;
  onSelectMember: (m: StaffMember) => void;
  onAddPayout: (data: Omit<StaffPayout, 'id'>, deductedAbsenceIds?: string[]) => void;
  onDeletePayout: (id: string) => void;
  onAddAbsence: (data: Omit<StaffAbsence, 'id'>) => void;
  onDeleteAbsence: (id: string) => void;
  hideFinances?: boolean;
}

export type LedgerItem = {
  id: string;
  sourceType: 'payout' | 'absence';
  date: string;
  title: string;
  category: 'salary' | 'advance' | 'bonus' | 'sales_commission' | 'absence' | 'other';
  amount: number; // positive for paid to staff, negative for deduction
  details?: string;
  notes?: string;
  isDeducted?: boolean;
  rawPayout?: StaffPayout;
  rawAbsence?: StaffAbsence;
};

export const StaffMemberLedgerModal: React.FC<StaffMemberLedgerModalProps> = ({
  member,
  allMembers,
  staffPayouts,
  staffAbsences,
  onClose,
  onSelectMember,
  onAddPayout,
  onDeletePayout,
  onAddAbsence,
  onDeleteAbsence,
  hideFinances
}) => {
  // Filters
  const [periodFilter, setPeriodFilter] = useState<'all' | 'daily' | 'monthly'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Action Modal States inside Ledger
  const [quickAction, setQuickAction] = useState<'payout' | 'advance' | 'bonus' | 'absence' | null>(null);
  const [quickAmount, setQuickAmount] = useState<number | ''>('');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickAbsenceDays, setQuickAbsenceDays] = useState<number>(1);
  const [quickAbsenceReason, setQuickAbsenceReason] = useState('غياب غير مبرر');

  // Rates for selected member
  const daysPerMonth = member.workDaysPerMonth || 26;
  const dailyRate = Math.round(member.baseSalary / daysPerMonth);

  // Collect all transactions for this member
  const memberPayouts = useMemo(() => {
    return staffPayouts.filter(p => 
      p.staffId === member.id || 
      (p.name && p.name.trim().toLowerCase() === member.name.trim().toLowerCase())
    );
  }, [staffPayouts, member]);

  const memberAbsences = useMemo(() => {
    return staffAbsences.filter(a => 
      a.staffId === member.id || 
      (a.staffName && a.staffName.trim().toLowerCase() === member.name.trim().toLowerCase())
    );
  }, [staffAbsences, member]);

  // Combine payouts and absences into unified chronological ledger items
  const unifiedLedger = useMemo<LedgerItem[]>(() => {
    const items: LedgerItem[] = [];

    // 1. Add Payouts
    memberPayouts.forEach(p => {
      let category: LedgerItem['category'] = 'salary';
      if (p.type.includes('تسليف') || p.type.includes('عربون')) category = 'advance';
      else if (p.type.includes('مكافأة')) category = 'bonus';
      else if (p.type.includes('نسبة') || p.type.includes('مبيعات')) category = 'sales_commission';
      else if (p.type.includes('راتب')) category = 'salary';
      else category = 'other';

      const detailsList: string[] = [];
      if (p.baseAmount && p.baseAmount !== p.amount) {
        detailsList.push(`الأساسي: ${p.baseAmount.toLocaleString()} دج`);
      }
      if (p.absenceDeduction && p.absenceDeduction > 0) {
        detailsList.push(`خصم غيابات (${p.absencesCount || 0} يوم): -${p.absenceDeduction.toLocaleString()} دج`);
      }
      if (p.advancesDeduction && p.advancesDeduction > 0) {
        detailsList.push(`خصم تسبيقات سابقة: -${p.advancesDeduction.toLocaleString()} دج`);
      }
      if (p.bonus && p.bonus > 0) {
        detailsList.push(`مكافأة: +${p.bonus.toLocaleString()} دج`);
      }

      items.push({
        id: `payout-${p.id}`,
        sourceType: 'payout',
        date: p.date,
        title: p.type || 'صرف راتب / دفعة مالية',
        category,
        amount: Number(p.amount) || 0,
        details: detailsList.join(' | '),
        notes: p.notes,
        rawPayout: p
      });
    });

    // 2. Add Absences
    memberAbsences.forEach(a => {
      items.push({
        id: `absence-${a.id}`,
        sourceType: 'absence',
        date: a.date,
        title: `تسجيل غياب (${a.daysCount} يوم)`,
        category: 'absence',
        amount: -(Number(a.deductionAmount) || 0),
        details: a.isDeducted ? '✓ تم خصمه في الراتب' : '⏳ معلق (لم يخصم بعد)',
        notes: a.reason,
        isDeducted: a.isDeducted,
        rawAbsence: a
      });
    });

    // Sort descending by date
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [memberPayouts, memberAbsences]);

  // Filter ledger according to period & category & search
  const filteredLedger = useMemo(() => {
    return unifiedLedger.filter(item => {
      const itemDateStr = item.date.slice(0, 10);
      const itemMonthStr = item.date.slice(0, 7);

      if (periodFilter === 'daily') {
        if (itemDateStr !== selectedDate) return false;
      } else if (periodFilter === 'monthly') {
        if (itemMonthStr !== selectedMonth) return false;
      }

      if (categoryFilter !== 'all') {
        if (item.category !== categoryFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q);
        const matchesDetails = item.details?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes && !matchesDetails) return false;
      }

      return true;
    });
  }, [unifiedLedger, periodFilter, selectedDate, selectedMonth, categoryFilter, searchQuery]);

  // Financial statistics for current filtered view
  const periodStats = useMemo(() => {
    let totalPaidToStaff = 0;
    let totalSalaryPaid = 0;
    let totalAdvancesPaid = 0;
    let totalBonusPaid = 0;
    let totalAbsenceDeductions = 0;
    let totalAbsenceDays = 0;
    let pendingAbsenceCount = 0;
    let pendingAbsenceAmount = 0;

    filteredLedger.forEach(item => {
      if (item.sourceType === 'payout') {
        totalPaidToStaff += item.amount;
        if (item.category === 'salary') totalSalaryPaid += item.amount;
        if (item.category === 'advance') totalAdvancesPaid += item.amount;
        if (item.category === 'bonus') totalBonusPaid += item.amount;
      } else if (item.sourceType === 'absence') {
        totalAbsenceDeductions += Math.abs(item.amount);
        totalAbsenceDays += item.rawAbsence?.daysCount || 1;
        if (!item.isDeducted) {
          pendingAbsenceCount += item.rawAbsence?.daysCount || 1;
          pendingAbsenceAmount += Math.abs(item.amount);
        }
      }
    });

    return {
      totalPaidToStaff,
      totalSalaryPaid,
      totalAdvancesPaid,
      totalBonusPaid,
      totalAbsenceDeductions,
      totalAbsenceDays,
      pendingAbsenceCount,
      pendingAbsenceAmount
    };
  }, [filteredLedger]);

  // Handle Quick Actions (Payout, Advance, Bonus, Absence)
  const handleQuickActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAction) return;

    if (quickAction === 'absence') {
      const deduction = Math.round(dailyRate * quickAbsenceDays);
      onAddAbsence({
        staffId: member.id,
        staffName: member.name,
        date: selectedDate || new Date().toISOString().split('T')[0],
        daysCount: quickAbsenceDays,
        reason: quickAbsenceReason,
        deductionAmount: deduction,
        isDeducted: false
      });
    } else {
      const amount = Number(quickAmount) || 0;
      if (amount <= 0) return;

      let typeName = 'راتب شهري';
      if (quickAction === 'advance') typeName = 'تسليف (عربون)';
      if (quickAction === 'bonus') typeName = 'مكافأة';

      onAddPayout({
        staffId: member.id,
        name: member.name,
        amount,
        baseAmount: amount,
        type: typeName,
        date: new Date().toISOString(),
        notes: quickNotes.trim() || undefined
      });
    }

    setQuickAction(null);
    setQuickAmount('');
    setQuickNotes('');
    setQuickAbsenceDays(1);
  };

  // Print Statement Handler — opens the dedicated print interface
  const handlePrintStatement = () => {
    const rows = filteredLedger.map((item) => [
      new Date(item.date).toLocaleString('ar-DZ'),
      item.title,
      item.category,
      hideFinances ? '••••' : `${item.amount.toLocaleString()} دج`,
      item.details || item.notes || '',
    ]);
    openPrintInterface({
      title: `كشف حساب ${member.name}`,
      fileName: `كشف_حساب_${member.name}`,
      html: buildSimplePrintHtml({
        heading: `كشف حساب ${member.name}`,
        subtitle: `${member.role} • ${filteredLedger.length} عملية`,
        headers: ['التاريخ', 'البيان', 'النوع', 'المبلغ', 'التفاصيل'],
        rows,
      }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Member Info & Switcher */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-white shadow-2xs">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">{member.name}</h3>
                <span className="bg-white/15 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                  {member.role}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1 font-normal font-mono">
                {member.phone && (
                  <span className="flex items-center gap-1 font-sans">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {member.phone}
                  </span>
                )}
                <span>•</span>
                <span>الراتب الأساسي: <strong className="text-white">{hideFinances ? '••••' : `${member.baseSalary.toLocaleString()} دج`}</strong></span>
                <span>•</span>
                <span>اليومية ({daysPerMonth} يوم): <strong className="text-white">{hideFinances ? '••••' : `${dailyRate.toLocaleString()} دج`}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Member Switcher & Close */}
          <div className="flex items-center gap-2">
            {allMembers.length > 1 && (
              <select
                value={member.id}
                onChange={(e) => {
                  const target = allMembers.find(m => m.id === e.target.value);
                  if (target) onSelectMember(target);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium py-1.5 px-3 rounded-xl border border-slate-700 outline-none cursor-pointer"
              >
                {allMembers.map(m => (
                  <option key={m.id} value={m.id} className="text-slate-900 bg-white">
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handlePrintStatement}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
              title="طباعة كشف الحساب"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">طباعة</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Toolbar & Period Filter */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200/80 space-y-3">
          
          {/* Period Selection Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setPeriodFilter('all')}
                className={`py-1.5 px-3.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  periodFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>كل المعاملات</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodFilter('monthly')}
                className={`py-1.5 px-3.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  periodFilter === 'monthly'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>المعاملات الشهرية</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodFilter('daily')}
                className={`py-1.5 px-3.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  periodFilter === 'daily'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>المعاملات اليومية</span>
              </button>
            </div>

            {/* Date Pickers based on selection */}
            <div className="flex items-center gap-2">
              {periodFilter === 'monthly' && (
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs font-medium text-slate-800">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>الشهر:</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent font-medium text-slate-900 outline-none cursor-pointer"
                  />
                </div>
              )}

              {periodFilter === 'daily' && (
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs font-medium text-slate-800">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>اليوم:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent font-medium text-slate-900 outline-none cursor-pointer"
                  />
                </div>
              )}

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8.5 bg-white border border-slate-200/80 text-xs font-medium text-slate-800 px-3 py-1 rounded-xl outline-none"
              >
                <option value="all">جميع الأنواع</option>
                <option value="salary">الرواتب الشهرية</option>
                <option value="advance">التسبيقات والسلفيات</option>
                <option value="bonus">المكافآت</option>
                <option value="absence">الغيابات والخصومات</option>
              </select>
            </div>
          </div>

          {/* Quick Action Buttons for This Member */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
            <span className="text-[11px] font-medium text-slate-500">إجراء سريع للعامل:</span>
            
            <button
              onClick={() => { setQuickAction('advance'); setQuickAmount(''); }}
              className="py-1 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition-colors border border-slate-200/80 flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ تسجيل تسليف / عربون</span>
            </button>

            <button
              onClick={() => { setQuickAction('bonus'); setQuickAmount(''); }}
              className="py-1 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition-colors border border-slate-200/80 flex items-center gap-1 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ إضافة مكافأة</span>
            </button>

            <button
              onClick={() => { setQuickAction('absence'); setQuickAbsenceDays(1); }}
              className="py-1 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition-colors border border-slate-200/80 flex items-center gap-1 shadow-2xs"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>+ تسجيل غياب</span>
            </button>
          </div>
        </div>

        {/* Quick Action Form if open */}
        {quickAction && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 animate-in slide-in-from-top-2 duration-150">
            <form onSubmit={handleQuickActionSubmit} className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-slate-700" />
                  <span>
                    {quickAction === 'advance' && 'تسجيل دفعة تسليف / عربون للعامل'}
                    {quickAction === 'bonus' && 'إضافة مكافأة مالية للعامل'}
                    {quickAction === 'absence' && 'تسجيل يوم غياب وحساب الخصم'}
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={() => setQuickAction(null)}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {quickAction === 'absence' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-1">عدد أيام الغياب</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="31"
                      required
                      value={quickAbsenceDays}
                      onChange={(e) => setQuickAbsenceDays(Number(e.target.value) || 1)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-1">سبب الغياب</label>
                    <select
                      value={quickAbsenceReason}
                      onChange={(e) => setQuickAbsenceReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-800"
                    >
                      <option value="غياب غير مبرر">غياب غير مبرر</option>
                      <option value="ظرف عائلي / شخصي">ظرف عائلي / شخصي</option>
                      <option value="وعكة صحية / مرض">وعكة صحية / مرض</option>
                      <option value="عطلة مرخصة">عطلة مرخصة</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      تأكيد وحفظ الغياب (-{Math.round(dailyRate * quickAbsenceDays).toLocaleString()} دج)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-1">المبلغ (دج) *</label>
                    <input
                      type="number"
                      min="100"
                      required
                      value={quickAmount}
                      onChange={(e) => setQuickAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="5000"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-1">ملاحظات / بيان</label>
                    <input
                      type="text"
                      value={quickNotes}
                      onChange={(e) => setQuickNotes(e.target.value)}
                      placeholder="مثال: تسليف أسبوعي، مكافأة عيد..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      تأكيد وتسجيل العملية
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Financial Summary Dashboard for the Selected View */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border-b border-slate-100 font-mono">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-medium text-slate-500 block font-sans">إجمالي المقبوض (المصروف للعامل)</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 block">
              {hideFinances ? '••••' : `${periodStats.totalPaidToStaff.toLocaleString()} دج`}
            </span>
            <span className="text-[9px] text-slate-400 font-normal font-sans">
              {periodFilter === 'all' ? 'كامل الفترة' : periodFilter === 'monthly' ? `شهر ${selectedMonth}` : `يوم ${selectedDate}`}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-medium text-slate-500 block font-sans">السلفيات والتسبيقات</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 block">
              {hideFinances ? '••••' : `${periodStats.totalAdvancesPaid.toLocaleString()} دج`}
            </span>
            <span className="text-[9px] text-slate-400 font-normal font-sans">مبالغ مسحوبة مسبقاً</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-medium text-slate-500 block font-sans">الغيابات والخصومات</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 block">
              {periodStats.totalAbsenceDays} يوم
            </span>
            <span className="text-[9px] text-slate-400 font-normal font-sans">
              {hideFinances ? '••••' : `(-${periodStats.totalAbsenceDeductions.toLocaleString()} دج)`}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-medium text-slate-500 block font-sans">الغيابات المعلقة للخصم</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 block">
              {periodStats.pendingAbsenceCount} يوم
            </span>
            <span className="text-[9px] text-slate-400 font-normal font-sans">
              {hideFinances ? '••••' : `(تخصم في الراتب: ${periodStats.pendingAbsenceAmount.toLocaleString()} دج)`}
            </span>
          </div>
        </div>

        {/* Transactions Table & Ledger List */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-700 pb-1">
            <span>سجل المعاملات والعمليات ({filteredLedger.length}):</span>
            <span className="text-[11px] text-slate-400 font-normal">
              مرتبة تنازلياً حسب التاريخ
            </span>
          </div>

          {filteredLedger.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-medium text-slate-600">لا توجد أي معاملات مسجلة في هذه الفترة المحددة.</p>
              <p className="text-[11px] text-slate-400">يمكنك تغيير فلتر الفترة (الكل، شهري، يومي) أو تسجيل دفعة/غياب سريع من الأعلى.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
              {filteredLedger.map(item => {
                const isAbsence = item.sourceType === 'absence';
                const isAdvance = item.category === 'advance';
                const isBonus = item.category === 'bonus';

                return (
                  <div key={item.id} className="p-3.5 flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 hover:bg-slate-50/70 transition-colors">
                    
                    {/* Icon & Title */}
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-medium text-xs ${
                        isAbsence 
                          ? 'bg-slate-100 text-slate-700' 
                          : isAdvance 
                          ? 'bg-slate-100 text-slate-700'
                          : isBonus
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-slate-900 text-white'
                      }`}>
                        {isAbsence ? (
                          <Calendar className="w-4 h-4" />
                        ) : isAdvance ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <Banknote className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-900">{item.title}</span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
                            {isAbsence ? (item.isDeducted ? 'مخصوم' : 'معلق للخصم') : item.category}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-normal">
                          <span className="font-mono">{new Date(item.date).toLocaleDateString('ar-DZ')} {item.date.includes('T') ? new Date(item.date).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          {item.details && <span>• {item.details}</span>}
                          {item.notes && <span className="text-slate-700">• ملاحظة: {item.notes}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Financial Amount & Delete */}
                    <div className="flex items-center gap-3 mr-auto sm:mr-0">
                      <div className="text-left font-mono">
                        <span className={`text-sm font-bold block ${
                          isAbsence ? 'text-slate-700' : 'text-slate-900'
                        }`}>
                          {hideFinances ? '••••' : (
                            isAbsence 
                              ? `-${Math.abs(item.amount).toLocaleString()} دج` 
                              : `+${item.amount.toLocaleString()} دج`
                          )}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-normal font-sans">
                          {isAbsence ? 'خصم من الراتب' : 'مقبوض ومسدد'}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          if (item.sourceType === 'payout' && item.rawPayout) {
                            onDeletePayout(item.rawPayout.id);
                          } else if (item.sourceType === 'absence' && item.rawAbsence) {
                            onDeleteAbsence(item.rawAbsence.id);
                          }
                        }}
                        className="text-slate-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        title="حذف هذا السجل"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-medium">
            كشف حساب العامل: <strong className="text-slate-800 font-semibold">{member.name}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors shadow-xs"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
