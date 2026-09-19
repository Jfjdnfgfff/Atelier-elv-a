import React, { useState, useMemo } from 'react';
import { 
  ClothItem, 
  ClothVariant 
} from '../types';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Minus, 
  Check, 
  Trash2, 
  Ruler, 
  Palette, 
  ZoomIn, 
  Shirt, 
  ShoppingBag, 
  Sparkles,
  Barcode,
  ArrowUpDown
} from 'lucide-react';
import { getColorHex } from './InventoryView';

interface ProductVariantsModalProps {
  item: ClothItem;
  onClose: () => void;
  onUpdateItem: (id: string, updatedFields: Partial<ClothItem>) => void;
  onOpenFullImage?: (url: string, title: string) => void;
  onQuickRent?: (item: ClothItem, variant: ClothVariant) => void;
  onQuickSale?: (item: ClothItem, variant: ClothVariant) => void;
}

export const ProductVariantsModal: React.FC<ProductVariantsModalProps> = ({
  item,
  onClose,
  onUpdateItem,
  onOpenFullImage,
  onQuickRent,
  onQuickSale
}) => {
  // Parse initial variants or generate dynamically from sizes & colors
  const initialVariants = useMemo<ClothVariant[]>(() => {
    if (item.variants && item.variants.length > 0) {
      return item.variants;
    }

    // Extract sizes
    let rawSizes: string[] = [];
    if (item.sizes && item.sizes.length > 0) {
      rawSizes = item.sizes;
    } else if (item.size) {
      rawSizes = item.size.split(/[,،/]+/).map(s => s.trim()).filter(Boolean);
    }
    if (rawSizes.length === 0) {
      rawSizes = ['38', '40', '42', '44'];
    }

    // Extract colors
    let rawColors: string[] = [];
    if (item.colors && item.colors.length > 0) {
      rawColors = item.colors;
    } else if (item.color) {
      rawColors = item.color.split(/[,،/]+/).map(c => c.trim()).filter(Boolean);
    }
    if (rawColors.length === 0) {
      rawColors = ['أسود'];
    }

    // Base barcode or number
    let baseCodeNum = parseInt(item.barcode.replace(/\D/g, ''), 10);
    if (isNaN(baseCodeNum) || baseCodeNum <= 0) {
      baseCodeNum = 3918;
    }

    // Calculate initial distribution of stock
    const totalCount = rawSizes.length * rawColors.length;
    const itemStock1 = item.stock1 !== undefined ? item.stock1 : (item.stock || 0);
    const itemStock2 = item.stock2 !== undefined ? item.stock2 : 0;
    
    // Per variant stock fallback (e.g. 4 as seen in photo or divided stock)
    const perVarStock1 = Math.max(1, Math.round(itemStock1 / totalCount)) || 2;
    const perVarStock2 = Math.max(0, Math.round(itemStock2 / totalCount)) || 2;

    const generated: ClothVariant[] = [];
    let idx = 0;

    // We generate sizes, and if numeric, sort descending (44, 42, 40, 38) as shown in the screenshot
    const sortedSizes = [...rawSizes].sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      return a.localeCompare(b);
    });

    sortedSizes.forEach((sz) => {
      rawColors.forEach((col) => {
        const code = (baseCodeNum + (sortedSizes.length - 1 - idx)).toString();
        generated.push({
          id: `var_${item.id}_${sz}_${col}_${idx}`,
          code: code,
          size: sz,
          color: col,
          stock1: perVarStock1,
          stock2: perVarStock2,
          stock: perVarStock1 + perVarStock2,
          price: item.sellPrice || item.rentPrice || 7200,
          rentPrice: item.rentPrice || undefined,
          imageUrl: item.imageUrl
        });
        idx++;
      });
    });

    return generated;
  }, [item]);

  const [variants, setVariants] = useState<ClothVariant[]>(initialVariants);
  const [selectedColorFilter, setSelectedColorFilter] = useState<string>('all');
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(null);
  const [isAddingNewVariant, setIsAddingNewVariant] = useState(false);

  // New Variant Form State
  const [newSize, setNewSize] = useState('46');
  const [newColor, setNewColor] = useState(item.colors?.[0] || item.color || 'أسود');
  const [newCode, setNewCode] = useState('');
  const [newStock1, setNewStock1] = useState('2');
  const [newStock2, setNewStock2] = useState('2');
  const [newPrice, setNewPrice] = useState((item.sellPrice || item.rentPrice || 7200).toString());

  // Distinct available colors across variants
  const distinctColors = useMemo(() => {
    const set = new Set<string>();
    variants.forEach(v => {
      if (v.color) set.add(v.color.trim());
    });
    return Array.from(set);
  }, [variants]);

  // Filtered variants
  const displayedVariants = useMemo(() => {
    if (selectedColorFilter === 'all') return variants;
    return variants.filter(v => v.color.trim() === selectedColorFilter.trim());
  }, [variants, selectedColorFilter]);

  // Aggregate totals
  const totalStock1 = variants.reduce((sum, v) => sum + (v.stock1 || 0), 0);
  const totalStock2 = variants.reduce((sum, v) => sum + (v.stock2 || 0), 0);
  const grandTotalStock = totalStock1 + totalStock2;

  // Save changes to parent item
  const handleSaveVariants = (updatedList: ClothVariant[]) => {
    setVariants(updatedList);
    const s1 = updatedList.reduce((sum, v) => sum + (v.stock1 || 0), 0);
    const s2 = updatedList.reduce((sum, v) => sum + (v.stock2 || 0), 0);
    
    // Extract unique sizes and colors
    const uniqueSizes = Array.from(new Set(updatedList.map(v => v.size.trim())));
    const uniqueColors = Array.from(new Set(updatedList.map(v => v.color.trim())));

    onUpdateItem(item.id, {
      variants: updatedList,
      stock1: s1,
      stock2: s2,
      stock: s1 + s2,
      sizes: uniqueSizes,
      size: uniqueSizes.join('، '),
      colors: uniqueColors,
      color: uniqueColors.join('، ')
    });
  };

  // Quick adjust stock for a variant
  const handleAdjustStock = (variantId: string, delta1: number, delta2: number) => {
    const updated = variants.map(v => {
      if (v.id === variantId) {
        const next1 = Math.max(0, (v.stock1 || 0) + delta1);
        const next2 = Math.max(0, (v.stock2 || 0) + delta2);
        return {
          ...v,
          stock1: next1,
          stock2: next2,
          stock: next1 + next2
        };
      }
      return v;
    });
    handleSaveVariants(updated);
  };

  // Update a single variant's fields
  const handleUpdateVariant = (variantId: string, partial: Partial<ClothVariant>) => {
    const updated = variants.map(v => {
      if (v.id === variantId) {
        const next = { ...v, ...partial };
        if (partial.stock1 !== undefined || partial.stock2 !== undefined) {
          next.stock = (next.stock1 || 0) + (next.stock2 || 0);
        }
        return next;
      }
      return v;
    });
    handleSaveVariants(updated);
  };

  // Delete variant
  const handleDeleteVariant = (variantId: string) => {
    if (variants.length <= 1) {
      alert('لا يمكن حذف آخر مقاس للمنتج!');
      return;
    }
    const updated = variants.filter(v => v.id !== variantId);
    handleSaveVariants(updated);
  };

  // Add new variant
  const handleAddNewVariantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSize.trim()) return;

    const s1 = Math.max(0, parseInt(newStock1, 10) || 0);
    const s2 = Math.max(0, parseInt(newStock2, 10) || 0);
    const pr = parseFloat(newPrice) || item.sellPrice || item.rentPrice || 7200;

    const generatedCode = newCode.trim() || `${parseInt(item.barcode.replace(/\D/g, '') || '3900', 10) + variants.length + 1}`;

    const newVar: ClothVariant = {
      id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      code: generatedCode,
      size: newSize.trim(),
      color: newColor.trim() || 'أسود',
      stock1: s1,
      stock2: s2,
      stock: s1 + s2,
      price: pr,
      rentPrice: item.rentPrice || undefined,
      imageUrl: item.imageUrl
    };

    const updated = [newVar, ...variants];
    handleSaveVariants(updated);
    setIsAddingNewVariant(false);
    setNewSize('');
    setNewCode('');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header (Top Navigation & Info) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white sticky top-0 z-10 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div 
                onClick={() => item.imageUrl && onOpenFullImage?.(item.imageUrl, item.name)}
                className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer group"
                title="اضغط لتكبير الصورة كاملة"
              >
                {item.imageUrl ? (
                  <>
                    <img 
                      src={item.imageUrl} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <ZoomIn className="w-4 h-4" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">👗</div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-black text-slate-900 text-sm sm:text-base truncate leading-tight">
                    {item.name}
                  </h3>
                  {item.barcode && (
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                      #{item.barcode}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                  <span>الألوان والمقاسات المتوفرة (Déclinaisons)</span>
                  <span>•</span>
                  <span className="font-bold text-blue-600">{grandTotalStock} قطعة متوفرة</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Color Selector Tabs (الوان) */}
          {distinctColors.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-blue-600" />
                <span>اللون:</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedColorFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  selectedColorFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                جميع الألوان ({variants.length})
              </button>

              {distinctColors.map(col => {
                const isSelected = selectedColorFilter === col;
                const hex = getColorHex(col);
                const count = variants.filter(v => v.color.trim() === col.trim()).length;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setSelectedColorFilter(isSelected ? 'all' : col)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-2xs" 
                      style={{ backgroundColor: hex }} 
                    />
                    <span>{col}</span>
                    <span className={`text-[10px] px-1 rounded-md ${isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Summary Bar */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-xs">
            <div className="flex items-center justify-between px-1">
              <span className="text-slate-500 font-medium">المحل (صالة العرض):</span>
              <span className="font-black text-blue-700 font-mono">{totalStock1} قطع</span>
            </div>
            <div className="flex items-center justify-between px-1 border-r border-slate-200 pr-2">
              <span className="text-slate-500 font-medium">المستودع (التخزين):</span>
              <span className="font-black text-blue-900 font-mono">{totalStock2} قطع</span>
            </div>
          </div>
        </div>

        {/* Variants List (Matching the uploaded image design exactly!) */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 sm:p-3 space-y-1">
          {displayedVariants.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <span className="text-4xl">👗</span>
              <p className="font-bold text-sm text-slate-600">لا توجد مقاسات مسجلة لهذا اللون</p>
              <p className="text-xs text-slate-400">يمكنك إضافة مقاس جديد عبر الزر أدناه</p>
            </div>
          ) : (
            displayedVariants.map((variant) => {
              const isExpanded = expandedVariantId === variant.id;
              const displayPrice = variant.price || item.sellPrice || item.rentPrice || 7200;
              const colorHex = getColorHex(variant.color);

              return (
                <div 
                  key={variant.id}
                  className="transition-colors rounded-2xl overflow-hidden hover:bg-slate-50/80"
                >
                  {/* Row Item (Identical style to the user's reference photo) */}
                  <div 
                    onClick={() => setExpandedVariantId(isExpanded ? null : variant.id)}
                    className="flex items-center justify-between p-3 cursor-pointer group select-none gap-3"
                  >
                    {/* Left: Product Thumbnail */}
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80 shadow-2xs">
                      {variant.imageUrl || item.imageUrl ? (
                        <img 
                          src={variant.imageUrl || item.imageUrl} 
                          alt={`${item.name} - ${variant.size}`} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">👗</div>
                      )}
                      {/* Color dot indicator in thumbnail corner */}
                      <span 
                        className="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-white shadow-xs"
                        style={{ backgroundColor: colorHex }}
                        title={variant.color}
                      />
                    </div>

                    {/* Middle: Reference Code, Big Size (لطاي), and Stock/Price Subtitle */}
                    <div className="flex-1 min-w-0 space-y-0.5" dir="ltr">
                      {/* Reference code (e.g. #3921) */}
                      <div className="text-xs sm:text-sm font-semibold text-slate-700 tracking-tight">
                        #{variant.code || (item.barcode ? item.barcode : '3921')}
                      </div>

                      {/* Size (لطاي / Taille) - Big bold text */}
                      <div className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                        {variant.size}
                      </div>

                      {/* Subtitle: "4 en stock • 7,200.00 د.ج" */}
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-700">
                          {variant.stock} en stock
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-bold text-slate-800">
                          {displayPrice.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ج
                        </span>

                        {/* Optional color tag */}
                        {distinctColors.length > 1 && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] text-slate-500 font-normal">
                              {variant.color}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Chevron Arrow (>) */}
                    <div className="text-slate-300 group-hover:text-blue-600 transition-colors pl-1">
                      {isExpanded ? (
                        <ChevronLeft className="w-5 h-5 text-blue-600 transition-transform rotate-90" />
                      ) : (
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail Panel for this Size (Actions & Quick Stock Update) */}
                  {isExpanded && (
                    <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 mx-2 mb-2 space-y-3 animate-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Ruler className="w-3.5 h-3.5 text-blue-600" />
                          <span>إدارة مقاس {variant.size} (اللون: {variant.color})</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteVariant(variant.id)}
                            className="text-black hover:text-blue-900 text-xs font-bold p-1 rounded-lg hover:bg-slate-100 flex items-center gap-1 border border-transparent hover:border-slate-200"
                            title="حذف هذا المقاس"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </div>

                      {/* Stock Adjustment Controls */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Stock 1: المحل */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                          <span className="text-slate-500 font-medium block">المحل (صالة العرض)</span>
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(variant.id, -1, 0)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="font-mono font-black text-sm text-blue-700">
                              {variant.stock1 || 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(variant.id, 1, 0)}
                              className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-black flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Stock 2: المستودع */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                          <span className="text-slate-500 font-medium block">المستودع (التخزين)</span>
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(variant.id, 0, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="font-mono font-black text-sm text-blue-900">
                              {variant.stock2 || 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(variant.id, 0, 1)}
                              className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-black flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Edit Reference or Price */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">المرجع / الكود:</label>
                          <input 
                            type="text"
                            value={variant.code || ''}
                            onChange={(e) => handleUpdateVariant(variant.id, { code: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800"
                            placeholder="مثال: 3921"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">سعر البيع (د.ج):</label>
                          <input 
                            type="number"
                            value={variant.price || displayPrice}
                            onChange={(e) => handleUpdateVariant(variant.id, { price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-800"
                          />
                        </div>
                      </div>

                      {/* Direct Action Buttons: Rent / Sell this size */}
                      <div className="flex gap-2 pt-1">
                        {(item.purpose === 'rent' || item.purpose === 'both') && onQuickRent && (
                          <button
                            type="button"
                            onClick={() => {
                              onQuickRent(item, variant);
                              onClose();
                            }}
                            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs"
                          >
                            <Shirt className="w-3.5 h-3.5" />
                            <span>كراء مقاس {variant.size}</span>
                          </button>
                        )}
                        {(item.purpose === 'sell' || item.purpose === 'both') && onQuickSale && (
                          <button
                            type="button"
                            onClick={() => {
                              onQuickSale(item, variant);
                              onClose();
                            }}
                            className="flex-1 py-1.5 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>بيع مقاس {variant.size}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add New Variant Form (If toggled) */}
        {isAddingNewVariant && (
          <form 
            onSubmit={handleAddNewVariantSubmit}
            className="p-4 bg-blue-50/60 border-t border-blue-100 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مقاس أو لون جديد لهذا الفستان</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddingNewVariant(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                إلغاء
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-600 font-bold block mb-1">المقاس (Taille):</label>
                <input 
                  type="text" 
                  value={newSize} 
                  onChange={(e) => setNewSize(e.target.value)} 
                  placeholder="مثال: 46 أو L"
                  required
                  className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-600 font-bold block mb-1">اللون:</label>
                <input 
                  type="text" 
                  value={newColor} 
                  onChange={(e) => setNewColor(e.target.value)} 
                  placeholder="مثال: أسود"
                  className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-600 font-bold block mb-1">كود المرجع (#):</label>
                <input 
                  type="text" 
                  value={newCode} 
                  onChange={(e) => setNewCode(e.target.value)} 
                  placeholder="مثال: 3922"
                  className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-600 font-bold block mb-1">السعر (د.ج):</label>
                <input 
                  type="number" 
                  value={newPrice} 
                  onChange={(e) => setNewPrice(e.target.value)} 
                  className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-600 font-bold block mb-1">المخزون في المحل:</label>
                <input 
                  type="number" 
                  min="0"
                  value={newStock1} 
                  onChange={(e) => setNewStock1(e.target.value)} 
                  className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-600 font-bold block mb-1">المخزون في المستودع:</label>
                <input 
                  type="number" 
                  min="0"
                  value={newStock2} 
                  onChange={(e) => setNewStock2(e.target.value)} 
                  className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition-colors"
            >
              حفظ وإضافة المقاس للقائمة
            </button>
          </form>
        )}

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-2">
          {!isAddingNewVariant ? (
            <button
              type="button"
              onClick={() => setIsAddingNewVariant(true)}
              className="px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>إضافة مقاس أو لون جديد</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {item.imageUrl && (
              <button
                type="button"
                onClick={() => onOpenFullImage?.(item.imageUrl!, item.name)}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
                title="عرض الصورة كاملة"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">الصورة كاملة</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors"
            >
              تم
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
