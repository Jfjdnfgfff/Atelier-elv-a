import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ClothItem, ClothVariant, PurposeType, RawMaterial, Supplier } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { LettersInput, NumbersInput } from './Shared';
import { RawMaterialsSection } from './RawMaterialsSection';
import { ProductVariantsModal } from './ProductVariantsModal';
import { VirtualizedClothGrid } from './VirtualizedClothGrid';
import { SecurityPasswordModal, checkSecurityPin } from './SecurityPasswordModal';
import { isValidImageFileType, generateSecureImageFilename, sanitizeText, sanitizeNumericAmount } from '../utils/security';
import { processImageToVariants, getListImage } from '../utils/imageUtils';
import { imageStore } from '../utils/imageStore';
import { ImagePreviewModal } from './ImagePreviewModal';
import { AsyncProductImage } from './AsyncProductImage';
import { Store, Warehouse, ArrowLeftRight, Camera, X, Check, Package, Shirt, Tag, AlertTriangle, Upload, Trash2, Palette, Ruler, Plus, Sparkles, Filter, CheckCircle2, Scissors, DollarSign, Lock, Eye, EyeOff, Pencil, ShoppingBag, Landmark, Building2, Zap, ChevronLeft, ChevronRight, Search, Loader2, Barcode } from 'lucide-react';

export const STANDARD_SIZES = [
  '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54',
  'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL',
  'Standard', 'Sur Mesure (تفصيل)'
];

export interface ColorDefinition {
  name: string;
  hex: string;
  border?: boolean;
  category?: 'basics' | 'yellow_gold' | 'red_pink' | 'blue' | 'green' | 'purple' | 'earth';
}

export const POPULAR_COLORS: ColorDefinition[] = [
  // 1. درجات الأصفر والذهبي (Yellows & Golds) - مطلوب بشكل خاص من المستخدم
  { name: 'أصفر', hex: '#EAB308', border: true, category: 'yellow_gold' },
  { name: 'أصفر كناري', hex: '#FACC15', border: true, category: 'yellow_gold' },
  { name: 'أصفر ليموني', hex: '#FEF08A', border: true, category: 'yellow_gold' },
  { name: 'أصفر خردلي (موطارد)', hex: '#CA8A04', border: false, category: 'yellow_gold' },
  { name: 'ذهبي ملكي', hex: '#D97706', border: false, category: 'yellow_gold' },
  { name: 'ذهبي برّاق', hex: '#F59E0B', border: false, category: 'yellow_gold' },
  { name: 'نحاسي', hex: '#B45309', border: false, category: 'yellow_gold' },
  { name: 'برونزي', hex: '#78350F', border: false, category: 'yellow_gold' },

  // 2. الألوان الأساسية والمحايدة (Basics & Neutrals)
  { name: 'أسود', hex: '#000000', border: false, category: 'basics' },
  { name: 'أبيض', hex: '#FFFFFF', border: true, category: 'basics' },
  { name: 'أوف وايت (عاجي)', hex: '#F8FAFC', border: true, category: 'basics' },
  { name: 'سكري (كريمي)', hex: '#FEF9C3', border: true, category: 'basics' },
  { name: 'بيج', hex: '#E2D9C8', border: true, category: 'basics' },
  { name: 'نيود (ترابي)', hex: '#D4B996', border: true, category: 'basics' },
  { name: 'رمادي', hex: '#64748B', border: false, category: 'basics' },
  { name: 'رمادي فاتح', hex: '#CBD5E1', border: true, category: 'basics' },
  { name: 'فضي', hex: '#94A3B8', border: false, category: 'basics' },

  // 3. درجات الأحمر والوردي والبرتقالي (Reds, Pinks & Oranges)
  { name: 'أحمر', hex: '#DC2626', border: false, category: 'red_pink' },
  { name: 'أحمر ملكي', hex: '#B91C1C', border: false, category: 'red_pink' },
  { name: 'بوردو', hex: '#881337', border: false, category: 'red_pink' },
  { name: 'عنابي (دم الغزال)', hex: '#991B1B', border: false, category: 'red_pink' },
  { name: 'برغندي', hex: '#4C0519', border: false, category: 'red_pink' },
  { name: 'وردي', hex: '#EC4899', border: false, category: 'red_pink' },
  { name: 'وردي بودري', hex: '#FBCFE8', border: true, category: 'red_pink' },
  { name: 'فوشيا', hex: '#C026D3', border: false, category: 'red_pink' },
  { name: 'مرجاني (كوراي)', hex: '#F43F5E', border: false, category: 'red_pink' },
  { name: 'برتقالي', hex: '#EA580C', border: false, category: 'red_pink' },
  { name: 'خوخي (مشمشي)', hex: '#FB923C', border: false, category: 'red_pink' },
  { name: 'سلمون', hex: '#FDA4AF', border: false, category: 'red_pink' },

  // 4. درجات الأزرق والنيلي (Blues & Teals)
  { name: 'أزرق ملكي', hex: '#1D4ED8', border: false, category: 'blue' },
  { name: 'كحلي', hex: '#1E293B', border: false, category: 'blue' },
  { name: 'أزرق نيلي', hex: '#3730A3', border: false, category: 'blue' },
  { name: 'أزرق سماوي', hex: '#38BDF8', border: false, category: 'blue' },
  { name: 'تركواز (فيروزي)', hex: '#06B6D4', border: false, category: 'blue' },
  { name: 'أزرق بترولي', hex: '#0E7490', border: false, category: 'blue' },
  { name: 'تيل (أزرق مخضر)', hex: '#0D9488', border: false, category: 'blue' },

  // 5. درجات الأخضر والزيتي (Greens & Olives)
  { name: 'أخضر زمردي', hex: '#059669', border: false, category: 'green' },
  { name: 'أخضر ملكي', hex: '#064E3B', border: false, category: 'green' },
  { name: 'زيتي (كاكي)', hex: '#4D7C0F', border: false, category: 'green' },
  { name: 'أخضر فستقي', hex: '#84CC16', border: false, category: 'green' },
  { name: 'نعناعي (مينت)', hex: '#6EE7B7', border: true, category: 'green' },
  { name: 'أخضر تفاحي', hex: '#A3E635', border: false, category: 'green' },

  // 6. درجات البنفسجي واللافندر (Purples & Lilacs)
  { name: 'بنفسجي', hex: '#7C3AED', border: false, category: 'purple' },
  { name: 'موف', hex: '#A855F7', border: false, category: 'purple' },
  { name: 'ليلكي (لافندر)', hex: '#C084FC', border: false, category: 'purple' },
  { name: 'برقوقي (باذنجاني)', hex: '#581C87', border: false, category: 'purple' },

  // 7. درجات البني والألوان الترابية (Browns & Earthy)
  { name: 'بني شوكولا', hex: '#451A03', border: false, category: 'earth' },
  { name: 'بني كستنائي', hex: '#78350F', border: false, category: 'earth' },
  { name: 'عسلي (جملي)', hex: '#D97706', border: false, category: 'earth' },
  { name: 'موكا', hex: '#A16207', border: false, category: 'earth' },
  { name: 'تيراكوتا (آجوري)', hex: '#C2410C', border: false, category: 'earth' }
];

