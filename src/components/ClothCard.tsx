import React, { memo } from 'react';
import { ClothItem } from '../types';
import { getListImage } from '../utils/imageUtils';
import { Shirt, Tag, Sparkles, Store, Warehouse, ArrowLeftRight, Pencil, Trash2 } from 'lucide-react';

interface ClothCardProps {
  item: ClothItem;
  s1: number;
  s2: number;
  totalStock: number;
  availableStock: number;
  itemSizesList: string[];
  itemColorsList: string[];
  onOpenVariantsModal: (item: ClothItem) => void;
  onOpenQuickTransferModal: (item: ClothItem) => void;
  onOpenEditModal: (item: ClothItem) => void;
  onOpenDeleteModal: (id: string) => void;
}

export const ClothCard = memo<ClothCardProps>(({
  item,
  s1,
  s2,
  totalStock,
  availableStock,
  itemSizesList,
  onOpenVariantsModal,
  onOpenQuickTransferModal,
  onOpenEditModal,
  onOpenDeleteModal
}) => {
  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-2xs hover:shadow-xs transition-colors duration-150 flex flex-col justify-between group cv-auto h-full"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '380px' }}
    >
      {/* Product Image Box */}
      <div 
        onClick={() => onOpenVariantsModal(item)}
        className="relative bg-slate-900/5 overflow-hidden cursor-pointer flex items-center justify-center group w-full aspect-[3/4]"
        title="اضغط لعرض الألوان والمقاسات (Déclinaisons)"
      >
        {getListImage(item) ? (
          <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-slate-100">
            <img
              src={getListImage(item)}
              alt={item.name}
              decoding="async"
              loading="lazy"
              className="relative z-1 w-full h-full object-fill transition-transform duration-200 group-hover:scale-102 select-none"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-2 p-4">
            <Shirt className="w-10 h-10 text-slate-300" />
            <span className="text-xs font-bold text-slate-400">بدون صورة</span>
          </div>
        )}

        {/* Purpose Badge on Top Left - No backdrop-blur for maximum scroll FPS */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
          {item.purpose === 'both' && (
            <span className="bg-slate-900/90 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-lg shadow-2xs">
              بيع + كراء
            </span>
          )}
          {item.purpose === 'rent' && (
            <span className="bg-slate-900/90 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-lg shadow-2xs flex items-center gap-1">
              <Shirt className="w-3 h-3" />
              <span>كراء</span>
            </span>
          )}
          {item.purpose === 'sell' && (
            <span className="bg-slate-900/90 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-lg shadow-2xs flex items-center gap-1">
              <Tag className="w-3 h-3" />
              <span>بيع</span>
            </span>
          )}
        </div>

        {/* Category Badge on Top Right */}
        <div className="absolute top-2.5 right-2.5">
          <span className="bg-slate-900/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-lg">
            {item.category}
          </span>
        </div>

        {/* Colors & Sizes Badge Prompt on Image */}
        <div className="absolute bottom-2.5 left-2.5 bg-slate-900/90 hover:bg-slate-900 text-white text-[10px] font-medium px-2 py-0.5 rounded-lg shadow-2xs flex items-center gap-1 transition-colors">
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span>الألوان والمقاسات ({itemSizesList.length || 1})</span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start gap-2">
            <h3 
              onClick={() => onOpenVariantsModal(item)}
              className="font-black text-slate-900 text-sm hover:text-indigo-600 transition-colors cursor-pointer line-clamp-1"
            >
              {item.name}
            </h3>
            {item.barcode && (
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                #{item.barcode}
              </span>
            )}
          </div>

          {/* Location stock distribution pills */}
          <div className="flex items-center justify-between text-xs font-bold mt-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-slate-800 flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-indigo-600" />
              المحل: <span className="text-indigo-900 font-mono">{s1}</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-800 flex items-center gap-1">
              <Warehouse className="w-3.5 h-3.5 text-slate-500" />
              المستودع: <span className="text-slate-900 font-mono">{s2}</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-indigo-950 font-mono font-black">
              = {totalStock}
            </span>
          </div>

          {/* Pricing Info */}
          <div className="flex items-center justify-between text-xs pt-1">
            {(item.purpose === 'rent' || item.purpose === 'both') && (
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">الكراء:</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {(item.rentPrice || 0).toLocaleString()} دج
                </span>
              </div>
            )}
            {(item.purpose === 'sell' || item.purpose === 'both') && (
              <div className="text-left">
                <span className="text-[10px] text-slate-400 block font-bold">البيع:</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {(item.sellPrice || 0).toLocaleString()} دج
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card Actions */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
          <button
            onClick={() => onOpenQuickTransferModal(item)}
            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
            title="تحويل بين المحل والمستودع"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
            <span>تحويل</span>
          </button>

          <button
            onClick={() => onOpenEditModal(item)}
            className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl transition-colors"
            title="تعديل القطعة"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onOpenDeleteModal(item.id)}
            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
            title="حذف القطعة (نقل لسلة المهملات)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.item.updatedAt === next.item.updatedAt &&
    prev.item.imageUrl === next.item.imageUrl &&
    prev.item.thumbUrl === next.item.thumbUrl &&
    prev.item.stock === next.item.stock &&
    prev.s1 === next.s1 &&
    prev.s2 === next.s2 &&
    prev.totalStock === next.totalStock &&
    prev.availableStock === next.availableStock
  );
});

ClothCard.displayName = 'ClothCard';
