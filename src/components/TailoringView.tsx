import React, { useState, useMemo } from 'react';
import { MaintenanceOrder, MaintenanceStatus, MaintenanceTargetType, ClothItem } from '../types';
import { Plus, AlertTriangle, AlertCircle, MessageSquare, Mail, Phone, Trash2, FileText, Edit3, Calendar, DollarSign, Sparkles, Scissors, Clock, TrendingUp } from 'lucide-react';

interface TailoringViewProps {
  orders: MaintenanceOrder[];
  clothes: ClothItem[];
  onOpenAddModal: () => void;
  onEditOrder: (order: MaintenanceOrder) => void;
  onDeleteOrder: (id: string) => void;
  onUpdateStatus: (id: string, newStatus: MaintenanceStatus) => void;
  onOpenReceiptModal: (order: MaintenanceOrder) => void;
}

export const TailoringView: React.FC<TailoringViewProps> = React.memo(({
  orders,
  clothes,
  onOpenAddModal,
  onEditOrder,
  onDeleteOrder,
  onUpdateStatus,
  onOpenReceiptModal
}) => {
  const [filter, setFilter] = useState<'all' | 'due_soon' | 'pending' | 'in_progress' | 'ready' | 'delivered'>('all');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'ironing_prep' | 'alteration' | 'repair' | 'custom_sewing'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'this_week' | 'overdue' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [search, setSearch] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const getDaysDiffFromToday = (targetDate: string) => {
    const d1 = new Date(today);
    const d2 = new Date(targetDate);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filtered list with Status, Service Type, and Date Controls
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const daysLeft = getDaysDiffFromToday(order.expectedDeliveryDate);
      const isDueSoon = order.status !== 'delivered' && daysLeft >= 0 && daysLeft <= 10;

      // Status filter
      if (filter === 'due_soon' && !isDueSoon) return false;
      if (filter === 'pending' && order.status !== 'pending') return false;
      if (filter === 'in_progress' && order.status !== 'in_progress') return false;
      if (filter === 'ready' && order.status !== 'ready') return false;
      if (filter === 'delivered' && order.status !== 'delivered') return false;

      // Service type filter (الكواء، الخياطة، التعديل...)
      if (serviceFilter !== 'all' && order.serviceType !== serviceFilter) return false;

      // Date Control filter (التحكم في التاريخ)
      if (dateFilter === 'today' && order.expectedDeliveryDate !== today) return false;
      if (dateFilter === 'tomorrow') {
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomStr = tomorrowDate.toISOString().split('T')[0];
        if (order.expectedDeliveryDate !== tomStr) return false;
      }
      if (dateFilter === 'this_week') {
        if (daysLeft < 0 || daysLeft > 7) return false;
      }
      if (dateFilter === 'overdue') {
        if (order.status === 'delivered' || daysLeft >= 0) return false;
      }
      if (dateFilter === 'custom' && customDate) {
        if (order.expectedDeliveryDate !== customDate && order.receivedDate !== customDate) return false;
      }

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = order.itemName.toLowerCase().includes(query);
        const matchCustomer = (order.customerName || '').toLowerCase().includes(query);
        const matchPhone = (order.customerPhone || '').includes(query);
        const matchTailor = (order.tailorName || '').toLowerCase().includes(query);
        const matchOrderNo = order.orderNumber.toLowerCase().includes(query);
        return matchName || matchCustomer || matchPhone || matchTailor || matchOrderNo;
      }

      return true;
    });
  }, [orders, filter, serviceFilter, dateFilter, customDate, search, today]);

  // Quick statistics with complete financial tracking (تكاليف، مداخيل، أرباح)
  const stats = useMemo(() => {
    const active = orders.filter(o => o.status !== 'delivered');
    const dueSoonCount = orders.filter(o => {
      const days = getDaysDiffFromToday(o.expectedDeliveryDate);
      return o.status !== 'delivered' && days >= 0 && days <= 10;
    }).length;
    const readyCount = orders.filter(o => o.status === 'ready').length;
    const ironingCount = orders.filter(o => o.serviceType === 'ironing_prep' && o.status !== 'delivered').length;
    
    // Financials
    const totalRevenue = orders.reduce((s, o) => s + (o.price || 0), 0);
    const totalCost = orders.reduce((s, o) => s + (o.cost || 0), 0);
    const netProfit = totalRevenue - totalCost;
    const totalRemaining = orders.reduce((s, o) => s + (o.remainingAmount || 0), 0);

    return {
      activeCount: active.length,
      dueSoonCount,
      readyCount,
      ironingCount,
      totalRevenue,
      totalCost,
      netProfit,
      totalRemaining
    };
  }, [orders, today]);

  const getServiceLabel = (type: string) => {
    switch (type) {
      case 'ironing_prep': return 'كواء وغسيل وكي';
      case 'alteration': return 'تعديل مقاس';
      case 'repair': return 'تصليح وترقيع';
      case 'custom_sewing': return 'تفصيل جديد';
      default: return 'صيانة عامة';
    }
  };

  const getStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case 'pending':
        return <span className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-200/60">في الانتظار</span>;
      case 'in_progress':
        return <span className="bg-slate-100 text-slate-800 text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-200">قيد الإنجاز</span>;
      case 'ready':
        return <span className="bg-emerald-50 text-emerald-700 text-[11px] font-medium px-2 py-0.5 rounded-md border border-emerald-200/60">جاهزة للتسليم</span>;
      case 'delivered':
        return <span className="bg-slate-50 text-slate-500 text-[11px] font-normal px-2 py-0.5 rounded-md border border-slate-200/40">تم التسليم</span>;
    }
  };

  const handleSendMessage = (order: MaintenanceOrder, method: 'whatsapp' | 'sms') => {
    if (!order.customerPhone) return;
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.startsWith('0') ? '213' + cleanPhone.substring(1) : cleanPhone;
    
    let msg = `السلام عليكم ${order.customerName || 'سيدتي'}،\n`;
    if (order.status === 'ready') {
      msg += `نحيطكِ علماً بأن طلب الخياطة والتعديل (${order.itemName}) أصبح جاهزاً للاستلام في البوتيك.\n`;
    } else {
      msg += `نحيطكِ علماً بأن طلب الخياطة (${order.itemName}) موعد تسليمه المتوقع هو: ${order.expectedDeliveryDate}.\n`;
    }
    if (order.remainingAmount > 0) {
      msg += `المبلغ المتبقي عند الاستلام: ${order.remainingAmount.toLocaleString()} دج.\n`;
    }
    msg += `شكراً لتعاملكِ مع البوتيك!`;

    const encoded = encodeURIComponent(msg);
    if (method === 'whatsapp') {
      window.open(`https://wa.me/${waPhone}?text=${encoded}`, '_blank');
    } else {
      window.open(`sms:${order.customerPhone}?body=${encoded}`, '_blank');
    }
  };

  return (
    <div className="space-y-4 pb-8" dir="rtl">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              قسم الخياطة والصيانة
            </h1>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              متابعة طلبات الخياطة وتواريخ التسليم والمقاسات
            </p>
          </div>

          <button
            onClick={onOpenAddModal}
            className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all min-h-[40px] shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>طلب خياطة جديد</span>
          </button>
        </div>

        {/* Financial & Operational Stats Bar (تتبع المداخيل والتكاليف والأرباح والكواء) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
            <span className="text-slate-500 block font-normal">طلبات بالورشة</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-bold font-mono text-slate-900">{stats.activeCount}</span>
              {stats.ironingCount > 0 && (
                <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded font-bold border border-sky-200">
                  {stats.ironingCount} كواء
                </span>
              )}
            </div>
          </div>

          <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
            <span className="text-indigo-700 block font-normal text-[11px] flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
              <span>إجمالي المداخيل</span>
            </span>
            <span className="text-base font-bold font-mono text-indigo-950 mt-0.5 block">
              {stats.totalRevenue.toLocaleString()} دج
            </span>
          </div>

          <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/70">
            <span className="text-amber-800 block font-normal text-[11px] flex items-center gap-1">
              <Scissors className="w-3.5 h-3.5 text-amber-600" />
              <span>إجمالي قيمة التكليف</span>
            </span>
            <span className="text-base font-bold font-mono text-amber-950 mt-0.5 block">
              {stats.totalCost.toLocaleString()} دج
            </span>
          </div>

          <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/70">
            <span className="text-emerald-800 block font-normal text-[11px] flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>صافي أرباح الخياطة</span>
            </span>
            <span className={`text-base font-bold font-mono mt-0.5 block ${stats.netProfit >= 0 ? 'text-emerald-950' : 'text-rose-700'}`}>
              {stats.netProfit.toLocaleString()} دج
            </span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 col-span-2 sm:col-span-1">
            <span className="text-slate-500 block font-normal">المتبقي للتحصيل (ديون)</span>
            <span className="text-base font-bold font-mono text-rose-700 mt-0.5 block">
              {stats.totalRemaining.toLocaleString()} دج
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar with Comprehensive Date Controls (التحكم في التاريخ والكواء) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، رقم الطلب، هاتف الزبونة، الخياطة..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none"
          />
        </div>

        {/* 1. Date Controls Filter (التحكم في التاريخ ومواعيد التسليم) */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5 text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-slate-600" />
              <span>التحكم في التاريخ ومواعيد التسليم:</span>
            </span>
            {dateFilter === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-[11px] font-mono font-bold text-slate-800"
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar text-xs">
            {[
              { id: 'all', label: 'كل التواريخ' },
              { id: 'today', label: 'تسليم اليوم 📅' },
              { id: 'tomorrow', label: 'تسليم غداً' },
              { id: 'this_week', label: 'خلال 7 أيام' },
              { id: 'overdue', label: 'متأخرة عن الموعد ⚠️' },
              { id: 'custom', label: 'تاريخ محدد 🗓️' }
            ].map(df => (
              <button
                key={df.id}
                type="button"
                onClick={() => setDateFilter(df.id as any)}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap font-medium text-[11px] transition-all shrink-0 border ${
                  dateFilter === df.id
                    ? 'bg-slate-900 text-white font-bold border-slate-900 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Service Type Filter (الكواء، التعديل، التصليح، التفصيل) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar text-xs">
          <span className="text-[11px] text-slate-500 font-medium shrink-0 ml-1">نوع الخدمة:</span>
          {[
            { id: 'all', label: 'كل الخدمات' },
            { id: 'ironing_prep', label: '👔 الكواء والغسيل والكي (Pressing)' },
            { id: 'alteration', label: '✂️ تعديل مقاس' },
            { id: 'custom_sewing', label: '🪡 تفصيل وخياطة جديدة' },
            { id: 'repair', label: '🧵 تصليح وترقيع' }
          ].map(sf => (
            <button
              key={sf.id}
              type="button"
              onClick={() => setServiceFilter(sf.id as any)}
              className={`px-3 py-1 rounded-xl whitespace-nowrap font-medium text-[11px] transition-all shrink-0 border ${
                serviceFilter === sf.id
                  ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>

        {/* 3. Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar text-xs pt-1 border-t border-slate-100">
          <span className="text-[11px] text-slate-500 font-medium shrink-0 ml-1">الحالة:</span>
          {[
            { id: 'all', label: 'الكل' },
            { id: 'due_soon', label: `تسليم قريب (${stats.dueSoonCount})` },
            { id: 'pending', label: 'في الانتظار' },
            { id: 'in_progress', label: 'قيد الإنجاز' },
            { id: 'ready', label: 'جاهزة للتسليم' },
            { id: 'delivered', label: 'تم التسليم' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1 rounded-lg whitespace-nowrap font-medium text-[11px] transition-all shrink-0 ${
                filter === f.id
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 shadow-2xs space-y-2">
          <p className="text-xs font-medium text-slate-500">لا توجد طلبات خياطة مسجلة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredOrders.map(order => {
            const daysLeft = getDaysDiffFromToday(order.expectedDeliveryDate);
            const isDelivered = order.status === 'delivered';
            const isOverdue = !isDelivered && daysLeft < 0;
            const isDueSoon = !isDelivered && daysLeft >= 0 && daysLeft <= 10;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3 cv-auto"
              >
                {/* 10-Days Due Alert Notification Banner */}
                {isDueSoon && (
                  <div className="bg-amber-50/80 border border-amber-200/80 text-amber-900 px-3 py-1.5 rounded-xl flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>موعد التسليم قريب جداً:</span>
                    </span>
                    <span className="font-bold bg-white px-2 py-0.5 rounded-md text-[11px] border border-amber-200 font-mono">
                      {daysLeft === 0 ? 'اليوم!' : daysLeft === 1 ? 'غداً (+1)' : `متبقي ${daysLeft} أيام`}
                    </span>
                  </div>
                )}

                {isOverdue && (
                  <div className="bg-rose-50/80 border border-rose-200/80 text-rose-900 px-3 py-1.5 rounded-xl flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>تنبيه: تجاوز موعد التسليم المحدد!</span>
                    </span>
                    <span className="font-bold font-mono">متأخر بـ {Math.abs(daysLeft)} يوم</span>
                  </div>
                )}

                {/* Header Info */}
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
                        <span className="font-mono font-bold text-slate-800">{order.orderNumber}</span>
                        <span>•</span>
                        <span>{getServiceLabel(order.serviceType)}</span>
                        <span>•</span>
                        <span>{order.targetType === 'customer_order' ? 'زبونة' : 'المحل'}</span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 mt-1">
                        {order.itemName}
                      </h3>
                    </div>

                    <div>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>

                  {/* Customer row */}
                  {order.customerName && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs py-1.5 border-y border-slate-100">
                      <div>
                        <span className="font-bold text-slate-900">{order.customerName}</span>
                        {order.customerPhone && (
                          <span className="text-slate-400 font-mono text-[11px] mr-2" dir="ltr">{order.customerPhone}</span>
                        )}
                      </div>
                      {order.customerPhone && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleSendMessage(order, 'whatsapp')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium px-2 py-1 rounded-md text-[11px] flex items-center gap-1 transition-all"
                            title="إرسال رسالة واتساب للزبونة"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                            <span>واتساب</span>
                          </button>
                          <button
                            onClick={() => handleSendMessage(order, 'sms')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium px-2 py-1 rounded-md text-[11px] flex items-center gap-1 transition-all"
                            title="إرسال رسالة SMS للزبونة"
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-600" />
                            <span>SMS</span>
                          </button>
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium p-1 rounded-md transition-all flex items-center"
                            title="اتصال هاتفي"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 font-normal">
                    {order.description}
                  </p>

                  {/* Measurements & Tailor (if any) */}
                  {(order.measurements || order.tailorName) && (
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      {order.measurements && <p>المقاسات: <span className="text-slate-700 font-medium">{order.measurements}</span></p>}
                      {order.tailorName && <p>الخياطة: <span className="text-slate-700 font-medium">{order.tailorName}</span></p>}
                    </div>
                  )}

                  {/* Dates & Financials (التواريخ وقيمة التكليف والمداخيل والربح الصافي) */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                    {/* Dates row */}
                    <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-slate-200/60">
                      <div className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>استلام: <strong className="font-mono text-slate-700">{order.receivedDate || '—'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-slate-800">
                        <span>موعد التسليم:</span>
                        <span className="font-mono text-blue-900 bg-white px-2 py-0.5 rounded border border-slate-200">{order.expectedDeliveryDate}</span>
                      </div>
                    </div>

                    {/* Financial details: Cost vs Price vs Net Profit */}
                    {order.targetType === 'customer_order' && order.price > 0 ? (
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">سعر الخدمة</span>
                          <span className="font-bold text-slate-900 font-mono text-xs">{order.price.toLocaleString()} دج</span>
                        </div>
                        <div className="bg-amber-50/80 p-1.5 rounded-lg border border-amber-200/80">
                          <span className="text-[10px] text-amber-800 font-bold block">قيمة التكليف</span>
                          <span className="font-bold text-amber-950 font-mono text-xs">{(order.cost || 0).toLocaleString()} دج</span>
                        </div>
                        <div className={`p-1.5 rounded-lg border ${
                          (order.price - (order.cost || 0)) >= 0
                            ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                            : 'bg-rose-50 text-rose-950 border-rose-200'
                        }`}>
                          <span className="text-[10px] font-bold block text-emerald-800">صافي الربح</span>
                          <span className="font-bold font-mono text-xs">
                            {(order.price - (order.cost || 0)).toLocaleString()} دج
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">صيانة داخلية للمخزن:</span>
                        <span className="font-bold text-amber-800 font-mono">قيمة التكليف: {(order.cost || 0).toLocaleString()} دج</span>
                      </div>
                    )}

                    {/* Remaining debt if any */}
                    {order.price > 0 && (
                      <div className="space-y-1 pt-1 border-t border-slate-200/60 text-[11px] text-slate-600">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">المدفوع / المتبقي:</span>
                          <span className="font-mono font-bold">
                            {order.paidAmount?.toLocaleString() || 0} دج مدفوع 
                            {order.remainingAmount > 0 ? (
                              <span className="text-rose-600 font-bold mr-1.5">({order.remainingAmount.toLocaleString()} دج متبقي دين)</span>
                            ) : (
                              <span className="text-emerald-700 mr-1 font-bold"> (تم الخلاص بالكامل ✓)</span>
                            )}
                          </span>
                        </div>
                        {order.paidAmount > 0 && (
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-blue-700 font-medium">تاريخ استلام المال/العربون:</span>
                            <span className="font-bold font-mono text-blue-950">
                              {order.paymentDate || (order.createdAt ? order.createdAt.split('T')[0] : order.receivedDate)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Status Dropdown/Selector */}
                  <select
                    value={order.status}
                    onChange={(e) => onUpdateStatus(order.id, e.target.value as MaintenanceStatus)}
                    className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 focus:outline-none"
                  >
                    <option value="pending">في الانتظار</option>
                    <option value="in_progress">قيد الإنجاز</option>
                    <option value="ready">جاهزة للتسليم</option>
                    <option value="delivered">تم التسليم</option>
                  </select>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenReceiptModal(order)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>وصل</span>
                    </button>
                    <button
                      onClick={() => onEditOrder(order)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>
                    <button
                      onClick={() => onDeleteOrder(order.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-all"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

