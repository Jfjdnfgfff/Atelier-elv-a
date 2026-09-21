import { useMemo } from 'react';
import { Rental, Sale, Expense, Credit, StaffPayout, MaintenanceOrder } from '../types';

export function useDashboardStats(
  rentals: Rental[],
  sales: Sale[],
  expenses: Expense[],
  credits: Credit[],
  staffPayouts: StaffPayout[],
  maintenanceOrders: MaintenanceOrder[]
) {
  return useMemo(() => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYearStr = `${now.getFullYear()}`;

    const isThisMonth = (dateStr?: string) => dateStr ? dateStr.startsWith(currentMonthStr) : false;
    const isThisYear = (dateStr?: string) => dateStr ? dateStr.startsWith(currentYearStr) : false;

    // Helper to filter by period
    const filterByDate = (date: string, period: 'monthly' | 'yearly') => {
      if (period === 'monthly') return isThisMonth(date);
      if (period === 'yearly') return isThisYear(date);
      return true;
    };

    const totalRentalIncome = rentals.reduce((s, r) => s + (r.paidAmount || 0), 0);
    const totalSalesRevenue = sales.reduce((s, sl) => s + (sl.totalAmount || 0), 0);
    const totalSalesProfit = sales.reduce((s, sl) => s + (sl.profit || 0), 0);
    const totalTailoringIncome = maintenanceOrders.reduce((s, o) => s + (o.paidAmount || 0), 0);
    const totalTailoringCost = maintenanceOrders.reduce((s, o) => s + (o.cost || 0), 0);
    
    // Categorize expenses
    const rentalExpenses = expenses.filter(e => e.category === 'كراء');
    const salesExpenses = expenses.filter(e => e.category === 'مبيعات');
    const tailoringExpenses = expenses.filter(e => e.category === 'خياطة');
    const generalExpenses = expenses.filter(e => e.category === 'عام');
    
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalStaff = staffPayouts.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalRentalDebt = rentals.reduce((s, r) => s + (r.status !== 'returned' ? (r.remainingAmount || 0) : 0), 0);
    const totalTailoringDebt = maintenanceOrders.reduce((s, o) => s + (o.status !== 'delivered' ? (o.remainingAmount || 0) : 0), 0);
    const totalDirectDebt = credits.reduce((s, c) => s + Number(c.amount || 0), 0);

    return {
      totalRentalIncome,
      monthlyRentalIncome: rentals.filter(r => filterByDate(r.startDate || r.createdAt || '', 'monthly')).reduce((s, r) => s + (r.paidAmount || 0), 0),
      yearlyRentalIncome: rentals.filter(r => filterByDate(r.startDate || r.createdAt || '', 'yearly')).reduce((s, r) => s + (r.paidAmount || 0), 0),
      monthlyRentalExpenses: rentalExpenses.filter(e => filterByDate(e.date || '', 'monthly')).reduce((s, e) => s + Number(e.amount || 0), 0),
      yearlyRentalExpenses: rentalExpenses.filter(e => filterByDate(e.date || '', 'yearly')).reduce((s, e) => s + Number(e.amount || 0), 0),
      
      totalSalesRevenue,
      monthlySalesRevenue: sales.filter(s => filterByDate(s.date || '', 'monthly')).reduce((s, sl) => s + (sl.totalAmount || 0), 0),
      yearlySalesRevenue: sales.filter(s => filterByDate(s.date || '', 'yearly')).reduce((s, sl) => s + (sl.totalAmount || 0), 0),
      monthlySalesExpenses: salesExpenses.filter(e => filterByDate(e.date || '', 'monthly')).reduce((s, e) => s + Number(e.amount || 0), 0),
      yearlySalesExpenses: salesExpenses.filter(e => filterByDate(e.date || '', 'yearly')).reduce((s, e) => s + Number(e.amount || 0), 0),

      totalSalesProfit,
      monthlySalesProfit: sales.filter(s => filterByDate(s.date || '', 'monthly')).reduce((s, sl) => s + (sl.profit || 0), 0),
      yearlySalesProfit: sales.filter(s => filterByDate(s.date || '', 'yearly')).reduce((s, sl) => s + (sl.profit || 0), 0),

      totalTailoringIncome,
      monthlyTailoringIncome: maintenanceOrders.filter(o => filterByDate(o.receivedDate || o.createdAt || '', 'monthly')).reduce((s, o) => s + (o.paidAmount || 0), 0),
      yearlyTailoringIncome: maintenanceOrders.filter(o => filterByDate(o.receivedDate || o.createdAt || '', 'yearly')).reduce((s, o) => s + (o.paidAmount || 0), 0),
      monthlyTailoringExpenses: tailoringExpenses.filter(e => filterByDate(e.date || '', 'monthly')).reduce((s, e) => s + Number(e.amount || 0), 0),
      yearlyTailoringExpenses: tailoringExpenses.filter(e => filterByDate(e.date || '', 'yearly')).reduce((s, e) => s + Number(e.amount || 0), 0),
      
      totalTailoringCost,
      tailoringProfit: totalTailoringIncome - totalTailoringCost,
      monthlyTailoringProfit: maintenanceOrders.filter(o => filterByDate(o.receivedDate || o.createdAt || '', 'monthly')).reduce((s, o) => s + (o.paidAmount || 0) - (o.cost || 0), 0),
      yearlyTailoringProfit: maintenanceOrders.filter(o => filterByDate(o.receivedDate || o.createdAt || '', 'yearly')).reduce((s, o) => s + (o.paidAmount || 0) - (o.cost || 0), 0),

      totalExpenses,
      monthlyExpenses: expenses.filter(e => filterByDate(e.date || '', 'monthly')).reduce((s, e) => s + Number(e.amount || 0), 0),
      yearlyExpenses: expenses.filter(e => filterByDate(e.date || '', 'yearly')).reduce((s, e) => s + Number(e.amount || 0), 0),

      totalStaff,
      totalStaffPayouts: totalStaff,
      monthlyStaffPayouts: staffPayouts.filter(p => filterByDate(p.date || '', 'monthly')).reduce((s, p) => s + Number(p.amount || 0), 0),
      yearlyStaffPayouts: staffPayouts.filter(p => filterByDate(p.date || '', 'yearly')).reduce((s, p) => s + Number(p.amount || 0), 0),
      
      totalDebt: totalRentalDebt + totalDirectDebt + totalTailoringDebt,
      netProf: (totalRentalIncome + totalSalesProfit + totalTailoringIncome) - (totalExpenses + totalStaff + totalTailoringCost),
      netProfit: (totalRentalIncome + totalSalesProfit + totalTailoringIncome) - (totalExpenses + totalStaff + totalTailoringCost),
      monthlyNetProfit: (rentals.filter(r => filterByDate(r.startDate || r.createdAt || '', 'monthly')).reduce((s, r) => s + (r.paidAmount || 0), 0) +
                         sales.filter(s => filterByDate(s.date || '', 'monthly')).reduce((s, sl) => s + (sl.profit || 0), 0) +
                         maintenanceOrders.filter(o => filterByDate(o.receivedDate || o.createdAt || '', 'monthly')).reduce((s, o) => s + (o.paidAmount || 0), 0)) -
                        (expenses.filter(e => filterByDate(e.date || '', 'monthly')).reduce((s, e) => s + Number(e.amount || 0), 0) +
                         staffPayouts.filter(p => filterByDate(p.date || '', 'monthly')).reduce((s, p) => s + Number(p.amount || 0), 0)),
      yearlyNetProfit: (rentals.filter(r => filterByDate(r.startDate || r.createdAt || '', 'yearly')).reduce((s, r) => s + (r.paidAmount || 0), 0) +
                        sales.filter(s => filterByDate(s.date || '', 'yearly')).reduce((s, sl) => s + (sl.profit || 0), 0) +
                        maintenanceOrders.filter(o => filterByDate(o.receivedDate || o.createdAt || '', 'yearly')).reduce((s, o) => s + (o.paidAmount || 0), 0)) -
                       (expenses.filter(e => filterByDate(e.date || '', 'yearly')).reduce((s, e) => s + Number(e.amount || 0), 0) +
                        staffPayouts.filter(p => filterByDate(p.date || '', 'yearly')).reduce((s, p) => s + Number(p.amount || 0), 0))
    };
  }, [rentals, sales, expenses, credits, staffPayouts, maintenanceOrders]);
}
