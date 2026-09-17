import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ClothItem, PurposeType } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { Store, Warehouse, ArrowLeftRight, Camera, X, Check, Package, Shirt, Tag, AlertTriangle, Upload, Trash2, Palette, Ruler, Plus, Sparkles, Filter, CheckCircle2 } from 'lucide-react';

export const STANDARD_SIZES = [
  '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54',
  'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL',
  'Standard', 'Sur Mesure (تفصيل)'
];

export const POPULAR_COLORS = [
  { name: 'أسود', hex: '#000000', border: false },
  { name: 'أبيض', hex: '#FFFFFF', border: true },
  { name: 'أحمر', hex: '#DC2626', border: false },
  { name: 'أزرق ملكي', hex: '#1D4ED8', border: false },
  { name: 'أزرق سماوي', hex: '#38BDF8', border: false },
  { name: 'كحلي', hex: '#1E293B', border: false },
  { name: 'ذهبي', hex: '#D97706', border: false },
  { name: 'فضي', hex: '#94A3B8', border: false },
  { name: 'وردي', hex: '#EC4899', border: false },
  { name: 'وردي بودري', hex: '#FBCFE8', border: true },
  { name: 'أخضر زمردي', hex: '#059669', border: false },
  { name: 'أخضر ملكي', hex: '#064E3B', border: false },
  { name: 'بنفسجي', hex: '#7C3AED', border: false },
  { name: 'بوردو', hex: '#881337', border: false },
  { name: 'بيج', hex: '#FEF08A', border: true },
  { name: 'رمادي', hex: '#64748B', border: false },
  { name: 'خردلي', hex: '#CA8A04', border: false },
  { name: 'برونزي', hex: '#78350F', border: false },
  { name: 'فوشيا', hex: '#C026D3', border: false },
  { name: 'أخضر فستقي', hex: '#A3E635', border: false }
];

