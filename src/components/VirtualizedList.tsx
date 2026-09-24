import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey: (item: T, index: number) => string | number;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  emptyMessage?: string;
  maxHeightClass?: string;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  getItemKey,
  estimateSize = 120,
  overscan = 5,
  className = '',
  emptyMessage = 'لا توجد بيانات مطابقة.',
  maxHeightClass = 'h-[65vh] sm:h-[72vh]'
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        {emptyMessage}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`w-full overflow-y-auto custom-scrollbar p-1 ${maxHeightClass} ${className}`}
      style={{ contain: 'layout paint' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          const key = getItemKey(item, virtualRow.index);

          return (
            <div
              key={key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="pb-3">
                {renderItem(item, virtualRow.index)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
