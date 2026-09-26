import React, { useMemo, useState } from 'react';
import {
  ClothItem,
  Rental,
  Sale,
  Expense,
  Credit,
  StaffPayout,
  MaintenanceOrder,
  DailyCaisseClosure,
  RawMaterial,
  StaffMember
} from '../types';
import { downloadElementAsPng, triggerBlobDownload } from '../utils/pngDownload';
import { openPrintInterface } from '../utils/printInterface';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  Package,
  Shirt,
  ShoppingBag,
  Scissors,
  Users,
  CreditCard,
  Printer,
  Download,
  FileSpreadsheet,
  CalendarRange,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Coins,
  Landmark,
  BarChart3,
  Receipt,
  Star,
  Clock,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';

// =====================================================================
// Types & Props
// =====================================================================

interface FullReportProps {
  clothes: ClothItem[];
  rentals: Rental[];
  sales: Sale[];
  expenses: Expense[];
  credits: Credit[];
  staffPayouts: StaffPayout[];
  maintenanceOrders?: MaintenanceOrder[];
  caisseClosures?: DailyCaisseClosure[];
  rawMaterials?: RawMaterial[];
  staffMembers?: StaffMember[];
  hideFinances: boolean;
}

type PeriodKey = 'month' | 'lastMonth' | 'year' | 'all' | 'custom';

interface DateRange {
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
}

interface NamedTotal {
  key: string;
  name: string;
  count: number;
  total: number;
  extra?: number;
  sub?: string;
}

interface TrendRow {
  key: string;
  label: string;
  rentals: number;
  sales: number;
  salesProfit: number;
  tailoring: number;
  tailoringCost: number;
  expenses: number;
  staff: number;
  net: number;
}

// =====================================================================
// Pure helpers
// =====================================================================

const EMPTY_ORDERS: MaintenanceOrder[] = [];
const EMPTY_CLOSURES: DailyCaisseClosure[] = [];
const EMPTY_RAW: RawMaterial[] = [];
const EMPTY_STAFF: StaffMember[] = [];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toDay = (s?: string | null) => (s ? String(s).slice(0, 10) : '');
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const lastDayOfMonth = (y: number, m1: number) => new Date(y, m1, 0).getDate();

// Date used to recognise income – identical to the dashboard & caisse logic
const rentalDateOf = (r: Rental) =>
  toDay(r.paymentDate || (r.createdAt ? r.createdAt.split('T')[0] : r.startDate));
const tailoringDateOf = (o: MaintenanceOrder) =>
  toDay(o.paymentDate || (o.createdAt ? o.createdAt.split('T')[0] : o.receivedDate));

const amountFormatter = new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 0 });
const fmtAmount = (v: number) => `${amountFormatter.format(Math.round(num(v)))} دج`;
const fmtInt = (v: number) => amountFormatter.format(Math.round(num(v)));
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('ar-DZ', { month: 'long', year: 'numeric' });
};

