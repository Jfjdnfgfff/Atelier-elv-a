import React, { useState, useCallback, memo } from 'react';
import { 
  ViewType, 
  Rental, 
  ClothItem, 
  Sale, 
  Expense, 
  Credit, 
  StaffPayout, 
  MaintenanceOrder, 
  DailyCaisseClosure, 
  Supplier, 
  Seamstress, 
  RawMaterial, 
  MaintenanceStatus,
  ActivityLog
} from '../types';
import { NavButton } from './Shared';
import { ViewRenderer } from './ViewRenderer';
import { Scale, Plus } from 'lucide-react';
import { perfMonitor } from '../utils/performanceMonitor';

export interface AppNavigationProps {
  onInitNav?: (navFn: (view: ViewType) => void, getViewFn: () => ViewType) => void;
  onEnsureCollection?: (view: ViewType) => void;

  // Counts for badges
  overdueCount: number;
  activeMaintenanceCount: number;
  pendingAbsencesCount: number;

  // Header quick actions
  openBarcodeScan: () => void;
  hideFinances: boolean;
  toggleFinances: () => void;
  openFullReportModal: () => void;
  openAddRentalModal: () => void;
  openStaffPayoutsModal: () => void;

  // ViewRenderer props
  rentals: Rental[];
  clothes: ClothItem[];
  sales: Sale[];
  expenses: Expense[];
  credits: Credit[];
  staffPayouts: StaffPayout[];
  maintenanceOrders: MaintenanceOrder[];
  caisseClosures: DailyCaisseClosure[];
  suppliers: Supplier[];
  seamstresses: Seamstress[];
  rawMaterials: RawMaterial[];
  activityLogs?: ActivityLog[];
  posScannedBarcode: string | null;

  // Action Handlers
  onOpenAddRental: () => void;
  onOpenReturnModal: (rental: Rental) => void;
  onSendMessage: (rental: Rental) => void;
  onDeleteLog?: (id: string, passwordVerified: boolean) => void;
  onClearAllLogs?: (passwordVerified: boolean) => void;
  onAddManualLog?: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  onAddRentalWithItem: (itemId?: string) => void;
  onEditRentalModal: (rental: Rental) => void;
  onDeleteRental: (id: string) => void;
  onActivateRental: (rental: Rental, collectedAmount?: number, handoverNotes?: string) => void;
  onOpenReceiptModal: (rental: Rental) => void;
  onAddCloth: (data: any) => void;
  onUpdateCloth: (id: string, data: any) => void;
  onDeleteCloth: (id: string) => void;
  onAddRawMaterial: (mat: RawMaterial) => void;
  onUpdateRawMaterial: (id: string, data: Partial<RawMaterial>) => void;
  onDeleteRawMaterial: (id: string) => void;
  onCompleteSale: (data: any) => void;
  onDeleteSale: (sale: Sale) => void;
  onClearPosScannedBarcode: () => void;
  onOpenAddTailoringModal: () => void;
  onEditTailoringModal: (order: MaintenanceOrder) => void;
  onDeleteTailoringOrder: (id: string) => void;
  onUpdateTailoringStatus: (id: string, status: MaintenanceStatus) => void;
  onOpenTailoringReceiptModal: (order: MaintenanceOrder) => void;
  onAddExpense: (expData: any) => void;
  onDeleteExpense: (id: string) => void;
  onSettleSupplierCredit: (expenseId: string, paidNow: number) => void;
  onAddSupplier: (newSup: Supplier) => void;
  onUpdateSupplier: (id: string, data: Partial<Supplier>) => void;
  onDeleteSupplier: (id: string) => void;
  onAddCredit: (credData: any) => void;
  onSettleCredit: (id: string) => void;
  onDeleteCredit: (id: string) => void;
  onSaveCaisseClosure: (closure: DailyCaisseClosure) => void;
  onDeleteCaisseClosure: (id: string) => void;
  onAddSeamstress: (seam: Seamstress) => void;
  onUpdateSeamstress: (id: string, data: Partial<Seamstress>) => void;
  onDeleteSeamstress: (id: string) => void;
}

