import React, { useState, useEffect, useMemo } from 'react';
import { Rental, ClothItem } from '../types';
import { 
  Shirt, 
  Crown, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  MessageSquare, 
  Edit3, 
  Trash2, 
  X, 
  Info,
  Check
} from 'lucide-react';

interface RentalsViewProps {
  rentals: Rental[];
  clothes: ClothItem[];
  onAddRental: (preselectedItemId?: string) => void;
  onEditRental: (rental: Rental) => void;
  onDeleteRental: (id: string) => void;
  onActivateRental?: (rental: Rental, collectedAmount?: number, notes?: string) => void;
  onOpenReturnModal: (rental: Rental) => void;
  onOpenReceiptModal: (rental: Rental) => void;
  onSendMessage: (rental: Rental) => void;
  onScanBarcode?: () => void;
}

export const RentalsView: React.FC<RentalsViewProps> = React.memo(({
  rentals,
  clothes,
  onAddRental,
  onEditRental,
  onDeleteRental,
  onActivateRental,
  onOpenReturnModal,
  onOpenReceiptModal,
  onSendMessage,
  onScanBarcode
}) => {
  const [filter, setFilter] = useState<'all' | 'reserved' | 'active' | 'overdue' | 'returned'>('all');
  const [search, setSearch] = useState('');
  const [handoverModalRental, setHandoverModalRental] = useState<Rental | null>(null);
  const [handoverCollectedAmount, setHandoverCollectedAmount] = useState<number>(0);
  const [handoverNotes, setHandoverNotes] = useState<string>('');

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const getDaysDiffFromToday = (dateStr: string) => {
    const d1 = new Date(dateStr);
    const d2 = new Date(today);
    const diffTime = d1.getTime() - d2.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const openHandoverModal = (rental: Rental) => {
    setHandoverModalRental(rental);
    setHandoverCollectedAmount(rental.remainingAmount || 0);
    setHandoverNotes('');
  };

  const confirmHandover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverModalRental) return;
    if (onActivateRental) {
      onActivateRental(handoverModalRental, Number(handoverCollectedAmount) || 0, handoverNotes.trim());
    }
    setHandoverModalRental(null);
  };

  // Handheld laser barcode reader listener on Rentals View
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
          const cleanCode = buffer.trim().toLowerCase();
          const found = clothes.find(
            c => (c.purpose === 'rent' || c.purpose === 'both') && c.barcode.trim().toLowerCase() === cleanCode
          );
          if (found) {
            onAddRental(found.id);
          }
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clothes, onAddRental]);

  // Status classification with memoization
  const { reservedRentals, activeRentalsList, overdueRentalsList, returnedRentalsList, filteredRentals } = useMemo(() => {
    const todayDate = new Date(today);
    const reserved = rentals.filter(r => r.status === 'reserved');
    const activeList = rentals.filter(r => r.status === 'active' && new Date(r.expectedReturnDate) >= todayDate);
    const overdueList = rentals.filter(r => r.status === 'active' && new Date(r.expectedReturnDate) < todayDate);
    const returnedList = rentals.filter(r => r.status === 'returned');

    const filtered = rentals.filter(r => {
      const isReserved = r.status === 'reserved';
      const isReturned = r.status === 'returned';
      const isOverdue = r.status === 'active' && new Date(r.expectedReturnDate) < todayDate;
      const isActive = r.status === 'active' && !isOverdue;

      if (filter === 'reserved' && !isReserved) return false;
      if (filter === 'active' && !isActive) return false;
      if (filter === 'overdue' && !isOverdue) return false;
      if (filter === 'returned' && !isReturned) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.customerName.toLowerCase().includes(q) ||
          r.customerPhone.includes(q) ||
          r.itemName.toLowerCase().includes(q) ||
          (r.customerIdNumber && r.customerIdNumber.includes(q))
        );
      }
      return true;
    });

    return {
      reservedRentals: reserved,
      activeRentalsList: activeList,
      overdueRentalsList: overdueList,
      returnedRentalsList: returnedList,
      filteredRentals: filtered
    };
  }, [rentals, filter, search, today]);

  return (
    <div className="space-y-5 p-3 sm:p-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-blue-600 flex items-center gap-2">
            <span>سجل كراء وحجز الفساتين</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-lg font-bold border border-blue-100">
                {activeRentalsList.length + overdueRentalsList.length} كراء جاري
              </span>
              {reservedRentals.length > 0 && (
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg font-bold border border-slate-200">
                  {reservedRentals.length} حجز مستقبلي
                </span>
              )}
            </div>
          </h2>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            إدارة الكراء الفوري، الفساتين المستأجرة مستقبلاً (الحجوزات)، ومتابعة التسليم وتصفية الحسابات.
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {onScanBarcode && (
            <button
              onClick={onScanBarcode}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border border-slate-200/70"
              title="مسح باركود الفستان لبدء كراء جديد"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" />
              </svg>
              <span>كراء بالباركود</span>
            </button>
          )}

          <button
            onClick={() => onAddRental()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            + تسجيل كراء / حجز
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 justify-between items-center">
        {/* Tabs */}
        <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border border-transparent ${
              filter === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
            }`}
          >
            الكل ({rentals.length})
          </button>

          <button
            onClick={() => setFilter('reserved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border border-transparent ${
              filter === 'reserved' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
            }`}
          >
            <span>مستأجرة مستقبلاً</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filter === 'reserved' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {reservedRentals.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border border-transparent ${
              filter === 'active' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
            }`}
          >
            <span>جارية عند الزبون</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filter === 'active' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
            }`}>
              {activeRentalsList.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('overdue')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border border-transparent ${
              filter === 'overdue' 
                ? 'bg-black text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-black hover:text-white'
            }`}
          >
            <span>متأخرة عن الإرجاع</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filter === 'overdue' ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'
            }`}>
              {overdueRentalsList.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('returned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border border-transparent ${
              filter === 'returned' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
            }`}
          >
            <span>مسترجعة</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filter === 'returned' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {returnedRentalsList.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الزبون، الهاتف، الفستان..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 hover:border-blue-300 transition-colors"
          />
          <svg className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Notice info banner for future bookings */}
      {filter === 'reserved' && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 flex items-center gap-3">
          <Info className="w-5 h-5 text-slate-600 shrink-0" />
          <div>
            <strong className="block font-black">الفساتين المستأجرة مستقبلاً (حجوزات المواعيد القادمة):</strong>
            <span>
              هذه القطع محجوزة بعربون لتواريخ قادمة، ولا تُحسب ضمن الكراء الجاري ولا تنقص من المخزن الفعلي. عند حضور الزبون واستلام الفستان، اضغط <strong>«تسليم الفستان وبدء الكراء»</strong> لإتمام الصفقة وإدخالها في الكراء.
            </span>
          </div>
        </div>
      )}

      {/* Rentals List */}
      {filteredRentals.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
          <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shirt className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-black text-slate-800 text-sm mb-1">لا توجد عمليات في هذا القسم</h3>
          <p className="text-xs text-slate-400">يمكنك تسجيل عملية كراء أو حجز مستقبلي بالباركود مباشرة.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRentals.map(rental => {
            const isReserved = rental.status === 'reserved';
            const isReturned = rental.status === 'returned';
            const isOverdue = rental.status === 'active' && new Date(rental.expectedReturnDate) < new Date(today);
            const daysUntilStart = getDaysDiffFromToday(rental.startDate);
            const daysDiffFromReturn = getDaysDiffFromToday(rental.expectedReturnDate);
            const matchedCloth = clothes.find(c => c.id === rental.itemId);

            return (
              <div
                key={rental.id}
                className={`bg-white rounded-3xl border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-400 group hover:-translate-y-0.5 ${
                  isReturned
                    ? 'border-slate-200 bg-slate-50/20'
                    : isReserved
                    ? 'border-slate-300 bg-slate-50/40'
                    : isOverdue
                    ? 'border-black bg-slate-50'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Card Header Status */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      {matchedCloth?.imageUrl ? (
                        <img 
                          src={matchedCloth.imageUrl} 
                          alt={rental.itemName} 
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0 group-hover:border-blue-200 transition-colors" 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 font-bold bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-600 transition-colors">
                          <Shirt className="w-6 h-6 text-slate-500 group-hover:text-blue-600 transition-colors" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-black text-slate-900 group-hover:text-blue-950 text-sm sm:text-base leading-tight transition-colors">
                            {rental.itemName}
                          </h3>
                          {rental.hasAccessories && (
                            <span className="bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
                              <Crown className="w-3 h-3 text-slate-700" />
                              <span>+{rental.accessoryName || 'إكسسوار'}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 block mt-0.5">
                          الزبون: <strong className="text-slate-800">{rental.customerName}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Badge */}
                    {isReturned ? (
                      <span className="bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-black px-2.5 py-1 rounded-xl shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-slate-700" />
                        <span>تم الإرجاع</span>
                      </span>
                    ) : isReserved ? (
                      <span className="bg-slate-900 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shrink-0 shadow-xs flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>مستأجرة مستقبلاً</span>
                      </span>
                    ) : isOverdue ? (
                      <span className="bg-black text-white border border-black text-[10px] font-black px-2.5 py-1 rounded-xl shrink-0 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-white" />
                        <span>متأخر {Math.abs(daysDiffFromReturn)} يوم</span>
                      </span>
                    ) : (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black px-2.5 py-1 rounded-xl shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-600" />
                        <span>جاري عند الزبون</span>
                      </span>
                    )}
                  </div>

                  {/* Future Booking Notice Tag */}
                  {isReserved && (
                    <div className="mb-2.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center justify-between text-[11px] font-bold text-slate-800">
                      <span>حالة القطعة: متوفرة بالمخزن حتى موعد الصفقة</span>
                      <span className="bg-slate-800 text-white px-2 py-0.5 rounded-lg text-[10px]">
                        {daysUntilStart > 0 
                          ? `باقي ${daysUntilStart} أيام على الاستلام` 
                          : daysUntilStart === 0 
                          ? 'موعد الاستلام اليوم' 
                          : 'حان موعد الاستلام'}
                      </span>
                    </div>
                  )}

                  {/* Rental Dates & Info */}
                  <div className="bg-slate-50 group-hover:bg-blue-50/30 p-3 rounded-2xl border border-slate-100 group-hover:border-blue-100 space-y-1.5 text-xs text-slate-600 mb-3 transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-500">الهاتف:</span>
                      <a href={`tel:${rental.customerPhone}`} className="font-bold text-slate-900 font-mono hover:text-blue-600 transition-colors">
                        {rental.customerPhone}
                      </a>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-500">
                        {isReserved ? 'موعد استلام الحجز:' : 'تاريخ الاستلام:'}
                      </span>
                      <span className="font-bold font-mono text-slate-800">{rental.startDate}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-500">موعد الإرجاع:</span>
                      <span className={`font-bold font-mono ${isOverdue ? 'text-black font-black underline' : 'text-slate-800'}`}>
                        {rental.expectedReturnDate}
                      </span>
                    </div>

                    {rental.cautionAmount > 0 && (
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                        <span className="text-[11px] font-bold text-slate-700">الضمان (Caution):</span>
                        <span className="font-black text-slate-900 font-mono">{rental.cautionAmount.toLocaleString()} دج</span>
                      </div>
                    )}
                  </div>

                  {/* Financial Summary Pill */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs mb-3 bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-600 font-bold block">إجمالي الكراء</span>
                      <span className="font-black text-slate-900 text-sm font-mono">{rental.rentPrice.toLocaleString()} دج</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-blue-700 font-bold block">
                        {isReserved ? 'العربون المدفوع' : 'المدفوع'}
                      </span>
                      <span className="font-black text-blue-700 font-mono">{rental.paidAmount.toLocaleString()} دج</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-black font-bold block">
                        {isReserved ? 'المتبقي عند الاستلام' : 'المتبقي'}
                      </span>
                      <span className="font-black text-black font-mono">{(rental.remainingAmount || 0).toLocaleString()} دج</span>
                    </div>
                  </div>
                </div>

                {/* Actions Grid */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {/* If reserved: Big Handover Button to finalize deal */}
                  {isReserved && (
                    <button
                      onClick={() => openHandoverModal(rental)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 hover:shadow-md hover:shadow-blue-500/20"
                    >
                      <Check className="w-4 h-4" />
                      <span>تسليم الفستان وبدء الكراء (إتمام الصفقة)</span>
                    </button>
                  )}

                  {/* If active / overdue: Return button */}
                  {!isReserved && !isReturned && (
                    <button
                      onClick={() => onOpenReturnModal(rental)}
                      className="w-full py-2.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 hover:shadow-md hover:shadow-blue-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>استرجاع الفستان وتسوية الحساب</span>
                    </button>
                  )}

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onOpenReceiptModal(rental)}
                      className="flex-1 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-transparent text-slate-700 rounded-xl text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1.5"
                      title="طباعة وصل وعقد الكراء / الحجز"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{isReserved ? 'وصل الحجز' : 'وصل الكراء'}</span>
                    </button>

                    <button
                      onClick={() => onSendMessage(rental)}
                      className="flex-1 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-transparent text-slate-700 rounded-xl text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1.5"
                      title="مراسلة الزبون عبر واتساب أو SMS"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{isReserved ? 'تذكير بالموعد' : 'تذكير'}</span>
                    </button>

                    <button
                      onClick={() => onEditRental(rental)}
                      className="p-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-transparent text-slate-600 rounded-xl text-xs font-bold transition-all"
                      title="تعديل بيانات العملية"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteRental(rental.id)}
                      className="p-2 bg-slate-100 hover:bg-black hover:text-white rounded-xl text-xs font-bold transition-all"
                      title="حذف العملية"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Handover / Finalize Deal Modal */}
      {handoverModalRental && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-slate-700" />
                  <span>إتمام الصفقة وتسليم الفستان</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تأكيد تسليم الفستان للزبون وبدء فترة الكراء الفعلية وخصمه من المخزن.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHandoverModalRental(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">الفستان:</span>
                <span className="font-black text-slate-900">{handoverModalRental.itemName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">الزبون:</span>
                <span className="font-bold text-slate-800">{handoverModalRental.customerName} ({handoverModalRental.customerPhone})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">تاريخ الإرجاع المتوقع:</span>
                <span className="font-black font-mono text-slate-900">{handoverModalRental.expectedReturnDate}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-600 font-bold">العربون المدفوع سابقاً:</span>
                <span className="font-black text-slate-900">{handoverModalRental.paidAmount.toLocaleString()} دج</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-bold">المتبقي على الزبون:</span>
                <span className="font-black text-slate-900">{handoverModalRental.remainingAmount.toLocaleString()} دج</span>
              </div>
            </div>

            <form onSubmit={confirmHandover} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ المحصل الآن عند التسليم (دج)
                </label>
                <input
                  type="number"
                  min="0"
                  max={handoverModalRental.remainingAmount}
                  value={handoverCollectedAmount}
                  onChange={(e) => setHandoverCollectedAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:outline-none focus:border-slate-400"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  إذا لم يتم دفع كامل المتبقي، سيُسجل الباقي كدين متبقي في السجل تلقائياً.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات التسليم (اختياري)
                </label>
                <input
                  type="text"
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="مثال: تم تسليم الفستان مع الحقيبة والإكسسوار..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>تأكيد التسليم وتفعيل الكراء (إتمام الصفقة)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHandoverModalRental(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
