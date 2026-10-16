import React, { useMemo } from 'react';
import { MaintenanceOrder, MaintenanceStatus, TailoringPayment } from '../types';
import { Modal } from './Shared';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  DollarSign,
  Edit3,
  FileText,
  Landmark,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Scissors,
  Trash2,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import {
  describeTailoringPayments,
  getTailoringPaidPercent,
  getTailoringPaidTotal,
  getTailoringPayments,
  getTailoringRemaining,
  tailoringPaymentMethodLabel,
  tailoringPriceOf,
} from '../utils/tailoringPayments';

interface TailoringDetailsModalProps {
  order: MaintenanceOrder;
  onClose: () => void;
  onRecordPayment: (order: MaintenanceOrder) => void;
  onDeletePayment: (paymentId: string) => void;
  onEditOrder: (order: MaintenanceOrder) => void;
  onOpenReceipt: (order: MaintenanceOrder) => void;
  onUpdateStatus: (id: string, status: MaintenanceStatus) => void;
  onDeleteOrder: (id: string) => void;
}

const formatMoney = (value: number) => (Number(value) || 0).toLocaleString('fr-DZ');

const SERVICE_LABELS: Record<string, string> = {
  ironing_prep: 'غسيل وكي وتجهيز (Pressing)',
  alteration: 'تعديل مقاس',
  repair: 'تصليح وترقيم',
  custom_sewing: 'تفصيل وخياطة جديدة',
  other: 'صيانة عامة',
};

const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  pending: 'في الانتظار (الورشة)',
  in_progress: 'قيد الإنجاز',
  ready: 'جاهزة للتسليم',
  delivered: 'تم التسليم',
};

const STATUS_STYLES: Record<MaintenanceStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-800 border-blue-200',
  ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  delivered: 'bg-slate-50 text-slate-500 border-slate-200',
};

const DetailRow: React.FC<{ label: string; value?: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-[11px] text-slate-500 font-medium shrink-0">{label}</span>
    <span className={`text-xs font-bold text-slate-800 text-left ${mono ? 'font-mono' : ''}`}>
      {value === undefined || value === null || value === '' ? '—' : value}
    </span>
  </div>
);

