import React, { memo, useMemo } from 'react';
import { perfMonitor } from '../utils/performanceMonitor';
import { attachCreditPayments } from '../utils/fundBalance';
import {
  ViewType,
  Rental,
  ClothItem,
  DailyCaisseClosure,
  Sale,
  Expense,
  StaffPayout,
  Credit,
  CreditPayment,
  MaintenanceOrder,
  Supplier,
  Seamstress,
  RawMaterial,
  MaintenanceStatus,
  ActivityLog,
  FundSource,
} from '../types';

// الأقسام تُحمَّل كحزم منفصلة (Code Splitting) — الحزمة الرئيسية لا تحمل أي قسم غير مفتوح
// + تمييز مسبق عند نيّة المستخدم (hover/touch) عبر viewRegistry.preloadView للحفاظ على فورية التنقّل
import { LazyViews } from './viewRegistry';

const DashboardView = LazyViews.dashboard;
const RentalsView = LazyViews.rentals;
const InventoryView = LazyViews.inventory;
const SalesPOSView = LazyViews.sales;
const TailoringView = LazyViews.tailoring;
const ExpensesView = LazyViews.expenses;
const CreditsView = LazyViews.credits;
const CaisseView = LazyViews.caisse;
const PartnersView = LazyViews.partners;
const LogsView = LazyViews.logs;

/** هيكل انتظار خفيف (بدون صور/خطوط) يظهر فقط أثناء تنزيل حزمة القسم لأول مرة */
const ViewSkeleton: React.FC = () => (
  <div className="space-y-3" dir="rtl" aria-busy="true" aria-label="جارٍ تحميل القسم">
    <div className="h-7 w-40 bg-slate-200/70 rounded-xl animate-pulse" />
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 bg-white border border-slate-200/80 rounded-2xl animate-pulse"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
    <div className="h-64 bg-white border border-slate-200/80 rounded-2xl animate-pulse" />
  </div>
);

export interface ViewRendererProps {
  currentView: ViewType;
  // Shared state
  rentals: Rental[];
  clothes: ClothItem[];
  sales: Sale[];
  expenses: Expense[];
  credits: Credit[];
  creditPayments: CreditPayment[];
  staffPayouts: StaffPayout[];
  maintenanceOrders: MaintenanceOrder[];
  caisseClosures: DailyCaisseClosure[];
  suppliers: Supplier[];
  seamstresses: Seamstress[];
  rawMaterials: RawMaterial[];
  activityLogs?: ActivityLog[];
  hideFinances: boolean;
  generalFundBalance: number;
  posScannedBarcode: string | null;
  hasMoreClothes: boolean;
  isLoadingMoreClothes: boolean;
  onLoadMoreClothes: () => Promise<void>;
  hasMoreSales: boolean;
  isLoadingMoreSales: boolean;
  onLoadMoreSales: () => Promise<void>;

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
  onSettleCredit: (creditId: string, payment: { amount: number; date: string; fundSource: FundSource; note?: string }) => void;
  onDeleteCredit: (id: string) => void;

  // CaisseView handlers
  onSaveCaisseClosure: (closure: DailyCaisseClosure) => void;
  onDeleteCaisseClosure: (id: string) => void;
  onSetGeneralFundBalance: (value: number) => void;
  onFeedGeneralFund: (amount: number) => void;
  onDeleteStaffPayout?: (id: string) => void;

  // PartnersView seamstress handlers
  onAddSeamstress: (seam: Seamstress) => void;
  onUpdateSeamstress: (id: string, data: Partial<Seamstress>) => void;
  onDeleteSeamstress: (id: string) => void;
}

function areViewRendererPropsEqual(prev: ViewRendererProps, next: ViewRendererProps): boolean {
  if (prev.currentView !== next.currentView) return false;
  if (prev.hideFinances !== next.hideFinances) return false;

  switch (next.currentView) {
    case 'inventory':
      return prev.clothes === next.clothes &&
             prev.rawMaterials === next.rawMaterials &&
             prev.suppliers === next.suppliers &&
             prev.hasMoreClothes === next.hasMoreClothes &&
             prev.isLoadingMoreClothes === next.isLoadingMoreClothes;
    case 'rentals':
      return prev.rentals === next.rentals && 
             prev.clothes === next.clothes;
    case 'sales':
      return prev.sales === next.sales &&
             prev.clothes === next.clothes &&
             prev.posScannedBarcode === next.posScannedBarcode &&
             prev.hasMoreClothes === next.hasMoreClothes &&
             prev.isLoadingMoreClothes === next.isLoadingMoreClothes &&
             prev.hasMoreSales === next.hasMoreSales &&
             prev.isLoadingMoreSales === next.isLoadingMoreSales;
    case 'tailoring':
      return prev.maintenanceOrders === next.maintenanceOrders && 
             prev.clothes === next.clothes;
    case 'expenses':
      return prev.expenses === next.expenses && 
             prev.suppliers === next.suppliers && 
             prev.credits === next.credits &&
             prev.creditPayments === next.creditPayments &&
             prev.generalFundBalance === next.generalFundBalance;
    case 'credits':
      return prev.credits === next.credits && 
             prev.creditPayments === next.creditPayments &&
             prev.suppliers === next.suppliers &&
             prev.generalFundBalance === next.generalFundBalance;
    case 'partners':
      return prev.suppliers === next.suppliers && 
             prev.seamstresses === next.seamstresses && 
             prev.expenses === next.expenses && 
             prev.maintenanceOrders === next.maintenanceOrders && 
             prev.credits === next.credits;
    case 'caisse':
      return prev.caisseClosures === next.caisseClosures && 
             prev.sales === next.sales && 
             prev.rentals === next.rentals && 
             prev.expenses === next.expenses && 
             prev.staffPayouts === next.staffPayouts && 
             prev.maintenanceOrders === next.maintenanceOrders &&
             prev.credits === next.credits &&
             prev.creditPayments === next.creditPayments &&
             prev.generalFundBalance === next.generalFundBalance;
    case 'logs':
      return prev.activityLogs === next.activityLogs;
    case 'dashboard':
      return prev.rentals === next.rentals &&
             prev.clothes === next.clothes &&
             prev.caisseClosures === next.caisseClosures &&
             prev.sales === next.sales &&
             prev.expenses === next.expenses &&
             prev.staffPayouts === next.staffPayouts &&
             prev.maintenanceOrders === next.maintenanceOrders &&
             prev.credits === next.credits &&
             prev.creditPayments === next.creditPayments &&
             prev.activityLogs === next.activityLogs;
    default:
      return false;
  }
}

