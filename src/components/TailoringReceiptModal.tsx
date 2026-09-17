import React from 'react';
import { MaintenanceOrder } from '../types';
import { Modal } from './Shared';
import { Printer } from 'lucide-react';

interface TailoringReceiptModalProps {
  order: MaintenanceOrder | null;
  onClose: () => void;
}

export const TailoringReceiptModal: React.FC<TailoringReceiptModalProps> = ({
  order,
  onClose
}) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const getServiceLabel = (type: string) => {
    switch (type) {
      case 'alteration': return 'تعديل وتضييق مقاس';
      case 'repair': return 'تصليح وترقيع سحاب/أزرار';
      case 'custom_sewing': return 'خياطة وتفصيل جديد';
      case 'ironing_prep': return 'غسيل وكي وتجهيز';
      default: return 'صيانة وخياطة عامة';
    }
  };

  return (
    <Modal title="وصل الصيانة والخياطة" onClose={onClose}>
      <div className="space-y-4" dir="rtl">
        {/* Printable Receipt Card */}
        <div id="tailoring-receipt-print" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-slate-800 text-sm">
          {/* Header */}
          <div className="text-center border-b border-dashed border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-900">بوتيك الأزياء والأناقة</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">قسم الصيانة، التعديل والخياطة</p>
            <div className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700">
              وصل رقم: <span className="font-mono">{order.orderNumber}</span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">نوع الخدمة:</span>
              <span className="font-bold text-slate-800">{getServiceLabel(order.serviceType)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">اسم القطعة / الفستان:</span>
              <span className="font-bold text-slate-800">{order.itemName}</span>
            </div>
            {order.customerName && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">الزبونة:</span>
                <span className="font-bold text-slate-800">{order.customerName}</span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">الهاتف:</span>
                <span className="font-bold text-slate-800 font-mono" dir="ltr">{order.customerPhone}</span>
              </div>
            )}
            {order.tailorName && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">الخياطة المسؤولة:</span>
                <span className="font-bold text-slate-800">{order.tailorName}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">تاريخ الاستلام:</span>
              <span className="font-medium text-slate-700">{order.receivedDate}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">موعد التسليم المتوقع:</span>
              <span className="font-bold text-slate-900">{order.expectedDeliveryDate}</span>
            </div>

            {/* Description & Measurements */}
            <div className="bg-slate-50 p-2.5 rounded-xl mt-2 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-600 block mb-1">تفاصيل ومقاسات العمل:</span>
              <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap">{order.description}</p>
              {order.measurements && (
                <p className="text-[11px] text-slate-700 font-medium mt-1.5 pt-1.5 border-t border-slate-200">
                  المقاسات: {order.measurements}
                </p>
              )}
            </div>

            {/* Financials (if customer order) */}
            {order.targetType === 'customer_order' && order.price > 0 && (
              <div className="bg-slate-50 p-2.5 rounded-xl space-y-1.5 border border-slate-200 mt-2 font-medium">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">المبلغ الإجمالي:</span>
                  <span className="font-bold text-slate-900">{order.price.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">المدفوع (العربون):</span>
                  <span className="font-bold text-slate-800">{order.paidAmount.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-600">المتبقي عند الاستلام:</span>
                  <span className="font-bold text-slate-900">{order.remainingAmount.toLocaleString()} دج</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="text-center pt-2 border-t border-dashed border-slate-200 text-[10px] text-slate-400 font-medium">
            <p>يرجى إحضار هذا الوصل عند استلام القطعة بعد الصيانة.</p>
            <p className="mt-0.5">شكراً لثقتكم واختياركم لنا.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs min-h-[44px]"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الوصل</span>
          </button>

          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all min-h-[44px]"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
};
