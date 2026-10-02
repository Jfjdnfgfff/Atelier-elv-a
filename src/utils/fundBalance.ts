import { Credit, Expense, FundSource } from '../types';

/**
 * الصندوق العام (الخزينة التراكمية للمحل)
 * ---------------------------------------
 * - الرصيد مخزّن كقيمة واحدة (مشتركة بين كل الأجهزة عبر إعدادات Firebase).
 * - كل مصروف مُسجَّل على أنه «من الصندوق العام» يُخصم مبلغه مباشرة من الرصيد.
 * - حذف المصروف يُرجع مبلغه إلى الرصيد.
 * - المصاريف من الصندوق العام لا تدخل في حساب درج اليوم (لا تؤثر على فارق الصندوق اليومي).
 */

/** هل المصروف مأخوذ من الصندوق العام؟ (السجلات القديمة بدون مصدر تُعتبر من صندوق اليوم) */
export function isGeneralFundExpense(expense: Expense): boolean {
  return expense?.fundSource === 'general';
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

/**
 * ==========================================================
 * ديون الزبائن والموردين (الكريدي) وربطها بالصندوق
 * ==========================================================
 * - دين على الزبون (لنا): عند التسديد يدخل المال إلى الصندوق المختار.
 * - دين للمورد (علينا): عند التسديد يخرج المال من الصندوق المختار.
 * الدفعات القديمة بدون صندوق تُعتبر من صندوق اليوم (الدرج).
 */

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

/** ملخص دفعات الكريدي في تاريخ معيّن (YYYY-MM-DD) */
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