export const ViewRenderer: React.FC<ViewRendererProps> = memo(({
  currentView,
  rentals,
  clothes,
  sales,
  expenses,
  credits,
  creditPayments,
  staffPayouts,
  maintenanceOrders,
  caisseClosures,
  suppliers,
  seamstresses,
  rawMaterials,
  activityLogs = [],
  hideFinances,
  generalFundBalance,
  posScannedBarcode,
  hasMoreClothes,
  isLoadingMoreClothes,
  onLoadMoreClothes,
  hasMoreSales,
  isLoadingMoreSales,
  onLoadMoreSales,
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
  onSetGeneralFundBalance,
  onFeedGeneralFund,
  onDeleteStaffPayout,
  onAddSeamstress,
  onUpdateSeamstress,
  onDeleteSeamstress,
}) => {
  perfMonitor.recordViewRender(currentView);

  // ديون مع دفعاتها المدموجة (مستندات مجموعة الدفعات + المضمّنة القديمة)
  const creditsWithPayments = useMemo(
    () => attachCreditPayments(credits, creditPayments),
    [credits, creditPayments]
  );

  return (
    <React.Suspense fallback={<ViewSkeleton />}>
      {currentView === 'dashboard' && (
        <DashboardView
          rentals={rentals}
          maintenanceOrders={maintenanceOrders}
          clothes={clothes}
          caisseClosures={caisseClosures}
          sales={sales}
          expenses={expenses}
          staffPayouts={staffPayouts}
          credits={creditsWithPayments}
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
          hasMoreClothes={hasMoreClothes}
          isLoadingMoreClothes={isLoadingMoreClothes}
          onLoadMoreClothes={onLoadMoreClothes}
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
          hasMoreClothes={hasMoreClothes}
          isLoadingMoreClothes={isLoadingMoreClothes}
          onLoadMoreClothes={onLoadMoreClothes}
          hasMoreSales={hasMoreSales}
          isLoadingMoreSales={isLoadingMoreSales}
          onLoadMoreSales={onLoadMoreSales}
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
          credits={creditsWithPayments}
          onAddExpense={onAddExpense}
          onDeleteExpense={onDeleteExpense}
          onSettleSupplierCredit={onSettleSupplierCredit}
          onAddSupplier={onAddSupplier}
          generalFundBalance={generalFundBalance}
        />
      )}

      {currentView === 'credits' && (
        <CreditsView
          credits={creditsWithPayments}
          suppliers={suppliers}
          onAddCredit={onAddCredit}
          onSettleCredit={onSettleCredit}
          onDeleteCredit={onDeleteCredit}
          generalFundBalance={generalFundBalance}
        />
      )}

      {currentView === 'caisse' && (
        <CaisseView
          sales={sales}
          rentals={rentals}
          expenses={expenses}
          credits={creditsWithPayments}
          staffPayouts={staffPayouts}
          maintenanceOrders={maintenanceOrders}
          caisseClosures={caisseClosures}
          onSaveClosure={onSaveCaisseClosure}
          onDeleteClosure={onDeleteCaisseClosure}
          onDeleteSale={onDeleteSale}
          onDeleteRental={onDeleteRental}
          onDeleteExpense={onDeleteExpense}
          onDeleteStaffPayout={onDeleteStaffPayout}
          onDeleteTailoringOrder={onDeleteTailoringOrder}
          hideFinances={hideFinances}
          onPrivacyToggle={onPrivacyToggle}
          generalFundBalance={generalFundBalance}
          onSetGeneralFundBalance={onSetGeneralFundBalance}
          onFeedGeneralFund={onFeedGeneralFund}
        />
      )}

      {currentView === 'partners' && (
        <PartnersView
          suppliers={suppliers}
          seamstresses={seamstresses}
          expenses={expenses}
          maintenanceOrders={maintenanceOrders}
          credits={creditsWithPayments}
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
          showToast={() => {}}
        />
      )}
    </React.Suspense>
  );
}, areViewRendererPropsEqual);

export default ViewRenderer;
