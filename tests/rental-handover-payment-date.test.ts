import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { splitRentalIncome, summarizeDailyCaisse, rentalIncomeOnDate } from '../src/utils/dailyCaisseSummary';
import type { Rental } from '../src/types';

const baseRental: Rental = {
  id: 'r1',
  customerName: 'زبونة',
  customerPhone: '0550',
  itemId: 'c1',
  itemName: 'فستان سهرة',
  itemSize: 'M',
  itemColor: 'أحمر',
  qty: 1,
  startDate: '2026-11-05',
  expectedReturnDate: '2026-11-08',
  rentPrice: 6000,
  paidAmount: 5000,
  remainingAmount: 1000,
  cautionAmount: 0,
  cautionStatus: 'none' as any,
  status: 'active',
  createdAt: '2026-11-01T09:00:00.000Z',
  paymentDate: '2026-11-01',
  handoverDate: '2026-11-05',
  handoverCollectedAmount: 4000,
  handoverPaymentDate: '2026-11-03',
  handoverFundSource: 'daily',
  fundSource: 'daily'
};

const dayInput = (date: string, rentals: Rental[]) => summarizeDailyCaisse({
  date,
  sales: [],
  rentals,
  maintenanceOrders: [],
  expenses: [],
  credits: [],
  staffPayouts: []
});

test('rental income is split between booking date and handover cash-in date', () => {
  const split = splitRentalIncome(baseRental);
  assert.equal(split.bookingAmount, 1000);
  assert.equal(split.bookingDate, '2026-11-01');
  assert.equal(split.handoverAmount, 4000);
  assert.equal(split.handoverDate, '2026-11-03');

  assert.equal(dayInput('2026-11-01', [baseRental]).dateRentalsIncome, 1000);
  assert.equal(dayInput('2026-11-03', [baseRental]).dateRentalsIncome, 4000);
  assert.equal(dayInput('2026-11-05', [baseRental]).dateRentalsIncome, 0);
});

test('handover collected into the general fund is attributed to that fund and date only', () => {
  const rental: Rental = { ...baseRental, handoverFundSource: 'general' };

  const handoverDay = dayInput('2026-11-03', [rental]);
  assert.equal(handoverDay.dateRentalsGeneralIncome, 4000);
  assert.equal(handoverDay.dateRentalsIncome, 0);
  assert.equal(handoverDay.dateRentalsGeneral.length, 1);
  assert.equal(handoverDay.dateRentals.length, 0);

  const bookingDay = dayInput('2026-11-01', [rental]);
  assert.equal(bookingDay.dateRentalsIncome, 1000);
  assert.equal(bookingDay.dateRentalsGeneralIncome, 0);
});

test('rentals without handover fields keep the whole amount on the booking date (backward compatible)', () => {
  const legacy: Rental = { ...baseRental, handoverCollectedAmount: undefined, handoverPaymentDate: undefined, handoverDate: undefined };
  const split = splitRentalIncome(legacy);
  assert.equal(split.handoverAmount, 0);
  assert.equal(split.bookingAmount, 5000);
  assert.equal(dayInput('2026-11-01', [legacy]).dateRentalsIncome, 5000);
  assert.equal(dayInput('2026-11-03', [legacy]).dateRentalsIncome, 0);
});

test('handover amount can never exceed the total paid amount', () => {
  const rental: Rental = { ...baseRental, paidAmount: 3000, handoverCollectedAmount: 9000 };
  const split = splitRentalIncome(rental);
  assert.equal(split.handoverAmount, 3000);
  assert.equal(split.bookingAmount, 0);
});

test('rentalIncomeOnDate reports the portion that entered the cash box on that day', () => {
  const handoverPortion = rentalIncomeOnDate(baseRental, '2026-11-03');
  assert.equal(handoverPortion.amount, 4000);
  assert.equal(handoverPortion.isHandover, true);

  const bookingPortion = rentalIncomeOnDate(baseRental, '2026-11-01');
  assert.equal(bookingPortion.amount, 1000);
  assert.equal(bookingPortion.isHandover, false);

  assert.equal(rentalIncomeOnDate(baseRental, '2026-11-09').amount, 0);
});
