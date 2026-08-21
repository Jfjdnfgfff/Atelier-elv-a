import React, { useState, useMemo } from 'react';
import { StaffPayout, StaffMember, StaffAbsence } from '../types';

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
          className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
            activeTab === 'payout'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>💵</span>
          <span>صرف الراتب</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('absences')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition-all relative flex items-center justify-center gap-1 ${
            activeTab === 'absences'
              ? 'bg-white text-rose-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>📅</span>
          <span>تسجيل الغياب</span>
          {staffAbsences.filter(a => !a.isDeducted).length > 0 && (
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
            activeTab === 'staff'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>👥</span>
          <span>العمال والرواتب</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
            activeTab === 'history'
              ? 'bg-white text-slate-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>📜</span>
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
              <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                <span>💰</span>
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">اسم العامل/ة *</label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="الاسم الكامل..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">نوع الدفعة</label>
                <select
                  value={payoutType}
                  onChange={(e) => setPayoutType(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-black text-slate-800 focus:outline-none"
                  />
                </div>

                {/* 2. Absence Deduction */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-rose-600">خصم الغيابات (-)</label>
                    {pendingAbsenceDays > 0 && (
                      <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                        {pendingAbsenceDays} يوم
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={absenceDeduction}
                    onChange={(e) => setAbsenceDeduction(Number(e.target.value) || 0)}
                    className="w-full bg-rose-50/60 border border-rose-200 rounded-xl px-2.5 py-2 text-xs font-black text-rose-700 focus:outline-none"
                  />
                </div>

                {/* 3. Advances / Deductions */}
                <div>
                  <label className="block text-[10px] font-bold text-amber-600 mb-1">خصم تسبيقات سابقة (-)</label>
                  <input
                    type="number"
                    min="0"
                    value={advancesDeduction}
                    onChange={(e) => setAdvancesDeduction(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-amber-50/60 border border-amber-200 rounded-xl px-2.5 py-2 text-xs font-black text-amber-700 focus:outline-none"
                  />
                </div>

                {/* 4. Bonus */}
                <div>
                  <label className="block text-[10px] font-bold text-emerald-600 mb-1">مكافأة تشجيعية (+)</label>
                  <input
                    type="number"
                    min="0"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-emerald-50/60 border border-emerald-200 rounded-xl px-2.5 py-2 text-xs font-black text-emerald-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Pending Absences Notice */}
              {pendingAbsences.length > 0 ? (
                <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-xs space-y-1">
                  <div className="font-bold text-rose-800 flex items-center justify-between">
                    <span>⚠️ أيام غياب مسجلة لم يتم خصمها بعد ({pendingAbsences.length} أيام):</span>
                    <span className="font-black text-rose-600">خصم مقترح: {absenceDeduction.toLocaleString()} دج</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pendingAbsences.map(a => (
                      <span key={a.id} className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-rose-200 text-slate-700">
                        📅 {a.date} ({a.daysCount === 0.5 ? 'نصف يوم' : `${a.daysCount} يوم`}) - {a.reason || 'بدون سبب'}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                currentStaff && (
                  <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-700 font-bold flex items-center gap-1.5">
                    <span>✓</span>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            </div>

            {/* Net Salary Summary */}
            <div className="flex items-center justify-between p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div>
                <span className="text-xs font-bold text-indigo-900 block">الصافي المستحق للدفع (Net Payout):</span>
                <span className="text-[10px] text-slate-500">
                  الأساسي ({Number(baseAmount) || 0}) - غيابات ({absenceDeduction}) - سلفيات ({advancesDeduction}) + مكافأة ({bonusAmount})
                </span>
              </div>
              <div className="text-lg font-black text-indigo-700">
                {hideFinances ? '•••• دج' : `${netPayoutAmount.toLocaleString()} دج`}
              </div>
            </div>

            <button
              type="submit"
              disabled={netPayoutAmount <= 0}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5"
            >
              <span>✓</span>
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
            <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
              <span>📅</span>
              <span>تسجيل غياب جديد لعامل لحساب الخصم</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">اختر العامل/ة *</label>
                <select
                  required
                  value={absStaffId}
                  onChange={(e) => setAbsStaffId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
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
                  className="w-[145px] sm:w-[155px] bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">المدة (أيام)</label>
                <select
                  value={absDaysCount}
                  onChange={(e) => setAbsDaysCount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
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
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">اكتب السبب بالتفصيل</label>
                  <input
                    type="text"
                    required
                    value={absCustomReason}
                    onChange={(e) => setAbsCustomReason(e.target.value)}
                    placeholder="سبب الغياب..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-xl text-xs font-black transition-all shadow-xs"
            >
              + إضافة الغياب للسجل
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
                      <div className="font-black text-slate-800 flex items-center gap-1.5">
                        <span>{a.staffName}</span>
                        {a.isDeducted ? (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                            تم الخصم ✓
                          </span>
                        ) : (
                          <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                            معلق للخصم ⏳
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        📅 {a.date} • المدة: {a.daysCount === 0.5 ? 'نصف يوم' : `${a.daysCount} يوم`} • السبب: {a.reason || 'بدون سبب'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-rose-600">-{a.deductionAmount.toLocaleString()} دج</span>
                      <button 
                        onClick={() => onDeleteAbsence(a.id)} 
                        title="حذف الغياب"
                        className="text-slate-300 hover:text-rose-600 p-1 text-sm font-bold"
                      >
                        ✕
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
            <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
              <span>👤</span>
              <span>إضافة عامل / مساعدة جديدة وتحديد الراتب وأيام العمل</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">اسم العامل/ة *</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="مثال: ياسمين بن علي..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">المهمة / الدور</label>
                <input
                  type="text"
                  required
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  placeholder="مساعدة بيع، خياطة..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-indigo-700 focus:outline-none"
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black transition-all shadow-xs"
            >
              + حفظ بيانات العامل
            </button>
          </form>

          {/* Staff Members List */}
          <div className="space-y-2">
            <h5 className="font-bold text-slate-700 text-xs">قائمة العمال المسجلين ({staffMembers.length}):</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {staffMembers.map(s => {
                const days = s.workDaysPerMonth || 26;
                const daily = Math.round(s.baseSalary / days);
                const absences = staffAbsences.filter(a => a.staffId === s.id);
                const pendingCount = absences.filter(a => !a.isDeducted).reduce((sum, a) => sum + (a.daysCount || 1), 0);

                return (
                  <div key={s.id} className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-black text-slate-800 text-xs">{s.name}</div>
                        <div className="text-[10px] text-slate-400">{s.role} {s.phone ? `• ${s.phone}` : ''}</div>
                      </div>
                      <button
                        onClick={() => onDeleteStaffMember(s.id)}
                        className="text-slate-300 hover:text-rose-600 text-xs"
                        title="حذف العامل"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-500 block text-[9px]">الراتب الشهري</span>
                        <span className="font-black text-slate-800">{s.baseSalary.toLocaleString()} دج</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">سعر اليومية ({days} يوم)</span>
                        <span className="font-black text-indigo-700">{daily.toLocaleString()} دج</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">غيابات معلقة</span>
                        <span className={`font-black ${pendingCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {pendingCount} يوم
                        </span>
                      </div>
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
                <span className="text-rose-600">(إجمالي الخصومات: {totalDeductions.toLocaleString()} دج)</span>
              )}
            </div>
          </div>

          {staffPayouts.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              لم يتم تسجيل أي مدفوعات رواتب بعد.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1 bg-white border border-slate-200 rounded-xl">
              {staffPayouts.map(p => (
                <div key={p.id} className="p-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-black text-slate-800">{p.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {p.type} • {new Date(p.date).toLocaleDateString('ar-DZ')}
                      {p.absencesCount ? ` • خصم ${p.absencesCount} يوم غياب` : ''}
                      {p.notes ? ` • ${p.notes}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <div className="font-black text-indigo-700">{p.amount.toLocaleString()} دج</div>
                      {p.absenceDeduction ? (
                        <div className="text-[9px] text-rose-500">خصم: -{p.absenceDeduction.toLocaleString()} دج</div>
                      ) : null}
                    </div>
                    <button 
                      onClick={() => onDeletePayout(p.id)} 
                      title="حذف السجل"
                      className="text-slate-300 hover:text-rose-600 p-1 text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
