import React, { useState, useMemo } from 'react';
import { MaintenanceOrder, MaintenanceStatus, MaintenanceTargetType, ClothItem } from '../types';
import { Plus, AlertTriangle, AlertCircle, MessageSquare, Mail, Phone, Trash2, FileText, Edit3 } from 'lucide-react';

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
  const [search, setSearch] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const getDaysDiffFromToday = (targetDate: string) => {
    const d1 = new Date(today);
    const d2 = new Date(targetDate);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filtered list
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const daysLeft = getDaysDiffFromToday(order.expectedDeliveryDate);
      const isDueSoon = order.status !== 'delivered' && daysLeft >= 0 && daysLeft <= 10;

      if (filter === 'due_soon' && !isDueSoon) return false;
      if (filter === 'pending' && order.status !== 'pending') return false;
      if (filter === 'in_progress' && order.status !== 'in_progress') return false;
      if (filter === 'ready' && order.status !== 'ready') return false;
      if (filter === 'delivered' && order.status !== 'delivered') return false;

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
  }, [orders, filter, search]);

  // Quick statistics
  const stats = useMemo(() => {
    const active = orders.filter(o => o.status !== 'delivered');
    const dueSoonCount = orders.filter(o => {
      const days = getDaysDiffFromToday(o.expectedDeliveryDate);
      return o.status !== 'delivered' && days >= 0 && days <= 10;
    }).length;
    const readyCount = orders.filter(o => o.status === 'ready').length;
    const totalRemaining = orders.reduce((s, o) => s + (o.remainingAmount || 0), 0);

    return {
      activeCount: active.length,
      dueSoonCount,
      readyCount,
      totalRemaining
    };
  }, [orders]);

  const getServiceLabel = (type: string) => {
    switch (type) {
      case 'alteration': return 'تعديل مقاس';
      case 'repair': return 'تصليح وترقيع';
      case 'custom_sewing': return 'تفصيل جديد';
      case 'ironing_prep': return 'كي وتجهيز';
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

        {/* Minimalist Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
            <span className="text-slate-500 block font-normal">طلبات بالورشة</span>
            <span className="text-base font-bold font-mono text-slate-900">{stats.activeCount}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
            <span className="text-slate-500 block font-normal">تسليم قريب (≤ 10 أيام)</span>
            <span className="text-base font-bold font-mono text-slate-900">{stats.dueSoonCount} طلب</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
            <span className="text-slate-500 block font-normal">جاهزة للتسليم</span>
            <span className="text-base font-bold font-mono text-slate-900">{stats.readyCount}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
            <span className="text-slate-500 block font-normal">المتبقي (ديون)</span>
            <span className="text-base font-bold font-mono text-slate-900">{stats.totalRemaining.toLocaleString()} دج</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-2xs space-y-2.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم، رقم الطلب، هاتف الزبونة..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none"
        />

        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar text-xs">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'due_soon', label: `تسليم خلال 10 أيام (${stats.dueSoonCount})` },
            { id: 'pending', label: 'في الانتظار' },
            { id: 'in_progress', label: 'قيد الإنجاز' },
            { id: 'ready', label: 'جاهزة' },
            { id: 'delivered', label: 'تم التسليم' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all shrink-0 ${
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
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
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

                  {/* Dates & Financials */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-600">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">تاريخ التسليم</span>
                      <span className="font-bold text-slate-800 font-mono">{order.expectedDeliveryDate}</span>
                    </div>
                    {order.price > 0 ? (
                      <div>
                        <span className="text-[11px] text-slate-400 block font-normal">المتبقي / الإجمالي</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {order.remainingAmount > 0 ? `${order.remainingAmount.toLocaleString()} دج متبقي` : 'خالص'} 
                          <span className="text-slate-400 font-normal text-[10px]"> ({order.price.toLocaleString()} دج)</span>
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[11px] text-slate-400 block font-normal">الجهة</span>
                        <span className="font-medium text-slate-700">مخزن المحل</span>
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

