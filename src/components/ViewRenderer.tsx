import React, { memo } from 'react';
import { perfMonitor } from '../utils/performanceMonitor';
import {
  ViewType,
  Rental,
  ClothItem,
  DailyCaisseClosure,
  Sale,
  Expense,
  StaffPayout,
  Credit,
  MaintenanceOrder,
  Supplier,
  Seamstress,
  RawMaterial,
  MaintenanceStatus,
  ActivityLog,
} from '../types';

// Lazy-loaded Views for optimal code splitting & bundle performance
const DashboardView = React.lazy(() => import('./DashboardView').then(m => ({ default: m.DashboardView })));
const RentalsView = React.lazy(() => import('./RentalsView').then(m => ({ default: m.RentalsView })));
const InventoryView = React.lazy(() => import('./InventoryView').then(m => ({ default: m.InventoryView })));
const SalesPOSView = React.lazy(() => import('./SalesPOSView').then(m => ({ default: m.SalesPOSView })));
const TailoringView = React.lazy(() => import('./TailoringView').then(m => ({ default: m.TailoringView })));
const ExpensesView = React.lazy(() => import('./ExpensesView').then(m => ({ default: m.ExpensesView })));
const CreditsView = React.lazy(() => import('./CreditsView').then(m => ({ default: m.CreditsView })));
const CaisseView = React.lazy(() => import('./CaisseView').then(m => ({ default: m.CaisseView })));
const PartnersView = React.lazy(() => import('./PartnersView').then(m => ({ default: m.PartnersView })));
const LogsView = React.lazy(() => import('./LogsView').then(m => ({ default: m.LogsView })));

export interface ViewRendererProps {
  currentView: ViewType;
  // Shared state
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
  hideFinances: boolean;
  posScannedBarcode: string | null;

  // Handlers
  onPrivacyToggle: () => void;
  onNavigate: (view: ViewType) => void;
  onOpenAddRental: () => void;
  onOpenReturnModal: (rental: Rental) => void;
  onSendMessage: (rental: Rental) => void;
  onOpenStaffPayoutsModal?: () => void;
  onOpenFullReportModal?: () => void;
  onDeleteLog?: (id: string, passwordVerified: boolean) => void;
  onClearAllLogs?: (passwordVerified: boolean) => void;
  onAddManualLog?: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;

  // RentalsView handlers
  onAddRentalWithItem: (itemId?: string) => void;
  onEditRentalModal: (rental: Rental) => void;
  onDeleteRental: (id: string) => void;
  onActivateRental: (rental: Rental, collectedAmount?: number, handoverNotes?: string) => void;
  onOpenReceiptModal: (rental: Rental) => void;
  onScanBarcode: () => void;

  // InventoryView handlers
  onAddCloth: (data: any) => void;
  onUpdateCloth: (id: string, data: any) => void;
  onDeleteCloth: (id: string) => void;
  onAddRawMaterial: (mat: RawMaterial) => void;
  onUpdateRawMaterial: (id: string, data: Partial<RawMaterial>) => void;
  onDeleteRawMaterial: (id: string) => void;

  // SalesPOSView handlers
  onCompleteSale: (data: any) => void;
  onDeleteSale: (sale: Sale) => void;
  onClearPosScannedBarcode: () => void;

  // TailoringView handlers
  onOpenAddTailoringModal: () => void;
  onEditTailoringModal: (order: MaintenanceOrder) => void;
  onDeleteTailoringOrder: (id: string) => void;
  onUpdateTailoringStatus: (id: string, status: MaintenanceStatus) => void;
  onOpenTailoringReceiptModal: (order: MaintenanceOrder) => void;

  // ExpensesView & PartnersView handlers
  onAddExpense: (expData: any) => void;
  onDeleteExpense: (id: string) => void;
  onSettleSupplierCredit: (expenseId: string, paidNow: number) => void;
  onAddSupplier: (newSup: Supplier) => void;
  onUpdateSupplier: (id: string, data: Partial<Supplier>) => void;
  onDeleteSupplier: (id: string) => void;

  // CreditsView handlers
  onAddCredit: (credData: any) => void;
  onSettleCredit: (id: string) => void;
  onDeleteCredit: (id: string) => void;

  // CaisseView handlers
  onSaveCaisseClosure: (closure: DailyCaisseClosure) => void;
  onDeleteCaisseClosure: (id: string) => void;

  // PartnersView seamstress handlers
  onAddSeamstress: (seam: Seamstress) => void;
  onUpdateSeamstress: (id: string, data: Partial<Seamstress>) => void;
  onDeleteSeamstress: (id: string) => void;
}

