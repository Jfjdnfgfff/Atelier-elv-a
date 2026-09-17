import React, { useState, useRef, useEffect } from 'react';
import { ClothItem, PurposeType } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { Store, Warehouse, ArrowLeftRight, Camera, X, Check, Package, Shirt, Tag, AlertTriangle, Upload, Trash2 } from 'lucide-react';

interface InventoryViewProps {
  clothes: ClothItem[];
  onAddCloth: (item: any) => void;
  onUpdateCloth: (id: string, item: any) => void;
  onDeleteCloth: (id: string) => void;
  onScanBarcode?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  clothes,
  onAddCloth,
  onUpdateCloth,
  onDeleteCloth
}) => {
  const [filterPurpose, setFilterPurpose] = useState<string>('all');
  const [filterStockLoc, setFilterStockLoc] = useState<'all' | 'stock1' | 'stock2' | 'low'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<ClothItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [initialBarcodeForAdd, setInitialBarcodeForAdd] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Quick Stock & Transfer Modal
  const [stockModalItem, setStockModalItem] = useState<ClothItem | null>(null);
  const [quickTransferItem, setQuickTransferItem] = useState<ClothItem | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [barcodeActionNotice, setBarcodeActionNotice] = useState<string | null>(null);

  const categories = [
    'فساتين سهرة',
    'أزياء تقليدية وقفاطين',
    'بدلات وأطقم رجالية',
    'عبايات وملابس كاجوال',
    'إكسسوارات وحقائب',
    'أحذية',
    'أخرى'
  ];

  // Helper to ensure safe stock counts
  const getItemStock1 = (item: ClothItem) => item.stock1 !== undefined ? item.stock1 : (item.stock || 0);
  const getItemStock2 = (item: ClothItem) => item.stock2 !== undefined ? item.stock2 : 0;
  const getItemTotalStock = (item: ClothItem) => getItemStock1(item) + getItemStock2(item);

  // Total statistics across both stocks
  const totalStock1 = clothes.reduce((sum, c) => sum + getItemStock1(c), 0);
  const totalStock2 = clothes.reduce((sum, c) => sum + getItemStock2(c), 0);
  const grandTotalStock = totalStock1 + totalStock2;
  const totalInventoryValue = clothes.reduce((sum, c) => sum + (c.buyCost * getItemTotalStock(c)), 0);

  // Process a scanned barcode in Inventory:
  const handleProcessBarcode = (code: string) => {
    const cleanCode = code.trim().toLowerCase();
    const existing = clothes.find(
      c => c.barcode.trim().toLowerCase() === cleanCode || c.name.toLowerCase().includes(cleanCode)
    );

    if (existing) {
      setStockModalItem(existing);
      setBarcodeActionNotice(`تم العثور على: ${existing.name} (${existing.size})`);
      setTimeout(() => setBarcodeActionNotice(null), 3500);
      setShowScannerModal(false);
    } else {
      // Item not found -> open Add modal with barcode filled
      setInitialBarcodeForAdd(code.trim());
      setShowAddModal(true);
      setShowScannerModal(false);
    }
  };

  // Handheld laser barcode gun listener on Inventory view
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (isInput) return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 90) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault();
          handleProcessBarcode(buffer.trim());
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clothes]);

  // Handle transfer between stock 1 and stock 2
  const handleTransferStock = (itemId: string, direction: '1_to_2' | '2_to_1', qty: number) => {
    const item = clothes.find(c => c.id === itemId);
    if (!item) return;

    const s1 = getItemStock1(item);
    const s2 = getItemStock2(item);

    if (direction === '1_to_2') {
      const transferQty = Math.min(s1, Math.max(1, qty));
      const newS1 = s1 - transferQty;
      const newS2 = s2 + transferQty;
      onUpdateCloth(itemId, {
        stock1: newS1,
        stock2: newS2,
        stock: newS1 + newS2
      });
      setBarcodeActionNotice(`✓ تم تحويل ${transferQty} قطع من المخزون 1 إلى المخزون 2`);
    } else {
      const transferQty = Math.min(s2, Math.max(1, qty));
      const newS1 = s1 + transferQty;
      const newS2 = s2 - transferQty;
      onUpdateCloth(itemId, {
        stock1: newS1,
        stock2: newS2,
        stock: newS1 + newS2
      });
      setBarcodeActionNotice(`✓ تم تحويل ${transferQty} قطع من المخزون 2 إلى المخزون 1`);
    }
    setTimeout(() => setBarcodeActionNotice(null), 3500);
    setQuickTransferItem(null);
  };

  const filteredClothes = clothes.filter(item => {
    if (filterPurpose !== 'all') {
      if (filterPurpose === 'rent' && item.purpose === 'sell') return false;
      if (filterPurpose === 'sell' && item.purpose === 'rent') return false;
    }

    if (filterStockLoc === 'stock1') {
      if (getItemStock1(item) <= 0) return false;
    } else if (filterStockLoc === 'stock2') {
      if (getItemStock2(item) <= 0) return false;
    } else if (filterStockLoc === 'low') {
      if (getItemStock1(item) > 1 && getItemStock2(item) > 1) return false;
    }

    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.barcode.includes(q) ||
        item.color.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5 p-3 sm:p-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>مخزون الأزياء والملابس (Stock 1 & Stock 2)</span>
            <span className="text-xs bg-rose-50 text-rose-700 px-2.5 py-1 rounded-xl font-bold border border-rose-100">
              {clothes.length} موديل
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            إدارة المخزونين (المخزن 1 / المحل و المخزن 2 / المستودع) مع التحويل السريع والإضافة بالباركود.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* Add Stock by Barcode Button */}
          <button
            onClick={() => setShowScannerModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md shadow-emerald-200 active:scale-95"
            title="مسح باركود لإضافة أو تحويل كمية المخزن"
          >
            <span>📷</span>
            <span>إضافة مخزون بالباركود ⚡</span>
          </button>

          <button
            onClick={() => {
              setInitialBarcodeForAdd('');
              setShowAddModal(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md shadow-rose-200 active:scale-95"
          >
            + إضافة قطعة جديدة
          </button>
        </div>
      </div>

      {/* Stock 1 & Stock 2 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-4 rounded-3xl border border-indigo-200/70 shadow-xs">
          <div className="flex items-center justify-between text-indigo-800 mb-1">
            <span className="text-xs font-bold">🏬 المخزون 1 (Stock 1)</span>
            <span className="text-lg">🏪</span>
          </div>
          <p className="text-2xl font-black text-indigo-950">{totalStock1.toLocaleString()} <span className="text-xs font-normal text-indigo-700">قطعة</span></p>
          <span className="text-[11px] text-indigo-600 font-medium">مخزن المحل وصالة العرض</span>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 rounded-3xl border border-amber-200/70 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-xs font-bold">📦 المخزون 2 (Stock 2)</span>
            <span className="text-lg">🏭</span>
          </div>
          <p className="text-2xl font-black text-amber-950">{totalStock2.toLocaleString()} <span className="text-xs font-normal text-amber-700">قطعة</span></p>
          <span className="text-[11px] text-amber-600 font-medium">المستودع والتخزين الاحتياطي</span>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 rounded-3xl border border-emerald-200/70 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-xs font-bold">📊 إجمالي المخزون الكلي</span>
            <span className="text-lg">✨</span>
          </div>
          <p className="text-2xl font-black text-emerald-950">{grandTotalStock.toLocaleString()} <span className="text-xs font-normal text-emerald-700">قطعة</span></p>
          <span className="text-[11px] text-emerald-600 font-medium">مجموع المخزن 1 + المخزن 2</span>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-700 mb-1">
            <span className="text-xs font-bold">💰 قيمة المخزون (تكلِفة)</span>
            <span className="text-lg">🏷️</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{totalInventoryValue.toLocaleString()} <span className="text-xs font-normal text-slate-500">دج</span></p>
          <span className="text-[11px] text-slate-500 font-medium">قيمة رأس المال في المخزنين</span>
        </div>
      </div>

      {/* Notice Pill */}
      {barcodeActionNotice && (
        <div className="bg-emerald-600 text-white text-xs font-black p-3 rounded-2xl text-center shadow-lg animate-bounce">
          {barcodeActionNotice}
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {/* Purpose Filters */}
            <button
              onClick={() => setFilterPurpose('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterPurpose === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({clothes.length})
            </button>
            <button
              onClick={() => setFilterPurpose('rent')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterPurpose === 'rent' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              👗 كراء ({clothes.filter(c => c.purpose === 'rent' || c.purpose === 'both').length})
            </button>
            <button
              onClick={() => setFilterPurpose('sell')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterPurpose === 'sell' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏷️ بيع ({clothes.filter(c => c.purpose === 'sell' || c.purpose === 'both').length})
            </button>

            <span className="w-px h-6 bg-slate-200 self-center mx-1 shrink-0" />

            {/* Stock Location Filters */}
            <button
              onClick={() => setFilterStockLoc('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'all' ? 'bg-purple-700 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏢 المخزنين معاً
            </button>
            <button
              onClick={() => setFilterStockLoc('stock1')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'stock1' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏬 مخزون 1 فقط
            </button>
            <button
              onClick={() => setFilterStockLoc('stock2')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'stock2' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📦 مخزون 2 فقط
            </button>
            <button
              onClick={() => setFilterStockLoc('low')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'low' ? 'bg-rose-700 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ⚠️ نواقص المخزون
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، الباركود، المقاس، اللون..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500"
            />
            <svg className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
              filterCategory === 'all' ? 'bg-rose-100 text-rose-900' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            جميع التصنيفات
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
                filterCategory === cat ? 'bg-rose-100 text-rose-900' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Clothes Items with Images and Stock 1 / Stock 2 Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClothes.map(item => {
          const s1 = getItemStock1(item);
          const s2 = getItemStock2(item);
          const totalStock = s1 + s2;
          const availableStock = Math.max(0, totalStock - (item.rentedCount || 0));

          return (
            <div
              key={item.id}
              className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              {/* Product Image Box */}
              <div 
                onClick={() => item.imageUrl && setPreviewImage({ url: item.imageUrl, title: item.name })}
                className="relative aspect-4/3 sm:aspect-16/10 bg-slate-100 overflow-hidden cursor-pointer flex items-center justify-center"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5 p-4">
                    <span className="text-3xl">👗</span>
                    <span className="text-[10px] font-bold">بدون صورة</span>
                  </div>
                )}

                {/* Purpose Badge on Top Left */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                  {item.purpose === 'both' && (
                    <span className="bg-purple-600/90 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs">
                      بيع + كراء
                    </span>
                  )}
                  {item.purpose === 'rent' && (
                    <span className="bg-rose-600/90 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs">
                      كراء 👗
                    </span>
                  )}
                  {item.purpose === 'sell' && (
                    <span className="bg-indigo-600/90 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs">
                      بيع 🏷️
                    </span>
                  )}
                </div>

                {/* Category Badge on Top Right */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="bg-slate-900/70 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-xl">
                    {item.category}
                  </span>
                </div>

                {/* Zoom Hint */}
                {item.imageUrl && (
                  <div className="absolute bottom-2 left-2 bg-slate-900/60 text-white text-[9px] px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    🔍 تكبير الصورة
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-tight line-clamp-2">{item.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 font-bold">
                    <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                      مقاس: {item.size}
                    </span>
                    {item.color && (
                      <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                        {item.color}
                      </span>
                    )}
                    {item.barcode && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        #{item.barcode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pricing & Stock Card Breakdown */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2 text-xs">
                  {/* Prices */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">
                        {item.purpose === 'sell' ? 'سعر البيع' : 'سعر الكراء'}
                      </span>
                      <span className="text-slate-900 font-black text-sm">
                        {(item.purpose === 'sell' ? item.sellPrice : item.rentPrice).toLocaleString()} دج
                      </span>
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 font-bold block">المتوفر الإجمالي</span>
                      <span className={`font-black text-sm ${availableStock <= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {availableStock} / {totalStock} قطعة
                      </span>
                    </div>
                  </div>

                  {/* Stock 1 and Stock 2 Breakdown Badges */}
                  <div className="pt-2 border-t border-slate-200/70 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-1.5 flex items-center justify-between">
                      <span className="font-bold text-indigo-800">🏬 مخزون 1:</span>
                      <span className={`font-black ${s1 <= 0 ? 'text-rose-600' : 'text-indigo-950'}`}>{s1} قطعة</span>
                    </div>
                    <div className="bg-amber-50/80 border border-amber-100 rounded-xl p-1.5 flex items-center justify-between">
                      <span className="font-bold text-amber-800">📦 مخزون 2:</span>
                      <span className={`font-black ${s2 <= 0 ? 'text-rose-600' : 'text-amber-950'}`}>{s2} قطعة</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setStockModalItem(item)}
                    className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                    title="تعديل أو زيادة كمية المخزون 1 أو 2"
                  >
                    <span>⚡</span>
                    <span>+ إضافة</span>
                  </button>

                  <button
                    onClick={() => setQuickTransferItem(item)}
                    className="py-2 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                    title="تحويل كميات بين مخزون 1 ومخزون 2"
                  >
                    <span>⇄</span>
                    <span>تحويل</span>
                  </button>

                  <button
                    onClick={() => setEditingItem(item)}
                    className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                    title="تعديل بيانات وصورة القطعة"
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() => onDeleteCloth(item.id)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all active:scale-95"
                    title="حذف القطعة"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative"
          >
            <div className="p-3 bg-slate-900 flex justify-between items-center text-white border-b border-slate-800">
              <span className="font-bold text-xs">{previewImage.title}</span>
              <button 
                onClick={() => setPreviewImage(null)} 
                className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[75vh] overflow-hidden flex items-center justify-center bg-black">
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Cloth Modal */}
      {(showAddModal || editingItem) && (
        <ClothFormModal
          item={editingItem}
          initialBarcode={initialBarcodeForAdd}
          categories={categories}
          onClose={() => { setShowAddModal(false); setEditingItem(null); setInitialBarcodeForAdd(''); }}
          onSubmit={(data) => {
            if (editingItem) {
              onUpdateCloth(editingItem.id, data);
            } else {
              onAddCloth(data);
            }
            setShowAddModal(false);
            setEditingItem(null);
            setInitialBarcodeForAdd('');
          }}
        />
      )}

      {/* Quick Stock Modal (Stock 1 & Stock 2) */}
      {stockModalItem && (
        <QuickStockModal
          item={stockModalItem}
          onClose={() => setStockModalItem(null)}
          onSave={(newStock1, newStock2, newBuyCost, newSellPrice, newRentPrice) => {
            onUpdateCloth(stockModalItem.id, {
              stock1: newStock1,
              stock2: newStock2,
              stock: newStock1 + newStock2,
              buyCost: newBuyCost,
              sellPrice: newSellPrice,
              rentPrice: newRentPrice
            });
            setStockModalItem(null);
            setBarcodeActionNotice(`✓ تم تحديث مخزون ${stockModalItem.name} بنجاح!`);
            setTimeout(() => setBarcodeActionNotice(null), 3500);
          }}
        />
      )}

      {/* Quick Transfer Modal (Stock 1 <-> Stock 2) */}
      {quickTransferItem && (
        <QuickTransferModal
          item={quickTransferItem}
          onClose={() => setQuickTransferItem(null)}
          onTransfer={(direction, qty) => handleTransferStock(quickTransferItem.id, direction, qty)}
        />
      )}

      {/* Embedded Barcode Scanner Camera for Adding Stock */}
      {showScannerModal && (
        <BarcodeScanner
          title="مسح باركود لإضافة المخزون 📦"
          onScan={(code) => handleProcessBarcode(code)}
          onClose={() => setShowScannerModal(false)}
        />
      )}
    </div>
  );
};

// ==========================================
// Quick Stock Modal (إضافة وتحديث المخزون 1 والمخزون 2)
// ==========================================
interface QuickStockModalProps {
  item: ClothItem;
  onClose: () => void;
  onSave: (newStock1: number, newStock2: number, buyCost: number, sellPrice: number, rentPrice: number) => void;
}

const QuickStockModal: React.FC<QuickStockModalProps> = ({ item, onClose, onSave }) => {
  const initialS1 = item.stock1 !== undefined ? item.stock1 : item.stock || 0;
  const initialS2 = item.stock2 !== undefined ? item.stock2 : 0;

  const [stock1, setStock1] = useState<number>(initialS1);
  const [stock2, setStock2] = useState<number>(initialS2);
  const [targetStock, setTargetStock] = useState<'stock1' | 'stock2'>('stock1');
  const [addQty, setAddQty] = useState<number>(1);
  const [buyCost, setBuyCost] = useState<number>(item.buyCost || 0);
  const [sellPrice, setSellPrice] = useState<number>(item.sellPrice || 0);
  const [rentPrice, setRentPrice] = useState<number>(item.rentPrice || 0);

  const handleAddQuick = (amount: number) => {
    if (targetStock === 'stock1') {
      setStock1(prev => Math.max(0, prev + amount));
    } else {
      setStock2(prev => Math.max(0, prev + amount));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(Math.max(0, stock1), Math.max(0, stock2), buyCost, sellPrice, rentPrice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-md max-w-full p-5 sm:p-6 shadow-2xl border border-slate-100 overflow-x-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
              📦
            </span>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">تحديث وإضافة المخزون (Stock 1 & 2)</h3>
              <p className="text-[10px] text-slate-400 font-mono">كود: #{item.barcode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>

        {/* Item Info Summary */}
        <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mb-4">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center text-2xl shrink-0">
              👗
            </div>
          )}
          <div className="flex-1">
            <h4 className="font-black text-slate-900 text-sm">{item.name}</h4>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>مقاس: {item.size}</span>
              <span>•</span>
              <span>لون: {item.color}</span>
            </div>
            <div className="text-[11px] font-bold text-slate-700 mt-1 flex gap-2 items-center">
              <span className="text-slate-800 font-bold flex items-center gap-1"><Store className="w-3 h-3 text-slate-500" /> مخزون 1: {stock1}</span>
              <span>|</span>
              <span className="text-slate-800 font-bold flex items-center gap-1"><Warehouse className="w-3 h-3 text-slate-500" /> مخزون 2: {stock2}</span>
              <span>|</span>
              <span className="text-slate-900 font-bold">المجموع: {stock1 + stock2}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Choose which stock to add to */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">المخزن المراد التزويد إليه:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetStock('stock1')}
                className={`py-2.5 px-3 rounded-2xl font-bold text-xs transition-all border flex items-center justify-center gap-2 ${
                  targetStock === 'stock1' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>المخزون 1 (المحل)</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetStock('stock2')}
                className={`py-2.5 px-3 rounded-2xl font-bold text-xs transition-all border flex items-center justify-center gap-2 ${
                  targetStock === 'stock2' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Warehouse className="w-4 h-4" />
                <span>المخزون 2 (المستودع)</span>
              </button>
            </div>
          </div>

          {/* Quick Add Buttons (+1, +2, +5, +10) */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">
              إضافة سريعة إلى {targetStock === 'stock1' ? 'المخزون 1' : 'المخزون 2'}:
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2.5">
              {[1, 2, 5, 10].map(qty => (
                <button
                  type="button"
                  key={qty}
                  onClick={() => handleAddQuick(qty)}
                  className="py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-black transition-all active:scale-95"
                >
                  +{qty}
                </button>
              ))}
            </div>

            {/* Direct Quantities inputs for both stocks */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-black text-indigo-900 mb-1">الكمية في المخزون 1</label>
                <input
                  type="number"
                  min="0"
                  value={stock1}
                  onChange={(e) => setStock1(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-white border-2 border-indigo-300 rounded-xl p-2 text-center font-black text-base text-indigo-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-amber-900 mb-1">الكمية في المخزون 2</label>
                <input
                  type="number"
                  min="0"
                  value={stock2}
                  onChange={(e) => setStock2(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-white border-2 border-amber-300 rounded-xl p-2 text-center font-black text-base text-amber-900 focus:outline-none focus:border-amber-600"
                />
              </div>
            </div>
          </div>

          {/* Pricing Adjustments */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">سعر الشراء</label>
              <input
                type="number"
                min="0"
                value={buyCost}
                onChange={(e) => setBuyCost(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-indigo-700 mb-1">سعر البيع</label>
              <input
                type="number"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-indigo-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-rose-700 mb-1">سعر الكراء</label>
              <input
                type="number"
                min="0"
                value={rentPrice}
                onChange={(e) => setRentPrice(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-rose-700 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-slate-900 hover:bg-black active:scale-95 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-sm transition-all min-h-[44px] flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>تأكيد وحفظ كميات المخزنين (المجموع: {stock1 + stock2})</span>
          </button>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Quick Transfer Modal (تحويل بين المخزن 1 والمخزن 2)
// ==========================================
interface QuickTransferModalProps {
  item: ClothItem;
  onClose: () => void;
  onTransfer: (direction: '1_to_2' | '2_to_1', qty: number) => void;
}

const QuickTransferModal: React.FC<QuickTransferModalProps> = ({ item, onClose, onTransfer }) => {
  const s1 = item.stock1 !== undefined ? item.stock1 : item.stock || 0;
  const s2 = item.stock2 !== undefined ? item.stock2 : 0;

  const [direction, setDirection] = useState<'1_to_2' | '2_to_1'>('2_to_1'); // default: warehouse to store
  const [qty, setQty] = useState<number>(1);

  const maxAvailable = direction === '1_to_2' ? s1 : s2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0) return;
    onTransfer(direction, Math.min(qty, maxAvailable));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-md max-w-full p-5 sm:p-6 shadow-2xl border border-slate-100 overflow-x-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-base font-bold">
              <ArrowLeftRight className="w-4 h-4 text-slate-700" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">تحويل المخزون بين المخزن 1 و 2</h3>
              <p className="text-[10px] text-slate-500 font-medium">نقل سريع للقطع بين المحل والمستودع</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Item Info */}
        <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mb-4">
          <div className="flex-1">
            <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 mt-1">
              <span className="text-slate-800 flex items-center gap-1"><Store className="w-3.5 h-3.5 text-slate-500" /> المخزون 1: {s1} قطعة</span>
              <span>•</span>
              <span className="text-slate-800 flex items-center gap-1"><Warehouse className="w-3.5 h-3.5 text-slate-500" /> المخزون 2: {s2} قطعة</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Direction Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">اتجاه التحويل:</label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setDirection('2_to_1'); setQty(1); }}
                className={`w-full py-3 px-4 rounded-2xl font-bold text-xs transition-all border flex items-center justify-between ${
                  direction === '2_to_1' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>من المخزون 2 (المستودع) ➔ إلى المخزون 1 (المحل)</span>
                <span className="text-[11px] opacity-80">(المتاح: {s2})</span>
              </button>

              <button
                type="button"
                onClick={() => { setDirection('1_to_2'); setQty(1); }}
                className={`w-full py-3 px-4 rounded-2xl font-bold text-xs transition-all border flex items-center justify-between ${
                  direction === '1_to_2' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>من المخزون 1 (المحل) ➔ إلى المخزون 2 (المستودع)</span>
                <span className="text-[11px] opacity-80">(المتاح: {s1})</span>
              </button>
            </div>
          </div>

          {/* Transfer Qty */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الكمية المراد تحويلها:</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={maxAvailable}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(maxAvailable, Number(e.target.value) || 1)))}
                disabled={maxAvailable <= 0}
                className="flex-1 border border-slate-300 rounded-xl p-2.5 text-center font-bold text-base text-slate-900 focus:outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={() => setQty(maxAvailable)}
                disabled={maxAvailable <= 0}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl whitespace-nowrap"
              >
                الكل ({maxAvailable})
              </button>
            </div>
          </div>

          {maxAvailable <= 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-2xl text-center flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-slate-500" />
              <span>لا توجد كمية متاحة في المخزن المصدري للتحويل!</span>
            </div>
          ) : (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-800 font-bold flex justify-between">
              <span>النتيجة بعد التحويل:</span>
              <span>
                مخزون 1: {direction === '2_to_1' ? s1 + qty : s1 - qty} | مخزون 2: {direction === '2_to_1' ? s2 - qty : s2 + qty}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={maxAvailable <= 0}
            className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:bg-slate-300 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-purple-200 transition-all min-h-[44px]"
          >
            تنفيذ عملية التحويل ⇄
          </button>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Full Add/Edit Cloth Form Modal with Barcode Camera Button
// ==========================================
interface ClothFormModalProps {
  item?: ClothItem | null;
  initialBarcode?: string;
  categories: string[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const ClothFormModal: React.FC<ClothFormModalProps> = ({ item, initialBarcode, categories, onClose, onSubmit }) => {
  const initialS1 = item?.stock1 !== undefined ? item.stock1 : (item?.stock || 1);
  const initialS2 = item?.stock2 !== undefined ? item.stock2 : 0;

  const [name, setName] = useState(item?.name || '');
  const [barcode, setBarcode] = useState(
    item?.barcode || initialBarcode || Math.floor(100000000000 + Math.random() * 900000000000).toString()
  );
  const [category, setCategory] = useState(item?.category || categories[0]);
  const [purpose, setPurpose] = useState<PurposeType>(item?.purpose || 'both');
  const [buyCost, setBuyCost] = useState(item?.buyCost || 0);
  const [sellPrice, setSellPrice] = useState(item?.sellPrice || 0);
  const [rentPrice, setRentPrice] = useState(item?.rentPrice || 0);
  const [cautionAmount, setCautionAmount] = useState(item?.cautionAmount || 0);
  const [size, setSize] = useState(item?.size || '38');
  const [color, setColor] = useState(item?.color || 'أسود');
  
  // Stock 1 & Stock 2
  const [stock1, setStock1] = useState<number>(initialS1);
  const [stock2, setStock2] = useState<number>(initialS2);

  const [imageUrl, setImageUrl] = useState(item?.imageUrl || '');
  const [description, setDescription] = useState(item?.description || '');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showInFormScanner, setShowInFormScanner] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress & convert file to Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 700;
        const MAX_HEIGHT = 700;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          setImageUrl(dataUrl);
        }
        setIsProcessingImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const totalCalculatedStock = Math.max(0, Number(stock1) || 0) + Math.max(0, Number(stock2) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const s1 = Math.max(0, Number(stock1) || 0);
    const s2 = Math.max(0, Number(stock2) || 0);

    onSubmit({
      name: name.trim(),
      barcode: barcode.trim(),
      category,
      purpose,
      buyCost: Number(buyCost),
      sellPrice: Number(sellPrice),
      rentPrice: Number(rentPrice),
      cautionAmount: Number(cautionAmount),
      size: size.trim(),
      color: color.trim(),
      stock1: s1,
      stock2: s2,
      stock: s1 + s2,
      rentedCount: item?.rentedCount || 0,
      inCleaningCount: item?.inCleaningCount || 0,
      imageUrl: imageUrl.trim() || undefined,
      description: description.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none" dir="rtl">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] sm:max-h-[92vh] overflow-y-auto overflow-x-hidden safe-bottom animate-in fade-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden shrink-0" />
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
          <h3 className="font-black text-slate-900 text-base sm:text-lg">
            {item ? 'تعديل قطعة الملابس والصورة' : 'إضافة قطعة ملابس / فستان جديد'}
          </h3>
          <button 
            onClick={onClose} 
            aria-label="إغلاق"
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          {/* Image Upload Area */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700">صورة المنتج / الفستان</label>
            
            <div className="flex items-center gap-3">
              {/* Preview Thumbnail */}
              <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 relative group">
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="معاينة" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute inset-0 bg-slate-900/80 text-white font-bold text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </>
                ) : (
                  <Shirt className="w-8 h-8 text-slate-300" />
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isProcessingImage ? 'جاري تجهيز الصورة...' : 'رفع صورة من الهاتف / الكمبيوتر'}</span>
                </button>

                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="أو ضع رابط صورة إنترنت (URL)..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم القطعة أو الفستان *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: فستان سهرة مخمل مطرز، قفطان تقليدي..."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-base sm:text-sm font-bold focus:border-rose-500 focus:outline-none"
            />
          </div>

          {/* Barcode Field with In-Form Camera Scanner Button */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700">الباركود / الكود (EAN-13 أو Code-128)</label>
              <button
                type="button"
                onClick={() => setBarcode(Math.floor(100000000000 + Math.random() * 900000000000).toString())}
                className="text-[10px] text-indigo-600 font-bold hover:underline"
              >
                توليد كود عشوائي
              </button>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="امسح بالليزر أو اكتب الكود..."
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-rose-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowInFormScanner(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95"
                title="مسح الباركود بالكاميرا لتعبئة الكود"
              >
                <Camera className="w-3.5 h-3.5 text-slate-600" />
                <span>مسح</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-slate-400 focus:outline-none"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع الاستخدام</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as PurposeType)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-slate-400 focus:outline-none text-slate-900 font-bold"
              >
                <option value="both">كراء + بيع</option>
                <option value="rent">كراء فقط</option>
                <option value="sell">بيع فقط</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المقاس</label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="38, M, XL..."
                className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اللون</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="أحمر، أسود..."
                className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Two Stocks Section (Stock 1 & Stock 2) */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-600" />
                <span>كميات المخزون في المخزنين (Stock 1 & Stock 2)</span>
              </label>
              <span className="text-[11px] font-bold bg-white border border-slate-200 text-slate-800 px-2.5 py-0.5 rounded-xl">
                المجموع: {totalCalculatedStock} قطعة
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-slate-600" />
                  <span>المخزون 1 (المحل / المعرض)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock1}
                  onChange={(e) => setStock1(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-sm font-bold text-slate-900 text-center focus:outline-none focus:border-slate-400"
                />
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Warehouse className="w-3.5 h-3.5 text-slate-600" />
                  <span>المخزون 2 (المستودع)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock2}
                  onChange={(e) => setStock2(Number(e.target.value))}
                  className="w-full border border-amber-300 rounded-xl px-2.5 py-1.5 text-sm font-black text-amber-900 text-center focus:outline-none focus:border-amber-600"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">سعر الشراء/التكلفة</label>
              <input
                type="number"
                min="0"
                value={buyCost}
                onChange={(e) => setBuyCost(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-rose-700 mb-1">سعر الكراء (دج)</label>
              <input
                type="number"
                min="0"
                value={rentPrice}
                onChange={(e) => setRentPrice(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-black text-rose-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-amber-700 mb-1">العربون (Caution)</label>
              <input
                type="number"
                min="0"
                value={cautionAmount}
                onChange={(e) => setCautionAmount(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-amber-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-indigo-700 mb-1">سعر البيع (دج)</label>
              <input
                type="number"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-indigo-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">وصف إضافي</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="نوع القماش، تفاصيل خاصة..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold text-xs transition-all shadow-sm active:scale-[0.98] min-h-[44px]"
          >
            {item ? 'تحديث بيانات وصورة القطعة' : 'إضافة القطعة للمخزن'}
          </button>
        </form>
      </div>

      {showInFormScanner && (
        <BarcodeScanner
          title="مسح باركود القطعة"
          onScan={(code) => {
            setBarcode(code.trim());
            setShowInFormScanner(false);
          }}
          onClose={() => setShowInFormScanner(false)}
        />
      )}
    </div>
  );
};
