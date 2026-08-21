import React, { useState, useMemo } from 'react';
import { ClothItem, Rental } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { CustomerIdScannerModal, ExtractedCustomerData } from './CustomerIdScannerModal';

interface RentalModalProps {
  clothes: ClothItem[];
  rental?: Rental | null;
  initialItemId?: string;
  existingRentals?: Rental[];
  onSubmit: (data: any) => void;
}

export const RentalModal: React.FC<RentalModalProps> = ({ 
  clothes, 
  rental, 
  initialItemId,
  existingRentals = [], 
  onSubmit 
}) => {
  const rentalClothes = clothes.filter(c => c.purpose === 'rent' || c.purpose === 'both');

  const defaultItemId = rental?.itemId || initialItemId || (rentalClothes[0]?.id || '');
  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId);
  const [customerName, setCustomerName] = useState(rental?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(rental?.customerPhone || '');
  const [customerIdNumber, setCustomerIdNumber] = useState(rental?.customerIdNumber || '');
  
  const today = new Date().toISOString().split('T')[0];

  const addDays = (baseDate: string, days: number) => {
    const d = new Date(baseDate || today);
    d.setDate(d.getDate() + Number(days));
    return d.toISOString().split('T')[0];
  };

  const getDaysDiff = (date1: string, date2: string) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d1.getTime() - d2.getTime();
    return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
  };

  const [startDate, setStartDate] = useState(rental?.startDate || today);
  const [expectedReturnDate, setExpectedReturnDate] = useState(
    rental?.expectedReturnDate || addDays(today, 2)
  );

  // Booking Type: Active Rental (Immediate handover) vs Future Booking (Reserved for future date, not in active rental until handover)
  const initialBookingType = rental?.status === 'reserved' 
    ? 'reserved' 
    : rental?.status === 'active' 
    ? 'active' 
    : (startDate > today ? 'reserved' : 'active');
  const [bookingType, setBookingType] = useState<'active' | 'reserved'>(initialBookingType);

  // Manual days inputs state
  const initialDaysUntil = getDaysDiff(rental?.startDate || today, today);
  const initialDuration = Math.max(1, getDaysDiff(rental?.expectedReturnDate || addDays(today, 2), rental?.startDate || today));

  const [daysUntilStart, setDaysUntilStart] = useState<number>(initialDaysUntil);
  const [durationDays, setDurationDays] = useState<number>(initialDuration);

  // Camera Barcode Scanner State inside modal
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showCustomerIdScanner, setShowCustomerIdScanner] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  // Handle extracted customer data from ID / Barcode
  const handleCustomerExtracted = (data: ExtractedCustomerData) => {
    if (data.name) setCustomerName(data.name);
    if (data.phone) setCustomerPhone(data.phone);
    if (data.idNumber) setCustomerIdNumber(data.idNumber);
    if (data.notes && !notes) setNotes(data.notes);
    setScanNotice(`✓ تم استخراج وتعبئة بيانات الزبون (${data.name || data.idNumber}) بنجاح!`);
    setTimeout(() => setScanNotice(null), 4000);
  };

  const handleDaysUntilChange = (days: number) => {
    const safeDays = Math.max(0, Number(days) || 0);
    setDaysUntilStart(safeDays);
    const newStart = addDays(today, safeDays);
    setStartDate(newStart);
    setExpectedReturnDate(addDays(newStart, durationDays));
    if (safeDays > 0 && !rental) {
      setBookingType('reserved');
    }
  };

  const handleDurationChange = (days: number) => {
    const safeDays = Math.max(1, Number(days) || 1);
    setDurationDays(safeDays);
    setExpectedReturnDate(addDays(startDate, safeDays));
  };

  const handleStartDateChange = (newDateStr: string) => {
    setStartDate(newDateStr);
    const diff = getDaysDiff(newDateStr, today);
    setDaysUntilStart(diff);
    setExpectedReturnDate(addDays(newDateStr, durationDays));
    if (newDateStr > today && !rental) {
      setBookingType('reserved');
    }
  };

  const handleExpectedReturnDateChange = (newDateStr: string) => {
    setExpectedReturnDate(newDateStr);
    const diff = Math.max(1, getDaysDiff(newDateStr, startDate));
    setDurationDays(diff);
  };
  
  const selectedItem = clothes.find(c => c.id === selectedItemId);
  const getItemStock1 = (c?: ClothItem) => c ? (c.stock1 !== undefined ? c.stock1 : (c.stock || 0)) : 0;
  const getItemStock2 = (c?: ClothItem) => c ? (c.stock2 !== undefined ? c.stock2 : 0) : 0;

  const [stockSource, setStockSource] = useState<'stock1' | 'stock2'>(
    rental?.stockSource || (getItemStock1(selectedItem) > 0 ? 'stock1' : 'stock2')
  );
  const [itemSize, setItemSize] = useState(rental?.itemSize || selectedItem?.size || '');
  const [itemColor, setItemColor] = useState(rental?.itemColor || selectedItem?.color || '');
  const [qty, setQty] = useState(rental?.qty || 1);

  // Pricing: Dress Price + Accessory Price = Total Rent Price
  const initialDressPrice = rental?.dressRentPrice !== undefined 
    ? rental.dressRentPrice 
    : (rental ? rental.rentPrice : (selectedItem ? selectedItem.rentPrice : 0));

  const [dressRentPrice, setDressRentPrice] = useState<number>(initialDressPrice);
  const [hasAccessories, setHasAccessories] = useState<boolean>(
    rental?.hasAccessories || !!(rental?.accessoryPrice && rental.accessoryPrice > 0) || false
  );
  const [accessoryName, setAccessoryName] = useState<string>(rental?.accessoryName || '');
  const [accessoryPrice, setAccessoryPrice] = useState<number | ''>(
    rental?.accessoryPrice !== undefined && rental.accessoryPrice > 0 ? rental.accessoryPrice : ''
  );

  // Auto-calculated Total Rental Price (سعر الفستان + سعر الإكسسوار)
  const safeDressPrice = typeof dressRentPrice === 'number' ? dressRentPrice : 0;
  const safeAccPrice = (hasAccessories && typeof accessoryPrice === 'number') ? accessoryPrice : 0;
  const totalRentPrice = safeDressPrice + safeAccPrice;

  const initialPaid = rental ? rental.paidAmount : (selectedItem ? selectedItem.rentPrice : 0);
  const [paidAmount, setPaidAmount] = useState<number>(initialPaid);
  const [cautionAmount, setCautionAmount] = useState<number>(rental ? rental.cautionAmount : (selectedItem ? selectedItem.cautionAmount : 0));
  const [notes, setNotes] = useState(rental?.notes || '');

  const remainingAmount = Math.max(0, totalRentPrice - paidAmount);

  const accessorySuggestions = [
    '👑 تاج عروس ملكي فاخر',
    '💎 حزام مجوهرات مرصع',
    '👛 حقيبة سهرة كلاتش (Clutch)',
    '🧣 شال / برنوس مطرز',
    '✨ طاقم إكسسوارات كامل (عقد وأقراط)',
    '🌸 طرحة عروس مطرزة'
  ];

  const handleQuickAccessorySelect = (tag: string) => {
    if (!accessoryName) {
      setAccessoryName(tag);
    } else if (!accessoryName.includes(tag)) {
      setAccessoryName(prev => `${prev} + ${tag}`);
    }
    if (!hasAccessories) {
      setHasAccessories(true);
    }
  };

  const handleItemChange = (id: string) => {
    setSelectedItemId(id);
    const item = clothes.find(c => c.id === id);
    if (item) {
      setItemSize(item.size || '');
      setItemColor(item.color || '');
      const newDressPrice = item.rentPrice || 0;
      setDressRentPrice(newDressPrice);
      const newTotal = newDressPrice + ((hasAccessories && typeof accessoryPrice === 'number') ? accessoryPrice : 0);
      setPaidAmount(newTotal);
      setCautionAmount(item.cautionAmount || 0);
      if (getItemStock1(item) <= 0 && getItemStock2(item) > 0) {
        setStockSource('stock2');
      } else {
        setStockSource('stock1');
      }
    }
  };

  // Handle barcode scanned from camera or laser
  const handleBarcodeScanned = (code: string) => {
    const cleanCode = code.trim().toLowerCase();
    const found = rentalClothes.find(c => c.barcode.trim().toLowerCase() === cleanCode || c.name.toLowerCase().includes(cleanCode));
    if (found) {
      handleItemChange(found.id);
      setScanNotice(`✓ تم اختيار: ${found.name} (${found.size}) بالباركود`);
      setTimeout(() => setScanNotice(null), 3000);
      setShowBarcodeScanner(false);
    } else {
      alert(`لم يتم العثور على فستان أو زي مخصص للكراء بالباركود: ${code}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('الرجاء إدخال اسم ورقم هاتف الزبون');
      return;
    }

    if (!selectedItemId) {
      alert('الرجاء اختيار قطعة الملابس المراد كراؤها');
      return;
    }

    if (new Date(expectedReturnDate) < new Date(startDate)) {
      alert('تاريخ الإرجاع لا يمكن أن يكون قبل تاريخ استلام الكراء!');
      return;
    }

    onSubmit({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerIdNumber: customerIdNumber.trim(),
      itemId: selectedItemId,
      itemName: selectedItem?.name || 'قطعة ملابس',
      itemSize,
      itemColor,
      qty: Number(qty),
      stockSource,
      startDate,
      expectedReturnDate,
      dressRentPrice: Number(safeDressPrice),
      hasAccessories: Boolean(hasAccessories),
      accessoryName: hasAccessories && accessoryName.trim() ? accessoryName.trim() : undefined,
      accessoryPrice: hasAccessories ? Number(safeAccPrice) : 0,
      rentPrice: Number(totalRentPrice),
      paidAmount: Number(paidAmount),
      remainingAmount,
      cautionAmount: Number(cautionAmount),
      cautionStatus: 'held',
      status: bookingType === 'reserved' ? 'reserved' : 'active',
      bookingDate: rental?.bookingDate || today,
      handoverDate: bookingType === 'active' ? (rental?.handoverDate || today) : undefined,
      notes: notes.trim(),
      createdAt: rental?.createdAt || new Date().toISOString()
    });
  };

  const [quickBarcodeInput, setQuickBarcodeInput] = useState('');

  const handleQuickBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const code = quickBarcodeInput.trim();
    if (!code) return;
    handleBarcodeScanned(code);
    setQuickBarcodeInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-800" dir="rtl">
      {/* Booking Mode Selector (كراء فوري مباشر vs مستأجرة مستقبلاً) */}
      <div className="bg-slate-900 text-white p-3.5 rounded-3xl shadow-xs space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-black text-slate-200">نوع العملية والتسليم:</span>
          <span className="text-[10px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-md font-bold">
            {bookingType === 'reserved' ? '📅 حجز لمناسبة قادمة' : '👗 تسليم فوري مباشر'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBookingType('active')}
            className={`p-2.5 rounded-2xl text-xs font-black transition-all flex flex-col items-center gap-1 border ${
              bookingType === 'active'
                ? 'bg-rose-600 border-rose-500 text-white shadow-md'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="text-base">👗</span>
            <span>كراء فوري مباشر</span>
            <span className="text-[9px] font-normal opacity-80">تسليم الفستان الآن</span>
          </button>

          <button
            type="button"
            onClick={() => setBookingType('reserved')}
            className={`p-2.5 rounded-2xl text-xs font-black transition-all flex flex-col items-center gap-1 border ${
              bookingType === 'reserved'
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="text-base">📅</span>
            <span>مستأجرة مستقبلاً (حجز)</span>
            <span className="text-[9px] font-normal opacity-80">لمناسبة قادمة + عربون</span>
          </button>
        </div>

        {bookingType === 'reserved' ? (
          <div className="bg-indigo-950/60 border border-indigo-500/30 p-2.5 rounded-xl text-[11px] text-indigo-200 flex items-start gap-2">
            <span className="text-sm shrink-0">💡</span>
            <span>
              <strong>مستأجرة مستقبلاً:</strong> يُسجل الحجز والعربون، <u>ولا يدخل الفستان في الكراء الجاري ولا ينقص من مخزن المحل الفعلي</u> حتى يحين موعد الاستلام وتتم الصفقة وتسليم الفستان للزبونة.
            </span>
          </div>
        ) : (
          <div className="bg-rose-950/60 border border-rose-500/30 p-2.5 rounded-xl text-[11px] text-rose-200 flex items-start gap-2">
            <span className="text-sm shrink-0">⚡</span>
            <span>
              <strong>كراء فوري:</strong> يتم تسليم الفستان الآن ويدخل مباشرة في الكراء الجاري ويتم خصمه من المخزن المتوفر.
            </span>
          </div>
        )}
      </div>

      {/* Dress Selector with Quick Barcode Scan */}
      <div className="bg-rose-50/70 border border-rose-100 p-3.5 rounded-2xl space-y-2.5">
        <div className="flex justify-between items-center">
          <label className="block text-xs font-black text-rose-900">اختر الفستان أو الزي للكراء *</label>
          <span className="text-[10px] text-rose-600 font-bold bg-rose-100 px-2 py-0.5 rounded-md">⚡ مسح باركود سريع</span>
        </div>

        {/* Quick Barcode/Search Input + Camera Scanner Button */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={quickBarcodeInput}
            onChange={(e) => setQuickBarcodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickBarcodeSearch(e);
              }
            }}
            placeholder="⚡ امسح بالليزر أو اكتب الباركود..."
            className="flex-1 bg-white border border-rose-200 focus:border-rose-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleQuickBarcodeSearch}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
          >
            تحديد ↵
          </button>
          <button
            type="button"
            onClick={() => setShowBarcodeScanner(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 flex items-center gap-1 shadow-xs"
            title="مسح باركود الفستان بالكاميرا"
          >
            <span>📷</span>
            <span className="hidden sm:inline">مسح بالكاميرا</span>
          </button>
        </div>

        {/* Scanned notification */}
        {scanNotice && (
          <div className="bg-emerald-600 text-white text-xs font-bold p-2 rounded-xl text-center animate-pulse">
            {scanNotice}
          </div>
        )}

        <select
          value={selectedItemId}
          onChange={(e) => handleItemChange(e.target.value)}
          className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
        >
          {rentalClothes.map(item => {
            const s1 = getItemStock1(item);
            const s2 = getItemStock2(item);
            return (
              <option key={item.id} value={item.id}>
                {item.name} - (مقاس: {item.size} | لون: {item.color}) - كراء: {item.rentPrice} دج - (مخزن1: {s1} | مخزن2: {s2})
              </option>
            );
          })}
        </select>
        
        {selectedItem && (
          <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-rose-200/60 text-[11px] font-bold text-rose-800">
            {selectedItem.imageUrl ? (
              <img 
                src={selectedItem.imageUrl} 
                alt={selectedItem.name} 
                className="w-12 h-12 rounded-xl object-cover border border-rose-200 shadow-xs shrink-0" 
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-xl shrink-0">
                👗
              </div>
            )}
            <div className="flex-1 flex flex-wrap gap-x-2.5 gap-y-1">
              <span>التصنيف: {selectedItem.category}</span>
              <span>•</span>
              <span>الباركود: {selectedItem.barcode}</span>
              <span>•</span>
              <span className="text-indigo-900">🏬 مخزون 1: {getItemStock1(selectedItem)}</span>
              <span>•</span>
              <span className="text-amber-900">📦 مخزون 2: {getItemStock2(selectedItem)}</span>
            </div>
          </div>
        )}

        {/* Stock Source Selection Buttons */}
        <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black text-slate-700">المخزن المراد الكراء منه:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStockSource('stock1')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 ${
                stockSource === 'stock1' 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>🏬</span>
              <span>المخزون 1 ({getItemStock1(selectedItem)})</span>
            </button>
            <button
              type="button"
              onClick={() => setStockSource('stock2')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 ${
                stockSource === 'stock2' 
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>📦</span>
              <span>المخزون 2 ({getItemStock2(selectedItem)})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date & Duration Inputs - Standard Form Style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            تاريخ استلام الكراء *
          </label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="w-[145px] sm:w-[155px] bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-rose-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            مدة الكراء (عدد الأيام) *
          </label>
          <input
            type="number"
            min="1"
            max="365"
            required
            value={durationDays}
            onChange={(e) => handleDurationChange(Number(e.target.value))}
            placeholder="2"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-rose-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            تاريخ إرجاع الفستان *
          </label>
          <input
            type="date"
            required
            value={expectedReturnDate}
            onChange={(e) => handleExpectedReturnDateChange(e.target.value)}
            className="w-[145px] sm:w-[155px] bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-rose-500 focus:outline-none text-rose-700 font-black"
          />
        </div>
      </div>

      {/* Customer Information with Smart ID & Barcode Scanner */}
      <div className="bg-gradient-to-br from-slate-50 to-rose-50/30 p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-sm font-bold">
              👤
            </span>
            <div>
              <span className="text-xs font-black text-slate-800 block">معلومات وهوية الزبونة / الزبون</span>
              <span className="text-[10px] text-slate-500 font-medium">يمكنك الكتابة يدوياً أو المسح المباشر بالكاميرا</span>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setShowCustomerIdScanner(true)}
            className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 active:scale-95 text-white px-3.5 py-2 rounded-2xl text-xs font-black transition-all shadow-md shadow-rose-200 flex items-center gap-2 border border-rose-500"
            title="مسح بطاقة التعريف الوطنية أو رخصة السياقة أو باركود الزبون بالكاميرا"
          >
            <span className="text-sm">📷</span>
            <span>مسح بطاقة الهوية بالكاميرا (AI OCR)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700">اسم ولقب الزبونة / الزبون *</label>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="الاسم واللقب الكامل..."
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-rose-500 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700">رقم الهاتف *</label>
            </div>
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="05 / 06 / 07..."
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-rose-500 focus:outline-none shadow-2xs"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700">رقم بطاقة الهوية / التعريف (NIN)</label>
              <button
                type="button"
                onClick={() => setShowCustomerIdScanner(true)}
                className="text-[10px] text-rose-600 font-bold hover:underline flex items-center gap-0.5"
              >
                <span>📷</span>
                <span>مسح</span>
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={customerIdNumber}
                onChange={(e) => setCustomerIdNumber(e.target.value)}
                placeholder="رقم البطاقة الوطنية أو الضمانة..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold font-mono text-slate-900 focus:border-rose-500 focus:outline-none shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowCustomerIdScanner(true)}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                title="مسح بطاقة الهوية بالكاميرا"
              >
                📷
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Accessories & Extras Section (كراء إكسسوار مع الفستان) */}
      <div className={`p-4 rounded-3xl border transition-all ${
        hasAccessories 
          ? 'bg-amber-50/70 border-amber-300 shadow-xs' 
          : 'bg-slate-50/80 border-slate-200'
      }`}>
        <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-black">
              👑
            </span>
            <div>
              <span className="text-xs font-black text-slate-900 block">إضافة إكسسوارات مع الفستان (تاج، حزام، حقيبة، شال...)</span>
              <span className="text-[10px] text-slate-500 font-bold">يمكنك تحديد الإكسسوار وسعره ليُحسب السعر الإجمالي تلقائياً</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const nextVal = !hasAccessories;
              setHasAccessories(nextVal);
              if (nextVal && !accessoryName) {
                setAccessoryName('👑 تاج عروس ملكي فاخر');
                setAccessoryPrice(1500);
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 ${
              hasAccessories
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span>{hasAccessories ? '✓ تم تفعيل الإكسسوار' : '+ إضافة إكسسوار'}</span>
          </button>
        </div>

        {hasAccessories && (
          <div className="mt-3 space-y-3 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black text-amber-950 mb-1">
                  اسم / بيان الإكسسوار المرفق *
                </label>
                <input
                  type="text"
                  required={hasAccessories}
                  value={accessoryName}
                  onChange={(e) => setAccessoryName(e.target.value)}
                  placeholder="مثال: تاج ملكي فاخر + حزام مجوهرات..."
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-amber-950 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-amber-950 mb-1">
                  سعر كراء الإكسسوار (دج) *
                </label>
                <input
                  type="number"
                  min="0"
                  required={hasAccessories}
                  value={accessoryPrice}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setAccessoryPrice(val);
                  }}
                  placeholder="0"
                  className="w-full bg-white border-2 border-amber-400 rounded-xl px-3 py-2 text-xs font-black text-amber-900 focus:outline-none focus:border-amber-600"
                />
              </div>
            </div>

            {/* Quick Accessory Suggestions */}
            <div>
              <span className="text-[10px] text-amber-900 font-bold block mb-1">اقتراحات سريعة للإكسسوارات:</span>
              <div className="flex flex-wrap gap-1.5">
                {accessorySuggestions.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleQuickAccessorySelect(tag)}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Financial Calculation Summary Box (سعر الفستان + الإكسسوار = السعر الكلي) */}
      <div className={`p-4 rounded-3xl border-2 space-y-3 ${
        bookingType === 'reserved' 
          ? 'bg-gradient-to-br from-indigo-50/80 via-white to-amber-50/60 border-indigo-200' 
          : 'bg-gradient-to-br from-rose-50/80 via-white to-amber-50/60 border-rose-200'
      }`}>
        {/* Dynamic Formula Header */}
        <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-200">
          <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <span>💰 الحساب المالي لكراء الفستان</span>
            {hasAccessories && (
              <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                (فستان + إكسسوار)
              </span>
            )}
          </div>

          <div className="bg-slate-900 text-white px-3 py-1 rounded-xl text-xs font-black flex items-center gap-2">
            <span className="text-[11px] text-slate-300 font-normal">السعر الكلي الإجمالي:</span>
            <span className="text-emerald-400 font-mono text-sm">{totalRentPrice.toLocaleString()} دج</span>
          </div>
        </div>

        {/* Detailed inputs: Dress Price, Accessory Price, Total, Paid, Remaining */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Dress Base Price */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 mb-1">
              👗 سعر كراء الفستان (دج) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={dressRentPrice}
              onChange={(e) => setDressRentPrice(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-rose-700 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* 2. Accessory Price (Read or Edit) */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 mb-1">
              👑 سعر الإكسسوار (دج)
            </label>
            <input
              type="number"
              min="0"
              disabled={!hasAccessories}
              value={hasAccessories ? (accessoryPrice === '' ? '' : accessoryPrice) : 0}
              onChange={(e) => {
                if (hasAccessories) {
                  setAccessoryPrice(e.target.value === '' ? '' : Number(e.target.value));
                }
              }}
              placeholder={hasAccessories ? "0" : "بدون إكسسوار"}
              className={`w-full border rounded-xl px-3 py-2 text-xs font-black focus:outline-none ${
                hasAccessories
                  ? 'bg-amber-50 border-amber-300 text-amber-900 focus:border-amber-500'
                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            />
          </div>

          {/* 3. Paid Amount / Deposit */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] font-black text-slate-700">
                {bookingType === 'reserved' ? 'العربون / التسبيق (دج) *' : 'المدفوع مسبقاً (دج) *'}
              </label>
              <button
                type="button"
                onClick={() => setPaidAmount(totalRentPrice)}
                className="text-[10px] text-emerald-700 font-bold underline"
              >
                دفع كامل
              </button>
            </div>
            <input
              type="number"
              min="0"
              required
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
              className="w-full bg-white border-2 border-emerald-300 rounded-xl px-3 py-2 text-xs font-black text-emerald-700 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* 4. Remaining Amount (المتبقي) */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 mb-1">
              {bookingType === 'reserved' ? 'المتبقي عند استلام الفستان' : 'المتبقي (دين/كريدي)'}
            </label>
            <div className={`w-full rounded-xl px-3 py-2 text-xs font-black border flex items-center justify-between ${
              remainingAmount > 0 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <span>{remainingAmount.toLocaleString()} دج</span>
              <span className="text-[10px] font-bold">
                {remainingAmount > 0 ? 'متبقي ⏳' : 'خالص 0 دج ✓'}
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown Calculation Banner */}
        {hasAccessories && safeAccPrice > 0 && (
          <div className="bg-white p-2.5 rounded-xl border border-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-600 font-bold">تفاصيل مجموع الكراء:</span>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-rose-700 font-bold">👗 فستان: {safeDressPrice.toLocaleString()} دج</span>
              <span className="text-slate-400 font-bold">+</span>
              <span className="text-amber-800 font-bold">👑 إكسسوار: {safeAccPrice.toLocaleString()} دج</span>
              <span className="text-slate-400 font-bold">=</span>
              <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-md">
                الإجمالي: {totalRentPrice.toLocaleString()} دج
              </span>
            </div>
          </div>
        )}

        {/* Caution Amount (الضمان المالي) */}
        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="text-xs font-black text-amber-900 block">الضمان المالي (Caution):</span>
            <span className="text-[10px] text-slate-500 font-medium">مبلغ مسترجع للزبونة عند إعادة الفستان والإكسسوار سليمين.</span>
          </div>
          <div className="w-full sm:w-48">
            <input
              type="number"
              min="0"
              value={cautionAmount}
              onChange={(e) => setCautionAmount(Number(e.target.value))}
              className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-black text-amber-900 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Notes / Special Requests */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات أو تعديلات خاصة (خياطة/تنظيف...)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="أي تفاصيل خاصة بالمقاس، التضييق، أو موعد التسليم..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-rose-500"
        />
      </div>

      <button
        type="submit"
        className={`w-full py-3.5 active:scale-[0.98] text-white rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all min-h-[44px] flex items-center justify-center gap-2 ${
          bookingType === 'reserved'
            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
            : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
        }`}
      >
        <span>{bookingType === 'reserved' ? '📅' : '👗'}</span>
        <span>
          {rental 
            ? 'حفظ تعديلات العملية ✓' 
            : bookingType === 'reserved'
            ? 'تأكيد وحفظ حجز الفستان مستقبلاً (تسجيل العربون)'
            : 'تأكيد وتسجيل الكراء الفوري (تسليم الفستان)'}
        </span>
      </button>

      {/* Embedded Barcode Scanner Camera Modal for Clothes */}
      {showBarcodeScanner && (
        <BarcodeScanner
          title="مسح باركود فستان الكراء 👗"
          onScan={(code) => handleBarcodeScanned(code)}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {/* Smart Customer ID & Barcode Scanner Modal */}
      {showCustomerIdScanner && (
        <CustomerIdScannerModal
          title="مسح بطاقة تعريف أو باركود الزبونة 🆔"
          onExtract={handleCustomerExtracted}
          onClose={() => setShowCustomerIdScanner(false)}
        />
      )}
    </form>
  );
};