export const ViewRenderer: React.FC<ViewRendererProps> = memo(({
  currentView,
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
  activityLogs = [],
  hideFinances,
  posScannedBarcode,
  onPrivacyToggle,
  onNavigate,
  onOpenAddRental,
  onOpenReturnModal,
  onSendMessage,
  onOpenStaffPayoutsModal,
  onOpenFullReportModal,
  onDeleteLog,
  onClearAllLogs,
  onAddManualLog,
  onAddRentalWithItem,
  onEditRentalModal,
  onDeleteRental,
  onActivateRental,
  onOpenReceiptModal,
  onScanBarcode,
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
}) => {
  perfMonitor.recordViewRender(currentView);

  return (
    <React.Suspense fallback={<div className="p-8 text-center text-slate-500 font-bold">جاري تحميل القسم...</div>}>
      {currentView === 'dashboard' && (
        <DashboardView
          rentals={rentals}
          maintenanceOrders={maintenanceOrders}
          clothes={clothes}
          caisseClosures={caisseClosures}
          sales={sales}
          expenses={expenses}
          staffPayouts={staffPayouts}
          activityLogs={activityLogs}
          hideFinances={hideFinances}
          onPrivacyToggle={onPrivacyToggle}
          onNavigate={onNavigate}
          onOpenAddRental={onOpenAddRental}
          onOpenReturnModal={onOpenReturnModal}
          onSendMessage={onSendMessage}
          onOpenStaffPayoutsModal={onOpenStaffPayoutsModal}
          onOpenFullReportModal={onOpenFullReportModal}
          onDeleteLog={onDeleteLog}
          onClearAllLogs={onClearAllLogs}
          onAddManualLog={onAddManualLog}
        />
      )}

      {currentView === 'rentals' && (
        <RentalsView
          rentals={rentals}
          clothes={clothes}
          onAddRental={onAddRentalWithItem}
          onEditRental={onEditRentalModal}
          onDeleteRental={onDeleteRental}
          onActivateRental={onActivateRental}
          onOpenReturnModal={onOpenReturnModal}
          onOpenReceiptModal={onOpenReceiptModal}
          onSendMessage={onSendMessage}
          onScanBarcode={onScanBarcode}
        />
      )}

      {currentView === 'inventory' && (
        <InventoryView
          clothes={clothes}
          rawMaterials={rawMaterials}
          suppliers={suppliers}
          onAddCloth={onAddCloth}
          onUpdateCloth={onUpdateCloth}
          onDeleteCloth={onDeleteCloth}
          onAddRawMaterial={onAddRawMaterial}
          onUpdateRawMaterial={onUpdateRawMaterial}
          onDeleteRawMaterial={onDeleteRawMaterial}
          onScanBarcode={onScanBarcode}
        />
      )}

      {currentView === 'sales' && (
        <SalesPOSView
          clothes={clothes}
          sales={sales}
          onCompleteSale={onCompleteSale}
          onDeleteSale={onDeleteSale}
          onScanBarcode={onScanBarcode}
          scannedCode={posScannedBarcode}
          onClearScannedCode={onClearPosScannedBarcode}
        />
      )}

      {currentView === 'tailoring' && (
        <TailoringView
          orders={maintenanceOrders}
          clothes={clothes}
          onOpenAddModal={onOpenAddTailoringModal}
          onEditOrder={onEditTailoringModal}
          onDeleteOrder={onDeleteTailoringOrder}
          onUpdateStatus={onUpdateTailoringStatus}
          onOpenReceiptModal={onOpenTailoringReceiptModal}
        />
      )}

      {currentView === 'expenses' && (
        <ExpensesView
          expenses={expenses}
          suppliers={suppliers}
          credits={credits}
          onAddExpense={onAddExpense}
          onDeleteExpense={onDeleteExpense}
          onSettleSupplierCredit={onSettleSupplierCredit}
          onAddSupplier={onAddSupplier}
        />
      )}

      {currentView === 'credits' && (
        <CreditsView
          credits={credits}
          suppliers={suppliers}
          onAddCredit={onAddCredit}
          onSettleCredit={onSettleCredit}
          onDeleteCredit={onDeleteCredit}
        />
      )}

      {currentView === 'caisse' && (
        <CaisseView
          sales={sales}
          rentals={rentals}
          expenses={expenses}
          staffPayouts={staffPayouts}
          maintenanceOrders={maintenanceOrders}
          caisseClosures={caisseClosures}
          onSaveClosure={onSaveCaisseClosure}
          onDeleteClosure={onDeleteCaisseClosure}
          hideFinances={hideFinances}
          onPrivacyToggle={onPrivacyToggle}
        />
      )}

      {currentView === 'partners' && (
        <PartnersView
          suppliers={suppliers}
          seamstresses={seamstresses}
          expenses={expenses}
          maintenanceOrders={maintenanceOrders}
          credits={credits}
          onAddSupplier={onAddSupplier}
          onUpdateSupplier={onUpdateSupplier}
          onDeleteSupplier={onDeleteSupplier}
          onAddSeamstress={onAddSeamstress}
          onUpdateSeamstress={onUpdateSeamstress}
          onDeleteSeamstress={onDeleteSeamstress}
          onSettleSupplierCredit={onSettleSupplierCredit}
        />
      )}

      {currentView === 'logs' && (
        <LogsView
          logs={activityLogs}
          onDeleteLog={onDeleteLog}
          onClearAllLogs={onClearAllLogs}
          onAddManualLog={onAddManualLog}
          showToast={(msg, type) => {
            // LogsView provides toast notifications
          }}
        />
      )}
    </React.Suspense>
  );
});

export default ViewRenderer;
