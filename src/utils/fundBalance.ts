import { Expense, FundSource } from '../types';

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
