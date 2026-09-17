import React, { useState, useMemo } from 'react';
import { 
  Sale, 
  Rental, 
  Expense, 
  StaffPayout, 
  MaintenanceOrder, 
  DailyCaisseClosure 
} from '../types';
import { Modal } from './Shared';
import { CaisseReceiptModal } from './CaisseReceiptModal';

interface CaisseViewProps {
  sales: Sale[];
  rentals: Rental[];
  expenses: Expense[];
  staffPayouts: StaffPayout[];
  maintenanceOrders: MaintenanceOrder[];
  caisseClosures: DailyCaisseClosure[];
  onSaveClosure: (closure: DailyCaisseClosure) => void;
  onDeleteClosure: (closureId: string) => void;
  hideFinances: boolean;
  onPrivacyToggle: () => void;
}

export const CaisseView: React.FC<CaisseViewProps> = ({
  sales,
  rentals,
  expenses,
  staffPayouts,
  maintenanceOrders,
  caisseClosures,
  onSaveClosure,
  onDeleteClosure,
  hideFinances,
  onPrivacyToggle
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [viewTab, setViewTab] = useState<'today' | 'history'>('today');

  // Filter history by month and year
  const [historyYear, setHistoryYear] = useState<string>(today.split('-')[0]);
  const [historyMonth, setHistoryMonth] = useState<string>(today.split('-')[1]);

  // Denominations for counting Algerian Dinars
  const [showDenominations, setShowDenominations] = useState<boolean>(false);
  const [counts, setCounts] = useState<{ [key: string]: number }>({
    '2000': 0,
    '1000': 0,
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    'coins': 0
  });

  // Selected closure for receipt printing
  const [selectedClosureForReceipt, setSelectedClosureForReceipt] = useState<DailyCaisseClosure | null>(null);

  // Check if a closure is already saved for selected date
  const existingClosure = useMemo(() => {
    return caisseClosures.find(c => c.date === selectedDate);
  }, [caisseClosures, selectedDate]);

  // Inputs state
  const [openingBalance, setOpeningBalance] = useState<number>(existingClosure ? existingClosure.openingBalance : 0);
  const [actualInput, setActualInput] = useState<string>(existingClosure ? String(existingClosure.actualAmount) : '');
  const [notes, setNotes] = useState<string>(existingClosure ? (existingClosure.notes || '') : '');

  // When date changes or existing closure updates, sync form inputs
  React.useEffect(() => {
    if (existingClosure) {
      setOpeningBalance(existingClosure.openingBalance || 0);
      setActualInput(String(existingClosure.actualAmount));
      setNotes(existingClosure.notes || '');
    } else {
      setOpeningBalance(0);
      setActualInput('');
      setNotes('');
    }
    // Reset denomination counter
    setCounts({
      '2000': 0,
      '1000': 0,
      '500': 0,
      '200': 0,
      '100': 0,
      '50': 0,
      '20': 0,
      '10': 0,
      'coins': 0
    });
  }, [selectedDate, existingClosure]);

  // Handle denomination count change
  const handleCountChange = (denom: string, val: number) => {
    const safeVal = Math.max(0, val || 0);
    const newCounts = { ...counts, [denom]: safeVal };
    setCounts(newCounts);

    // Sum up
    const totalDenom = 
      (newCounts['2000'] * 2000) +
      (newCounts['1000'] * 1000) +
      (newCounts['500'] * 500) +
      (newCounts['200'] * 200) +
      (newCounts['100'] * 100) +
      (newCounts['50'] * 50) +
      (newCounts['20'] * 20) +
      (newCounts['10'] * 10) +
      (newCounts['coins'] || 0);

    setActualInput(String(totalDenom));
  };

  // ==========================================
  // 1. CALCULATIONS FOR SELECTED DATE (FI NHAR)
  // ==========================================
  const dateSales = useMemo(() => {
    return sales.filter(s => s.date && s.date.startsWith(selectedDate));
  }, [sales, selectedDate]);

  const dateSalesIncome = useMemo(() => {
    return dateSales.reduce((sum, s) => sum + (s.paidAmount !== undefined ? s.paidAmount : s.totalAmount || 0), 0);
  }, [dateSales]);

  const dateRentals = useMemo(() => {
    return rentals.filter(r => 
      (r.createdAt && r.createdAt.startsWith(selectedDate)) ||
      (r.startDate && r.startDate.startsWith(selectedDate)) ||
      (r.handoverDate && r.handoverDate.startsWith(selectedDate))
    );
  }, [rentals, selectedDate]);

  const dateRentalsIncome = useMemo(() => {
    return dateRentals.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  }, [dateRentals]);

  const dateCautionsReceived = useMemo(() => {
    return dateRentals.reduce((sum, r) => sum + (r.cautionStatus === 'held' ? (r.cautionAmount || 0) : 0), 0);
  }, [dateRentals]);

  const dateTailoring = useMemo(() => {
    return maintenanceOrders.filter(o => 
      (o.receivedDate && o.receivedDate.startsWith(selectedDate)) ||
      (o.createdAt && o.createdAt.startsWith(selectedDate))
    );
  }, [maintenanceOrders, selectedDate]);

  const dateTailoringIncome = useMemo(() => {
    return dateTailoring.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  }, [dateTailoring]);

  const dateExpenses = useMemo(() => {
    return expenses.filter(e => e.date && e.date.startsWith(selectedDate));
  }, [expenses, selectedDate]);

  const dateExpensesPaid = useMemo(() => {
    return dateExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [dateExpenses]);

  const dateStaffPayouts = useMemo(() => {
    return staffPayouts.filter(p => p.date && p.date.startsWith(selectedDate));
  }, [staffPayouts, selectedDate]);

  const dateStaffPayoutsPaid = useMemo(() => {
    return dateStaffPayouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [dateStaffPayouts]);

  // Total daily Inflow & Outflow
  const totalDailyInflow = dateSalesIncome + dateRentalsIncome + dateTailoringIncome + dateCautionsReceived;
  const totalDailyOutflow = dateExpensesPaid + dateStaffPayoutsPaid;

  // Expected / Theoretical amount in register drawer
  const theoreticalAmount = openingBalance + totalDailyInflow - totalDailyOutflow;

  // Actual counted amount in drawer
  const actualAmount = Number(actualInput) || 0;

  // Difference / Discrepancy for the day (Fi Nhar):
  // actual - theoretical: negative = shortage (manque), positive = surplus (excédent)
  const dailyDifference = actualAmount - theoreticalAmount;
  const hasEnteredActual = actualInput.trim() !== '';

  const dailyStatus: 'balanced' | 'shortage' | 'surplus' = 
    dailyDifference < 0 ? 'shortage' : dailyDifference > 0 ? 'surplus' : 'balanced';

  // ==========================================
  // 2. CUMULATIVE MONTH STATS (FI CHHAR)
  // ==========================================
  const currentMonthPrefix = selectedDate.substring(0, 7); // YYYY-MM
  const currentYearPrefix = selectedDate.substring(0, 4); // YYYY

  // Closures for this month (excluding selectedDate to avoid double counting if active)
  const monthStats = useMemo(() => {
    // Closures in this month
    const pastClosuresInMonth = caisseClosures.filter(c => 
      c.date.startsWith(currentMonthPrefix) && c.date !== selectedDate
    );

    let totalTheoretical = pastClosuresInMonth.reduce((s, c) => s + (c.theoreticalAmount || 0), 0);
    let totalActual = pastClosuresInMonth.reduce((s, c) => s + (c.actualAmount || 0), 0);
    let totalDiff = pastClosuresInMonth.reduce((s, c) => s + (c.difference || 0), 0);
    let daysCount = pastClosuresInMonth.length;

    // Add current day's numbers (either from existing closure or live input if entered)
    if (existingClosure) {
      totalTheoretical += existingClosure.theoreticalAmount;
      totalActual += existingClosure.actualAmount;
      totalDiff += existingClosure.difference;
      daysCount += 1;
    } else if (hasEnteredActual) {
      totalTheoretical += theoreticalAmount;
      totalActual += actualAmount;
      totalDiff += dailyDifference;
      daysCount += 1;
    }

    return {
      totalTheoretical,
      totalActual,
      totalDiff,
      daysCount
    };
  }, [caisseClosures, currentMonthPrefix, selectedDate, existingClosure, hasEnteredActual, theoreticalAmount, actualAmount, dailyDifference]);

  // ==========================================
  // 3. CUMULATIVE YEAR STATS (FI L3AM)
  // ==========================================
  const yearStats = useMemo(() => {
    const pastClosuresInYear = caisseClosures.filter(c => 
      c.date.startsWith(currentYearPrefix) && c.date !== selectedDate
    );

    let totalTheoretical = pastClosuresInYear.reduce((s, c) => s + (c.theoreticalAmount || 0), 0);
    let totalActual = pastClosuresInYear.reduce((s, c) => s + (c.actualAmount || 0), 0);
    let totalDiff = pastClosuresInYear.reduce((s, c) => s + (c.difference || 0), 0);
    let daysCount = pastClosuresInYear.length;

    if (existingClosure) {
      totalTheoretical += existingClosure.theoreticalAmount;
      totalActual += existingClosure.actualAmount;
      totalDiff += existingClosure.difference;
      daysCount += 1;
    } else if (hasEnteredActual) {
      totalTheoretical += theoreticalAmount;
      totalActual += actualAmount;
      totalDiff += dailyDifference;
      daysCount += 1;
    }

    return {
      totalTheoretical,
      totalActual,
      totalDiff,
      daysCount
    };
  }, [caisseClosures, currentYearPrefix, selectedDate, existingClosure, hasEnteredActual, theoreticalAmount, actualAmount, dailyDifference]);

  // Handle Save / Clôture
  const handleSaveCaisse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEnteredActual && actualAmount === 0 && !window.confirm('المبلغ الفعلي المسجل هو 0 دج. هل أنت متأكد من الحفظ؟')) {
      return;
    }

    const closureRecord: DailyCaisseClosure = {
      id: existingClosure ? existingClosure.id : `caisse_${Date.now()}`,
      date: selectedDate,
      openingBalance,
      salesIncome: dateSalesIncome,
      rentalsIncome: dateRentalsIncome,
      tailoringIncome: dateTailoringIncome,
      cautionsReceived: dateCautionsReceived,
      expensesPaid: dateExpensesPaid,
      staffPayoutsPaid: dateStaffPayoutsPaid,
      cautionsRefunded: 0,
      totalInflow: totalDailyInflow,
      totalOutflow: totalDailyOutflow,
      theoreticalAmount,
      actualAmount,
      difference: dailyDifference,
      status: dailyStatus,
      notes: notes.trim(),
      closedAt: new Date().toISOString()
    };

    onSaveClosure(closureRecord);
  };

  // Filter history
  const filteredHistory = useMemo(() => {
    return caisseClosures
      .filter(c => {
        if (!c.date) return false;
        const [y, m] = c.date.split('-');
        if (historyYear && y !== historyYear) return false;
        if (historyMonth && m !== historyMonth) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [caisseClosures, historyYear, historyMonth]);

  const historyTotals = useMemo(() => {
    const totalTh = filteredHistory.reduce((s, c) => s + (c.theoreticalAmount || 0), 0);
    const totalAc = filteredHistory.reduce((s, c) => s + (c.actualAmount || 0), 0);
    const totalDf = filteredHistory.reduce((s, c) => s + (c.difference || 0), 0);
    return { totalTh, totalAc, totalDf };
  }, [filteredHistory]);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl text-lg font-black border border-rose-100">
              ⚖️
            </span>
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900">
                صندوق اليومية ومتابعة العجز (La Caisse Journalière)
              </h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                حساب مدخول اليوم، تسجيل المبلغ الفعلي، وتحديد فارق وعجز الصندوق في اليوم، الشهر، والسنة
              </p>
            </div>
          </div>
        </div>

        {/* View Tabs & Privacy Toggle */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-black">
            <button
              onClick={() => setViewTab('today')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                viewTab === 'today' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 صندوق اليوم ({selectedDate === today ? 'اليوم' : selectedDate})
            </button>
            <button
              onClick={() => setViewTab('history')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                viewTab === 'history' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📚 سجل الإقفالات السابقة ({caisseClosures.length})
            </button>
          </div>

          <button
            onClick={onPrivacyToggle}
            title="إخفاء/إظهار المبالغ"
            className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <span>{hideFinances ? '👁️ إظهار' : '🔒 إخفاء'}</span>
          </button>
        </div>
      </div>

      {/* Date Bar for Today's view */}
      {viewTab === 'today' && (
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">اختر تاريخ الصندوق للمراجعة والإقفال:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-rose-500"
            />
            {selectedDate !== today && (
              <button
                onClick={() => setSelectedDate(today)}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-all"
              >
                العودة لليوم
              </button>
            )}
          </div>

          {/* Status Badge */}
          <div>
            {existingClosure ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                تم إقفال صندوق هذا اليوم (حفظ في: {new Date(existingClosure.closedAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                الصندوق قيد الاحتساب (لم يتم حفظ الإقفال بعد)
              </span>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4 PRIMARY KPI CARDS REQUESTED BY THE USER:            */}
      {/* 1. Madkhoul lyoum                                    */}
      {/* 2. Manque te3 la caisse fi nhar                      */}
      {/* 3. Manque te3 la caisse fi chhar                     */}
      {/* 4. Manque te3 la caisse fi l3am                      */}
      {/* ==================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. MADKHOUL TE3 LA JOURNEE (مدخول اليوم) */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-slate-500">إجمالي مدخول اليوم (المقبوضات)</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl text-base">💰</span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {hideFinances ? '••••••' : `${totalDailyInflow.toLocaleString()} دج`}
          </div>
          <div className="mt-2 text-[11px] font-bold text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>مبيعات: {hideFinances ? '••' : `${dateSalesIncome.toLocaleString()}`}</span>
            <span>كراء: {hideFinances ? '••' : `${dateRentalsIncome.toLocaleString()}`}</span>
            <span>خياطة: {hideFinances ? '••' : `${dateTailoringIncome.toLocaleString()}`}</span>
          </div>
        </div>

        {/* 2. MANQUE TE3 LA CAISSE FI NHAR (فارق وعجز اليوم) */}
        <div className={`p-4 sm:p-5 rounded-3xl border shadow-xs relative overflow-hidden transition-all ${
          !hasEnteredActual && !existingClosure
            ? 'bg-slate-50 border-slate-200'
            : dailyDifference < 0 
            ? 'bg-rose-50/70 border-rose-300' 
            : dailyDifference > 0 
            ? 'bg-blue-50/70 border-blue-300' 
            : 'bg-emerald-50/70 border-emerald-300'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-black text-slate-700">فارق صندوق اليوم (Fi Nhar)</span>
              <div className="text-[10px] font-bold text-slate-500">المحسوب فعلياً - المتوقع نظرياً</div>
            </div>
            <span className={`p-2 rounded-xl text-base ${
              !hasEnteredActual && !existingClosure ? 'bg-slate-200 text-slate-600' :
              dailyDifference < 0 ? 'bg-rose-100 text-rose-700' :
              dailyDifference > 0 ? 'bg-blue-100 text-blue-700' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              {dailyDifference < 0 ? '⚠️' : dailyDifference > 0 ? '📈' : '✅'}
            </span>
          </div>
          <div className="mt-2">
            {!hasEnteredActual && !existingClosure ? (
              <div className="text-sm font-bold text-slate-500 py-1.5">
                أدخل المبلغ الفعلي في الدرج لاحتساب الفارق
              </div>
            ) : (
              <div className={`text-2xl sm:text-3xl font-black font-mono ${
                dailyDifference < 0 ? 'text-rose-700' :
                dailyDifference > 0 ? 'text-blue-700' :
                'text-emerald-700'
              }`}>
                {hideFinances ? '••••••' : (
                  dailyDifference > 0 ? `+${dailyDifference.toLocaleString()} دج` : `${dailyDifference.toLocaleString()} دج`
                )}
              </div>
            )}
          </div>
          <div className="mt-2 text-[11px] font-bold flex items-center justify-between border-t border-slate-200/60 pt-2">
            {dailyDifference < 0 ? (
              <span className="text-rose-800 font-black">عجز ونقص في الصندوق (Manque)</span>
            ) : dailyDifference > 0 ? (
              <span className="text-blue-800 font-black">فائض وزيادة في الصندوق (Excédent)</span>
            ) : (
              <span className="text-emerald-800 font-black">الصندوق مضبوط 100% (Conforme)</span>
            )}
            <span className="text-slate-500">تاريخ: {selectedDate.substring(5)}</span>
          </div>
        </div>

        {/* 3. MANQUE TE3 LA CAISSE FI CHHAR (فارق وعجز الشهر) */}
        <div className={`p-4 sm:p-5 rounded-3xl border shadow-xs relative overflow-hidden transition-all ${
          monthStats.totalDiff < 0 
            ? 'bg-rose-50/50 border-rose-200' 
            : monthStats.totalDiff > 0 
            ? 'bg-blue-50/50 border-blue-200' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-black text-slate-700">فارق الصندوق للشهر (Fi Chhar)</span>
              <div className="text-[10px] font-bold text-slate-500">شهر {currentMonthPrefix} ({monthStats.daysCount} أيام مسجلة)</div>
            </div>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-base">📊</span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono">
            {hideFinances ? '••••••' : (
              <span className={monthStats.totalDiff < 0 ? 'text-rose-700' : monthStats.totalDiff > 0 ? 'text-blue-700' : 'text-slate-900'}>
                {monthStats.totalDiff > 0 ? `+${monthStats.totalDiff.toLocaleString()} دج` : `${monthStats.totalDiff.toLocaleString()} دج`}
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] font-bold text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>
              {monthStats.totalDiff < 0 ? 'إجمالي عجز الشهر' : monthStats.totalDiff > 0 ? 'إجمالي فائض الشهر' : 'مطابق شهرياً'}
            </span>
            <span className="text-[10px] text-slate-400">
              فعلي: {hideFinances ? '••' : monthStats.totalActual.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 4. MANQUE TE3 LA CAISSE FI L3AM (فارق وعجز السنة) */}
        <div className={`p-4 sm:p-5 rounded-3xl border shadow-xs relative overflow-hidden transition-all ${
          yearStats.totalDiff < 0 
            ? 'bg-rose-50/50 border-rose-200' 
            : yearStats.totalDiff > 0 
            ? 'bg-blue-50/50 border-blue-200' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-black text-slate-700">فارق الصندوق للسنة (Fi L3am)</span>
              <div className="text-[10px] font-bold text-slate-500">سنة {currentYearPrefix} ({yearStats.daysCount} يوم مسجل)</div>
            </div>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl text-base">🗓️</span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono">
            {hideFinances ? '••••••' : (
              <span className={yearStats.totalDiff < 0 ? 'text-rose-700' : yearStats.totalDiff > 0 ? 'text-blue-700' : 'text-slate-900'}>
                {yearStats.totalDiff > 0 ? `+${yearStats.totalDiff.toLocaleString()} دج` : `${yearStats.totalDiff.toLocaleString()} دج`}
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] font-bold text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>
              {yearStats.totalDiff < 0 ? 'إجمالي عجز السنة' : yearStats.totalDiff > 0 ? 'إجمالي فائض السنة' : 'مطابق سنوياً'}
            </span>
            <span className="text-[10px] text-slate-400">
              فعلي: {hideFinances ? '••' : yearStats.totalActual.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* MAIN CONTENT: VIEW TAB 1 = TODAY'S CAISSE            */}
      {/* ==================================================== */}
      {viewTab === 'today' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* LEFT/RIGHT COLUMN: CASH INPUT & DENOMINATIONS (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={handleSaveCaisse} className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <span>💵</span>
                  <span>تسجيل المبلغ الفعلي في الدرج</span>
                </h3>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">
                  (nmarkilha wech kayen)
                </span>
              </div>

              {/* Theoretical Summary Box */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>رصيد بداية اليوم (فوند دو كيس):</span>
                  <span className="font-mono font-bold">{openingBalance.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>+ إجمالي المداخيل اليومية:</span>
                  <span className="font-mono font-bold">+{totalDailyInflow.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>- إجمالي المصاريف المسددة:</span>
                  <span className="font-mono font-bold">-{totalDailyOutflow.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-slate-900 text-sm">
                  <span>المبلغ النظري المتوقع في الصندوق:</span>
                  <span className="font-mono text-indigo-700">{theoreticalAmount.toLocaleString()} دج</span>
                </div>
              </div>

              {/* Opening Balance Field (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رصيد بداية اليوم الافتتاحي (Fond de caisse) - اختياري:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="0"
                    value={openingBalance || ''}
                    onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-rose-500"
                  />
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">دج</span>
                </div>
              </div>

              {/* PRIMARY ACTUAL CASH INPUT */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-black text-slate-900">
                    المبلغ الفعلي الموجود حالياً في الصندوق (Compté en espèces) *:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDenominations(!showDenominations)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <span>{showDenominations ? 'إخفاء العداد' : '🧮 حساب بالأوراق النقدية'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    placeholder="أدخل المبلغ المحسوب في الدرج..."
                    value={actualInput}
                    onChange={(e) => setActualInput(e.target.value)}
                    className="w-full px-4 py-3 bg-indigo-50/50 border-2 border-indigo-300 focus:border-indigo-600 rounded-2xl text-base sm:text-lg font-black font-mono text-slate-900 focus:bg-white focus:outline-hidden transition-all shadow-inner"
                  />
                  <span className="absolute left-4 top-3 text-sm font-black text-indigo-500">دج</span>
                </div>
                {hasEnteredActual && (
                  <div className="mt-1 text-xs text-slate-500 font-bold">
                    المبلغ كتابة: {actualAmount.toLocaleString()} دينار جزائري
                  </div>
                )}
              </div>

              {/* Denomination Counter Drawer */}
              {showDenominations && (
                <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-200 space-y-3 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center text-xs font-black text-indigo-900 pb-1 border-b border-indigo-200">
                    <span>عداد الفئات النقدية (دينار جزائري):</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCounts({ '2000': 0, '1000': 0, '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, 'coins': 0 });
                        setActualInput('0');
                      }}
                      className="text-[10px] text-rose-600 hover:underline font-bold"
                    >
                      تصفير العداد
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { key: '2000', label: '2000 دج' },
                      { key: '1000', label: '1000 دج' },
                      { key: '500', label: '500 دج' },
                      { key: '200', label: '200 دج' },
                      { key: '100', label: '100 دج' },
                      { key: '50', label: '50 دج' },
                    ].map(item => (
                      <div key={item.key} className="bg-white p-2 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <span className="font-black text-slate-700">{item.label}:</span>
                        <input
                          type="number"
                          min="0"
                          value={counts[item.key] || ''}
                          placeholder="0"
                          onChange={(e) => handleCountChange(item.key, Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
                    <span className="font-black text-slate-700">قطع وصرف أخرى (دج):</span>
                    <input
                      type="number"
                      min="0"
                      value={counts['coins'] || ''}
                      placeholder="0 دج"
                      onChange={(e) => handleCountChange('coins', Number(e.target.value))}
                      className="w-24 px-2 py-0.5 text-center font-bold bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {/* LIVE DISCREPANCY PREVIEW BOX */}
              {hasEnteredActual && (
                <div className={`p-4 rounded-2xl border-2 text-center transition-all ${
                  dailyDifference < 0 ? 'bg-rose-50 border-rose-400 text-rose-900' :
                  dailyDifference > 0 ? 'bg-blue-50 border-blue-400 text-blue-900' :
                  'bg-emerald-50 border-emerald-400 text-emerald-900'
                }`}>
                  <div className="text-xs font-bold">
                    {dailyDifference < 0 ? '⚠️ عجز ونقص مسجل في الصندوق (Manque de caisse):' :
                     dailyDifference > 0 ? '📈 فائض وزيادة مسجلة في الصندوق (Excédent):' :
                     '✅ الصندوق مطابق تماماً للحسابات:'}
                  </div>
                  <div className="text-2xl font-black font-mono mt-1">
                    {dailyDifference > 0 ? `+${dailyDifference.toLocaleString()} دج` : `${dailyDifference.toLocaleString()} دج`}
                  </div>
                  <div className="text-[11px] font-bold mt-1 text-slate-600">
                    (الفعلي: {actualAmount.toLocaleString()} دج | المتوقع: {theoreticalAmount.toLocaleString()} دج)
                  </div>
                </div>
              )}

              {/* Notes Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات أو تبرير الفارق (اختياري):
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: عجز بسبب صرف قطعة 500 دج، سلفية مؤقتة، زبون دفع كاش لاحقاً..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-rose-500"
                />
              </div>

              {/* Save / Close Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2"
                >
                  <span>💾</span>
                  <span>{existingClosure ? 'تحديث إقفال الصندوق لليوم' : 'حفظ وإقفال صندوق اليوم (Clôturer)'}</span>
                </button>

                {existingClosure && (
                  <button
                    type="button"
                    onClick={() => setSelectedClosureForReceipt(existingClosure)}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>🖨️</span>
                    <span>معاينة وطباعة وصل إقفال هذا اليوم</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* RIGHT/LEFT COLUMN: DETAILED BREAKDOWN OF TODAY'S TRANSACTIONS (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Daily Cash Breakdown Cards */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <span>📋</span>
                  <span>تفاصيل حركة الصندوق ليوم ({selectedDate})</span>
                </h3>
                <span className="text-xs font-bold text-slate-500 font-mono">
                  {dateSales.length + dateRentals.length + dateTailoring.length} عمليات دخل | {dateExpenses.length + dateStaffPayouts.length} عمليات خرج
                </span>
              </div>

              {/* Inflow Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-black text-emerald-800 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-100">
                  <span>📥 المداخيل والمقبوضات النقدية (Entrées):</span>
                  <span className="font-mono text-sm">+{totalDailyInflow.toLocaleString()} دج</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div className="text-slate-500 font-bold">مبيعات كاش:</div>
                    <div className="font-black text-slate-900 font-mono text-sm mt-0.5">
                      {dateSalesIncome.toLocaleString()} دج
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{dateSales.length} عملية بيع</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div className="text-slate-500 font-bold">مقبوضات كراء:</div>
                    <div className="font-black text-slate-900 font-mono text-sm mt-0.5">
                      {dateRentalsIncome.toLocaleString()} دج
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{dateRentals.length} صفقة كراء</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div className="text-slate-500 font-bold">مقبوضات خياطة:</div>
                    <div className="font-black text-slate-900 font-mono text-sm mt-0.5">
                      {dateTailoringIncome.toLocaleString()} دج
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{dateTailoring.length} طلب خياطة</div>
                  </div>
                </div>

                {/* List of Today's Sales */}
                {dateSales.length > 0 && (
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100/70 px-3 py-1 font-bold text-slate-700 text-[11px]">
                      قائمة مبيعات اليوم النقدية:
                    </div>
                    <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                      {dateSales.map(s => (
                        <div key={s.id} className="p-2 flex justify-between items-center hover:bg-slate-50">
                          <div>
                            <span className="font-bold text-slate-800">{s.customerName || 'زبون عام'}</span>
                            <span className="text-[10px] text-slate-500 mr-2">({s.items.length} قطع)</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-700">
                            +{(s.paidAmount !== undefined ? s.paidAmount : s.totalAmount).toLocaleString()} دج
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* List of Today's Rentals */}
                {dateRentals.length > 0 && (
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100/70 px-3 py-1 font-bold text-slate-700 text-[11px]">
                      قائمة كراء اليوم النقدية:
                    </div>
                    <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                      {dateRentals.map(r => (
                        <div key={r.id} className="p-2 flex justify-between items-center hover:bg-slate-50">
                          <div>
                            <span className="font-bold text-slate-800">{r.customerName}</span>
                            <span className="text-[10px] text-slate-500 mr-2">({r.itemName})</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-700">
                            +{(r.paidAmount || 0).toLocaleString()} دج
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Outflow Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center text-xs font-black text-rose-800 bg-rose-50/80 px-3 py-1.5 rounded-xl border border-rose-100">
                  <span>📤 المصاريف والخوارج النقدية (Sorties):</span>
                  <span className="font-mono text-sm">-{totalDailyOutflow.toLocaleString()} دج</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div className="text-slate-500 font-bold">مصاريف المحل اليومية:</div>
                    <div className="font-black text-rose-600 font-mono text-sm mt-0.5">
                      -{dateExpensesPaid.toLocaleString()} دج
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{dateExpenses.length} سند صرف</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div className="text-slate-500 font-bold">أجور وسلفيات العمال:</div>
                    <div className="font-black text-rose-600 font-mono text-sm mt-0.5">
                      -{dateStaffPayoutsPaid.toLocaleString()} دج
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{dateStaffPayouts.length} دفعة عمال</div>
                  </div>
                </div>

                {/* List of Today's Expenses */}
                {dateExpenses.length > 0 && (
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100/70 px-3 py-1 font-bold text-slate-700 text-[11px]">
                      تفاصيل مصاريف اليوم:
                    </div>
                    <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                      {dateExpenses.map(e => (
                        <div key={e.id} className="p-2 flex justify-between items-center hover:bg-slate-50">
                          <div>
                            <span className="font-bold text-slate-800">{e.desc || e.category}</span>
                            <span className="text-[10px] text-slate-500 mr-2">[{e.category}]</span>
                          </div>
                          <span className="font-mono font-bold text-rose-600">
                            -{Number(e.amount).toLocaleString()} دج
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* List of Today's Staff Payouts */}
                {dateStaffPayouts.length > 0 && (
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100/70 px-3 py-1 font-bold text-slate-700 text-[11px]">
                      دفعات العمال المسددة اليوم:
                    </div>
                    <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                      {dateStaffPayouts.map(p => (
                        <div key={p.id} className="p-2 flex justify-between items-center hover:bg-slate-50">
                          <div>
                            <span className="font-bold text-slate-800">{p.name}</span>
                            <span className="text-[10px] text-slate-500 mr-2">({p.type})</span>
                          </div>
                          <span className="font-mono font-bold text-rose-600">
                            -{Number(p.amount).toLocaleString()} دج
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================================================== */
        /* VIEW TAB 2 = HISTORY & PREVIOUS CLOSURES             */
        /* ==================================================== */
        <div className="space-y-4">
          {/* History Filter Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">تصفية حسب الفترة:</span>
              <div className="flex items-center gap-2">
                <select
                  value={historyYear}
                  onChange={(e) => setHistoryYear(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="">كل السنوات</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>

                <select
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="">كل الأشهر</option>
                  <option value="01">01 - جانفي</option>
                  <option value="02">02 - فيفري</option>
                  <option value="03">03 - مارس</option>
                  <option value="04">04 - أفريل</option>
                  <option value="05">05 - ماي</option>
                  <option value="06">06 - جوان</option>
                  <option value="07">07 - جويلية</option>
                  <option value="08">08 - أوت</option>
                  <option value="09">09 - سبتمبر</option>
                  <option value="10">10 - أكتوبر</option>
                  <option value="11">11 - نوفمبر</option>
                  <option value="12">12 - ديسمبر</option>
                </select>
              </div>
            </div>

            {/* Filtered summary pills */}
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="text-slate-600">
                عدد الإقفالات: <strong className="text-slate-900">{filteredHistory.length}</strong>
              </span>
              <span className="text-slate-600">
                صافي الفارق: <strong className={historyTotals.totalDf < 0 ? 'text-rose-600 font-mono' : 'text-emerald-700 font-mono'}>
                  {historyTotals.totalDf > 0 ? `+${historyTotals.totalDf.toLocaleString()} دج` : `${historyTotals.totalDf.toLocaleString()} دج`}
                </strong>
              </span>
            </div>
          </div>

          {/* Closures Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <span className="text-4xl block mb-2">📭</span>
                <p className="text-sm font-bold">لا توجد إقفالات سابقة مسجلة في هذه الفترة</p>
                <button
                  onClick={() => setViewTab('today')}
                  className="mt-3 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl"
                >
                  إقفال صندوق اليوم الآن
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">تاريخ الإقفال</th>
                      <th className="p-3.5">رصيد الافتتاح</th>
                      <th className="p-3.5">المداخيل (Entrées)</th>
                      <th className="p-3.5">المصاريف (Sorties)</th>
                      <th className="p-3.5">النظري المتوقع</th>
                      <th className="p-3.5">الفعلي المحسوب</th>
                      <th className="p-3.5">الفارق والعجز (Manque)</th>
                      <th className="p-3.5">ملاحظات</th>
                      <th className="p-3.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map(closure => {
                      const isShort = closure.difference < 0;
                      const isSurp = closure.difference > 0;
                      return (
                        <tr key={closure.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900 font-mono">
                            {closure.date}
                          </td>
                          <td className="p-3.5 font-mono text-slate-600">
                            {(closure.openingBalance || 0).toLocaleString()} دج
                          </td>
                          <td className="p-3.5 font-mono font-bold text-emerald-700">
                            +{(closure.totalInflow || 0).toLocaleString()} دج
                          </td>
                          <td className="p-3.5 font-mono font-bold text-rose-600">
                            -{(closure.totalOutflow || 0).toLocaleString()} دج
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-800">
                            {(closure.theoreticalAmount || 0).toLocaleString()} دج
                          </td>
                          <td className="p-3.5 font-mono font-black text-indigo-900 bg-indigo-50/30">
                            {(closure.actualAmount || 0).toLocaleString()} دج
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black font-mono ${
                              isShort ? 'bg-rose-100 text-rose-800' :
                              isSurp ? 'bg-blue-100 text-blue-800' :
                              'bg-emerald-100 text-emerald-800'
                            }`}>
                              {closure.difference > 0 ? `+${closure.difference.toLocaleString()} دج` : `${closure.difference.toLocaleString()} دج`}
                              <span className="mr-1 text-[10px]">
                                {isShort ? '(عجز)' : isSurp ? '(فائض)' : '(مضبوط)'}
                              </span>
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600 text-[11px] max-w-xs truncate">
                            {closure.notes || '-'}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedClosureForReceipt(closure)}
                                title="طباعة الوصل"
                                className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors"
                              >
                                🖨️
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDate(closure.date);
                                  setViewTab('today');
                                }}
                                title="تعديل هذا اليوم"
                                className="p-1.5 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600 rounded-lg transition-colors"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`هل أنت متأكد من حذف إقفال يوم ${closure.date}؟`)) {
                                    onDeleteClosure(closure.id);
                                  }
                                }}
                                title="حذف"
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {selectedClosureForReceipt && (
        <Modal 
          title={`وصل إقفال الصندوق - ${selectedClosureForReceipt.date}`} 
          onClose={() => setSelectedClosureForReceipt(null)}
        >
          <CaisseReceiptModal 
            closure={selectedClosureForReceipt} 
            onClose={() => setSelectedClosureForReceipt(null)} 
          />
        </Modal>
      )}
    </div>
  );
};
