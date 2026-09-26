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
  ArrowDownLeft,
  ArrowLeftRight,
  PieChart,
  LineChart,
  ListChecks,
  ToggleLeft,
  ToggleRight
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
  shortLabel: string;
  rentals: number;
  sales: number;
  salesProfit: number;
  tailoring: number;
  tailoringCost: number;
  expenses: number;
  staff: number;
  net: number;
}

interface ReportInput {
  clothes: ClothItem[];
  rentals: Rental[];
  sales: Sale[];
  expenses: Expense[];
  credits: Credit[];
  staffPayouts: StaffPayout[];
  maintenanceOrders: MaintenanceOrder[];
  caisseClosures: DailyCaisseClosure[];
  rawMaterials: RawMaterial[];
  staffMembers: StaffMember[];
}

// =====================================================================
// Pure helpers
// =====================================================================

const EMPTY_ORDERS: MaintenanceOrder[] = [];
const EMPTY_CLOSURES: DailyCaisseClosure[] = [];
const EMPTY_RAW: RawMaterial[] = [];
const EMPTY_STAFF: StaffMember[] = [];

const DETAIL_ROW_LIMIT = 150;
const PNG_MAX_HEIGHT = 14000;

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

const compactNumber = (v: number) => {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)} مليون`;
  if (a >= 1_000) return `${sign}${Math.round(a / 1_000)} ألف`;
  return `${sign}${Math.round(a)}`;
};

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('ar-DZ', { month: 'long', year: 'numeric' });
};

const monthShortLabel = (ym: string, withYear: boolean) => {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const name = new Date(y, m - 1, 1).toLocaleDateString('ar-DZ', { month: 'short' });
  return withYear ? `${name} ${String(y).slice(2)}` : name;
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

/**
 * Comparable previous window. For an in-progress month/year we compare the same
 * number of elapsed days (1 → today) so the comparison is fair.
 */
const previousRange = (period: PeriodKey, range: DateRange | null, todayStr: string): DateRange | null => {
  if (!range || period === 'all') return null;
  if (range.from === '0000-01-01' || range.to === '9999-12-31') return null;
  const effectiveTo = range.to < todayStr ? range.to : todayStr;

  if (period === 'month' || period === 'lastMonth') {
    const y = Number(range.from.slice(0, 4));
    const m = Number(range.from.slice(5, 7));
    const d = new Date(y, m - 2, 1);
    const py = d.getFullYear();
    const pm = d.getMonth() + 1;
    const pLast = lastDayOfMonth(py, pm);
    const dayCap = period === 'month' ? Math.min(Number(effectiveTo.slice(8, 10)), pLast) : pLast;
    return { from: `${py}-${pad2(pm)}-01`, to: `${py}-${pad2(pm)}-${pad2(dayCap)}` };
  }
  if (period === 'year') {
    const y = Number(range.from.slice(0, 4)) - 1;
    let md = effectiveTo.slice(5);
    if (md === '02-29') md = '02-28';
    return { from: `${y}-01-01`, to: `${y}-${md}` };
  }
  const fromMs = Date.parse(`${range.from}T00:00:00Z`);
  const toMs = Date.parse(`${range.to}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  const len = Math.round((toMs - fromMs) / 86400000) + 1;
  const prevToMs = fromMs - 86400000;
  const prevFromMs = prevToMs - (len - 1) * 86400000;
  return { from: new Date(prevFromMs).toISOString().slice(0, 10), to: new Date(prevToMs).toISOString().slice(0, 10) };
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

const niceStep = (span: number, ticks = 4) => {
  const raw = Math.max(span, 1) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
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

const RENTAL_STATUS_LABELS: Record<string, string> = {
  reserved: 'حجز قادم',
  active: 'كراء جارٍ',
  overdue: 'متأخر',
  returned: 'تم الإرجاع',
  cleaning: 'في الغسيل',
  cancelled: 'ملغى'
};

const CAUTION_LABELS: Record<string, string> = {
  held: 'محتجز',
  refunded: 'مُرجَع',
  deducted: 'مخصوم'
};

const CAISSE_STATUS_LABELS: Record<string, string> = {
  balanced: 'مطابق',
  shortage: 'عجز',
  surplus: 'فائض'
};

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'month', label: 'هذا الشهر' },
  { key: 'lastMonth', label: 'الشهر الماضي' },
  { key: 'year', label: 'هذه السنة' },
  { key: 'all', label: 'كل الفترات' },
  { key: 'custom', label: 'فترة مخصصة' }
];

const CHART_COLORS = {
  rentals: '#2563eb',
  sales: '#0f172a',
  tailoring: '#7c3aed',
  expenses: '#e11d48',
  staff: '#f59e0b',
  net: '#059669',
  previous: '#cbd5e1',
  current: '#2563eb',
  palette: ['#2563eb', '#0f172a', '#7c3aed', '#e11d48', '#f59e0b', '#059669', '#0891b2', '#64748b']
};

// =====================================================================
// Core computation (pure) – runs once for the current period and once
// for the comparison period.
// =====================================================================

function computeReport(input: ReportInput, range: DateRange | null, todayStr: string, withDetails: boolean) {
  const { clothes, rentals, sales, expenses, credits, staffPayouts, maintenanceOrders, caisseClosures, rawMaterials, staffMembers } = input;
  const inRange = (d: string) => !range || (!!d && d >= range.from && d <= range.to);

  // Trend granularity: daily for short windows, monthly otherwise
  const daily = !!range && daysBetween(range.from, range.to) <= 45;
  const bucketOf = (d: string) => (daily ? d : d.slice(0, 7));
  const trend = new Map<string, TrendRow>();
  const trendRow = (d: string) => {
    const key = bucketOf(d);
    let row = trend.get(key);
    if (!row) {
      row = {
        key,
        label: daily ? dayLabel(key) : monthLabel(key),
        shortLabel: daily ? `${key.slice(8, 10)}/${key.slice(5, 7)}` : key,
        rentals: 0, sales: 0, salesProfit: 0, tailoring: 0, tailoringCost: 0, expenses: 0, staff: 0, net: 0
      };
      trend.set(key, row);
    }
    return row;
  };

  const activeDays = new Set<string>();
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
  let cautionsRefunded = 0;
  let cautionsRefundedCount = 0;
  const rentedItems = new Map<string, NamedTotal>();
  const detailRentals: Rental[] = [];

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
    const d = rentalDateOf(r);
    if (inRange(d)) {
      rentalIncome += paid;
      rentalCount += 1;
      rentalDealsValue += num(r.rentPrice);
      rentalDiscounts += num(r.discountAmount);
      if (r.hasAccessories) rentalAccessories += num(r.accessoryPrice);
      rentalPenalties += num(r.penaltyAmount);
      bump(rentedItems, r.itemId || r.itemName, r.itemName, paid, num(r.qty) || 1);
      addCustomer(r.customerName, r.customerPhone, paid, 'كراء');
      trendRow(d).rentals += paid;
      if (d) activeDays.add(d);
      if (withDetails) detailRentals.push(r);
    }
    if (r.status === 'returned' && inRange(toDay(r.actualReturnDate))) {
      rentalReturnedInPeriod += 1;
      if (r.cautionStatus === 'deducted') cautionsDeducted += num(r.cautionAmount);
      if (r.cautionStatus === 'refunded') {
        cautionsRefunded += num(r.cautionAmount);
        cautionsRefundedCount += 1;
      }
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
  detailRentals.sort((a, b) => rentalDateOf(b).localeCompare(rentalDateOf(a)));

  // ---------------- Sales ----------------
  let salesRevenue = 0;
  let salesPaid = 0;
  let salesDebt = 0;
  let salesProfit = 0;
  let salesDiscounts = 0;
  let salesCount = 0;
  let salesQty = 0;
  const soldItems = new Map<string, NamedTotal>();
  const detailSales: Sale[] = [];

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
    if (d) activeDays.add(d);
    if (withDetails) detailSales.push(s);
  }
  const salesCogs = salesRevenue - salesProfit;
  detailSales.sort((a, b) => toDay(b.date).localeCompare(toDay(a.date)));

  // ---------------- Tailoring ----------------
  let tailoringIncome = 0;
  let tailoringPriceTotal = 0;
  let tailoringCost = 0;
  let tailoringCount = 0;
  const tailoringByService = new Map<string, NamedTotal>();
  const tailoringStatus: Record<string, number> = { pending: 0, in_progress: 0, ready: 0, delivered: 0 };
  const pendingOrders: MaintenanceOrder[] = [];
  const detailOrders: MaintenanceOrder[] = [];
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
      if (d) activeDays.add(d);
      if (withDetails) detailOrders.push(o);
    }
    tailoringStatus[o.status] = (tailoringStatus[o.status] || 0) + 1;
    if (o.status !== 'delivered') {
      pendingOrders.push(o);
      tailoringOutstanding += num(o.remainingAmount);
    }
  }
  pendingOrders.sort((a, b) => (a.expectedDeliveryDate || '').localeCompare(b.expectedDeliveryDate || ''));
  detailOrders.sort((a, b) => tailoringDateOf(b).localeCompare(tailoringDateOf(a)));
  const tailoringProfit = tailoringIncome - tailoringCost;

  // ---------------- Expenses ----------------
  let totalExpenses = 0;
  let supplierPurchases = 0;
  let supplierPurchasesCount = 0;
  let supplierInvoicesTotal = 0;
  let expenseCount = 0;
  const expenseCategories = new Map<string, NamedTotal>();
  const expenseScopes: Record<string, number> = { rental: 0, sale: 0, tailoring: 0, general: 0 };
  const detailExpenses: Expense[] = [];

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
    if (withDetails) detailExpenses.push(e);
  }
  const generalExpenses = totalExpenses - supplierPurchases;
  detailExpenses.sort((a, b) => toDay(b.date).localeCompare(toDay(a.date)));

  // ---------------- Staff ----------------
  let staffTotal = 0;
  let staffBonuses = 0;
  let staffDeductions = 0;
  let staffPayoutCount = 0;
  const staffByMember = new Map<string, NamedTotal>();
  const staffByType = new Map<string, NamedTotal>();
  const detailPayouts: StaffPayout[] = [];

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
    if (withDetails) detailPayouts.push(p);
  }
  detailPayouts.sort((a, b) => toDay(b.date).localeCompare(toDay(a.date)));
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
  const detailCredits: Credit[] = [];

  for (let i = 0; i < credits.length; i++) {
    const c = credits[i];
    const amt = num(c.amount);
    if (amt <= 0) continue;
    if (withDetails) detailCredits.push(c);
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
  detailCredits.sort((a, b) => toDay(b.date).localeCompare(toDay(a.date)));

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
  const detailClosures: DailyCaisseClosure[] = [];

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
    if (withDetails) detailClosures.push(c);
  }
  shortageList.sort((a, b) => num(a.difference) - num(b.difference));
  detailClosures.sort((a, b) => toDay(b.date).localeCompare(toDay(a.date)));

  // ---------------- Inventory (snapshot) ----------------
  const models = clothes.length;
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
  const activeDaysCount = activeDays.size;
  const avgDailyRevenue = activeDaysCount > 0 ? grossRevenue / activeDaysCount : 0;
  const avgOperation = operationsCount > 0 ? grossRevenue / operationsCount : 0;

  // ---------------- Trend rows ----------------
  const trendAll = Array.from(trend.values())
    .map(r => ({ ...r, net: r.rentals + r.salesProfit + (r.tailoring - r.tailoringCost) - r.expenses - r.staff }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const multiYear = new Set(trendAll.map(r => r.key.slice(0, 4))).size > 1;
  if (!daily) trendAll.forEach(r => { r.shortLabel = monthShortLabel(r.key, multiYear); });
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
    rentalReturnedInPeriod, cautionsDeducted, cautionsRefunded, cautionsRefundedCount, activeRentals, reservedCount,
    cleaningCount, overdueCount, heldCautionsTotal, heldCautionsCount, rentalOutstanding,
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
    topCustomers: sortedTotals(customerAgg, 6), uniqueCustomers: customerAgg.size,
    // totals
    grossRevenue, directCosts, grossProfit, operatingExpenses, netProfit, netMargin, grossMargin, operationsCount,
    activeDaysCount, avgDailyRevenue, avgOperation,
    // trend
    trendRows, trendTruncated, trendTotals,
    // details
    detailRentals, detailSales, detailOrders, detailExpenses, detailPayouts, detailCredits, detailClosures
  };
}