export const TailoringDetailsModal: React.FC<TailoringDetailsModalProps> = ({
  order,
  onClose,
  onRecordPayment,
  onDeletePayment,
  onEditOrder,
  onOpenReceipt,
  onUpdateStatus,
  onDeleteOrder,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const price = tailoringPriceOf(order);
  const paidTotal = getTailoringPaidTotal(order);
  const remaining = getTailoringRemaining(order);
  const paidPercent = getTailoringPaidPercent(order);
  const profit = price - (Number(order.cost) || 0);
  const isDelivered = order.status === 'delivered';

  const payments = useMemo(() => getTailoringPayments(order), [order]);

  const daysLeft = useMemo(() => {
    const d1 = new Date(today);
    const d2 = new Date(order.expectedDeliveryDate);
    return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }, [order.expectedDeliveryDate, today]);

  const isOverdue = !isDelivered && daysLeft < 0;
  const isDueSoon = !isDelivered && daysLeft >= 0 && daysLeft <= 10;

  const handleSendMessage = (method: 'whatsapp' | 'sms') => {
    if (!order.customerPhone) return;
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.startsWith('0') ? '213' + cleanPhone.substring(1) : cleanPhone;

    let msg = `السلام عليكم ${order.customerName || 'سيدتي'}،\n`;
    msg += `بخصوص طلب الخياطة/التعديل رقم ${order.orderNumber} (${order.itemName}):\n`;
    msg += `• السعر الإجمالي: ${formatMoney(price)} دج\n`;
    msg += `• المدفوع: ${formatMoney(paidTotal)} دج\n`;
    if (remaining > 0) {
      msg += `• المتبقي عند الاستلام: ${formatMoney(remaining)} دج\n`;
    } else {
      msg += '• تم الخلاص بالكامل ✓\n';
    }
    if (order.status === 'ready') {
      msg += 'طلبك أصبح جاهزاً للاستلام في البوتيك.\n';
    } else if (!isDelivered) {
      msg += `موعد التسليم المتوقع: ${order.expectedDeliveryDate}.\n`;
    }
    msg += 'شكراً لتعاملكِ مع البوتيك!';

    const encoded = encodeURIComponent(msg);
    if (method === 'whatsapp') {
      window.open(`https://wa.me/${waPhone}?text=${encoded}`, '_blank');
    } else {
      window.open(`sms:${order.customerPhone}?body=${encoded}`, '_blank');
    }
  };

  const handleDelete = () => {
    if (window.confirm(`هل أنت متأكد من حذف الطلب ${order.orderNumber} من سجل الخياطة؟`)) {
      onDeleteOrder(order.id);
      onClose();
    }
  };

  return (
    <Modal title={`تفاصيل المعاملة — ${order.orderNumber}`} onClose={onClose} wide>
      <div className="space-y-4" dir="rtl">
        {/* الترويسة والحالة */}
        <div className="bg-gradient-to-l from-slate-50 via-white to-blue-50/60 border border-slate-200 rounded-2xl p-3.5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-sm text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                  {order.orderNumber}
                </span>
                <span className="text-[11px] font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                  {SERVICE_LABELS[order.serviceType] || 'صيانة عامة'}
                </span>
                <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                  {order.targetType === 'customer_order' ? 'طلب زبونة' : 'المحل (مخزن)'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-2 truncate">{order.itemName}</h3>
              {order.customerName && (
                <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-800">{order.customerName}</span>
                  {order.customerPhone && <span className="font-mono text-slate-500" dir="ltr">{order.customerPhone}</span>}
                </p>
              )}
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${STATUS_STYLES[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>

          {isDueSoon && (
            <div className="bg-amber-50/80 border border-amber-200/80 text-amber-900 px-3 py-1.5 rounded-xl flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>موعد التسليم قريب جداً</span>
              </span>
              <span className="font-mono bg-white px-2 py-0.5 rounded-md border border-amber-200">
                {daysLeft === 0 ? 'اليوم!' : daysLeft === 1 ? 'غداً' : `متبقي ${daysLeft} يوم`}
              </span>
            </div>
          )}

          {isOverdue && (
            <div className="bg-rose-50/80 border border-rose-200/80 text-rose-900 px-3 py-1.5 rounded-xl flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>تجاوز موعد التسليم</span>
              </span>
              <span className="font-mono">متأخر بـ {Math.abs(daysLeft)} يوم</span>
            </div>
          )}

          {order.customerPhone && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSendMessage('whatsapp')}
                className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>واتساب</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('sms')}
                className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 transition-all"
              >
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>SMS</span>
              </button>
              <a
                href={`tel:${order.customerPhone}`}
                className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 transition-all"
              >
                <Phone className="w-3.5 h-3.5 text-slate-600" />
                <span>اتصال</span>
              </a>
            </div>
          )}
        </div>

        {/* الوضعية المالية */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-slate-400" />
              <span>سعر الخدمة</span>
            </span>
            <span className="font-bold font-mono text-sm text-slate-900 block mt-0.5">{formatMoney(price)} دج</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
            <span className="text-[10px] text-emerald-800 font-bold flex items-center gap-1">
              <Wallet className="w-3 h-3 text-emerald-600" />
              <span>المدفوع</span>
            </span>
            <span className="font-bold font-mono text-sm text-emerald-900 block mt-0.5">{formatMoney(paidTotal)} دج</span>
          </div>
          <div className={`border rounded-xl p-2.5 ${remaining > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${remaining > 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
              <Clock className="w-3 h-3" />
              <span>المتبقي</span>
            </span>
            <span className={`font-bold font-mono text-sm block mt-0.5 ${remaining > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>
              {remaining > 0 ? `${formatMoney(remaining)} دج` : 'خالص ✓'}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
              <Scissors className="w-3 h-3 text-amber-500" />
              <span>التكليف / الربح</span>
            </span>
            <span className="font-bold font-mono text-[11px] text-slate-800 block mt-0.5">
              {formatMoney(Number(order.cost) || 0)} / {formatMoney(profit)} دج
            </span>
          </div>
        </div>

        {/* شريط تقدم السداد */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span>نسبة السداد على هذا الطلب</span>
            <span className="font-mono">{paidPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${paidPercent >= 100 ? 'bg-emerald-500' : paidPercent > 0 ? 'bg-blue-500' : 'bg-slate-300'}`}
              style={{ width: `${Math.min(100, Math.max(0, paidPercent))}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 block">
            {describeTailoringPayments(order)}
            {payments.length > 0 && ` • آخر استلام: ${payments[payments.length - 1].date}`}
          </span>
        </div>

        {/* سجل الفارمسوات */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-slate-100/70 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-slate-500" />
              <span>سجل الفارمسوات (الدفعات/الأقساط) — {payments.length}</span>
            </span>
            {price > 0 && (
              <button
                type="button"
                onClick={() => onRecordPayment(order)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>تسجيل فارسمو</span>
              </button>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-slate-500 font-medium">
              لا توجد أي دفعة مسجلة على هذا الطلب بعد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-2 text-right font-bold">#</th>
                    <th className="p-2 text-right font-bold">تاريخ الاستلام</th>
                    <th className="p-2 text-right font-bold">المبلغ</th>
                    <th className="p-2 text-right font-bold">الطريقة</th>
                    <th className="p-2 text-right font-bold">ملاحظة</th>
                    <th className="p-2 text-right font-bold">الصندوق</th>
                    <th className="p-2 text-center font-bold">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment: TailoringPayment, index: number) => (
                    <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 font-mono text-slate-500">{index + 1}</td>
                      <td className="p-2 font-mono font-bold text-slate-800">{payment.date || '—'}</td>
                      <td className="p-2 font-mono font-bold text-emerald-800">+{formatMoney(payment.amount)} دج</td>
                      <td className="p-2 text-slate-700">{tailoringPaymentMethodLabel(payment.method)}</td>
                      <td className="p-2 text-slate-600">{payment.note || (payment.legacy ? 'دفعة أصلية' : '—')}</td>
                      <td className="p-2">
                        {payment.countsInCaisse === false ? (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            محصّلة عبر الديون
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            صندوق اليوم
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`حذف هذه الدفعة (${formatMoney(payment.amount)} دج بتاريخ ${payment.date})؟ سيُعاد احتساب المتبقي على الطلب.`)) {
                              onDeletePayment(payment.id);
                            }
                          }}
                          title="حذف الدفعة (تصحيح قيد)"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td className="p-2 font-bold text-slate-600" colSpan={2}>المجموع</td>
                    <td className="p-2 font-mono font-black text-slate-900">{formatMoney(paidTotal)} دج</td>
                    <td className="p-2 text-[10px] font-bold text-rose-700" colSpan={4}>
                      المتبقي: {remaining > 0 ? `${formatMoney(remaining)} دج` : 'خالص بالكامل ✓'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* تفاصيل الطلب */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-3">
            <h4 className="text-[11px] font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>بيانات العمل والقياسات</span>
            </h4>
            <DetailRow label="الوصف المطلوب" value={order.description} />
            <DetailRow label="المقاسات" value={order.measurements} />
            <DetailRow label="الخياطة/الورشة" value={order.tailorName} />
            <DetailRow label="ملاحظات" value={order.notes} />
            {order.itemId && <DetailRow label="القطعة من المخزن" value={order.itemId} mono />}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-3">
            <h4 className="text-[11px] font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>التواريخ وتتبع الطلب</span>
            </h4>
            <DetailRow label="تاريخ استلام القطعة" value={order.receivedDate} mono />
            <DetailRow label="موعد التسليم المتوقع" value={order.expectedDeliveryDate} mono />
            <DetailRow label="تاريخ التسليم الفعلي" value={order.actualDeliveryDate} mono />
            <DetailRow label="تاريخ استلام المال (آخر دفعة)" value={payments.length > 0 ? payments[payments.length - 1].date : order.paymentDate} mono />
            <DetailRow label="تاريخ إنشاء الطلب" value={order.createdAt ? order.createdAt.replace('T', ' ').slice(0, 16) : undefined} mono />
          </div>
        </div>

        {/* الأرباح */}
        <div className="bg-slate-900 text-white rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-bold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>صافي ربح هذا الطلب (السعر − التكليف)</span>
          </span>
          <span className={`font-black font-mono text-sm ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatMoney(profit)} دج
          </span>
        </div>

        {/* الإجراءات */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            {price > 0 && (
              <button
                type="button"
                onClick={() => onRecordPayment(order)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-2.5 rounded-2xl font-bold text-xs transition-all min-h-[42px] flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>تسجيل فارسمو (دفعة جديدة)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenReceipt(order)}
              className="flex-1 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white py-2.5 rounded-2xl font-bold text-xs transition-all min-h-[42px] flex items-center justify-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>عرض/طباعة الوصل</span>
            </button>
            <button
              type="button"
              onClick={() => onEditOrder(order)}
              className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 py-2.5 rounded-2xl font-bold text-xs transition-all min-h-[42px] flex items-center justify-center gap-1.5"
            >
              <Edit3 className="w-4 h-4" />
              <span>تعديل الطلب</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2">
            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>تغيير حالة الطلب:</span>
            </span>
            <select
              value={order.status}
              onChange={(e) => onUpdateStatus(order.id, e.target.value as MaintenanceStatus)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-[11px] font-bold text-slate-800 focus:outline-none"
            >
              {(Object.keys(STATUS_LABELS) as MaintenanceStatus[]).map(status => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleDelete}
              className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 py-2 px-3 rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف الطلب</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
