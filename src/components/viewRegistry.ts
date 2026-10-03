import React from 'react';
import type { ViewType } from '../types';

/**
 * سجل الأقسام (Views Registry) — تقسيم الحزمة على مستوى الشاشة (Route-level Code Splitting)
 *
 * كل قسم يُحمَّل كحزمة مستقلة (`React.lazy`) فلا يُنزَّل ولا يُنفَّذ أي كود
 * لا يحتاجه المستخدم في الشاشة الحالية (معالجة محور «JavaScript غير المستخدم»).
 *
 * `preloadView` تُستدعى عند نيّة المستخدم (Hover / Touch / Focus على زر القسم)
 * لتصبح الحزمة جاهزة قبل النقر، مع الحفاظ على التنقّل الفوري.
 */

type AnyView = React.ComponentType<any>;

// 'customers' نوع شاشة قديم غير مُنفَّذ في ViewRenderer — لذلك السجل جزئي (Partial)
const loaders: Partial<Record<ViewType, () => Promise<unknown>>> = {
  dashboard: () => import('./DashboardView'),
  rentals: () => import('./RentalsView'),
  inventory: () => import('./InventoryView'),
  sales: () => import('./SalesPOSView'),
  tailoring: () => import('./TailoringView'),
  expenses: () => import('./ExpensesView'),
  credits: () => import('./CreditsView'),
  caisse: () => import('./CaisseView'),
  partners: () => import('./PartnersView'),
  logs: () => import('./LogsView'),
};

// تمهيد مسبق أثناء الخمول حتى لا يظهر هيكل الانتظار عند أول تنقّل
const idlePreloadQueue: ViewType[] = [
  'inventory',
  'sales',
  'rentals',
  'caisse',
  'expenses',
  'credits',
  'tailoring',
  'partners',
  'logs',
];

/** تمييز قسم واحد على أنه الأولوية (يُستدعى من مخطط التنقّل والجداول الزمنية) */
export const preloadView = (view: ViewType): void => {
  try {
    const loader = loaders[view];
    if (loader) void loader();
  } catch {
    /* تجاهل: التحميل المسبق تحسيني فقط ولا يجب أن يُسقِط التطبيق */
  }
};

/** تمييز الأقسام غير الظاهرة واحداً بعد الآخر في أوقات الخمول (Progressive Preload) */
export const preloadIdleViews = (): void => {
  if (typeof window === 'undefined' || idlePreloadQueue.length === 0) return;
  const schedule = (cb: () => void) => {
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === 'function') ric(cb, { timeout: 4000 });
    else window.setTimeout(cb, 1200);
  };

  const runNext = () => {
    const next = idlePreloadQueue.shift();
    if (!next) return;
    loaders[next]?.();
    // فاصل زمني بين الحزم حتى لا نزاحم الشبكة/الخيط الرئيسي
    schedule(() => window.setTimeout(runNext, 600));
  };

  schedule(runNext);
};

/** الوصول إلى مكوّن قسم — يُعيد undefined للنواع القديمة غير المُنفَّذة */
export const lazyView = (view: ViewType): AnyView | undefined => LazyViews[view];

/** نسخ Lazy واحدة لكل قسم (تُنشأ مرة واحدة فقط على مستوى الوحدة) */
export const LazyViews: Partial<Record<ViewType, AnyView>> = {
  dashboard: React.lazy(() =>
    import('./DashboardView').then((m) => ({ default: m.DashboardView }))
  ),
  rentals: React.lazy(() =>
    import('./RentalsView').then((m) => ({ default: m.RentalsView }))
  ),
  inventory: React.lazy(() =>
    import('./InventoryView').then((m) => ({ default: m.InventoryView }))
  ),
  sales: React.lazy(() =>
    import('./SalesPOSView').then((m) => ({ default: m.SalesPOSView }))
  ),
  tailoring: React.lazy(() =>
    import('./TailoringView').then((m) => ({ default: m.TailoringView }))
  ),
  expenses: React.lazy(() =>
    import('./ExpensesView').then((m) => ({ default: m.ExpensesView }))
  ),
  credits: React.lazy(() =>
    import('./CreditsView').then((m) => ({ default: m.CreditsView }))
  ),
  caisse: React.lazy(() => import('./CaisseView').then((m) => ({ default: m.CaisseView }))),
  partners: React.lazy(() =>
    import('./PartnersView').then((m) => ({ default: m.PartnersView }))
  ),
  logs: React.lazy(() => import('./LogsView').then((m) => ({ default: m.LogsView }))),
};

export { idlePreloadQueue };
