import { Credit, CreditPayment, Expense, FundSource } from '../types';

// قواعد الصندوق العام (الخزينة) وديون الكريدي المرتبطة به

/** هل المصروف مأخوذ من الصندوق العام؟ (السجلات القديمة بدون مصدر تُعتبر من صندوق اليوم) */
export function isGeneralFundExpense(expense: Expense): boolean {
  return expense?.fundSource === 'general';
}

/** هل مدخول الكراء مُسجل في الصندوق العام؟ */
export function isGeneralFundRental(rental: { fundSource?: FundSource }): boolean {
  return rental?.fundSource === 'general';
}

/** مجموع مداخيل الكراء المسجلة في الصندوق العام */
export function sumGeneralFundRentals(rentals: { fundSource?: FundSource; paidAmount?: number }[]): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (let i = 0; i < rentals.length; i++) {
    const r = rentals[i] as any;
    if (isGeneralFundRental(r)) {
      total += Number(r.paidAmount) || 0;
      count += 1;
    }
  }
  return { total, count };
}

/** تسمية عربية لمصدر الدفع */
export function fundSourceLabel(source: FundSource | undefined): string {
  return source === 'general' ? 'الصندوق العام (الخزينة)' : 'صندوق اليوم (الدرج)';
}

/** مجموع المصاريف المسحوبة من الصندوق العام */
export function sumGeneralFundExpenses(expenses: Expense[]): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (let i = 0; i < expenses.length; i++) {
    const expense = expenses[i];
    if (isGeneralFundExpense(expense)) {
      total += Number(expense.amount) || 0;
      count += 1;
    }
  }
  return { total, count };
}

// ربط كل دين بدفعاته: مستندات مجموعة creditPayments + الدفعات المضمّنة القديمة (بدون تكرار)
export function attachCreditPayments(credits: Credit[], creditPayments?: CreditPayment[]): Credit[] {
  if (!creditPayments || creditPayments.length === 0 || credits.length === 0) return credits;

  const byCredit = new Map<string, CreditPayment[]>();
  for (let i = 0; i < creditPayments.length; i++) {
    const payment = creditPayments[i];
    if (!payment?.creditId) continue;
    const list = byCredit.get(payment.creditId);
    if (list) list.push(payment);
    else byCredit.set(payment.creditId, [payment]);
  }

  return credits.map(credit => {
    const docs = byCredit.get(credit.id);
    if (!docs || docs.length === 0) return credit;
    const embedded = Array.isArray(credit.payments) ? credit.payments : [];
    if (embedded.length === 0) return { ...credit, payments: docs };
    const seen = new Set(docs.map(p => p.id));
    return { ...credit, payments: [...docs, ...embedded.filter(p => p && !seen.has(p.id))] };
  });
}

// دفعات دين واحد: مستندات مجموعة الدفعات + المضمّنة القديمة (بدون تكرار)
export function paymentsForCredit(credit: Credit, creditPayments?: CreditPayment[]): CreditPayment[] {
  const embedded: CreditPayment[] = Array.isArray(credit?.payments) ? credit.payments : [];
  if (!creditPayments || creditPayments.length === 0) return embedded;
  const docs: CreditPayment[] = [];
  for (let i = 0; i < creditPayments.length; i++) {
    if (creditPayments[i]?.creditId === credit?.id) docs.push(creditPayments[i]);
  }
  if (docs.length === 0) return embedded;
  if (embedded.length === 0) return docs;
  const seen = new Set(docs.map(p => p.id));
  return [...docs, ...embedded.filter(p => p && !seen.has(p.id))];
}

// ديون الزبائن والموردين: دين الزبون يدخل المال عند التسديد، ودين المورد يخرج المال

/** إجمالي ما سُدِّد من الكريدي حتى الآن */
export function creditTotalPaid(credit: Credit): number {
  const payments = credit?.payments;
  if (!Array.isArray(payments) || payments.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < payments.length; i++) {
    total += Number(payments[i]?.amount) || 0;
  }
  return total;
}

/** المتبقي على الزبون / للمورد */
export function creditRemaining(credit: Credit): number {
  const remaining = (Number(credit?.amount) || 0) - creditTotalPaid(credit);
  return remaining > 0 ? remaining : 0;
}

export function isCreditSettled(credit: Credit): boolean {
  return creditRemaining(credit) <= 0 && creditTotalPaid(credit) > 0;
}

export interface CreditPaymentsSummary {
  inflow: number; // ديون زبائن محصلة كاش في الدرج اليوم
  outflow: number; // دفعات ديون موردين مسددة كاش من الدرج اليوم
  generalInflow: number; // مبالغ دخلت إلى الصندوق العام اليوم
  generalOutflow: number; // مبالغ خرجت من الصندوق العام اليوم
  count: number; // عدد دفعات اليوم
}

/** ملخص دفعات الكريدي في تاريخ معيّن */
export function summarizeCreditPaymentsOn(credits: Credit[], date: string): CreditPaymentsSummary {
  const summary: CreditPaymentsSummary = { inflow: 0, outflow: 0, generalInflow: 0, generalOutflow: 0, count: 0 };

  for (let i = 0; i < credits.length; i++) {
    const credit = credits[i];
    const payments = credit?.payments;
    if (!Array.isArray(payments) || payments.length === 0) continue;

    for (let p = 0; p < payments.length; p++) {
      const payment = payments[p];
      if (!payment?.date || !payment.date.startsWith(date)) continue;

      const amount = Number(payment.amount) || 0;
      if (amount === 0) continue;

      summary.count += 1;
      const toGeneralFund = payment.fundSource === 'general';

      if (credit.supplierDebt) {
        // دفع للمورد: مال خارج من الصندوق
        if (toGeneralFund) summary.generalOutflow += amount;
        else summary.outflow += amount;
      } else {
        // استلام من الزبون: مال داخل إلى الصندوق
        if (toGeneralFund) summary.generalInflow += amount;
        else summary.inflow += amount;
      }
    }
  }

  return summary;
}

/** أثر دفعة واحدة على رصيد الصندوق العام (موجب = إضافة، سالب = خصم) */
export function generalFundEffectOfPayment(credit: Credit, amount: number): number {
  const safeAmount = Number(amount) || 0;
  return credit?.supplierDebt ? -safeAmount : safeAmount;
}

/** أثر كل دفعات كريدي على رصيد الصندوق العام */
export function generalFundEffectOfCredit(credit: Credit): number {
  const payments = credit?.payments;
  if (!Array.isArray(payments) || payments.length === 0) return 0;
  let effect = 0;
  for (let i = 0; i < payments.length; i++) {
    if (payments[i]?.fundSource === 'general') {
      effect += generalFundEffectOfPayment(credit, payments[i].amount);
    }
  }
  return effect;
}
