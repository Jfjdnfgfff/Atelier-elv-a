import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  pageMeta,
  pageNumbers,
  paginate,
  type PageSlice
} from '../utils/paginationCore';

export interface UsePaginationOptions {
  /** العدد الإجمالي للعناصر بعد الفلترة */
  total: number;
  /** حجم الصفحة الابتدائي */
  initialPageSize?: number;
  /**
   * مفتاح إعادة الضبط: عند تغييره (بحث/فلتر/تبويب) تعود الصفحة إلى 1.
   * يُمرَّر كنص لتجنّب مقارنة المراجع.
   */
  resetKey?: string;
  /** حجم الصفحة يُحفظ في التخزين المحلي تحت هذا المفتاح */
  storageKey?: string;
}

export interface UsePaginationResult<T> {
  page: number;
  pageSize: number;
  pages: number;
  total: number;
  start: number;
  end: number;
  hasPrev: boolean;
  hasNext: boolean;
  numbers: Array<number | '…'>;
  pageSizeOptions: readonly number[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;
  /** تقطيع مصفوفة حسب الصفحة الحالية */
  slice: (items: T[]) => PageSlice<T>;
}

function readStoredPageSize(storageKey: string, fallback: number): number {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? Number(raw) : NaN;
    if (PAGE_SIZE_OPTIONS.includes(parsed as any)) return parsed;
  } catch {
    // تجاهل
  }
  return fallback;
}

export function usePagination<T = unknown>({
  total,
  initialPageSize = DEFAULT_PAGE_SIZE,
  resetKey = '',
  storageKey
}: UsePaginationOptions): UsePaginationResult<T> {
  const [pageSize, setPageSizeState] = useState<number>(() =>
    storageKey ? readStoredPageSize(storageKey, initialPageSize) : initialPageSize
  );
  const [page, setPageState] = useState(1);
  const resetKeyRef = useRef(resetKey);

  const meta = useMemo(() => pageMeta(total, page, pageSize), [total, page, pageSize]);

  // عند تغيّر مفتاح الفلترة/البحث نعود للصفحة الأولى
  useEffect(() => {
    if (resetKeyRef.current === resetKey) return;
    resetKeyRef.current = resetKey;
    setPageState(1);
  }, [resetKey]);

  // تثبيت الصفحة داخل الحدود إذا تغيّر العدد الإجمالي أو حجم الصفحة
  useEffect(() => {
    setPageState(current => (current === meta.page ? current : meta.page));
  }, [meta.page]);

  const setPage = useCallback((next: number) => {
    if (!Number.isFinite(next)) return;
    setPageState(Math.max(1, Math.floor(next)));
  }, []);

  const setPageSize = useCallback((size: number) => {
    const safe = Math.max(1, Math.floor(size));
    setPageSizeState(safe);
    setPageState(1);
    if (storageKey && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(storageKey, String(safe));
      } catch {
        // تجاهل الحصة
      }
    }
  }, [storageKey]);

  return {
    page: meta.page,
    pageSize: meta.pageSize,
    pages: meta.pages,
    total: meta.total,
    start: meta.start,
    end: meta.end,
    hasPrev: meta.hasPrev,
    hasNext: meta.hasNext,
    numbers: pageNumbers(meta.page, meta.pages),
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    setPage,
    setPageSize,
    next: () => setPageState(meta.page + 1),
    prev: () => setPageState(Math.max(1, meta.page - 1)),
    first: () => setPageState(1),
    last: () => setPageState(meta.pages),
    slice: (items: T[]) => paginate(items, meta.page, meta.pageSize)
  };
}
