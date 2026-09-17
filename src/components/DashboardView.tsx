import React, { useState } from 'react';
import { Rental, ClothItem, ViewType, MaintenanceOrder, DailyCaisseClosure, Sale, Expense, StaffPayout } from '../types';
import { StatCard } from './Shared';

interface DashboardViewProps {
  stats: any;
  rentals: Rental[];
  maintenanceOrders?: MaintenanceOrder[];
  clothes: ClothItem[];
  caisseClosures?: DailyCaisseClosure[];
  sales?: Sale[];
  expenses?: Expense[];
  staffPayouts?: StaffPayout[];
  hideFinances: boolean;
  onPrivacyToggle: () => void;
  onNavigate: (view: ViewType) => void;
  onOpenAddRental: () => void;
  onOpenReturnModal: (rental: Rental) => void;
  onSendMessage: (rental: Rental) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  rentals,
  maintenanceOrders = [],
  clothes,
  caisseClosures = [],
  sales = [],
  expenses = [],
  staffPayouts = [],
  hideFinances,
  onPrivacyToggle,
  onNavigate,
  onOpenAddRental,
  onOpenReturnModal,
  onSendMessage
}) => {
  const [financePeriod, setFinancePeriod] = useState<'monthly' | 'yearly' | 'all'>('monthly');
  const today = new Date().toISOString().split('T')[0];

  const calculateDaysDiff = (expectedDate: string) => {
    const exp = new Date(expectedDate);
    const now = new Date(today);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Urgent rentals: Overdue or due today (only for active rentals)
  const urgentRentals = rentals.filter(r => {
    if (r.status !== 'active') return false;
    const diff = calculateDaysDiff(r.expectedReturnDate);
    return diff <= 0;
  });

  // Tailoring due within 10 days
  const urgentTailoringOrders = maintenanceOrders.filter(o => {
    if (o.status === 'delivered') return false;
    const diff = calculateDaysDiff(o.expectedDeliveryDate);
    return diff <= 10;
  });

  const activeRentals = rentals.filter(r => r.status === 'active');
  const reservedRentals = rentals.filter(r => r.status === 'reserved');

  // Values based on selected period
  const currentRentalIncome = financePeriod === 'monthly' 
    ? (stats.monthlyRentalIncome || 0) 
    : financePeriod === 'yearly' 
    ? (stats.yearlyRentalIncome || 0) 
    : (stats.totalRentalIncome || 0);

  const currentSalesRevenue = financePeriod === 'monthly'
    ? (stats.monthlySalesRevenue || 0)
    : financePeriod === 'yearly'
    ? (stats.yearlySalesRevenue || 0)
    : (stats.totalSalesRevenue || 0);

  const currentTailoringIncome = financePeriod === 'monthly'
    ? (stats.monthlyTailoringIncome || 0)
    : financePeriod === 'yearly'
    ? (stats.yearlyTailoringIncome || 0)
    : (stats.totalTailoringIncome || 0);

  const currentExpenses = financePeriod === 'monthly'
    ? (stats.monthlyExpenses || 0)
    : financePeriod === 'yearly'
    ? (stats.yearlyExpenses || 0)
    : (stats.totalExpenses || 0);

  const currentStaffPayouts = financePeriod === 'monthly'
    ? (stats.monthlyStaffPayouts || 0)
    : financePeriod === 'yearly'
    ? (stats.yearlyStaffPayouts || 0)
    : (stats.totalStaffPayouts || 0);

  const currentGrossRevenue = currentRentalIncome + currentSalesRevenue + currentTailoringIncome;
  const currentNetProfit = financePeriod === 'monthly'
    ? (stats.monthlyNetProfit || 0)
    : financePeriod === 'yearly'
    ? (stats.yearlyNetProfit || 0)
    : (stats.netProfit || 0);

  // Today's Caisse calculations for dashboard banner
  const todaySales = sales.filter(s => s.date && s.date.startsWith(today)).reduce((sum, s) => sum + (s.paidAmount !== undefined ? s.paidAmount : s.totalAmount || 0), 0);
  const todayRentals = rentals.filter(r => (r.createdAt && r.createdAt.startsWith(today)) || (r.startDate && r.startDate.startsWith(today))).reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  const todayTailoring = maintenanceOrders.filter(o => (o.receivedDate && o.receivedDate.startsWith(today)) || (o.createdAt && o.createdAt.startsWith(today))).reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  const todayExpenses = expenses.filter(e => e.date && e.date.startsWith(today)).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const todayStaff = staffPayouts.filter(p => p.date && p.date.startsWith(today)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const todayIncome = todaySales + todayRentals + todayTailoring;
  const todayExpectedCash = todayIncome - (todayExpenses + todayStaff);

  const todayClosure = caisseClosures.find(c => c.date === today);
  const currentMonth = today.substring(0, 7);
  const monthClosures = caisseClosures.filter(c => c.date.startsWith(currentMonth));
  const monthVariance = monthClosures.reduce((s, c) => s + (c.difference || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6" dir="rtl">
      {/* Top Welcome & Controls Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-2xl font-black text-slate-900">
              لوحة التحكم والمداخيل الرئيسية
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            متابعة شاملة لمداخيل الكراء، الخياطة الشهرية والسنوية، مبيعات الملابس، وصافي الأرباح.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Period Selector Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setFinancePeriod('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                financePeriod === 'monthly' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 هذا الشهر
            </button>
            <button
              onClick={() => setFinancePeriod('yearly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                financePeriod === 'yearly' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗓️ هذه السنة
            </button>
            <button
              onClick={() => setFinancePeriod('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                financePeriod === 'all' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📈 الإجمالي
            </button>
          </div>

          <button
            onClick={onPrivacyToggle}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] active:scale-95 ${
              hideFinances ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title={hideFinances ? 'إظهار الأرقام' : 'إخفاء الأرقام'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {hideFinances ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              )}
            </svg>
            <span>{hideFinances ? 'إظهار' : 'إخفاء'}</span>
          </button>

          <button
            onClick={onOpenAddRental}
            className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs min-h-[38px] active:scale-95"
          >
            + كراء جديد 👗
          </button>
        </div>
      </div>

      {/* Daily Cash Register & Shortage Monitoring Banner (La Caisse du Jour) */}
      <div className="bg-white text-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-slate-100 text-slate-700 rounded-xl text-sm border border-slate-200/80">
              ⚖️
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              صندوق اليومية ومتابعة العجز (La Caisse)
            </h3>
            {todayClosure ? (
              <span className="bg-slate-100 text-emerald-800 border border-emerald-200/80 text-[10px] font-bold px-2 py-0.5 rounded-md">
                تم إقفال صندوق اليوم ✓
              </span>
            ) : (
              <span className="bg-slate-100 text-amber-800 border border-amber-200/80 text-[10px] font-bold px-2 py-0.5 rounded-md">
                الصندوق قيد النشاط
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-normal">
            متابعة إجمالي مدخول اليوم وتسجيل المبلغ الفعلي في الدرج لاحتساب فارق وعجز الصندوق (اليوم، الشهر، والسنة)
          </p>
        </div>

        {/* 3 Quick stats and CTA button */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70 text-center min-w-[95px]">
            <div className="text-[10px] text-slate-500 font-medium">مدخول اليوم:</div>
            <div className="text-sm font-bold text-slate-900 font-mono">
              {hideFinances ? '••••' : `${todayIncome.toLocaleString()} دج`}
            </div>
          </div>

          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70 text-center min-w-[105px]">
            <div className="text-[10px] text-slate-500 font-medium">
              {todayClosure ? 'فارق اليوم:' : 'المتوقع في الدرج:'}
            </div>
            <div className={`text-sm font-bold font-mono ${
              todayClosure ? (todayClosure.difference < 0 ? 'text-rose-600' : 'text-slate-900') : 'text-slate-800'
            }`}>
              {hideFinances ? '••••' : (
                todayClosure ? (
                  todayClosure.difference > 0 ? `+${todayClosure.difference.toLocaleString()} دج` : `${todayClosure.difference.toLocaleString()} دج`
                ) : `${todayExpectedCash.toLocaleString()} دج`
              )}
            </div>
          </div>

          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70 text-center min-w-[105px]">
            <div className="text-[10px] text-slate-500 font-medium">عجز/فارق الشهر:</div>
            <div className={`text-sm font-bold font-mono ${
              monthVariance < 0 ? 'text-rose-600' : 'text-slate-900'
            }`}>
              {hideFinances ? '••••' : (
                monthVariance > 0 ? `+${monthVariance.toLocaleString()} دج` : `${monthVariance.toLocaleString()} دج`
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('caisse')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <span>⚖️</span>
            <span>فتح الصندوق</span>
          </button>
        </div>
      </div>

      {/* Main Income & Financial StatCards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. مداخيل الكراء والتأجير */}
        <StatCard
          title="مداخيل الكراء والتأجير"
          value={currentRentalIncome}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => onNavigate('rentals')}
          icon={<span>👗</span>}
        />

        {/* 2. مداخيل الخياطة الشهرية */}
        <StatCard
          title="مداخيل الخياطة الشهرية"
          value={stats.monthlyTailoringIncome || 0}
          subtitle="هذا الشهر"
          hideValue={hideFinances}
          onClick={() => onNavigate('tailoring')}
          icon={<span>🧵</span>}
        />

        {/* 3. مداخيل الخياطة السنوية */}
        <StatCard
          title="مداخيل الخياطة السنوية"
          value={stats.yearlyTailoringIncome || 0}
          subtitle="هذه السنة"
          hideValue={hideFinances}
          onClick={() => onNavigate('tailoring')}
          icon={<span>🪡</span>}
        />

        {/* 4. مداخيل مبيعات الملابس */}
        <StatCard
          title="مبيعات الملابس (الكاشير)"
          value={currentSalesRevenue}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => onNavigate('sales')}
          icon={<span>🛒</span>}
        />

        {/* 5. المصاريف والغسيل */}
        <StatCard
          title="المصاريف والغسيل (Pressing)"
          value={currentExpenses}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => onNavigate('expenses')}
          icon={<span>🧼</span>}
        />

        {/* 6. الديون والكريدي المتبقي */}
        <StatCard
          title="الكريدي والديون المتبقية"
          value={stats.totalDebt}
          subtitle="متبقي على الزبائن"
          hideValue={hideFinances}
          onClick={() => onNavigate('credits')}
          icon={<span>💳</span>}
        />

        {/* 7. رواتب ومستحقات العمال */}
        <StatCard
          title="رواتب ومسحوبات العمال"
          value={currentStaffPayouts}
          subtitle={financePeriod === 'monthly' ? 'هذا الشهر' : financePeriod === 'yearly' ? 'هذه السنة' : 'الإجمالي'}
          hideValue={hideFinances}
          onClick={() => onNavigate('customers')}
          icon={<span>👥</span>}
        />

        {/* 8. صافي الأرباح الكلية */}
        <StatCard
          title="صافي الأرباح الصافية"
          value={currentNetProfit}
          subtitle="بعد كل التكاليف"
          hideValue={hideFinances}
          onClick={() => onNavigate('dashboard')}
          icon={<span>📈</span>}
        />
      </div>

      {/* Urgent Returns Alert Banner */}
      {urgentRentals.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="font-black text-amber-950 text-sm">
                  تنبيهات إرجاع الملابس والمواعيد العاجلة ({urgentRentals.length})
                </h3>
                <p className="text-xs text-amber-800">
                  قطع ملابس يجب استرجاعها اليوم أو متأخرة عن الموعد المحدد.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('rentals')}
              className="text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-xl transition-all"
            >
              عرض قسم الكراء ←
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {urgentRentals.map(rental => {
              const diff = calculateDaysDiff(rental.expectedReturnDate);
              const isOverdue = diff < 0;
              const cloth = clothes.find(c => c.id === rental.itemId);

              return (
                <div key={rental.id} className="bg-white p-3.5 rounded-2xl border border-amber-200 flex justify-between items-center text-xs gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {cloth?.imageUrl ? (
                      <img src={cloth.imageUrl} alt={rental.itemName} className="w-10 h-10 rounded-xl object-cover border border-amber-200 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-amber-100/60 text-amber-700 flex items-center justify-center text-base shrink-0">👗</div>
                    )}
                    <div className="min-w-0">
                      <div className="font-black text-slate-800 truncate">{rental.itemName}</div>
                      <div className="text-slate-500 text-[11px] font-bold truncate">
                        {rental.customerName} (📞 {rental.customerPhone})
                      </div>
                      <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                        {isOverdue ? `متأخر بـ ${Math.abs(diff)} أيام عن الموعد` : 'موعد الإرجاع اليوم!'}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => onOpenReturnModal(rental)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-xs"
                    >
                      استرجاع
                    </button>
                    <button
                      onClick={() => onSendMessage(rental)}
                      className="bg-emerald-50 text-emerald-700 p-1.5 rounded-xl text-xs font-bold hover:bg-emerald-100"
                    >
                      واتساب
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Urgent Tailoring Orders Alert Banner (Within 10 Days) */}
      {urgentTailoringOrders.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-300 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧵</span>
              <div>
                <h3 className="font-black text-amber-950 text-sm">
                  تنبيهات تسليم طلبات الخياطة والصيانة ({urgentTailoringOrders.length})
                </h3>
                <p className="text-xs text-amber-800">
                  طلبات خياطة موعد تسليمها يقترب خلال 10 أيام أو اليوم.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('tailoring')}
              className="text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-xl transition-all"
            >
              عرض قسم الخياطة ←
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {urgentTailoringOrders.map(order => {
              const diff = calculateDaysDiff(order.expectedDeliveryDate);
              const isOverdue = diff < 0;

              return (
                <div key={order.id} className="bg-white p-3 rounded-2xl border border-amber-200 flex justify-between items-center text-xs gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-800">{order.orderNumber}</span>
                      <span className="font-black text-slate-900 truncate">• {order.itemName}</span>
                    </div>
                    <div className="text-slate-500 text-[11px] font-medium mt-0.5 truncate">
                      {order.customerName ? `الزبونة: ${order.customerName}` : 'مخزن المحل'}
                      {order.tailorName && ` | الخياطة: ${order.tailorName}`}
                    </div>
                    <div className="text-[11px] text-amber-800 font-bold mt-1">
                      {isOverdue ? `متأخر بـ ${Math.abs(diff)} يوم!` : diff === 0 ? 'موعد التسليم اليوم!' : `موعد التسليم: ${order.expectedDeliveryDate} (متبقي ${diff} أيام)`}
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate('tailoring')}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all"
                  >
                    متابعة
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Rentals Summary Table */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <span>القطع المؤجرة حالياً في المحل</span>
            <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-lg font-bold">
              {activeRentals.length}
            </span>
          </h3>
          <button
            onClick={() => onNavigate('rentals')}
            className="text-xs font-bold text-rose-600 hover:text-rose-700"
          >
            عرض الكل ←
          </button>
        </div>

        {activeRentals.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">لا توجد أي قطع ملابس مؤجرة حالياً.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeRentals.slice(0, 5).map(rental => {
              const cloth = clothes.find(c => c.id === rental.itemId);
              return (
                <div key={rental.id} className="py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {cloth?.imageUrl ? (
                      <img src={cloth.imageUrl} alt={rental.itemName} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-base shrink-0">👗</div>
                    )}
                    <div className="min-w-0">
                      <div className="font-black text-slate-800 text-sm sm:text-xs truncate">{rental.itemName}</div>
                      <div className="text-slate-500 text-[11px] font-medium mt-0.5 truncate">
                        الزبون: <span className="font-bold text-slate-700">{rental.customerName}</span> • المقاس: {rental.itemSize} ({rental.itemColor})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
                    <div className="text-right sm:text-left">
                      <div className="font-bold text-rose-700 text-xs">موعد الإرجاع: {rental.expectedReturnDate}</div>
                      <div className="text-[10px] text-slate-400 font-medium">العربون: {(rental.cautionAmount || 0).toLocaleString()} دج</div>
                    </div>
                    <button
                      onClick={() => onOpenReturnModal(rental)}
                      className="bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 px-3.5 py-1.5 rounded-xl font-black transition-all text-xs"
                    >
                      استرجاع
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
