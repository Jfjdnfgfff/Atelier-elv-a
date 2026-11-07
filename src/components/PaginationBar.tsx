import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationBarProps {
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  start: number;
  end: number;
  numbers: Array<number | '…'>;
  pageSizeOptions?: readonly number[];
  /** اسم العنصر المفرد بالعربية: "قطعة" / "سجل" / "عملية" */
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
  compact?: boolean;
}

/**
 * شريط تقسيم الصفحات الموحّد (RTL): يعرض «عرض 1–24 من 312 قطعة» + أرقام الصفحات
 * + السابق/التالي + اختيار حجم الصفحة. يستخدم في المخزون وأي قائمة كبيرة أخرى.
 */
export const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  pages,
  pageSize,
  total,
  start,
  end,
  numbers,
  pageSizeOptions,
  itemLabel = 'عنصر',
  onPageChange,
  onPageSizeChange,
  className = '',
  compact = false
}) => {
  if (total === 0) return null;

  const navBtn =
    'w-8 h-8 flex items-center justify-center rounded-xl border text-slate-600 border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95';

  return (
    <div
      dir="rtl"
      className={`flex flex-wrap items-center justify-between gap-2 bg-white/90 border border-slate-200 rounded-2xl px-3 py-2 shadow-2xs ${className}`}
    >
      <span className="text-[11px] font-bold text-slate-600">
        عرض <span className="text-slate-900 font-black">{start.toLocaleString('en-US')}</span>–
        <span className="text-slate-900 font-black">{end.toLocaleString('en-US')}</span> من{' '}
        <span className="text-slate-900 font-black">{total.toLocaleString('en-US')}</span> {itemLabel}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={navBtn}
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          title="الصفحة الأولى"
          aria-label="الصفحة الأولى"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={navBtn}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          title="الصفحة السابقة"
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {!compact &&
          numbers.map((entry, index) =>
            entry === '…' ? (
              <span key={`gap-${index}`} className="px-1 text-slate-400 text-xs font-bold select-none">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={`min-w-8 h-8 px-2 rounded-xl text-[11px] font-black border transition-all active:scale-95 ${
                  entry === page
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {entry}
              </button>
            )
          )}

        {compact && (
          <span className="text-[11px] font-black text-slate-800 px-1">
            {page} / {pages}
          </span>
        )}

        <button
          type="button"
          className={navBtn}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          title="الصفحة التالية"
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={navBtn}
          onClick={() => onPageChange(pages)}
          disabled={page >= pages}
          title="الصفحة الأخيرة"
          aria-label="الصفحة الأخيرة"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
      </div>

      {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 0 && (
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <span>في الصفحة</span>
          <select
            value={pageSize}
            onChange={event => onPageSizeChange(Number(event.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            aria-label="عدد العناصر في الصفحة"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};
