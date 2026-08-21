import React, { useState, useEffect, useRef } from 'react';
import { ClothItem, Sale, SaleItem } from '../types';
import { CustomerIdScannerModal, ExtractedCustomerData } from './CustomerIdScannerModal';
import { 
  playPosScannerBeep, 
  playPosErrorBeep, 
  validateAndSanitizeBarcode 
} from '../utils/scannerSoundAndValidation';

interface SalesPOSViewProps {
  clothes: ClothItem[];
  sales: Sale[];
  onCompleteSale: (saleData: any) => void;
  onDeleteSale: (sale: Sale) => void;
  onScanBarcode: () => void;
}

export const SalesPOSView: React.FC<SalesPOSViewProps> = ({
  clothes,
  sales,
  onCompleteSale,
  onDeleteSale
}) => {
  const getItemStock1 = (c: ClothItem) => c.stock1 !== undefined ? c.stock1 : (c.stock || 0);
  const getItemStock2 = (c: ClothItem) => c.stock2 !== undefined ? c.stock2 : 0;
  const getItemTotalStock = (c: ClothItem) => getItemStock1(c) + getItemStock2(c);

  const sellableClothes = clothes.filter(c => 
    (c.purpose === 'sell' || c.purpose === 'both') && 
    (getItemTotalStock(c) - (c.rentedCount || 0) > 0)
  );

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCustomerIdScanner, setShowCustomerIdScanner] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
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

  const addToCart = (item: ClothItem, preferredStock?: 'stock1' | 'stock2') => {
    const s1 = getItemStock1(item);
    const s2 = getItemStock2(item);

    // Determine stock source: preferred, or where available
    let chosenStock: 'stock1' | 'stock2' = preferredStock || (s1 > 0 ? 'stock1' : 'stock2');
    if (!preferredStock && s1 <= 0 && s2 > 0) {
      chosenStock = 'stock2';
    }

    const targetStockMax = chosenStock === 'stock1' ? s1 : s2;
    const existing = cart.find(ci => ci.itemId === item.id && ci.stockSource === chosenStock);

    if (existing) {
      if (existing.qty >= targetStockMax) {
        // If current stock depleted, check if other stock has quantity
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

    // 🔊 Authentic POS Laser Scanner Beep
    playPosScannerBeep('classic');
    setLastScannedItem(item.name);
    setTimeout(() => setLastScannedItem(null), 2500);
  };

  // Instant barcode search and add
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw) return;

    const validation = validateAndSanitizeBarcode(raw);
    const code = validation.isValid ? validation.code : raw;

    const matched = clothes.find(c => c.barcode.trim().toLowerCase() === code.toLowerCase());
    if (matched) {
      const totalStock = getItemTotalStock(matched);
      if (totalStock - (matched.rentedCount || 0) <= 0) {
        playPosErrorBeep();
        alert(`القطعة "${matched.name}" نفدت من كلا المخزنين.`);
      } else {
        addToCart(matched);
        setBarcodeInput('');
      }
    } else {
      playPosErrorBeep();
      alert(`لم يتم العثور على قطعة بالباركود: ${code}`);
    }
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
          const validation = validateAndSanitizeBarcode(buffer.trim());
          const scannedCode = validation.isValid ? validation.code : buffer.trim();
          const matched = clothes.find(c => c.barcode.trim().toLowerCase() === scannedCode.toLowerCase());
          if (matched) {
            addToCart(matched);
            setBarcodeInput('');
          } else {
            playPosErrorBeep();
          }
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

  const totalAmount = cart.reduce((s, ci) => s + ci.total, 0);
  const totalCost = cart.reduce((s, ci) => s + (ci.cost * ci.qty), 0);
  const totalProfit = totalAmount - totalCost;

  const actualPaid = paidAmount === '' ? totalAmount : Number(paidAmount);
  const debtAmount = Math.max(0, totalAmount - actualPaid);

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (debtAmount > 0 && (!customerName.trim() || !customerPhone.trim())) {
      alert('الرجاء إدخال اسم ورقم هاتف الزبون لتسجيل الكريدي');
      return;
    }

    onCompleteSale({
      customerName: customerName.trim() || 'زبون عام',
      customerPhone: customerPhone.trim(),
      items: cart,
      totalAmount,
      paidAmount: actualPaid,
      debtAmount,
      profit: totalProfit,
      date: new Date().toISOString()
    });

    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaidAmount('');
  };

  const filteredClothes = sellableClothes.filter(c => {
    if (selectedCategory !== 'الكل' && c.category !== selectedCategory) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.barcode.includes(q) || c.color.toLowerCase().includes(q) || c.size.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6" dir="rtl">
      {/* Top Split Layout: POS Selector and Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Mobile Cart Summary Sticky Pill */}
        {cart.length > 0 && (
          <div className="lg:hidden bg-indigo-600 text-white p-3 rounded-2xl flex justify-between items-center shadow-lg shadow-indigo-200">
            <div className="flex items-center gap-2">
              <span className="text-base">🛒</span>
              <div>
                <span className="text-xs font-black block">سلة المبيعات: {cart.reduce((s, ci) => s + ci.qty, 0)} قطع</span>
                <span className="text-[10px] text-indigo-100 font-bold">{totalAmount.toLocaleString()} دج</span>
              </div>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById('checkout-card');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-white text-indigo-700 px-3.5 py-1.5 rounded-xl text-xs font-black active:scale-95 transition-all"
            >
              إتمام البيع ↓
            </button>
          </div>
        )}

        {/* Product Selection with Photo Grid */}
        <div className="lg:col-span-7 space-y-3 sm:space-y-4">
          <div className="bg-white p-3.5 sm:p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>نقطة بيع الأزياء (POS)</span>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-bold">
                    {filteredClothes.length} معروض
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">البيع من المخزون 1 أو المخزون 2 مع المسح التلقائي بالباركود.</p>
              </div>

              {/* Laser Barcode Quick Input Form */}
              <form onSubmit={handleBarcodeSubmit} className="w-full sm:w-auto flex gap-1.5">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="مسح باركود بالليزر ⚡"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold w-full sm:w-48 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shrink-0"
                >
                  إضافة
                </button>
              </form>
            </div>

            {/* Scan Success Notice */}
            {lastScannedItem && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl text-center animate-pulse">
                ✓ تمت إضافة ({lastScannedItem}) إلى سلة المبيعات
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الباركود أو اللون..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs sm:text-sm font-bold focus:outline-none focus:border-indigo-500"
              />
              <svg className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                    selectedCategory === cat ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Sellable Products with Photo Gallery */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredClothes.map(item => {
              const s1 = getItemStock1(item);
              const s2 = getItemStock2(item);
              const totalStock = s1 + s2;
              const inCartCount = cart.filter(ci => ci.itemId === item.id).reduce((s, ci) => s + ci.qty, 0);

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl overflow-hidden border transition-all select-none relative hover:border-indigo-400 hover:shadow-md flex flex-col justify-between group ${
                    inCartCount > 0 ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-100 shadow-xs'
                  }`}
                >
                  {/* Photo Container */}
                  <div 
                    onClick={() => addToCart(item)}
                    className="relative aspect-4/3 bg-slate-100 overflow-hidden flex items-center justify-center cursor-pointer"
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
                      <div className="flex flex-col items-center justify-center text-slate-300">
                        <span className="text-2xl">👗</span>
                      </div>
                    )}

                    {/* Quantity Badge in Cart */}
                    {inCartCount > 0 && (
                      <span className="absolute top-2 left-2 bg-indigo-600 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-bounce">
                        {inCartCount}
                      </span>
                    )}

                    {/* Stock Tag on Top Right */}
                    <span className={`absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded-md backdrop-blur-xs ${
                      totalStock > 1 ? 'bg-slate-900/70 text-white' : 'bg-amber-500/90 text-white'
                    }`}>
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
                        className="absolute bottom-1.5 left-1.5 bg-black/60 hover:bg-black/80 text-white p-1 rounded-lg text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        title="تكبير الصورة"
                      >
                        🔍
                      </button>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-2.5 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block truncate">{item.category}</span>
                      <h4 className="font-black text-slate-800 text-xs mt-0.5 line-clamp-2 leading-tight min-h-[28px]">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold mt-1">
                        <span>مقاس: {item.size}</span>
                        {item.color && <span>• {item.color}</span>}
                      </div>
                    </div>

                    {/* Stock 1 & Stock 2 badges with 1-click add */}
                    <div className="pt-1.5 border-t border-slate-100 space-y-1">
                      <div className="flex items-center justify-between text-xs font-black text-indigo-700">
                        <span>السعر:</span>
                        <span>{item.sellPrice.toLocaleString()} دج</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => addToCart(item, 'stock1')}
                          disabled={s1 <= 0}
                          className="py-1 px-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-900 border border-indigo-200 rounded-lg font-bold flex items-center justify-between active:scale-95 transition-all"
                          title="إضافة من المخزون 1"
                        >
                          <span>🏬 مخزن 1:</span>
                          <span className="font-black">{s1}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => addToCart(item, 'stock2')}
                          disabled={s2 <= 0}
                          className="py-1 px-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-900 border border-amber-200 rounded-lg font-bold flex items-center justify-between active:scale-95 transition-all"
                          title="إضافة من المخزون 2"
                        >
                          <span>📦 مخزن 2:</span>
                          <span className="font-black">{s2}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart & Checkout Panel */}
        <div className="lg:col-span-5" id="checkout-card">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-4 sticky top-20">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span>🛒 سلة المبيعات</span>
                <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-lg font-bold">
                  {cart.reduce((s, ci) => s + ci.qty, 0)} قطع
                </span>
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold p-1"
                >
                  تفريغ السلة
                </button>
              )}
            </div>

            {/* Cart Items with Stock 1 / Stock 2 selectors */}
            {cart.length === 0 ? (
              <div className="py-8 sm:py-12 text-center text-slate-400 space-y-2">
                <div className="text-3xl">🛍️</div>
                <p className="text-xs font-bold">السلة فارغة، اضغط على أي قطعة من القائمة لإضافتها</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {cart.map((item, idx) => {
                  const source = item.stockSource || 'stock1';

                  return (
                    <div key={`${item.itemId}_${source}_${idx}`} className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-xs space-y-2">
                      <div className="flex justify-between items-center gap-2">
                        {/* Item Photo / Icon */}
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm">👗</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-black text-slate-800 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-500 font-bold flex items-center gap-2">
                            <span>{item.size}</span>
                            <span>•</span>
                            <span>{item.price.toLocaleString()} دج</span>
                          </div>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => updateQty(item.itemId, item.stockSource, item.qty - 1)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-black hover:bg-slate-100 active:scale-95 text-xs"
                          >
                            -
                          </button>
                          <span className="font-black text-slate-900 w-4 text-center text-xs">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.itemId, item.stockSource, item.qty + 1)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-black hover:bg-slate-100 active:scale-95 text-xs"
                          >
                            +
                          </button>
                          <span className="font-black text-slate-900 min-w-[55px] text-left mr-1">
                            {item.total.toLocaleString()} دج
                          </span>
                        </div>
                      </div>

                      {/* Stock Source Toggle Badge */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-[10px]">
                        <span className="text-slate-500 font-bold">الخصم من المخزن:</span>
                        <button
                          type="button"
                          onClick={() => toggleStockSource(item.itemId, source)}
                          className={`px-2 py-0.5 rounded-md font-bold transition-all flex items-center gap-1 ${
                            source === 'stock1' 
                              ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' 
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                          title="اضغط للتبديل بين مخزون 1 ومخزون 2"
                        >
                          <span>{source === 'stock1' ? '🏬 المخزون 1 (المحل)' : '📦 المخزون 2 (المستودع)'}</span>
                          <span className="text-[9px] underline">⇄ تبديل</span>
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
                  <span className="font-bold text-slate-700 text-[11px]">معلومات الزبون (اختياري)</span>
                  <button
                    type="button"
                    onClick={() => setShowCustomerIdScanner(true)}
                    className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 active:scale-95 px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-all"
                  >
                    <span>💳</span>
                    <span>مسح بطاقة الهوية / الباركود</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اسم الزبون (اختياري)..."
                    className="border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="رقم الهاتف..."
                    className="border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">المبلغ الإجمالي</label>
                    <div className="text-base font-black text-slate-900">{totalAmount.toLocaleString()} دج</div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">المبلغ المستلم</label>
                    <input
                      type="number"
                      min="0"
                      max={totalAmount}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={totalAmount.toString()}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-black text-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>

                {debtAmount > 0 && (
                  <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl font-bold flex justify-between items-center text-xs">
                    <span>المتبقي دين على الزبون:</span>
                    <span className="font-black">{debtAmount.toLocaleString()} دج</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition-all shadow-md shadow-indigo-100 active:scale-[0.98] min-h-[44px]"
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
          title="مسح بطاقة تعريف أو باركود الزبون 🛍️"
          onExtract={handleCustomerExtracted}
          onClose={() => setShowCustomerIdScanner(false)}
        />
      )}

      {/* Recent Sales History */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
        <h3 className="font-black text-slate-900 text-base">سجل المبيعات السابقة</h3>
        {sales.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">لم يتم تسجيل أي مبيعات بعد.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sales.map(sale => (
              <div key={sale.id} className="py-3 flex justify-between items-center text-xs gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* First item photo thumbnail if available */}
                  <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {sale.items[0]?.imageUrl ? (
                      <img src={sale.items[0].imageUrl} alt="صورة" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs">🛍️</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-black text-slate-800 truncate">
                      {sale.customerName || 'زبون عام'} 
                      <span className="text-[10px] text-slate-400 font-normal mr-2">
                        ({new Date(sale.date).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5 truncate">
                      {sale.items.map(i => `${i.name} (${i.qty} قطع - ${i.stockSource === 'stock2' ? 'مخزن 2' : 'مخزن 1'})`).join('، ')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-left">
                    <div className="font-black text-slate-900">{sale.totalAmount.toLocaleString()} دج</div>
                    <div className="text-[10px] text-emerald-600 font-bold">ربح: {sale.profit.toLocaleString()} دج</div>
                  </div>
                  <button
                    onClick={() => onDeleteSale(sale)}
                    className="text-slate-300 hover:text-rose-600 p-1 rounded transition-colors"
                    title="إلغاء البيع واسترجاع للمخزن"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
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
            className="bg-white rounded-3xl overflow-hidden max-w-md w-full shadow-2xl relative"
          >
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
              <span className="font-bold text-xs">{previewImage.title}</span>
              <button 
                onClick={() => setPreviewImage(null)} 
                className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs"
              >
                ✕
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
    </div>
  );
};
