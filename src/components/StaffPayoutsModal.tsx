import React, { useState, useMemo } from 'react';
import { StaffPayout, StaffMember, StaffAbsence } from '../types';
import { LettersInput, NumbersInput } from './Shared';
import { StaffMemberLedgerModal } from './StaffMemberLedgerModal';
import { Banknote, Calendar, Users, History, AlertCircle, Check, UserPlus, X, Plus, FileText, ChevronLeft, Search, Sparkles } from 'lucide-react';

interface StaffPayoutsModalProps {
  staffPayouts: StaffPayout[];
  staffMembers: StaffMember[];
  staffAbsences: StaffAbsence[];
  onAddPayout: (data: Omit<StaffPayout, 'id'>, deductedAbsenceIds?: string[]) => void;
  onDeletePayout: (id: string) => void;
  onAddStaffMember: (data: Omit<StaffMember, 'id'>) => void;
  onUpdateStaffMember: (id: string, data: Partial<StaffMember>) => void;
  onDeleteStaffMember: (id: string) => void;
  onAddAbsence: (data: Omit<StaffAbsence, 'id'>) => void;
  onDeleteAbsence: (id: string) => void;
  hideFinances?: boolean;
}

export const StaffPayoutsModal: React.FC<StaffPayoutsModalProps> = ({
  staffPayouts,
  staffMembers,
  staffAbsences,
  onAddPayout,
  onDeletePayout,
  onAddStaffMember,
  onUpdateStaffMember,
  onDeleteStaffMember,
  onAddAbsence,
  onDeleteAbsence,
  hideFinances
}) => {
  const [activeTab, setActiveTab] = useState<'payout' | 'absences' | 'staff' | 'history'>('payout');
  const [inspectingMember, setInspectingMember] = useState<StaffMember | null>(null);

  // Payout Form States
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffMembers[0]?.id || '');
  const [customName, setCustomName] = useState('');
  const [payoutType, setPayoutType] = useState<string>('راتب شهري');
  const [baseAmount, setBaseAmount] = useState<number | ''>('');
  const [absenceDeduction, setAbsenceDeduction] = useState<number>(0);
  const [advancesDeduction, setAdvancesDeduction] = useState<number>(0);
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Absence Form States
  const [absStaffId, setAbsStaffId] = useState<string>(staffMembers[0]?.id || '');
  const [absDate, setAbsDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [absDaysCount, setAbsDaysCount] = useState<number>(1);
  const [absReason, setAbsReason] = useState<string>('غياب غير مبرر');
  const [absCustomReason, setAbsCustomReason] = useState<string>('');

  // Staff Member Form States
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('مساعدة بيع وكراء');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffSalary, setNewStaffSalary] = useState<number | ''>(35000);
  const [newStaffWorkDays, setNewStaffWorkDays] = useState<number>(26);

  // Selected staff details & pending absences calculation
  const currentStaff = useMemo(() => {
    return staffMembers.find(s => s.id === selectedStaffId);
  }, [staffMembers, selectedStaffId]);

  // Pending (not yet deducted) absences for currently selected staff
  const pendingAbsences = useMemo(() => {
    if (!selectedStaffId) return [];
    return staffAbsences.filter(a => a.staffId === selectedStaffId && !a.isDeducted);
  }, [staffAbsences, selectedStaffId]);

  const pendingAbsenceDays = useMemo(() => {
    return pendingAbsences.reduce((sum, a) => sum + (a.daysCount || 1), 0);
  }, [pendingAbsences]);

  // When staff selection changes in Payout tab, recalculate defaults
  React.useEffect(() => {
    if (currentStaff) {
      const salary = currentStaff.baseSalary || 0;
      setBaseAmount(salary);
      const days = currentStaff.workDaysPerMonth || 26;
      const dailyRate = Math.round(salary / days);
      const calculatedDeduction = Math.round(pendingAbsenceDays * dailyRate);
      setAbsenceDeduction(calculatedDeduction);
      setCustomName(currentStaff.name);
    } else {
      setBaseAmount('');
      setAbsenceDeduction(0);
      setCustomName('');
    }
  }, [currentStaff, pendingAbsenceDays]);

  // Net final payout calculation
  const netPayoutAmount = useMemo(() => {
    const base = Number(baseAmount) || 0;
    const deduction = Number(absenceDeduction) || 0;
    const advances = Number(advancesDeduction) || 0;
    const bonus = Number(bonusAmount) || 0;
    return Math.max(0, base - deduction - advances + bonus);
  }, [baseAmount, absenceDeduction, advancesDeduction, bonusAmount]);

  // Handle Payout Submit
  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = currentStaff ? currentStaff.name : customName.trim();
    if (!finalName || netPayoutAmount <= 0) return;

    const deductedIds = pendingAbsences.map(a => a.id);

    onAddPayout(
      {
        staffId: currentStaff?.id,
        name: finalName,
        amount: netPayoutAmount,
        baseAmount: Number(baseAmount) || netPayoutAmount,
        absenceDeduction: Number(absenceDeduction) || 0,
        advancesDeduction: Number(advancesDeduction) || 0,
        bonus: Number(bonusAmount) || 0,
        absencesCount: pendingAbsenceDays,
        type: payoutType,
        date: new Date().toISOString(),
        notes: notes.trim() || undefined
      },
      deductedIds
    );

    setNotes('');
    setBonusAmount(0);
    setAdvancesDeduction(0);
  };

  // Handle Absence Submit
  const handleAbsenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetStaff = staffMembers.find(s => s.id === absStaffId);
    if (!targetStaff) return;

    const days = targetStaff.workDaysPerMonth || 26;
    const dailyRate = Math.round(targetStaff.baseSalary / days);
    const deduction = Math.round(dailyRate * absDaysCount);
    const reasonText = absReason === 'أخرى' ? absCustomReason.trim() : absReason;

    onAddAbsence({
      staffId: targetStaff.id,
      staffName: targetStaff.name,
      date: absDate,
      daysCount: absDaysCount,
      reason: reasonText,
      deductionAmount: deduction,
      isDeducted: false
    });

    setAbsCustomReason('');
  };

  // Handle New Staff Submit
  const handleNewStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffSalary) return;

    const salary = Number(newStaffSalary);
    const days = Number(newStaffWorkDays) || 26;

    onAddStaffMember({
      name: newStaffName.trim(),
      role: newStaffRole.trim(),
      phone: newStaffPhone.trim() || undefined,
      baseSalary: salary,
      salaryType: 'monthly',
      workDaysPerMonth: days,
      dailyRate: Math.round(salary / days),
      joinDate: new Date().toISOString().split('T')[0]
    });

    setNewStaffName('');
    setNewStaffPhone('');
  };

  const totalPayouts = staffPayouts.reduce((s, p) => s + (p.amount || 0), 0);
  const totalDeductions = staffPayouts.reduce((s, p) => s + (p.absenceDeduction || 0), 0);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('payout')}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'payout'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Banknote className="w-4 h-4 text-slate-600" />
          <span>صرف الراتب</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('absences')}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all relative flex items-center justify-center gap-1.5 ${
            activeTab === 'absences'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-slate-600" />
          <span>تسجيل الغياب</span>
          {staffAbsences.filter(a => !a.isDeducted).length > 0 && (
            <span className="w-2 h-2 bg-slate-900 rounded-full animate-pulse"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'staff'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-slate-600" />
          <span>العمال والرواتب</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4 text-slate-600" />
          <span>السجل</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PAYOUT WITH ABSENCE DEDUCTION (صرف الراتب والخصومات) */}
      {/* ========================================================= */}
      {activeTab === 'payout' && (
        <form onSubmit={handlePayoutSubmit} className="space-y-3">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-slate-600" />
                <span>حساب الراتب وتطبيق خصم الغيابات تلقائياً</span>
              </h4>
              {currentStaff && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-lg">
                  اليومية: {Math.round(currentStaff.baseSalary / (currentStaff.workDaysPerMonth || 26)).toLocaleString()} دج/يوم
                </span>
              )}
            </div>

            {/* Select Staff Member */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">اختر العامل/ة المسجل/ة</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                >
                  {staffMembers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role}) - راتب: {s.baseSalary.toLocaleString()} دج
                    </option>
                  ))}
                  <option value="">+ عامل غير مسجل (إدخال يدوي)</option>
                </select>
              </div>

              {!selectedStaffId && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">اسم العامل/ة * (حروف فقط)</label>
                  <LettersInput
                    required
                    value={customName}
                    onChange={setCustomName}
                    placeholder="الاسم الكامل (أحرف فقط)..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">نوع الدفعة</label>
                <select
                  value={payoutType}
                  onChange={(e) => setPayoutType(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-slate-800"
                >
                  <option value="راتب شهري">راتب شهري</option>
                  <option value="نسبة مبيعات/كراء">نسبة مبيعات/كراء</option>
                  <option value="تسليف (عربون)">تسليف (عربون)</option>
                  <option value="مكافأة">مكافأة</option>
                  <option value="تسوية غيابات وحساب">تسوية غيابات وحساب</option>
                </select>
              </div>
            </div>

            {/* Calculations Breakdown Card */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Base Salary */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">الراتب الأساسي (دج)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                  />
                </div>

                {/* 2. Absence Deduction */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-700">خصم الغيابات (-)</label>
                    {pendingAbsenceDays > 0 && (
                      <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {pendingAbsenceDays} يوم
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={absenceDeduction}
                    onChange={(e) => setAbsenceDeduction(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800"
                  />
                </div>

                {/* 3. Advances / Deductions */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">خصم تسبيقات سابقة (-)</label>
                  <input
                    type="number"
                    min="0"
                    value={advancesDeduction}
                    onChange={(e) => setAdvancesDeduction(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800"
                  />
                </div>

                {/* 4. Bonus */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">مكافأة تشجيعية (+)</label>
                  <input
                    type="number"
                    min="0"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              {/* Pending Absences Notice */}
              {pendingAbsences.length > 0 ? (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>أيام غياب مسجلة لم يتم خصمها بعد ({pendingAbsences.length} أيام):</span>
                    </span>
                    <span className="font-bold text-slate-900">خصم مقترح: {absenceDeduction.toLocaleString()} دج</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pendingAbsences.map(a => (
                      <span key={a.id} className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700">
                        {a.date} ({a.daysCount === 0.5 ? 'نصف يوم' : `${a.daysCount} يوم`}) - {a.reason || 'بدون سبب'}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                currentStaff && (
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-slate-500" />
                    <span>لا توجد أي أيام غياب مسجلة غير مخصومة لهذا العامل.</span>
                  </div>
                )
              )}

              {/* Notes */}
              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات حول الدفعة أو تفاصيل الخصم..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-slate-800"
                />
              </div>
            </div>

            {/* Net Salary Summary */}
            <div className="flex items-center justify-between p-3.5 bg-slate-100 border border-slate-200 rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-900 block">الصافي المستحق للدفع (Net Payout):</span>
                <span className="text-[10px] text-slate-500">
                  الأساسي ({Number(baseAmount) || 0}) - غيابات ({absenceDeduction}) - سلفيات ({advancesDeduction}) + مكافأة ({bonusAmount})
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {hideFinances ? '•••• دج' : `${netPayoutAmount.toLocaleString()} دج`}
              </div>
            </div>

            <button
              type="submit"
              disabled={netPayoutAmount <= 0}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>تأكيد صرف الراتب وخصم أيام الغياب</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ABSENCE TRACKER (تسجيل وإدارة الغيابات) */}
      {/* ========================================================= */}
      {activeTab === 'absences' && (
        <div className="space-y-3">
          {/* New Absence Form */}
          <form onSubmit={handleAbsenceSubmit} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-600" />
              <span>تسجيل غياب جديد لعامل لحساب الخصم</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">اختر العامل/ة *</label>
                <select
                  required
                  value={absStaffId}
                  onChange={(e) => setAbsStaffId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
                >
                  {staffMembers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">تاريخ الغياب *</label>
                <input
                  type="date"
                  required
                  value={absDate}
                  onChange={(e) => setAbsDate(e.target.value)}
                  className="w-[145px] sm:w-[155px] bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">المدة (أيام)</label>
                <select
                  value={absDaysCount}
                  onChange={(e) => setAbsDaysCount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
                >
                  <option value={1}>يوم كامل (1.0)</option>
                  <option value={0.5}>نصف يوم (0.5)</option>
                  <option value={2}>يومان (2.0)</option>
                  <option value={3}>3 أيام (3.0)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">سبب الغياب</label>
                <select
                  value={absReason}
                  onChange={(e) => setAbsReason(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
                >
                  <option value="غياب غير مبرر">غياب غير مبرر (يُخصم)</option>
                  <option value="عطلة مرضية">عطلة مرضية</option>
                  <option value="ظرف عائلي طارئ">ظرف عائلي طارئ</option>
                  <option value="تأخر كبير عن الدوام">تأخر كبير عن الدوام</option>
                  <option value="أخرى">سبب آخر...</option>
                </select>
              </div>

              {absReason === 'أخرى' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">اكتب السبب بالتفصيل (حروف فقط)</label>
                  <LettersInput
                    required
                    value={absCustomReason}
                    onChange={setAbsCustomReason}
                    placeholder="سبب الغياب (أحرف فقط)..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة الغياب للسجل</span>
            </button>
          </form>

          {/* Absences List */}
          <div className="space-y-2">
            <h5 className="font-bold text-slate-700 text-xs">سجل غيابات العمال:</h5>
            {staffAbsences.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                لا توجد أي غيابات مسجلة حالياً.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1 bg-white border border-slate-200 rounded-xl">
                {staffAbsences.map(a => (
                  <div key={a.id} className="p-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>{a.staffName}</span>
                        {a.isDeducted ? (
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                            تم الخصم
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                            معلق للخصم
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {a.date} • المدة: {a.daysCount === 0.5 ? 'نصف يوم' : `${a.daysCount} يوم`} • السبب: {a.reason || 'بدون سبب'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">-{a.deductionAmount.toLocaleString()} دج</span>
                      <button 
                        onClick={() => onDeleteAbsence(a.id)} 
                        title="حذف الغياب"
                        className="text-slate-300 hover:text-black p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: STAFF DIRECTORY (إدارة العمال والرواتب الأساسية) */}
      {/* ========================================================= */}
      {activeTab === 'staff' && (
        <div className="space-y-3">
          {/* Add Staff Member Form */}
          <form onSubmit={handleNewStaffSubmit} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-slate-600" />
              <span>إضافة عامل / مساعدة جديدة وتحديد الراتب وأيام العمل</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">اسم العامل/ة * (حروف فقط)</label>
                <LettersInput
                  required
                  value={newStaffName}
                  onChange={setNewStaffName}
                  placeholder="مثال: ياسمين بن علي..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">المهمة / الدور (حروف فقط)</label>
                <LettersInput
                  required
                  value={newStaffRole}
                  onChange={setNewStaffRole}
                  placeholder="مساعدة بيع، خياطة..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">رقم الهاتف (أرقام فقط)</label>
                <NumbersInput
                  allowPlus
                  value={newStaffPhone}
                  onChange={setNewStaffPhone}
                  placeholder="05XXXXXXXX"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">الراتب الأساسي الشهري (دج) *</label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={newStaffSalary}
                  onChange={(e) => setNewStaffSalary(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="35000"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">أيام العمل في الشهر (لحساب اليومية)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="31"
                  value={newStaffWorkDays}
                  onChange={(e) => setNewStaffWorkDays(Number(e.target.value))}
                  placeholder="26"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>حفظ بيانات العامل</span>
            </button>
          </form>

          {/* Staff Members List */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h5 className="font-bold text-slate-800 text-xs">قائمة العمال المسجلين ({staffMembers.length}):</h5>
              <span className="text-[10px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200/80">
                <Sparkles className="w-3 h-3 text-slate-500" />
                <span>اضغط على أي عامل لعرض كشف المعاملات (يومي / شهري)</span>
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {staffMembers.map(s => {
                const days = s.workDaysPerMonth || 26;
                const daily = Math.round(s.baseSalary / days);
                const absences = staffAbsences.filter(a => a.staffId === s.id);
                const pendingCount = absences.filter(a => !a.isDeducted).reduce((sum, a) => sum + (a.daysCount || 1), 0);

                return (
                  <div 
                    key={s.id} 
                    onClick={() => setInspectingMember(s)}
                    className="p-3.5 bg-white border border-slate-200/80 hover:border-slate-400 rounded-2xl space-y-2.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-slate-950 transition-colors flex items-center gap-1.5">
                          <span>{s.name}</span>
                          <span className="text-[10px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                            كشف الحساب ➔
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{s.role} {s.phone ? `• ${s.phone}` : ''}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteStaffMember(s.id);
                        }}
                        className="text-slate-300 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                        title="حذف العامل"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                      <div>
                        <span className="text-slate-500 block text-[9px] font-sans">الراتب الشهري</span>
                        <span className="font-bold text-slate-800">{hideFinances ? '••••' : `${s.baseSalary.toLocaleString()} دج`}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] font-sans">سعر اليومية ({days} يوم)</span>
                        <span className="font-semibold text-slate-800">{hideFinances ? '••••' : `${daily.toLocaleString()} دج`}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] font-sans">غيابات معلقة</span>
                        <span className={`font-semibold ${pendingCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                          {pendingCount} يوم
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-600 font-medium">
                      <span>عرض المعاملات والرواتب والسلفيات</span>
                      <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: PAYOUTS HISTORY (سجل المدفوعات السابقة) */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500 pb-1 border-b border-slate-100">
            <span>سجل الرواتب والمدفوعات</span>
            <div className="flex gap-2">
              <span>الصافي المدفوع: {hideFinances ? '••••' : `${totalPayouts.toLocaleString()} دج`}</span>
              {totalDeductions > 0 && (
                <span className="text-slate-600">(إجمالي الخصومات: {totalDeductions.toLocaleString()} دج)</span>
              )}
            </div>
          </div>

          {staffPayouts.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              لم يتم تسجيل أي مدفوعات رواتب بعد.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1 bg-white border border-slate-200 rounded-xl">
              {staffPayouts.map(p => {
                const matchedMember = staffMembers.find(s => s.id === p.staffId || s.name.trim().toLowerCase() === p.name.trim().toLowerCase());

                return (
                  <div key={p.id} className="p-3 flex justify-between items-center text-xs hover:bg-slate-50/60 transition-colors">
                    <div 
                      onClick={() => {
                        if (matchedMember) setInspectingMember(matchedMember);
                      }}
                      className={matchedMember ? 'cursor-pointer group' : ''}
                    >
                      <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {matchedMember && (
                          <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 border border-blue-100">
                            <Search className="w-2.5 h-2.5" />
                            <span>كشف الحساب</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {p.type} • {new Date(p.date).toLocaleDateString('ar-DZ')}
                        {p.absencesCount ? ` • خصم ${p.absencesCount} يوم غياب` : ''}
                        {p.notes ? ` • ${p.notes}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-left">
                        <div className="font-bold text-slate-900">{hideFinances ? '••••' : `${p.amount.toLocaleString()} دج`}</div>
                        {p.absenceDeduction && !hideFinances ? (
                          <div className="text-[9px] text-slate-500">خصم: -{p.absenceDeduction.toLocaleString()} دج</div>
                        ) : null}
                      </div>
                      <button 
                        onClick={() => onDeletePayout(p.id)} 
                        title="حذف السجل"
                        className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50"
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
      )}

      {/* Staff Member Detailed Ledger & Transactions Modal */}
      {inspectingMember && (
        <StaffMemberLedgerModal
          member={inspectingMember}
          allMembers={staffMembers}
          staffPayouts={staffPayouts}
          staffAbsences={staffAbsences}
          onClose={() => setInspectingMember(null)}
          onSelectMember={(m) => setInspectingMember(m)}
          onAddPayout={onAddPayout}
          onDeletePayout={onDeletePayout}
          onAddAbsence={onAddAbsence}
          onDeleteAbsence={onDeleteAbsence}
          hideFinances={hideFinances}
        />
      )}
    </div>
  );
};

