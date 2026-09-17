import React from 'react';
import html2canvas from 'html2canvas';
import { Rental } from '../types';
import { Shirt, Crown, Download, Printer } from 'lucide-react';

interface RentalReceiptModalProps {
  rental: Rental;
  onClose: () => void;
}

export const RentalReceiptModal: React.FC<RentalReceiptModalProps> = ({ rental, onClose }) => {
  const exportAsImage = async () => {
    const el = document.getElementById('rentalReceiptPrintArea');
    if (!el) return;

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const image = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = `وصل_كراء_${rental.customerName.replace(/\s+/g, '_')}_${rental.id.substring(0, 6)}.png`;
    link.href = image;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-200 no-print">
        <span className="text-xs font-bold text-slate-600">يمكنك طباعة الوصل أو حفظه كصورة وإرساله للزبون</span>
        <div className="flex gap-2">
          <button
            onClick={exportAsImage}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          >
            <Download className="w-4 h-4" />
            حفظ كصورة للواتساب
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          >
            <Printer className="w-4 h-4" />
            طباعة الوصل
          </button>
        </div>
      </div>

      {/* Printable Area */}
      <div 
        id="rentalReceiptPrintArea" 
        className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-slate-800 text-slate-900 space-y-5"
      >
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {rental.status === 'reserved' ? 'وصل حجز فستان لمناسبة قادمة' : 'وصل استلام وتأجير'}
            </h2>
            <p className="text-xs text-slate-500 font-bold">لكراء وبيع أرقى فساتين السهرة والأزياء والأطقم الرسمية</p>
          </div>
          <div className="text-left">
            <span className={`inline-block text-white text-xs font-black px-3 py-1 rounded-md ${
              rental.status === 'reserved' ? 'bg-slate-800' : 'bg-slate-900'
            }`}>
              {rental.status === 'reserved' ? 'وصل حجز رسمي' : 'وصل كراء رسمي'}
            </span>
            <div className="text-[11px] text-slate-500 mt-1 font-bold">رقم الوصل: #{rental.id.substring(0, 8)}</div>
          </div>
        </div>

        {/* Customer & Dates Info */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] font-bold">بيانات الزبون:</span>
            <div className="font-black text-slate-800 text-sm mt-0.5">{rental.customerName}</div>
            <div className="text-slate-600 font-bold mt-0.5">الهاتف: {rental.customerPhone}</div>
            {rental.customerIdNumber && (
              <div className="text-slate-600 font-bold mt-0.5">رقم الهوية/الضمان: {rental.customerIdNumber}</div>
            )}
          </div>
          <div className="text-left">
            <span className="text-slate-400 block text-[10px] font-bold">المواعيد:</span>
            <div className="font-bold text-slate-700 mt-0.5">
              {rental.status === 'reserved' ? 'تاريخ الحجز والمناسبة: ' : 'تاريخ الاستلام: '}
              <span className="font-black text-slate-900">{rental.startDate}</span>
            </div>
            <div className="font-bold text-slate-700 mt-0.5">
              تاريخ الإرجاع: <span className="font-black text-slate-900 underline">{rental.expectedReturnDate}</span>
            </div>
          </div>
        </div>

        {/* Table of Rented Items */}
        <table className="w-full text-right text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
            <tr>
              <th className="p-2.5">البيان / القطعة المؤجرة</th>
              <th className="p-2.5 text-center">المقاس / اللون</th>
              <th className="p-2.5 text-center">الكمية</th>
              <th className="p-2.5 text-left">سعر الكراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="p-3 font-black text-slate-800">
                <div className="flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-slate-500" />
                  <span>{rental.itemName}</span>
                </div>
              </td>
              <td className="p-3 text-center font-bold text-slate-600">{rental.itemSize} / {rental.itemColor}</td>
              <td className="p-3 text-center font-bold text-slate-700">{rental.qty}</td>
              <td className="p-3 text-left font-black text-slate-900">
                {(rental.dressRentPrice !== undefined ? rental.dressRentPrice : rental.rentPrice).toLocaleString()} دج
              </td>
            </tr>

            {rental.hasAccessories && rental.accessoryPrice && rental.accessoryPrice > 0 && (
              <tr className="bg-slate-50">
                <td className="p-3 font-black text-slate-900">
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-slate-600" />
                    <span>{rental.accessoryName || 'إكسسوارات إضافية مرفقة مع الفستان'}</span>
                  </div>
                </td>
                <td className="p-3 text-center font-bold text-slate-700">إكسسوار مرفق</td>
                <td className="p-3 text-center font-bold text-slate-700">1</td>
                <td className="p-3 text-left font-black text-slate-900">
                  {rental.accessoryPrice.toLocaleString()} دج
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals & Caution */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
          {rental.hasAccessories && rental.accessoryPrice && rental.accessoryPrice > 0 && (
            <>
              <div className="flex justify-between font-bold text-slate-600">
                <span>سعر كراء الفستان:</span>
                <span className="font-bold text-slate-800">
                  {(rental.dressRentPrice !== undefined ? rental.dressRentPrice : rental.rentPrice - (rental.accessoryPrice || 0)).toLocaleString()} دج
                </span>
              </div>
              <div className="flex justify-between font-bold text-amber-800">
                <span>سعر كراء الإكسسوارات:</span>
                <span className="font-bold">+{rental.accessoryPrice.toLocaleString()} دج</span>
              </div>
            </>
          )}

          <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200 text-sm">
            <span>مبلغ الكراء الإجمالي الكلي:</span>
            <span className="text-emerald-700">{rental.rentPrice.toLocaleString()} دج</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-700">
            <span>{rental.status === 'reserved' ? 'مبلغ العربون / التسبيق المدفوع:' : 'المدفوع مسبقاً:'}</span>
            <span className="font-black">{rental.paidAmount.toLocaleString()} دج</span>
          </div>
          {rental.remainingAmount > 0 && (
            <div className="flex justify-between font-black text-rose-700 pt-1 border-t border-slate-200">
              <span>{rental.status === 'reserved' ? 'المتبقي عند استلام الفستان وإتمام الصفقة:' : 'المتبقي عند الإرجاع:'}</span>
              <span>{rental.remainingAmount.toLocaleString()} دج</span>
            </div>
          )}
          <div className="flex justify-between font-black text-amber-800 pt-1 border-t border-slate-200">
            <span>مبلغ الضمان / العربون المسترجع (Caution):</span>
            <span className="bg-amber-100 px-2 py-0.5 rounded text-amber-900">
              {(rental.cautionAmount || 0).toLocaleString()} دج
            </span>
          </div>
        </div>

        {/* Terms */}
        <div className="text-[10px] text-slate-500 space-y-1 leading-relaxed border-t border-dashed border-slate-300 pt-3">
          <p className="font-bold text-slate-700">شروط وتعهد الكراء:</p>
          <p>1. يتعهد المستأجر بالمحافظة على القطعة وإرجاعها في تاريخ الإرجاع المحدد أعلاه دون تأخير.</p>
          <p>2. يُسترجع مبلغ الضمان كاملاً بعد فحص القطعة والتأكد من سلامتها من أي حروق أو تمزق أو بقع غير قابلة للغسيل.</p>
          <p>3. في حالة التأخير عن الموعد المحدد يحق للمحل تطبيق غرامة تأخير عن كل يوم إضافي.</p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-4 text-xs font-black text-slate-800">
          <div className="border-t border-slate-400 pt-2">توقيع المستأجر:</div>
          <div className="border-t border-slate-400 pt-2 text-left">ختم وتوقيع البوتيك:</div>
        </div>
      </div>
    </div>
  );
};