type ReportData = ReturnType<typeof computeReport>;

// =====================================================================
// Charts (dependency-free, print & PNG friendly)
// =====================================================================

const ChartLegend: React.FC<{ items: { label: string; color: string; value?: string }[] }> = ({ items }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] sm:text-[11px] font-bold text-slate-600">
    {items.map(it => (
      <span key={it.label} className="inline-flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: it.color }} />
        {it.label}
        {it.value && <span className="font-mono text-slate-500">({it.value})</span>}
      </span>
    ))}
  </div>
);

const EmptyChart: React.FC<{ text?: string }> = ({ text = 'لا توجد بيانات كافية لرسم المخطط' }) => (
  <div className="h-28 flex items-center justify-center text-[11px] font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">{text}</div>
);

const TrendChart: React.FC<{ rows: TrendRow[]; hideValues: boolean }> = ({ rows, hideValues }) => {
  if (rows.length === 0) return <EmptyChart />;
  const W = 720;
  const H = 250;
  const padL = hideValues ? 12 : 64;
  const padR = 12;
  const padT = 14;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  let maxV = 1;
  let minV = 0;
  rows.forEach(r => {
    const inc = r.rentals + r.sales + r.tailoring;
    const out = r.expenses + r.staff;
    maxV = Math.max(maxV, inc, out, r.net);
    minV = Math.min(minV, r.net);
  });
  const step = niceStep(maxV - minV, 4);
  const yMax = Math.ceil(maxV / step) * step;
  const yMin = Math.floor(minV / step) * step;
  const y = (v: number) => padT + innerH * (1 - (v - yMin) / (yMax - yMin || 1));

  const slot = innerW / rows.length;
  const barW = Math.max(3, Math.min(22, slot * 0.3));
  const gap = Math.max(1, barW * 0.2);
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + step / 1000; t += step) ticks.push(Number(t.toFixed(6)));
  const labelEvery = rows.length <= 12 ? 1 : Math.ceil(rows.length / 10);
  const zeroY = y(0);

  const stack = (x: number, segs: { v: number; color: string }[], key: string) => {
    let acc = 0;
    return segs.map((s, i) => {
      if (s.v <= 0) return null;
      const top = y(acc + s.v);
      const h = Math.max(0.5, y(acc) - top);
      acc += s.v;
      return <rect key={`${key}-${i}`} x={x} y={top} width={barW} height={h} fill={s.color} rx={i === segs.length - 1 ? 1.5 : 0} />;
    });
  };

  const netPoints = rows.map((r, i) => `${(padL + slot * i + slot / 2).toFixed(1)},${y(r.net).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="مخطط تطور المداخيل والمصاريف">
      {ticks.map(t => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={t === 0 ? 1.2 : 1} />
          {!hideValues && (
            <text x={padL - 6} y={y(t) + 3.5} fontSize={10} textAnchor="end" fill="#64748b" fontFamily="Tajawal, sans-serif">{compactNumber(t)}</text>
          )}
        </g>
      ))}
      {rows.map((r, i) => {
        const cx = padL + slot * i + slot / 2;
        const xIn = cx - barW - gap / 2;
        const xOut = cx + gap / 2;
        return (
          <g key={r.key}>
            {stack(xIn, [
              { v: r.rentals, color: CHART_COLORS.rentals },
              { v: r.sales, color: CHART_COLORS.sales },
              { v: r.tailoring, color: CHART_COLORS.tailoring }
            ], 'in')}
            {stack(xOut, [
              { v: r.expenses, color: CHART_COLORS.expenses },
              { v: r.staff, color: CHART_COLORS.staff }
            ], 'out')}
            {(i % labelEvery === 0) && (
              <text x={cx} y={H - padB + 14} fontSize={10} textAnchor="middle" fill="#475569" fontFamily="Tajawal, sans-serif">{r.shortLabel}</text>
            )}
          </g>
        );
      })}
      <polyline points={netPoints} fill="none" stroke={CHART_COLORS.net} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {rows.map((r, i) => (
        <circle key={`dot-${r.key}`} cx={padL + slot * i + slot / 2} cy={y(r.net)} r={rows.length > 20 ? 2 : 3} fill="#ffffff" stroke={CHART_COLORS.net} strokeWidth={2} />
      ))}
      {zeroY < H - padB && zeroY > padT && yMin < 0 && (
        <text x={W - padR} y={zeroY - 3} fontSize={9} textAnchor="end" fill="#94a3b8" fontFamily="Tajawal, sans-serif">صفر</text>
      )}
    </svg>
  );
};

const DonutChart: React.FC<{
  slices: { label: string; value: number; color: string }[];
  centerTop: string;
  centerBottom?: string;
  hideValues: boolean;
  money: (v: number) => string;
}> = ({ slices, centerTop, centerBottom, hideValues, money }) => {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return <EmptyChart />;
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 120 120" className="w-24 h-24 sm:w-28 sm:h-28 shrink-0" role="img" aria-label="توزيع نسبي">
        <circle cx={60} cy={60} r={R} fill="none" stroke="#f1f5f9" strokeWidth={16} />
        {slices.map(s => {
          const v = Math.max(0, s.value);
          if (v <= 0) return null;
          const len = (v / total) * C;
          const el = (
            <circle
              key={s.label}
              cx={60}
              cy={60}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={16}
              strokeDasharray={`${len.toFixed(3)} ${(C - len).toFixed(3)}`}
              strokeDashoffset={(-offset).toFixed(3)}
              transform="rotate(-90 60 60)"
            />
          );
          offset += len;
          return el;
        })}
        <text x={60} y={hideValues || !centerBottom ? 64 : 57} fontSize={hideValues ? 12 : 11} textAnchor="middle" fill="#0f172a" fontWeight={800} fontFamily="Tajawal, sans-serif">
          {hideValues ? '••••' : centerTop}
        </text>
        {!hideValues && centerBottom && (
          <text x={60} y={72} fontSize={8.5} textAnchor="middle" fill="#64748b" fontWeight={700} fontFamily="Tajawal, sans-serif">{centerBottom}</text>
        )}
      </svg>
      <div className="flex-1 min-w-0 space-y-1">
        {slices.map(s => (
          <div key={s.label} className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-mono text-slate-600 whitespace-nowrap">
              {money(s.value)} <span className="text-slate-400">({pct(s.value, total)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const HBarList: React.FC<{
  items: { label: string; value: number; sub?: string }[];
  total: number;
  color?: string;
  money: (v: number) => string;
}> = ({ items, total, color = CHART_COLORS.expenses, money }) => {
  if (items.length === 0 || total <= 0) return <EmptyChart />;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-1.5">
      {items.map(it => (
        <div key={it.label}>
          <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] mb-0.5">
            <span className="font-bold text-slate-700 truncate">{it.label}{it.sub && <span className="text-slate-400 font-medium"> • {it.sub}</span>}</span>
            <span className="font-mono text-slate-600 whitespace-nowrap">{money(it.value)} <span className="text-slate-400">({pct(it.value, total)}%)</span></span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.max(1, (it.value / max) * 100)}%`, backgroundColor: color }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const CompareBars: React.FC<{
  metrics: { label: string; current: number; previous: number }[];
  hideValues: boolean;
}> = ({ metrics, hideValues }) => {
  const max = Math.max(1, ...metrics.flatMap(m => [Math.abs(m.current), Math.abs(m.previous)]));
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
      {metrics.map(m => (
        <div key={m.label} className="flex flex-col items-center">
          <div className="w-full h-28 flex items-end justify-center gap-1">
            {[{ v: m.previous, c: CHART_COLORS.previous, t: 'السابقة' }, { v: m.current, c: m.current < 0 ? CHART_COLORS.expenses : CHART_COLORS.current, t: 'الحالية' }].map(b => (
              <div key={b.t} className="flex flex-col items-center justify-end h-full w-5 sm:w-7">
                {!hideValues && <span className="text-[8px] sm:text-[9px] font-mono font-bold text-slate-500 mb-0.5 whitespace-nowrap">{compactNumber(b.v)}</span>}
                <div className="w-full rounded-t-sm" style={{ height: `${Math.max(2, (Math.abs(b.v) / max) * 100)}%`, backgroundColor: b.c }} title={b.t} />
              </div>
            ))}
          </div>
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 mt-1 text-center leading-tight">{m.label}</span>
        </div>
      ))}
    </div>
  );
};

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

