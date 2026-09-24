import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ClothItem, SaleItem } from '../types';
import { getListImage, openFullImagePreview } from '../utils/imageUtils';
import { Package, ZoomIn } from 'lucide-react';

interface VirtualizedPosGridProps {
  clothes: ClothItem[];
  cart: SaleItem[];
  getItemStock1: (item: ClothItem) => number;
  getItemStock2: (item: ClothItem) => number;
  addToCart: (item: ClothItem, stockSource?: 'stock1' | 'stock2') => void;
  imageDisplayMode: 'fill' | 'cover' | 'contain';
  onOpenPreview: (url: string, title: string) => void;
}

export const VirtualizedPosGrid: React.FC<VirtualizedPosGridProps> = ({
  clothes,
  cart,
  getItemStock1,
  getItemStock2,
  addToCart,
  imageDisplayMode,
  onOpenPreview
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columnsCount, setColumnsCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640 ? 2 : 3;
    }
    return 3;
  });

  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      setColumnsCount(w < 640 ? 2 : 3);
    };
    updateCols();
    window.addEventListener('resize', updateCols, { passive: true });
    return () => window.removeEventListener('resize', updateCols);
  }, []);

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
    estimateSize: () => 360,
    overscan: 3,
  });

  if (clothes.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        لا توجد منتجات قابلة للبيع تضاهي البحث.
      </div>
    );
  }

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div 
      ref={parentRef} 
      className="w-full h-[540px] max-h-[70vh] overflow-y-auto custom-scrollbar p-1"
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
                className={`grid gap-3 pb-3 ${
                  columnsCount === 3 ? 'grid-cols-3' : 'grid-cols-2'
                }`}
              >
                {rowItems.map((item) => {
                  const s1 = getItemStock1(item);
                  const s2 = getItemStock2(item);
                  const totalStock = s1 + s2;
                  const inCartCount = cart.filter(ci => ci.itemId === item.id).reduce((s, ci) => s + ci.qty, 0);
                  const imgUrl = getListImage(item);

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl overflow-hidden border transition-all duration-200 select-none relative shadow-2xs hover:shadow-xs flex flex-col justify-between group ${
                        inCartCount > 0 ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      {/* Photo Container */}
                      <div 
                        onClick={() => addToCart(item)}
                        className="relative aspect-[3/4] bg-slate-900/5 overflow-hidden flex items-center justify-center cursor-pointer group"
                      >
                        {imgUrl ? (
                          <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-slate-100">
                            <img
                              src={imgUrl}
                              alt={item.name}
                              decoding="async"
                              className={`relative z-1 w-full h-full transition-transform duration-300 group-hover:scale-103 select-none ${
                                imageDisplayMode === 'fill'
                                  ? 'object-fill'
                                  : imageDisplayMode === 'cover'
                                  ? 'object-cover object-top'
                                  : 'object-contain'
                              }`}
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <Package className="w-10 h-10 text-slate-300 group-hover:text-slate-500 transition-colors" />
                          </div>
                        )}

                        {/* Quantity Badge in Cart */}
                        {inCartCount > 0 && (
                          <span className="absolute top-2 left-2 bg-slate-900 text-white text-[11px] font-bold font-mono w-6 h-6 rounded-full flex items-center justify-center shadow-xs">
                            {inCartCount}
                          </span>
                        )}

                        {/* Stock Tag on Top Right */}
                        <span className="absolute top-2 right-2 text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-slate-900/90 text-white">
                          {totalStock} بالمخزنين
                        </span>

                        {/* Quick Image Zoom button */}
                        {imgUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openFullImagePreview(item, onOpenPreview);
                            }}
                            className="absolute bottom-1.5 left-1.5 bg-slate-900/80 hover:bg-slate-900 text-white p-1 rounded-lg text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-2xs"
                            title="تكبير الصورة"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Details */}
                      <div className="p-2.5 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <span className="text-[10px] text-slate-400 font-normal block truncate">{item.category}</span>
                          <h4 className="font-bold text-slate-900 text-xs mt-0.5 line-clamp-2 leading-tight min-h-[28px]">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-normal mt-1 flex-wrap">
                            <span>مقاس: {item.sizes && item.sizes.length > 0 ? item.sizes.join(', ') : (item.size || '38')}</span>
                            {(item.colors && item.colors.length > 0 ? item.colors.join(', ') : item.color) && (
                              <span>• {item.colors && item.colors.length > 0 ? item.colors.join(', ') : item.color}</span>
                            )}
                          </div>
                        </div>

                        {/* Stock 1 & Stock 2 badges with 1-click add */}
                        <div className="pt-1.5 border-t border-slate-100 space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                            <span className="text-slate-400 font-medium">السعر:</span>
                            <span className="text-slate-900 font-bold font-mono">{item.sellPrice.toLocaleString()} دج</span>
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => addToCart(item, 'stock1')}
                              disabled={s1 <= 0}
                              className="py-1 px-1.5 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 text-slate-700 border border-slate-200/80 rounded-lg font-medium flex items-center justify-between active:scale-95 transition-all"
                              title="إضافة من المخزون 1"
                            >
                              <span>مخزن 1:</span>
                              <span className="font-bold font-mono">{s1}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => addToCart(item, 'stock2')}
                              disabled={s2 <= 0}
                              className="py-1 px-1.5 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 text-slate-700 border border-slate-200/80 rounded-lg font-medium flex items-center justify-between active:scale-95 transition-all"
                              title="إضافة من المخزون 2"
                            >
                              <span>مخزن 2:</span>
                              <span className="font-bold font-mono">{s2}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
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
