import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ClothItem, ClothVariant, PurposeType, RawMaterial, Supplier } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { LettersInput, NumbersInput } from './Shared';
import { RawMaterialsSection } from './RawMaterialsSection';
import { ProductVariantsModal } from './ProductVariantsModal';
import { isValidImageFileType, generateSecureImageFilename, sanitizeText, sanitizeNumericAmount } from '../utils/security';
import { Store, Warehouse, ArrowLeftRight, Camera, X, Check, Package, Shirt, Tag, AlertTriangle, Upload, Trash2, Palette, Ruler, Plus, Sparkles, Filter, CheckCircle2, Scissors, DollarSign } from 'lucide-react';

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
  rawMaterials?: RawMaterial[];
  suppliers?: Supplier[];
  onAddCloth: (item: any) => void;
  onUpdateCloth: (id: string, item: any) => void;
  onDeleteCloth: (id: string) => void;
  onAddRawMaterial?: (mat: RawMaterial) => void;
  onUpdateRawMaterial?: (id: string, mat: Partial<RawMaterial>) => void;
  onDeleteRawMaterial?: (id: string) => void;
  onScanBarcode?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = React.memo(({
  clothes,
  rawMaterials = [],
  suppliers = [],
  onAddCloth,
  onUpdateCloth,
  onDeleteCloth,
  onAddRawMaterial,
  onUpdateRawMaterial,
  onDeleteRawMaterial
}) => {
  const [inventoryTab, setInventoryTab] = useState<'clothes' | 'raw_materials'>('clothes');
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
  const [variantsModalItem, setVariantsModalItem] = useState<ClothItem | null>(null);

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
  
  // Financial valuations for stock (ثمن القيمة، ثمن البيع، وهامش الربح)
  const totalCostReadyClothes = clothes.reduce((sum, c) => sum + (c.buyCost * getItemTotalStock(c)), 0);
  const totalSellReadyClothes = clothes.reduce((sum, c) => sum + (c.sellPrice * getItemTotalStock(c)), 0);
  const expectedProfitReadyClothes = totalSellReadyClothes - totalCostReadyClothes;

  // Raw Materials valuation (السلع الأولية بالرولو والأمتار)
  const totalRawRolls = rawMaterials.reduce((sum, m) => sum + (m.rollCount || 0), 0);
  const totalRawMeters = rawMaterials.reduce((sum, m) => sum + (m.totalMeters || 0), 0);
  const totalRawMaterialsCost = rawMaterials.reduce((sum, m) => sum + (m.totalCostValue || (m.totalMeters * m.costPerMeter) || 0), 0);
  
  // Combined capital of all store inventory & fabrics
  const grandTotalStoreCapital = totalCostReadyClothes + totalRawMaterialsCost;

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
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-blue-600 flex items-center gap-2">
            <span>مخزون المحل والسلع (Stock & Tissus)</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            متابعة دقيقة للفساتين الجاهزة (المخزن 1 و 2) والسلع الأولية والأقمشة بالرولو مع احتساب رأس المال وثمن البيع.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Main Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold w-full sm:w-auto">
            <button
              onClick={() => setInventoryTab('clothes')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
                inventoryTab === 'clothes'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shirt className="w-4 h-4" />
              <span>فساتين وملابس جاهزة ({clothes.length})</span>
            </button>
            <button
              onClick={() => setInventoryTab('raw_materials')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
                inventoryTab === 'raw_materials'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>سلع أولية وأقمشة بالرولو ({rawMaterials.length})</span>
            </button>
          </div>

          {inventoryTab === 'clothes' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowScannerModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-xs active:scale-95"
                title="مسح باركود لإضافة أو تحويل كمية المخزن"
              >
                <span>📷</span>
                <span>إضافة بالباركود</span>
              </button>

              <button
                onClick={() => {
                  setInitialBarcodeForAdd('');
                  setShowAddModal(true);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-blue-900 hover:bg-black text-white px-4 py-2.5 rounded-2xl text-xs font-black transition-all shadow-xs active:scale-95"
              >
                + قطعة جديدة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Financial Valuation Cards: ثمن القيمة، ثمن البيع، والسلع الأولية */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-700">💰 مجموع السلعة بثمن القيمة (التكلفة)</span>
            <span className="text-lg">🏷️</span>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">{totalCostReadyClothes.toLocaleString()} <span className="text-xs font-bold text-slate-500">دج</span></p>
          <span className="text-[11px] text-slate-500 font-medium">رأس مال شراء الملابس الجاهزة</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-blue-100 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-blue-900">💎 مجموع السلعة بثمن البيع</span>
            <span className="text-lg">🛍️</span>
          </div>
          <p className="text-2xl font-black text-blue-900 font-mono">{totalSellReadyClothes.toLocaleString()} <span className="text-xs font-bold text-blue-800">دج</span></p>
          <span className="text-[11px] text-blue-700 font-medium">الأرباح المتوقعة: +{expectedProfitReadyClothes.toLocaleString()} دج</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-blue-600">🧵 مجموع السلع الأولية والأقمشة</span>
            <span className="text-lg">✨</span>
          </div>
          <p className="text-2xl font-black text-blue-700 font-mono">{totalRawMaterialsCost.toLocaleString()} <span className="text-xs font-bold text-blue-600">دج</span></p>
          <span className="text-[11px] text-slate-500 font-medium">{totalRawRolls} رولو ({totalRawMeters} متر أقمشة)</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-blue-100 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-blue-900">👑 إجمالي رأس مال المحل المندمج</span>
            <span className="text-lg">🏛️</span>
          </div>
          <p className="text-2xl font-black text-blue-900 font-mono">{grandTotalStoreCapital.toLocaleString()} <span className="text-xs font-bold text-blue-900">دج</span></p>
          <span className="text-[11px] text-slate-500 font-medium">ملابس جاهزة + أقمشة وسلع أولية</span>
        </div>
      </div>

      {/* Render Subview: Raw Materials vs Clothes */}
      {inventoryTab === 'raw_materials' ? (
        <RawMaterialsSection
          rawMaterials={rawMaterials}
          suppliers={suppliers}
          onAddRawMaterial={onAddRawMaterial || (() => {})}
          onUpdateRawMaterial={onUpdateRawMaterial || (() => {})}
          onDeleteRawMaterial={onDeleteRawMaterial || (() => {})}
        />
      ) : (
        <>
          {/* Stock 1 & Stock 2 Location Quantities */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-blue-600">🏬 المخزون 1 (صالة العرض)</span>
                <span className="text-lg">🏪</span>
              </div>
              <p className="text-2xl font-black text-slate-900">{totalStock1.toLocaleString()} <span className="text-xs font-bold text-slate-700">قطعة</span></p>
              <span className="text-[11px] text-slate-600 font-medium">مخزن المحل المعروض للزبائن</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-blue-100 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-blue-900">📦 المخزون 2 (المستودع)</span>
                <span className="text-lg">🏭</span>
              </div>
              <p className="text-2xl font-black text-slate-900">{totalStock2.toLocaleString()} <span className="text-xs font-bold text-slate-700">قطعة</span></p>
              <span className="text-[11px] text-slate-600 font-medium">المستودع والتخزين الاحتياطي</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700">📊 إجمالي القطع في المخزنين</span>
                <span className="text-lg">👗</span>
              </div>
              <p className="text-2xl font-black text-slate-900">{grandTotalStock.toLocaleString()} <span className="text-xs font-bold text-slate-700">قطعة</span></p>
              <span className="text-[11px] text-slate-600 font-medium">مجموع المخزن 1 + المخزن 2</span>
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
                filterPurpose === 'all' ? 'bg-blue-900 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              الكل ({clothes.length})
            </button>
            <button
              onClick={() => setFilterPurpose('rent')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterPurpose === 'rent' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              👗 كراء ({clothes.filter(c => c.purpose === 'rent' || c.purpose === 'both').length})
            </button>
            <button
              onClick={() => setFilterPurpose('sell')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterPurpose === 'sell' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              🏷️ بيع ({clothes.filter(c => c.purpose === 'sell' || c.purpose === 'both').length})
            </button>

            <span className="w-px h-6 bg-blue-100 self-center mx-1 shrink-0" />

            {/* Stock Location Filters */}
            <button
              onClick={() => setFilterStockLoc('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'all' ? 'bg-blue-900 text-white shadow-xs' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              🏢 المخزنين معاً
            </button>
            <button
              onClick={() => setFilterStockLoc('stock1')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'stock1' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              🏬 مخزون 1 فقط
            </button>
            <button
              onClick={() => setFilterStockLoc('stock2')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'stock2' ? 'bg-blue-400 text-white shadow-xs' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              📦 مخزون 2 فقط
            </button>
            <button
              onClick={() => setFilterStockLoc('low')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStockLoc === 'low' ? 'bg-black text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
            <span className="text-[11px] font-bold text-blue-500 shrink-0 flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5 text-blue-600" />
              <span>المقاس (لطاي):</span>
            </span>
            <button
              type="button"
              onClick={() => setFilterSize('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold shrink-0 transition-all ${
                filterSize === 'all' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
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
                    : 'bg-white text-blue-700 border-blue-100 hover:bg-blue-50'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>

          {/* Color Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-blue-500 shrink-0 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-blue-600" />
              <span>اللون:</span>
            </span>
            <button
              type="button"
              onClick={() => setFilterColor('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold shrink-0 transition-all ${
                filterColor === 'all' ? 'bg-blue-950 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
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
              className="bg-white rounded-3xl overflow-hidden border border-blue-100 hover:border-blue-400 shadow-xs hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between group hover:-translate-y-0.5"
            >
              {/* Product Image Box - Opens Colors & Sizes (Déclinaisons) Modal */}
              <div 
                onClick={() => setVariantsModalItem(item)}
                className="relative aspect-4/3 sm:aspect-16/10 bg-blue-50 overflow-hidden cursor-pointer flex items-center justify-center group"
                title="اضغط لعرض الألوان والمقاسات (Déclinaisons)"
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
                  <div className="flex flex-col items-center justify-center text-blue-300 gap-1.5 p-4">
                    <span className="text-3xl">👗</span>
                    <span className="text-[10px] font-bold">بدون صورة</span>
                  </div>
                )}

                {/* Purpose Badge on Top Left */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                  {item.purpose === 'both' && (
                    <span className="bg-blue-900/90 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs">
                      بيع + كراء
                    </span>
                  )}
                  {item.purpose === 'rent' && (
                    <span className="bg-blue-700/90 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs">
                      كراء 👗
                    </span>
                  )}
                  {item.purpose === 'sell' && (
                    <span className="bg-blue-500/90 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs">
                      بيع 🏷️
                    </span>
                  )}
                </div>

                {/* Category Badge on Top Right */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="bg-blue-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-xl">
                    {item.category}
                  </span>
                </div>

                {/* Colors & Sizes Badge Prompt on Image */}
                <div className="absolute bottom-2.5 left-2.5 bg-blue-900/90 group-hover:bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1.5 transition-all">
                  <span>✨</span>
                  <span>الألوان والمقاسات ({itemSizesList.length || 1})</span>
                </div>

                {/* Direct Image Zoom Button */}
                {item.imageUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImage({ url: item.imageUrl!, title: item.name });
                    }}
                    className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-xl bg-black/60 hover:bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                    title="تكبير الصورة كاملة"
                  >
                    🔍
                  </button>
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

                  {/* Available Sizes Badges - Click to open variants */}
                  <div 
                    onClick={() => setVariantsModalItem(item)}
                    className="mt-2 space-y-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                    title="انقر لعرض تفاصيل المقاسات والألوان (لطاي)"
                  >
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
                        <Palette className="w-3 h-3 text-blue-900" />
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
                      <span className={`font-black text-sm ${availableStock <= 0 ? 'text-black' : 'text-blue-700'}`}>
                        {availableStock} / {totalStock} قطعة
                      </span>
                    </div>
                  </div>

                  {/* Stock 1 and Stock 2 Breakdown Badges */}
                  <div className="pt-2 border-t border-slate-200/70 group-hover:border-blue-200/70 grid grid-cols-2 gap-2 text-[11px] transition-colors">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-1.5 flex items-center justify-between">
                      <span className="font-bold text-blue-800">🏬 مخزون 1:</span>
                      <span className={`font-black ${s1 <= 0 ? 'text-black' : 'text-blue-950'}`}>{s1} قطعة</span>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-1.5 flex items-center justify-between">
                      <span className="font-bold text-blue-800">📦 مخزون 2:</span>
                      <span className={`font-black ${s2 <= 0 ? 'text-black' : 'text-blue-950'}`}>{s2} قطعة</span>
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
                    className="p-2 bg-blue-50 hover:bg-black hover:text-white text-blue-900 rounded-xl text-xs font-bold transition-all active:scale-95 border border-blue-200 hover:border-black"
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

      {/* Colors & Sizes Variants Modal (نافذة الألوان والمقاسات عند الضغط على صورة المنتج) */}
      {variantsModalItem && (
        <ProductVariantsModal
          item={variantsModalItem}
          onClose={() => setVariantsModalItem(null)}
          onUpdateItem={(id, updatedFields) => {
            onUpdateCloth(id, updatedFields);
            setVariantsModalItem(prev => prev && prev.id === id ? { ...prev, ...updatedFields } : prev);
          }}
          onOpenFullImage={(url, title) => {
            setPreviewImage({ url, title });
          }}
        />
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
          onSave={(newStock1, newStock2, newBuyCost, newSellPrice, newRentPrice, updatedVariants) => {
            onUpdateCloth(stockModalItem.id, {
              stock1: newStock1,
              stock2: newStock2,
              stock: newStock1 + newStock2,
              buyCost: newBuyCost,
              sellPrice: newSellPrice,
              rentPrice: newRentPrice,
              ...(updatedVariants ? { variants: updatedVariants } : {})
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
        </>
      )}
    </div>
  );
});

// ==========================================
// Quick Stock Modal (إضافة وتحديث المخزون 1 والمخزون 2)
// ==========================================
interface QuickStockModalProps {
  item: ClothItem;
  onClose: () => void;
  onSave: (newStock1: number, newStock2: number, buyCost: number, sellPrice: number, rentPrice: number, updatedVariants?: ClothVariant[]) => void;
}

const QuickStockModal: React.FC<QuickStockModalProps> = ({ item, onClose, onSave }) => {
  const initialS1 = item.stock1 !== undefined ? item.stock1 : item.stock || 0;
  const initialS2 = item.stock2 !== undefined ? item.stock2 : 0;

  const [stock1, setStock1] = useState<number>(initialS1);
  const [stock2, setStock2] = useState<number>(initialS2);
  const [targetStock, setTargetStock] = useState<'stock1' | 'stock2'>('stock1');
  const [buyCost, setBuyCost] = useState<number>(item.buyCost || 0);
  const [sellPrice, setSellPrice] = useState<number>(item.sellPrice || 0);
  const [rentPrice, setRentPrice] = useState<number>(item.rentPrice || 0);

  // Selected variant for specific size/color update (if variants exist)
  const [selectedVariantId, setSelectedVariantId] = useState<string>('all');
  const [currentVariants, setCurrentVariants] = useState<ClothVariant[]>(item.variants || []);

  const handleAddQuick = (amount: number) => {
    if (selectedVariantId !== 'all' && currentVariants.length > 0) {
      setCurrentVariants(prev => {
        const next = prev.map(v => {
          if (v.id === selectedVariantId) {
            const newS1 = targetStock === 'stock1' ? Math.max(0, (v.stock1 || 0) + amount) : (v.stock1 || 0);
            const newS2 = targetStock === 'stock2' ? Math.max(0, (v.stock2 || 0) + amount) : (v.stock2 || 0);
            return {
              ...v,
              stock1: newS1,
              stock2: newS2,
              stock: newS1 + newS2
            };
          }
          return v;
        });
        const totalS1 = next.reduce((sum, v) => sum + (v.stock1 || 0), 0);
        const totalS2 = next.reduce((sum, v) => sum + (v.stock2 || 0), 0);
        setStock1(totalS1);
        setStock2(totalS2);
        return next;
      });
    } else {
      if (targetStock === 'stock1') {
        setStock1(prev => Math.max(0, prev + amount));
      } else {
        setStock2(prev => Math.max(0, prev + amount));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
      Math.max(0, stock1), 
      Math.max(0, stock2), 
      buyCost, 
      sellPrice, 
      rentPrice,
      currentVariants.length > 0 ? currentVariants : undefined
    );
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
          {/* Variant Selector if item has multiple sizes/colors */}
          {currentVariants.length > 0 && (
            <div className="space-y-1 bg-blue-50/50 p-2.5 rounded-2xl border border-blue-100">
              <label className="block text-[11px] font-bold text-blue-900">اختر المقاس واللون المراد تزويده (اختياري):</label>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="w-full bg-white border border-blue-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="all">📦 تعديل المخزون العام للقطعة</option>
                {currentVariants.map(v => (
                  <option key={v.id} value={v.id}>
                    اللون: {v.color} • المقاس: {v.size} (متوفر: {v.stock} قطعة)
                  </option>
                ))}
              </select>
            </div>
          )}

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
                    ? 'bg-black text-white border-black shadow-sm' 
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
                <label className="block text-[11px] font-black text-blue-900 mb-1">الكمية في المخزون 2</label>
                <input
                  type="number"
                  min="0"
                  value={stock2}
                  onChange={(e) => setStock2(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-white border-2 border-slate-300 rounded-xl p-2 text-center font-black text-base text-slate-900 focus:outline-none focus:border-slate-600"
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
              <label className="block text-[10px] font-bold text-slate-700 mb-1">سعر الكراء</label>
              <input
                type="number"
                min="0"
                value={rentPrice}
                onChange={(e) => setRentPrice(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none"
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
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
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
// Full Add/Edit Cloth Form Modal with Barcode Camera Button & Variant Stock Matrix
// ==========================================
interface ClothFormModalProps {
  item?: ClothItem | null;
  initialBarcode?: string;
  categories: string[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const ClothFormModal: React.FC<ClothFormModalProps> = ({ item, initialBarcode, categories, onClose, onSubmit }) => {
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
  
  // Multiple sizes (المقاسات المتوفرة / لطاي)
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

  // Variants state (تفاصيل المقاسات والألوان والكميات لكل لون)
  const [variants, setVariants] = useState<ClothVariant[]>(() => {
    if (item?.variants && item.variants.length > 0) {
      return item.variants;
    }
    // Generate initial variants combination
    const initialList: ClothVariant[] = [];
    const sizes = (item?.sizes && item.sizes.length > 0) ? item.sizes : (item?.size ? item.size.split(/[,،+/]/).map(s => s.trim()).filter(Boolean) : ['38']);
    const colors = (item?.colors && item.colors.length > 0) ? item.colors : (item?.color ? item.color.split(/[,،+/]/).map(c => c.trim()).filter(Boolean) : ['أسود']);
    
    const count = Math.max(1, sizes.length * colors.length);
    const s1 = item?.stock1 !== undefined ? item.stock1 : (item?.stock || 1);
    const s2 = item?.stock2 !== undefined ? item.stock2 : 0;
    
    sizes.forEach((sz, sIdx) => {
      colors.forEach((col, cIdx) => {
        const vId = `${Date.now()}_${sIdx}_${cIdx}_${Math.random().toString(36).substring(2, 6)}`;
        const allocatedS1 = count === 1 ? s1 : Math.max(0, Math.floor(s1 / count) || (sIdx === 0 && cIdx === 0 ? s1 : 0));
        const allocatedS2 = count === 1 ? s2 : Math.max(0, Math.floor(s2 / count) || (sIdx === 0 && cIdx === 0 ? s2 : 0));
        initialList.push({
          id: vId,
          code: item?.barcode ? `${item.barcode}-${sIdx + 1}` : '',
          size: sz,
          color: col,
          stock1: allocatedS1,
          stock2: allocatedS2,
          stock: allocatedS1 + allocatedS2,
          price: item?.sellPrice || 0,
          rentPrice: item?.rentPrice || 0
        });
      });
    });
    return initialList;
  });

  // Bulk fill inputs state
  const [bulkStock1, setBulkStock1] = useState<number>(1);
  const [bulkStock2, setBulkStock2] = useState<number>(0);
  const [showBulkFillBar, setShowBulkFillBar] = useState<boolean>(false);
  const [activeColorFilter, setActiveColorFilter] = useState<string>('all');

  const [imageUrl, setImageUrl] = useState(item?.imageUrl || '');
  const [description, setDescription] = useState(item?.description || '');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showInFormScanner, setShowInFormScanner] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize variants when sizes or colors change
  const syncVariants = (newSizes: string[], newColors: string[]) => {
    setVariants(prevVariants => {
      const updated: ClothVariant[] = [];
      const validSizes = newSizes.length > 0 ? newSizes : ['38'];
      const validColors = newColors.length > 0 ? newColors : ['أسود'];

      validColors.forEach((col, cIdx) => {
        validSizes.forEach((sz, sIdx) => {
          const existing = prevVariants.find(v => v.color.trim() === col.trim() && v.size.trim() === sz.trim());
          if (existing) {
            updated.push(existing);
          } else {
            const vId = `${Date.now()}_${cIdx}_${sIdx}_${Math.random().toString(36).substring(2, 6)}`;
            updated.push({
              id: vId,
              code: barcode ? `${barcode}-${cIdx + 1}${sIdx + 1}` : '',
              size: sz,
              color: col,
              stock1: 1,
              stock2: 0,
              stock: 1,
              price: sellPrice || 0,
              rentPrice: rentPrice || 0
            });
          }
        });
      });
      return updated;
    });
  };

  // Size management helpers
  const handleToggleSize = (sz: string) => {
    const trimmed = sz.trim();
    if (!trimmed) return;
    let nextSizes: string[];
    if (selectedSizes.includes(trimmed)) {
      if (selectedSizes.length > 1) {
        nextSizes = selectedSizes.filter(s => s !== trimmed);
      } else {
        return;
      }
    } else {
      nextSizes = [...selectedSizes, trimmed];
    }
    setSelectedSizes(nextSizes);
    syncVariants(nextSizes, selectedColors);
  };

  const handleAddCustomSize = () => {
    const trimmed = customSizeInput.trim();
    if (trimmed && !selectedSizes.includes(trimmed)) {
      const nextSizes = [...selectedSizes, trimmed];
      setSelectedSizes(nextSizes);
      setCustomSizeInput('');
      syncVariants(nextSizes, selectedColors);
    }
  };

  const handleRemoveSize = (sz: string) => {
    if (selectedSizes.length > 1) {
      const nextSizes = selectedSizes.filter(s => s !== sz);
      setSelectedSizes(nextSizes);
      syncVariants(nextSizes, selectedColors);
    }
  };

  // Color management helpers
  const handleToggleColor = (col: string) => {
    const trimmed = col.trim();
    if (!trimmed) return;
    let nextColors: string[];
    if (selectedColors.includes(trimmed)) {
      if (selectedColors.length > 1) {
        nextColors = selectedColors.filter(c => c !== trimmed);
      } else {
        return;
      }
    } else {
      nextColors = [...selectedColors, trimmed];
    }
    setSelectedColors(nextColors);
    syncVariants(selectedSizes, nextColors);
  };

  const handleAddCustomColor = () => {
    const trimmed = customColorInput.trim();
    if (trimmed && !selectedColors.includes(trimmed)) {
      const nextColors = [...selectedColors, trimmed];
      setSelectedColors(nextColors);
      setCustomColorInput('');
      syncVariants(selectedSizes, nextColors);
    }
  };

  const handleRemoveColor = (col: string) => {
    if (selectedColors.length > 1) {
      const nextColors = selectedColors.filter(c => c !== col);
      setSelectedColors(nextColors);
      syncVariants(selectedSizes, nextColors);
    }
  };

  // Variant quantity handlers
  const handleUpdateVariantStock = (vId: string, field: 'stock1' | 'stock2', value: number) => {
    const val = Math.max(0, value || 0);
    setVariants(prev => prev.map(v => {
      if (v.id === vId) {
        const s1 = field === 'stock1' ? val : (v.stock1 || 0);
        const s2 = field === 'stock2' ? val : (v.stock2 || 0);
        return {
          ...v,
          stock1: s1,
          stock2: s2,
          stock: s1 + s2
        };
      }
      return v;
    }));
  };

  const handleDeleteVariant = (vId: string) => {
    if (variants.length <= 1) {
      alert('يجب أن تتوفر القطعة على الأقل على مقاس ولون واحد!');
      return;
    }
    setVariants(prev => prev.filter(v => v.id !== vId));
  };

  // Bulk fill for all variants
  const handleApplyBulkToAll = () => {
    const s1 = Math.max(0, bulkStock1 || 0);
    const s2 = Math.max(0, bulkStock2 || 0);
    setVariants(prev => prev.map(v => ({
      ...v,
      stock1: s1,
      stock2: s2,
      stock: s1 + s2
    })));
    setShowBulkFillBar(false);
  };

  // Bulk fill for a specific color
  const handleApplyBulkToColor = (targetColor: string, s1: number, s2: number) => {
    setVariants(prev => prev.map(v => {
      if (v.color.trim() === targetColor.trim()) {
        return {
          ...v,
          stock1: s1,
          stock2: s2,
          stock: s1 + s2
        };
      }
      return v;
    }));
  };

  // Calculated totals
  const totalStock1 = variants.reduce((sum, v) => sum + (Number(v.stock1) || 0), 0);
  const totalStock2 = variants.reduce((sum, v) => sum + (Number(v.stock2) || 0), 0);
  const totalCalculatedStock = totalStock1 + totalStock2;

  // Compress & convert file to Base64 with security checks
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFileType(file.type, file.name)) {
      alert('⚠️ ملف غير مسموح به! يرجى رفع صورة فقط (JPG, PNG, WEBP).');
      if (e.target) e.target.value = '';
      return;
    }

    const { secureName } = generateSecureImageFilename(file.name, file.type);
    console.log(`[Security] Image file verified: ${secureName}`);

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
            width = MAX_HEIGHT;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

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
      stock1: totalStock1,
      stock2: totalStock2,
      stock: totalCalculatedStock,
      variants: variants.length > 0 ? variants : undefined,
      rentedCount: item?.rentedCount || 0,
      inCleaningCount: item?.inCleaningCount || 0,
      imageUrl: imageUrl.trim() || undefined,
      description: description.trim()
    });
  };

  // Group variants by color for clean display
  const colorGroups = useMemo(() => {
    const groups: { [color: string]: ClothVariant[] } = {};
    variants.forEach(v => {
      const col = v.color || 'عام';
      if (!groups[col]) groups[col] = [];
      groups[col].push(v);
    });
    return groups;
  }, [variants]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none" dir="rtl">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-3xl max-w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto overflow-x-hidden safe-bottom animate-in fade-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden shrink-0" />
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
          <div>
            <h3 className="font-black text-blue-900 text-base sm:text-lg flex items-center gap-2">
              <span>{item ? 'تعديل قطعة الملابس والمخزون' : 'إضافة قطعة ملابس / فستان جديد'}</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg font-bold">
                المقاسات والألوان والكميات
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">أدخل لطاي المتوفرين والألوان وحدد الكمية المتوفرة في كل لون ومقاس</p>
          </div>
          <button 
            onClick={onClose} 
            aria-label="إغلاق"
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم القطعة أو الفستان * (حروف فقط)</label>
              <LettersInput
                required
                value={name}
                onChange={setName}
                placeholder="مثال: فستان سهرة مخمل مطرز، قفطان تقليدي..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-base sm:text-sm font-bold focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">الباركود / الكود (أرقام فقط)</label>
                <button
                  type="button"
                  onClick={() => setBarcode(Math.floor(100000000000 + Math.random() * 900000000000).toString())}
                  className="text-[10px] text-blue-600 font-bold hover:underline"
                >
                  توليد كود عشوائي
                </button>
              </div>
              <div className="flex gap-1.5">
                <NumbersInput
                  value={barcode}
                  onChange={setBarcode}
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
          </div>

          {/* Category & Purpose */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-slate-400 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">طبيعة القطعة (الاستخدام)</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'both', label: 'كراء + بيع' },
                  { id: 'rent', label: 'كراء فقط' },
                  { id: 'sell', label: 'بيع فقط' }
                ].map(p => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPurpose(p.id as PurposeType)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border text-center transition-all ${
                      purpose === p.id 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Image Upload */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700">صورة المنتج / الفستان</label>
            <div className="flex items-center gap-3">
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

          {/* SIZES SELECTION SECTION (المقاسات المتوفرة / لطاي) */}
          <div className="bg-blue-50/40 p-3.5 rounded-2xl border border-blue-100 space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-blue-600" />
                <span>1. اختر المقاسات المتوفرة (لطاي / Tailles) * :</span>
              </label>
              <span className="text-[11px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200">
                {selectedSizes.length} مقاس محدد
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {STANDARD_SIZES.map((sz) => {
                const isSelected = selectedSizes.includes(sz);
                return (
                  <button
                    type="button"
                    key={sz}
                    onClick={() => handleToggleSize(sz)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black border transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs scale-105'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    {sz} {isSelected && '✓'}
                  </button>
                );
              })}
            </div>

            {/* Add Custom Size */}
            <div className="flex gap-2 pt-1 border-t border-blue-100/60">
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
                placeholder="أضف مقاس مخصص (مثال: 56، 6XL، تفصيل خاص...)"
                className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddCustomSize}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مقاس</span>
              </button>
            </div>
          </div>

          {/* COLORS SELECTION SECTION (الألوان المتوفرة) */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-blue-900" />
                <span>2. اختر الألوان المتوفرة (Couleurs) * :</span>
              </label>
              <span className="text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                {selectedColors.length} لون محدد
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {POPULAR_COLORS.map((col) => {
                const isSelected = selectedColors.includes(col.name);
                return (
                  <button
                    type="button"
                    key={col.name}
                    onClick={() => handleToggleColor(col.name)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-blue-900 text-white border-blue-900 shadow-xs scale-105'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                      style={{ backgroundColor: col.hex }}
                    />
                    <span>{col.name}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>

            {/* Add Custom Color */}
            <div className="flex gap-2 pt-1 border-t border-slate-200">
              <LettersInput
                value={customColorInput}
                onChange={setCustomColorInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomColor();
                  }
                }}
                placeholder="أضف لون آخر (حروف فقط: بترولي، موطارد، زيتي...)"
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-900"
              />
              <button
                type="button"
                onClick={handleAddCustomColor}
                className="bg-slate-800 hover:bg-black text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة لون</span>
              </button>
            </div>
          </div>

          {/* QUANTITY MATRIX PER COLOR & SIZE (الكمية المتوفرة في كل لون ومقاس) */}
          <div className="bg-gradient-to-b from-blue-50/70 to-slate-50 p-3.5 sm:p-4 rounded-3xl border-2 border-blue-200/80 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-2 border-b border-blue-200/60">
              <div>
                <h4 className="text-xs sm:text-sm font-black text-blue-950 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-700" />
                  <span>3. جدول الكمية المتوفرة في كل لون ومقاس (لطاي)</span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  حدد عدد القطع الموجودة في المحل (المخزن 1) وفي المستودع (المخزن 2) لكل تشكيلة
                </p>
              </div>

              {/* Total Stock Summary Pill */}
              <div className="flex items-center gap-2 self-start sm:self-auto bg-white px-3 py-1.5 rounded-2xl border border-blue-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500">المجموع:</span>
                <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                  <span className="text-blue-700">🏬 {totalStock1}</span>
                  <span>+</span>
                  <span className="text-blue-950">📦 {totalStock2}</span>
                  <span>=</span>
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg">{totalCalculatedStock} قطعة</span>
                </span>
              </div>
            </div>

            {/* Quick Bulk Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white/90 p-2.5 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkFillBar(!showBulkFillBar)}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>⚡ تعبئة كمية موحدة للجميع ({variants.length} تشكيلة)</span>
                </button>
              </div>

              {/* Color filter tabs if multiple colors */}
              {Object.keys(colorGroups).length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5">
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">تصفية:</span>
                  <button
                    type="button"
                    onClick={() => setActiveColorFilter('all')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 transition-colors ${
                      activeColorFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    الكل ({variants.length})
                  </button>
                  {Object.keys(colorGroups).map(col => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setActiveColorFilter(col)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 inline-flex items-center gap-1 transition-colors ${
                        activeColorFilter === col ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getColorHex(col) }} />
                      <span>{col}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bulk Fill Popdown Bar */}
            {showBulkFillBar && (
              <div className="bg-blue-900 text-white p-3 rounded-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                    <span>تطبيق نفس الكمية على جميع المقاسات والألوان:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBulkFillBar(false)}
                    className="text-blue-300 hover:text-white text-xs font-bold"
                  >
                    إلغاء
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-center gap-2 bg-blue-950/60 p-1.5 rounded-xl border border-blue-700/50">
                    <span className="text-[11px] text-blue-200 font-bold shrink-0">🏬 المحل:</span>
                    <input
                      type="number"
                      min="0"
                      value={bulkStock1}
                      onChange={(e) => setBulkStock1(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-white text-blue-950 font-black rounded-lg px-2 py-1 text-center text-xs focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-blue-950/60 p-1.5 rounded-xl border border-blue-700/50">
                    <span className="text-[11px] text-blue-200 font-bold shrink-0">📦 المستودع:</span>
                    <input
                      type="number"
                      min="0"
                      value={bulkStock2}
                      onChange={(e) => setBulkStock2(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-white text-blue-950 font-black rounded-lg px-2 py-1 text-center text-xs focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyBulkToAll}
                    className="bg-blue-500 hover:bg-blue-400 text-white font-black text-xs py-2 px-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>تطبيق على الكل ({variants.length} تشكيلة)</span>
                  </button>
                </div>
              </div>
            )}

            {/* List of Colors and their Sizes with Stock Controls */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {(Object.entries(colorGroups) as [string, ClothVariant[]][])
                .filter(([col]) => activeColorFilter === 'all' || activeColorFilter === col)
                .map(([col, colorVariants]) => {
                  const colorStock1 = colorVariants.reduce((sum, v) => sum + (Number(v.stock1) || 0), 0);
                  const colorStock2 = colorVariants.reduce((sum, v) => sum + (Number(v.stock2) || 0), 0);
                  const colorTotal = colorStock1 + colorStock2;
                  const colHex = getColorHex(col);

                  return (
                    <div key={col} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                      {/* Color Header Banner */}
                      <div className="bg-slate-50/90 px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-xs shrink-0"
                            style={{ backgroundColor: colHex }}
                          />
                          <span className="font-black text-slate-900 text-xs">اللون: {col}</span>
                          <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-bold">
                            {colorVariants.length} مقاسات
                          </span>
                        </div>

                        {/* Quick stock badge for this color */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600">
                            مجموع اللون: <strong className="text-blue-700">{colorTotal}</strong> قطعة (🏬 {colorStock1} | 📦 {colorStock2})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const s1 = prompt(`أدخل الكمية في المحل (Stock 1) لجميع مقاسات اللون "${col}":`, '1');
                              if (s1 === null) return;
                              const s2 = prompt(`أدخل الكمية في المستودع (Stock 2) لجميع مقاسات اللون "${col}":`, '0');
                              if (s2 === null) return;
                              handleApplyBulkToColor(col, Math.max(0, Number(s1) || 0), Math.max(0, Number(s2) || 0));
                            }}
                            className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition-colors"
                            title="تطبيق كمية سريعة على جميع مقاسات هذا اللون"
                          >
                            ⚡ تعبئة سريعة
                          </button>
                        </div>
                      </div>

                      {/* Sizes for this Color */}
                      <div className="p-2.5 divide-y divide-slate-100">
                        {colorVariants.map((v) => {
                          const vS1 = Number(v.stock1) || 0;
                          const vS2 = Number(v.stock2) || 0;
                          const vTotal = vS1 + vS2;

                          return (
                            <div key={v.id} className="py-2 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              {/* Size Badge & Details */}
                              <div className="flex items-center gap-2">
                                <span className="w-11 text-center bg-blue-50 border border-blue-200 text-blue-900 font-black text-xs py-1 rounded-xl shrink-0">
                                  {v.size}
                                </span>
                                <div>
                                  <span className="text-xs font-bold text-slate-800">
                                    مقاس {v.size} - {v.color}
                                  </span>
                                  {v.code && (
                                    <span className="text-[10px] text-slate-400 font-mono ml-1">#{v.code}</span>
                                  )}
                                </div>
                              </div>

                              {/* Quantity Adjusters for Stock 1 & Stock 2 */}
                              <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap justify-end">
                                {/* Stock 1 (Store) */}
                                <div className="flex items-center gap-1 bg-blue-50/60 border border-blue-200/80 px-2 py-1 rounded-xl">
                                  <span className="text-[10px] font-bold text-blue-900 shrink-0">🏬 المحل:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateVariantStock(v.id, 'stock1', vS1 - 1)}
                                    className="w-5 h-5 rounded-md bg-white hover:bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center border border-blue-200 active:scale-95"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={vS1}
                                    onChange={(e) => handleUpdateVariantStock(v.id, 'stock1', Number(e.target.value))}
                                    className="w-10 bg-white border border-blue-200 rounded-md text-center text-xs font-black text-blue-900 py-0.5 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateVariantStock(v.id, 'stock1', vS1 + 1)}
                                    className="w-5 h-5 rounded-md bg-white hover:bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center border border-blue-200 active:scale-95"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Stock 2 (Warehouse) */}
                                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-1 rounded-xl">
                                  <span className="text-[10px] font-bold text-slate-700 shrink-0">📦 المستودع:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateVariantStock(v.id, 'stock2', vS2 - 1)}
                                    className="w-5 h-5 rounded-md bg-white hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center border border-slate-300 active:scale-95"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={vS2}
                                    onChange={(e) => handleUpdateVariantStock(v.id, 'stock2', Number(e.target.value))}
                                    className="w-10 bg-white border border-slate-300 rounded-md text-center text-xs font-black text-slate-900 py-0.5 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateVariantStock(v.id, 'stock2', vS2 + 1)}
                                    className="w-5 h-5 rounded-md bg-white hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center border border-slate-300 active:scale-95"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Variant Total Pill */}
                                <span className={`text-[11px] font-black px-2 py-1 rounded-lg border shrink-0 ${
                                  vTotal > 0 ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                                }`}>
                                  = {vTotal}
                                </span>

                                {/* Delete variant button if not available */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariant(v.id)}
                                  className="w-6 h-6 rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0"
                                  title="حذف هذا المقاس من هذا اللون"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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

          {/* Pricing Section */}
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
              <label className="block text-[10px] font-bold text-slate-800 mb-1">سعر البيع (دج)</label>
              <input
                type="number"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none"
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
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-200 active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {item ? 'حفظ وتحديث بيانات القطعة وتوزيع الكميات' : 'تأكيد وإضافة القطعة مع تفصيل المقاسات والكميات'}
            </span>
            <span className="bg-blue-800 px-2.5 py-0.5 rounded-lg text-xs font-black">
              المجموع: {totalCalculatedStock} قطعة
            </span>
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
