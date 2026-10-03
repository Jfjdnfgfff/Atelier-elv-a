import {
  Credit,
  Expense,
  MaintenanceOrder,
  Rental,
  Sale,
  StaffPayout,
} from '../types';
import { isGeneralFundExpense, summarizeCreditPaymentsOn } from './fundBalance';

export interface DailyCaisseSummaryInput {
  date: string;
  sales: Sale[];
  rentals: Rental[];
  maintenanceOrders: MaintenanceOrder[];
  expenses: Expense[];
  credits: Credit[];
  staffPayouts: StaffPayout[];
}

export interface DailyCaisseSummary {
  dateSales: Sale[];
  dateSalesIncome: number;
  dateRentals: Rental[];
  dateRentalsIncome: number;
  dateCautionsReceived: number;
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
  totalDailyInflow: number;
  totalDailyOutflow: number;
}

const toAmount = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const toDateKey = (value: string | undefined): string =>
  typeof value === 'string' ? value.trim().slice(0, 10) : '';

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
  let dateRentalsIncome = 0;
  let dateCautionsReceived = 0;
  for (const rental of rentals) {
    const paymentDate = toDateKey(
      rental.paymentDate || rental.createdAt || rental.startDate,
    );
    if (paymentDate === date) {
      dateRentals.push(rental);
      dateRentalsIncome += toAmount(rental.paidAmount);
      if (rental.cautionStatus === 'held') {
        dateCautionsReceived += toAmount(rental.cautionAmount);
      }
    }
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

  const creditPayments = summarizeCreditPaymentsOn(credits, date);
  const totalDailyInflow =
    dateSalesIncome +
    dateRentalsIncome +
    dateTailoringIncome +
    dateCautionsReceived +
    creditPayments.inflow;
  const totalDailyOutflow =
    dateExpensesPaid + dateStaffPayoutsPaid + creditPayments.outflow;

  return {
    dateSales,
    dateSalesIncome,
    dateRentals,
    dateRentalsIncome,
    dateCautionsReceived,
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
    totalDailyInflow,
    totalDailyOutflow,
  };
}
