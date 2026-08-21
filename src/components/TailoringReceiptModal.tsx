import React from 'react';
import { MaintenanceOrder } from '../types';
import { Modal } from './Shared';

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
            <h2 className="text-lg font-black text-rose-600">بوتيك الأزياء والأناقة</h2>
            <p className="text-xs text-slate-500 font-bold mt-0.5">قسم الصيانة، التعديل والخياطة الراقية</p>
            <div className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-full text-xs font-black text-slate-700">
              وصل رقم: <span className="font-mono">{order.orderNumber}</span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-bold">نوع الخدمة:</span>
              <span className="font-black text-slate-800">{getServiceLabel(order.serviceType)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-bold">اسم القطعة / الفستان:</span>
              <span className="font-black text-slate-800">{order.itemName}</span>
            </div>
            {order.customerName && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-bold">الزبونة:</span>
                <span className="font-black text-slate-800">{order.customerName}</span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-bold">الهاتف:</span>
                <span className="font-black text-slate-800 font-mono" dir="ltr">{order.customerPhone}</span>
              </div>
            )}
            {order.tailorName && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-bold">الخياطة المسؤولة:</span>
                <span className="font-black text-indigo-700">{order.tailorName}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-bold">تاريخ الاستلام:</span>
              <span className="font-bold text-slate-700">{order.receivedDate}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-bold">موعد التسليم المتوقع:</span>
              <span className="font-black text-rose-600">{order.expectedDeliveryDate}</span>
            </div>

            {/* Description & Measurements */}
            <div className="bg-slate-50 p-2.5 rounded-xl mt-2 border border-slate-100">
              <span className="text-[11px] font-black text-slate-600 block mb-1">تفاصيل ومقاسات العمل:</span>
              <p className="text-xs text-slate-800 font-bold whitespace-pre-wrap">{order.description}</p>
              {order.measurements && (
                <p className="text-[11px] text-indigo-800 font-bold mt-1.5 pt-1.5 border-t border-slate-200">
                  📐 المقاسات: {order.measurements}
                </p>
              )}
            </div>

            {/* Financials (if customer order) */}
            {order.targetType === 'customer_order' && order.price > 0 && (
              <div className="bg-rose-50/50 p-2.5 rounded-xl space-y-1.5 border border-rose-100 mt-2 font-bold">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">المبلغ الإجمالي:</span>
                  <span className="font-black text-slate-900">{order.price.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-700">المدفوع (العربون):</span>
                  <span className="font-black text-emerald-700">{order.paidAmount.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-rose-100">
                  <span className="text-rose-700">المتبقي عند الاستلام:</span>
                  <span className="font-black text-rose-700">{order.remainingAmount.toLocaleString()} دج</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="text-center pt-2 border-t border-dashed border-slate-200 text-[10px] text-slate-400 font-bold">
            <p>يرجى إحضار هذا الوصل عند استلام القطعة بعد الصيانة.</p>
            <p className="mt-0.5">شكراً لثقتكم واختياركم لنا ✨</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>طباعة الوصل</span>
          </button>

          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all min-h-[44px]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </Modal>
  );
};
