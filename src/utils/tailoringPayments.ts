import { MaintenanceOrder, TailoringPayment, TailoringPaymentMethod } from '../types';

/**
 * منطق الفارمسوات (الدفعات/الأقساط) لطلبات الخياطة والصيانة.
 *
 * القاعدة الذهبية: كل دفعة تحمل تاريخها الخاص (date) وهو يوم دخول المال إلى الصندوق،
 * وبذلك يُحتسب المبلغ في صندوق اليوم (La Caisse) في يومه بالضبط لا في يوم العربون الأول.
 *
 * السجلات القديمة (بدون مصفوفة payments) تُعامَل كدفعة واحدة مُستخرجة من الحقول
 * القديمة paidAmount / paymentDate، للحفاظ على توافق كل التقارير السابقة.
 */

export const TAILORING_PAYMENT_METHODS: { id: TailoringPaymentMethod; label: string }[] = [
  { id: 'cash', label: 'نقداً (كاش)' },
  { id: 'transfer', label: 'تحويل بريدي / بنكي' },
  { id: 'check', label: 'شيك' },
  { id: 'other', label: 'طريقة أخرى' },
];

export function tailoringPaymentMethodLabel(method?: TailoringPaymentMethod): string {
  return TAILORING_PAYMENT_METHODS.find(m => m.id === method)?.label || 'نقداً (كاش)';
}

