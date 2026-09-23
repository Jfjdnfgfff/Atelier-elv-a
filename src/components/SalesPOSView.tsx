import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ClothItem, Sale, SaleItem } from '../types';
import { CustomerIdScannerModal, ExtractedCustomerData } from './CustomerIdScannerModal';
import { BarcodeScanner } from './BarcodeScanner';
import { LettersInput, NumbersInput } from './Shared';
import { 
  playPosScannerBeep, 
  playPosErrorBeep, 
  validateAndSanitizeBarcode 
} from '../utils/scannerSoundAndValidation';
import { 
  ShoppingCart, 
  Package, 
  ZoomIn, 
  ArrowLeftRight, 
  CreditCard, 
  ShoppingBag, 
  Trash2, 
  Search, 
  X, 
  Check,
  Calendar,
  Camera,
  Barcode,
  Plus,
  Minus,
  Loader2
} from 'lucide-react';

interface SalesPOSViewProps {
  clothes: ClothItem[];
  sales: Sale[];
  onCompleteSale: (saleData: any) => void;
  onDeleteSale: (sale: Sale) => void;
  onScanBarcode: () => void;
  scannedCode?: string | null;
  onClearScannedCode?: () => void;
}

export const SalesPOSView: React.FC<SalesPOSViewProps> = React.memo(({
  clothes,
  sales,
  onCompleteSale,
  onDeleteSale,
  scannedCode,
  onClearScannedCode
}) => {
  const getItemStock1 = (c: ClothItem) => c.stock1 !== undefined ? c.stock1 : (c.stock || 0);
  const getItemStock2 = (c: ClothItem) => c.stock2 !== undefined ? c.stock2 : 0;
  const getItemTotalStock = (c: ClothItem) => getItemStock1(c) + getItemStock2(c);

  const sellableClothes = useMemo(() => {
    return clothes.filter(c => 
      (c.purpose === 'sell' || c.purpose === 'both') && 
      (getItemTotalStock(c) - (c.rentedCount || 0) > 0)
    );
  }, [clothes]);

  const clothesBarcodeMap = useMemo(() => {
    const map = new Map<string, ClothItem>();
    for (let i = 0; i < clothes.length; i++) {
      const c = clothes[i];
      if (c.barcode) {
        map.set(c.barcode.trim().toLowerCase(), c);
      }
      if (c.id) {
        map.set(c.id.trim().toLowerCase(), c);
      }
    }
    return map;
  }, [clothes]);

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCustomerIdScanner, setShowCustomerIdScanner] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannedItemModal, setScannedItemModal] = useState<{
    item: ClothItem;
    qty: number;
    stockSource: 'stock1' | 'stock2';
  } | null>(null);

  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  
  // Date selector for the sale
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getYesterdayDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [saleDate, setSaleDate] = useState<string>(getTodayDateString());

  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [imageDisplayMode, setImageDisplayMode] = useState<'fill' | 'cover' | 'contain'>('fill');
  const [lastScannedItem, setLastScannedItem] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const handleCustomerExtracted = (data: ExtractedCustomerData) => {
    if (data.name) setCustomerName(data.name);
    if (data.phone) setCustomerPhone(data.phone);
  };

  const categories = [
    'الكل',
    'فساتين سهرة',
    'أزياء تقليدية وقفاطين',
    'بدلات وأطقم رجالية',
    'عبايات وملابس كاجوال',
    'إكسسوارات وحقائب',
    'أخرى'
  ];

  // Process barcode scan and open quantity modal
  const handleBarcodeCode = (rawCode: string) => {
    const validation = validateAndSanitizeBarcode(rawCode.trim());
    const code = validation.isValid ? validation.code : rawCode.trim();
    if (!code) return;

    const matched = clothesBarcodeMap.get(code.toLowerCase());
    if (matched) {
      const s1 = getItemStock1(matched);
      const s2 = getItemStock2(matched);
      const totalAvailable = s1 + s2 - (matched.rentedCount || 0);

      if (totalAvailable <= 0) {
        playPosErrorBeep();
        alert(`القطعة "${matched.name}" نفدت من كلا المخزنين.`);
      } else {
        playPosScannerBeep('classic');
        const defaultSource = s1 > 0 ? 'stock1' : 'stock2';
        setScannedItemModal({
          item: matched,
          qty: 1,
          stockSource: defaultSource
        });
        setBarcodeInput('');
      }
    } else {
      playPosErrorBeep();
      alert(`لم يتم العثور على قطعة بالباركود: ${code}`);
    }
  };

  // React to externally scanned barcode prop from App.tsx
  useEffect(() => {
    if (scannedCode) {
      handleBarcodeCode(scannedCode);
      if (onClearScannedCode) onClearScannedCode();
    }
  }, [scannedCode]);

  const addCustomQtyToCart = (item: ClothItem, qtyToAdd: number, stockSource: 'stock1' | 'stock2') => {
    const s1 = getItemStock1(item);
    const s2 = getItemStock2(item);
    const maxAvailable = stockSource === 'stock1' ? s1 : s2;

    const existing = cart.find(ci => ci.itemId === item.id && ci.stockSource === stockSource);
    const currentQtyInCart = existing ? existing.qty : 0;
    const finalQty = currentQtyInCart + qtyToAdd;

    if (finalQty > maxAvailable) {
      playPosErrorBeep();
      alert(`الكمية المحددة للبيع (${finalQty}) تتجاوز المتوفر بالمخزون المحدد (${maxAvailable} قطعة)`);
      return;
    }

    if (existing) {
      setCart(prev => prev.map(ci => (ci.itemId === item.id && ci.stockSource === stockSource) 
        ? { ...ci, qty: finalQty, total: finalQty * ci.price } 
        : ci
      ));
    } else {
      setCart(prev => [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          size: item.size,
          color: item.color,
          qty: qtyToAdd,
          stockSource,
          price: item.sellPrice,
          cost: item.buyCost,
          total: qtyToAdd * item.sellPrice,
          imageUrl: item.imageUrl
        }
      ]);
    }

    playPosScannerBeep('classic');
    setLastScannedItem(`${item.name} (${qtyToAdd} قطعة)`);
    setTimeout(() => setLastScannedItem(null), 2500);
  };

  const addToCart = (item: ClothItem, preferredStock?: 'stock1' | 'stock2') => {
    const s1 = getItemStock1(item);
    const s2 = getItemStock2(item);

    let chosenStock: 'stock1' | 'stock2' = preferredStock || (s1 > 0 ? 'stock1' : 'stock2');
    if (!preferredStock && s1 <= 0 && s2 > 0) {
      chosenStock = 'stock2';
    }

    const targetStockMax = chosenStock === 'stock1' ? s1 : s2;
    const existing = cart.find(ci => ci.itemId === item.id && ci.stockSource === chosenStock);

    if (existing) {
      if (existing.qty >= targetStockMax) {
        const otherStock: 'stock1' | 'stock2' = chosenStock === 'stock1' ? 'stock2' : 'stock1';
        const otherMax = otherStock === 'stock1' ? s1 : s2;
        const existingOther = cart.find(ci => ci.itemId === item.id && ci.stockSource === otherStock);
        const otherInCart = existingOther ? existingOther.qty : 0;

        if (otherInCart < otherMax) {
          addToCart(item, otherStock);
          return;
        }
        playPosErrorBeep();
        alert(`لا توجد كمية إضافية متوفرة في ${chosenStock === 'stock1' ? 'المخزون 1' : 'المخزون 2'}`);
        return;
      }
      setCart(prev => prev.map(ci => (ci.itemId === item.id && ci.stockSource === chosenStock) 
        ? { ...ci, qty: ci.qty + 1, total: (ci.qty + 1) * ci.price } 
        : ci
      ));
    } else {
      if (targetStockMax <= 0) {
        playPosErrorBeep();
        alert(`المخزون المحدد (${chosenStock === 'stock1' ? 'المخزون 1' : 'المخزون 2'}) فارغ لهذه القطعة`);
        return;
      }
      setCart(prev => [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          size: item.size,
          color: item.color,
          qty: 1,
          stockSource: chosenStock,
          price: item.sellPrice,
          cost: item.buyCost,
          total: item.sellPrice,
          imageUrl: item.imageUrl
        }
      ]);
    }

    playPosScannerBeep('classic');
    setLastScannedItem(item.name);
    setTimeout(() => setLastScannedItem(null), 2500);
  };

  // Instant barcode search and trigger quantity modal
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleBarcodeCode(barcodeInput);
  };

  // Global listener for handheld USB/Bluetooth barcode guns
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      const isBarcodeField = activeEl === barcodeInputRef.current;

      const currentTime = Date.now();
      const diff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (diff > 90) {
        buffer = '';
      }

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault();
          handleBarcodeCode(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1 && (!isInput || isBarcodeField)) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clothes, cart]);

  const removeFromCart = (itemId: string, stockSource?: 'stock1' | 'stock2') => {
    setCart(prev => prev.filter(ci => !(ci.itemId === itemId && ci.stockSource === stockSource)));
  };

  const updateQty = (itemId: string, stockSource: 'stock1' | 'stock2' | undefined, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(itemId, stockSource);
      return;
    }
    const item = clothes.find(c => c.id === itemId);
    const maxAvailable = stockSource === 'stock2' ? (getItemStock2(item!)) : (getItemStock1(item!));

    if (newQty > maxAvailable) {
      alert(`الكمية المطلوبة أكبر من المتوفر في ${stockSource === 'stock2' ? 'المخزون 2' : 'المخزون 1'} (${maxAvailable} قطعة)`);
      return;
    }
    setCart(prev => prev.map(ci => (ci.itemId === itemId && ci.stockSource === stockSource) 
      ? { ...ci, qty: newQty, total: newQty * ci.price } 
      : ci
    ));
  };

  const toggleStockSource = (itemId: string, currentSource: 'stock1' | 'stock2' = 'stock1') => {
    const item = clothes.find(c => c.id === itemId);
    if (!item) return;

    const newSource: 'stock1' | 'stock2' = currentSource === 'stock1' ? 'stock2' : 'stock1';
    const newMax = newSource === 'stock1' ? getItemStock1(item) : getItemStock2(item);

    if (newMax <= 0) {
      alert(`لا توجد كمية متوفرة في ${newSource === 'stock1' ? 'المخزون 1' : 'المخزون 2'}`);
      return;
    }

    setCart(prev => prev.map(ci => {
      if (ci.itemId === itemId && ci.stockSource === currentSource) {
        const safeQty = Math.min(ci.qty, newMax);
        return {
          ...ci,
          stockSource: newSource,
          qty: safeQty,
          total: safeQty * ci.price
        };
      }
      return ci;
    }));
  };

  const { totalAmount, totalCost, totalProfit } = useMemo(() => {
    let amount = 0;
    let cost = 0;
    for (let i = 0; i < cart.length; i++) {
      const ci = cart[i];
      amount += ci.total;
      cost += (ci.cost * ci.qty);
    }
    return {
      totalAmount: amount,
      totalCost: cost,
      totalProfit: amount - cost
    };
  }, [cart]);

  const actualPaid = paidAmount === '' ? totalAmount : Number(paidAmount);
  const debtAmount = Math.max(0, totalAmount - actualPaid);

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (debtAmount > 0 && (!customerName.trim() || !customerPhone.trim())) {
      alert('الرجاء إدخال اسم ورقم هاتف الزبون لتسجيل الكريدي');
      return;
    }

    // Compute final sale timestamp from chosen saleDate
    const now = new Date();
    let finalSaleDate: string;
    if (saleDate) {
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      finalSaleDate = `${saleDate}T${timeStr}`;
    } else {
      finalSaleDate = new Date().toISOString();
    }

    onCompleteSale({
      customerName: customerName.trim() || 'زبون عام',
      customerPhone: customerPhone.trim(),
      items: cart,
      totalAmount,
      paidAmount: actualPaid,
      debtAmount,
      profit: totalProfit,
      date: finalSaleDate
    });

    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaidAmount('');
    setSaleDate(getTodayDateString());
  };

  const filteredClothes = useMemo(() => {
    return sellableClothes.filter(c => {
      if (selectedCategory !== 'الكل' && c.category !== selectedCategory) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.barcode.includes(q) || c.color.toLowerCase().includes(q) || c.size.toLowerCase().includes(q);
    });
  }, [sellableClothes, selectedCategory, search]);

  // Progressive display for products (5 items at a time)
  const [visibleProductCount, setVisibleProductCount] = useState(5);
  const [isLoadingMoreProducts, setIsLoadingMoreProducts] = useState(false);
  const [isLoadingMoreSales, setIsLoadingMoreSales] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    setIsInitialLoading(true);
    const timer = setTimeout(() => setIsInitialLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setVisibleProductCount(5);
  }, [selectedCategory, search]);

  const visibleClothes = useMemo(() => {
    return filteredClothes.slice(0, visibleProductCount);
  }, [filteredClothes, visibleProductCount]);

  // Progressive display for sales history (5 items at a time)
  const [visibleSalesCount, setVisibleSalesCount] = useState(5);

  const visibleSales = useMemo(() => {
    return sales.slice(0, visibleSalesCount);
  }, [sales, visibleSalesCount]);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6" dir="rtl">
      {/* Initial Section Loading Banner */}
      {isInitialLoading && (
        <div className="p-3 bg-blue-50/90 border border-blue-200/80 rounded-2xl flex items-center justify-center gap-2.5 text-blue-900 text-xs font-bold shadow-2xs animate-in fade-in">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          <span>جاري تحميل بيانات قسم المبيعات والمنتجات...</span>
        </div>
      )}

      {/* Top Split Layout: POS Selector and Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Mobile Cart Summary Sticky Pill */}
        {cart.length > 0 && (
          <div className="lg:hidden bg-slate-900 text-white p-3 rounded-2xl flex justify-between items-center shadow-md">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-slate-300" />
              <div>
                <span className="text-xs font-bold block">سلة المبيعات: {cart.reduce((s, ci) => s + ci.qty, 0)} قطع</span>
                <span className="text-[10px] text-slate-300 font-medium">{totalAmount.toLocaleString()} دج</span>
              </div>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById('checkout-card');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-white text-slate-900 px-3.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
            >
              إتمام البيع ↓
            </button>
          </div>
        )}

        {/* Product Selection with Photo Grid */}
        <div className="lg:col-span-7 space-y-3 sm:space-y-4">
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>نقطة بيع الأزياء (POS)</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-medium">
                    {filteredClothes.length} معروض
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-normal">البيع من المخزون 1 أو المخزون 2 مع المسح بالباركود.</p>
              </div>

              {/* Laser Barcode Quick Input Form & Camera Scanner Button */}
              <div className="w-full sm:w-auto flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowCameraScanner(true)}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-2xs transition-all active:scale-95"
                  title="فتح كاميرا الجوال/الجهاز لمسح الباركود"
                >
                  <Camera className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">مسح بالكاميرا</span>
                  <span className="sm:hidden">كاميرا</span>
                </button>

                <form onSubmit={handleBarcodeSubmit} className="flex-1 sm:flex-initial flex gap-1.5">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="مسح باركود..."
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-medium w-full sm:w-40 focus:outline-none focus:border-slate-400 focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 shadow-xs"
                  >
                    إضافة
                  </button>
                </form>
              </div>
            </div>

            {/* Scan Success Notice */}
            {lastScannedItem && (
              <div className="p-2 bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl text-center flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-slate-700" />
                <span>تمت إضافة ({lastScannedItem}) إلى سلة المبيعات</span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الباركود أو اللون..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs sm:text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs hide-scrollbar">
              <div className="flex gap-1.5 shrink-0">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-medium shrink-0 transition-colors ${
                      selectedCategory === cat ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Image Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => setImageDisplayMode('fill')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                    imageDisplayMode === 'fill' ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="ملء 100% كاملة في البطاقة"
                >
                  ملء 100%
                </button>
                <button
                  type="button"
                  onClick={() => setImageDisplayMode('cover')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                    imageDisplayMode === 'cover' ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="تغطية الإطار"
                >
                  تغطية
                </button>
                <button
                  type="button"
                  onClick={() => setImageDisplayMode('contain')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                    imageDisplayMode === 'contain' ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="احتواء كامل"
                >
                  احتواء
                </button>
              </div>
            </div>
          </div>

          {/* Grid of Sellable Products with Photo Gallery */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto pr-1 hide-scrollbar">
            {visibleClothes.map(item => {
              const s1 = getItemStock1(item);
              const s2 = getItemStock2(item);
              const totalStock = s1 + s2;
              const inCartCount = cart.filter(ci => ci.itemId === item.id).reduce((s, ci) => s + ci.qty, 0);

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
                    {item.imageUrl ? (
                      <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                        {imageDisplayMode !== 'fill' && (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-35 select-none pointer-events-none"
                            aria-hidden="true"
                          />
                        )}
                        <img
                          src={item.imageUrl}
                          alt={item.name}
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
                    <span className="absolute top-2 right-2 text-[9px] font-medium px-1.5 py-0.5 rounded-md backdrop-blur-xs bg-slate-900/80 text-white">
                      {totalStock} بالمخزنين
                    </span>

                    {/* Quick Image Zoom button */}
                    {item.imageUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage({ url: item.imageUrl!, title: item.name });
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

                      <button
                        type="button"
                        onClick={() => {
                          const defaultSource = s1 > 0 ? 'stock1' : 'stock2';
                          setScannedItemModal({
                            item,
                            qty: 1,
                            stockSource: defaultSource
                          });
                        }}
                        className="w-full py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all mt-1"
                        title="اختيار كمية محددة للبيع"
                      >
                        <Barcode className="w-3 h-3 text-slate-500" />
                        <span>تحديد الكمية</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Bottom load more button inside product grid */}
            {visibleProductCount < filteredClothes.length && (
              <div className="col-span-2 sm:col-span-3 py-2 text-center">
                <button
                  type="button"
                  disabled={isLoadingMoreProducts}
                  onClick={() => {
                    setIsLoadingMoreProducts(true);
                    setTimeout(() => {
                      setVisibleProductCount(prev => Math.min(prev + 5, filteredClothes.length));
                      setIsLoadingMoreProducts(false);
                    }, 250);
                  }}
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-80 text-blue-700 rounded-xl text-xs font-bold transition-all border border-blue-200 active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  {isLoadingMoreProducts ? (
                    <>
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                      <span>جاري التحميل...</span>
                    </>
                  ) : (
                    <>
                      <span>عرض 5 سلع إضافية (+5)</span>
                      <span className="text-[11px] font-normal opacity-75">({visibleClothes.length} من {filteredClothes.length})</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cart & Checkout Panel */}
        <div className="lg:col-span-5" id="checkout-card">
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-4 sticky top-20">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-slate-700" />
                <span>سلة المبيعات</span>
                <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-lg font-medium">
                  {cart.reduce((s, ci) => s + ci.qty, 0)} قطع
                </span>
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium p-1"
                >
                  تفريغ السلة
                </button>
              )}
            </div>

            {/* Cart Items with Stock 1 / Stock 2 selectors */}
            {cart.length === 0 ? (
              <div className="py-8 sm:py-12 text-center text-slate-400 space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium">السلة فارغة، اضغط على أي قطعة من القائمة لإضافتها</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 hide-scrollbar">
                {cart.map((item, idx) => {
                  const source = item.stockSource || 'stock1';

                  return (
                    <div key={`${item.itemId}_${source}_${idx}`} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs space-y-2">
                      <div className="flex justify-between items-center gap-2">
                        {/* Item Photo / Icon */}
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                          ) : (
                            <Package className="w-4 h-4 text-slate-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-500 font-normal flex items-center gap-2">
                            <span>{item.size}</span>
                            <span>•</span>
                            <span className="font-mono">{item.price.toLocaleString()} دج</span>
                          </div>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => updateQty(item.itemId, item.stockSource, item.qty - 1)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100 active:scale-95 text-xs"
                          >
                            -
                          </button>
                          <span className="font-bold font-mono text-slate-900 w-4 text-center text-xs">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.itemId, item.stockSource, item.qty + 1)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100 active:scale-95 text-xs"
                          >
                            +
                          </button>
                          <span className="font-bold font-mono text-slate-900 min-w-[55px] text-left mr-1">
                            {item.total.toLocaleString()} دج
                          </span>
                        </div>
                      </div>

                      {/* Stock Source Toggle Badge */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-[10px]">
                        <span className="text-slate-500 font-medium">الخصم من المخزن:</span>
                        <button
                          type="button"
                          onClick={() => toggleStockSource(item.itemId, source)}
                          className="px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1 bg-white text-slate-800 border border-slate-200 hover:bg-slate-100"
                          title="اضغط للتبديل بين مخزون 1 ومخزون 2"
                        >
                          <span>{source === 'stock1' ? 'المخزون 1 (المحل)' : 'المخزون 2 (المستودع)'}</span>
                          <ArrowLeftRight className="w-3 h-3 inline-block text-slate-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Checkout Form */}
            {cart.length > 0 && (
              <form onSubmit={handleCheckout} className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700 text-[11px]">معلومات الزبون (اختياري)</span>
                  <button
                    type="button"
                    onClick={() => setShowCustomerIdScanner(true)}
                    className="text-[10px] bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:scale-95 px-2 py-1 rounded-lg font-medium flex items-center gap-1 transition-all shadow-2xs"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    <span>مسح بطاقة الهوية / الباركود</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <LettersInput
                    value={customerName}
                    onChange={setCustomerName}
                    placeholder="اسم الزبون (أحرف فقط)..."
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-slate-400 focus:bg-white"
                  />
                  <NumbersInput
                    allowPlus
                    value={customerPhone}
                    onChange={setCustomerPhone}
                    placeholder="رقم الهاتف (أرقام فقط)..."
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-slate-400 focus:bg-white"
                  />
                </div>

                {/* Sale Date Selector */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>تاريخ عملية البيع:</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSaleDate(getTodayDateString())}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all border ${
                          saleDate === getTodayDateString()
                            ? 'bg-slate-900 text-white border-slate-900 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        اليوم
                      </button>
                      <button
                        type="button"
                        onClick={() => setSaleDate(getYesterdayDateString())}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all border ${
                          saleDate === getYesterdayDateString()
                            ? 'bg-slate-900 text-white border-slate-900 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        أمس
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-medium mb-1">المبلغ الإجمالي</label>
                    <div className="text-base font-bold text-slate-900 font-mono">{totalAmount.toLocaleString()} دج</div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-medium mb-1">المبلغ المستلم</label>
                    <input
                      type="number"
                      min="0"
                      max={totalAmount}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={totalAmount.toString()}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                {debtAmount > 0 && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200/60 text-rose-800 rounded-xl font-medium flex justify-between items-center text-xs">
                    <span>المتبقي دين على الزبون:</span>
                    <span className="font-bold font-mono">{debtAmount.toLocaleString()} دج</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all shadow-xs active:scale-[0.98] min-h-[44px]"
                >
                  إتمام عملية البيع ({actualPaid.toLocaleString()} دج)
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Customer ID & Barcode Scanner Modal */}
      {showCustomerIdScanner && (
        <CustomerIdScannerModal
          title="مسح بطاقة تعريف أو باركود الزبون"
          onExtract={handleCustomerExtracted}
          onClose={() => setShowCustomerIdScanner(false)}
        />
      )}

      {/* Barcode Camera Scanner Modal */}
      {showCameraScanner && (
        <BarcodeScanner
          title="مسح باركود القطعة للبيع"
          onScan={(code) => {
            setShowCameraScanner(false);
            handleBarcodeCode(code);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {/* Barcode Scanned Item Quantity Selection Modal */}
      {scannedItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تحديد كمية البيع بالباركود</h3>
                  <p className="text-xs text-slate-500 font-medium">اختر الكمية والمخزون المطلوب للبيع</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScannedItemModal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Item Card */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3">
              {scannedItemModal.item.imageUrl ? (
                <img
                  src={scannedItemModal.item.imageUrl}
                  alt={scannedItemModal.item.name}
                  className="w-16 h-16 rounded-xl object-contain bg-slate-50 border border-slate-200 shrink-0 p-0.5"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                  <Package className="w-7 h-7" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 text-sm truncate">{scannedItemModal.item.name}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>الفئة: {scannedItemModal.item.category}</span>
                  {scannedItemModal.item.size && <span>• المقاس: {scannedItemModal.item.size}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg">
                    {scannedItemModal.item.barcode}
                  </span>
                  <span className="text-xs font-black text-blue-700">
                    {scannedItemModal.item.sellPrice.toLocaleString()} دج / قطعة
                  </span>
                </div>
              </div>
            </div>

            {/* Stock Source Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">مصدر المخزون للبيع:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={getItemStock1(scannedItemModal.item) <= 0}
                  onClick={() => setScannedItemModal(prev => prev ? { 
                    ...prev, 
                    stockSource: 'stock1', 
                    qty: Math.min(prev.qty, getItemStock1(prev.item)) || 1 
                  } : null)}
                  className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                    scannedItemModal.stockSource === 'stock1'
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-blue-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  } disabled:opacity-40`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">مخزن 1 (الرئيسي)</span>
                    {scannedItemModal.stockSource === 'stock1' && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <span className="text-xs font-black text-slate-900 mt-1">
                    المتوفر: {getItemStock1(scannedItemModal.item)} قطعة
                  </span>
                </button>

                <button
                  type="button"
                  disabled={getItemStock2(scannedItemModal.item) <= 0}
                  onClick={() => setScannedItemModal(prev => prev ? { 
                    ...prev, 
                    stockSource: 'stock2', 
                    qty: Math.min(prev.qty, getItemStock2(prev.item)) || 1 
                  } : null)}
                  className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                    scannedItemModal.stockSource === 'stock2'
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-blue-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  } disabled:opacity-40`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">مخزن 2 (الثانوي)</span>
                    {scannedItemModal.stockSource === 'stock2' && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <span className="text-xs font-black text-slate-900 mt-1">
                    المتوفر: {getItemStock2(scannedItemModal.item)} قطعة
                  </span>
                </button>
              </div>
            </div>

            {/* Quantity Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">الكمية المراد بيعها:</label>
                <span className="text-[11px] text-slate-500">
                  الحد الأقصى المتوفر: {scannedItemModal.stockSource === 'stock1' ? getItemStock1(scannedItemModal.item) : getItemStock2(scannedItemModal.item)} قطعة
                </span>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setScannedItemModal(prev => prev ? { ...prev, qty: Math.max(1, prev.qty - 1) } : null)}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center active:scale-95 transition-all shadow-xs"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  min={1}
                  max={scannedItemModal.stockSource === 'stock1' ? getItemStock1(scannedItemModal.item) : getItemStock2(scannedItemModal.item)}
                  value={scannedItemModal.qty}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    const max = scannedItemModal.stockSource === 'stock1' ? getItemStock1(scannedItemModal.item) : getItemStock2(scannedItemModal.item);
                    setScannedItemModal(prev => prev ? { ...prev, qty: Math.max(1, Math.min(val, max)) } : null);
                  }}
                  className="flex-1 text-center font-black text-xl bg-white border border-slate-200 rounded-xl py-1.5 focus:outline-none focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={() => {
                    const max = scannedItemModal.stockSource === 'stock1' ? getItemStock1(scannedItemModal.item) : getItemStock2(scannedItemModal.item);
                    setScannedItemModal(prev => prev ? { ...prev, qty: Math.min(max, prev.qty + 1) } : null);
                  }}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center active:scale-95 transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[1, 2, 3, 5, 10].map(n => {
                  const maxAvailable = scannedItemModal.stockSource === 'stock1' 
                    ? getItemStock1(scannedItemModal.item) 
                    : getItemStock2(scannedItemModal.item);
                  if (n > maxAvailable) return null;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScannedItemModal(prev => prev ? { ...prev, qty: n } : null)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        scannedItemModal.qty === n 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {n} قطعة
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const max = scannedItemModal.stockSource === 'stock1' 
                      ? getItemStock1(scannedItemModal.item) 
                      : getItemStock2(scannedItemModal.item);
                    setScannedItemModal(prev => prev ? { ...prev, qty: max } : null);
                  }}
                  className="px-3 py-1 bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all"
                >
                  كل المتوفر
                </button>
              </div>
            </div>

            {/* Total Calculation */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">إجمالي السعر:</span>
                <span className="text-xs text-slate-500 font-normal">
                  {scannedItemModal.qty} قطعة × {scannedItemModal.item.sellPrice.toLocaleString()} دج
                </span>
              </div>
              <span className="text-lg font-bold font-mono text-slate-900">
                {(scannedItemModal.qty * scannedItemModal.item.sellPrice).toLocaleString()} دج
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  addCustomQtyToCart(scannedItemModal.item, scannedItemModal.qty, scannedItemModal.stockSource);
                  setScannedItemModal(null);
                }}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>إضافة للسلة ({scannedItemModal.qty} قطع)</span>
              </button>

              <button
                type="button"
                onClick={() => setScannedItemModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sales History */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-base">سجل المبيعات السابقة</h3>
          <span className="text-xs text-slate-500 font-medium">
            عرض {visibleSales.length} من {sales.length} عملية
          </span>
        </div>

        {sales.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">لم يتم تسجيل أي مبيعات بعد.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleSales.map(sale => {
              const saleDateObj = new Date(sale.date);
              const formattedDate = !isNaN(saleDateObj.getTime())
                ? saleDateObj.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'numeric', day: 'numeric' })
                : (sale.date ? sale.date.split('T')[0] : '');
              const formattedTime = !isNaN(saleDateObj.getTime())
                ? saleDateObj.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div key={sale.id} className="py-3 flex justify-between items-center text-xs gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* First item photo thumbnail if available */}
                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                      {sale.items[0]?.imageUrl ? (
                        <img src={sale.items[0].imageUrl} alt="صورة" className="w-full h-full object-contain" />
                      ) : (
                        <ShoppingBag className="w-4 h-4 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate flex items-center gap-1.5 flex-wrap">
                        <span>{sale.customerName || 'زبون عام'}</span>
                        <span className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md font-medium">
                          {formattedDate} {formattedTime && `• ${formattedTime}`}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5 truncate">
                        {sale.items.map(i => `${i.name} (${i.qty} قطع - ${i.stockSource === 'stock2' ? 'مخزن 2' : 'مخزن 1'})`).join('، ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <div className="font-bold font-mono text-slate-900">{sale.totalAmount.toLocaleString()} دج</div>
                      <div className="text-[10px] text-emerald-600 font-medium">ربح: +{sale.profit.toLocaleString()} دج</div>
                    </div>
                    <button
                      onClick={() => onDeleteSale(sale)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      title="إلغاء البيع واسترجاع للمخزن"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Bottom Progressive Load Button for Sales History */}
            <div className="pt-3 flex justify-between items-center text-xs">
              {visibleSalesCount < sales.length ? (
                <button
                  type="button"
                  disabled={isLoadingMoreSales}
                  onClick={() => {
                    setIsLoadingMoreSales(true);
                    setTimeout(() => {
                      setVisibleSalesCount(prev => Math.min(prev + 5, sales.length));
                      setIsLoadingMoreSales(false);
                    }, 250);
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-80 text-slate-800 rounded-xl font-bold transition-all border border-slate-200 text-center active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isLoadingMoreSales ? (
                    <>
                      <Loader2 className="w-4 h-4 text-slate-700 animate-spin shrink-0" />
                      <span>جاري التحميل...</span>
                    </>
                  ) : (
                    <>
                      <span>عرض 5 عمليات بيع أخرى (+5)</span>
                      <span className="text-[11px] font-normal text-slate-500">(عرض {visibleSales.length} من إجمالي {sales.length})</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="w-full text-center text-emerald-700 bg-emerald-50 border border-emerald-200/80 py-2 rounded-xl font-medium">
                  ✓ تم عرض كامل سجل المبيعات ({sales.length})
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white rounded-2xl overflow-hidden max-w-md w-full shadow-2xl relative"
          >
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
              <span className="font-bold text-xs">{previewImage.title}</span>
              <button 
                onClick={() => setPreviewImage(null)} 
                className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-hidden flex items-center justify-center bg-black">
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      {showCameraScanner && (
        <BarcodeScanner 
          onScan={(code) => {
            setShowCameraScanner(false);
            handleBarcodeCode(code);
          }}
          onClose={() => setShowCameraScanner(false)}
          title="مسح باركود القطعة للمبيعات"
        />
      )}

      {/* Scanned Barcode Item Quantity Selection Modal */}
      {scannedItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-blue-600">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Barcode className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">مسح الباركود - تحديد كمية البيع</h3>
                  <p className="text-[11px] text-slate-500 font-medium">تم التعرف على المنتج بنجاح</p>
                </div>
              </div>
              <button 
                onClick={() => setScannedItemModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Item Card */}
            <div className="flex gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 items-center">
              {scannedItemModal.item.imageUrl ? (
                <img 
                  src={scannedItemModal.item.imageUrl} 
                  alt={scannedItemModal.item.name} 
                  className="w-16 h-16 rounded-xl object-contain bg-white border border-slate-200 shrink-0 p-0.5"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                  <Package className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-slate-900 truncate">{scannedItemModal.item.name}</h4>
                <div className="text-xs text-slate-500 mt-0.5 space-x-2 space-x-reverse font-medium">
                  <span>مقاس: {scannedItemModal.item.size || 'عادي'}</span>
                  <span>• اللون: {scannedItemModal.item.color || 'عام'}</span>
                </div>
                <div className="text-xs font-black text-blue-700 mt-1">
                  سعر القطعة: {scannedItemModal.item.sellPrice.toLocaleString()} دج
                </div>
              </div>
            </div>

            {/* Stock Source Choice */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">مصدر المخزون للبيع:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const s1 = getItemStock1(scannedItemModal.item);
                    setScannedItemModal(prev => prev ? {
                      ...prev,
                      stockSource: 'stock1',
                      qty: Math.min(prev.qty, s1) || 1
                    } : null);
                  }}
                  disabled={getItemStock1(scannedItemModal.item) <= 0}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-right ${
                    scannedItemModal.stockSource === 'stock1'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  } disabled:opacity-40 disabled:pointer-events-none`}
                >
                  <div className="font-bold">المخزون 1 (المحل)</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    متوفر: {getItemStock1(scannedItemModal.item)} قطعة
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const s2 = getItemStock2(scannedItemModal.item);
                    setScannedItemModal(prev => prev ? {
                      ...prev,
                      stockSource: 'stock2',
                      qty: Math.min(prev.qty, s2) || 1
                    } : null);
                  }}
                  disabled={getItemStock2(scannedItemModal.item) <= 0}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-right ${
                    scannedItemModal.stockSource === 'stock2'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  } disabled:opacity-40 disabled:pointer-events-none`}
                >
                  <div className="font-bold">المخزون 2 (المستودع)</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    متوفر: {getItemStock2(scannedItemModal.item)} قطعة
                  </div>
                </button>
              </div>
            </div>

            {/* Quantity Selector */}
            {(() => {
              const maxStock = scannedItemModal.stockSource === 'stock1' 
                ? getItemStock1(scannedItemModal.item) 
                : getItemStock2(scannedItemModal.item);

              return (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700">اختر كمية المبيعات:</label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      الحد الأقصى المتوفر: {maxStock} قطعة
                    </span>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 justify-center">
                    <button
                      type="button"
                      onClick={() => setScannedItemModal(prev => prev ? { ...prev, qty: Math.max(1, prev.qty - 1) } : null)}
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-black text-lg active:scale-95 shadow-2xs"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <input
                      type="number"
                      min={1}
                      max={maxStock}
                      value={scannedItemModal.qty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        const safeVal = Math.min(Math.max(1, val), maxStock);
                        setScannedItemModal(prev => prev ? { ...prev, qty: safeVal } : null);
                      }}
                      className="w-20 text-center font-black text-xl bg-white border border-slate-200 rounded-xl py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />

                    <button
                      type="button"
                      onClick={() => setScannedItemModal(prev => prev ? { ...prev, qty: Math.min(maxStock, prev.qty + 1) } : null)}
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-black text-lg active:scale-95 shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex gap-1.5 justify-center pt-1">
                    {[1, 2, 3, 5, 10].map(q => (
                      q <= maxStock && (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setScannedItemModal(prev => prev ? { ...prev, qty: q } : null)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                            scannedItemModal.qty === q
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {q}
                        </button>
                      )
                    ))}
                    {maxStock > 1 && (
                      <button
                        type="button"
                        onClick={() => setScannedItemModal(prev => prev ? { ...prev, qty: maxStock } : null)}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      >
                        الكل ({maxStock})
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Total Display */}
            <div className="p-3 bg-blue-50/80 border border-blue-200/60 rounded-2xl flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">الإجمالي النهائي:</span>
              <span className="text-base font-black text-blue-700">
                {(scannedItemModal.item.sellPrice * scannedItemModal.qty).toLocaleString()} دج
              </span>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  addCustomQtyToCart(scannedItemModal.item, scannedItemModal.qty, scannedItemModal.stockSource);
                  setScannedItemModal(null);
                }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>إضافة إلى سلة المبيعات ({scannedItemModal.qty})</span>
              </button>

              <button
                type="button"
                onClick={() => setScannedItemModal(null)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