export const getColorHex = (colorName: string): string => {
  if (!colorName) return '#94A3B8';
  const c = colorName.trim();
  const found = POPULAR_COLORS.find(item => c.includes(item.name) || item.name.includes(c));
  if (found) return found.hex;
  if (c.includes('أسود') || c.toLowerCase().includes('black') || c.toLowerCase().includes('noir')) return '#000000';
  if (c.includes('أبيض') || c.toLowerCase().includes('white') || c.toLowerCase().includes('blanc')) return '#FFFFFF';
  if (c.includes('أحمر') || c.toLowerCase().includes('red') || c.toLowerCase().includes('rouge')) return '#DC2626';
  if (c.includes('أزرق') || c.toLowerCase().includes('blue') || c.toLowerCase().includes('bleu')) return '#1D4ED8';
  if (c.includes('ذهب') || c.toLowerCase().includes('gold') || c.toLowerCase().includes('or')) return '#D97706';
  if (c.includes('فض') || c.toLowerCase().includes('silver') || c.toLowerCase().includes('argent')) return '#94A3B8';
  if (c.includes('ورد') || c.toLowerCase().includes('pink') || c.toLowerCase().includes('rose')) return '#EC4899';
  if (c.includes('أخضر') || c.toLowerCase().includes('green') || c.toLowerCase().includes('vert')) return '#059669';
  if (c.includes('بنفسج') || c.toLowerCase().includes('purple') || c.toLowerCase().includes('violet')) return '#7C3AED';
  if (c.includes('بوردو') || c.toLowerCase().includes('bordeaux')) return '#881337';
  if (c.includes('بيج') || c.toLowerCase().includes('beige')) return '#E2D9C8';
  return '#94A3B8';
};

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
  const [filterSize, setFilterSize] = useState<string>('all');
  const [filterColor, setFilterColor] = useState<string>('all');
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

  // Collect all unique sizes & colors present in the inventory
  const allAvailableSizes = useMemo(() => {
    const sizeSet = new Set<string>();
    clothes.forEach(item => {
      if (item.sizes && item.sizes.length > 0) {
        item.sizes.forEach(s => s && sizeSet.add(s.trim()));
      } else if (item.size) {
        item.size.split(/[,،+/]/).forEach(s => s.trim() && sizeSet.add(s.trim()));
      }
    });
    return Array.from(sizeSet);
  }, [clothes]);

  const allAvailableColors = useMemo(() => {
    const colorSet = new Set<string>();
    clothes.forEach(item => {
      if (item.colors && item.colors.length > 0) {
        item.colors.forEach(c => c && colorSet.add(c.trim()));
      } else if (item.color) {
        item.color.split(/[,،+/]/).forEach(c => c.trim() && colorSet.add(c.trim()));
      }
    });
    return Array.from(colorSet);
  }, [clothes]);

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

    // Filter by Size (لطاي)
    if (filterSize !== 'all') {
      const itemSizes = item.sizes && item.sizes.length > 0
        ? item.sizes
        : (item.size ? item.size.split(/[,،+/]/).map(s => s.trim()) : []);
      if (!itemSizes.includes(filterSize) && !item.size.toLowerCase().includes(filterSize.toLowerCase())) {
        return false;
      }
    }

    // Filter by Color (اللون)
    if (filterColor !== 'all') {
      const itemColors = item.colors && item.colors.length > 0
        ? item.colors
        : (item.color ? item.color.split(/[,،+/]/).map(c => c.trim()) : []);
      if (!itemColors.includes(filterColor) && !item.color.toLowerCase().includes(filterColor.toLowerCase())) {
        return false;
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchBarcode = item.barcode.includes(q);
      const matchColor = item.color.toLowerCase().includes(q) || (item.colors && item.colors.some(c => c.toLowerCase().includes(q)));
      const matchSize = item.size.toLowerCase().includes(q) || (item.sizes && item.sizes.some(s => s.toLowerCase().includes(q)));
      return matchName || matchBarcode || matchColor || matchSize;
    }
    return true;
  });

  return (
    <div className="space-y-5 p-3 sm:p-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-blue-600 flex items-center gap-2">
            <span>مخزون الأزياء والملابس (Stock 1 & Stock 2)</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-xl font-bold border border-blue-100">
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md shadow-blue-200 active:scale-95"
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md shadow-red-200 active:scale-95"
          >
            + إضافة قطعة جديدة
          </button>
        </div>
      </div>

      {/* Stock 1 & Stock 2 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-blue-600">🏬 المخزون 1 (Stock 1)</span>
            <span className="text-lg">🏪</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{totalStock1.toLocaleString()} <span className="text-xs font-bold text-slate-700">قطعة</span></p>
          <span className="text-[11px] text-slate-600 font-medium">مخزن المحل وصالة العرض</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-red-600">📦 المخزون 2 (Stock 2)</span>
            <span className="text-lg">🏭</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{totalStock2.toLocaleString()} <span className="text-xs font-bold text-slate-700">قطعة</span></p>
          <span className="text-[11px] text-slate-600 font-medium">المستودع والتخزين الاحتياطي</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-blue-600">📊 إجمالي المخزون الكلي</span>
            <span className="text-lg">✨</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{grandTotalStock.toLocaleString()} <span className="text-xs font-bold text-slate-700">قطعة</span></p>
          <span className="text-[11px] text-slate-600 font-medium">مجموع المخزن 1 + المخزن 2</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-red-600">💰 قيمة المخزون (تكلِفة)</span>
            <span className="text-lg">🏷️</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{totalInventoryValue.toLocaleString()} <span className="text-xs font-bold text-slate-700">دج</span></p>
          <span className="text-[11px] text-slate-600 font-medium">قيمة رأس المال في المخزنين</span>
        </div>
      </div>

      {/* Notice Pill */}
      {barcodeActionNotice && (
        <div className="bg-blue-600 text-white text-xs font-black p-3 rounded-2xl text-center shadow-lg animate-bounce">
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
                filterPurpose === 'rent' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              👗 كراء ({clothes.filter(c => c.purpose === 'rent' || c.purpose === 'both').length})
            </button>
            <button
              onClick={() => setFilterPurpose('sell')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterPurpose === 'sell' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏷️ بيع ({clothes.filter(c => c.purpose === 'sell' || c.purpose === 'both').length})
            </button>

            <span className="w-px h-6 bg-slate-200 self-center mx-1 shrink-0" />

            {/* Stock Location Filters */}
            <button
              onClick={() => setFilterStockLoc('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏢 المخزنين معاً
            </button>
            <button
              onClick={() => setFilterStockLoc('stock1')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'stock1' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏬 مخزون 1 فقط
            </button>
            <button
              onClick={() => setFilterStockLoc('stock2')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'stock2' ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📦 مخزون 2 فقط
            </button>
            <button
              onClick={() => setFilterStockLoc('low')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'low' ? 'bg-red-700 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
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
              filterCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            جميع التصنيفات
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
                filterCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sizes and Colors Filter Rows */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {/* Size Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5 text-blue-600" />
              <span>المقاس (لطاي):</span>
            </span>
            <button
              type="button"
              onClick={() => setFilterSize('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold shrink-0 transition-all ${
                filterSize === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              الكل
            </button>
            {allAvailableSizes.map(sz => (
              <button
                key={sz}
                type="button"
                onClick={() => setFilterSize(filterSize === sz ? 'all' : sz)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold shrink-0 transition-all border ${
                  filterSize === sz
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>

          {/* Color Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-red-600" />
              <span>اللون:</span>
            </span>
            <button
              type="button"
              onClick={() => setFilterColor('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold shrink-0 transition-all ${
                filterColor === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              الكل
            </button>
            {allAvailableColors.map(col => {
              const hex = getColorHex(col);
              const isSelected = filterColor === col;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => setFilterColor(filterColor === col ? 'all' : col)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold shrink-0 transition-all border flex items-center gap-1 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full border border-slate-300" style={{ backgroundColor: hex }} />
                  <span>{col}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid of Clothes Items with Images and Stock 1 / Stock 2 Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClothes.map(item => {
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
            <div
              key={item.id}
              className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 hover:border-blue-400 shadow-xs hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between group hover:-translate-y-0.5"
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
                    <span className="bg-slate-900/90 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs">
                      بيع + كراء
                    </span>
                  )}
                  {item.purpose === 'rent' && (
                    <span className="bg-blue-600/90 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs">
                      كراء 👗
                    </span>
                  )}
                  {item.purpose === 'sell' && (
                    <span className="bg-red-600/90 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs">
                      بيع 🏷️
                    </span>
                  )}
                </div>

                {/* Category Badge on Top Right */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-xl">
                    {item.category}
                  </span>
                </div>

                {/* Zoom Hint */}
                {item.imageUrl && (
                  <div className="absolute bottom-2 left-2 bg-blue-600/90 text-white text-[9px] px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-xs">
                    <span>🔍</span>
                    <span>تكبير الصورة</span>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-black text-slate-900 group-hover:text-blue-950 text-base leading-tight line-clamp-2 transition-colors">{item.name}</h3>
                    {item.barcode && (
                      <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-700 px-1.5 py-0.5 rounded-md shrink-0 transition-colors border border-transparent group-hover:border-blue-200">
                        #{item.barcode}
                      </span>
                    )}
                  </div>

                  {/* Available Sizes Badges */}
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5">
                        <Ruler className="w-3 h-3 text-blue-600" />
                        <span>لطاي:</span>
                      </span>
                      {itemSizesList.length > 0 ? (
                        itemSizesList.map(sz => (
                          <span
                            key={sz}
                            className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded-md text-[10px] font-black"
                          >
                            {sz}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-600 font-bold">{item.size || '38'}</span>
                      )}
                    </div>

                    {/* Available Colors Badges with Dots */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5">
                        <Palette className="w-3 h-3 text-red-600" />
                        <span>الألوان:</span>
                      </span>
                      {itemColorsList.length > 0 ? (
                        itemColorsList.map(col => (
                          <span
                            key={col}
                            className="bg-slate-50 text-slate-800 border border-slate-200 px-1.5 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1"
                          >
                            <span
                              className="w-2 h-2 rounded-full border border-slate-300"
                              style={{ backgroundColor: getColorHex(col) }}
                            />
                            <span>{col}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-600 font-bold">{item.color || 'أسود'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pricing & Stock Card Breakdown */}
                <div className="bg-slate-50 group-hover:bg-blue-50/40 rounded-2xl p-3 border border-slate-100 group-hover:border-blue-100 space-y-2 text-xs transition-colors">
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
                      <span className={`font-black text-sm ${availableStock <= 0 ? 'text-red-600' : 'text-blue-700'}`}>
                        {availableStock} / {totalStock} قطعة
                      </span>
                    </div>
                  </div>

                  {/* Stock 1 and Stock 2 Breakdown Badges */}
                  <div className="pt-2 border-t border-slate-200/70 group-hover:border-blue-200/70 grid grid-cols-2 gap-2 text-[11px] transition-colors">
                    <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-1.5 flex items-center justify-between">
                      <span className="font-bold text-blue-800">🏬 مخزون 1:</span>
                      <span className={`font-black ${s1 <= 0 ? 'text-red-600' : 'text-blue-950'}`}>{s1} قطعة</span>
                    </div>
                    <div className="bg-red-50/90 border border-red-200 rounded-xl p-1.5 flex items-center justify-between">
                      <span className="font-bold text-red-800">📦 مخزون 2:</span>
                      <span className={`font-black ${s2 <= 0 ? 'text-red-600' : 'text-red-950'}`}>{s2} قطعة</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setStockModalItem(item)}
                    className="flex-1 py-2 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 border border-blue-200 hover:border-blue-600 shadow-2xs hover:shadow-sm"
                    title="تعديل أو زيادة كمية المخزون 1 أو 2"
                  >
                    <span>⚡</span>
                    <span>+ إضافة</span>
                  </button>

                  <button
                    onClick={() => setQuickTransferItem(item)}
                    className="py-2 px-2.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-800 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                    title="تحويل كميات بين مخزون 1 ومخزون 2"
                  >
                    <span>⇄</span>
                    <span>تحويل</span>
                  </button>

                  <button
                    onClick={() => setEditingItem(item)}
                    className="py-2 px-2.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 border border-slate-200 hover:border-blue-300"
                    title="تعديل بيانات وصورة القطعة"
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() => onDeleteCloth(item.id)}
                    className="p-2 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-xl text-xs font-bold transition-all active:scale-95 border border-red-200 hover:border-red-600"
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
            <span className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
              📦
            </span>
            <div>
              <h3 className="font-black text-blue-600 text-sm sm:text-base">تحديث وإضافة المخزون (Stock 1 & 2)</h3>
              <p className="text-[10px] text-slate-500 font-mono">كود: #{item.barcode}</p>
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
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
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
                    ? 'bg-red-600 text-white border-red-600 shadow-sm' 
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
                  className="py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-xl text-xs font-black transition-all active:scale-95"
                >
                  +{qty}
                </button>
              ))}
            </div>

            {/* Direct Quantities inputs for both stocks */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-black text-blue-900 mb-1">الكمية في المخزون 1</label>
                <input
                  type="number"
                  min="0"
                  value={stock1}
                  onChange={(e) => setStock1(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-white border-2 border-blue-300 rounded-xl p-2 text-center font-black text-base text-blue-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-red-900 mb-1">الكمية في المخزون 2</label>
                <input
                  type="number"
                  min="0"
                  value={stock2}
                  onChange={(e) => setStock2(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-white border-2 border-red-300 rounded-xl p-2 text-center font-black text-base text-red-900 focus:outline-none focus:border-red-600"
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
              <label className="block text-[10px] font-bold text-blue-700 mb-1">سعر البيع</label>
              <input
                type="number"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-blue-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-red-700 mb-1">سعر الكراء</label>
              <input
                type="number"
                min="0"
                value={rentPrice}
                onChange={(e) => setRentPrice(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-red-700 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-sm transition-all min-h-[44px] flex items-center justify-center gap-1.5"
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
            <span className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-base font-bold">
              <ArrowLeftRight className="w-4 h-4 text-blue-600" />
            </span>
            <div>
              <h3 className="font-bold text-blue-600 text-sm sm:text-base">تحويل المخزون بين المخزن 1 و 2</h3>
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
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
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
                    ? 'bg-red-600 text-white border-red-600 shadow-sm' 
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
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl text-center flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-500" />
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
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-slate-300 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-blue-200 transition-all min-h-[44px]"
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
  
  // Multiple sizes (المقاسات المتوفرة)
  const initialSizes = useMemo(() => {
    if (item?.sizes && item.sizes.length > 0) return item.sizes;
    if (item?.size) return item.size.split(/[,،+/]/).map(s => s.trim()).filter(Boolean);
    return ['38'];
  }, [item]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(initialSizes);
  const [customSizeInput, setCustomSizeInput] = useState('');

  // Multiple colors (الألوان المتوفرة)
  const initialColors = useMemo(() => {
    if (item?.colors && item.colors.length > 0) return item.colors;
    if (item?.color) return item.color.split(/[,،+/]/).map(c => c.trim()).filter(Boolean);
    return ['أسود'];
  }, [item]);
  const [selectedColors, setSelectedColors] = useState<string[]>(initialColors);
  const [customColorInput, setCustomColorInput] = useState('');
  
  // Stock 1 & Stock 2
  const [stock1, setStock1] = useState<number>(initialS1);
  const [stock2, setStock2] = useState<number>(initialS2);

  const [imageUrl, setImageUrl] = useState(item?.imageUrl || '');
  const [description, setDescription] = useState(item?.description || '');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showInFormScanner, setShowInFormScanner] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Size management helpers
  const handleToggleSize = (sz: string) => {
    const trimmed = sz.trim();
    if (!trimmed) return;
    if (selectedSizes.includes(trimmed)) {
      if (selectedSizes.length > 1) {
        setSelectedSizes(selectedSizes.filter(s => s !== trimmed));
      }
    } else {
      setSelectedSizes([...selectedSizes, trimmed]);
    }
  };

  const handleAddCustomSize = () => {
    const trimmed = customSizeInput.trim();
    if (trimmed && !selectedSizes.includes(trimmed)) {
      setSelectedSizes([...selectedSizes, trimmed]);
      setCustomSizeInput('');
    }
  };

  const handleRemoveSize = (sz: string) => {
    if (selectedSizes.length > 1) {
      setSelectedSizes(selectedSizes.filter(s => s !== sz));
    }
  };

  // Color management helpers
  const handleToggleColor = (col: string) => {
    const trimmed = col.trim();
    if (!trimmed) return;
    if (selectedColors.includes(trimmed)) {
      if (selectedColors.length > 1) {
        setSelectedColors(selectedColors.filter(c => c !== trimmed));
      }
    } else {
      setSelectedColors([...selectedColors, trimmed]);
    }
  };

  const handleAddCustomColor = () => {
    const trimmed = customColorInput.trim();
    if (trimmed && !selectedColors.includes(trimmed)) {
      setSelectedColors([...selectedColors, trimmed]);
      setCustomColorInput('');
    }
  };

  const handleRemoveColor = (col: string) => {
    if (selectedColors.length > 1) {
      setSelectedColors(selectedColors.filter(c => c !== col));
    }
  };

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

    const validSizes = selectedSizes.length > 0 ? selectedSizes : ['38'];
    const validColors = selectedColors.length > 0 ? selectedColors : ['أسود'];

    onSubmit({
      name: name.trim(),
      barcode: barcode.trim(),
      category,
      purpose,
      buyCost: Number(buyCost),
      sellPrice: Number(sellPrice),
      rentPrice: Number(rentPrice),
      cautionAmount: Number(cautionAmount),
      size: validSizes.join('، '),
      color: validColors.join('، '),
      sizes: validSizes,
      colors: validColors,
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
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] sm:max-h-[92vh] overflow-y-auto overflow-x-hidden safe-bottom animate-in fade-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden shrink-0" />
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
          <h3 className="font-black text-blue-600 text-base sm:text-lg">
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
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-base sm:text-sm font-bold focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Barcode Field with In-Form Camera Scanner Button */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700">الباركود / الكود (EAN-13 أو Code-128)</label>
              <button
                type="button"
                onClick={() => setBarcode(Math.floor(100000000000 + Math.random() * 900000000000).toString())}
                className="text-[10px] text-blue-600 font-bold hover:underline"
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
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-blue-500 focus:outline-none"
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

          {/* Multiple Sizes Selection (إضافة لطاي المتوفرين) */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-blue-600" />
                <span>المقاسات المتوفرة (لطاي / Tailles) *</span>
              </label>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                {selectedSizes.length} مقاس محدد
              </span>
            </div>

            {/* Currently Selected Sizes Badges */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-white rounded-xl border border-slate-200 items-center">
              {selectedSizes.map(sz => (
                <span
                  key={sz}
                  className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-2xs animate-in zoom-in-95 duration-150"
                >
                  <span>{sz}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSize(sz)}
                    className="hover:bg-blue-700 rounded-full p-0.5 ml-0.5 transition-colors"
                    title="حذف هذا المقاس"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Quick Standard Size Selection Chips */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 block mb-1">اختر من المقاسات الجاهزة:</span>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                {STANDARD_SIZES.map(sz => {
                  const isSelected = selectedSizes.includes(sz);
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handleToggleSize(sz)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add Custom Size input */}
            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={customSizeInput}
                onChange={(e) => setCustomSizeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomSize();
                  }
                }}
                placeholder="أضف مقاس مخصص (مثال: 56 أو 36-38)..."
                className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddCustomSize}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </div>
          </div>

          {/* Multiple Colors Selection (إضافة الألوان المتوفرة) */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-red-600" />
                <span>الألوان المتوفرة (Couleurs) *</span>
              </label>
              <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">
                {selectedColors.length} لون محدد
              </span>
            </div>

            {/* Currently Selected Colors Badges */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-white rounded-xl border border-slate-200 items-center">
              {selectedColors.map(col => (
                <span
                  key={col}
                  className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-2xs animate-in zoom-in-95 duration-150"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/40 shrink-0"
                    style={{ backgroundColor: getColorHex(col) }}
                  />
                  <span>{col}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveColor(col)}
                    className="hover:bg-slate-800 rounded-full p-0.5 ml-0.5 transition-colors text-slate-300 hover:text-white"
                    title="حذف هذا اللون"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Quick Popular Color Selection Chips */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 block mb-1">اختر من الألوان الشائعة:</span>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                {POPULAR_COLORS.map(c => {
                  const isSelected = selectedColors.includes(c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => handleToggleColor(c.name)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add Custom Color input */}
            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={customColorInput}
                onChange={(e) => setCustomColorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomColor();
                  }
                }}
                placeholder="أضف لون مخصص (مثال: بترولي، موطارد، ترابي)..."
                className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-red-500"
              />
              <button
                type="button"
                onClick={handleAddCustomColor}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
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
                <label className="block text-[11px] font-bold text-blue-900 mb-1 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-blue-600" />
                  <span>المخزون 1 (المحل / المعرض)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock1}
                  onChange={(e) => setStock1(Number(e.target.value))}
                  className="w-full border border-blue-200 rounded-xl px-2.5 py-1.5 text-sm font-bold text-blue-950 text-center focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <label className="block text-[11px] font-bold text-red-900 mb-1 flex items-center gap-1">
                  <Warehouse className="w-3.5 h-3.5 text-red-600" />
                  <span>المخزون 2 (المستودع)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock2}
                  onChange={(e) => setStock2(Number(e.target.value))}
                  className="w-full border border-red-200 rounded-xl px-2.5 py-1.5 text-sm font-bold text-red-950 text-center focus:outline-none focus:border-red-400"
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
              <label className="block text-[10px] font-bold text-blue-700 mb-1">سعر الكراء (دج)</label>
              <input
                type="number"
                min="0"
                value={rentPrice}
                onChange={(e) => setRentPrice(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-black text-blue-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1">العربون (Caution)</label>
              <input
                type="number"
                min="0"
                value={cautionAmount}
                onChange={(e) => setCautionAmount(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-red-700 mb-1">سعر البيع (دج)</label>
              <input
                type="number"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-red-700 focus:outline-none"
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
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md shadow-blue-200 active:scale-[0.98] min-h-[44px]"
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
