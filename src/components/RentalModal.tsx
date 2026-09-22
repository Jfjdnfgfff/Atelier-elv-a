import React, { useState, useMemo } from 'react';
import { ClothItem, Rental } from '../types';
const BarcodeScanner = React.lazy(() => import('./BarcodeScanner').then(m => ({ default: m.BarcodeScanner })));
const CustomerIdScannerModal = React.lazy(() => import('./CustomerIdScannerModal').then(m => ({ default: m.CustomerIdScannerModal })));
import type { ExtractedCustomerData } from './CustomerIdScannerModal';
import { LettersInput, NumbersInput } from './Shared';
import { sanitizeName, sanitizePhone, sanitizeDigitsOnly, sanitizeText } from '../utils/security';
import { 
  Shirt, 
  Calendar, 
  Camera, 
  User, 
  Crown, 
  Check, 
  Building2, 
  Package, 
  DollarSign, 
  Clock, 
  Info,
  Barcode,
  Trash2,
  RotateCcw
} from 'lucide-react';

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

  // Handle extracted customer data from ID / Barcode using update/merge logic
  const handleCustomerExtracted = (data: ExtractedCustomerData) => {
    const cleanName = (data.name || '').replace(/^(الاسم واللقب|الاسم|اللقب|Nom|Prénom)[\s:]*/i, '').trim();
    const cleanId = (data.idNumber || '').replace(/^(NIN|رقم التعريف|بطاقة|ID)[\s:]*/i, '').trim();
    const cleanPhone = (data.phone || '').trim();

    if (cleanName) {
      setCustomerName(prev => (prev.trim() && !prev.includes(cleanName) ? `${prev} - ${cleanName}` : (prev.trim() || cleanName)));
    }
    if (cleanPhone) {
      setCustomerPhone(prev => (prev.trim() ? prev : cleanPhone));
    }
    if (cleanId) {
      setCustomerIdNumber(prev => (prev.trim() ? prev : cleanId));
    }
    if (data.notes) {
      setNotes(prev => (prev.trim() ? `${prev} | ${data.notes}` : data.notes));
    }

    setScanNotice(`✓ تم تحديث وتأكيد بيانات الزبونة: ${cleanName || cleanId} بنجاح`);
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
    'تاج عروس ملكي فاخر',
    'حزام مجوهرات مرصع',
    'حقيبة سهرة كلاتش (Clutch)',
    'شال / برنوس مطرز',
    'طاقم إكسسوارات كامل (عقد وأقراط)',
    'طرحة عروس مطرزة'
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
      const defaultSize = (item.sizes && item.sizes.length > 0) ? item.sizes[0] : (item.size || '');
      const defaultColor = (item.colors && item.colors.length > 0) ? item.colors[0] : (item.color || '');
      setItemSize(defaultSize);
      setItemColor(defaultColor);
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
      setScanNotice(`تم اختيار: ${found.name} (${found.size}) بالباركود`);
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
      <div className="bg-blue-900 text-white p-3.5 rounded-3xl shadow-xs space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-blue-200">نوع العملية والتسليم:</span>
          <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-md font-bold">
            {bookingType === 'reserved' ? 'حجز لمناسبة قادمة' : 'تسليم فوري مباشر'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBookingType('active')}
            className={`p-2.5 rounded-2xl text-xs font-bold transition-all flex flex-col items-center gap-1 border ${
              bookingType === 'active'
                ? 'bg-blue-600 border-blue-400 text-white shadow-xs'
                : 'bg-blue-950/60 border-blue-800 text-blue-200 hover:bg-blue-800/50'
            }`}
          >
            <Shirt className="w-5 h-5 text-blue-200" />
            <span>كراء فوري مباشر</span>
            <span className="text-[9px] font-normal opacity-80">تسليم الفستان الآن</span>
          </button>

          <button
            type="button"
            onClick={() => setBookingType('reserved')}
            className={`p-2.5 rounded-2xl text-xs font-bold transition-all flex flex-col items-center gap-1 border ${
              bookingType === 'reserved'
                ? 'bg-blue-600 border-blue-400 text-white shadow-xs'
                : 'bg-blue-950/60 border-blue-800 text-blue-200 hover:bg-blue-800/50'
            }`}
          >
            <Calendar className="w-5 h-5 text-blue-200" />
            <span>مستأجرة مستقبلاً (حجز)</span>
            <span className="text-[9px] font-normal opacity-80">لمناسبة قادمة + عربون</span>
          </button>
        </div>

        {bookingType === 'reserved' ? (
          <div className="bg-blue-950/80 border border-blue-700/60 p-2.5 rounded-xl text-[11px] text-blue-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
            <span>
              <strong>مستأجرة مستقبلاً:</strong> يُسجل الحجز والعربون، ولا يدخل الفستان في الكراء الجاري ولا ينقص من مخزن المحل الفعلي حتى يحين موعد الاستلام وتتم الصفقة وتسليم الفستان للزبونة.
            </span>
          </div>
        ) : (
          <div className="bg-blue-950/80 border border-blue-700/60 p-2.5 rounded-xl text-[11px] text-blue-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
            <span>
              <strong>كراء فوري:</strong> يتم تسليم الفستان الآن ويدخل مباشرة في الكراء الجاري ويتم خصمه من المخزن المتوفر.
            </span>
          </div>
        )}
      </div>

      {/* Dress Selector with Quick Barcode Scan */}
      <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2.5">
        <div className="flex justify-between items-center">
          <label className="block text-xs font-bold text-slate-900">اختر الفستان أو الزي للكراء *</label>
          <span className="text-[10px] text-slate-700 font-bold bg-slate-200/70 px-2 py-0.5 rounded-md flex items-center gap-1">
            <Barcode className="w-3 h-3" />
            <span>مسح باركود سريع</span>
          </span>
        </div>

        {/* Quick Barcode/Search Input + Camera Scanner Button */}
        <div className="flex gap-1.5">
          <NumbersInput
            value={quickBarcodeInput}
            onChange={setQuickBarcodeInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickBarcodeSearch(e);
              }
            }}
            placeholder="امسح بالليزر أو اكتب الباركود (أرقام فقط)..."
            className="flex-1 bg-white border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleQuickBarcodeSearch}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
          >
            تحديد ↵
          </button>
          <button
            type="button"
            onClick={() => setShowBarcodeScanner(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 flex items-center gap-1.5 shadow-xs"
            title="مسح باركود الفستان بالكاميرا"
          >
            <Camera className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">مسح بالكاميرا</span>
          </button>
        </div>

        {/* Scanned notification */}
        {scanNotice && (
          <div className="bg-slate-900 text-white text-xs font-bold p-2 rounded-xl text-center">
            {scanNotice}
          </div>
        )}

        <select
          value={selectedItemId}
          onChange={(e) => handleItemChange(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-slate-400 shadow-xs"
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
          <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-200 text-[11px] font-bold text-slate-700">
            {selectedItem.imageUrl ? (
              <img 
                src={selectedItem.imageUrl} 
                alt={selectedItem.name} 
                className="w-12 h-12 rounded-xl object-contain bg-slate-50 border border-slate-200 shadow-xs shrink-0 p-0.5" 
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-xl shrink-0">
                <Shirt className="w-6 h-6 text-slate-500" />
              </div>
            )}
            <div className="flex-1 flex flex-wrap gap-x-2.5 gap-y-1">
              <span>التصنيف: {selectedItem.category}</span>
              <span>•</span>
              <span>الباركود: {selectedItem.barcode}</span>
              <span>•</span>
              <span className="text-slate-800 font-bold">مخزون 1: {getItemStock1(selectedItem)}</span>
              <span>•</span>
              <span className="text-slate-800 font-bold">مخزون 2: {getItemStock2(selectedItem)}</span>
            </div>
          </div>
        )}

        {/* Stock Source Selection Buttons */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-700">المخزن المراد الكراء منه:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStockSource('stock1')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                stockSource === 'stock1' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                  : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>المخزون 1 ({getItemStock1(selectedItem)})</span>
            </button>
            <button
              type="button"
              onClick={() => setStockSource('stock2')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                stockSource === 'stock2' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                  : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>المخزون 2 ({getItemStock2(selectedItem)})</span>
            </button>
          </div>
        </div>

        {/* Available Sizes & Colors Selection for this specific item */}
        {selectedItem && (
          <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">المقاس المطلوب للكراء (لطاي):</label>
              {selectedItem.sizes && selectedItem.sizes.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedItem.sizes.map(sz => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setItemSize(sz)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all border ${
                        itemSize === sz
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={itemSize}
                  onChange={(e) => setItemSize(e.target.value)}
                  placeholder="المقاس (مثال: 38)"
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اللون المطلوب للكراء:</label>
              {selectedItem.colors && selectedItem.colors.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedItem.colors.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setItemColor(col)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                        itemColor === col
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      <span>{col}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={itemColor}
                  onChange={(e) => setItemColor(e.target.value)}
                  placeholder="اللون (مثال: أسود)"
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                />
              )}
            </div>
          </div>
        )}
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
            className="w-[145px] sm:w-[155px] bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
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
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
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
            className="w-[145px] sm:w-[155px] bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none font-black"
          />
        </div>
      </div>

      {/* Customer Information Section */}
      <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold">
              <User className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold text-slate-900 block">معلومات وهوية الزبونة / الزبون</span>
              <span className="text-[10px] text-slate-500 font-medium">أدخل الاسم والهاتف ورقم بطاقة الهوية يدوياً</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCustomerName('');
                setCustomerPhone('');
                setCustomerIdNumber('');
                setScanNotice('تم مسح وتفريغ بيانات الزبون');
                setTimeout(() => setScanNotice(null), 3000);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
              title="مسح وتفريغ جميع الحقول"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>تفريغ الحقول</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCustomerIdScanner(true)}
              className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 border border-slate-800"
              title="مسح بطاقة التعريف الوطنية بالماسح الضوئي"
            >
              <Camera className="w-3.5 h-3.5 text-slate-300" />
              <span>ماسح الهوية</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700">اسم ولقب الزبونة / الزبون * (حروف فقط)</label>
            </div>
            <div className="relative">
              <LettersInput
                required
                value={customerName}
                onChange={setCustomerName}
                placeholder="الاسم واللقب (أحرف فقط)..."
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-slate-400 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700">رقم الهاتف * (أرقام فقط)</label>
            </div>
            <NumbersInput
              required
              allowPlus
              value={customerPhone}
              onChange={setCustomerPhone}
              placeholder="05 / 06 / 07..."
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-slate-400 focus:outline-none shadow-2xs"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700">رقم بطاقة الهوية / التعريف (أرقام فقط)</label>
              {customerIdNumber && (
                <button
                  type="button"
                  onClick={() => setCustomerIdNumber('')}
                  className="text-[10px] text-slate-600 font-bold hover:underline"
                >
                  مسح الرقم
                </button>
              )}
            </div>
            <div className="relative">
              <NumbersInput
                value={customerIdNumber}
                onChange={setCustomerIdNumber}
                placeholder="18 رقم للتعريف الوطني..."
                maxLength={30}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold font-mono text-slate-900 focus:border-slate-400 focus:outline-none shadow-2xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Accessories & Extras Section (كراء إكسسوار مع الفستان) */}
      <div className={`p-4 rounded-3xl border transition-all ${
        hasAccessories 
          ? 'bg-slate-50 border-slate-300 shadow-xs' 
          : 'bg-slate-50/60 border-slate-200'
      }`}>
        <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold">
              <Crown className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold text-slate-900 block">إضافة إكسسوارات مع الفستان (تاج، حزام، حقيبة، شال...)</span>
              <span className="text-[10px] text-slate-500 font-medium">يمكنك تحديد الإكسسوار وسعره ليُحسب السعر الإجمالي تلقائياً</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const nextVal = !hasAccessories;
              setHasAccessories(nextVal);
              if (nextVal && !accessoryName) {
                setAccessoryName('تاج عروس ملكي فاخر');
                setAccessoryPrice(1500);
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${
              hasAccessories
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
            }`}
          >
            {hasAccessories ? (
              <>
                <Check className="w-3.5 h-3.5 text-blue-400" />
                <span>تم تفعيل الإكسسوار</span>
              </>
            ) : (
              <span>+ إضافة إكسسوار</span>
            )}
          </button>
        </div>

        {hasAccessories && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  اسم / بيان الإكسسوار المرفق * (حروف فقط)
                </label>
                <LettersInput
                  required={hasAccessories}
                  value={accessoryName}
                  onChange={setAccessoryName}
                  placeholder="مثال: تاج ملكي فاخر، حزام مجوهرات..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
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
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            {/* Quick Accessory Suggestions */}
            <div>
              <span className="text-[10px] text-slate-600 font-bold block mb-1">اقتراحات سريعة للإكسسوارات:</span>
              <div className="flex flex-wrap gap-1.5">
                {accessorySuggestions.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleQuickAccessorySelect(tag)}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all"
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
      <div className="p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3">
        {/* Dynamic Formula Header */}
        <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-200">
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-slate-600" />
            <span>الحساب المالي لكراء الفستان</span>
            {hasAccessories && (
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                (فستان + إكسسوار)
              </span>
            )}
          </div>

          <div className="bg-slate-900 text-white px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-2">
            <span className="text-[11px] text-slate-300 font-normal">السعر الكلي الإجمالي:</span>
            <span className="font-mono text-sm">{totalRentPrice.toLocaleString()} دج</span>
          </div>
        </div>

        {/* Detailed inputs: Dress Price, Accessory Price, Total, Paid, Remaining */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Dress Base Price */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              سعر كراء الفستان (دج) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={dressRentPrice}
              onChange={(e) => setDressRentPrice(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400"
            />
          </div>

          {/* 2. Accessory Price (Read or Edit) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              سعر الإكسسوار (دج)
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
              className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${
                hasAccessories
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-slate-400'
                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            />
          </div>

          {/* 3. Paid Amount / Deposit */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] font-bold text-slate-700">
                {bookingType === 'reserved' ? 'العربون / التسبيق (دج) *' : 'المدفوع مسبقاً (دج) *'}
              </label>
              <button
                type="button"
                onClick={() => setPaidAmount(totalRentPrice)}
                className="text-[10px] text-slate-700 font-bold underline hover:text-slate-900"
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
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400"
            />
          </div>

          {/* 4. Remaining Amount (المتبقي) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {bookingType === 'reserved' ? 'المتبقي عند استلام الفستان' : 'المتبقي (دين/كريدي)'}
            </label>
            <div className={`w-full rounded-xl px-3 py-2 text-xs font-bold border flex items-center justify-between ${
              remainingAmount > 0 
                ? 'bg-slate-100 border-slate-200 text-slate-800' 
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <span>{remainingAmount.toLocaleString()} دج</span>
              <span className="text-[10px] font-medium flex items-center gap-1">
                {remainingAmount > 0 ? (
                  <>
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>متبقي</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 text-blue-600" />
                    <span>خالص 0 دج</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown Calculation Banner */}
        {hasAccessories && safeAccPrice > 0 && (
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-600 font-bold">تفاصيل مجموع الكراء:</span>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-800 font-bold">فستان: {safeDressPrice.toLocaleString()} دج</span>
              <span className="text-slate-400 font-bold">+</span>
              <span className="text-slate-800 font-bold">إكسسوار: {safeAccPrice.toLocaleString()} دج</span>
              <span className="text-slate-400 font-bold">=</span>
              <span className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                الإجمالي: {totalRentPrice.toLocaleString()} دج
              </span>
            </div>
          </div>
        )}

        {/* Caution Amount (الضمان المالي) */}
        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="text-xs font-bold text-slate-800 block">الضمان المالي (Caution):</span>
            <span className="text-[10px] text-slate-500 font-medium">مبلغ مسترجع للزبونة عند إعادة الفستان والإكسسوار سليمين.</span>
          </div>
          <div className="w-full sm:w-48">
            <input
              type="number"
              min="0"
              value={cautionAmount}
              onChange={(e) => setCautionAmount(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400"
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
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-400"
        />
      </div>

      <button
        type="submit"
        className="w-full py-3.5 active:scale-[0.98] bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-xs transition-all min-h-[44px] flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4 text-white" />
        <span>
          {rental 
            ? 'حفظ تعديلات العملية' 
            : bookingType === 'reserved'
            ? 'تأكيد وحفظ حجز الفستان مستقبلاً (تسجيل العربون)'
            : 'تأكيد وتسجيل الكراء الفوري (تسليم الفستان)'}
        </span>
      </button>

      {/* Embedded Barcode Scanner Camera Modal for Clothes */}
      {showBarcodeScanner && (
        <React.Suspense fallback={null}>
          <BarcodeScanner
            title="مسح باركود فستان الكراء"
            onScan={(code) => handleBarcodeScanned(code)}
            onClose={() => setShowBarcodeScanner(false)}
          />
        </React.Suspense>
      )}

      {/* Smart Customer ID & Barcode Scanner Modal */}
      {showCustomerIdScanner && (
        <React.Suspense fallback={null}>
          <CustomerIdScannerModal
            title="مسح بطاقة تعريف أو باركود الزبونة"
            onExtract={handleCustomerExtracted}
            onClose={() => setShowCustomerIdScanner(false)}
          />
        </React.Suspense>
      )}
    </form>
  );
};

