import type { Credit, Expense, Seamstress } from '../types';

/** Recognise both new debts and invoices created before seamstressId was added to Credit. */
export function isSeamstressCredit(credit: Credit, seamstressInvoiceIds: ReadonlySet<string>): boolean {
  return Boolean(credit.seamstressId || (credit.relatedExpenseId && seamstressInvoiceIds.has(credit.relatedExpenseId)));
}

/** A credit is an unpaid independent invoice, so it shares the normal invoice lifecycle. */
export function makeSeamstressCreditInvoice(seamstress: Seamstress, amount: number, date: string, description: string): Partial<Expense> {
  const details = description.trim() || 'كريدي خياطة';
  return {
    seamstressId: seamstress.id, category: 'فاتورة خياطة', expenseScope: 'tailoring',
    desc: `فاتورة خياطة (${seamstress.name}): ${details}`,
    supplierName: seamstress.name, supplierPhone: seamstress.phone || '', goodsDescription: details,
    amount: 0, paidAmount: 0, totalInvoiceAmount: amount, creditAmount: amount,
    date, fundSource: 'daily',
  };
}