export const getColorHex = (colorName: string): string => {
  if (!colorName) return '#94A3B8';
  const c = colorName.trim().toLowerCase();

  // 1. Direct or partial match in POPULAR_COLORS
  const found = POPULAR_COLORS.find(item => 
    c === item.name.toLowerCase() || 
    c.includes(item.name.toLowerCase()) || 
    item.name.toLowerCase().includes(c)
  );
  if (found) return found.hex;

  // 2. Yellows & Golds (أصفر ومشتقاته)
  if (c.includes('أصفر') || c.includes('اصفر') || c.includes('jaune') || c.includes('yellow')) return '#EAB308';
  if (c.includes('ليمون') || c.includes('كناري') || c.includes('citron')) return '#FACC15';
  if (c.includes('خردل') || c.includes('موطارد') || c.includes('moutarde') || c.includes('mustard')) return '#CA8A04';
  if (c.includes('ذهب') || c.includes('gold') || c.includes('or')) return '#D97706';
  if (c.includes('نحاس') || c.includes('cuivre') || c.includes('copper')) return '#B45309';
  if (c.includes('برونز') || c.includes('bronze')) return '#78350F';

  // 3. Neutrals (أسود، أبيض، بيج، رمادي...)
  if (c.includes('أسود') || c.includes('اسود') || c.includes('black') || c.includes('noir')) return '#000000';
  if (c.includes('أبيض') || c.includes('ابيض') || c.includes('white') || c.includes('blanc')) return '#FFFFFF';
  if (c.includes('عاج') || c.includes('أوف وايت') || c.includes('اوكرو') || c.includes('ivoire') || c.includes('ecru')) return '#F8FAFC';
  if (c.includes('سكر') || c.includes('كريم') || c.includes('creme') || c.includes('cream')) return '#FEF9C3';
  if (c.includes('بيج') || c.includes('beige')) return '#E2D9C8';
  if (c.includes('نيود') || c.includes('تراب') || c.includes('nude')) return '#D4B996';
  if (c.includes('رماد') || c.includes('gris') || c.includes('grey') || c.includes('gray')) return '#64748B';
  if (c.includes('فض') || c.includes('silver') || c.includes('argent')) return '#94A3B8';

  // 4. Reds & Pinks & Oranges
  if (c.includes('أحمر') || c.includes('احمر') || c.includes('red') || c.includes('rouge')) return '#DC2626';
  if (c.includes('بوردو') || c.includes('bordeaux')) return '#881337';
  if (c.includes('عناب') || c.includes('خمري') || c.includes('برغند') || c.includes('دم الغزال') || c.includes('burgundy')) return '#991B1B';
  if (c.includes('فوشيا') || c.includes('fuchsia')) return '#C026D3';
  if (c.includes('ورد') || c.includes('زهري') || c.includes('pink') || c.includes('rose')) return '#EC4899';
  if (c.includes('مرجان') || c.includes('كوراي') || c.includes('corail') || c.includes('coral')) return '#F43F5E';
  if (c.includes('برتقال') || c.includes('orange')) return '#EA580C';
  if (c.includes('مشمش') || c.includes('خوخ') || c.includes('peche') || c.includes('peach')) return '#FB923C';
  if (c.includes('سلمون') || c.includes('saumon') || c.includes('salmon')) return '#FDA4AF';

  // 5. Blues & Teals
  if (c.includes('أزرق') || c.includes('ازرق') || c.includes('blue') || c.includes('bleu')) return '#1D4ED8';
  if (c.includes('كحل') || c.includes('marine') || c.includes('navy')) return '#1E293B';
  if (c.includes('نيلي') || c.includes('indigo')) return '#3730A3';
  if (c.includes('سماو') || c.includes('ciel') || c.includes('sky')) return '#38BDF8';
  if (c.includes('تركواز') || c.includes('فيروز') || c.includes('turquoise')) return '#06B6D4';
  if (c.includes('بترول') || c.includes('petrole')) return '#0E7490';
  if (c.includes('تيل') || c.includes('teal')) return '#0D9488';

  // 6. Greens
  if (c.includes('أخضر') || c.includes('اخضر') || c.includes('green') || c.includes('vert')) return '#059669';
  if (c.includes('زمرد') || c.includes('emeraude')) return '#059669';
  if (c.includes('زيت') || c.includes('كاكي') || c.includes('kaki') || c.includes('olive')) return '#4D7C0F';
  if (c.includes('فستق') || c.includes('pistache')) return '#84CC16';
  if (c.includes('نعناع') || c.includes('مينت') || c.includes('menthe') || c.includes('mint')) return '#6EE7B7';
  if (c.includes('تفاح') || c.includes('pomme')) return '#A3E635';

  // 7. Purples
  if (c.includes('بنفسج') || c.includes('purple') || c.includes('violet')) return '#7C3AED';
  if (c.includes('موف') || c.includes('mauve')) return '#A855F7';
  if (c.includes('ليلك') || c.includes('لافندر') || c.includes('lavande') || c.includes('lilac')) return '#C084FC';
  if (c.includes('برقوق') || c.includes('باذنجان') || c.includes('aubergine')) return '#581C87';

  // 8. Browns & Earthy
  if (c.includes('شوكولا') || c.includes('chocolat')) return '#451A03';
  if (c.includes('بني') || c.includes('marron') || c.includes('brown')) return '#78350F';
  if (c.includes('جمل') || c.includes('عسل') || c.includes('camel')) return '#D97706';
  if (c.includes('موكا') || c.includes('mocha')) return '#A16207';
  if (c.includes('طين') || c.includes('آجور') || c.includes('terracotta')) return '#C2410C';

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
  hasMoreClothes?: boolean;
  isLoadingMoreClothes?: boolean;
  onLoadMoreClothes?: () => Promise<void>;
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
  onDeleteRawMaterial,
  hasMoreClothes = false,
  isLoadingMoreClothes = false,
  onLoadMoreClothes
}) => {
  const [inventoryTab, setInventoryTab] = useState<'clothes' | 'raw_materials'>('clothes');
  const [filterPurpose, setFilterPurpose] = useState<string>('all');
  const [filterStockLoc, setFilterStockLoc] = useState<'all' | 'stock1' | 'stock2' | 'low'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSize, setFilterSize] = useState<string>('all');
  const [filterColor, setFilterColor] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [showSearchBarcodeCamera, setShowSearchBarcodeCamera] = useState(false);
  const barcodeSearchInputRef = useRef<HTMLInputElement>(null);
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

  // Security Password Modal for Add Product & Stock Transfer
  const [securityModal, setSecurityModal] = useState<{
    isOpen: boolean;
    title: string;
    reason: string;
    onConfirm: () => void;
  } | null>(null);

  const handleInitiateAddCloth = (barcode: string = '') => {
    setSecurityModal({
      isOpen: true,
      title: 'كلمة المرور لإضافة منتج جديد',
      reason: 'يرجى إدخال رمز المرور أو كلمة السر للترخيص بإضافة منتج أو فستان جديد إلى المخزن',
      onConfirm: () => {
        setInitialBarcodeForAdd(barcode);
        setShowAddModal(true);
        setSecurityModal(null);
      }
    });
  };

  const handleInitiateAddStock = (item: ClothItem) => {
    setSecurityModal({
      isOpen: true,
      title: 'كلمة المرور لإضافة المخزون',
      reason: `يرجى إدخال رمز المرور أو كلمة السر للترخيص بإضافة أو تعديل كميات مخزون القطعة (${item.name})`,
      onConfirm: () => {
        setStockModalItem(item);
        setSecurityModal(null);
      }
    });
  };

  const handleInitiateTransfer = (item: ClothItem) => {
    setSecurityModal({
      isOpen: true,
      title: 'كلمة المرور للتحويل بين المخزون',
      reason: `يرجى إدخال رمز المرور للموافقة على تحويل كميات (${item.name}) بين المخزن 1 والمخزن 2`,
      onConfirm: () => {
        setQuickTransferItem(item);
        setSecurityModal(null);
      }
    });
  };

  const handleInitiateEditCloth = (item: ClothItem) => {
    setSecurityModal({
      isOpen: true,
      title: 'كلمة المرور لتعديل المنتج',
      reason: `يرجى إدخال رمز المرور أو كلمة السر للترخيص بتعديل بيانات القطعة (${item.name})`,
      onConfirm: () => {
        setEditingItem(item);
        setSecurityModal(null);
      }
    });
  };

  const handleInitiateDeleteCloth = (item: ClothItem) => {
    setSecurityModal({
      isOpen: true,
      title: 'كلمة المرور لحذف القطعة',
      reason: `يرجى إدخال رمز المرور للتأكيد على حذف القطعة (${item.name}) نهائياً من المخزن`,
      onConfirm: () => {
        onDeleteCloth(item.id);
        setSecurityModal(null);
      }
    });
  };

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

  // Single-pass memoized inventory & valuation statistics, maps, sizes, colors & purpose counts
  const {
    totalStock1,
    totalStock2,
    grandTotalStock,
    totalCostReadyClothes,
    totalSellReadyClothes,
    expectedProfitReadyClothes,
    totalRawRolls,
    totalRawMeters,
    totalRawMaterialsCost,
    grandTotalStoreCapital,
    clothesBarcodeMap,
    clothesIdMap,
    allAvailableSizes,
    allAvailableColors,
    rentCount,
    sellCount
  } = useMemo(() => {
    let s1 = 0;
    let s2 = 0;
    let cost = 0;
    let sell = 0;
    let rentC = 0;
    let sellC = 0;
    const bMap = new Map<string, ClothItem>();
    const idMap = new Map<string, ClothItem>();
    const sizeSet = new Set<string>();
    const colorSet = new Set<string>();

    for (let i = 0; i < clothes.length; i++) {
      const c = clothes[i];
      const stock1 = c.stock1 !== undefined ? c.stock1 : (c.stock || 0);
      const stock2 = c.stock2 !== undefined ? c.stock2 : 0;
      const total = stock1 + stock2;
      s1 += stock1;
      s2 += stock2;
      cost += (c.buyCost * total);
      sell += (c.sellPrice * total);

      if (c.purpose === 'rent' || c.purpose === 'both') rentC++;
      if (c.purpose === 'sell' || c.purpose === 'both') sellC++;

      if (c.barcode) {
        bMap.set(c.barcode.trim().toLowerCase(), c);
      }
      if (c.id) {
        idMap.set(c.id, c);
      }

      if (c.sizes && c.sizes.length > 0) {
        c.sizes.forEach(s => s && sizeSet.add(s.trim()));
      } else if (c.size) {
        c.size.split(/[,،+/]/).forEach(s => s.trim() && sizeSet.add(s.trim()));
      }

      if (c.colors && c.colors.length > 0) {
        c.colors.forEach(col => col && colorSet.add(col.trim()));
      } else if (c.color) {
        c.color.split(/[,،+/]/).forEach(col => col.trim() && colorSet.add(col.trim()));
      }
    }

    let rawRolls = 0;
    let rawMeters = 0;
    let rawCost = 0;
    for (let i = 0; i < rawMaterials.length; i++) {
      const m = rawMaterials[i];
      rawRolls += (m.rollCount || 0);
      rawMeters += (m.totalMeters || 0);
      rawCost += (m.totalCostValue || (m.totalMeters * m.costPerMeter) || 0);
    }

    return {
      totalStock1: s1,
      totalStock2: s2,
      grandTotalStock: s1 + s2,
      totalCostReadyClothes: cost,
      totalSellReadyClothes: sell,
      expectedProfitReadyClothes: sell - cost,
      totalRawRolls: rawRolls,
      totalRawMeters: rawMeters,
      totalRawMaterialsCost: rawCost,
      grandTotalStoreCapital: cost + rawCost,
      clothesBarcodeMap: bMap,
      clothesIdMap: idMap,
      allAvailableSizes: Array.from(sizeSet),
      allAvailableColors: Array.from(colorSet),
      rentCount: rentC,
      sellCount: sellC
    };
  }, [clothes, rawMaterials]);

  // Process a scanned barcode in Inventory:
  const handleProcessBarcode = (code: string) => {
    const cleanCode = code.trim().toLowerCase();
    const existing = clothesBarcodeMap.get(cleanCode) || clothes.find(
      c => c.barcode.trim().toLowerCase() === cleanCode || c.name.toLowerCase().includes(cleanCode)
    );

    if (existing) {
      setShowScannerModal(false);
      handleInitiateAddStock(existing);
      setBarcodeActionNotice(`تم العثور على: ${existing.name} (${existing.size})`);
      setTimeout(() => setBarcodeActionNotice(null), 3500);
    } else {
      // Item not found -> open Add modal with password check
      setShowScannerModal(false);
      handleInitiateAddCloth(code.trim());
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
  }, [clothesBarcodeMap]);

  // Handle transfer between stock 1 and stock 2
  const handleTransferStock = (itemId: string, direction: '1_to_2' | '2_to_1', qty: number) => {
    const item = clothesIdMap.get(itemId) || clothes.find(c => c.id === itemId);
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
      setBarcodeActionNotice(`تم تحويل ${transferQty} قطع من المخزون 1 إلى المخزون 2 بنجاح`);
    } else {
      const transferQty = Math.min(s2, Math.max(1, qty));
      const newS1 = s1 + transferQty;
      const newS2 = s2 - transferQty;
      onUpdateCloth(itemId, {
        stock1: newS1,
        stock2: newS2,
        stock: newS1 + newS2
      });
      setBarcodeActionNotice(`تم تحويل ${transferQty} قطع من المخزون 2 إلى المخزون 1 بنجاح`);
    }
    setTimeout(() => setBarcodeActionNotice(null), 3500);
    setQuickTransferItem(null);
  };

  const filteredClothes = useMemo(() => {
    return clothes.filter(item => {
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

      // Dedicated Barcode Search filter (الكودبار والباركود المخصص)
      if (barcodeSearch.trim()) {
        const b = barcodeSearch.trim().toLowerCase();
        const matchBarcode = item.barcode && item.barcode.toLowerCase().includes(b);
        const matchVariant = item.variants && item.variants.some(v => (v.code && v.code.toLowerCase().includes(b)) || (v.id && v.id.toLowerCase().includes(b)));
        const matchId = item.id && item.id.toLowerCase().includes(b);
        if (!matchBarcode && !matchVariant && !matchId) {
          return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchBarcode = item.barcode.includes(q);
        const matchVariant = item.variants && item.variants.some(v => v.code && v.code.toLowerCase().includes(q));
        const matchColor = item.color.toLowerCase().includes(q) || (item.colors && item.colors.some(c => c.toLowerCase().includes(q)));
        const matchSize = item.size.toLowerCase().includes(q) || (item.sizes && item.sizes.some(s => s.toLowerCase().includes(q)));
        return matchName || matchBarcode || matchVariant || matchColor || matchSize;
      }
      return true;
    });
  }, [clothes, filterPurpose, filterStockLoc, filterCategory, filterSize, filterColor, search, barcodeSearch]);

  const [visibleCount, setVisibleCount] = useState<number>(5);

  useEffect(() => {
    setVisibleCount(5);
  }, [filterPurpose, filterStockLoc, filterCategory, filterSize, filterColor, search, barcodeSearch, inventoryTab]);

  const displayedClothes = useMemo(() => {
    return filteredClothes.slice(0, visibleCount);
  }, [filteredClothes, visibleCount]);

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (clothes !== undefined) {
      setIsInitialLoading(false);
    }
  }, [clothes, inventoryTab]);

  if (isInitialLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-white/95 backdrop-blur-md p-8 sm:p-10 rounded-3xl border border-indigo-100 shadow-xl max-w-sm w-full flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base sm:text-lg mb-1">جاري تحميل بيانات قسم المخزون...</h3>
            <p className="text-xs text-slate-500 font-medium">يرجى الانتظار لحظة أثناء استرجاع السلع والمنتجات</p>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="bg-indigo-600 h-full w-2/3 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 p-3 sm:p-6" dir="rtl">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/70 p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Package className="w-4 h-4" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>مخزون المحل والسلع (Stock & Tissus)</span>
            </h2>
          </div>
          <p className="text-xs text-slate-600 font-normal mt-1 mr-10">
            متابعة دقيقة للفساتين الجاهزة (المخزن 1 و 2) والسلع الأولية والأقمشة بالرولو مع احتساب رأس المال وثمن البيع.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Main Tab Switcher */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl text-xs font-semibold w-full sm:w-auto border border-slate-200/60">
            <button
              onClick={() => setInventoryTab('clothes')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                inventoryTab === 'clothes'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-indigo-700'
              }`}
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>فساتين وملابس جاهزة ({clothes.length})</span>
            </button>
            <button
              onClick={() => setInventoryTab('raw_materials')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                inventoryTab === 'raw_materials'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-indigo-700'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>سلع أولية وأقمشة بالرولو ({rawMaterials.length})</span>
            </button>
          </div>

          {inventoryTab === 'clothes' && (
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <button
                onClick={() => setShowScannerModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white hover:bg-indigo-50 text-indigo-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-indigo-200 shadow-2xs active:scale-95"
                title="مسح باركود لإضافة أو تحويل كمية المخزن"
              >
                <Camera className="w-4 h-4 text-indigo-600" />
                <span>إضافة بالباركود</span>
              </button>

              <button
                onClick={() => handleInitiateAddCloth('')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md hover:shadow-indigo-500/20 active:scale-95"
              >
                + قطعة جديدة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Financial Valuation Cards: ثمن القيمة، ثمن البيع، والسلع الأولية */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">مجموع السلعة بالتكلفة</span>
            <Tag className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{totalCostReadyClothes.toLocaleString()} <span className="text-xs font-medium text-slate-400">دج</span></p>
          <span className="text-[11px] text-slate-500 font-normal">رأس مال شراء الملابس الجاهزة</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">مجموع السلعة بثمن البيع</span>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{totalSellReadyClothes.toLocaleString()} <span className="text-xs font-medium text-slate-400">دج</span></p>
          <span className="text-[11px] text-emerald-700 font-medium">الأرباح المتوقعة: +{expectedProfitReadyClothes.toLocaleString()} دج</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">الأقمشة والسلع الأولية</span>
            <Scissors className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{totalRawMaterialsCost.toLocaleString()} <span className="text-xs font-medium text-slate-400">دج</span></p>
          <span className="text-[11px] text-slate-500 font-normal">{totalRawRolls} رولو ({totalRawMeters} متر أقمشة)</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">إجمالي رأس مال المحل المندمج</span>
            <Landmark className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{grandTotalStoreCapital.toLocaleString()} <span className="text-xs font-medium text-slate-400">دج</span></p>
          <span className="text-[11px] text-slate-500 font-normal">ملابس جاهزة + أقمشة وسلع أولية</span>
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
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-slate-500" />
                  المخزون 1 (صالة العرض)
                </span>
                <Store className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{totalStock1.toLocaleString()} <span className="text-xs font-normal text-slate-500">قطعة</span></p>
              <span className="text-[11px] text-slate-500 font-normal">مخزن المحل المعروض للزبائن</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-slate-500" />
                  المخزون 2 (المستودع)
                </span>
                <Warehouse className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{totalStock2.toLocaleString()} <span className="text-xs font-normal text-slate-500">قطعة</span></p>
              <span className="text-[11px] text-slate-500 font-normal">المستودع والتخزين الاحتياطي</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  إجمالي القطع في المخزنين
                </span>
                <Package className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{grandTotalStock.toLocaleString()} <span className="text-xs font-normal text-slate-500">قطعة</span></p>
              <span className="text-[11px] text-slate-500 font-normal">مجموع المخزن 1 + المخزن 2</span>
            </div>
          </div>

      {/* Notice Pill */}
      {barcodeActionNotice && (
        <div className="bg-slate-900 text-white text-xs font-bold p-3 rounded-xl text-center shadow-xs">
          {barcodeActionNotice}
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            {/* Purpose Filters */}
            <button
              onClick={() => setFilterPurpose('all')}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all shrink-0 font-medium ${
                filterPurpose === 'all' ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({clothes.length})
            </button>
            <button
              onClick={() => setFilterPurpose('rent')}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all shrink-0 font-medium flex items-center gap-1.5 ${
                filterPurpose === 'rent' ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Shirt className="w-3.5 h-3.5 text-slate-400" />
              <span>كراء ({rentCount})</span>
            </button>
            <button
              onClick={() => setFilterPurpose('sell')}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all shrink-0 font-medium flex items-center gap-1.5 ${
                filterPurpose === 'sell' ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>بيع ({sellCount})</span>
            </button>

            <span className="w-px h-5 bg-slate-200 self-center mx-1 shrink-0" />

            {/* Stock Location Filters */}
            <button
              onClick={() => setFilterStockLoc('all')}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all shrink-0 font-medium flex items-center gap-1.5 ${
                filterStockLoc === 'all' ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>المخزنين معاً</span>
            </button>
            <button
              onClick={() => setFilterStockLoc('stock1')}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all shrink-0 font-medium flex items-center gap-1.5 ${
                filterStockLoc === 'stock1' ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-slate-400" />
              <span>مخزون 1 فقط</span>
            </button>
            <button
              onClick={() => setFilterStockLoc('stock2')}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all shrink-0 font-medium flex items-center gap-1.5 ${
                filterStockLoc === 'stock2' ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5 text-slate-400" />
              <span>مخزون 2 فقط</span>
            </button>
            <button
              onClick={() => setFilterStockLoc('low')}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all shrink-0 font-medium flex items-center gap-1.5 ${
                filterStockLoc === 'low' ? 'bg-rose-700 text-white font-bold shadow-xs' : 'bg-rose-50 text-rose-700 border border-rose-200/60 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>نواقص المخزون</span>
            </button>
          </div>

          {/* Dual Search Area: Barcode Search & General Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* 1. Barcode Search Input with Camera button */}
            <div className="relative flex-1 sm:w-64">
              <div className="absolute right-2.5 top-2.5 text-indigo-600 flex items-center pointer-events-none">
                <Barcode className="w-4 h-4" />
              </div>
              <input
                ref={barcodeSearchInputRef}
                type="text"
                value={barcodeSearch}
                onChange={(e) => setBarcodeSearch(e.target.value)}
                placeholder="بحث بالكودبار (امسح أو اكتب)..."
                className="w-full bg-indigo-50/60 border border-indigo-200 rounded-xl pr-9 pl-16 py-2 text-xs font-bold text-slate-900 placeholder:text-indigo-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
              />
              <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
                {barcodeSearch && (
                  <button
                    type="button"
                    onClick={() => setBarcodeSearch('')}
                    className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                    title="مسح البحث بالكودبار"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSearchBarcodeCamera(true)}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs transition-colors"
                  title="مسح باركود بالكاميرا للبحث المباشر"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. General Name / Color / Size search */}
            <div className="relative flex-1 sm:w-60">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم، المقاس، اللون..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-8 py-2 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Barcode Search Match Banner */}
        {barcodeSearch && (
          <div className="p-2.5 bg-indigo-50 border border-indigo-200/80 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-indigo-600 text-white rounded-lg">
                <Barcode className="w-3.5 h-3.5" />
              </span>
              <span className="font-bold text-indigo-950">
                نتائج البحث بالكودبار: <span className="font-mono text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">{barcodeSearch}</span>
              </span>
              <span className="text-indigo-600 font-medium">
                (تم العثور على {filteredClothes.length} نتيجة)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setBarcodeSearch('')}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1"
            >
              <span>إلغاء تصفية الكودبار</span>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Categories Bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs hide-scrollbar">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors ${
              filterCategory === 'all' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            جميع التصنيفات
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors ${
                filterCategory === cat ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sizes and Colors Filter Rows */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {/* Size Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            <span className="text-[11px] font-medium text-slate-500 shrink-0 flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5 text-slate-400" />
              <span>المقاس (لطاي):</span>
            </span>
            <button
              type="button"
              onClick={() => setFilterSize('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium shrink-0 transition-all ${
                filterSize === 'all' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل
            </button>
            {allAvailableSizes.map(sz => (
              <button
                key={sz}
                type="button"
                onClick={() => setFilterSize(filterSize === sz ? 'all' : sz)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium shrink-0 transition-all border ${
                  filterSize === sz
                    ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>

          {/* Color Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            <span className="text-[11px] font-medium text-slate-500 shrink-0 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-slate-400" />
              <span>اللون:</span>
            </span>
            <button
              type="button"
              onClick={() => setFilterColor('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium shrink-0 transition-all ${
                filterColor === 'all' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium shrink-0 transition-all border flex items-center gap-1 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
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

      {/* Grid of Clothes Items using VirtualizedClothGrid for 60fps scrolling */}
      <div className="flex items-center justify-between gap-2.5 pt-1 pb-2">
        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
          <Shirt className="w-4 h-4 text-blue-900" />
          <span>قائمة القطع في المخزن ({filteredClothes.length})</span>
        </span>
      </div>

      <VirtualizedClothGrid
        clothes={displayedClothes}
        highlightedBarcode={search}
        getItemStock1={getItemStock1}
        getItemStock2={getItemStock2}
        onOpenVariantsModal={setVariantsModalItem}
        onOpenQuickTransferModal={handleInitiateTransfer}
        onOpenEditModal={handleInitiateEditCloth}
        onOpenDeleteModal={(id) => {
          const item = clothes.find(c => c.id === id);
          if (item) handleInitiateDeleteCloth(item);
        }}
      />

      {(visibleCount < filteredClothes.length || hasMoreClothes) && (
        <div className="flex justify-center my-6">
          <button
            type="button"
            disabled={isLoadingMoreClothes}
            onClick={async () => {
              if (visibleCount < filteredClothes.length) {
                setVisibleCount(prev => prev + 5);
                return;
              }
              if (onLoadMoreClothes) {
                await onLoadMoreClothes();
                setVisibleCount(prev => prev + 5);
              }
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            {isLoadingMoreClothes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{isLoadingMoreClothes ? 'جاري جلب 5 منتجات...' : `تحميل 5 منتجات أخرى (عرض ${displayedClothes.length} من المحمل ${filteredClothes.length})`}</span>
          </button>
        </div>
      )}

      {previewImage && (
        <ImagePreviewModal
          url={previewImage.url}
          title={previewImage.title}
          onClose={() => setPreviewImage(null)}
        />
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
            setBarcodeActionNotice(`تم تحديث مخزون ${stockModalItem.name} بنجاح!`);
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
          title="مسح باركود لإضافة المخزون"
          onScan={(code) => handleProcessBarcode(code)}
          onClose={() => setShowScannerModal(false)}
        />
      )}

      {/* Embedded Barcode Scanner Camera for Searching Inventory */}
      {showSearchBarcodeCamera && (
        <BarcodeScanner
          title="مسح باركود للبحث المباشر في المخزون"
          onScan={(code) => {
            setBarcodeSearch(code.trim());
            setShowSearchBarcodeCamera(false);
          }}
          onClose={() => setShowSearchBarcodeCamera(false)}
        />
      )}

      {/* Security Password Prompt Modal */}
      {securityModal && (
        <SecurityPasswordModal
          title={securityModal.title}
          reason={securityModal.reason}
          onSuccess={securityModal.onConfirm}
          onClose={() => setSecurityModal(null)}
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
            <span className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
              <Package className="w-5 h-5 text-slate-700" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">تحديث وإضافة المخزون (Stock 1 & 2)</h3>
              <p className="text-[10px] text-slate-500 font-mono">كود: #{item.barcode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Item Info Summary */}
        <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mb-4">
          {(getListImage(item) || item.imageUrl) ? (
            <AsyncProductImage item={item} mode="thumb" className="w-14 h-14 rounded-xl bg-white border border-slate-200 shrink-0 p-0.5 shadow-2xs" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center shrink-0">
              <Shirt className="w-6 h-6 text-slate-400" />
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
                <option value="all">تعديل المخزون العام للقطعة</option>
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
  const [transferPin, setTransferPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const maxAvailable = direction === '1_to_2' ? s1 : s2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0) return;
    if (!checkSecurityPin(transferPin)) {
      setPinError(true);
      return;
    }
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
                <span className="flex items-center gap-1.5">
                  <span>من المخزون 2 (المستودع)</span>
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>إلى المخزون 1 (المحل)</span>
                </span>
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
                <span className="flex items-center gap-1.5">
                  <span>من المخزون 1 (المحل)</span>
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>إلى المخزون 2 (المستودع)</span>
                </span>
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

          {/* Password Authorization Input */}
          <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200">
            <label className="block text-xs font-black text-blue-950 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                كلمة المرور لتأكيد التحويل (PIN):
              </span>
              <span className="text-[10px] text-blue-700 font-bold">مطلوبة للأمان</span>
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={transferPin}
                onChange={(e) => {
                  setTransferPin(e.target.value);
                  setPinError(false);
                }}
                placeholder="أدخل كلمة المرور ••••"
                maxLength={8}
                className={`w-full bg-white border-2 rounded-xl px-3.5 py-2.5 text-center font-black tracking-widest text-slate-900 outline-none transition-all ${
                  pinError 
                    ? 'border-red-500 ring-2 ring-red-500/20' 
                    : 'border-blue-300 focus:border-blue-600'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pinError && (
              <p className="text-[11px] text-red-600 font-bold mt-1 text-center flex items-center justify-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>كلمة المرور غير صحيحة، لا يمكن تنفيذ التحويل</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={maxAvailable <= 0}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-slate-300 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-blue-200 transition-all min-h-[44px] flex items-center justify-center gap-2"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>تنفيذ عملية التحويل</span>
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
  const [colorCategoryFilter, setColorCategoryFilter] = useState<string>('all');
  const [colorSearchQuery, setColorSearchQuery] = useState<string>('');
  const [customColorPickerHex, setCustomColorPickerHex] = useState<string>('#EAB308');

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
  const [thumbUrl, setThumbUrl] = useState(item?.thumbUrl || '');
  const [pendingFullUrl, setPendingFullUrl] = useState<string | null>(null);
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

  // Compress & convert file to Base64 (thumb ~200px and full ~1200px)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFileType(file.type, file.name)) {
      alert('ملف غير مسموح به! يرجى رفع صورة فقط (JPG, PNG, WEBP).');
      if (e.target) e.target.value = '';
      return;
    }

    try {
      setIsProcessingImage(true);
      const variants = await processImageToVariants(file);
      setThumbUrl(variants.thumbUrl);
      setPendingFullUrl(variants.fullUrl);
      setImageUrl(''); // Clear old heavy imageUrl when a new image is uploaded
    } catch (err) {
      alert('حدث خطأ أثناء معالجة الملف');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const validSizes = selectedSizes.length > 0 ? selectedSizes : ['38'];
    const validColors = selectedColors.length > 0 ? selectedColors : ['أسود'];

    const clothPayload: any = {
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
      description: description.trim(),
      thumbUrl: thumbUrl.trim() || undefined,
      hasFullImage: Boolean(pendingFullUrl || item?.hasFullImage),
      updatedAt: new Date().toISOString()
    };

    // If legacy imageUrl was present and not overridden by new upload, preserve it
    if (imageUrl && !pendingFullUrl) {
      clothPayload.imageUrl = imageUrl;
    }

    onSubmit(clothPayload, pendingFullUrl || undefined);
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
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-black text-slate-800">صورة الفستان / القطعة</label>
              <span className="text-[10px] text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-700" />
                <span>تأخذ 100% من مساحة القائمة وتظهر كاملة</span>
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="w-36 h-48 sm:w-44 sm:h-56 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 relative group shadow-xs">
                {imageUrl ? (
                  <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                    <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-30 select-none" />
                    <img src={imageUrl} alt="معاينة الفستان كاملة" className="relative z-1 w-full h-full object-contain select-none" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute inset-0 z-10 bg-slate-900/80 text-white font-bold text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span>حذف الصورة</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2 p-3 text-center">
                    <Shirt className="w-10 h-10 text-slate-300" />
                    <span className="text-xs font-bold text-slate-400">معاينة الصورة</span>
                  </div>
                )}
              </div>
              <div className="flex-1 w-full space-y-2">
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
                  className="w-full py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-2xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isProcessingImage ? 'جاري معالجة وحفظ الصورة بأعلى جودة...' : 'رفع صورة من الهاتف / الكمبيوتر'}</span>
                </button>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="أو ضع رابط صورة إنترنت مباشرة (URL)..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-900"
                />
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  يتم حفظ الصورة بدقة فائقة وأبعاد طبيعية، لتأخذ 100% من مساحة البطاقة وتظهر واضحة وكاملة بدون أي اقتصاص لأطراف الفستان.
                </p>
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
                    <span>{sz}</span>
                    {isSelected && <Check className="w-3 h-3 inline mr-1" />}
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
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-blue-900" />
                <span>2. اختر الألوان المتوفرة (Couleurs) * :</span>
              </label>
              <span className="text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                {selectedColors.length} لون محدد
              </span>
            </div>

            {/* Currently Selected Color Chips with One-click Remove */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-200 min-h-[38px]">
              <span className="text-[10px] text-slate-500 font-bold ml-1">الألوان المختارة:</span>
              {selectedColors.map((colName) => (
                <span
                  key={colName}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-blue-900 text-white shadow-2xs transition-all"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/50 shrink-0 shadow-2xs"
                    style={{ backgroundColor: getColorHex(colName) }}
                  />
                  <span>{colName}</span>
                  {selectedColors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(colName)}
                      className="hover:text-red-300 transition-colors ml-0.5"
                      title="إزالة هذا اللون"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>

            {/* Category Filter Tabs & Quick Search */}
            <div className="space-y-2">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
                {[
                  { id: 'all', label: `الكل (${POPULAR_COLORS.length})` },
                  { id: 'yellow_gold', label: '🟡 أصفر وذهبي' },
                  { id: 'basics', label: '⚪ أساسي ونيود' },
                  { id: 'red_pink', label: '🔴 أحمر ووردي' },
                  { id: 'blue', label: '🔵 أزرق وتركواز' },
                  { id: 'green', label: '🟢 أخضر وزيتي' },
                  { id: 'purple', label: '🟣 بنفسجي وموف' },
                  { id: 'earth', label: '🟤 بني وترابي' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setColorCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                      colorCategoryFilter === cat.id
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={colorSearchQuery}
                  onChange={(e) => setColorSearchQuery(e.target.value)}
                  placeholder="ابحث عن لون سريعاً (أصفر، ليموني، زيتي، كحلي، خوخي...)"
                  className="w-full bg-white border border-slate-200 rounded-xl pr-8 pl-8 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-900 placeholder:text-slate-400"
                />
                {colorSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setColorSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Color Swatch Badges Grid */}
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-white/70 rounded-xl border border-slate-200/80">
              {POPULAR_COLORS.filter((col) => {
                const matchesCat = colorCategoryFilter === 'all' || col.category === colorCategoryFilter;
                const q = colorSearchQuery.trim().toLowerCase();
                const matchesSearch = !q || col.name.toLowerCase().includes(q);
                return matchesCat && matchesSearch;
              }).map((col) => {
                const isSelected = selectedColors.includes(col.name);
                return (
                  <button
                    type="button"
                    key={col.name}
                    onClick={() => handleToggleColor(col.name)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-blue-900 text-white border-blue-900 shadow-xs scale-102 ring-2 ring-blue-900/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs ${col.border ? 'border border-slate-300' : ''}`}
                      style={{ backgroundColor: col.hex }}
                    />
                    <span>{col.name}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>

            {/* Add Custom Color (بدرجة مخصصة أو اسم حر) */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-1.5 shrink-0 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold">الدرجة:</span>
                <input
                  type="color"
                  value={customColorPickerHex}
                  onChange={(e) => setCustomColorPickerHex(e.target.value)}
                  className="w-6 h-6 rounded-md cursor-pointer border-0 p-0 bg-transparent"
                  title="اختر درجة اللون بدقة من لوحة الألوان"
                />
              </div>
              <LettersInput
                value={customColorInput}
                onChange={setCustomColorInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomColor();
                  }
                }}
                placeholder="اكتب اسم أي لون إضافي مخصص غير موجود (مثال: أصفر فاقع، موطارد هادئ، بترولي...)"
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-900"
              />
              <button
                type="button"
                onClick={handleAddCustomColor}
                className="bg-blue-900 hover:bg-blue-950 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 active:scale-95 shadow-2xs"
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
                  <span className="text-blue-700 flex items-center gap-1"><Store className="w-3.5 h-3.5 text-blue-600" /> {totalStock1}</span>
                  <span>+</span>
                  <span className="text-blue-950 flex items-center gap-1"><Warehouse className="w-3.5 h-3.5 text-slate-500" /> {totalStock2}</span>
                  <span>=</span>
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg font-mono">{totalCalculatedStock} قطعة</span>
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
                  <Zap className="w-3.5 h-3.5 text-blue-600" />
                  <span>تعبئة كمية موحدة للجميع ({variants.length} تشكيلة)</span>
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
                    <span className="text-[11px] text-blue-200 font-bold shrink-0 flex items-center gap-1">
                      <Store className="w-3 h-3 text-blue-300" />
                      المحل:
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={bulkStock1}
                      onChange={(e) => setBulkStock1(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-white text-blue-950 font-black rounded-lg px-2 py-1 text-center text-xs focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-blue-950/60 p-1.5 rounded-xl border border-blue-700/50">
                    <span className="text-[11px] text-blue-200 font-bold shrink-0 flex items-center gap-1">
                      <Warehouse className="w-3 h-3 text-blue-300" />
                      المستودع:
                    </span>
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
                          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                            <span>مجموع اللون:</span>
                            <strong className="text-blue-700 font-mono">{colorTotal}</strong>
                            <span>قطعة</span>
                            <span className="text-slate-400">|</span>
                            <span className="flex items-center gap-0.5 text-blue-800"><Store className="w-3 h-3 text-blue-600" /> {colorStock1}</span>
                            <span className="text-slate-400">•</span>
                            <span className="flex items-center gap-0.5 text-slate-700"><Warehouse className="w-3 h-3 text-slate-500" /> {colorStock2}</span>
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
                            className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition-colors flex items-center gap-1"
                            title="تطبيق كمية سريعة على جميع مقاسات هذا اللون"
                          >
                            <Zap className="w-3 h-3 text-blue-600" />
                            <span>تعبئة سريعة</span>
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
                                  <span className="text-[10px] font-bold text-blue-900 shrink-0 flex items-center gap-1">
                                    <Store className="w-3 h-3 text-blue-600" />
                                    المحل:
                                  </span>
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
                                  <span className="text-[10px] font-bold text-slate-700 shrink-0 flex items-center gap-1">
                                    <Warehouse className="w-3 h-3 text-slate-500" />
                                    المستودع:
                                  </span>
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
