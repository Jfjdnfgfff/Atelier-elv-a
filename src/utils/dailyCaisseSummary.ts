import {
  Credit,
  Expense,
  MaintenanceOrder,
  Rental,
  Sale,
  SeamstressPayment,
  StaffPayout,
} from '../types';
import { isGeneralFundExpense, isGeneralFundRental, summarizeCreditPaymentsOn } from './fundBalance';
import type { FundSource } from '../types';

export interface DailyCaisseSummaryInput {
  date: string;
  sales: Sale[];
  rentals: Rental[];
  maintenanceOrders: MaintenanceOrder[];
  expenses: Expense[];
  credits: Credit[];
  staffPayouts: StaffPayout[];
  seamstressPayments?: SeamstressPayment[];
}

export interface DailyCaisseSummary {
  dateSales: Sale[];
  dateSalesIncome: number;
  dateRentals: Rental[];
  dateRentalsIncome: number;
  dateRentalsGeneral: Rental[];
  dateRentalsGeneralIncome: number;
  dateCautionsReceived: number;
  dateCautionsGeneralReceived: number;
  dateTailoring: MaintenanceOrder[];
  dateTailoringIncome: number;
  dateExpenses: Expense[];
  dateExpensesPaid: number;
  dateGeneralSourceExpenses: number;
  dateCreditInflow: number;
  dateCreditOutflow: number;
  dateCreditGeneralInflow: number;
  dateCreditGeneralOutflow: number;
  dateCreditPaymentsCount: number;
  dateStaffPayouts: StaffPayout[];
  dateStaffPayoutsPaid: number;
  dateSeamstressPayments: SeamstressPayment[];
  dateSeamstressPaymentsPaid: number;
  dateSeamstressPaymentsGeneral: number;
  totalDailyInflow: number;
  totalDailyOutflow: number;
}

const toAmount = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const toDateKey = (value: string | undefined): string =>
  typeof value === 'string' ? value.trim().slice(0, 10) : '';

export interface RentalIncomeSplit {
  /** الجزء المسجّل عند الحجز/إنشاء الكراء (العربون أو الدفعة الأولى) */
  bookingAmount: number;
  bookingDate: string;
  bookingFundSource: FundSource;
  /** الجزء المحصل عند تسليم الفستان وإتمام الصفقة */
  handoverAmount: number;
  /** تاريخ دخول مبلغ التسليم في الصندوق — null إذا لم يُحصّل شيء عند التسليم */
  handoverDate: string | null;
  handoverFundSource: FundSource;
}

/**
 * تقسيم مدخول الكراء إلى دفعتين مستقلتين في الصندوق:
 *  - دفعة الحجز: تُحسب في تاريخ استلام المال الأصلي (paymentDate).
 *  - دفعة التسليم: تُحسب في التاريخ الذي يدخله المستخدم عند إتمام الصفقة
 *    (handoverPaymentDate)، وبالصندوق الذي اختاره (الدرج أو الخزينة).
 * الكراءات القديمة التي لا تحتوي حقول التسليم تبقى كما هي (كل المبلغ في تاريخ الحجز).
 */
export function splitRentalIncome(rental: Rental): RentalIncomeSplit {
  const totalPaid = toAmount(rental.paidAmount);
  const rawHandover = toAmount((rental as any).handoverCollectedAmount);
  const handoverAmount = Math.max(0, Math.min(rawHandover, totalPaid));
  const bookingAmount = Math.max(0, totalPaid - handoverAmount);

  const bookingDate = toDateKey(rental.paymentDate || rental.createdAt || rental.startDate);
  const handoverDate = handoverAmount > 0
    ? toDateKey(
        (rental as any).handoverPaymentDate ||
        rental.handoverDate ||
        rental.paymentDate ||
        rental.createdAt ||
        rental.startDate
      )
    : null;

  const baseFund: FundSource = (rental.fundSource as FundSource) === 'general' ? 'general' : 'daily';
  const handoverFund: FundSource =
    (rental as any).handoverFundSource === 'general' || (rental as any).handoverFundSource === 'daily'
      ? ((rental as any).handoverFundSource as FundSource)
      : baseFund;

  return {
    bookingAmount,
    bookingDate: bookingDate || handoverDate || '',
    bookingFundSource: baseFund,
    handoverAmount,
    handoverDate,
    handoverFundSource: handoverFund
  };
}

/** نسبة الكراء التي دخلت الصندوق في يوم معيّن (للعرض في قائمة صندوق اليوم) */
export function rentalIncomeOnDate(
  rental: Rental,
  date: string
): { amount: number; fundSource: FundSource; date: string; isHandover: boolean } {
  const split = splitRentalIncome(rental);
  if (split.handoverDate === date && split.handoverAmount > 0) {
    return { amount: split.handoverAmount, fundSource: split.handoverFundSource, date, isHandover: true };
  }
  if (split.bookingDate === date && split.bookingAmount > 0) {
    return { amount: split.bookingAmount, fundSource: split.bookingFundSource, date, isHandover: false };
  }
  return { amount: 0, fundSource: split.bookingFundSource, date, isHandover: false };
}

/**
 * Build the daily cash-register summary in one place so the dashboard and
 * Caisse view always use the same dates, payment sources, and income rules.
 */
