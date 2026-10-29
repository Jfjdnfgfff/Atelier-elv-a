import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { summarizeDailyCaisse } from '../src/utils/dailyCaisseSummary';
import { attachCreditPayments, creditRemaining } from '../src/utils/fundBalance';
import type { Credit, CreditPayment, Expense } from '../src/types';

test('independent seamstress invoice and dated debt payments affect the right funds only once', () => {
  const invoice: Expense = { id: 'invoice', seamstressId: 'seam', category: 'فاتورة خياطة', desc: 'عمل', date: '2026-10-01', amount: 200, paidAmount: 700, totalInvoiceAmount: 1000, creditAmount: 300, fundSource: 'daily', expenseScope: 'tailoring' };
  const credit: Credit = { id: 'credit', name: 'خياطة', phone: '', type: 'دين للخياطة', desc: '', amount: 800, date: '2026-10-01', relatedExpenseId: invoice.id, supplierDebt: true };
  const payments: CreditPayment[] = [
    { id: 'one', creditId: credit.id, amount: 300, date: '2026-10-02', fundSource: 'daily' },
    { id: 'two', creditId: credit.id, amount: 200, date: '2026-10-03', fundSource: 'general' },
  ];
  const credits = attachCreditPayments([credit], payments);
  const base = { sales: [], rentals: [], maintenanceOrders: [], expenses: [invoice], credits, staffPayouts: [] };
  assert.equal(creditRemaining(credits[0]), 300);
  assert.equal(summarizeDailyCaisse({ ...base, date: '2026-10-01' }).totalDailyOutflow, 200);
  assert.equal(summarizeDailyCaisse({ ...base, date: '2026-10-02' }).totalDailyOutflow, 300);
  const third = summarizeDailyCaisse({ ...base, date: '2026-10-03' });
  assert.equal(third.totalDailyOutflow, 0);
  assert.equal(third.dateCreditGeneralOutflow, 200);
});

import { isSeamstressCredit, makeSeamstressCreditInvoice } from '../src/utils/seamstressCredit';

test('a new seamstress credit is an unpaid independent invoice', () => {
  const invoice = makeSeamstressCreditInvoice({ id: 's1', name: 'سميرة', phone: '0550' }, 1000, '2026-10-01', '  تفصيل  ');
  assert.equal(invoice.seamstressId, 's1');
  assert.equal(invoice.goodsDescription, 'تفصيل');
  assert.equal(invoice.amount, 0);
  assert.equal(invoice.paidAmount, 0);
  assert.equal(invoice.totalInvoiceAmount, 1000);
  assert.equal(invoice.creditAmount, 1000);
  assert.equal(invoice.expenseScope, 'tailoring');
  const day = summarizeDailyCaisse({ date: '2026-10-01', sales: [], rentals: [], maintenanceOrders: [], expenses: [invoice as Expense], credits: [], staffPayouts: [] });
  assert.equal(day.totalDailyOutflow, 0);
});

test('seamstress debt classification preserves old invoice-linked debts and excludes supplier debts', () => {
  const base: Credit = { id: 'c', name: 'اسم', phone: '', type: '', desc: '', amount: 100, date: '2026-10-01', supplierDebt: true };
  const invoiceIds = new Set(['old-invoice']);
  assert.equal(isSeamstressCredit({ ...base, seamstressId: 's1' }, invoiceIds), true);
  assert.equal(isSeamstressCredit({ ...base, relatedExpenseId: 'old-invoice' }, invoiceIds), true);
  assert.equal(isSeamstressCredit({ ...base, relatedExpenseId: 'supplier-invoice' }, invoiceIds), false);
  assert.equal(isSeamstressCredit(base, invoiceIds), false);
});