export const AppNavigation: React.FC<AppNavigationProps> = memo(({
  overdueCount,
  activeMaintenanceCount,
  pendingAbsencesCount,
  openBarcodeScan,
  hideFinances,
  toggleFinances,
  openFullReportModal,
  openAddRentalModal,
  openStaffPayoutsModal,
  rentals,
  clothes,
  sales,
  expenses,
  credits,
  staffPayouts,
  maintenanceOrders,
  caisseClosures,
  suppliers,
  seamstresses,
  rawMaterials,
  activityLogs,
  posScannedBarcode,
  onOpenAddRental,
  onOpenReturnModal,
  onSendMessage,
  onDeleteLog,
  onClearAllLogs,
  onAddManualLog,
  onAddRentalWithItem,
  onEditRentalModal,
  onDeleteRental,
  onActivateRental,
  onOpenReceiptModal,
  onAddCloth,
  onUpdateCloth,
  onDeleteCloth,
  onAddRawMaterial,
  onUpdateRawMaterial,
  onDeleteRawMaterial,
  onCompleteSale,
  onDeleteSale,
  onClearPosScannedBarcode,
  onOpenAddTailoringModal,
  onEditTailoringModal,
  onDeleteTailoringOrder,
  onUpdateTailoringStatus,
  onOpenTailoringReceiptModal,
  onAddExpense,
  onDeleteExpense,
  onSettleSupplierCredit,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onAddCredit,
  onSettleCredit,
  onDeleteCredit,
  onSaveCaisseClosure,
  onDeleteCaisseClosure,
  onAddSeamstress,
  onUpdateSeamstress,
  onDeleteSeamstress,
  onInitNav,
  onEnsureCollection,
}) => {
  perfMonitor.recordAppNavRender();

  // Navigation State isolated entirely from App.tsx
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const currentViewRef = React.useRef(currentView);
  currentViewRef.current = currentView;

  // Local navigation state only - does NOT trigger App.tsx re-renders
  const navigateTo = useCallback((view: ViewType) => {
    perfMonitor.startNavigation(currentViewRef.current, view);
    setCurrentView(view);
  }, []);

  // Ensure collection for active section is loaded on-demand
  React.useEffect(() => {
    perfMonitor.endNavigation(currentView);
    if (onEnsureCollection) {
      onEnsureCollection(currentView);
    }
  }, [currentView, onEnsureCollection]);

  React.useEffect(() => {
    if (onInitNav) {
      onInitNav(navigateTo, () => currentViewRef.current);
    }
  }, [onInitNav, navigateTo]);

  const goDashboard = useCallback(() => navigateTo('dashboard'), [navigateTo]);
  const goRentals = useCallback(() => navigateTo('rentals'), [navigateTo]);
  const goInventory = useCallback(() => navigateTo('inventory'), [navigateTo]);
  const goSales = useCallback(() => navigateTo('sales'), [navigateTo]);
  const goTailoring = useCallback(() => navigateTo('tailoring'), [navigateTo]);
  const goExpenses = useCallback(() => navigateTo('expenses'), [navigateTo]);
  const goCredits = useCallback(() => navigateTo('credits'), [navigateTo]);
  const goPartners = useCallback(() => navigateTo('partners'), [navigateTo]);
  const goCaisse = useCallback(() => navigateTo('caisse'), [navigateTo]);

  return (
    <div className="flex-1 flex flex-col w-full">
      {/* Main Top Header */}
      <header className="bg-white border-b border-blue-100 px-3 sm:px-6 py-2.5 z-20 sticky top-0 shadow-xs safe-top">
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
          {/* Top Row: Quick Tools & Actions */}
          <div className="flex items-center justify-between gap-2">
            {/* Action Tools */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={openBarcodeScan}
                title="مسح الباركود"
                aria-label="مسح الباركود"
                className="h-7 sm:h-9 px-2 sm:px-3 rounded-lg sm:rounded-xl bg-blue-50/50 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-300 border border-blue-100/70 active:scale-95 text-blue-800 flex items-center gap-1 sm:gap-1.5 transition-all text-[11px] sm:text-xs font-bold group"
              >
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 group-hover:text-blue-700 shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M3 7V5a2 2 0 012-2h2" />
                  <path d="M17 3h2a2 2 0 012 2v2" />
                  <path d="M21 17v2a2 2 0 01-2 2h-2" />
                  <path d="M7 21H5a2 2 0 01-2-2v-2" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                </svg>
                <span className="hidden sm:inline text-xs">مسح الباركود</span>
              </button>

              <button
                onClick={toggleFinances}
                title="إخفاء/إظهار المبالغ"
                aria-label="إخفاء/إظهار المبالغ"
                className={`h-7 sm:h-9 px-2 sm:px-3 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-1.5 transition-all active:scale-95 text-[11px] sm:text-xs font-bold border group ${
                  hideFinances 
                    ? 'bg-blue-900 text-white border-blue-900 hover:bg-blue-800' 
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-900'
                }`}
              >
                <svg className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 transition-colors ${hideFinances ? 'text-white' : 'text-blue-600 group-hover:text-blue-800'}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  {hideFinances ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
                <span className="hidden sm:inline text-xs">{hideFinances ? 'إظهار المبالغ' : 'إخفاء المبالغ'}</span>
              </button>

              <button 
                onClick={openFullReportModal} 
                title="التقرير المالي"
                className="h-7 sm:h-9 px-2 sm:px-3 flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-900 hover:border-blue-300 border border-blue-200 rounded-lg sm:rounded-xl transition-all shadow-2xs active:scale-95 group"
              >
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 group-hover:text-blue-800 shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span className="hidden sm:inline text-xs">التقرير الشامل</span>
              </button>

              <button 
                onClick={goCaisse} 
                title="صندوق اليومية ومتابعة العجز (La Caisse)"
                className={`h-7 sm:h-9 px-2 sm:px-3 flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all border active:scale-95 group ${
                  currentView === 'caisse'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'text-blue-700 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300 border-blue-100/70'
                }`}
              >
                <Scale className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 transition-colors ${currentView === 'caisse' ? 'text-white' : 'text-blue-600 group-hover:text-blue-700'}`} />
                <span className="hidden sm:inline text-xs">الصندوق اليومي</span>
                <span className="sm:hidden text-[10px]">الصندوق</span>
              </button>
            </div>

            {/* Primary Add Button */}
            <button
              onClick={openAddRentalModal}
              className="h-7 sm:h-9 px-2.5 sm:px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 shadow-xs shrink-0 transition-all hover:shadow-md hover:shadow-blue-500/20"
            >
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs">كراء جديد</span>
            </button>
          </div>

          {/* Bottom Row of Header: All Navigation Icons scrollable horizontally */}
          <nav className="flex items-center gap-1.5 sm:gap-2.5 w-full pt-1.5 pb-0.5 border-t border-blue-50 overflow-x-auto touch-pan-x overscroll-x-contain hide-scrollbar scroll-smooth" aria-label="أقسام التطبيق">
            <NavButton 
              icon="dashboard" 
              label="الرئيسية" 
              onClick={goDashboard} 
              active={currentView === 'dashboard'} 
            />
            <NavButton 
              icon="rentals" 
              label="الكراء" 
              onClick={goRentals} 
              active={currentView === 'rentals'} 
              badge={overdueCount}
            />
            <NavButton 
              icon="inventory" 
              label="المخزون" 
              onClick={goInventory} 
              active={currentView === 'inventory'} 
            />
            <NavButton 
              icon="sales" 
              label="المبيعات" 
              onClick={goSales} 
              active={currentView === 'sales'} 
            />
            <NavButton 
              icon="tailoring" 
              label="الخياطة" 
              onClick={goTailoring} 
              active={currentView === 'tailoring'} 
              badge={activeMaintenanceCount}
            />
            <NavButton 
              icon="expenses" 
              label="المصاريف" 
              onClick={goExpenses} 
              active={currentView === 'expenses'} 
            />
            <NavButton 
              icon="credits" 
              label="الكريدي" 
              onClick={goCredits} 
              active={currentView === 'credits'} 
            />
            <NavButton 
              icon="partners" 
              label="الموردين والخياطات" 
              onClick={goPartners} 
              active={currentView === 'partners'} 
            />
            <NavButton 
              icon="caisse" 
              label="الصندوق" 
              onClick={goCaisse} 
              active={currentView === 'caisse'} 
            />
            <NavButton 
              icon="staff" 
              label="العمال" 
              onClick={openStaffPayoutsModal} 
              badge={pendingAbsencesCount}
            />
          </nav>
        </div>
      </header>

      {/* Main Views Container */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 md:px-8 py-4 pb-12 overflow-y-auto">
        <ViewRenderer
          currentView={currentView}
          rentals={rentals}
          clothes={clothes}
          sales={sales}
          expenses={expenses}
          credits={credits}
          staffPayouts={staffPayouts}
          maintenanceOrders={maintenanceOrders}
          caisseClosures={caisseClosures}
          suppliers={suppliers}
          seamstresses={seamstresses}
          rawMaterials={rawMaterials}
          activityLogs={activityLogs}
          hideFinances={hideFinances}
          posScannedBarcode={posScannedBarcode}
          onPrivacyToggle={toggleFinances}
          onNavigate={navigateTo}
          onOpenAddRental={onOpenAddRental}
          onOpenReturnModal={onOpenReturnModal}
          onSendMessage={onSendMessage}
          onOpenStaffPayoutsModal={openStaffPayoutsModal}
          onOpenFullReportModal={openFullReportModal}
          onDeleteLog={onDeleteLog}
          onClearAllLogs={onClearAllLogs}
          onAddManualLog={onAddManualLog}
          onAddRentalWithItem={onAddRentalWithItem}
          onEditRentalModal={onEditRentalModal}
          onDeleteRental={onDeleteRental}
          onActivateRental={onActivateRental}
          onOpenReceiptModal={onOpenReceiptModal}
          onScanBarcode={openBarcodeScan}
          onAddCloth={onAddCloth}
          onUpdateCloth={onUpdateCloth}
          onDeleteCloth={onDeleteCloth}
          onAddRawMaterial={onAddRawMaterial}
          onUpdateRawMaterial={onUpdateRawMaterial}
          onDeleteRawMaterial={onDeleteRawMaterial}
          onCompleteSale={onCompleteSale}
          onDeleteSale={onDeleteSale}
          onClearPosScannedBarcode={onClearPosScannedBarcode}
          onOpenAddTailoringModal={onOpenAddTailoringModal}
          onEditTailoringModal={onEditTailoringModal}
          onDeleteTailoringOrder={onDeleteTailoringOrder}
          onUpdateTailoringStatus={onUpdateTailoringStatus}
          onOpenTailoringReceiptModal={onOpenTailoringReceiptModal}
          onAddExpense={onAddExpense}
          onDeleteExpense={onDeleteExpense}
          onSettleSupplierCredit={onSettleSupplierCredit}
          onAddSupplier={onAddSupplier}
          onUpdateSupplier={onUpdateSupplier}
          onDeleteSupplier={onDeleteSupplier}
          onAddCredit={onAddCredit}
          onSettleCredit={onSettleCredit}
          onDeleteCredit={onDeleteCredit}
          onSaveCaisseClosure={onSaveCaisseClosure}
          onDeleteCaisseClosure={onDeleteCaisseClosure}
          onAddSeamstress={onAddSeamstress}
          onUpdateSeamstress={onUpdateSeamstress}
          onDeleteSeamstress={onDeleteSeamstress}
        />
      </main>
    </div>
  );
});

export default AppNavigation;