export function summarizeDailyCaisse({
  date,
  sales,
  rentals,
  maintenanceOrders,
  expenses,
  credits,
  staffPayouts,
  seamstressPayments = [],
}: DailyCaisseSummaryInput): DailyCaisseSummary {
  const dateSales: Sale[] = [];
  let dateSalesIncome = 0;
  for (const sale of sales) {
    if (sale.date?.startsWith(date)) {
      dateSales.push(sale);
      dateSalesIncome += toAmount(
        sale.paidAmount !== undefined ? sale.paidAmount : sale.totalAmount,
      );
    }
  }

  const dateRentals: Rental[] = [];
  const dateRentalsGeneral: Rental[] = [];
  let dateRentalsIncome = 0;
  let dateRentalsGeneralIncome = 0;
  let dateCautionsReceived = 0;
  let dateCautionsGeneralReceived = 0;
  for (const rental of rentals) {
    const split = splitRentalIncome(rental);
    let generalPortionToday = false;
    let dailyPortionToday = false;

    if (split.bookingDate === date && split.bookingAmount > 0) {
      if (split.bookingFundSource === 'general') {
        dateRentalsGeneralIncome += split.bookingAmount;
        generalPortionToday = true;
      } else {
        dateRentalsIncome += split.bookingAmount;
        dailyPortionToday = true;
      }
    }

    if (split.handoverDate === date && split.handoverAmount > 0) {
      if (split.handoverFundSource === 'general') {
        dateRentalsGeneralIncome += split.handoverAmount;
        generalPortionToday = true;
      } else {
        dateRentalsIncome += split.handoverAmount;
        dailyPortionToday = true;
      }
    }

    // الضمان يُحسب في يوم استلامه (يوم الحجز/العربون)
    if (split.bookingDate === date && rental.cautionStatus === 'held') {
      if (isGeneralFundRental(rental)) {
        dateCautionsGeneralReceived += toAmount(rental.cautionAmount);
      } else {
        dateCautionsReceived += toAmount(rental.cautionAmount);
      }
    }

    if (generalPortionToday) dateRentalsGeneral.push(rental);
    if (dailyPortionToday) dateRentals.push(rental);
  }

  const dateTailoring: MaintenanceOrder[] = [];
  let dateTailoringIncome = 0;
  for (const order of maintenanceOrders) {
    const paymentDate = toDateKey(
      order.paymentDate || order.createdAt || order.receivedDate,
    );
    if (paymentDate === date) {
      dateTailoring.push(order);
      dateTailoringIncome += toAmount(order.paidAmount);
    }
  }

  const dateExpenses = expenses.filter(
    expense => expense.date?.startsWith(date),
  );
  let dateExpensesPaid = 0;
  let dateGeneralSourceExpenses = 0;
  for (const expense of dateExpenses) {
    if (isGeneralFundExpense(expense)) {
      dateGeneralSourceExpenses += toAmount(expense.amount);
    } else {
      dateExpensesPaid += toAmount(expense.amount);
    }
  }

  const dateStaffPayouts = staffPayouts.filter(
    payout => payout.date?.startsWith(date),
  );
  const dateStaffPayoutsPaid = dateStaffPayouts.reduce(
    (total, payout) => total + toAmount(payout.amount),
    0,
  );

  // دفعات أتعاب الخياطات: من الدرج تُخصم من صندوق اليوم، ومن الخزينة تُظهر خارج الدرج
  const dateSeamstressPayments: SeamstressPayment[] = [];
  let dateSeamstressPaymentsPaid = 0;
  let dateSeamstressPaymentsGeneral = 0;
  for (const payment of seamstressPayments) {
    if (toDateKey(payment.date) !== date) continue;
    dateSeamstressPayments.push(payment);
    if (payment.fundSource === 'general') {
      dateSeamstressPaymentsGeneral += toAmount(payment.amount);
    } else {
      dateSeamstressPaymentsPaid += toAmount(payment.amount);
    }
  }

  const creditPayments = summarizeCreditPaymentsOn(credits, date);
  const totalDailyInflow =
    dateSalesIncome +
    dateRentalsIncome +
    dateTailoringIncome +
    dateCautionsReceived +
    creditPayments.inflow;
  const totalDailyOutflow =
    dateExpensesPaid +
    dateStaffPayoutsPaid +
    dateSeamstressPaymentsPaid +
    creditPayments.outflow;

  return {
    dateSales,
    dateSalesIncome,
    dateRentals,
    dateRentalsIncome,
    dateRentalsGeneral,
    dateRentalsGeneralIncome,
    dateCautionsReceived,
    dateCautionsGeneralReceived,
    dateTailoring,
    dateTailoringIncome,
    dateExpenses,
    dateExpensesPaid,
    dateGeneralSourceExpenses,
    dateCreditInflow: creditPayments.inflow,
    dateCreditOutflow: creditPayments.outflow,
    dateCreditGeneralInflow: creditPayments.generalInflow,
    dateCreditGeneralOutflow: creditPayments.generalOutflow,
    dateCreditPaymentsCount: creditPayments.count,
    dateStaffPayouts,
    dateStaffPayoutsPaid,
    dateSeamstressPayments,
    dateSeamstressPaymentsPaid,
    dateSeamstressPaymentsGeneral,
    totalDailyInflow,
    totalDailyOutflow,
  };
}