const deltaInfo = (current: number, previous: number) => {
  const diff = current - previous;
  if (previous === 0) return { diff, pctValue: current === 0 ? 0 : null };
  return { diff, pctValue: (diff / Math.abs(previous)) * 100 };
};

const Delta: React.FC<{ current: number; previous: number; invert?: boolean; hide?: boolean; compact?: boolean }> = ({
  current,
  previous,
  invert,
  hide,
  compact
}) => {
  if (hide) return null;
  const { diff, pctValue } = deltaInfo(current, previous);
  if (diff === 0) {
    return <span className={`inline-flex items-center gap-0.5 font-bold text-slate-400 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>= بدون تغيير</span>;
  }
  const up = diff > 0;
  const good = invert ? !up : up;
  const cls = good ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200';
  const label = pctValue === null ? 'جديد' : `${Math.abs(Math.round(pctValue))}%`;
  return (
    <span className={`inline-flex items-center gap-0.5 font-black border rounded-md px-1 ${compact ? 'text-[9px] py-0' : 'text-[10px] py-0.5'} ${cls}`}>
      {up ? '▲' : '▼'} {label}
    </span>
  );
};

const Kpi: React.FC<{
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  delta?: React.ReactNode;
}> = ({ label, value, hint, tone = 'slate', icon, delta }) => {
  const t = TONES[tone];
  return (
    <div className={`p-2.5 sm:p-4 border rounded-xl sm:rounded-2xl ${t.box} break-inside-avoid`}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className={`text-[10px] sm:text-xs font-bold ${t.label}`}>{label}</span>
        {icon && <span className={`${t.hint} shrink-0`}>{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-1 flex-wrap">
        <span className={`text-sm sm:text-xl font-black whitespace-nowrap block ${t.value}`}>{value}</span>
        {delta}
      </div>
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
  avoidBreak?: boolean;
}> = ({ icon, title, subtitle, aside, children, avoidBreak = true }) => (
  <section className={`border border-slate-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 bg-white ${avoidBreak ? 'break-inside-avoid' : ''}`}>
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
  delta?: React.ReactNode;
}> = ({ label, value, kind = 'line', note, delta }) => {
  const base = 'flex items-center justify-between gap-2 px-2 sm:px-3';
  if (kind === 'grand') {
    return (
      <div className={`${base} py-2 sm:py-2.5 bg-slate-900 text-white rounded-xl mt-1`}>
        <span className="text-xs sm:text-sm font-black">{label}{note && <span className="text-[10px] font-bold text-slate-300 mr-1.5">{note}</span>}</span>
        <span className="flex items-center gap-1.5">{delta}<span className="text-sm sm:text-base font-black whitespace-nowrap font-mono">{value}</span></span>
      </div>
    );
  }
  if (kind === 'total') {
    return (
      <div className={`${base} py-1.5 sm:py-2 bg-slate-100 rounded-lg`}>
        <span className="text-[11px] sm:text-xs font-black text-slate-900">{label}{note && <span className="text-[10px] font-bold text-slate-500 mr-1.5">{note}</span>}</span>
        <span className="flex items-center gap-1.5">{delta}<span className="text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap font-mono">{value}</span></span>
      </div>
    );
  }
  return (
    <div className={`${base} py-1 sm:py-1.5`}>
      <span className="text-[11px] sm:text-xs font-semibold text-slate-600 pr-3 sm:pr-4">{label}{note && <span className="text-[10px] font-medium text-slate-400 mr-1.5">{note}</span>}</span>
      <span className="flex items-center gap-1.5">
        {delta}
        <span className={`text-[11px] sm:text-xs font-bold whitespace-nowrap font-mono ${kind === 'cost' ? 'text-rose-700' : 'text-slate-800'}`}>
          {kind === 'cost' ? `− ${value}` : value}
        </span>
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

const TruncNote: React.FC<{ total: number; shown: number; unit: string }> = ({ total, shown, unit }) =>
  total > shown ? (
    <p className="text-[10px] text-slate-500 font-bold mt-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1">
      يُعرض أول {fmtInt(shown)} من أصل {fmtInt(total)} {unit} — صدّر ملف Excel للحصول على القائمة كاملة.
    </p>
  ) : null;

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
  const [showDetails, setShowDetails] = useState(true);
  const [downloadNote, setDownloadNote] = useState('');

  const range = useMemo(() => resolveRange(period, todayStr, customFrom, customTo), [period, todayStr, customFrom, customTo]);
  const prevRange = useMemo(() => previousRange(period, range, todayStr), [period, range, todayStr]);

  const periodLabel = useMemo(() => {
    const base = PERIOD_OPTIONS.find(p => p.key === period)?.label || '';
    if (!range) return period === 'custom' ? 'فترة مخصصة (حدد التاريخ)' : 'كل الفترات منذ بداية النشاط';
    return `${base}: من ${range.from} إلى ${range.to}`;
  }, [period, range]);

  const prevLabel = useMemo(() => {
    if (!prevRange) return '';
    const elapsed = period === 'month' || period === 'year';
    return `${prevRange.from} → ${prevRange.to}${elapsed ? ' (نفس عدد الأيام المنقضية)' : ''}`;
  }, [prevRange, period]);

  const fileName = `التقرير_المالي_الشامل_${range ? `${range.from}_${range.to}` : 'كل_الفترات'}`;

  const money = (v: number) => (hideFinances ? '••••' : fmtAmount(v));
  const signedMoney = (v: number) => (hideFinances ? '••••' : `${v < 0 ? '− ' : ''}${fmtAmount(Math.abs(v))}`);

  const input = useMemo<ReportInput>(
    () => ({ clothes, rentals, sales, expenses, credits, staffPayouts, maintenanceOrders, caisseClosures, rawMaterials, staffMembers }),
    [clothes, rentals, sales, expenses, credits, staffPayouts, maintenanceOrders, caisseClosures, rawMaterials, staffMembers]
  );

  const r = useMemo(() => computeReport(input, range, todayStr, true), [input, range, todayStr]);
  const p = useMemo(() => (prevRange ? computeReport(input, prevRange, todayStr, false) : null), [input, prevRange, todayStr]);

  // ------------------------------------------------------------------
  // Exports
  // ------------------------------------------------------------------
  const exportToImage = async () => {
    const element = document.getElementById('boutiqueFullReportContent');
    if (!element) return;
    if (element.scrollHeight > PNG_MAX_HEIGHT) {
      setDownloadNote('التقرير طويل جداً لصورة واحدة — أخفِ الكشف التفصيلي أو استخدم الطباعة (PDF) أو Excel.');
      return;
    }
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
    const rows: (string | number)[][] = [];
    const push = (...cells: (string | number)[]) => rows.push(cells);
    const n = (v: number) => Math.round(v);

    push('التقرير المالي والإداري الشامل - بوتيك مانجر برو');
    push('تاريخ الإصدار', `${formattedDate} ${formattedTime}`);
    push('الفترة', periodLabel);
    if (prevRange) push('فترة المقارنة', `${prevRange.from} → ${prevRange.to}`);
    push();

    push('قائمة الدخل (الأرباح والخسائر)', 'الفترة الحالية (دج)', ...(p ? ['الفترة السابقة (دج)', 'الفرق (دج)', 'التغير %'] : []));
    const pl = (label: string, cur: number, prev: number | undefined, sign = 1) => {
      if (p && prev !== undefined) {
        const { diff, pctValue } = deltaInfo(cur, prev);
        push(label, sign * n(cur), sign * n(prev), sign * n(diff), pctValue === null ? 'جديد' : `${Math.round(pctValue)}%`);
      } else {
        push(label, sign * n(cur));
      }
    };
    pl('مداخيل الكراء (المدفوع)', r.rentalIncome, p?.rentalIncome);
    pl('مداخيل المبيعات (رقم الأعمال)', r.salesRevenue, p?.salesRevenue);
    pl('مداخيل الخياطة والتعديل (المدفوع)', r.tailoringIncome, p?.tailoringIncome);
    pl('إجمالي المداخيل', r.grossRevenue, p?.grossRevenue);
    pl('تكلفة البضاعة المباعة', r.salesCogs, p?.salesCogs, -1);
    pl('تكلفة أشغال الخياطة', r.tailoringCost, p?.tailoringCost, -1);
    pl('مجمل الربح', r.grossProfit, p?.grossProfit);
    pl('مصاريف عامة وتشغيلية', r.generalExpenses, p?.generalExpenses, -1);
    pl('مشتريات الموردين (المدفوع)', r.supplierPurchases, p?.supplierPurchases, -1);
    pl('رواتب ومسحوبات العمال', r.staffTotal, p?.staffTotal, -1);
    pl('إجمالي المصاريف التشغيلية', r.operatingExpenses, p?.operatingExpenses, -1);
    pl('صافي الربح', r.netProfit, p?.netProfit);
    push('هامش صافي الربح %', Math.round(r.netMargin), ...(p ? [Math.round(p.netMargin)] : []));
    push('عدد العمليات', r.operationsCount, ...(p ? [p.operationsCount] : []));
    push('عدد عقود الكراء', r.rentalCount, ...(p ? [p.rentalCount] : []));
    push('عدد فواتير البيع', r.salesCount, ...(p ? [p.salesCount] : []));
    push('عدد طلبيات الخياطة', r.tailoringCount, ...(p ? [p.tailoringCount] : []));
    push('عدد الزبائن', r.uniqueCustomers, ...(p ? [p.uniqueCustomers] : []));
    push('أيام النشاط', r.activeDaysCount, ...(p ? [p.activeDaysCount] : []));
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
    push('دفعات العمال حسب العامل', 'عدد الدفعات', 'المبلغ (دج)');
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
    push();

    // ---- Detailed ledgers (complete, no row cap) ----
    push('كشف عمليات الكراء', 'التاريخ', 'القطعة', 'المقاس', 'الزبون', 'الهاتف', 'السعر', 'المدفوع', 'المتبقي', 'الضمان', 'حالة الضمان', 'الحالة', 'تاريخ الإرجاع المتوقع');
    r.detailRentals.forEach(x => push('', rentalDateOf(x), x.itemName, x.itemSize || '', x.customerName, x.customerPhone || '', n(num(x.rentPrice)), n(num(x.paidAmount)), n(num(x.remainingAmount)), n(num(x.cautionAmount)), CAUTION_LABELS[x.cautionStatus] || x.cautionStatus, RENTAL_STATUS_LABELS[x.status] || x.status, x.expectedReturnDate || ''));
    push();
    push('كشف فواتير البيع', 'التاريخ', 'الزبون', 'الهاتف', 'القطع', 'عدد القطع', 'قبل التخفيض', 'التخفيض', 'الإجمالي', 'المدفوع', 'الدين', 'الربح');
    r.detailSales.forEach(s => {
      const items = s.items || [];
      push('', toDay(s.date), s.customerName || '', s.customerPhone || '', items.map(i => `${i.name} ×${num(i.qty) || 1}`).join(' | '), items.reduce((q, i) => q + (num(i.qty) || 1), 0), n(num(s.subtotal) || num(s.totalAmount) + num(s.discount)), n(num(s.discount)), n(num(s.totalAmount)), n(s.paidAmount !== undefined ? num(s.paidAmount) : num(s.totalAmount)), n(num(s.debtAmount)), n(num(s.profit)));
    });
    push();
    push('كشف طلبيات الخياطة', 'التاريخ', 'رقم الطلبية', 'القطعة', 'الخدمة', 'الزبون', 'الهاتف', 'السعر', 'التكلفة', 'المدفوع', 'المتبقي', 'الحالة', 'التسليم المتوقع');
    r.detailOrders.forEach(o => push('', tailoringDateOf(o), o.orderNumber || '', o.itemName, SERVICE_LABELS[o.serviceType] || o.serviceType, o.customerName || 'مخزون داخلي', o.customerPhone || '', n(num(o.price)), n(num(o.cost)), n(num(o.paidAmount)), n(num(o.remainingAmount)), TAILORING_STATUS_LABELS[o.status] || o.status, o.expectedDeliveryDate || ''));
    push();
    push('كشف المصاريف', 'التاريخ', 'التصنيف', 'البيان', 'المورد', 'المبلغ المدفوع', 'إجمالي الفاتورة', 'متبقي للمورد', 'رقم الفاتورة', 'الفترة/ملاحظة');
    r.detailExpenses.forEach(e => push('', toDay(e.date), e.isSupplierPurchase ? 'مشتريات موردين' : e.category || '', e.desc || e.goodsDescription || '', e.supplierName || '', n(num(e.amount)), e.isSupplierPurchase ? n(num(e.totalInvoiceAmount) || num(e.amount)) : '', e.isSupplierPurchase ? n(num(e.creditAmount)) : '', e.invoiceNumber || '', e.periodNote || e.notes || ''));
    push();
    push('كشف دفعات العمال', 'التاريخ', 'العامل', 'النوع', 'المبلغ', 'الأساسي', 'خصم غياب', 'خصم تسبيقات', 'مكافأة', 'ملاحظات');
    r.detailPayouts.forEach(x => push('', toDay(x.date), x.name, x.type || '', n(num(x.amount)), n(num(x.baseAmount)), n(num(x.absenceDeduction)), n(num(x.advancesDeduction)), n(num(x.bonus)), x.notes || ''));
    push();
    push('كشف الديون الحالية', 'التاريخ', 'الجهة', 'الاسم', 'الهاتف', 'النوع', 'البيان', 'المبلغ المتبقي');
    r.detailCredits.forEach(c => push('', toDay(c.date), c.supplierDebt ? 'مورد (علينا)' : 'زبون (لنا)', c.supplierName || c.name, c.phone || '', c.type || '', c.desc || c.goodsDescription || '', n(num(c.amount))));
    push();
    push('كشف جرد الصندوق', 'التاريخ', 'رصيد البداية', 'المدخول', 'المصروف', 'النظري', 'الفعلي', 'الفارق', 'الحالة', 'ملاحظات');
    r.detailClosures.forEach(c => push('', c.date, n(num(c.openingBalance)), n(num(c.totalInflow)), n(num(c.totalOutflow)), n(num(c.theoreticalAmount)), n(num(c.actualAmount)), n(num(c.difference)), CAISSE_STATUS_LABELS[c.status] || c.status, c.notes || ''));

    const csv = '\uFEFF' + rows
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    triggerBlobDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
    setDownloadNote('تم تصدير ملف Excel (CSV) بنجاح مع كل الكشوف التفصيلية');
  };

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const netTone: Tone = hideFinances ? 'blue' : r.netProfit >= 0 ? 'blue' : 'rose';
  const caisseDiff = r.surplusTotal - r.shortageTotal;
  const showScopes = (r.expenseScopes.rental || 0) + (r.expenseScopes.sale || 0) + (r.expenseScopes.tailoring || 0) > 0;
  const activityShare = (v: number) => `${pct(v, r.grossRevenue)}% من المداخيل`;
  const d = (cur: number, prev: number | undefined, invert = false, compact = false) =>
    p && prev !== undefined ? <Delta current={cur} previous={prev} invert={invert} hide={hideFinances} compact={compact} /> : null;

  const comparisonMetrics = p
    ? [
        { label: 'إجمالي المداخيل', current: r.grossRevenue, previous: p.grossRevenue, invert: false },
        { label: 'مداخيل الكراء', current: r.rentalIncome, previous: p.rentalIncome, invert: false },
        { label: 'مداخيل المبيعات', current: r.salesRevenue, previous: p.salesRevenue, invert: false },
        { label: 'مداخيل الخياطة', current: r.tailoringIncome, previous: p.tailoringIncome, invert: false },
        { label: 'مجمل الربح', current: r.grossProfit, previous: p.grossProfit, invert: false },
        { label: 'المصاريف التشغيلية', current: r.operatingExpenses, previous: p.operatingExpenses, invert: true },
        { label: 'رواتب العمال', current: r.staffTotal, previous: p.staffTotal, invert: true },
        { label: 'صافي الربح', current: r.netProfit, previous: p.netProfit, invert: false }
      ]
    : [];
  const comparisonCounts = p
    ? [
        { label: 'عدد العمليات', current: r.operationsCount, previous: p.operationsCount, isMoney: false },
        { label: 'عقود الكراء', current: r.rentalCount, previous: p.rentalCount, isMoney: false },
        { label: 'فواتير البيع', current: r.salesCount, previous: p.salesCount, isMoney: false },
        { label: 'طلبيات الخياطة', current: r.tailoringCount, previous: p.tailoringCount, isMoney: false },
        { label: 'عدد الزبائن', current: r.uniqueCustomers, previous: p.uniqueCustomers, isMoney: false },
        { label: 'أيام النشاط', current: r.activeDaysCount, previous: p.activeDaysCount, isMoney: false },
        { label: 'متوسط العملية', current: Math.round(r.avgOperation), previous: Math.round(p.avgOperation), isMoney: true },
        { label: 'متوسط المدخول اليومي', current: Math.round(r.avgDailyRevenue), previous: Math.round(p.avgDailyRevenue), isMoney: true }
      ]
    : [];

  const revenueSlices = [
    { label: 'الكراء', value: r.rentalIncome, color: CHART_COLORS.rentals },
    { label: 'المبيعات', value: r.salesRevenue, color: CHART_COLORS.sales },
    { label: 'الخياطة', value: r.tailoringIncome, color: CHART_COLORS.tailoring }
  ];
  const profitSlices = [
    { label: 'ربح الكراء', value: Math.max(0, r.rentalIncome), color: CHART_COLORS.rentals },
    { label: 'ربح المبيعات', value: Math.max(0, r.salesProfit), color: CHART_COLORS.sales },
    { label: 'ربح الخياطة', value: Math.max(0, r.tailoringProfit), color: CHART_COLORS.tailoring }
  ];
  const costSlices = [
    { label: 'تكلفة البضاعة المباعة', value: r.salesCogs, color: CHART_COLORS.sales },
    { label: 'تكلفة الخياطة', value: r.tailoringCost, color: CHART_COLORS.tailoring },
    { label: 'مصاريف عامة', value: r.generalExpenses, color: CHART_COLORS.expenses },
    { label: 'مشتريات الموردين', value: r.supplierPurchases, color: '#0891b2' },
    { label: 'رواتب العمال', value: r.staffTotal, color: CHART_COLORS.staff }
  ];
  const topExpenseBars = (() => {
    const top = r.expenseCategories.slice(0, 7).map(c => ({ label: c.name, value: c.total, sub: `${fmtInt(c.count)} عملية` }));
    const rest = r.expenseCategories.slice(7).reduce((s, c) => s + c.total, 0);
    if (rest > 0) top.push({ label: 'تصنيفات أخرى', value: rest, sub: `${fmtInt(r.expenseCategories.length - 7)} تصنيف` });
    return top;
  })();

  const saleItemsLabel = (s: Sale) => {
    const items = s.items || [];
    if (items.length === 0) return '—';
    const head = items.slice(0, 2).map(i => `${i.name}${(num(i.qty) || 1) > 1 ? ` ×${num(i.qty)}` : ''}`).join('، ');
    return items.length > 2 ? `${head} +${items.length - 2}` : head;
  };

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
            <button
              type="button"
              onClick={() => setShowDetails(v => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border inline-flex items-center gap-1 ${
                showDetails ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
              title="إظهار أو إخفاء الكشوف التفصيلية لكل عملية"
            >
              {showDetails ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              الكشف التفصيلي
            </button>
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
          <span>{downloadNote || `${periodLabel} • ${fmtInt(r.operationsCount)} عملية${prevRange ? ` • مقارنة بـ ${prevRange.from} → ${prevRange.to}` : ''}`}</span>
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
                قائمة الدخل، مقارنة الفترات، الرسوم البيانية، تحليل الأنشطة (كراء • بيع • خياطة)، الديون، الصندوق، العمال، المخزون، والكشوف التفصيلية
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  <CalendarRange className="w-3 h-3" />
                  {periodLabel}
                </span>
                {prevRange && (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                    <ArrowLeftRight className="w-3 h-3" />
                    مقارنة بـ {prevLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="text-left bg-slate-50 border border-slate-200 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl self-start sm:self-auto">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 block">{formattedDate}</span>
              <span className="text-[10px] sm:text-[11px] font-mono text-slate-400">{formattedTime}</span>
            </div>
          </div>
        </div>

        {/* 1. Executive KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Kpi tone="blue" icon={<ArrowDownLeft className="w-3.5 h-3.5" />} label="إجمالي المداخيل" value={money(r.grossRevenue)} delta={d(r.grossRevenue, p?.grossRevenue, false, true)} hint={`${fmtInt(r.operationsCount)} عملية (كراء + بيع + خياطة)`} />
          <Kpi tone="emerald" icon={<TrendingUp className="w-3.5 h-3.5" />} label="مجمل الربح" value={money(r.grossProfit)} delta={d(r.grossProfit, p?.grossProfit, false, true)} hint={hideFinances ? 'بعد التكاليف المباشرة' : `هامش ${Math.round(r.grossMargin)}% بعد تكلفة البضاعة والخياطة`} />
          <Kpi tone="dark" icon={<ArrowUpRight className="w-3.5 h-3.5" />} label="المصاريف التشغيلية" value={money(r.operatingExpenses)} delta={d(r.operatingExpenses, p?.operatingExpenses, true, true)} hint={`${fmtInt(r.expenseCount)} مصروف + ${fmtInt(r.staffPayoutCount)} دفعة عمال`} />
          <Kpi tone={netTone} icon={r.netProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />} label="صافي الربح" value={signedMoney(r.netProfit)} delta={d(r.netProfit, p?.netProfit, false, true)} hint={hideFinances ? 'الربح الصافي للبوتيك' : `هامش صافي ${Math.round(r.netMargin)}%`} />
          <Kpi tone="amber" icon={<CreditCard className="w-3.5 h-3.5" />} label="ديون الزبائن لنا" value={money(r.customerDebtTotal)} hint={`${fmtInt(r.customerDebtCount)} دين مسجل (الرصيد الحالي)`} />
          <Kpi tone="rose" icon={<Landmark className="w-3.5 h-3.5" />} label="ديون علينا للموردين" value={money(r.supplierDebtTotal)} hint={`${fmtInt(r.supplierDebtCount)} مورد/فاتورة`} />
          <Kpi tone="violet" icon={<ShieldCheck className="w-3.5 h-3.5" />} label="ضمانات محتجزة" value={money(r.heldCautionsTotal)} hint={`${fmtInt(r.heldCautionsCount)} ضمان أمانة (ليست ربحاً)`} />
          <Kpi tone={!hideFinances && caisseDiff < 0 ? 'rose' : 'slate'} icon={<Scale className="w-3.5 h-3.5" />} label="فارق الصندوق" value={signedMoney(caisseDiff)} hint={r.closuresCount > 0 ? `${fmtInt(r.closuresCount)} يوم جرد • ${fmtInt(r.shortageDays)} عجز • ${fmtInt(r.surplusDays)} فائض` : 'لا توجد عمليات جرد في الفترة'} />
        </div>

        {/* Quick facts strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] sm:text-[11px]">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-500">أيام النشاط</span>
            <span className="font-black text-slate-900 font-mono">{fmtInt(r.activeDaysCount)} {d(r.activeDaysCount, p?.activeDaysCount, false, true)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-500">متوسط المدخول اليومي</span>
            <span className="font-black text-slate-900 font-mono">{money(r.avgDailyRevenue)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-500">متوسط العملية</span>
            <span className="font-black text-slate-900 font-mono">{money(r.avgOperation)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-500">عدد الزبائن</span>
            <span className="font-black text-slate-900 font-mono">{fmtInt(r.uniqueCustomers)} {d(r.uniqueCustomers, p?.uniqueCustomers, false, true)}</span>
          </div>
        </div>

        {/* 2. Income statement + Debts & receivables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Section icon={<Receipt className="w-4 h-4" />} title="قائمة الدخل (الأرباح والخسائر)" subtitle={p ? 'مع نسبة التغير مقارنة بالفترة السابقة' : 'كيف تم احتساب صافي الربح خطوة بخطوة'}>
            <div className="space-y-0.5">
              <p className="text-[10px] font-black text-slate-400 px-2 pt-1">المداخيل</p>
              <PLRow label="مداخيل الكراء" note="المبالغ المدفوعة" value={money(r.rentalIncome)} delta={d(r.rentalIncome, p?.rentalIncome, false, true)} />
              <PLRow label="مداخيل المبيعات" note="رقم الأعمال" value={money(r.salesRevenue)} delta={d(r.salesRevenue, p?.salesRevenue, false, true)} />
              <PLRow label="مداخيل الخياطة والتعديل" note="المبالغ المدفوعة" value={money(r.tailoringIncome)} delta={d(r.tailoringIncome, p?.tailoringIncome, false, true)} />
              <PLRow kind="total" label="إجمالي المداخيل" value={money(r.grossRevenue)} delta={d(r.grossRevenue, p?.grossRevenue, false, true)} />

              <p className="text-[10px] font-black text-slate-400 px-2 pt-2">التكاليف المباشرة</p>
              <PLRow kind="cost" label="تكلفة البضاعة المباعة" note="سعر الشراء" value={money(r.salesCogs)} delta={d(r.salesCogs, p?.salesCogs, true, true)} />
              <PLRow kind="cost" label="تكلفة أشغال الخياطة" note="أجرة الخياطات والمواد" value={money(r.tailoringCost)} delta={d(r.tailoringCost, p?.tailoringCost, true, true)} />
              <PLRow kind="total" label="مجمل الربح" note={hideFinances ? undefined : `${Math.round(r.grossMargin)}%`} value={money(r.grossProfit)} delta={d(r.grossProfit, p?.grossProfit, false, true)} />

              <p className="text-[10px] font-black text-slate-400 px-2 pt-2">المصاريف التشغيلية</p>
              <PLRow kind="cost" label="مصاريف عامة وتشغيلية" note="إيجار، فواتير، غسيل، تسويق..." value={money(r.generalExpenses)} delta={d(r.generalExpenses, p?.generalExpenses, true, true)} />
              <PLRow kind="cost" label="مشتريات الموردين" note="المدفوع نقداً فقط" value={money(r.supplierPurchases)} delta={d(r.supplierPurchases, p?.supplierPurchases, true, true)} />
              <PLRow kind="cost" label="رواتب ومسحوبات العمال" value={money(r.staffTotal)} delta={d(r.staffTotal, p?.staffTotal, true, true)} />
              <PLRow kind="total" label="إجمالي المصاريف التشغيلية" value={money(r.operatingExpenses)} delta={d(r.operatingExpenses, p?.operatingExpenses, true, true)} />

              <PLRow kind="grand" label="صافي الربح" note={hideFinances ? undefined : `هامش ${Math.round(r.netMargin)}%`} value={signedMoney(r.netProfit)} delta={d(r.netProfit, p?.netProfit, false, true)} />
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
                    r.debtByType.map(x => <MiniRow key={x.key} label={`${x.name} (${fmtInt(x.count)})`} value={money(x.total)} />)
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 mb-1">أكبر المدينين</p>
                <div className="bg-slate-50/60 border border-slate-100 rounded-lg px-2">
                  {r.topDebtors.length === 0 ? (
                    <p className="text-[10px] text-slate-400 py-2 text-center">—</p>
                  ) : (
                    r.topDebtors.map(x => <MiniRow key={x.key} label={x.name} value={money(x.total)} />)
                  )}
                </div>
              </div>
            </div>

            {r.topSupplierCreditors.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-black text-slate-500 mb-1">الموردون الذين لهم مستحقات عندنا</p>
                <div className="bg-rose-50/40 border border-rose-100 rounded-lg px-2">
                  {r.topSupplierCreditors.map(x => <MiniRow key={x.key} label={`${x.name} (${fmtInt(x.count)})`} value={money(x.total)} />)}
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* 3. Comparison with previous period */}
        {p && prevRange && (
          <Section
            icon={<ArrowLeftRight className="w-4 h-4" />}
            title="المقارنة بالفترة السابقة"
            subtitle={`الفترة الحالية (${range?.from} → ${range?.to}) مقابل الفترة السابقة (${prevLabel})`}
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-3">
                <DataTable
                  dense
                  headers={[
                    { label: 'المؤشر' },
                    { label: 'الحالية', className: 'text-left' },
                    { label: 'السابقة', className: 'text-left' },
                    { label: 'الفرق', className: 'text-left' },
                    { label: 'التغير', className: 'text-left w-[14%]' }
                  ]}
                  rows={[
                    ...comparisonMetrics.map(m => {
                      const { diff } = deltaInfo(m.current, m.previous);
                      return [
                        <span className="font-bold text-slate-800">{m.label}</span>,
                        <span className="font-mono font-black">{signedMoney(m.current)}</span>,
                        <span className="font-mono text-slate-500">{signedMoney(m.previous)}</span>,
                        <span className={`font-mono ${!hideFinances && diff !== 0 ? ((diff > 0) !== m.invert ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-500'}`}>{signedMoney(diff)}</span>,
                        <Delta current={m.current} previous={m.previous} invert={m.invert} hide={hideFinances} compact />
                      ];
                    }),
                    ...comparisonCounts.map(m => {
                      const { diff } = deltaInfo(m.current, m.previous);
                      const masked = m.isMoney && hideFinances;
                      const show = (v: number) => (m.isMoney ? money(v) : fmtInt(v));
                      return [
                        <span className="font-semibold text-slate-600">{m.label}</span>,
                        <span className="font-mono font-bold">{show(m.current)}</span>,
                        <span className="font-mono text-slate-500">{show(m.previous)}</span>,
                        <span className={`font-mono ${!masked && diff > 0 ? 'text-emerald-700' : !masked && diff < 0 ? 'text-rose-700' : 'text-slate-500'}`}>{masked ? '••••' : `${diff > 0 ? '+' : ''}${show(diff)}`}</span>,
                        <Delta current={m.current} previous={m.previous} hide={masked} compact />
                      ];
                    })
                  ]}
                />
              </div>
              <div className="md:col-span-2 bg-slate-50/70 border border-slate-200 rounded-xl p-2.5">
                <p className="text-[10px] font-black text-slate-500 mb-2">المداخيل والأرباح: الحالية مقابل السابقة</p>
                <CompareBars
                  hideValues={hideFinances}
                  metrics={[
                    { label: 'المداخيل', current: r.grossRevenue, previous: p.grossRevenue },
                    { label: 'مجمل الربح', current: r.grossProfit, previous: p.grossProfit },
                    { label: 'المصاريف', current: r.operatingExpenses, previous: p.operatingExpenses },
                    { label: 'صافي الربح', current: r.netProfit, previous: p.netProfit }
                  ]}
                />
                <ChartLegend items={[{ label: 'الفترة السابقة', color: CHART_COLORS.previous }, { label: 'الفترة الحالية', color: CHART_COLORS.current }]} />
              </div>
            </div>
          </Section>
        )}

        {/* 4. Charts */}
        <Section
          icon={<LineChart className="w-4 h-4" />}
          title={r.daily ? 'الرسم البياني: التطور اليومي للمداخيل والمصاريف' : 'الرسم البياني: التطور الشهري للمداخيل والمصاريف'}
          subtitle="أعمدة المداخيل (كراء/بيع/خياطة) بجانب أعمدة المصاريف (مصاريف/عمال)، والخط الأخضر يمثل صافي الربح"
        >
          <TrendChart rows={r.trendRows} hideValues={hideFinances} />
          <ChartLegend
            items={[
              { label: 'الكراء', color: CHART_COLORS.rentals },
              { label: 'المبيعات', color: CHART_COLORS.sales },
              { label: 'الخياطة', color: CHART_COLORS.tailoring },
              { label: 'المصاريف', color: CHART_COLORS.expenses },
              { label: 'العمال', color: CHART_COLORS.staff },
              { label: 'صافي الربح (خط)', color: CHART_COLORS.net }
            ]}
          />
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <Section icon={<PieChart className="w-4 h-4" />} title="توزيع المداخيل" subtitle="حصة كل نشاط من رقم الأعمال">
            <DonutChart slices={revenueSlices} centerTop={compactNumber(r.grossRevenue)} centerBottom="إجمالي المداخيل" hideValues={hideFinances} money={money} />
          </Section>
          <Section icon={<PieChart className="w-4 h-4" />} title="مصادر الربح" subtitle="مساهمة كل نشاط في مجمل الربح">
            <DonutChart slices={profitSlices} centerTop={compactNumber(r.grossProfit)} centerBottom="مجمل الربح" hideValues={hideFinances} money={money} />
          </Section>
          <Section icon={<PieChart className="w-4 h-4" />} title="هيكل التكاليف" subtitle="أين تذهب الأموال">
            <DonutChart slices={costSlices} centerTop={compactNumber(r.directCosts + r.operatingExpenses)} centerBottom="إجمالي التكاليف" hideValues={hideFinances} money={money} />
          </Section>
        </div>

        {/* 5. Activities */}
        <Section icon={<BarChart3 className="w-4 h-4" />} title="تحليل الأنشطة الثلاثة" subtitle="أداء كل قسم على حدة خلال الفترة">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
            {/* Rentals */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-2.5">
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <span className="flex items-center gap-1.5"><Shirt className="w-3.5 h-3.5 text-slate-700" /><span className="text-[11px] sm:text-xs font-black text-slate-900">كراء الفساتين</span></span>
                {d(r.rentalIncome, p?.rentalIncome, false, true)}
              </div>
              <span className="text-sm sm:text-lg font-black text-slate-900 block font-mono">{money(r.rentalIncome)}</span>
              <span className="text-[9px] text-slate-500 block mb-1.5">{activityShare(r.rentalIncome)}</span>
              <MiniRow label="عدد عقود الكراء" value={<>{fmtInt(r.rentalCount)} {d(r.rentalCount, p?.rentalCount, false, true)}</>} />
              <MiniRow label="قيمة العقود الإجمالية" value={money(r.rentalDealsValue)} />
              <MiniRow label="متوسط الكراء الواحد" value={r.rentalCount > 0 ? money(r.rentalIncome / r.rentalCount) : '—'} />
              <MiniRow label="مداخيل الإكسسوارات" value={money(r.rentalAccessories)} />
              <MiniRow label="تخفيضات ممنوحة" value={money(r.rentalDiscounts)} />
              <MiniRow label="غرامات تأخير/تلف" value={money(r.rentalPenalties)} />
              <MiniRow label="ضمانات مخصومة" value={money(r.cautionsDeducted)} />
              <MiniRow label={`ضمانات مُرجعة (${fmtInt(r.cautionsRefundedCount)})`} value={money(r.cautionsRefunded)} />
              <MiniRow label="قطع أُرجعت في الفترة" value={fmtInt(r.rentalReturnedInPeriod)} />
              {showScopes && <MiniRow label="مصاريف خاصة بالكراء" value={money(r.expenseScopes.rental)} />}
              <MiniRow label="الربح من الكراء" value={money(r.rentalIncome - (showScopes ? r.expenseScopes.rental : 0))} strong />
            </div>

            {/* Sales */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-2.5">
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <span className="flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5 text-slate-700" /><span className="text-[11px] sm:text-xs font-black text-slate-900">بيع الملابس</span></span>
                {d(r.salesRevenue, p?.salesRevenue, false, true)}
              </div>
              <span className="text-sm sm:text-lg font-black text-slate-900 block font-mono">{money(r.salesRevenue)}</span>
              <span className="text-[9px] text-slate-500 block mb-1.5">{activityShare(r.salesRevenue)}</span>
              <MiniRow label="عدد الفواتير" value={<>{fmtInt(r.salesCount)} {d(r.salesCount, p?.salesCount, false, true)}</>} />
              <MiniRow label="عدد القطع المباعة" value={fmtInt(r.salesQty)} />
              <MiniRow label="متوسط الفاتورة" value={r.salesCount > 0 ? money(r.salesRevenue / r.salesCount) : '—'} />
              <MiniRow label="تكلفة البضاعة" value={money(r.salesCogs)} />
              <MiniRow label="هامش الربح على البيع" value={hideFinances ? '••••' : `${pct(r.salesProfit, r.salesRevenue)}%`} />
              <MiniRow label="تخفيضات ممنوحة" value={money(r.salesDiscounts)} />
              <MiniRow label="المدفوع نقداً" value={money(r.salesPaid)} />
              <MiniRow label="بيع بالدين (كريدي)" value={money(r.salesDebt)} />
              {showScopes && <MiniRow label="مصاريف خاصة بالبيع" value={money(r.expenseScopes.sale)} />}
              <MiniRow label="ربح المبيعات" value={money(r.salesProfit - (showScopes ? r.expenseScopes.sale : 0))} strong />
            </div>

            {/* Tailoring */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-2.5">
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <span className="flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5 text-slate-700" /><span className="text-[11px] sm:text-xs font-black text-slate-900">الخياطة والتعديل</span></span>
                {d(r.tailoringIncome, p?.tailoringIncome, false, true)}
              </div>
              <span className="text-sm sm:text-lg font-black text-slate-900 block font-mono">{money(r.tailoringIncome)}</span>
              <span className="text-[9px] text-slate-500 block mb-1.5">{activityShare(r.tailoringIncome)}</span>
              <MiniRow label="عدد الطلبيات" value={<>{fmtInt(r.tailoringCount)} {d(r.tailoringCount, p?.tailoringCount, false, true)}</>} />
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

        {/* 6. Trend table */}
        <Section
          icon={<CalendarRange className="w-4 h-4" />}
          title={r.daily ? 'جدول التطور اليومي للمداخيل والمصاريف' : 'جدول التطور الشهري للمداخيل والمصاريف'}
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

        {/* 7. Expenses + Caisse */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Section
            icon={<Wallet className="w-4 h-4" />}
            title="المصاريف حسب التصنيف"
            subtitle={`${fmtInt(r.expenseCount)} مصروف خلال الفترة`}
            aside={<span className="flex items-center gap-1">الإجمالي: {money(r.totalExpenses)} {d(r.totalExpenses, p?.totalExpenses, true, true)}</span>}
          >
            <HBarList items={topExpenseBars} total={r.totalExpenses} money={money} />
            <div className="mt-3">
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
            </div>
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
            {p && <MiniRow label="عجز الفترة السابقة" value={<>{money(p.shortageTotal)} {d(r.shortageTotal, p.shortageTotal, true, true)}</>} />}
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

        {/* 8. Staff */}
        <Section
          icon={<Users className="w-4 h-4" />}
          title="رواتب ومستحقات العمال"
          subtitle={`${fmtInt(r.staffPayoutCount)} دفعة خلال الفترة`}
          aside={<span className="flex items-center gap-1">الإجمالي: {money(r.staffTotal)} {d(r.staffTotal, p?.staffTotal, true, true)}</span>}
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
                <MiniRow label="نسبة الرواتب من المداخيل" value={hideFinances ? '••••' : `${pct(r.staffTotal, r.grossRevenue)}%`} />
              </div>
            </div>
          </div>
        </Section>

        {/* 9. Inventory & assets */}
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

        {/* 10. Top performers */}
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

        {/* 11. Operational snapshot */}
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

        {/* 12. Detailed ledgers */}
        {showDetails && (
          <>
            <div className="flex items-center gap-2 pt-2">
              <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center"><ListChecks className="w-4 h-4" /></span>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">الكشف التفصيلي لكل العمليات</h2>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">سطر لكل عملية خلال الفترة المختارة (الأحدث أولاً) • كل الكشوف كاملة في ملف Excel</p>
              </div>
            </div>

            {/* Rentals ledger */}
            <Section avoidBreak={false} icon={<Shirt className="w-4 h-4" />} title={`كشف عمليات الكراء (${fmtInt(r.detailRentals.length)})`} aside={<span>المدفوع: {money(r.rentalIncome)}</span>}>
              <DataTable
                dense
                headers={[
                  { label: 'التاريخ', className: 'w-[11%]' },
                  { label: 'القطعة' },
                  { label: 'الزبون', className: 'w-[17%]' },
                  { label: 'السعر', className: 'text-left' },
                  { label: 'المدفوع', className: 'text-left' },
                  { label: 'المتبقي', className: 'text-left' },
                  { label: 'الضمان', className: 'text-left' },
                  { label: 'الحالة', className: 'w-[11%]' }
                ]}
                rows={r.detailRentals.slice(0, DETAIL_ROW_LIMIT).map(x => {
                  const late = x.status === 'active' && !!x.expectedReturnDate && toDay(x.expectedReturnDate) < todayStr;
                  return [
                    <span className="font-mono whitespace-nowrap">{rentalDateOf(x) || '—'}</span>,
                    <span className="font-bold text-slate-800 break-words">{x.itemName}{x.itemSize ? <span className="text-slate-400 font-medium"> • {x.itemSize}</span> : null}{x.hasAccessories && x.accessoryName ? <span className="text-slate-400 font-medium"> + {x.accessoryName}</span> : null}</span>,
                    <span className="text-slate-600 break-words">{x.customerName}{x.customerPhone ? <span className="block text-[9px] font-mono text-slate-400" dir="ltr">{x.customerPhone}</span> : null}</span>,
                    <span className="font-mono">{money(num(x.rentPrice))}</span>,
                    <span className="font-mono font-bold">{money(num(x.paidAmount))}</span>,
                    <span className={`font-mono ${!hideFinances && num(x.remainingAmount) > 0 ? 'text-amber-700 font-bold' : ''}`}>{money(num(x.remainingAmount))}</span>,
                    <span className="font-mono">{money(num(x.cautionAmount))}<span className="block text-[9px] text-slate-400">{CAUTION_LABELS[x.cautionStatus] || ''}</span></span>,
                    <span className={`font-bold ${late ? 'text-rose-700' : 'text-slate-700'}`}>{late ? 'متأخر' : RENTAL_STATUS_LABELS[x.status] || x.status}</span>
                  ];
                })}
                footer={['المجموع', <span className="text-slate-500">{fmtInt(r.detailRentals.length)} عقد</span>, '', <span className="font-mono">{money(r.rentalDealsValue)}</span>, <span className="font-mono">{money(r.rentalIncome)}</span>, <span className="font-mono">{money(r.detailRentals.reduce((s, x) => s + num(x.remainingAmount), 0))}</span>, <span className="font-mono">{money(r.detailRentals.reduce((s, x) => s + num(x.cautionAmount), 0))}</span>, '']}
                emptyText="لا توجد عمليات كراء في هذه الفترة"
              />
              <TruncNote total={r.detailRentals.length} shown={Math.min(r.detailRentals.length, DETAIL_ROW_LIMIT)} unit="عملية كراء" />
            </Section>

            {/* Sales ledger */}
            <Section avoidBreak={false} icon={<ShoppingBag className="w-4 h-4" />} title={`كشف فواتير البيع (${fmtInt(r.detailSales.length)})`} aside={<span>رقم الأعمال: {money(r.salesRevenue)}</span>}>
              <DataTable
                dense
                headers={[
                  { label: 'التاريخ', className: 'w-[11%]' },
                  { label: 'الزبون', className: 'w-[15%]' },
                  { label: 'القطع' },
                  { label: 'التخفيض', className: 'text-left' },
                  { label: 'الإجمالي', className: 'text-left' },
                  { label: 'المدفوع', className: 'text-left' },
                  { label: 'الدين', className: 'text-left' },
                  { label: 'الربح', className: 'text-left' }
                ]}
                rows={r.detailSales.slice(0, DETAIL_ROW_LIMIT).map(s => [
                  <span className="font-mono whitespace-nowrap">{toDay(s.date) || '—'}</span>,
                  <span className="text-slate-600 break-words">{s.customerName || 'زبون عابر'}</span>,
                  <span className="font-bold text-slate-800 break-words">{saleItemsLabel(s)}</span>,
                  <span className="font-mono text-slate-500">{money(num(s.discount))}</span>,
                  <span className="font-mono font-bold">{money(num(s.totalAmount))}</span>,
                  <span className="font-mono">{money(s.paidAmount !== undefined ? num(s.paidAmount) : num(s.totalAmount))}</span>,
                  <span className={`font-mono ${!hideFinances && num(s.debtAmount) > 0 ? 'text-amber-700 font-bold' : ''}`}>{money(num(s.debtAmount))}</span>,
                  <span className={`font-mono font-black ${!hideFinances && num(s.profit) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{signedMoney(num(s.profit))}</span>
                ])}
                footer={['المجموع', <span className="text-slate-500">{fmtInt(r.detailSales.length)} فاتورة</span>, <span className="text-slate-500">{fmtInt(r.salesQty)} قطعة</span>, <span className="font-mono">{money(r.salesDiscounts)}</span>, <span className="font-mono">{money(r.salesRevenue)}</span>, <span className="font-mono">{money(r.salesPaid)}</span>, <span className="font-mono">{money(r.salesDebt)}</span>, <span className="font-mono">{signedMoney(r.salesProfit)}</span>]}
                emptyText="لا توجد فواتير بيع في هذه الفترة"
              />
              <TruncNote total={r.detailSales.length} shown={Math.min(r.detailSales.length, DETAIL_ROW_LIMIT)} unit="فاتورة" />
            </Section>

            {/* Tailoring ledger */}
            <Section avoidBreak={false} icon={<Scissors className="w-4 h-4" />} title={`كشف طلبيات الخياطة والتعديل (${fmtInt(r.detailOrders.length)})`} aside={<span>المدفوع: {money(r.tailoringIncome)}</span>}>
              <DataTable
                dense
                headers={[
                  { label: 'التاريخ', className: 'w-[11%]' },
                  { label: 'الطلبية' },
                  { label: 'الزبون', className: 'w-[15%]' },
                  { label: 'السعر', className: 'text-left' },
                  { label: 'التكلفة', className: 'text-left' },
                  { label: 'المدفوع', className: 'text-left' },
                  { label: 'المتبقي', className: 'text-left' },
                  { label: 'الحالة', className: 'w-[11%]' }
                ]}
                rows={r.detailOrders.slice(0, DETAIL_ROW_LIMIT).map(o => [
                  <span className="font-mono whitespace-nowrap">{tailoringDateOf(o) || '—'}</span>,
                  <span className="font-bold text-slate-800 break-words">{o.orderNumber ? <span className="font-mono text-slate-400 font-medium">{o.orderNumber} • </span> : null}{o.itemName}<span className="text-slate-400 font-medium"> • {SERVICE_LABELS[o.serviceType] || SERVICE_LABELS.other}</span></span>,
                  <span className="text-slate-600 break-words">{o.customerName || 'مخزون داخلي'}</span>,
                  <span className="font-mono">{money(num(o.price))}</span>,
                  <span className="font-mono text-rose-700">{money(num(o.cost))}</span>,
                  <span className="font-mono font-bold">{money(num(o.paidAmount))}</span>,
                  <span className={`font-mono ${!hideFinances && num(o.remainingAmount) > 0 ? 'text-amber-700 font-bold' : ''}`}>{money(num(o.remainingAmount))}</span>,
                  <span className="font-bold text-slate-700">{TAILORING_STATUS_LABELS[o.status] || o.status}</span>
                ])}
                footer={['المجموع', <span className="text-slate-500">{fmtInt(r.detailOrders.length)} طلبية</span>, '', <span className="font-mono">{money(r.tailoringPriceTotal)}</span>, <span className="font-mono">{money(r.tailoringCost)}</span>, <span className="font-mono">{money(r.tailoringIncome)}</span>, <span className="font-mono">{money(r.detailOrders.reduce((s, o) => s + num(o.remainingAmount), 0))}</span>, '']}
                emptyText="لا توجد طلبيات خياطة في هذه الفترة"
              />
              <TruncNote total={r.detailOrders.length} shown={Math.min(r.detailOrders.length, DETAIL_ROW_LIMIT)} unit="طلبية" />
            </Section>

            {/* Expenses ledger */}
            <Section avoidBreak={false} icon={<Wallet className="w-4 h-4" />} title={`كشف المصاريف (${fmtInt(r.detailExpenses.length)})`} aside={<span>الإجمالي: {money(r.totalExpenses)}</span>}>
              <DataTable
                dense
                headers={[
                  { label: 'التاريخ', className: 'w-[11%]' },
                  { label: 'التصنيف', className: 'w-[20%]' },
                  { label: 'البيان' },
                  { label: 'المبلغ المدفوع', className: 'text-left w-[15%]' },
                  { label: 'ملاحظة', className: 'w-[16%]' }
                ]}
                rows={r.detailExpenses.slice(0, DETAIL_ROW_LIMIT).map(e => [
                  <span className="font-mono whitespace-nowrap">{toDay(e.date) || '—'}</span>,
                  <span className="font-bold text-slate-800 break-words">{e.isSupplierPurchase ? 'مشتريات موردين' : e.category || 'غير مصنف'}</span>,
                  <span className="text-slate-600 break-words">{e.desc || e.goodsDescription || '—'}{e.supplierName ? <span className="block text-[9px] text-slate-400">المورد: {e.supplierName}{e.invoiceNumber ? ` • فاتورة ${e.invoiceNumber}` : ''}</span> : null}</span>,
                  <span className="font-mono font-bold text-rose-700">{money(num(e.amount))}</span>,
                  <span className="text-[9px] text-slate-500 break-words">{e.isSupplierPurchase && num(e.creditAmount) > 0 ? `متبقي للمورد: ${money(num(e.creditAmount))}` : e.periodNote || e.notes || ''}</span>
                ])}
                footer={['المجموع', <span className="text-slate-500">{fmtInt(r.detailExpenses.length)} مصروف</span>, '', <span className="font-mono text-rose-700">{money(r.totalExpenses)}</span>, '']}
                emptyText="لا توجد مصاريف في هذه الفترة"
              />
              <TruncNote total={r.detailExpenses.length} shown={Math.min(r.detailExpenses.length, DETAIL_ROW_LIMIT)} unit="مصروف" />
            </Section>

            {/* Staff payouts ledger */}
            <Section avoidBreak={false} icon={<Users className="w-4 h-4" />} title={`كشف دفعات العمال (${fmtInt(r.detailPayouts.length)})`} aside={<span>الإجمالي: {money(r.staffTotal)}</span>}>
              <DataTable
                dense
                headers={[
                  { label: 'التاريخ', className: 'w-[12%]' },
                  { label: 'العامل', className: 'w-[22%]' },
                  { label: 'النوع' },
                  { label: 'خصومات', className: 'text-left w-[14%]' },
                  { label: 'مكافأة', className: 'text-left w-[12%]' },
                  { label: 'المبلغ', className: 'text-left w-[16%]' }
                ]}
                rows={r.detailPayouts.slice(0, DETAIL_ROW_LIMIT).map(x => [
                  <span className="font-mono whitespace-nowrap">{toDay(x.date) || '—'}</span>,
                  <span className="font-bold text-slate-800 break-words">{x.name}</span>,
                  <span className="text-slate-600 break-words">{x.type || '—'}{x.notes ? <span className="block text-[9px] text-slate-400">{x.notes}</span> : null}</span>,
                  <span className="font-mono text-slate-500">{money(num(x.absenceDeduction) + num(x.advancesDeduction))}</span>,
                  <span className="font-mono text-slate-500">{money(num(x.bonus))}</span>,
                  <span className="font-mono font-bold">{money(num(x.amount))}</span>
                ])}
                footer={['المجموع', <span className="text-slate-500">{fmtInt(r.detailPayouts.length)} دفعة</span>, '', <span className="font-mono">{money(r.staffDeductions)}</span>, <span className="font-mono">{money(r.staffBonuses)}</span>, <span className="font-mono">{money(r.staffTotal)}</span>]}
                emptyText="لا توجد دفعات عمال في هذه الفترة"
              />
              <TruncNote total={r.detailPayouts.length} shown={Math.min(r.detailPayouts.length, DETAIL_ROW_LIMIT)} unit="دفعة" />
            </Section>

            {/* Credits ledger */}
            <Section avoidBreak={false} icon={<CreditCard className="w-4 h-4" />} title={`كشف الديون الحالية (${fmtInt(r.detailCredits.length)})`} subtitle="الرصيد الحالي غير المسدد — لا يتأثر بالفترة المختارة" aside={<span>لنا {money(r.customerDebtTotal)} • علينا {money(r.supplierDebtTotal)}</span>}>
              <DataTable
                dense
                headers={[
                  { label: 'التاريخ', className: 'w-[12%]' },
                  { label: 'الجهة', className: 'w-[11%]' },
                  { label: 'الاسم', className: 'w-[18%]' },
                  { label: 'النوع / البيان' },
                  { label: 'المتبقي', className: 'text-left w-[16%]' }
                ]}
                rows={r.detailCredits.slice(0, DETAIL_ROW_LIMIT).map(c => [
                  <span className="font-mono whitespace-nowrap">{toDay(c.date) || '—'}</span>,
                  <span className={`font-bold ${c.supplierDebt ? 'text-rose-700' : 'text-amber-700'}`}>{c.supplierDebt ? 'مورد (علينا)' : 'زبون (لنا)'}</span>,
                  <span className="font-bold text-slate-800 break-words">{c.supplierName || c.name}{c.phone ? <span className="block text-[9px] font-mono text-slate-400" dir="ltr">{c.phone}</span> : null}</span>,
                  <span className="text-slate-600 break-words">{c.type}{c.desc || c.goodsDescription ? <span className="block text-[9px] text-slate-400">{c.desc || c.goodsDescription}</span> : null}</span>,
                  <span className="font-mono font-bold">{money(num(c.amount))}</span>
                ])}
                footer={['المجموع', '', <span className="text-slate-500">{fmtInt(r.detailCredits.length)} دين</span>, '', <span className="font-mono">{money(r.customerDebtTotal + r.supplierDebtTotal)}</span>]}
                emptyText="لا توجد ديون مسجلة"
              />
              <TruncNote total={r.detailCredits.length} shown={Math.min(r.detailCredits.length, DETAIL_ROW_LIMIT)} unit="دين" />
            </Section>

            {/* Caisse ledger */}
            <Section avoidBreak={false} icon={<Scale className="w-4 h-4" />} title={`كشف جرد الصندوق اليومي (${fmtInt(r.detailClosures.length)})`} aside={<span>الفارق الصافي: {signedMoney(caisseDiff)}</span>}>
              <DataTable
                dense
                headers={[
                  { label: 'التاريخ', className: 'w-[12%]' },
                  { label: 'رصيد البداية', className: 'text-left' },
                  { label: 'المدخول', className: 'text-left' },
                  { label: 'المصروف', className: 'text-left' },
                  { label: 'النظري', className: 'text-left' },
                  { label: 'الفعلي', className: 'text-left' },
                  { label: 'الفارق', className: 'text-left' },
                  { label: 'الحالة', className: 'w-[10%]' }
                ]}
                rows={r.detailClosures.slice(0, DETAIL_ROW_LIMIT).map(c => {
                  const diff = num(c.difference);
                  return [
                    <span className="font-mono whitespace-nowrap font-bold">{c.date}</span>,
                    <span className="font-mono text-slate-500">{money(num(c.openingBalance))}</span>,
                    <span className="font-mono">{money(num(c.totalInflow))}</span>,
                    <span className="font-mono text-rose-700">{money(num(c.totalOutflow))}</span>,
                    <span className="font-mono">{money(num(c.theoreticalAmount))}</span>,
                    <span className="font-mono font-bold">{money(num(c.actualAmount))}</span>,
                    <span className={`font-mono font-black ${!hideFinances ? (diff < 0 ? 'text-rose-700' : diff > 0 ? 'text-blue-700' : 'text-emerald-700') : ''}`}>{signedMoney(diff)}</span>,
                    <span className={`font-bold ${diff < 0 ? 'text-rose-700' : diff > 0 ? 'text-blue-700' : 'text-emerald-700'}`}>{CAISSE_STATUS_LABELS[c.status] || c.status}</span>
                  ];
                })}
                footer={['المجموع', '', <span className="font-mono">{money(r.closuresInflow)}</span>, <span className="font-mono text-rose-700">{money(r.closuresOutflow)}</span>, '', '', <span className="font-mono">{signedMoney(caisseDiff)}</span>, <span className="text-slate-500">{fmtInt(r.closuresCount)} يوم</span>]}
                emptyText="لا توجد عمليات جرد في هذه الفترة"
              />
              <TruncNote total={r.detailClosures.length} shown={Math.min(r.detailClosures.length, DETAIL_ROW_LIMIT)} unit="يوم جرد" />
            </Section>
          </>
        )}

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
