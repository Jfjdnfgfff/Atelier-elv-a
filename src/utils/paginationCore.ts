/**
 * حسابات تقسيم الصفحات (Pagination)
 * ----------------------------------
 * دوال نقية تُستخدم من `usePagination` (React) ومن الاختبارات، وتدعم العربية/RTL
 * بترقيم الصفحات من 1 وليس من 0، مع تثبيت الصفحة عند تغيير حجم الصفحة أو الفلاتر.
 */

export const DEFAULT_PAGE_SIZE = 12;
export const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;

export function pageCount(total: number, pageSize: number): number {
  const safeTotal = Math.max(0, Math.floor(total || 0));
  const safeSize = Math.max(1, Math.floor(pageSize || 1));
  return Math.max(1, Math.ceil(safeTotal / safeSize));
}

/** تثبيت رقم الصفحة داخل الحدود المسموحة */
export function clampPage(page: number, total: number, pageSize: number): number {
  const max = pageCount(total, pageSize);
  const safe = Math.floor(Number.isFinite(page) ? page : 1);
  return Math.min(Math.max(safe, 1), max);
}

export interface PageMeta {
  page: number;
  pageSize: number;
  pages: number;
  total: number;
  /** رقم أول عنصر معروض (1-based) — 0 عند عدم وجود عناصر */
  start: number;
  /** رقم آخر عنصر معروض (1-based) — 0 عند عدم وجود عناصر */
  end: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface PageSlice<T> extends PageMeta {
  items: T[];
}

/** حسابات الصفحة دون عناصر (للعرض في شريط التنقل) */
export function pageMeta(total: number, page: number, pageSize: number): PageMeta {
  const safeTotal = Math.max(0, Math.floor(total || 0));
  const safeSize = Math.max(1, Math.floor(pageSize || DEFAULT_PAGE_SIZE));
  const pages = pageCount(safeTotal, safeSize);
  const current = clampPage(page, safeTotal, safeSize);
  const offset = (current - 1) * safeSize;

  return {
    page: current,
    pageSize: safeSize,
    pages,
    total: safeTotal,
    start: safeTotal === 0 ? 0 : offset + 1,
    end: safeTotal === 0 ? 0 : Math.min(safeTotal, offset + safeSize),
    hasPrev: current > 1,
    hasNext: current < pages
  };
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): PageSlice<T> {
  const safeItems = Array.isArray(items) ? items : [];
  const meta = pageMeta(safeItems.length, page, pageSize);
  const offset = (meta.page - 1) * meta.pageSize;
  return {
    ...meta,
    items: safeItems.slice(offset, offset + meta.pageSize)
  };
}

/** أرقام الصفحات المعروضة في الشريط (مع نقاط اختصار) */
export function pageNumbers(current: number, pages: number, windowSize: number = 1): Array<number | '…'> {
  const safePages = Math.max(1, Math.floor(pages || 1));
  const safeCurrent = Math.min(Math.max(1, Math.floor(current || 1)), safePages);
  const numbers = new Set<number>([1, safePages]);

  for (let offset = -windowSize; offset <= windowSize; offset++) {
    const page = safeCurrent + offset;
    if (page >= 1 && page <= safePages) numbers.add(page);
  }

  const sorted = Array.from(numbers).sort((a, b) => a - b);
  const result: Array<number | '…'> = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push('…');
    result.push(page);
    previous = page;
  }
  return result;
}
