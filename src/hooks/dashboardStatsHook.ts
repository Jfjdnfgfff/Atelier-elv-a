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

    // Single pass for rentals
    let totalRentalIncome = 0;
    let monthlyRentalIncome = 0;
    let yearlyRentalIncome = 0;
    let totalRentalDebt = 0;

    for (let i = 0; i < rentals.length; i++) {
      const r = rentals[i];
      const paid = r.paidAmount || 0;
      totalRentalIncome += paid;

      const dateStr = r.startDate || r.createdAt || '';
      if (dateStr.startsWith(currentMonthStr)) {
        monthlyRentalIncome += paid;
      }
      if (dateStr.startsWith(currentYearStr)) {
        yearlyRentalIncome += paid;
      }

      if (r.status !== 'returned') {
        totalRentalDebt += (r.remainingAmount || 0);
      }
    }

    // Single pass for sales
    let totalSalesRevenue = 0;
    let monthlySalesRevenue = 0;
    let yearlySalesRevenue = 0;
    let totalSalesProfit = 0;
    let monthlySalesProfit = 0;
    let yearlySalesProfit = 0;

    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      const amount = s.totalAmount || 0;
      const profit = s.profit || 0;

      totalSalesRevenue += amount;
      totalSalesProfit += profit;

      const dateStr = s.date || '';
      if (dateStr.startsWith(currentMonthStr)) {
        monthlySalesRevenue += amount;
        monthlySalesProfit += profit;
      }
      if (dateStr.startsWith(currentYearStr)) {
        yearlySalesRevenue += amount;
        yearlySalesProfit += profit;
      }
    }

    // Single pass for maintenance (tailoring)
    let totalTailoringIncome = 0;
    let monthlyTailoringIncome = 0;
    let yearlyTailoringIncome = 0;
    let totalTailoringCost = 0;
    let monthlyTailoringProfit = 0;
    let yearlyTailoringProfit = 0;
    let totalTailoringDebt = 0;

    for (let i = 0; i < maintenanceOrders.length; i++) {
      const o = maintenanceOrders[i];
      const paid = o.paidAmount || 0;
      const cost = o.cost || 0;

      totalTailoringIncome += paid;
      totalTailoringCost += cost;

      const dateStr = o.receivedDate || o.createdAt || '';
      if (dateStr.startsWith(currentMonthStr)) {
        monthlyTailoringIncome += paid;
        monthlyTailoringProfit += (paid - cost);
      }
      if (dateStr.startsWith(currentYearStr)) {
        yearlyTailoringIncome += paid;
        yearlyTailoringProfit += (paid - cost);
      }

      if (o.status !== 'delivered') {
        totalTailoringDebt += (o.remainingAmount || 0);
      }
    }

    // Single pass for expenses (including category breakdowns)
    let totalExpenses = 0;
    let monthlyExpenses = 0;
    let yearlyExpenses = 0;

    let monthlyRentalExpenses = 0;
    let yearlyRentalExpenses = 0;

    let monthlySalesExpenses = 0;
    let yearlySalesExpenses = 0;

    let monthlyTailoringExpenses = 0;
    let yearlyTailoringExpenses = 0;

    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const amt = Number(e.amount || 0);
      totalExpenses += amt;

      const dateStr = e.date || '';
      const isM = dateStr.startsWith(currentMonthStr);
      const isY = dateStr.startsWith(currentYearStr);

      if (isM) {
        monthlyExpenses += amt;
      }
      if (isY) {
        yearlyExpenses += amt;
      }

      if (e.category === 'كراء') {
        if (isM) monthlyRentalExpenses += amt;
        if (isY) yearlyRentalExpenses += amt;
      } else if (e.category === 'مبيعات') {
        if (isM) monthlySalesExpenses += amt;
        if (isY) yearlySalesExpenses += amt;
      } else if (e.category === 'خياطة') {
        if (isM) monthlyTailoringExpenses += amt;
        if (isY) yearlyTailoringExpenses += amt;
      }
    }

    // Single pass for staff payouts
    let totalStaff = 0;
    let monthlyStaffPayouts = 0;
    let yearlyStaffPayouts = 0;

    for (let i = 0; i < staffPayouts.length; i++) {
      const p = staffPayouts[i];
      const amt = Number(p.amount || 0);
      totalStaff += amt;

      const dateStr = p.date || '';
      if (dateStr.startsWith(currentMonthStr)) {
        monthlyStaffPayouts += amt;
      }
      if (dateStr.startsWith(currentYearStr)) {
        yearlyStaffPayouts += amt;
      }
    }

    // Single pass for credits (direct debt)
    let totalDirectDebt = 0;
    for (let i = 0; i < credits.length; i++) {
      totalDirectDebt += Number(credits[i].amount || 0);
    }

    const totalTailoringProfit = totalTailoringIncome - totalTailoringCost;
    const totalDebt = totalRentalDebt + totalDirectDebt + totalTailoringDebt;
    const netProfit = (totalRentalIncome + totalSalesProfit + totalTailoringIncome) - (totalExpenses + totalStaff + totalTailoringCost);
    const monthlyNetProfit = (monthlyRentalIncome + monthlySalesProfit + monthlyTailoringIncome) - (monthlyExpenses + monthlyStaffPayouts);
    const yearlyNetProfit = (yearlyRentalIncome + yearlySalesProfit + yearlyTailoringIncome) - (yearlyExpenses + yearlyStaffPayouts);

    return {
      totalRentalIncome,
      monthlyRentalIncome,
      yearlyRentalIncome,
      monthlyRentalExpenses,
      yearlyRentalExpenses,
      
      totalSalesRevenue,
      monthlySalesRevenue,
      yearlySalesRevenue,
      monthlySalesExpenses,
      yearlySalesExpenses,

      totalSalesProfit,
      monthlySalesProfit,
      yearlySalesProfit,

      totalTailoringIncome,
      monthlyTailoringIncome,
      yearlyTailoringIncome,
      monthlyTailoringExpenses,
      yearlyTailoringExpenses,
      
      totalTailoringCost,
      tailoringProfit: totalTailoringProfit,
      monthlyTailoringProfit,
      yearlyTailoringProfit,

      totalExpenses,
      monthlyExpenses,
      yearlyExpenses,

      totalStaff,
      totalStaffPayouts: totalStaff,
      monthlyStaffPayouts,
      yearlyStaffPayouts,

      // Combined Gross Revenues
      totalGrossRevenue: totalRentalIncome + totalSalesRevenue + totalTailoringIncome,
      monthlyGrossRevenue: monthlyRentalIncome + monthlySalesRevenue + monthlyTailoringIncome,
      yearlyGrossRevenue: yearlyRentalIncome + yearlySalesRevenue + yearlyTailoringIncome,
      
      totalDebt,
      netProf: netProfit,
      netProfit,
      monthlyNetProfit,
      yearlyNetProfit
    };
  }, [rentals, sales, expenses, credits, staffPayouts, maintenanceOrders]);
}
