import React from 'react';
import html2canvas from 'html2canvas';
import { ClothItem, Rental, Sale, Expense, Credit, StaffPayout } from '../types';

interface FullReportProps {
  clothes: ClothItem[];
  rentals: Rental[];
  sales: Sale[];
  expenses: Expense[];
  credits: Credit[];
  staffPayouts: StaffPayout[];
  hideFinances: boolean;
}

export const FullReport: React.FC<FullReportProps> = ({
  clothes,
  rentals,
  sales,
  expenses,
  credits,
  staffPayouts,
  hideFinances
}) => {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const exportToImage = async () => {
    const element = document.getElementById('boutiqueFullReportContent');
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const image = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = `تقرير_شامل_${new Date().toLocaleDateString()}.png`;
    link.href = image;
    link.click();
  };

  const totalRentalIncome = rentals.reduce((s, r) => s + (r.paidAmount || 0), 0);
  const totalSalesRevenue = sales.reduce((s, sl) => s + (sl.totalAmount || 0), 0);
  const totalSalesProfit = sales.reduce((s, sl) => s + (sl.profit || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalStaffPayouts = staffPayouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalCredits = credits.reduce((s, c) => s + Number(c.amount), 0);
  const totalHeldCautions = rentals
    .filter(r => r.status !== 'returned' && r.cautionStatus === 'held')
    .reduce((s, r) => s + (r.cautionAmount || 0), 0);

  const totalCostOfSold = totalSalesRevenue - totalSalesProfit;
  const netProfit = (totalRentalIncome + totalSalesProfit) - (totalExpenses + totalStaffPayouts);

  const activeRentalsCount = rentals.filter(r => r.status === 'active').length;
  const reservedRentalsCount = rentals.filter(r => r.status === 'reserved').length;
  const totalStockItems = clothes.reduce((s, c) => s + c.stock, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-200 no-print">
        <span className="text-xs font-bold text-slate-600">يمكنك حفظ التقرير الإداري والمالي كصورة عالية الجودة أو طباعته</span>
        <div className="flex gap-2">
          <button
            onClick={exportToImage}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2"></path></svg>
            حفظ التقرير كصورة
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth="2"></path></svg>
            طباعة
          </button>
        </div>
      </div>

      <div id="boutiqueFullReportContent" className="space-y-6 text-slate-800 p-8 bg-white border border-slate-200 rounded-3xl" dir="rtl">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 text-right">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-2xl font-black text-blue-600 tracking-tight">التقرير المالي والإداري الشامل</h1>
              <p className="text-xs font-bold text-slate-500 mt-1">تقرير كراء وبيع الملابس والأزياء والمخزون</p>
            </div>
            <div className="text-left bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl">
              <span className="text-xs font-bold text-slate-600 block">{formattedDate}</span>
              <span className="text-[11px] font-mono text-slate-400">{formattedTime}</span>
            </div>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <span className="text-xs font-bold text-blue-800 block mb-1">مداخيل الكراء</span>
            <span className="text-xl font-black text-blue-900">{totalRentalIncome.toLocaleString()} دج</span>
            <span className="text-[10px] text-blue-600 block mt-1">
              ({activeRentalsCount} كراء جاري{reservedRentalsCount > 0 ? ` • ${reservedRentalsCount} حجز قادم` : ''})
            </span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-xs font-bold text-slate-800 block mb-1">مبيعات الملابس</span>
            <span className="text-xl font-black text-slate-900">{totalSalesRevenue.toLocaleString()} دج</span>
            <span className="text-[10px] text-slate-600 block mt-1">(ربح صافي: {totalSalesProfit.toLocaleString()} دج)</span>
          </div>

          <div className="p-4 bg-black border border-black rounded-2xl">
            <span className="text-xs font-bold text-white block mb-1">المصاريف والغسيل</span>
            <span className="text-xl font-black text-white">{totalExpenses.toLocaleString()} دج</span>
            <span className="text-[10px] text-slate-300 block mt-1">({expenses.length} مصاريف)</span>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <span className="text-xs font-bold text-blue-800 block mb-1">صافي الأرباح</span>
            <span className="text-xl font-black text-blue-900">{netProfit.toLocaleString()} دج</span>
            <span className="text-[10px] text-blue-600 block mt-1">الربح الصافي للبوتيك</span>
          </div>
        </div>

        {/* Detailed Breakdown Tables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Active Rentals Table */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
            <h3 className="font-black text-sm text-slate-800 mb-3 flex items-center justify-between">
              <span>القطع المؤجرة حالياً ({activeRentalsCount})</span>
              <span className="text-xs text-black font-bold">الضمانات: {totalHeldCautions.toLocaleString()} دج</span>
            </h3>
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold">
                <tr>
                  <th className="p-2">القطعة</th>
                  <th className="p-2">الزبون</th>
                  <th className="p-2">تاريخ الإرجاع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rentals.filter(r => r.status === 'active').slice(0, 5).map(r => (
                  <tr key={r.id}>
                    <td className="p-2 font-black">{r.itemName}</td>
                    <td className="p-2 text-slate-600">{r.customerName}</td>
                    <td className="p-2 font-bold text-black underline">{r.expectedReturnDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Inventory Overview */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
            <h3 className="font-black text-sm text-slate-800 mb-3 flex items-center justify-between">
              <span>حالة مخزون المحل ({totalStockItems} قطعة)</span>
              <span className="text-xs text-blue-600 font-bold">{clothes.length} موديل</span>
            </h3>
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold">
                <tr>
                  <th className="p-2">الموديل / الفستان</th>
                  <th className="p-2 text-center">المقاس</th>
                  <th className="p-2 text-left">المتوفر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {clothes.slice(0, 5).map(c => (
                  <tr key={c.id}>
                    <td className="p-2 font-black">{c.name}</td>
                    <td className="p-2 text-center font-bold text-slate-500">{c.size}</td>
                    <td className="p-2 text-left font-black text-blue-700">{c.stock - c.rentedCount} قطعة</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-xs text-slate-400 font-medium">
          <span>بوتيك مانجر برو - نظام إدارة وتأجير الملابس</span>
          <span>تاريخ التقرير: {formattedDate}</span>
        </div>
      </div>
    </div>
  );
};