/** توليد معرف محلي للدفعة */
export function makeTailoringPaymentId(): string {
  return `tp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** تاريخ مفتاح بصيغة YYYY-MM-DD */
export function toPaymentDateKey(value?: string): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (trimmed.includes('T')) return trimmed.split('T')[0];
  if (trimmed.includes(' ')) return trimmed.split(' ')[0];
  return trimmed.slice(0, 10);
}

const toAmount = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

/** تاريخ أول استلام للمال في الطلب (للتوافق مع السجلات القديمة) */
export function legacyPaymentDateOf(order?: MaintenanceOrder | null): string {
  if (!order) return '';
  return toPaymentDateKey(order.paymentDate || order.createdAt || order.receivedDate);
}

/** ترتيب الدفعات: الأقدم أولاً ثم الأحدث */
function sortPayments(list: TailoringPayment[]): TailoringPayment[] {
  return [...list].sort((a, b) => {
    const byDate = toPaymentDateKey(a.date).localeCompare(toPaymentDateKey(b.date));
    if (byDate !== 0) return byDate;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });
}

/**
 * سجل دفعات الطلب (مرتب زمنياً).
 * إن لم يكن للطلب مصفوفة دفعات لكن فيه مبلغ مدفوع قديم، تُصاغ دفعة افتراضية واحدة.
 */
export function getTailoringPayments(order?: MaintenanceOrder | null): TailoringPayment[] {
  if (!order) return [];

  const stored = Array.isArray(order.payments) ? order.payments.filter(p => p && toAmount(p.amount) > 0) : [];
  if (stored.length > 0) return sortPayments(stored);

  const legacyPaid = toAmount(order.paidAmount);
  if (legacyPaid > 0) {
    return [
      {
        id: `legacy-${order.id}`,
        amount: legacyPaid,
        date: legacyPaymentDateOf(order),
        method: 'cash',
        note: 'الدفعة الأصلية (عربون/دفع مسجل قبل تفعيل سجل الفارمسوات)',
        legacy: true,
        createdAt: order.createdAt || new Date().toISOString(),
      },
    ];
  }

  return [];
}

/**
 * تحويل سجل الدفعات إلى مصفوفة قابلة للحفظ (تحويل الدفعة الافتراضية القديمة إلى دفعة حقيقية بمعرف جديد).
 */
export function materializeTailoringPayments(order?: MaintenanceOrder | null): TailoringPayment[] {
  return getTailoringPayments(order).map(payment =>
    payment.legacy
      ? { ...payment, id: makeTailoringPaymentId(), legacy: true }
      : { ...payment }
  );
}

/** سعر الطلب المطلوب من الزبون (الأوامر الداخلية للمخزن بلا سعر) */
export function tailoringPriceOf(order?: MaintenanceOrder | null): number {
  if (!order) return 0;
  if (order.targetType === 'internal_stock') return 0;
  return Math.max(0, toAmount(order.price));
}

/** إجمالي المدفوع على الطلب */
export function getTailoringPaidTotal(order?: MaintenanceOrder | null): number {
  return getTailoringPayments(order).reduce((sum, p) => sum + toAmount(p.amount), 0);
}

/** المتبقي على الزبون */
export function getTailoringRemaining(order?: MaintenanceOrder | null): number {
  return Math.max(0, tailoringPriceOf(order) - getTailoringPaidTotal(order));
}

/** نسبة السداد (0 → 100) */
export function getTailoringPaidPercent(order?: MaintenanceOrder | null): number {
  const price = tailoringPriceOf(order);
  if (price <= 0) return 100;
  return Math.min(100, Math.round((getTailoringPaidTotal(order) / price) * 100));
}

/** تاريخ آخر دفعة مستلمة على الطلب (أو تاريخ العربون الأول) */
export function getTailoringLastPaymentDate(order?: MaintenanceOrder | null): string {
  const payments = getTailoringPayments(order);
  if (payments.length === 0) return legacyPaymentDateOf(order);
  return toPaymentDateKey(payments[payments.length - 1].date);
}

/** كل دفعات يوم معيّن (بما فيها الدفعات غير المحتسبة في الصندوق) */
export function getTailoringPaymentsOn(order: MaintenanceOrder | undefined | null, date: string): TailoringPayment[] {
  if (!order || !date) return [];
  const key = toPaymentDateKey(date);
  return getTailoringPayments(order).filter(p => toPaymentDateKey(p.date) === key);
}

/** مدخول الطلب في يوم معيّن (الدفعات المحتسبة في الصندوق فقط) */
export function getTailoringIncomeOn(order: MaintenanceOrder | undefined | null, date: string): number {
  return getTailoringPaymentsOn(order, date).reduce(
    (sum, p) => sum + (p.countsInCaisse === false ? 0 : toAmount(p.amount)),
    0,
  );
}

export interface TailoringPaymentUpdate {
  payments: TailoringPayment[];
  paidAmount: number;
  remainingAmount: number;
  paymentDate: string;
}

/** بناء حقول الطلب بعد إضافة دفعة جديدة (مع تحديث الإجماليات) */
export function buildPaymentAddedUpdate(
  order: MaintenanceOrder,
  payment: Omit<TailoringPayment, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): TailoringPaymentUpdate {
  const base = materializeTailoringPayments(order);
  const newPayment: TailoringPayment = {
    id: payment.id || makeTailoringPaymentId(),
    amount: toAmount(payment.amount),
    date: toPaymentDateKey(payment.date) || new Date().toISOString().split('T')[0],
    method: payment.method || 'cash',
    note: payment.note?.trim() || undefined,
    countsInCaisse: payment.countsInCaisse === false ? false : true,
    createdAt: payment.createdAt || new Date().toISOString(),
  };

  const payments = sortPayments([...base, newPayment]);
  return recomputeFromPayments(order, payments);
}

/** بناء حقول الطلب بعد حذف دفعة (تصحيح قيد) */
export function buildPaymentRemovedUpdate(order: MaintenanceOrder, paymentId: string): TailoringPaymentUpdate {
  const base = materializeTailoringPayments(order);
  const payments = sortPayments(base.filter(p => p.id !== paymentId));
  return recomputeFromPayments(order, payments);
}

/** بناء حقول الطلب بعد تعديل دفعة (تصحيح المبلغ أو التاريخ) */
export function buildPaymentEditedUpdate(
  order: MaintenanceOrder,
  paymentId: string,
  changes: Partial<TailoringPayment>,
): TailoringPaymentUpdate {
  const base = materializeTailoringPayments(order);
  const payments = sortPayments(base.map(p => {
    if (p.id !== paymentId) return p;
    return {
      ...p,
      ...changes,
      amount: changes.amount !== undefined ? toAmount(changes.amount) : p.amount,
      date: changes.date ? (toPaymentDateKey(changes.date) || p.date) : p.date,
      legacy: undefined,
    } as TailoringPayment;
  }));
  return recomputeFromPayments(order, payments);
}

/** إعادة حساب الإجماليات انطلاقاً من سجل الدفعات */
export function recomputeFromPayments(order: MaintenanceOrder, payments: TailoringPayment[]): TailoringPaymentUpdate {
  const paidAmount = payments.reduce((sum, p) => sum + toAmount(p.amount), 0);
  const price = tailoringPriceOf(order);
  const remainingAmount = Math.max(0, price - paidAmount);
  const lastDate = payments.length > 0
    ? toPaymentDateKey(payments[payments.length - 1].date)
    : legacyPaymentDateOf(order);

  return { payments, paidAmount, remainingAmount, paymentDate: lastDate };
}

/** ملخص نصي مختصر لسجل الدفعات */
export function describeTailoringPayments(order?: MaintenanceOrder | null): string {
  const payments = getTailoringPayments(order);
  if (payments.length === 0) return 'لا توجد دفعات مسجلة بعد';
  if (payments.length === 1) return 'دفعة واحدة';
  return `${payments.length} دفعات (فارمسوات)`;
}
