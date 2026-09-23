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
import { checkSecurityPin } from './SecurityPasswordModal';
import {
  Scale,
  Eye,
  EyeOff,
  Coins,
  TrendingDown,
  TrendingUp,
  Check,
  BarChart2,
  Calendar,
  Banknote,
  Calculator,
  Save,
  Printer,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Inbox,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  ShieldCheck,
  Search,
  Filter,
  Layers,
  ArrowUpDown,
  Clock
} from 'lucide-react';

interface CaisseViewProps {
  sales: Sale[];
  rentals: Rental[];
  expenses: Expense[];
  staffPayouts: StaffPayout[];
  maintenanceOrders: MaintenanceOrder[];
  caisseClosures: DailyCaisseClosure[];
  onSaveClosure: (closure: DailyCaisseClosure) => void;
  onDeleteClosure: (closureId: string) => void;
  onDeleteSale?: (sale: Sale) => void;
  onDeleteRental?: (rentalId: string) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onDeleteStaffPayout?: (payoutId: string) => void;
  onDeleteTailoringOrder?: (orderId: string) => void;
  hideFinances: boolean;
  onPrivacyToggle: () => void;
}

export const CaisseView: React.FC<CaisseViewProps> = React.memo(({
  sales,
  rentals,
  expenses,
  staffPayouts,
  maintenanceOrders,
  caisseClosures,
  onSaveClosure,
  onDeleteClosure,
  onDeleteSale,
  onDeleteRental,
  onDeleteExpense,
  onDeleteStaffPayout,
  onDeleteTailoringOrder,
  hideFinances,
  onPrivacyToggle
}) => {
  // Password lock state for Caisse
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('bm_caisse_unlocked') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const handleUnlockCaisse = (codeToTest?: string) => {
    const code = codeToTest !== undefined ? codeToTest : pinInput;
    if (checkSecurityPin(code)) {
      setIsUnlocked(true);
      setPinError(false);
      sessionStorage.setItem('bm_caisse_unlocked', 'true');
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleLockCaisse = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('bm_caisse_unlocked');
    setPinInput('');
    setPinError(false);
  };

  const handleKeypad = (val: string) => {
    if (val === 'clear') {
      setPinInput('');
      setPinError(false);
      return;
    }
    if (val === 'backspace') {
      setPinInput(prev => prev.slice(0, -1));
      setPinError(false);
      return;
    }
    if (pinInput.length < 8) {
      const next = pinInput + val;
      setPinInput(next);
      setPinError(false);
      if (checkSecurityPin(next)) {
        setTimeout(() => {
          setIsUnlocked(true);
          sessionStorage.setItem('bm_caisse_unlocked', 'true');
        }, 150);
      }
    }
  };
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [viewTab, setViewTab] = useState<'today' | 'transactions' | 'history'>('today');

  // Transactions tab search & filters
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'sale' | 'rental' | 'tailoring' | 'expense' | 'staffPayout'>('all');
  const [txDirectionFilter, setTxDirectionFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [txDateFilter, setTxDateFilter] = useState<string>('');

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

  // Clear/Reset Caisse Modal State
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [clearPinInput, setClearPinInput] = useState('');
  const [clearPinError, setClearPinError] = useState(false);
  const [clearOption, setClearOption] = useState<'reset_closure' | 'delete_today_txs'>('reset_closure');

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

  // ==========================================
  // 4. CONSOLIDATED TRANSACTIONS & DELETION
  // ==========================================
  const allTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'sale' | 'rental' | 'tailoring' | 'expense' | 'staffPayout';
      typeLabel: string;
      date: string;
      time?: string;
      direction: 'inflow' | 'outflow';
      title: string;
      subtitle: string;
      amount: number;
      originalItem: any;
    }> = [];

    // Sales (inflow)
    sales.forEach(s => {
      const d = s.date || '';
      const datePart = d.includes('T') ? d.split('T')[0] : (d.split(' ')[0] || '');
      const timePart = d.includes('T') ? d.split('T')[1]?.substring(0, 5) : '';
      const amount = s.paidAmount !== undefined ? s.paidAmount : s.totalAmount || 0;
      list.push({
        id: s.id,
        type: 'sale',
        typeLabel: 'بيع',
        date: datePart,
        time: timePart,
        direction: 'inflow',
        title: s.customerName || 'زبون عام',
        subtitle: `${s.items.length} قطع (${s.items.map(i => i.name).join('، ')})`,
        amount,
        originalItem: s
      });
    });

    // Rentals (inflow)
    rentals.forEach(r => {
      const d = r.createdAt || r.startDate || '';
      const datePart = d.includes('T') ? d.split('T')[0] : (d.split(' ')[0] || '');
      const timePart = d.includes('T') ? d.split('T')[1]?.substring(0, 5) : '';
      const amount = r.paidAmount || 0;
      list.push({
        id: r.id,
        type: 'rental',
        typeLabel: 'كراء',
        date: datePart,
        time: timePart,
        direction: 'inflow',
        title: r.customerName || 'زبون كراء',
        subtitle: `${r.itemName} (عربون/دفع: ${(r.paidAmount || 0).toLocaleString()} دج)`,
        amount,
        originalItem: r
      });
    });

    // Tailoring (inflow)
    maintenanceOrders.forEach(o => {
      const d = o.receivedDate || o.createdAt || '';
      const datePart = d.includes('T') ? d.split('T')[0] : (d.split(' ')[0] || '');
      const timePart = d.includes('T') ? d.split('T')[1]?.substring(0, 5) : '';
      const amount = o.paidAmount || 0;
      list.push({
        id: o.id,
        type: 'tailoring',
        typeLabel: 'خياطة وتعديل',
        date: datePart,
        time: timePart,
        direction: 'inflow',
        title: o.customerName || 'زبون خياطة',
        subtitle: `${o.clothName} - ${o.description || 'طلب تعديل/خياطة'}`,
        amount,
        originalItem: o
      });
    });

    // Expenses (outflow)
    expenses.forEach(e => {
      const d = e.date || '';
      const datePart = d.includes('T') ? d.split('T')[0] : (d.split(' ')[0] || '');
      const timePart = d.includes('T') ? d.split('T')[1]?.substring(0, 5) : '';
      const amount = Number(e.amount || 0);
      list.push({
        id: e.id,
        type: 'expense',
        typeLabel: 'مصروف',
        date: datePart,
        time: timePart,
        direction: 'outflow',
        title: e.desc || e.category,
        subtitle: `تصنيف: ${e.category} ${e.supplierName ? `• مورد: ${e.supplierName}` : ''}`,
        amount,
        originalItem: e
      });
    });

    // Staff Payouts (outflow)
    staffPayouts.forEach(p => {
      const d = p.date || '';
      const datePart = d.includes('T') ? d.split('T')[0] : (d.split(' ')[0] || '');
      const timePart = d.includes('T') ? d.split('T')[1]?.substring(0, 5) : '';
      const amount = Number(p.amount || 0);
      list.push({
        id: p.id,
        type: 'staffPayout',
        typeLabel: 'أجور/سلفة',
        date: datePart,
        time: timePart,
        direction: 'outflow',
        title: p.name,
        subtitle: `${p.type === 'advance' ? 'سلفة على الراتب' : 'صرف راتب شهري'} ${p.notes ? `• ${p.notes}` : ''}`,
        amount,
        originalItem: p
      });
    });

    // Sort descending by date & time
    return list.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  }, [sales, rentals, maintenanceOrders, expenses, staffPayouts]);

  // Filtered transactions for Transactions Tab
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false;
      if (txDirectionFilter !== 'all' && tx.direction !== txDirectionFilter) return false;
      if (txDateFilter && tx.date !== txDateFilter) return false;
      if (txSearch.trim()) {
        const q = txSearch.toLowerCase();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchSub = tx.subtitle.toLowerCase().includes(q);
        const matchType = tx.typeLabel.toLowerCase().includes(q);
        const matchAmount = String(tx.amount).includes(q);
        const matchDate = tx.date.includes(q);
        if (!matchTitle && !matchSub && !matchType && !matchAmount && !matchDate) return false;
      }
      return true;
    });
  }, [allTransactions, txTypeFilter, txDirectionFilter, txDateFilter, txSearch]);

  const transactionsTotals = useMemo(() => {
    const totalInflow = filteredTransactions.filter(t => t.direction === 'inflow').reduce((s, t) => s + t.amount, 0);
    const totalOutflow = filteredTransactions.filter(t => t.direction === 'outflow').reduce((s, t) => s + t.amount, 0);
    const net = totalInflow - totalOutflow;
    return { totalInflow, totalOutflow, net };
  }, [filteredTransactions]);

  const handleDeleteTransaction = (tx: { id: string; type: string; title: string; amount: number; originalItem: any }) => {
    if (tx.type === 'sale') {
      if (window.confirm(`هل أنت متأكد من إلغاء وحذف عملية البيع للزبون (${tx.title}) بمبلغ ${tx.amount.toLocaleString()} دج؟ سيتم استرجاع السلع للمخزن.`)) {
        onDeleteSale?.(tx.originalItem);
      }
    } else if (tx.type === 'rental') {
      if (window.confirm(`هل أنت متأكد من حذف عملية الكراء (${tx.title})؟ سيتم استرجاع حالة الفستان للمخزن.`)) {
        onDeleteRental?.(tx.id);
      }
    } else if (tx.type === 'tailoring') {
      if (window.confirm(`هل أنت متأكد من حذف طلب الخياطة والتعديل (${tx.title})؟`)) {
        onDeleteTailoringOrder?.(tx.id);
      }
    } else if (tx.type === 'expense') {
      if (window.confirm(`هل أنت متأكد من حذف سند المصروف (${tx.title}) بمبلغ ${tx.amount.toLocaleString()} دج؟`)) {
        onDeleteExpense?.(tx.id);
      }
    } else if (tx.type === 'staffPayout') {
      if (window.confirm(`هل أنت متأكد من حذف سجل الدفعة/الراتب (${tx.title}) بمبلغ ${tx.amount.toLocaleString()} دج؟`)) {
        onDeleteStaffPayout?.(tx.id);
      }
    }
  };

  const handleExecuteClearCaisse = () => {
    if (!checkSecurityPin(clearPinInput)) {
      setClearPinError(true);
      return;
    }

    // 1. Delete existing closure if any
    if (existingClosure) {
      onDeleteClosure(existingClosure.id);
    }

    // 2. Delete today's transactions if requested
    if (clearOption === 'delete_today_txs') {
      const todayTxs = allTransactions.filter(tx => tx.date === selectedDate);
      todayTxs.forEach(tx => {
        if (tx.type === 'sale') onDeleteSale?.(tx.originalItem);
        else if (tx.type === 'rental') onDeleteRental?.(tx.id);
        else if (tx.type === 'expense') onDeleteExpense?.(tx.id);
        else if (tx.type === 'staffPayout') onDeleteStaffPayout?.(tx.id);
        else if (tx.type === 'tailoring') onDeleteTailoringOrder?.(tx.id);
      });
    }

    // Reset local inputs
    setOpeningBalance(0);
    setActualInput('0');
    setNotes('');
    setCounts({
      '2000': 0, '1000': 0, '500': 0, '200': 0,
      '100': 0, '50': 0, '20': 0, '10': 0, 'coins': 0
    });

    setShowClearConfirmModal(false);
    setClearPinInput('');
    setClearPinError(false);
    alert('تم تفريغ وتصفير الصندوق بنجاح، ويبدو الصندوق الآن فارغاً (0 دج)');
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl w-full max-w-sm p-6 sm:p-7 shadow-xl border border-slate-200/80 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 mx-auto flex items-center justify-center mb-4 shadow-2xs">
            <Lock className="w-6 h-6 text-slate-800" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1.5">
            الصندوق محمي بكلمة المرور
          </h2>
          <p className="text-xs text-slate-500 font-normal mb-5 leading-relaxed">
            الرجاء إدخال رمز المرور أو كلمة السر الخاصة بالمسؤول للوصول إلى حسابات وإقفال الصندوق
          </p>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleUnlockCaisse();
            }} 
            className="space-y-4"
          >
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pinInput}
                autoFocus
                onChange={(e) => {
                  const val = e.target.value;
                  setPinInput(val);
                  setPinError(false);
                  if (checkSecurityPin(val)) {
                    setTimeout(() => {
                      setIsUnlocked(true);
                      sessionStorage.setItem('bm_caisse_unlocked', 'true');
                    }, 150);
                  }
                }}
                placeholder="••••"
                maxLength={8}
                className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-center text-xl font-bold font-mono tracking-widest text-slate-900 outline-none transition-all ${
                  pinError
                    ? 'border-rose-400 bg-rose-50/40 ring-2 ring-rose-500/20'
                    : 'border-slate-200 focus:border-slate-400 focus:bg-white'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {pinError && (
              <p className="text-xs text-rose-600 font-medium animate-in fade-in">
                رمز المرور غير صحيح، يرجى المحاولة مجدداً
              </p>
            )}

            {/* Quick numeric touch keypad */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypad(num)}
                  className="py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-base text-slate-800 transition-colors shadow-2xs"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleKeypad('clear')}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium text-xs transition-colors"
              >
                مسح C
              </button>
              <button
                type="button"
                onClick={() => handleKeypad('0')}
                className="py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-base text-slate-800 transition-colors shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleKeypad('backspace')}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium text-xs transition-colors"
              >
                ⌫
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              <span>فتح قسم الصندوق</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 p-3 sm:p-6" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 bg-slate-100 text-slate-800 rounded-xl flex items-center justify-center text-base font-bold border border-slate-200/70">
              <Scale className="w-4 h-4 text-slate-800" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                صندوق اليومية ومتابعة العجز (La Caisse Journalière)
              </h2>
              <p className="text-xs font-normal text-slate-500 mt-0.5">
                حساب مدخول اليوم، تسجيل المبلغ الفعلي، وتحديد فارق وعجز الصندوق في اليوم، الشهر، والسنة
              </p>
            </div>
          </div>
        </div>

        {/* View Tabs & Privacy Toggle & Lock Button */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium border border-slate-200/60">
            <button
              onClick={() => setViewTab('today')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewTab === 'today' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              صندوق اليوم ({selectedDate === today ? 'اليوم' : selectedDate})
            </button>
            <button
              onClick={() => setViewTab('transactions')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewTab === 'transactions' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              سجل العمليات والمعاملات ({allTransactions.length})
            </button>
            <button
              onClick={() => setViewTab('history')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewTab === 'history' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              سجل الإقفالات ({caisseClosures.length})
            </button>
          </div>

          <button
            onClick={() => {
              setClearPinInput('');
              setClearPinError(false);
              setShowClearConfirmModal(true);
            }}
            title="تفريغ وتصفير بيانات الصندوق (0 دج)"
            className="h-9 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-rose-200 active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>تفريغ وتصفير الصندوق</span>
          </button>

          <button
            onClick={onPrivacyToggle}
            title="إخفاء/إظهار المبالغ"
            className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-200/80 shadow-2xs"
          >
            {hideFinances ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{hideFinances ? 'إظهار' : 'إخفاء'}</span>
          </button>

          <button
            onClick={handleLockCaisse}
            title="قفل الصندوق بكلمة المرور"
            className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-200"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>قفل الصندوق</span>
          </button>
        </div>
      </div>

      {/* Date Bar for Today's view */}
      {viewTab === 'today' && (
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">تاريخ الصندوق:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 font-mono focus:bg-white focus:border-slate-400 focus:outline-none"
            />
            {selectedDate !== today && (
              <button
                onClick={() => setSelectedDate(today)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors"
              >
                العودة لليوم
              </button>
            )}
          </div>

          {/* Status Badge */}
          <div>
            {existingClosure ? (
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200/80 px-3 py-1 rounded-full text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                تم إقفال صندوق هذا اليوم (حفظ في: {new Date(existingClosure.closedAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-full text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                الصندوق قيد الاحتساب (لم يتم حفظ الإقفال بعد)
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4 PRIMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. MADKHOUL TE3 LA JOURNEE (مدخول اليوم) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">إجمالي مدخول اليوم (المقبوضات)</span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-sm border border-slate-200/60">
              <Coins className="w-4 h-4 text-slate-700" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {hideFinances ? '••••••' : `${totalDailyInflow.toLocaleString()} دج`}
          </div>
          <div className="mt-2 text-[11px] font-medium text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>مبيعات: {hideFinances ? '••' : `${dateSalesIncome.toLocaleString()}`}</span>
            <span>كراء: {hideFinances ? '••' : `${dateRentalsIncome.toLocaleString()}`}</span>
            <span>خياطة: {hideFinances ? '••' : `${dateTailoringIncome.toLocaleString()}`}</span>
          </div>
        </div>

        {/* 2. MANQUE TE3 LA CAISSE FI NHAR (فارق وعجز اليوم) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-medium text-slate-700">فارق صندوق اليوم (Fi Nhar)</span>
              <div className="text-[10px] text-slate-400">المحسوب فعلياً - المتوقع نظرياً</div>
            </div>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-sm border border-slate-200/60">
              {dailyDifference < 0 ? (
                <TrendingDown className="w-4 h-4 text-rose-600" />
              ) : dailyDifference > 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </span>
          </div>
          <div className="mt-2">
            {!hasEnteredActual && !existingClosure ? (
              <div className="text-xs font-medium text-slate-400 py-1">
                أدخل المبلغ الفعلي في الدرج لاحتساب الفارق
              </div>
            ) : (
              <div className={`text-2xl font-bold font-mono ${
                dailyDifference < 0 ? 'text-rose-600' : dailyDifference > 0 ? 'text-emerald-600' : 'text-slate-900'
              }`}>
                {hideFinances ? '••••••' : (
                  dailyDifference > 0 ? `+${dailyDifference.toLocaleString()} دج` : `${dailyDifference.toLocaleString()} دج`
                )}
              </div>
            )}
          </div>
          <div className="mt-2 text-[11px] font-medium flex items-center justify-between border-t border-slate-100 pt-2">
            {dailyDifference < 0 ? (
              <span className="text-rose-600 font-semibold">عجز في الصندوق (Manque)</span>
            ) : dailyDifference > 0 ? (
              <span className="text-emerald-600 font-semibold">فائض في الصندوق (Excédent)</span>
            ) : (
              <span className="text-slate-600 font-medium">الصندوق مطابق (Conforme)</span>
            )}
            <span className="text-slate-400 font-mono text-[10px]">{selectedDate.substring(5)}</span>
          </div>
        </div>

        {/* 3. MANQUE TE3 LA CAISSE FI CHHAR (فارق وعجز الشهر) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-medium text-slate-700">فارق الصندوق للشهر (Fi Chhar)</span>
              <div className="text-[10px] text-slate-400">شهر {currentMonthPrefix} ({monthStats.daysCount} أيام)</div>
            </div>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-sm border border-slate-200/60">
              <BarChart2 className="w-4 h-4 text-slate-700" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono">
            {hideFinances ? '••••••' : (
              <span className={monthStats.totalDiff < 0 ? 'text-rose-600' : monthStats.totalDiff > 0 ? 'text-emerald-600' : 'text-slate-900'}>
                {monthStats.totalDiff > 0 ? `+${monthStats.totalDiff.toLocaleString()} دج` : `${monthStats.totalDiff.toLocaleString()} دج`}
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] font-medium text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>
              {monthStats.totalDiff < 0 ? 'عجز الشهر' : monthStats.totalDiff > 0 ? 'فائض الشهر' : 'مطابق شهرياً'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              فعلي: {hideFinances ? '••' : monthStats.totalActual.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 4. MANQUE TE3 LA CAISSE FI L3AM (فارق وعجز السنة) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-medium text-slate-700">فارق الصندوق للسنة (Fi L3am)</span>
              <div className="text-[10px] text-slate-400">سنة {currentYearPrefix} ({yearStats.daysCount} يوم)</div>
            </div>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-sm border border-slate-200/60">
              <Calendar className="w-4 h-4 text-slate-700" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono">
            {hideFinances ? '••••••' : (
              <span className={yearStats.totalDiff < 0 ? 'text-rose-600' : yearStats.totalDiff > 0 ? 'text-emerald-600' : 'text-slate-900'}>
                {yearStats.totalDiff > 0 ? `+${yearStats.totalDiff.toLocaleString()} دج` : `${yearStats.totalDiff.toLocaleString()} دج`}
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] font-medium text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>
              {yearStats.totalDiff < 0 ? 'عجز السنة' : yearStats.totalDiff > 0 ? 'فائض السنة' : 'مطابق سنوياً'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              فعلي: {hideFinances ? '••' : yearStats.totalActual.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* MAIN CONTENT: VIEW TAB 1 = TODAY'S CAISSE            */}
      {/* ==================================================== */}
      {viewTab === 'today' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* LEFT/RIGHT COLUMN: CASH INPUT & DENOMINATIONS (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={handleSaveCaisse} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-slate-700" />
                  <span>تسجيل المبلغ الفعلي في الدرج</span>
                </h3>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 font-mono">
                  (Comptage)
                </span>
              </div>

              {/* Theoretical Summary Box */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>رصيد بداية اليوم (فوند دو كيس):</span>
                  <span className="font-mono font-semibold text-slate-800">{openingBalance.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>+ إجمالي المداخيل اليومية:</span>
                  <span className="font-mono font-bold text-slate-900">+{totalDailyInflow.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>- إجمالي المصاريف المسددة:</span>
                  <span className="font-mono font-bold text-rose-600">-{totalDailyOutflow.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200/80 font-bold text-slate-900 text-xs sm:text-sm">
                  <span>المبلغ النظري المتوقع في الصندوق:</span>
                  <span className="font-mono font-bold text-slate-900">{theoreticalAmount.toLocaleString()} دج</span>
                </div>
              </div>

              {/* Opening Balance Field (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
                  />
                  <span className="absolute left-3 top-2 text-xs font-medium text-slate-400">دج</span>
                </div>
              </div>

              {/* PRIMARY ACTUAL CASH INPUT */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-900">
                    المبلغ الفعلي الموجود حالياً في الصندوق (Compté en espèces) *:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDenominations(!showDenominations)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors"
                  >
                    <Calculator className="w-3.5 h-3.5 text-slate-500" />
                    <span>{showDenominations ? 'إخفاء العداد' : 'حساب بالفئات النقدية'}</span>
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded-xl text-base font-bold font-mono text-slate-900 focus:bg-white focus:outline-none transition-colors"
                  />
                  <span className="absolute left-4 top-2.5 text-xs font-medium text-slate-400">دج</span>
                </div>
                {hasEnteredActual && (
                  <div className="mt-1 text-xs text-slate-500 font-medium">
                    المبلغ: <span className="font-mono font-bold text-slate-800">{actualAmount.toLocaleString()} دج</span>
                  </div>
                )}
              </div>

              {/* Denomination Counter Drawer */}
              {showDenominations && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-800 pb-1 border-b border-slate-200/80">
                    <span>عداد الفئات النقدية (دج):</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCounts({ '2000': 0, '1000': 0, '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, 'coins': 0 });
                        setActualInput('0');
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-900 font-medium transition-colors"
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
                      <div key={item.key} className="bg-white p-2 rounded-lg border border-slate-200/80 flex items-center justify-between">
                        <span className="font-medium text-slate-700 text-xs">{item.label}:</span>
                        <input
                          type="number"
                          min="0"
                          value={counts[item.key] || ''}
                          placeholder="0"
                          onChange={(e) => handleCountChange(item.key, Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 text-center font-bold font-mono bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 text-xs">قطع وصرف أخرى (دج):</span>
                    <input
                      type="number"
                      min="0"
                      value={counts['coins'] || ''}
                      placeholder="0 دج"
                      onChange={(e) => handleCountChange('coins', Number(e.target.value))}
                      className="w-24 px-2 py-0.5 text-center font-bold font-mono bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* LIVE DISCREPANCY PREVIEW BOX */}
              {hasEnteredActual && (
                <div className="p-3 rounded-xl border border-slate-200 text-center bg-slate-50">
                  <div className="text-xs font-medium text-slate-600">
                    {dailyDifference < 0 ? 'عجز مسجل في الصندوق (Manque):' :
                     dailyDifference > 0 ? 'فائض مسجل في الصندوق (Excédent):' :
                     'الصندوق مطابق تماماً للحسابات:'}
                  </div>
                  <div className={`text-xl font-bold font-mono mt-0.5 ${
                    dailyDifference < 0 ? 'text-rose-600' : dailyDifference > 0 ? 'text-emerald-600' : 'text-slate-900'
                  }`}>
                    {dailyDifference > 0 ? `+${dailyDifference.toLocaleString()} دج` : `${dailyDifference.toLocaleString()} دج`}
                  </div>
                  <div className="text-[10px] font-normal mt-0.5 text-slate-500 font-mono">
                    (الفعلي: {actualAmount.toLocaleString()} دج | المتوقع: {theoreticalAmount.toLocaleString()} دج)
                  </div>
                </div>
              )}

              {/* Notes Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ملاحظات أو تبرير الفارق (اختياري):
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: عجز بسبب صرف قطعة 500 دج، سلفية مؤقتة، زبون دفع كاش لاحقاً..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
                />
              </div>

              {/* Save / Close Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{existingClosure ? 'تحديث إقفال الصندوق لليوم' : 'حفظ وإقفال صندوق اليوم (Clôturer)'}</span>
                </button>

                {existingClosure && (
                  <button
                    type="button"
                    onClick={() => setSelectedClosureForReceipt(existingClosure)}
                    className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-200/70"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>معاينة وطباعة وصل إقفال هذا اليوم</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* RIGHT/LEFT COLUMN: DETAILED BREAKDOWN OF TODAY'S TRANSACTIONS (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Daily Cash Breakdown Cards */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-700" />
                  <span>تفاصيل حركة الصندوق ليوم ({selectedDate})</span>
                </h3>
                <span className="text-xs font-medium text-slate-500 font-mono">
                  {dateSales.length + dateRentals.length + dateTailoring.length} مقبوضات | {dateExpenses.length + dateStaffPayouts.length} مدفوعات
                </span>
              </div>

              {/* Inflow Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/70">
                  <span className="flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    <span>المداخيل والمقبوضات النقدية (Entrées):</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900">+{totalDailyInflow.toLocaleString()} دج</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                    <div className="text-slate-500 font-medium">مبيعات كاش:</div>
                    <div className="font-bold text-slate-900 font-mono text-sm mt-0.5">
                      {dateSalesIncome.toLocaleString()} دج
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{dateSales.length} عملية بيع</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                    <div className="text-slate-500 font-medium">مقبوضات كراء:</div>
                    <div className="font-bold text-slate-900 font-mono text-sm mt-0.5">
                      {dateRentalsIncome.toLocaleString()} دج
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{dateRentals.length} صفقة كراء</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                    <div className="text-slate-500 font-medium">مقبوضات خياطة:</div>
                    <div className="font-bold text-slate-900 font-mono text-sm mt-0.5">
                      {dateTailoringIncome.toLocaleString()} دج
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{dateTailoring.length} طلب خياطة</div>
                  </div>
                </div>

                {/* List of Today's Sales */}
                {dateSales.length > 0 && (
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100/70 px-3 py-1 font-semibold text-slate-700 text-[11px] flex justify-between items-center">
                      <span>قائمة مبيعات اليوم النقدية ({dateSales.length}):</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {dateSales.map(s => (
                        <div key={s.id} className="p-2 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                          <div className="flex-1 min-w-0 pr-1">
                            <span className="font-semibold text-slate-800 block truncate">{s.customerName || 'زبون عام'}</span>
                            <span className="text-[10px] text-slate-400">({s.items.length} قطع) {s.items.map(i => i.name).join('، ')}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-slate-900">
                              +{(s.paidAmount !== undefined ? s.paidAmount : s.totalAmount).toLocaleString()} دج
                            </span>
                            {onDeleteSale && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`هل أنت متأكد من إلغاء وحذف عملية البيع هذه للزبون (${s.customerName || 'عام'}) بمبلغ ${(s.paidAmount !== undefined ? s.paidAmount : s.totalAmount).toLocaleString()} دج؟ سيتم استرجاع السلع للمخزن.`)) {
                                    onDeleteSale(s);
                                  }
                                }}
                                title="حذف عملية البيع واسترجاع السلع"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* List of Today's Rentals */}
                {dateRentals.length > 0 && (
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100/70 px-3 py-1 font-semibold text-slate-700 text-[11px] flex justify-between items-center">
                      <span>قائمة كراء اليوم النقدية ({dateRentals.length}):</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {dateRentals.map(r => (
                        <div key={r.id} className="p-2 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                          <div className="flex-1 min-w-0 pr-1">
                            <span className="font-semibold text-slate-800 block truncate">{r.customerName}</span>
                            <span className="text-[10px] text-slate-400">({r.itemName})</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-slate-900">
                              +{(r.paidAmount || 0).toLocaleString()} دج
                            </span>
                            {onDeleteRental && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`هل أنت متأكد من حذف عملية كراء (${r.customerName} - ${r.itemName})؟ سيتم استرجاع حالة الفستان للمخزن.`)) {
                                    onDeleteRental(r.id);
                                  }
                                }}
                                title="حذف عملية الكراء"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* List of Today's Tailoring */}
                {dateTailoring.length > 0 && (
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100/70 px-3 py-1 font-semibold text-slate-700 text-[11px] flex justify-between items-center">
                      <span>طلبات الخياطة والتعديل لليوم ({dateTailoring.length}):</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {dateTailoring.map(o => (
                        <div key={o.id} className="p-2 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                          <div className="flex-1 min-w-0 pr-1">
                            <span className="font-semibold text-slate-800 block truncate">{o.customerName}</span>
                            <span className="text-[10px] text-slate-400">({o.clothName || 'تعديل'}) {o.description}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-slate-900">
                              +{(o.paidAmount || 0).toLocaleString()} دج
                            </span>
                            {onDeleteTailoringOrder && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`هل أنت متأكد من حذف طلب الخياطة والتعديل (${o.customerName})؟`)) {
                                    onDeleteTailoringOrder(o.id);
                                  }
                                }}
                                title="حذف طلب الخياطة"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Outflow Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/70">
                  <span className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    <span>المصاريف والخوارج النقدية (Sorties):</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-rose-600">-{totalDailyOutflow.toLocaleString()} دج</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-xs">
                    <div className="text-slate-500 font-medium">مصاريف المحل اليومية:</div>
                    <div className="font-bold text-rose-600 font-mono text-sm mt-0.5">
                      -{dateExpensesPaid.toLocaleString()} دج
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{dateExpenses.length} سند صرف</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-xs">
                    <div className="text-slate-500 font-medium">أجور وسلفيات العمال:</div>
                    <div className="font-bold text-rose-600 font-mono text-sm mt-0.5">
                      -{dateStaffPayoutsPaid.toLocaleString()} دج
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{dateStaffPayouts.length} دفعة عمال</div>
                  </div>
                </div>

                {/* List of Today's Expenses */}
                {dateExpenses.length > 0 && (
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100/70 px-3 py-1 font-semibold text-slate-700 text-[11px] flex justify-between items-center">
                      <span>تفاصيل مصاريف اليوم ({dateExpenses.length}):</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {dateExpenses.map(e => (
                        <div key={e.id} className="p-2 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                          <div className="flex-1 min-w-0 pr-1">
                            <span className="font-semibold text-slate-800 block truncate">{e.desc || e.category}</span>
                            <span className="text-[10px] text-slate-400">[{e.category}] {e.supplierName ? `• مورد: ${e.supplierName}` : ''}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-rose-600">
                              -{Number(e.amount).toLocaleString()} دج
                            </span>
                            {onDeleteExpense && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`هل أنت متأكد من حذف سند المصروف (${e.desc || e.category}) بمبلغ ${Number(e.amount).toLocaleString()} دج؟`)) {
                                    onDeleteExpense(e.id);
                                  }
                                }}
                                title="حذف المصروف"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* List of Today's Staff Payouts */}
                {dateStaffPayouts.length > 0 && (
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100/70 px-3 py-1 font-semibold text-slate-700 text-[11px] flex justify-between items-center">
                      <span>دفعات العمال المسددة اليوم ({dateStaffPayouts.length}):</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {dateStaffPayouts.map(p => (
                        <div key={p.id} className="p-2 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                          <div className="flex-1 min-w-0 pr-1">
                            <span className="font-semibold text-slate-800 block truncate">{p.name}</span>
                            <span className="text-[10px] text-slate-400">({p.type === 'advance' ? 'سلفة' : 'راتب'}) {p.notes}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-rose-600">
                              -{Number(p.amount).toLocaleString()} دج
                            </span>
                            {onDeleteStaffPayout && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`هل أنت متأكد من حذف سجل الدفعة/الراتب (${p.name}) بمبلغ ${Number(p.amount).toLocaleString()} دج؟`)) {
                                    onDeleteStaffPayout(p.id);
                                  }
                                }}
                                title="حذف الدفعة"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : viewTab === 'transactions' ? (
        /* ==================================================== */
        /* VIEW TAB 2 = LIVE ALL TRANSACTIONS & DELETIONS       */
        /* ==================================================== */
        <div className="space-y-4">
          {/* Summary Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">إجمالي المقبوضات المفلترة:</div>
                <div className="text-base sm:text-lg font-bold font-mono text-emerald-600 mt-1">
                  +{transactionsTotals.totalInflow.toLocaleString()} دج
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">إجمالي المصاريف المفلترة:</div>
                <div className="text-base sm:text-lg font-bold font-mono text-rose-600 mt-1">
                  -{transactionsTotals.totalOutflow.toLocaleString()} دج
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">الصافي النقدي:</div>
                <div className={`text-base sm:text-lg font-bold font-mono mt-1 ${transactionsTotals.net >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                  {transactionsTotals.net.toLocaleString()} دج
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                {filteredTransactions.length} عملية
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="بحث في المعاملات بالاسم، الوصف، أو المبلغ..."
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
              >
                <option value="all">كل أنواع المعاملات</option>
                <option value="sale">مبيعات (Ventes)</option>
                <option value="rental">كراء (Locations)</option>
                <option value="tailoring">خياطة وتفصيل (Couture)</option>
                <option value="expense">مصاريف (Dépenses)</option>
                <option value="staffPayout">أجور وسلفيات (Salaires)</option>
              </select>

              <select
                value={txDirectionFilter}
                onChange={(e) => setTxDirectionFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
              >
                <option value="all">كل الاتجاهات</option>
                <option value="inflow">مداخيل ومقبوضات (+)</option>
                <option value="outflow">مصاريف ومدفوعات (-)</option>
              </select>

              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={txDateFilter}
                  onChange={(e) => setTxDateFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 font-mono focus:bg-white focus:border-slate-400 focus:outline-none"
                />
                {txDateFilter && (
                  <button
                    type="button"
                    onClick={() => setTxDateFilter('')}
                    className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-xl text-xs"
                    title="إلغاء تصفية التاريخ"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Inbox className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium text-slate-500">لا توجد عمليات أو معاملات تطابق البحث والتصفية المحددة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">التاريخ والوقت</th>
                      <th className="p-3">نوع العملية</th>
                      <th className="p-3">الجهة / الوصف</th>
                      <th className="p-3">التفاصيل</th>
                      <th className="p-3">المبلغ النقدي</th>
                      <th className="p-3 text-center">حذف العملية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map(tx => {
                      const isInflow = tx.direction === 'inflow';
                      return (
                        <tr key={`${tx.type}_${tx.id}`} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                            <div className="font-semibold">{tx.date}</div>
                            {tx.time && <div className="text-[10px] text-slate-400">{tx.time}</div>}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              tx.type === 'sale' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              tx.type === 'rental' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              tx.type === 'tailoring' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              tx.type === 'expense' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {tx.typeLabel}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-900">
                            {tx.title}
                          </td>
                          <td className="p-3 text-slate-500 text-[11px] max-w-sm truncate">
                            {tx.subtitle}
                          </td>
                          <td className="p-3 font-mono font-bold whitespace-nowrap">
                            <span className={isInflow ? 'text-emerald-600' : 'text-rose-600'}>
                              {isInflow ? '+' : '-'}{tx.amount.toLocaleString()} دج
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteTransaction(tx)}
                              title="حذف هذه المعاملة"
                              className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      ) : (
        /* ==================================================== */
        /* VIEW TAB 2 = HISTORY & PREVIOUS CLOSURES             */
        /* ==================================================== */
        <div className="space-y-4">
          {/* History Filter Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">تصفية حسب الفترة:</span>
              <div className="flex items-center gap-2">
                <select
                  value={historyYear}
                  onChange={(e) => setHistoryYear(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
                >
                  <option value="">كل السنوات</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>

                <select
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
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
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-600">
                عدد الإقفالات: <strong className="text-slate-900 font-mono">{filteredHistory.length}</strong>
              </span>
              <span className="text-slate-600">
                صافي الفارق: <strong className={`font-mono font-bold ${historyTotals.totalDf < 0 ? 'text-rose-600' : historyTotals.totalDf > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {historyTotals.totalDf > 0 ? `+${historyTotals.totalDf.toLocaleString()} دج` : `${historyTotals.totalDf.toLocaleString()} دج`}
                </strong>
              </span>
            </div>
          </div>

          {/* Closures Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Inbox className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium text-slate-500">لا توجد إقفالات سابقة مسجلة في هذه الفترة</p>
                <button
                  onClick={() => setViewTab('today')}
                  className="mt-3 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  إقفال صندوق اليوم الآن
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">تاريخ الإقفال</th>
                      <th className="p-3">رصيد الافتتاح</th>
                      <th className="p-3">المداخيل (Entrées)</th>
                      <th className="p-3">المصاريف (Sorties)</th>
                      <th className="p-3">النظري المتوقع</th>
                      <th className="p-3">الفعلي المحسوب</th>
                      <th className="p-3">الفارق والعجز (Manque)</th>
                      <th className="p-3">ملاحظات</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map(closure => {
                      const isShort = closure.difference < 0;
                      const isSurp = closure.difference > 0;
                      return (
                        <tr key={closure.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-semibold text-slate-900 font-mono">
                            {closure.date}
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {(closure.openingBalance || 0).toLocaleString()} دج
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            +{(closure.totalInflow || 0).toLocaleString()} دج
                          </td>
                          <td className="p-3 font-mono font-bold text-rose-600">
                            -{(closure.totalOutflow || 0).toLocaleString()} دج
                          </td>
                          <td className="p-3 font-mono font-semibold text-slate-800">
                            {(closure.theoreticalAmount || 0).toLocaleString()} دج
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900 bg-slate-50/50">
                            {(closure.actualAmount || 0).toLocaleString()} دج
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono border ${
                              isShort ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              isSurp ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {closure.difference > 0 ? `+${closure.difference.toLocaleString()} دج` : `${closure.difference.toLocaleString()} دج`}
                              <span className="mr-1 text-[10px] font-medium">
                                {isShort ? '(عجز)' : isSurp ? '(فائض)' : '(مضبوط)'}
                              </span>
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px] max-w-xs truncate">
                            {closure.notes || '-'}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedClosureForReceipt(closure)}
                                title="طباعة الوصل"
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDate(closure.date);
                                  setViewTab('today');
                                }}
                                title="تعديل هذا اليوم"
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`هل أنت متأكد من حذف إقفال يوم ${closure.date}؟`)) {
                                    onDeleteClosure(closure.id);
                                  }
                                }}
                                title="حذف"
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

      {/* Clear/Reset Caisse Modal */}
      {showClearConfirmModal && (
        <Modal
          title="تفريغ وتصفير الصندوق"
          onClose={() => {
            setShowClearConfirmModal(false);
            setClearPinError(false);
            setClearPinInput('');
          }}
        >
          <div className="space-y-4" dir="rtl">
            <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200 text-rose-900 text-xs leading-relaxed font-bold flex items-start gap-2.5">
              <Trash2 className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-rose-950 text-sm">تنبيه أمان هـام!</p>
                <p className="font-normal text-rose-800 text-xs mt-0.5">
                  أنت على وشك تفريغ وتصفير بيانات الصندوق لهذا اليوم ({selectedDate}). يرجى تحديد الخيار المطلوب وإدخال كلمة المرور للترخيص.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">اختر طريقة التفريغ:</label>
              
              <button
                type="button"
                onClick={() => setClearOption('reset_closure')}
                className={`w-full p-3 rounded-2xl border text-right transition-all flex items-start gap-3 ${
                  clearOption === 'reset_closure'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="clear_opt"
                  checked={clearOption === 'reset_closure'}
                  onChange={() => setClearOption('reset_closure')}
                  className="mt-1"
                />
                <div>
                  <div className="font-bold text-xs text-slate-900">تصفير الإقفال والمحسوب اليومي فقط (0 دج)</div>
                  <div className="text-[11px] text-slate-500">إلغاء قيد الإقفال المحفوظ وتفريغ المحسوب الفعلي بالدرج مع الإبقاء على سجلات المبيعات والمصاريف.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setClearOption('delete_today_txs')}
                className={`w-full p-3 rounded-2xl border text-right transition-all flex items-start gap-3 ${
                  clearOption === 'delete_today_txs'
                    ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="clear_opt"
                  checked={clearOption === 'delete_today_txs'}
                  onChange={() => setClearOption('delete_today_txs')}
                  className="mt-1"
                />
                <div>
                  <div className="font-bold text-xs text-rose-900">حذف كافة معاملات وتفريغ الصندوق بالكامل</div>
                  <div className="text-[11px] text-rose-700">حذف عمليات البيع، الكراء، الخياطة، والمصاريف الخاصة بهذا اليوم ليبدو الصندوق فارغاً تماماً (0 دج).</div>
                </div>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteClearCaisse();
              }}
              className="space-y-3 pt-2"
            >
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">رمز المرور / كلمة السر للتأكيد:</label>
                <input
                  type="password"
                  value={clearPinInput}
                  onChange={(e) => {
                    setClearPinInput(e.target.value);
                    setClearPinError(false);
                  }}
                  placeholder="••••"
                  maxLength={8}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-center text-lg font-mono font-bold focus:border-rose-500 focus:bg-white focus:outline-none"
                />
                {clearPinError && (
                  <p className="text-xs text-rose-600 font-bold mt-1">رمز المرور غير صحيح!</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowClearConfirmModal(false);
                    setClearPinError(false);
                    setClearPinInput('');
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تأكيد تفريغ الصندوق</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
});
