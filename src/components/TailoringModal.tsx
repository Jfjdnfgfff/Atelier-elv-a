import React, { useState } from 'react';
import { MaintenanceOrder, MaintenanceServiceType, MaintenanceTargetType, MaintenanceStatus, ClothItem, StaffMember } from '../types';
import { Modal, LettersInput, NumbersInput } from './Shared';
const CustomerIdScannerModal = React.lazy(() => import('./CustomerIdScannerModal').then(m => ({ default: m.CustomerIdScannerModal })));
import type { ExtractedCustomerData } from './CustomerIdScannerModal';
import { User, Tag, CreditCard } from 'lucide-react';
import { sanitizeName, sanitizePhone, sanitizeText } from '../utils/security';

interface TailoringModalProps {
  order?: MaintenanceOrder | null;
  clothes: ClothItem[];
  staffMembers: StaffMember[];
  onSave: (orderData: Partial<MaintenanceOrder>) => void;
  onClose: () => void;
}

export const TailoringModal: React.FC<TailoringModalProps> = ({
  order,
  clothes,
  staffMembers,
  onSave,
  onClose
}) => {
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

  const [targetType, setTargetType] = useState<MaintenanceTargetType>(order?.targetType || 'customer_order');
  const [selectedItemId, setSelectedItemId] = useState<string>(order?.itemId || (clothes[0]?.id || ''));
  const [itemName, setItemName] = useState(order?.itemName || '');
  const [customerName, setCustomerName] = useState(order?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(order?.customerPhone || '');
  const [showCustomerIdScanner, setShowCustomerIdScanner] = useState(false);
  const [serviceType, setServiceType] = useState<MaintenanceServiceType>(order?.serviceType || 'alteration');
  const [description, setDescription] = useState(order?.description || '');
  const [measurements, setMeasurements] = useState(order?.measurements || '');
  const [tailorName, setTailorName] = useState(order?.tailorName || (staffMembers.find(s => s.role.includes('خياط'))?.name || staffMembers[0]?.name || ''));
  
  const [cost, setCost] = useState<number>(order?.cost !== undefined ? order.cost : 500);
  const [price, setPrice] = useState<number>(order?.price !== undefined ? order.price : 1500);
  const [paidAmount, setPaidAmount] = useState<number>(order?.paidAmount !== undefined ? order.paidAmount : 1500);
  
  const [receivedDate, setReceivedDate] = useState(order?.receivedDate || today);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    order?.expectedDeliveryDate || addDays(today, 2)
  );
  
  const initialDuration = Math.max(1, getDaysDiff(order?.expectedDeliveryDate || addDays(today, 2), order?.receivedDate || today));
  const [durationDays, setDurationDays] = useState<number>(initialDuration);

  const [status, setStatus] = useState<MaintenanceStatus>(order?.status || 'pending');
  const [notes, setNotes] = useState(order?.notes || '');

  const handleCustomerExtracted = (data: ExtractedCustomerData) => {
    if (data.name) setCustomerName(data.name);
    if (data.phone) setCustomerPhone(data.phone);
    if (data.notes && !notes) setNotes(data.notes);
  };


  // Calculate remaining amount
  const effectivePrice = targetType === 'internal_stock' ? 0 : price;
  const effectivePaid = targetType === 'internal_stock' ? 0 : Math.min(paidAmount, effectivePrice);
  const remainingAmount = Math.max(0, effectivePrice - effectivePaid);

  const handleDurationChange = (days: number) => {
    const safeDays = Math.max(1, Number(days) || 1);
    setDurationDays(safeDays);
    setExpectedDeliveryDate(addDays(receivedDate, safeDays));
  };

  const handleReceivedDateChange = (newDate: string) => {
    setReceivedDate(newDate);
    setExpectedDeliveryDate(addDays(newDate, durationDays));
  };

  const handleDeliveryDateChange = (newDate: string) => {
    setExpectedDeliveryDate(newDate);
    const diff = Math.max(1, getDaysDiff(newDate, receivedDate));
    setDurationDays(diff);
  };

  const handleInternalClothSelect = (id: string) => {
    setSelectedItemId(id);
    const item = clothes.find(c => c.id === id);
    if (item) {
      setItemName(item.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedCloth = clothes.find(c => c.id === selectedItemId);
    const finalItemName = targetType === 'internal_stock' 
      ? (itemName || selectedCloth?.name || 'فستان من المحل')
      : itemName;

    onSave({
      targetType,
      itemId: targetType === 'internal_stock' ? selectedItemId : undefined,
      itemName: finalItemName,
      customerName: targetType === 'customer_order' ? customerName : undefined,
      customerPhone: targetType === 'customer_order' ? customerPhone : undefined,
      serviceType,
      description,
      measurements,
      tailorName,
      cost: Number(cost) || 0,
      price: targetType === 'internal_stock' ? 0 : (Number(price) || 0),
      paidAmount: targetType === 'internal_stock' ? 0 : (Number(paidAmount) || 0),
      remainingAmount,
      receivedDate,
      expectedDeliveryDate,
      status,
      notes
    });
  };

  return (
    <Modal title={order ? 'تعديل طلب خياطة وصيانة' : 'تسجيل طلب خياطة وصيانة جديد'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
        {/* Target Type Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع الطلب والجهة *</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setTargetType('customer_order');
                if (!itemName) setItemName('');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                targetType === 'customer_order'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>طلب زبونة خارجية (خدمة مدفوعة)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTargetType('internal_stock');
                const first = clothes[0];
                if (first) {
                  setSelectedItemId(first.id);
                  setItemName(first.name);
                }
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                targetType === 'internal_stock'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>صيانة قطعة من المخزن الداخلي</span>
            </button>
          </div>
        </div>

        {/* Item Selection / Input */}
        {targetType === 'internal_stock' ? (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اختر القطعة من المخزن *</label>
            <select
              value={selectedItemId}
              onChange={(e) => handleInternalClothSelect(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
            >
              {clothes.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} | باركود: {item.barcode} ({item.category})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم القطعة أو الفستان *</label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="مثال: فستان سهرة مخمل أزرق ملكي"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
            />
          </div>
        )}

        {/* Customer Details (If customer order) */}
        {targetType === 'customer_order' && (
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700">بيانات وهوية الزبونة</label>
              <button
                type="button"
                onClick={() => setShowCustomerIdScanner(true)}
                className="bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 active:scale-95 px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>مسح بطاقة الهوية / الباركود (AI OCR)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الزبونة * (حروف فقط)</label>
                <LettersInput
                  required
                  value={customerName}
                  onChange={setCustomerName}
                  placeholder="اسم الزبونة (أحرف فقط)..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-blue-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (لإشعارها بالواتساب) * (أرقام فقط)</label>
                <NumbersInput
                  required
                  allowPlus
                  value={customerPhone}
                  onChange={setCustomerPhone}
                  placeholder="05XXXXXXXX / 06XXXXXXXX"
                  dir="ltr"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-blue-900 focus:outline-none text-right"
                />
              </div>
            </div>
          </div>
        )}

        {/* Service Type & Tailor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">نوع الصيانة / الخدمة *</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as MaintenanceServiceType)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
            >
              <option value="alteration">تعديل مقاس (تضييق / توسيع / تقصير)</option>
              <option value="repair">تصليح وترقيع (سحاب / أزرار / تمزق)</option>
              <option value="custom_sewing">خياطة وتفصيل جديد</option>
              <option value="ironing_prep">غسيل وكي وتجهيز فاخر</option>
              <option value="other">صيانة وأعمال أخرى</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الخياطة / الورشة المسؤولة (حروف فقط)</label>
            <div className="flex gap-1.5">
              <LettersInput
                list="staff-list"
                value={tailorName}
                onChange={setTailorName}
                placeholder="اسم الخياطة (أحرف فقط)..."
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
              />
              <datalist id="staff-list">
                {staffMembers.map(s => (
                  <option key={s.id} value={s.name}>{s.role}</option>
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* Description & Measurements */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">تفاصيل وملاحظات الخياطة *</label>
          <textarea
            required
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: تضييق من الخصر بمقدار 2 سم وتقصير 3 سم مع تثبيت حزام الساتان..."
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">المقاسات الدقيقة (اختياري)</label>
          <input
            type="text"
            value={measurements}
            onChange={(e) => setMeasurements(e.target.value)}
            placeholder="مثال: الصدر: 90 سم | الخصر: 72 سم | الأكتاف: 38 سم | الطول: 140 سم"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
          />
        </div>

        {/* Dates Controls - Standard Input Style */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الاستلام *</label>
            <input
              type="date"
              required
              value={receivedDate}
              onChange={(e) => handleReceivedDateChange(e.target.value)}
              className="w-[145px] sm:w-[155px] bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">المدة (عدد الأيام) *</label>
            <input
              type="number"
              min="1"
              max="180"
              required
              value={durationDays}
              onChange={(e) => handleDurationChange(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ التسليم المتوقع *</label>
            <input
              type="date"
              required
              value={expectedDeliveryDate}
              onChange={(e) => handleDeliveryDateChange(e.target.value)}
              className="w-[145px] sm:w-[155px] bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
            />
          </div>
        </div>

        {/* Financial Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">أتعاب الخياطة / التكلفة (دج)</label>
            <input
              type="number"
              min="0"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              placeholder="500"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
            />
          </div>

          {targetType === 'customer_order' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السعر للزبونة (دج) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => {
                    const p = Number(e.target.value) || 0;
                    setPrice(p);
                    if (paidAmount > p) setPaidAmount(p);
                  }}
                  placeholder="1500"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المدفوع (عربون)</label>
                <input
                  type="number"
                  min="0"
                  max={price}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  placeholder="1000"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Status (when editing) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">حالة الطلب *</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:border-slate-800 focus:outline-none"
          >
            <option value="pending">قيد الانتظار (في الورشة)</option>
            <option value="in_progress">جاري العمل (تحت الإبرة)</option>
            <option value="ready">جاهزة للتسليم / تم الإصلاح</option>
            <option value="delivered">تم التسليم بنجاح</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3">
          <button
            type="submit"
            className="flex-1 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-xs min-h-[44px]"
          >
            {order ? 'حفظ التعديلات' : 'حفظ وتسجيل الطلب'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all min-h-[44px]"
          >
            إلغاء
          </button>
        </div>
      </form>

      {/* Smart Customer ID Scanner */}
      {showCustomerIdScanner && (
        <React.Suspense fallback={null}>
          <CustomerIdScannerModal
            title="مسح بطاقة تعريف أو باركود الزبونة"
            onExtract={handleCustomerExtracted}
            onClose={() => setShowCustomerIdScanner(false)}
          />
        </React.Suspense>
      )}
    </Modal>
  );
};

