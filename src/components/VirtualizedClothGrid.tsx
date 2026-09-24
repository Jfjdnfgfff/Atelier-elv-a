import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ClothItem } from '../types';
import { ClothCard } from './ClothCard';

interface VirtualizedClothGridProps {
  clothes: ClothItem[];
  highlightedBarcode?: string;
  getItemStock1: (item: ClothItem) => number;
  getItemStock2: (item: ClothItem) => number;
  onOpenVariantsModal: (item: ClothItem) => void;
  onOpenQuickTransferModal: (item: ClothItem) => void;
  onOpenEditModal: (item: ClothItem) => void;
  onOpenDeleteModal: (id: string) => void;
}

export const VirtualizedClothGrid: React.FC<VirtualizedClothGridProps> = ({
  clothes,
  highlightedBarcode,
  getItemStock1,
  getItemStock2,
  onOpenVariantsModal,
  onOpenQuickTransferModal,
  onOpenEditModal,
  onOpenDeleteModal
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columnsCount, setColumnsCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      if (w < 640) return 1;
      if (w < 1024) return 2;
    }
    return 3;
  });

  // Responsive column detection
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      if (w < 640) setColumnsCount(1);
      else if (w < 1024) setColumnsCount(2);
      else setColumnsCount(3);
    };
    updateCols();
    window.addEventListener('resize', updateCols, { passive: true });
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  // Group items into row chunks based on active columns count
  const rows = useMemo(() => {
    const chunked: ClothItem[][] = [];
    for (let i = 0; i < clothes.length; i += columnsCount) {
      chunked.push(clothes.slice(i, i + columnsCount));
    }
    return chunked;
  }, [clothes, columnsCount]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400, // Estimated height of 1 row of cards
    overscan: 2,
  });

  // Scroll to item when barcode is highlighted
  useEffect(() => {
    if (!highlightedBarcode) return;
    const cleanBar = highlightedBarcode.trim().toLowerCase();
    const idx = clothes.findIndex(c => c.barcode.toLowerCase() === cleanBar);
    if (idx !== -1) {
      const rowIndex = Math.floor(idx / columnsCount);
      rowVirtualizer.scrollToIndex(rowIndex, { align: 'center' });
    }
  }, [highlightedBarcode, clothes, columnsCount, rowVirtualizer]);

  if (clothes.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        لا توجد نتائج مطابقة للبحث أو الفلتر المحدد.
      </div>
    );
  }

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div 
      ref={parentRef} 
      className="w-full h-[calc(100vh-220px)] min-h-[400px] overflow-y-auto custom-scrollbar p-1"
      style={{ contain: 'layout paint' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowItems = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div 
                className={`grid gap-4 pb-4 ${
                  columnsCount === 3 
                    ? 'grid-cols-3' 
                    : columnsCount === 2 
                    ? 'grid-cols-2' 
                    : 'grid-cols-1'
                }`}
              >
                {rowItems.map((item) => {
                  const s1 = getItemStock1(item);
                  const s2 = getItemStock2(item);
                  const totalStock = s1 + s2;
                  const availableStock = Math.max(0, totalStock - (item.rentedCount || 0));

                  const itemSizesList = item.sizes && item.sizes.length > 0
                    ? item.sizes
                    : (item.size ? item.size.split(/[,،+/]/).map(s => s.trim()).filter(Boolean) : []);

                  const itemColorsList = item.colors && item.colors.length > 0
                    ? item.colors
                    : (item.color ? item.color.split(/[,،+/]/).map(c => c.trim()).filter(Boolean) : []);

                  return (
                    <ClothCard
                      key={item.id}
                      item={item}
                      s1={s1}
                      s2={s2}
                      totalStock={totalStock}
                      availableStock={availableStock}
                      itemSizesList={itemSizesList}
                      itemColorsList={itemColorsList}
                      onOpenVariantsModal={onOpenVariantsModal}
                      onOpenQuickTransferModal={onOpenQuickTransferModal}
                      onOpenEditModal={onOpenEditModal}
                      onOpenDeleteModal={onOpenDeleteModal}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