const dayLabel = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('ar-DZ', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

const resolveRange = (period: PeriodKey, todayStr: string, customFrom: string, customTo: string): DateRange | null => {
  const y = Number(todayStr.slice(0, 4));
  const m = Number(todayStr.slice(5, 7));
  switch (period) {
    case 'month':
      return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(lastDayOfMonth(y, m))}` };
    case 'lastMonth': {
      const d = new Date(y, m - 2, 1);
      const ly = d.getFullYear();
      const lm = d.getMonth() + 1;
      return { from: `${ly}-${pad2(lm)}-01`, to: `${ly}-${pad2(lm)}-${pad2(lastDayOfMonth(ly, lm))}` };
    }
    case 'year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'custom': {
      if (!customFrom && !customTo) return null;
      const from = customFrom || '0000-01-01';
      const to = customTo || '9999-12-31';
      return from <= to ? { from, to } : { from: to, to: from };
    }
    default:
      return null;
  }
};

const daysBetween = (a: string, b: string) => {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 0;
  return Math.round(Math.abs(db - da) / 86400000);
};

const bump = (
  map: Map<string, NamedTotal>,
  key: string,
  name: string,
  amount: number,
  countInc = 1,
  extra = 0,
  sub?: string
) => {
  const cur = map.get(key);
  if (cur) {
    cur.count += countInc;
    cur.total += amount;
    cur.extra = (cur.extra || 0) + extra;
  } else {
    map.set(key, { key, name, count: countInc, total: amount, extra, sub });
  }
};

const sortedTotals = (map: Map<string, NamedTotal>, limit?: number) => {
  const arr = Array.from(map.values()).sort((a, b) => b.total - a.total);
  return typeof limit === 'number' ? arr.slice(0, limit) : arr;
};

const SERVICE_LABELS: Record<string, string> = {
  ironing_prep: 'كواء وغسيل وكي',
  alteration: 'تعديل مقاس',
  repair: 'تصليح وترقيع',
  custom_sewing: 'تفصيل جديد',
  other: 'خدمات أخرى'
};

const TAILORING_STATUS_LABELS: Record<string, string> = {
  pending: 'في الانتظار',
  in_progress: 'قيد الإنجاز',
  ready: 'جاهزة للتسليم',
  delivered: 'تم التسليم'
};

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'month', label: 'هذا الشهر' },
  { key: 'lastMonth', label: 'الشهر الماضي' },
  { key: 'year', label: 'هذه السنة' },
  { key: 'all', label: 'كل الفترات' },
  { key: 'custom', label: 'فترة مخصصة' }
];

// =====================================================================
// Presentational building blocks
// =====================================================================

type Tone = 'blue' | 'slate' | 'dark' | 'emerald' | 'rose' | 'amber' | 'violet';

const TONES: Record<Tone, { box: string; label: string; value: string; hint: string }> = {
  blue: { box: 'bg-blue-50 border-blue-200', label: 'text-blue-800', value: 'text-blue-900', hint: 'text-blue-600' },
  slate: { box: 'bg-slate-50 border-slate-200', label: 'text-slate-700', value: 'text-slate-900', hint: 'text-slate-500' },
  dark: { box: 'bg-slate-900 border-slate-900', label: 'text-slate-300', value: 'text-white', hint: 'text-slate-400' },
  emerald: { box: 'bg-emerald-50 border-emerald-200', label: 'text-emerald-800', value: 'text-emerald-900', hint: 'text-emerald-600' },
  rose: { box: 'bg-rose-50 border-rose-200', label: 'text-rose-800', value: 'text-rose-900', hint: 'text-rose-600' },
  amber: { box: 'bg-amber-50 border-amber-200', label: 'text-amber-800', value: 'text-amber-900', hint: 'text-amber-600' },
  violet: { box: 'bg-violet-50 border-violet-200', label: 'text-violet-800', value: 'text-violet-900', hint: 'text-violet-600' }
};

const Kpi: React.FC<{ label: string; value: string; hint?: string; tone?: Tone; icon?: React.ReactNode }> = ({
  label,
  value,
  hint,
  tone = 'slate',
  icon
}) => {
  const t = TONES[tone];
  return (
    <div className={`p-2.5 sm:p-4 border rounded-xl sm:rounded-2xl ${t.box} break-inside-avoid`}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className={`text-[10px] sm:text-xs font-bold ${t.label}`}>{label}</span>
        {icon && <span className={`${t.hint} shrink-0`}>{icon}</span>}
      </div>
      <span className={`text-sm sm:text-xl font-black whitespace-nowrap block ${t.value}`}>{value}</span>
      {hint && <span className={`text-[9px] sm:text-[10px] block mt-1 ${t.hint}`}>{hint}</span>}
    </div>
  );
};

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, aside, children }) => (
  <section className="border border-slate-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 bg-white break-inside-avoid">
    <header className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 mb-2.5 sm:mb-3 pb-2 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">{icon}</span>
        <div>
          <h3 className="font-black text-xs sm:text-sm text-slate-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {aside && <div className="text-[10px] sm:text-xs font-bold text-slate-600">{aside}</div>}
    </header>
    {children}
  </section>
);

const DataTable: React.FC<{
  headers: { label: string; className?: string }[];
  rows: React.ReactNode[][];
  footer?: React.ReactNode[];
  emptyText?: string;
  rowClassName?: (index: number) => string;
  dense?: boolean;
}> = ({ headers, rows, footer, emptyText = 'لا توجد بيانات في هذه الفترة', rowClassName, dense }) => {
  const cell = dense ? 'p-1 sm:p-1.5' : 'p-1.5 sm:p-2';
  return (
    <div className="overflow-x-auto -mx-0.5">
      <table className="w-full text-right text-[10px] sm:text-xs">
        <thead className="bg-slate-100 text-slate-600 font-bold">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={`${cell} whitespace-nowrap ${h.className || ''}`}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="p-3 text-center text-slate-400 font-medium">{emptyText}</td>
            </tr>
          ) : (
            rows.map((r, ri) => (
              <tr key={ri} className={rowClassName ? rowClassName(ri) : ''}>
                {r.map((c, ci) => (
                  <td key={ci} className={`${cell} align-top ${headers[ci]?.className || ''}`}>{c}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && rows.length > 0 && (
          <tfoot className="bg-slate-50 font-black text-slate-900 border-t border-slate-200">
            <tr>
              {footer.map((c, ci) => (
                <td key={ci} className={`${cell} ${headers[ci]?.className || ''}`}>{c}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

const PLRow: React.FC<{
  label: string;
  value: string;
  kind?: 'line' | 'cost' | 'total' | 'grand';
  note?: string;
}> = ({ label, value, kind = 'line', note }) => {
  const base = 'flex items-center justify-between gap-2 px-2 sm:px-3';
  if (kind === 'grand') {
    return (
      <div className={`${base} py-2 sm:py-2.5 bg-slate-900 text-white rounded-xl mt-1`}>
        <span className="text-xs sm:text-sm font-black">{label}{note && <span className="text-[10px] font-bold text-slate-300 mr-1.5">{note}</span>}</span>
        <span className="text-sm sm:text-base font-black whitespace-nowrap font-mono">{value}</span>
      </div>
    );
  }
  if (kind === 'total') {
    return (
      <div className={`${base} py-1.5 sm:py-2 bg-slate-100 rounded-lg`}>
        <span className="text-[11px] sm:text-xs font-black text-slate-900">{label}{note && <span className="text-[10px] font-bold text-slate-500 mr-1.5">{note}</span>}</span>
        <span className="text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap font-mono">{value}</span>
      </div>
    );
  }
  return (
    <div className={`${base} py-1 sm:py-1.5`}>
      <span className="text-[11px] sm:text-xs font-semibold text-slate-600 pr-3 sm:pr-4">{label}{note && <span className="text-[10px] font-medium text-slate-400 mr-1.5">{note}</span>}</span>
      <span className={`text-[11px] sm:text-xs font-bold whitespace-nowrap font-mono ${kind === 'cost' ? 'text-rose-700' : 'text-slate-800'}`}>
        {kind === 'cost' ? `− ${value}` : value}
      </span>
    </div>
  );
};

const MiniRow: React.FC<{ label: string; value: React.ReactNode; strong?: boolean }> = ({ label, value, strong }) => (
  <div className={`flex items-center justify-between gap-2 text-[10px] sm:text-[11px] py-1 border-b border-dashed border-slate-100 last:border-0 ${strong ? 'font-black text-slate-900' : 'font-semibold text-slate-600'}`}>
    <span>{label}</span>
    <span className="whitespace-nowrap font-mono">{value}</span>
  </div>
);

// =====================================================================
// Main component
// =====================================================================

export const FullReport: React.FC<FullReportProps> = React.memo(({
  clothes,
  rentals,
  sales,
  expenses,
  credits,
  staffPayouts,
  maintenanceOrders = EMPTY_ORDERS,
  caisseClosures = EMPTY_CLOSURES,
  rawMaterials = EMPTY_RAW,
  staffMembers = EMPTY_STAFF,
  hideFinances
}) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const formattedDate = now.toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [downloadNote, setDownloadNote] = useState('');

  const range = useMemo(() => resolveRange(period, todayStr, customFrom, customTo), [period, todayStr, customFrom, customTo]);

  const periodLabel = useMemo(() => {
    const base = PERIOD_OPTIONS.find(p => p.key === period)?.label || '';
    if (!range) return period === 'custom' ? 'فترة مخصصة (حدد التاريخ)' : 'كل الفترات منذ بداية النشاط';
    return `${base}: من ${range.from} إلى ${range.to}`;
  }, [period, range]);

  const fileName = `التقرير_المالي_الشامل_${range ? `${range.from}_${range.to}` : 'كل_الفترات'}`;

  const money = (v: number) => (hideFinances ? '••••' : fmtAmount(v));
  const signedMoney = (v: number) => (hideFinances ? '••••' : `${v < 0 ? '− ' : ''}${fmtAmount(Math.abs(v))}`);

  // ------------------------------------------------------------------
  // Heavy lifting: one memoised pass over every collection
  // ------------------------------------------------------------------
  const report = useMemo(() => {
    const inRange = (d: string) => !range || (!!d && d >= range.from && d <= range.to);

    // Trend granularity: daily for short windows, monthly otherwise
    const daily = !!range && daysBetween(range.from, range.to) <= 45;
    const bucketOf = (d: string) => (daily ? d : d.slice(0, 7));
    const trend = new Map<string, TrendRow>();
    const trendRow = (d: string) => {
      const key = bucketOf(d);
      let row = trend.get(key);
      if (!row) {
        row = { key, label: daily ? dayLabel(key) : monthLabel(key), rentals: 0, sales: 0, salesProfit: 0, tailoring: 0, tailoringCost: 0, expenses: 0, staff: 0, net: 0 };
        trend.set(key, row);
      }
      return row;
    };

    const customerAgg = new Map<string, NamedTotal>();
    const addCustomer = (name: string | undefined, phone: string | undefined, amount: number, sub: string) => {
      const cleanName = (name || '').trim();
      if (!cleanName) return;
      const key = (phone || '').trim() || cleanName.toLowerCase();
      bump(customerAgg, key, cleanName, amount, 1, 0, sub);
    };

    // ---------------- Rentals ----------------
    let rentalIncome = 0;
    let rentalCount = 0;
    let rentalDealsValue = 0;
    let rentalDiscounts = 0;
    let rentalAccessories = 0;
    let rentalPenalties = 0;
    let rentalReturnedInPeriod = 0;
    let cautionsDeducted = 0;
    const rentedItems = new Map<string, NamedTotal>();

    // Snapshot (current state, independent of period)
    const activeRentals: Rental[] = [];
    let reservedCount = 0;
    let cleaningCount = 0;
    let overdueCount = 0;
    let heldCautionsTotal = 0;
    let heldCautionsCount = 0;
    let rentalOutstanding = 0;

    for (let i = 0; i < rentals.length; i++) {
      const r = rentals[i];
      const paid = num(r.paidAmount);
      if (inRange(rentalDateOf(r))) {
        rentalIncome += paid;
        rentalCount += 1;
        rentalDealsValue += num(r.rentPrice);
        rentalDiscounts += num(r.discountAmount);
        if (r.hasAccessories) rentalAccessories += num(r.accessoryPrice);
        rentalPenalties += num(r.penaltyAmount);
        bump(rentedItems, r.itemId || r.itemName, r.itemName, paid, num(r.qty) || 1);
        addCustomer(r.customerName, r.customerPhone, paid, 'كراء');
        trendRow(rentalDateOf(r)).rentals += paid;
      }
      if (r.status === 'returned' && inRange(toDay(r.actualReturnDate))) {
        rentalReturnedInPeriod += 1;
        if (r.cautionStatus === 'deducted') cautionsDeducted += num(r.cautionAmount);
      }

      if (r.status === 'active') {
        activeRentals.push(r);
        if (r.expectedReturnDate && toDay(r.expectedReturnDate) < todayStr) overdueCount += 1;
      } else if (r.status === 'reserved') {
        reservedCount += 1;
      } else if (r.status === 'cleaning') {
        cleaningCount += 1;
      }
      if (r.status !== 'returned' && r.status !== 'cancelled') {
        rentalOutstanding += num(r.remainingAmount);
        if (r.cautionStatus === 'held') {
          heldCautionsTotal += num(r.cautionAmount);
          heldCautionsCount += 1;
        }
      }
    }
    activeRentals.sort((a, b) => (a.expectedReturnDate || '').localeCompare(b.expectedReturnDate || ''));

    // ---------------- Sales ----------------
    let salesRevenue = 0;
    let salesPaid = 0;
    let salesDebt = 0;
    let salesProfit = 0;
    let salesDiscounts = 0;
    let salesCount = 0;
    let salesQty = 0;
    const soldItems = new Map<string, NamedTotal>();

    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      const d = toDay(s.date);
      if (!inRange(d)) continue;
      const amount = num(s.totalAmount);
      const profit = num(s.profit);
      salesRevenue += amount;
      salesPaid += s.paidAmount !== undefined ? num(s.paidAmount) : amount;
      salesDebt += num(s.debtAmount);
      salesProfit += profit;
      salesDiscounts += num(s.discount);
      salesCount += 1;
      const items = s.items || [];
      for (let j = 0; j < items.length; j++) {
        const it = items[j];
        const q = num(it.qty) || 1;
        salesQty += q;
        bump(soldItems, it.itemId || it.name, it.name, num(it.total) || num(it.price) * q, q);
      }
      addCustomer(s.customerName, s.customerPhone, amount, 'بيع');
      const row = trendRow(d);
      row.sales += amount;
      row.salesProfit += profit;
    }
    const salesCogs = salesRevenue - salesProfit;

    // ---------------- Tailoring ----------------
    let tailoringIncome = 0;
    let tailoringPriceTotal = 0;
    let tailoringCost = 0;
    let tailoringCount = 0;
    const tailoringByService = new Map<string, NamedTotal>();
    const tailoringStatus: Record<string, number> = { pending: 0, in_progress: 0, ready: 0, delivered: 0 };
    const pendingOrders: MaintenanceOrder[] = [];
    let tailoringOutstanding = 0;

    for (let i = 0; i < maintenanceOrders.length; i++) {
      const o = maintenanceOrders[i];
      const d = tailoringDateOf(o);
      if (inRange(d)) {
        const paid = num(o.paidAmount);
        const cost = num(o.cost);
        tailoringIncome += paid;
        tailoringPriceTotal += num(o.price);
        tailoringCost += cost;
        tailoringCount += 1;
        bump(tailoringByService, o.serviceType || 'other', SERVICE_LABELS[o.serviceType] || SERVICE_LABELS.other, paid, 1, cost);
        addCustomer(o.customerName, o.customerPhone, paid, 'خياطة');
        const row = trendRow(d);
        row.tailoring += paid;
        row.tailoringCost += cost;
      }
      tailoringStatus[o.status] = (tailoringStatus[o.status] || 0) + 1;
      if (o.status !== 'delivered') {
        pendingOrders.push(o);
        tailoringOutstanding += num(o.remainingAmount);
      }
    }
    pendingOrders.sort((a, b) => (a.expectedDeliveryDate || '').localeCompare(b.expectedDeliveryDate || ''));
    const tailoringProfit = tailoringIncome - tailoringCost;

    // ---------------- Expenses ----------------
    let totalExpenses = 0;
    let supplierPurchases = 0;
    let supplierPurchasesCount = 0;
    let supplierInvoicesTotal = 0;
    let expenseCount = 0;
    const expenseCategories = new Map<string, NamedTotal>();
    const expenseScopes: Record<string, number> = { rental: 0, sale: 0, tailoring: 0, general: 0 };

    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const d = toDay(e.date);
      if (!inRange(d)) continue;
      const amt = num(e.amount);
      totalExpenses += amt;
      expenseCount += 1;
      if (e.isSupplierPurchase) {
        supplierPurchases += amt;
        supplierPurchasesCount += 1;
        supplierInvoicesTotal += num(e.totalInvoiceAmount) || amt;
        bump(expenseCategories, '__supplier__', 'مشتريات الموردين والسلع (المدفوع)', amt);
      } else {
        const cat = (e.category || 'غير مصنف').trim() || 'غير مصنف';
        bump(expenseCategories, cat, cat, amt);
      }
      const scope = e.expenseScope || 'general';
      expenseScopes[scope] = (expenseScopes[scope] || 0) + amt;
      trendRow(d).expenses += amt;
    }
    const generalExpenses = totalExpenses - supplierPurchases;

    // ---------------- Staff ----------------
    let staffTotal = 0;
    let staffBonuses = 0;
    let staffDeductions = 0;
    let staffPayoutCount = 0;
    const staffByMember = new Map<string, NamedTotal>();
    const staffByType = new Map<string, NamedTotal>();

    for (let i = 0; i < staffPayouts.length; i++) {
      const p = staffPayouts[i];
      const d = toDay(p.date);
      if (!inRange(d)) continue;
      const amt = num(p.amount);
      staffTotal += amt;
      staffBonuses += num(p.bonus);
      staffDeductions += num(p.absenceDeduction) + num(p.advancesDeduction);
      staffPayoutCount += 1;
      bump(staffByMember, p.staffId || p.name, p.name || 'غير محدد', amt, 1, num(p.bonus));
      bump(staffByType, p.type || 'أخرى', p.type || 'أخرى', amt);
      trendRow(d).staff += amt;
    }
    const expectedMonthlyPayroll = staffMembers.reduce((s, m) => {
      if (m.salaryType === 'daily') return s + num(m.dailyRate) * num(m.workDaysPerMonth);
      return s + num(m.baseSalary);
    }, 0);

    // ---------------- Credits (current balances) ----------------
    let customerDebtTotal = 0;
    let customerDebtCount = 0;
    let supplierDebtTotal = 0;
    let supplierDebtCount = 0;
    const debtByType = new Map<string, NamedTotal>();
    const debtors = new Map<string, NamedTotal>();
    const supplierCreditors = new Map<string, NamedTotal>();

    for (let i = 0; i < credits.length; i++) {
      const c = credits[i];
      const amt = num(c.amount);
      if (amt <= 0) continue;
      if (c.supplierDebt) {
        supplierDebtTotal += amt;
        supplierDebtCount += 1;
        const name = (c.supplierName || c.name || 'مورد').trim();
        bump(supplierCreditors, name.toLowerCase(), name, amt);
      } else {
        customerDebtTotal += amt;
        customerDebtCount += 1;
        const type = (c.type || 'دين').trim();
        bump(debtByType, type, type, amt);
        const name = (c.name || 'زبون').trim();
        bump(debtors, (c.phone || '').trim() || name.toLowerCase(), name, amt);
      }
    }

    // ---------------- Caisse closures ----------------
    let closuresCount = 0;
    let shortageTotal = 0;
    let shortageDays = 0;
    let surplusTotal = 0;
    let surplusDays = 0;
    let balancedDays = 0;
    let closuresInflow = 0;
    let closuresOutflow = 0;
    const shortageList: DailyCaisseClosure[] = [];

    for (let i = 0; i < caisseClosures.length; i++) {
      const c = caisseClosures[i];
      if (!inRange(toDay(c.date))) continue;
      closuresCount += 1;
      closuresInflow += num(c.totalInflow);
      closuresOutflow += num(c.totalOutflow);
      const diff = num(c.difference);
      if (diff < 0) {
        shortageTotal += Math.abs(diff);
        shortageDays += 1;
        shortageList.push(c);
      } else if (diff > 0) {
        surplusTotal += diff;
        surplusDays += 1;
      } else {
        balancedDays += 1;
      }
    }
    shortageList.sort((a, b) => num(a.difference) - num(b.difference));

    // ---------------- Inventory (snapshot) ----------------
    let models = clothes.length;
    let stock1 = 0;
    let stock2 = 0;
    let rentedPieces = 0;
    let cleaningPieces = 0;
    let stockCostValue = 0;
    let stockSellValue = 0;
    let rentModels = 0;
    let sellModels = 0;
    let outOfStockModels = 0;
    const inventoryByCategory = new Map<string, NamedTotal>();

    for (let i = 0; i < clothes.length; i++) {
      const c = clothes[i];
      const s1 = c.stock1 !== undefined ? num(c.stock1) : num(c.stock);
      const s2 = c.stock2 !== undefined ? num(c.stock2) : 0;
      const total = s1 + s2;
      stock1 += s1;
      stock2 += s2;
      rentedPieces += num(c.rentedCount);
      cleaningPieces += num(c.inCleaningCount);
      stockCostValue += num(c.buyCost) * total;
      if (c.purpose === 'sell' || c.purpose === 'both') stockSellValue += num(c.sellPrice) * total;
      if (c.purpose === 'rent' || c.purpose === 'both') rentModels += 1;
      if (c.purpose === 'sell' || c.purpose === 'both') sellModels += 1;
      if (total <= 0) outOfStockModels += 1;
      const cat = (c.category || 'غير مصنف').trim() || 'غير مصنف';
      bump(inventoryByCategory, cat, cat, num(c.buyCost) * total, 1, total);
    }
    const totalPieces = stock1 + stock2;

    let rawMeters = 0;
    let rawRolls = 0;
    let rawValue = 0;
    for (let i = 0; i < rawMaterials.length; i++) {
      const m = rawMaterials[i];
      rawMeters += num(m.totalMeters);
      rawRolls += num(m.rollCount);
      rawValue += num(m.totalCostValue) || num(m.totalMeters) * num(m.costPerMeter);
    }

    // ---------------- Totals ----------------
    const grossRevenue = rentalIncome + salesRevenue + tailoringIncome;
    const directCosts = salesCogs + tailoringCost;
    const grossProfit = grossRevenue - directCosts;
    const operatingExpenses = totalExpenses + staffTotal;
    const netProfit = grossProfit - operatingExpenses;
    const netMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    const grossMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
    const operationsCount = rentalCount + salesCount + tailoringCount;

    // ---------------- Trend rows ----------------
    const trendAll = Array.from(trend.values())
      .map(r => ({ ...r, net: r.rentals + r.salesProfit + (r.tailoring - r.tailoringCost) - r.expenses - r.staff }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const TREND_LIMIT = daily ? 45 : 12;
    const trendRows = trendAll.length > TREND_LIMIT ? trendAll.slice(trendAll.length - TREND_LIMIT) : trendAll;
    const trendTruncated = trendAll.length - trendRows.length;
    const trendTotals = trendRows.reduce(
      (acc, r) => ({
        rentals: acc.rentals + r.rentals,
        sales: acc.sales + r.sales,
        tailoring: acc.tailoring + r.tailoring,
        expenses: acc.expenses + r.expenses,
        staff: acc.staff + r.staff,
        net: acc.net + r.net
      }),
      { rentals: 0, sales: 0, tailoring: 0, expenses: 0, staff: 0, net: 0 }
    );

    return {
      daily,
      // rentals
      rentalIncome, rentalCount, rentalDealsValue, rentalDiscounts, rentalAccessories, rentalPenalties,
      rentalReturnedInPeriod, cautionsDeducted, activeRentals, reservedCount, cleaningCount, overdueCount,
      heldCautionsTotal, heldCautionsCount, rentalOutstanding,
      topRented: sortedTotals(rentedItems, 5),
      // sales
      salesRevenue, salesPaid, salesDebt, salesProfit, salesDiscounts, salesCount, salesQty, salesCogs,
      topSold: sortedTotals(soldItems, 5),
      // tailoring
      tailoringIncome, tailoringPriceTotal, tailoringCost, tailoringCount, tailoringProfit, tailoringStatus,
      tailoringByService: sortedTotals(tailoringByService), pendingOrders, tailoringOutstanding,
      // expenses
      totalExpenses, generalExpenses, supplierPurchases, supplierPurchasesCount, supplierInvoicesTotal, expenseCount,
      expenseCategories: sortedTotals(expenseCategories), expenseScopes,
      // staff
      staffTotal, staffBonuses, staffDeductions, staffPayoutCount, expectedMonthlyPayroll,
      staffByMember: sortedTotals(staffByMember), staffByType: sortedTotals(staffByType),
      // credits
      customerDebtTotal, customerDebtCount, supplierDebtTotal, supplierDebtCount,
      debtByType: sortedTotals(debtByType), topDebtors: sortedTotals(debtors, 6), topSupplierCreditors: sortedTotals(supplierCreditors, 6),
      // caisse
      closuresCount, shortageTotal, shortageDays, surplusTotal, surplusDays, balancedDays, closuresInflow, closuresOutflow,
      shortageList: shortageList.slice(0, 6),
      // inventory
      models, stock1, stock2, totalPieces, rentedPieces, cleaningPieces, stockCostValue, stockSellValue, rentModels, sellModels,
      outOfStockModels, inventoryByCategory: sortedTotals(inventoryByCategory, 8),
      rawMeters, rawRolls, rawValue, rawCount: rawMaterials.length,
      // customers
      topCustomers: sortedTotals(customerAgg, 6),
      // totals
      grossRevenue, directCosts, grossProfit, operatingExpenses, netProfit, netMargin, grossMargin, operationsCount,
      // trend
      trendRows, trendTruncated, trendTotals
    };
  }, [range, todayStr, rentals, sales, maintenanceOrders, expenses, staffPayouts, staffMembers, credits, caisseClosures, clothes, rawMaterials]);

  // ------------------------------------------------------------------
  // Exports
  // ------------------------------------------------------------------
  const exportToImage = async () => {
    const element = document.getElementById('boutiqueFullReportContent');
    if (!element) return;
    setDownloadNote('جاري تنزيل الصورة بصيغة PNG...');
    try {
      await downloadElementAsPng(element, fileName);
      setDownloadNote('تم تنزيل الصورة بصيغة PNG');
    } catch (error) {
      console.error('Error exporting report to image:', error);
      setDownloadNote('تعذر تنزيل الصورة بصيغة PNG');
    }
  };

  const handlePrint = () => {
    openPrintInterface({
      title: 'التقرير المالي والإداري الشامل',
      fileName,
      sourceElement: document.getElementById('boutiqueFullReportContent')
    });
  };

  const exportCsv = () => {
    if (hideFinances) {
      setDownloadNote('أظهر الأرقام المالية أولاً (وضع الخصوصية مفعّل) قبل تصدير ملف Excel');
      return;
    }
    const r = report;
    const rows: (string | number)[][] = [];
    const push = (...cells: (string | number)[]) => rows.push(cells);
    const n = (v: number) => Math.round(v);

    push('التقرير المالي والإداري الشامل - بوتيك مانجر برو');
    push('تاريخ الإصدار', `${formattedDate} ${formattedTime}`);
    push('الفترة', periodLabel);
    push();
    push('قائمة الدخل (الأرباح والخسائر)', 'المبلغ (دج)');
    push('مداخيل الكراء (المدفوع)', n(r.rentalIncome));
    push('مداخيل المبيعات (رقم الأعمال)', n(r.salesRevenue));
    push('مداخيل الخياطة والتعديل (المدفوع)', n(r.tailoringIncome));
    push('إجمالي المداخيل', n(r.grossRevenue));
    push('تكلفة البضاعة المباعة', -n(r.salesCogs));
    push('تكلفة أشغال الخياطة', -n(r.tailoringCost));
    push('مجمل الربح', n(r.grossProfit));
    push('مصاريف عامة وتشغيلية', -n(r.generalExpenses));
    push('مشتريات الموردين (المدفوع)', -n(r.supplierPurchases));
    push('رواتب ومسحوبات العمال', -n(r.staffTotal));
    push('إجمالي المصاريف التشغيلية', -n(r.operatingExpenses));
    push('صافي الربح', n(r.netProfit));
    push('هامش صافي الربح %', Math.round(r.netMargin));
    push();
    push('الوضع المالي الحالي', 'المبلغ (دج)', 'العدد');
    push('ديون الزبائن المستحقة لنا', n(r.customerDebtTotal), r.customerDebtCount);
    push('ديون علينا للموردين', n(r.supplierDebtTotal), r.supplierDebtCount);
    push('ضمانات محتجزة (أمانة)', n(r.heldCautionsTotal), r.heldCautionsCount);
    push('قيمة مخزون الملابس بسعر التكلفة', n(r.stockCostValue), r.totalPieces);
    push('قيمة الأقمشة والمواد الأولية', n(r.rawValue), r.rawCount);
    push();
    push(r.daily ? 'التطور اليومي' : 'التطور الشهري', 'الكراء', 'المبيعات', 'الخياطة', 'المصاريف', 'العمال', 'الصافي');
    r.trendRows.forEach(t => push(t.key, n(t.rentals), n(t.sales), n(t.tailoring), n(t.expenses), n(t.staff), n(t.net)));
    push();
    push('المصاريف حسب التصنيف', 'العدد', 'المبلغ (دج)');
    r.expenseCategories.forEach(c => push(c.name, c.count, n(c.total)));
    push();
    push('دفعات العمال', 'عدد الدفعات', 'المبلغ (دج)');
    r.staffByMember.forEach(s => push(s.name, s.count, n(s.total)));
    push();
    push('أكثر القطع كراءً', 'عدد المرات', 'المداخيل (دج)');
    r.topRented.forEach(t => push(t.name, t.count, n(t.total)));
    push();
    push('أكثر القطع مبيعاً', 'الكمية', 'المداخيل (دج)');
    r.topSold.forEach(t => push(t.name, t.count, n(t.total)));
    push();
    push('الصندوق', 'القيمة');
    push('أيام الجرد المسجلة', r.closuresCount);
    push('إجمالي العجز (دج)', n(r.shortageTotal));
    push('إجمالي الفائض (دج)', n(r.surplusTotal));

    const csv = '\uFEFF' + rows
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    triggerBlobDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
    setDownloadNote('تم تصدير ملف Excel (CSV) بنجاح');
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const r = report;
  const netTone: Tone = hideFinances ? 'blue' : r.netProfit >= 0 ? 'blue' : 'rose';
  const caisseDiff = r.surplusTotal - r.shortageTotal;
  const showScopes = (r.expenseScopes.rental || 0) + (r.expenseScopes.sale || 0) + (r.expenseScopes.tailoring || 0) > 0;

  const activityShare = (v: number) => `${pct(v, r.grossRevenue)}% من المداخيل`;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* ================= Toolbar (not printed) ================= */}
      <div className="no-print space-y-2 bg-slate-50 p-2 sm:p-3 rounded-xl border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black text-slate-700 flex items-center gap-1 ml-1">
              <CalendarRange className="w-3.5 h-3.5" />
              الفترة:
            </span>
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                  period === opt.key
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 w-full lg:w-auto">
            <button
              type="button"
              onClick={exportCsv}
              className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              Excel (CSV)
            </button>
            <button
              type="button"
              onClick={exportToImage}
              className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              صورة PNG
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
            >
              <Printer className="w-4 h-4 shrink-0" />
              طباعة
            </button>
          </div>
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              من
              <input
                type="date"
                dir="ltr"
                value={customFrom}
                max={customTo || undefined}
                onChange={e => setCustomFrom(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              إلى
              <input
                type="date"
                dir="ltr"
                value={customTo}
                min={customFrom || undefined}
                onChange={e => setCustomTo(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </label>
            {(customFrom || customTo) && (
              <button
                type="button"
                onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline"
              >
                مسح
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px] font-bold text-slate-500">
          <span>{downloadNote || `${periodLabel} • ${fmtInt(r.operationsCount)} عملية`}</span>
          {hideFinances && (
            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              <EyeOff className="w-3 h-3" />
              وضع الخصوصية مفعّل: الأرقام المالية مخفية في التقرير
            </span>
          )}
        </div>
      </div>

      {/* ================= Printable report ================= */}
      <div
        id="boutiqueFullReportContent"
        className="space-y-3 sm:space-y-5 text-slate-800 p-3 sm:p-7 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl"
        dir="rtl"
      >
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-3 sm:pb-4 text-right">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
            <div>
              <h1 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight">التقرير المالي والإداري الشامل</h1>
              <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-1">
                قائمة الدخل، تحليل الأنشطة (كراء • بيع • خياطة)، الديون، الصندوق، العمال، المخزون والأداء
              </p>
              <p className="inline-flex items-center gap-1 mt-2 text-[10px] sm:text-[11px] font-black text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                <CalendarRange className="w-3 h-3" />
                {periodLabel}
              </p>
            </div>
            <div className="text-left bg-slate-50 border border-slate-200 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl self-start sm:self-auto">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 block">{formattedDate}</span>
              <span className="text-[10px] sm:text-[11px] font-mono text-slate-400">{formattedTime}</span>
            </div>
          </div>
        </div>

        {/* 1. Executive KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Kpi tone="blue" icon={<ArrowDownLeft className="w-3.5 h-3.5" />} label="إجمالي المداخيل" value={money(r.grossRevenue)} hint={`${fmtInt(r.operationsCount)} عملية (كراء + بيع + خياطة)`} />
          <Kpi tone="emerald" icon={<TrendingUp className="w-3.5 h-3.5" />} label="مجمل الربح" value={money(r.grossProfit)} hint={hideFinances ? 'بعد التكاليف المباشرة' : `هامش ${Math.round(r.grossMargin)}% بعد تكلفة البضاعة والخياطة`} />
          <Kpi tone="dark" icon={<ArrowUpRight className="w-3.5 h-3.5" />} label="المصاريف التشغيلية" value={money(r.operatingExpenses)} hint={`${fmtInt(r.expenseCount)} مصروف + ${fmtInt(r.staffPayoutCount)} دفعة عمال`} />
          <Kpi tone={netTone} icon={r.netProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />} label="صافي الربح" value={signedMoney(r.netProfit)} hint={hideFinances ? 'الربح الصافي للبوتيك' : `هامش صافي ${Math.round(r.netMargin)}%`} />
          <Kpi tone="amber" icon={<CreditCard className="w-3.5 h-3.5" />} label="ديون الزبائن لنا" value={money(r.customerDebtTotal)} hint={`${fmtInt(r.customerDebtCount)} دين مسجل (الرصيد الحالي)`} />
          <Kpi tone="rose" icon={<Landmark className="w-3.5 h-3.5" />} label="ديون علينا للموردين" value={money(r.supplierDebtTotal)} hint={`${fmtInt(r.supplierDebtCount)} مورد/فاتورة`} />
          <Kpi tone="violet" icon={<ShieldCheck className="w-3.5 h-3.5" />} label="ضمانات محتجزة" value={money(r.heldCautionsTotal)} hint={`${fmtInt(r.heldCautionsCount)} ضمان أمانة (ليست ربحاً)`} />
          <Kpi tone={!hideFinances && caisseDiff < 0 ? 'rose' : 'slate'} icon={<Scale className="w-3.5 h-3.5" />} label="فارق الصندوق" value={signedMoney(caisseDiff)} hint={r.closuresCount > 0 ? `${fmtInt(r.closuresCount)} يوم جرد • ${fmtInt(r.shortageDays)} عجز • ${fmtInt(r.surplusDays)} فائض` : 'لا توجد عمليات جرد في الفترة'} />
        </div>

        {/* 2. Income statement + Debts & receivables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Section icon={<Receipt className="w-4 h-4" />} title="قائمة الدخل (الأرباح والخسائر)" subtitle="كيف تم احتساب صافي الربح خطوة بخطوة">
            <div className="space-y-0.5">
              <p className="text-[10px] font-black text-slate-400 px-2 pt-1">المداخيل</p>
              <PLRow label="مداخيل الكراء" note="المبالغ المدفوعة" value={money(r.rentalIncome)} />
              <PLRow label="مداخيل المبيعات" note="رقم الأعمال" value={money(r.salesRevenue)} />
              <PLRow label="مداخيل الخياطة والتعديل" note="المبالغ المدفوعة" value={money(r.tailoringIncome)} />
              <PLRow kind="total" label="إجمالي المداخيل" value={money(r.grossRevenue)} />

              <p className="text-[10px] font-black text-slate-400 px-2 pt-2">التكاليف المباشرة</p>
              <PLRow kind="cost" label="تكلفة البضاعة المباعة" note="سعر الشراء" value={money(r.salesCogs)} />
              <PLRow kind="cost" label="تكلفة أشغال الخياطة" note="أجرة الخياطات والمواد" value={money(r.tailoringCost)} />
              <PLRow kind="total" label="مجمل الربح" note={hideFinances ? undefined : `${Math.round(r.grossMargin)}%`} value={money(r.grossProfit)} />

              <p className="text-[10px] font-black text-slate-400 px-2 pt-2">المصاريف التشغيلية</p>
              <PLRow kind="cost" label="مصاريف عامة وتشغيلية" note="إيجار، فواتير، غسيل، تسويق..." value={money(r.generalExpenses)} />
              <PLRow kind="cost" label="مشتريات الموردين" note="المدفوع نقداً فقط" value={money(r.supplierPurchases)} />
              <PLRow kind="cost" label="رواتب ومسحوبات العمال" value={money(r.staffTotal)} />
              <PLRow kind="total" label="إجمالي المصاريف التشغيلية" value={money(r.operatingExpenses)} />

              <PLRow kind="grand" label="صافي الربح" note={hideFinances ? undefined : `هامش ${Math.round(r.netMargin)}%`} value={signedMoney(r.netProfit)} />
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-2 leading-relaxed">
              * الضمانات (الكوسيون) مبالغ أمانة تُرجع للزبون ولا تدخل في الأرباح. ديون الزبائن غير المدفوعة لا تُحتسب كمدخول حتى يتم تحصيلها.
            </p>
          </Section>
          <Section
            icon={<CreditCard className="w-4 h-4" />}
            title="الديون والمستحقات (الرصيد الحالي)"
            subtitle="ما لنا عند الزبائن وما علينا للموردين"
          >
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2">
                <span className="text-[10px] font-bold text-amber-800 block">لنا عند الزبائن</span>
                <span className="text-sm sm:text-base font-black text-amber-900 font-mono block">{money(r.customerDebtTotal)}</span>
                <span className="text-[9px] text-amber-700">{fmtInt(r.customerDebtCount)} دين • كراء {money(r.rentalOutstanding)} • خياطة {money(r.tailoringOutstanding)}</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-2">
                <span className="text-[10px] font-bold text-rose-800 block">علينا للموردين</span>
                <span className="text-sm sm:text-base font-black text-rose-900 font-mono block">{money(r.supplierDebtTotal)}</span>
                <span className="text-[9px] text-rose-700">{fmtInt(r.supplierDebtCount)} فاتورة غير مسددة بالكامل</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-black text-slate-500 mb-1">حسب نوع الدين</p>
                <div className="bg-slate-50/60 border border-slate-100 rounded-lg px-2">
                  {r.debtByType.length === 0 ? (
                    <p className="text-[10px] text-slate-400 py-2 text-center">لا توجد ديون على الزبائن</p>
                  ) : (
                    r.debtByType.map(d => <MiniRow key={d.key} label={`${d.name} (${fmtInt(d.count)})`} value={money(d.total)} />)
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 mb-1">أكبر المدينين</p>
                <div className="bg-slate-50/60 border border-slate-100 rounded-lg px-2">
                  {r.topDebtors.length === 0 ? (
                    <p className="text-[10px] text-slate-400 py-2 text-center">—</p>
                  ) : (
                    r.topDebtors.map(d => <MiniRow key={d.key} label={d.name} value={money(d.total)} />)
                  )}
                </div>
              </div>
            </div>

            {r.topSupplierCreditors.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-black text-slate-500 mb-1">الموردون الذين لهم مستحقات عندنا</p>
                <div className="bg-rose-50/40 border border-rose-100 rounded-lg px-2">
                  {r.topSupplierCreditors.map(d => <MiniRow key={d.key} label={`${d.name} (${fmtInt(d.count)})`} value={money(d.total)} />)}
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* 3. Activities */}
        <Section icon={<BarChart3 className="w-4 h-4" />} title="تحليل الأنشطة الثلاثة" subtitle="أداء كل قسم على حدة خلال الفترة">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
            {/* Rentals */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shirt className="w-3.5 h-3.5 text-slate-700" />
                <span className="text-[11px] sm:text-xs font-black text-slate-900">كراء الفساتين</span>
              </div>
              <span className="text-sm sm:text-lg font-black text-slate-900 block font-mono">{money(r.rentalIncome)}</span>
              <span className="text-[9px] text-slate-500 block mb-1.5">{activityShare(r.rentalIncome)}</span>
              <MiniRow label="عدد عقود الكراء" value={fmtInt(r.rentalCount)} />
              <MiniRow label="قيمة العقود الإجمالية" value={money(r.rentalDealsValue)} />
              <MiniRow label="متوسط الكراء الواحد" value={r.rentalCount > 0 ? money(r.rentalIncome / r.rentalCount) : '—'} />
              <MiniRow label="مداخيل الإكسسوارات" value={money(r.rentalAccessories)} />
              <MiniRow label="تخفيضات ممنوحة" value={money(r.rentalDiscounts)} />
              <MiniRow label="غرامات تأخير/تلف" value={money(r.rentalPenalties)} />
              <MiniRow label="ضمانات مخصومة" value={money(r.cautionsDeducted)} />
              <MiniRow label="قطع أُرجعت في الفترة" value={fmtInt(r.rentalReturnedInPeriod)} />
              {showScopes && <MiniRow label="مصاريف خاصة بالكراء" value={money(r.expenseScopes.rental)} />}
              <MiniRow label="الربح من الكراء" value={money(r.rentalIncome - (showScopes ? r.expenseScopes.rental : 0))} strong />
            </div>

            {/* Sales */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-slate-700" />
                <span className="text-[11px] sm:text-xs font-black text-slate-900">بيع الملابس</span>
              </div>
              <span className="text-sm sm:text-lg font-black text-slate-900 block font-mono">{money(r.salesRevenue)}</span>
              <span className="text-[9px] text-slate-500 block mb-1.5">{activityShare(r.salesRevenue)}</span>
              <MiniRow label="عدد الفواتير" value={fmtInt(r.salesCount)} />
              <MiniRow label="عدد القطع المباعة" value={fmtInt(r.salesQty)} />
              <MiniRow label="متوسط الفاتورة" value={r.salesCount > 0 ? money(r.salesRevenue / r.salesCount) : '—'} />
              <MiniRow label="تكلفة البضاعة" value={money(r.salesCogs)} />
              <MiniRow label="تخفيضات ممنوحة" value={money(r.salesDiscounts)} />
              <MiniRow label="المدفوع نقداً" value={money(r.salesPaid)} />
              <MiniRow label="بيع بالدين (كريدي)" value={money(r.salesDebt)} />
              {showScopes && <MiniRow label="مصاريف خاصة بالبيع" value={money(r.expenseScopes.sale)} />}
              <MiniRow label="ربح المبيعات" value={money(r.salesProfit - (showScopes ? r.expenseScopes.sale : 0))} strong />
            </div>

            {/* Tailoring */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Scissors className="w-3.5 h-3.5 text-slate-700" />
                <span className="text-[11px] sm:text-xs font-black text-slate-900">الخياطة والتعديل</span>
              </div>
              <span className="text-sm sm:text-lg font-black text-slate-900 block font-mono">{money(r.tailoringIncome)}</span>
              <span className="text-[9px] text-slate-500 block mb-1.5">{activityShare(r.tailoringIncome)}</span>
              <MiniRow label="عدد الطلبيات" value={fmtInt(r.tailoringCount)} />
              <MiniRow label="قيمة الطلبيات الإجمالية" value={money(r.tailoringPriceTotal)} />
              <MiniRow label="متوسط الطلبية" value={r.tailoringCount > 0 ? money(r.tailoringIncome / r.tailoringCount) : '—'} />
              <MiniRow label="تكلفة الأشغال" value={money(r.tailoringCost)} />
              {r.tailoringByService.slice(0, 4).map(s => (
                <MiniRow key={s.key} label={`${s.name} (${fmtInt(s.count)})`} value={money(s.total)} />
              ))}
              {showScopes && <MiniRow label="مصاريف خاصة بالخياطة" value={money(r.expenseScopes.tailoring)} />}
              <MiniRow label="ربح الخياطة" value={money(r.tailoringProfit - (showScopes ? r.expenseScopes.tailoring : 0))} strong />
            </div>
          </div>
        </Section>

        {/* 4. Trend */}
        <Section
          icon={<CalendarRange className="w-4 h-4" />}
          title={r.daily ? 'التطور اليومي للمداخيل والمصاريف' : 'التطور الشهري للمداخيل والمصاريف'}
          subtitle={r.trendTruncated > 0 ? `عرض آخر ${r.trendRows.length} ${r.daily ? 'يوماً' : 'شهراً'} (تم طي ${r.trendTruncated} فترة أقدم)` : 'الصافي = الكراء + ربح المبيعات + ربح الخياطة − المصاريف − العمال'}
        >
          <DataTable
            dense
            headers={[
              { label: r.daily ? 'اليوم' : 'الشهر' },
              { label: 'الكراء', className: 'text-left' },
              { label: 'المبيعات', className: 'text-left' },
              { label: 'الخياطة', className: 'text-left' },
              { label: 'المصاريف', className: 'text-left' },
              { label: 'العمال', className: 'text-left' },
              { label: 'الصافي', className: 'text-left' }
            ]}
            rows={r.trendRows.map(t => [
              <span className="font-bold text-slate-800 whitespace-nowrap">{t.label}</span>,
              <span className="font-mono">{money(t.rentals)}</span>,
              <span className="font-mono">{money(t.sales)}</span>,
              <span className="font-mono">{money(t.tailoring)}</span>,
              <span className="font-mono text-rose-700">{money(t.expenses)}</span>,
              <span className="font-mono text-rose-700">{money(t.staff)}</span>,
              <span className={`font-mono font-black ${!hideFinances && t.net < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{signedMoney(t.net)}</span>
            ])}
            footer={[
              'المجموع',
              <span className="font-mono">{money(r.trendTotals.rentals)}</span>,
              <span className="font-mono">{money(r.trendTotals.sales)}</span>,
              <span className="font-mono">{money(r.trendTotals.tailoring)}</span>,
              <span className="font-mono text-rose-700">{money(r.trendTotals.expenses)}</span>,
              <span className="font-mono text-rose-700">{money(r.trendTotals.staff)}</span>,
              <span className={`font-mono ${!hideFinances && r.trendTotals.net < 0 ? 'text-rose-700' : ''}`}>{signedMoney(r.trendTotals.net)}</span>
            ]}
          />
        </Section>

        {/* 5. Expenses + Caisse */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Section
            icon={<Wallet className="w-4 h-4" />}
            title="المصاريف حسب التصنيف"
            subtitle={`${fmtInt(r.expenseCount)} مصروف خلال الفترة`}
            aside={<span>الإجمالي: {money(r.totalExpenses)}</span>}
          >
            <DataTable
              dense
              headers={[
                { label: 'التصنيف' },
                { label: 'العدد', className: 'text-center w-[14%]' },
                { label: 'المبلغ', className: 'text-left w-[30%]' },
                { label: '%', className: 'text-left w-[10%]' }
              ]}
              rows={r.expenseCategories.map(c => [
                <span className="font-bold text-slate-800 break-words">{c.name}</span>,
                <span className="text-center block font-mono">{fmtInt(c.count)}</span>,
                <span className="font-mono">{money(c.total)}</span>,
                <span className="font-mono text-slate-500">{pct(c.total, r.totalExpenses)}%</span>
              ])}
            />
            {r.supplierPurchasesCount > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] sm:text-[11px]">
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5">
                  <span className="text-slate-500 block">فواتير الموردين</span>
                  <span className="font-black text-slate-900 font-mono">{fmtInt(r.supplierPurchasesCount)}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5">
                  <span className="text-slate-500 block">قيمة الفواتير</span>
                  <span className="font-black text-slate-900 font-mono">{money(r.supplierInvoicesTotal)}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5">
                  <span className="text-slate-500 block">المدفوع منها</span>
                  <span className="font-black text-slate-900 font-mono">{money(r.supplierPurchases)}</span>
                </div>
              </div>
            )}
          </Section>
          <Section
            icon={<Scale className="w-4 h-4" />}
            title="الصندوق اليومي (La Caisse)"
            subtitle={`${fmtInt(r.closuresCount)} عملية جرد وإغلاق مسجلة في الفترة`}
          >
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 text-center">
                <span className="text-[9px] font-bold text-emerald-800 block">أيام مطابقة</span>
                <span className="text-sm font-black text-emerald-900 font-mono">{fmtInt(r.balancedDays)}</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-1.5 text-center">
                <span className="text-[9px] font-bold text-rose-800 block">أيام عجز</span>
                <span className="text-sm font-black text-rose-900 font-mono">{fmtInt(r.shortageDays)}</span>
                <span className="text-[9px] text-rose-700 block">{money(r.shortageTotal)}</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-1.5 text-center">
                <span className="text-[9px] font-bold text-blue-800 block">أيام فائض</span>
                <span className="text-sm font-black text-blue-900 font-mono">{fmtInt(r.surplusDays)}</span>
                <span className="text-[9px] text-blue-700 block">{money(r.surplusTotal)}</span>
              </div>
            </div>
            <MiniRow label="مجموع المدخول النقدي المسجل في الجرد" value={money(r.closuresInflow)} />
            <MiniRow label="مجموع المصروف النقدي المسجل في الجرد" value={money(r.closuresOutflow)} />
            <MiniRow label="الفارق الصافي (فائض − عجز)" value={<span className={!hideFinances && caisseDiff < 0 ? 'text-rose-700' : ''}>{signedMoney(caisseDiff)}</span>} strong />
            {r.shortageList.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-black text-rose-700 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> أكبر أيام العجز</p>
                <DataTable
                  dense
                  headers={[{ label: 'التاريخ' }, { label: 'النظري', className: 'text-left' }, { label: 'الفعلي', className: 'text-left' }, { label: 'العجز', className: 'text-left' }]}
                  rows={r.shortageList.map(c => [
                    <span className="font-mono font-bold">{c.date}</span>,
                    <span className="font-mono">{money(c.theoreticalAmount)}</span>,
                    <span className="font-mono">{money(c.actualAmount)}</span>,
                    <span className="font-mono font-black text-rose-700">{money(Math.abs(num(c.difference)))}</span>
                  ])}
                />
              </div>
            )}
          </Section>
        </div>

        {/* 6. Staff */}
        <Section
          icon={<Users className="w-4 h-4" />}
          title="رواتب ومستحقات العمال"
          subtitle={`${fmtInt(r.staffPayoutCount)} دفعة خلال الفترة`}
          aside={<span>الإجمالي: {money(r.staffTotal)}</span>}
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 sm:gap-3">
            <div className="md:col-span-3">
              <DataTable
                dense
                headers={[
                  { label: 'العامل' },
                  { label: 'الدفعات', className: 'text-center w-[16%]' },
                  { label: 'المكافآت', className: 'text-left w-[24%]' },
                  { label: 'المبلغ المدفوع', className: 'text-left w-[30%]' }
                ]}
                rows={r.staffByMember.map(s => [
                  <span className="font-bold text-slate-800 break-words">{s.name}</span>,
                  <span className="text-center block font-mono">{fmtInt(s.count)}</span>,
                  <span className="font-mono text-slate-500">{money(s.extra || 0)}</span>,
                  <span className="font-mono font-black">{money(s.total)}</span>
                ])}
                emptyText="لا توجد دفعات للعمال في هذه الفترة"
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl px-2.5 py-1">
                <p className="text-[10px] font-black text-slate-500 pt-1">حسب نوع الدفعة</p>
                {r.staffByType.length === 0 ? (
                  <p className="text-[10px] text-slate-400 py-2 text-center">—</p>
                ) : (
                  r.staffByType.slice(0, 5).map(t => <MiniRow key={t.key} label={`${t.name} (${fmtInt(t.count)})`} value={money(t.total)} />)
                )}
              </div>
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl px-2.5 py-1">
                <MiniRow label="عدد العمال المسجلين" value={fmtInt(staffMembers.length)} />
                <MiniRow label="كتلة الأجور الشهرية المقررة" value={money(r.expectedMonthlyPayroll)} />
                <MiniRow label="خصومات الغياب والتسبيقات" value={money(r.staffDeductions)} />
                <MiniRow label="مكافآت مدفوعة" value={money(r.staffBonuses)} />
              </div>
            </div>
          </div>
        </Section>

        {/* 7. Inventory & assets */}
        <Section
          icon={<Package className="w-4 h-4" />}
          title="المخزون والأصول (الوضع الحالي)"
          subtitle={`${fmtInt(r.models)} موديل • ${fmtInt(r.totalPieces)} قطعة • ${fmtInt(r.rentModels)} للكراء • ${fmtInt(r.sellModels)} للبيع`}
          aside={r.outOfStockModels > 0 ? <span className="text-rose-700">{fmtInt(r.outOfStockModels)} موديل نفد مخزونه</span> : undefined}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Kpi tone="slate" label="قيمة الملابس بسعر التكلفة" value={money(r.stockCostValue)} hint="رأس المال المجمد في المخزون" />
            <Kpi tone="blue" label="قيمة البيع المتوقعة" value={money(r.stockSellValue)} hint={hideFinances ? 'للقطع المخصصة للبيع' : `ربح محتمل ${money(Math.max(0, r.stockSellValue - r.stockCostValue))}`} />
            <Kpi tone="slate" label="توزيع القطع" value={`${fmtInt(r.stock1)} / ${fmtInt(r.stock2)}`} hint="المحل / المستودع" />
            <Kpi tone="violet" label="قطع خارج المحل" value={`${fmtInt(r.rentedPieces)} مؤجرة`} hint={`${fmtInt(r.cleaningPieces)} قطعة في الغسيل`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 sm:gap-3">
            <div className="md:col-span-3">
              <DataTable
                dense
                headers={[
                  { label: 'الفئة' },
                  { label: 'موديلات', className: 'text-center w-[16%]' },
                  { label: 'قطع', className: 'text-center w-[14%]' },
                  { label: 'القيمة بالتكلفة', className: 'text-left w-[30%]' }
                ]}
                rows={r.inventoryByCategory.map(c => [
                  <span className="font-bold text-slate-800 break-words">{c.name}</span>,
                  <span className="text-center block font-mono">{fmtInt(c.count)}</span>,
                  <span className="text-center block font-mono">{fmtInt(c.extra || 0)}</span>,
                  <span className="font-mono font-black">{money(c.total)}</span>
                ])}
                emptyText="لا توجد قطع في المخزون"
              />
            </div>
            <div className="md:col-span-2 bg-slate-50/70 border border-slate-200 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-slate-700" />
                <span className="text-[11px] font-black text-slate-900">الأقمشة والمواد الأولية</span>
              </div>
              <MiniRow label="عدد الأصناف" value={fmtInt(r.rawCount)} />
              <MiniRow label="عدد الرولويات" value={fmtInt(r.rawRolls)} />
              <MiniRow label="إجمالي الأمتار" value={`${fmtInt(r.rawMeters)} م`} />
              <MiniRow label="القيمة بسعر التكلفة" value={money(r.rawValue)} strong />
              <div className="mt-2 pt-2 border-t border-slate-200">
                <MiniRow label="إجمالي قيمة المخزون (ملابس + أقمشة)" value={money(r.stockCostValue + r.rawValue)} strong />
              </div>
            </div>
          </div>
        </Section>

        {/* 8. Top performers */}
        <Section icon={<Star className="w-4 h-4" />} title="الأفضل أداءً خلال الفترة" subtitle="أكثر القطع طلباً وأهم الزبائن">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
            <div>
              <p className="text-[10px] font-black text-slate-500 mb-1 flex items-center gap-1"><Shirt className="w-3 h-3" /> الأكثر كراءً</p>
              <DataTable
                dense
                headers={[{ label: 'القطعة' }, { label: 'مرات', className: 'text-center w-[18%]' }, { label: 'المداخيل', className: 'text-left w-[36%]' }]}
                rows={r.topRented.map(t => [
                  <span className="font-bold text-slate-800 break-words">{t.name}</span>,
                  <span className="text-center block font-mono">{fmtInt(t.count)}</span>,
                  <span className="font-mono">{money(t.total)}</span>
                ])}
                emptyText="لا توجد عمليات كراء"
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 mb-1 flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> الأكثر مبيعاً</p>
              <DataTable
                dense
                headers={[{ label: 'القطعة' }, { label: 'كمية', className: 'text-center w-[18%]' }, { label: 'المداخيل', className: 'text-left w-[36%]' }]}
                rows={r.topSold.map(t => [
                  <span className="font-bold text-slate-800 break-words">{t.name}</span>,
                  <span className="text-center block font-mono">{fmtInt(t.count)}</span>,
                  <span className="font-mono">{money(t.total)}</span>
                ])}
                emptyText="لا توجد مبيعات"
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> أهم الزبائن</p>
              <DataTable
                dense
                headers={[{ label: 'الزبون' }, { label: 'عمليات', className: 'text-center w-[18%]' }, { label: 'المدفوع', className: 'text-left w-[36%]' }]}
                rows={r.topCustomers.map(t => [
                  <span className="font-bold text-slate-800 break-words">{t.name}</span>,
                  <span className="text-center block font-mono">{fmtInt(t.count)}</span>,
                  <span className="font-mono">{money(t.total)}</span>
                ])}
                emptyText="لا يوجد زبائن"
              />
            </div>
          </div>
        </Section>

        {/* 9. Operational snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Section
            icon={<Clock className="w-4 h-4" />}
            title={`القطع المؤجرة حالياً (${fmtInt(r.activeRentals.length)})`}
            subtitle={`${fmtInt(r.reservedCount)} حجز قادم • ${fmtInt(r.cleaningCount)} في الغسيل`}
            aside={r.overdueCount > 0 ? <span className="text-rose-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {fmtInt(r.overdueCount)} متأخرة عن موعد الإرجاع</span> : <span className="text-emerald-700">لا توجد قطع متأخرة</span>}
          >
            <DataTable
              dense
              headers={[
                { label: 'القطعة' },
                { label: 'الزبون', className: 'w-[28%]' },
                { label: 'الإرجاع', className: 'w-[22%]' },
                { label: 'المتبقي', className: 'text-left w-[20%]' }
              ]}
              rows={r.activeRentals.slice(0, 12).map(x => {
                const late = !!x.expectedReturnDate && toDay(x.expectedReturnDate) < todayStr;
                return [
                  <span className="font-bold text-slate-800 break-words">{x.itemName}{x.itemSize ? <span className="text-slate-400 font-medium"> • {x.itemSize}</span> : null}</span>,
                  <span className="text-slate-600 break-words">{x.customerName}</span>,
                  <span className={`font-mono font-bold ${late ? 'text-rose-700' : 'text-slate-700'}`}>{x.expectedReturnDate}{late ? ' ⚠' : ''}</span>,
                  <span className="font-mono">{money(num(x.remainingAmount))}</span>
                ];
              })}
              emptyText="لا توجد قطع مؤجرة حالياً"
            />
            {r.activeRentals.length > 12 && (
              <p className="text-[10px] text-slate-400 font-bold mt-1.5">+ {fmtInt(r.activeRentals.length - 12)} كراء آخر جارٍ (راجع قسم الكراء للتفاصيل)</p>
            )}
          </Section>

          <Section
            icon={<Scissors className="w-4 h-4" />}
            title={`طلبيات الخياطة غير المسلَّمة (${fmtInt(r.pendingOrders.length)})`}
            subtitle={`${fmtInt(r.tailoringStatus.pending || 0)} في الانتظار • ${fmtInt(r.tailoringStatus.in_progress || 0)} قيد الإنجاز • ${fmtInt(r.tailoringStatus.ready || 0)} جاهزة`}
            aside={<span>متبقي للتحصيل: {money(r.tailoringOutstanding)}</span>}
          >
            <DataTable
              dense
              headers={[
                { label: 'الطلبية' },
                { label: 'الزبون', className: 'w-[26%]' },
                { label: 'الحالة', className: 'w-[20%]' },
                { label: 'التسليم', className: 'w-[20%]' }
              ]}
              rows={r.pendingOrders.slice(0, 12).map(o => {
                const late = !!o.expectedDeliveryDate && toDay(o.expectedDeliveryDate) < todayStr;
                return [
                  <span className="font-bold text-slate-800 break-words">{o.itemName}<span className="text-slate-400 font-medium"> • {SERVICE_LABELS[o.serviceType] || SERVICE_LABELS.other}</span></span>,
                  <span className="text-slate-600 break-words">{o.customerName || 'مخزون داخلي'}</span>,
                  <span className="font-bold text-slate-700">{TAILORING_STATUS_LABELS[o.status] || o.status}</span>,
                  <span className={`font-mono font-bold ${late ? 'text-rose-700' : 'text-slate-700'}`}>{o.expectedDeliveryDate}{late ? ' ⚠' : ''}</span>
                ];
              })}
              emptyText="لا توجد طلبيات خياطة معلقة"
            />
            {r.pendingOrders.length > 12 && (
              <p className="text-[10px] text-slate-400 font-bold mt-1.5">+ {fmtInt(r.pendingOrders.length - 12)} طلبية أخرى (راجع قسم الخياطة)</p>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-3 sm:pt-4 flex flex-col sm:flex-row justify-between sm:items-center gap-0.5 text-[10px] sm:text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> بوتيك مانجر برو - نظام إدارة وتأجير الملابس</span>
          <span>تاريخ التقرير: {formattedDate} • {formattedTime}</span>
        </div>
      </div>
    </div>
  );
});

FullReport.displayName = 'FullReport';
