import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ClothItem, 
  Rental, 
  Sale, 
  Expense, 
  Credit, 
  StaffPayout, 
  StaffMember,
  StaffAbsence,
  MaintenanceOrder,
  MaintenanceStatus,
  Supplier,
  ViewType,
  DailyCaisseClosure,
  RawMaterial,
  Seamstress,
  ActivityLog,
  ActivityActionType,
  ActivityCategory
} from './types';
import { 
  loadFromStorage, 
  saveToStorage, 
  generateId, 
  STORAGE_KEYS, 
  DEFAULT_STAFF,
  DEFAULT_SUPPLIERS,
  DEFAULT_MAINTENANCE,
  DEFAULT_CAISSE_CLOSURES,
  DEFAULT_RAW_MATERIALS,
  DEFAULT_SEAMSTRESSES,
  DEFAULT_ACTIVITY_LOGS,
  initializeStorage 
} from './storage';
import { 
  syncCollectionToCloud, 
  saveCollectionToFirebase,
  saveItemToFirebase,
  updateItemInFirebase,
  deleteItemFromFirebase,
  subscribeToCloudCollection, 
  FIREBASE_COLLECTIONS,
  firebaseConfig,
  onSyncStatusChange,
  SyncStatus,
  SubscribeQueryOptions
} from './firebase';

// Shared Components
import { NavButton, Modal } from './components/Shared';

// Lazy Loaded Components for high speed code-splitting and instant initial load
const DashboardView = React.lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const RentalsView = React.lazy(() => import('./components/RentalsView').then(m => ({ default: m.RentalsView })));
const InventoryView = React.lazy(() => import('./components/InventoryView').then(m => ({ default: m.InventoryView })));
const SalesPOSView = React.lazy(() => import('./components/SalesPOSView').then(m => ({ default: m.SalesPOSView })));
const ExpensesView = React.lazy(() => import('./components/ExpensesView').then(m => ({ default: m.ExpensesView })));
const CreditsView = React.lazy(() => import('./components/CreditsView').then(m => ({ default: m.CreditsView })));
const TailoringView = React.lazy(() => import('./components/TailoringView').then(m => ({ default: m.TailoringView })));
const CaisseView = React.lazy(() => import('./components/CaisseView').then(m => ({ default: m.CaisseView })));
const PartnersView = React.lazy(() => import('./components/PartnersView').then(m => ({ default: m.PartnersView })));
const LogsView = React.lazy(() => import('./components/LogsView').then(m => ({ default: m.LogsView })));
const FullReport = React.lazy(() => import('./components/FullReport').then(m => ({ default: m.FullReport })));
const RentalModal = React.lazy(() => import('./components/RentalModal').then(m => ({ default: m.RentalModal })));
const ReturnRentalModal = React.lazy(() => import('./components/ReturnRentalModal').then(m => ({ default: m.ReturnRentalModal })));
const RentalReceiptModal = React.lazy(() => import('./components/RentalReceiptModal').then(m => ({ default: m.RentalReceiptModal })));
const TailoringModal = React.lazy(() => import('./components/TailoringModal').then(m => ({ default: m.TailoringModal })));
const TailoringReceiptModal = React.lazy(() => import('./components/TailoringReceiptModal').then(m => ({ default: m.TailoringReceiptModal })));
const StaffPayoutsModal = React.lazy(() => import('./components/StaffPayoutsModal').then(m => ({ default: m.StaffPayoutsModal })));
const BarcodeScanner = React.lazy(() => import('./components/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })));

// Lightweight Skeleton/Spinner fallback
const LoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[320px] p-8 text-center" dir="rtl">
    <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
    <p className="text-xs font-bold text-slate-500">جاري التحميل...</p>
  </div>
);
import { 
  Scale, 
  Shirt, 
  ShoppingBag, 
  Package, 
  Sparkles, 
  AlertTriangle, 
  Camera, 
  Droplets, 
  CreditCard as CreditCardIcon, 
  Users, 
  BarChart3, 
  Save, 
  Globe,
  Cloud,
  RefreshCw,
  CheckCircle2,
  Database,
  Smartphone,
  Laptop,
  History
} from 'lucide-react';

export default function App() {
  // Initialize storage
  const [clothes, setClothes] = useState<ClothItem[]>(() => {
    initializeStorage();
    return loadFromStorage<ClothItem[]>(STORAGE_KEYS.CLOTHES, []);
  });
  const [rentals, setRentals] = useState<Rental[]>(() => 
    loadFromStorage<Rental[]>(STORAGE_KEYS.RENTALS, [])
  );
  const [sales, setSales] = useState<Sale[]>(() => 
    loadFromStorage<Sale[]>(STORAGE_KEYS.SALES, [])
  );
  const [expenses, setExpenses] = useState<Expense[]>(() => 
    loadFromStorage<Expense[]>(STORAGE_KEYS.EXPENSES, [])
  );
  const [credits, setCredits] = useState<Credit[]>(() => 
    loadFromStorage<Credit[]>(STORAGE_KEYS.CREDITS, [])
  );
  const [staffPayouts, setStaffPayouts] = useState<StaffPayout[]>(() => 
    loadFromStorage<StaffPayout[]>(STORAGE_KEYS.STAFF_PAYOUTS, [])
  );
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => 
    loadFromStorage<StaffMember[]>(STORAGE_KEYS.STAFF_MEMBERS, DEFAULT_STAFF)
  );
  const [staffAbsences, setStaffAbsences] = useState<StaffAbsence[]>(() => 
    loadFromStorage<StaffAbsence[]>(STORAGE_KEYS.STAFF_ABSENCES, [])
  );
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>(() => 
    loadFromStorage<MaintenanceOrder[]>(STORAGE_KEYS.MAINTENANCE, DEFAULT_MAINTENANCE)
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => 
    loadFromStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, DEFAULT_SUPPLIERS)
  );
  const [seamstresses, setSeamstresses] = useState<Seamstress[]>(() => 
    loadFromStorage<Seamstress[]>(STORAGE_KEYS.SEAMSTRESSES, DEFAULT_SEAMSTRESSES)
  );
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(() => 
    loadFromStorage<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, DEFAULT_RAW_MATERIALS)
  );
  const [caisseClosures, setCaisseClosures] = useState<DailyCaisseClosure[]>(() => 
    loadFromStorage<DailyCaisseClosure[]>(STORAGE_KEYS.CAISSE_CLOSURES, DEFAULT_CAISSE_CLOSURES)
  );
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => 
    loadFromStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, DEFAULT_ACTIVITY_LOGS)
  );

  // UI view state
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  // Cloud Real-time Synchronization state
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<Date>(new Date());
  const isRemoteUpdateRef = useRef<Record<string, boolean>>({
    clothes: false,
    rentals: false,
    sales: false,
    expenses: false,
    credits: false,
    staffPayouts: false,
    staffMembers: false,
    staffAbsences: false,
    maintenanceOrders: false,
    suppliers: false,
    seamstresses: false,
    rawMaterials: false,
    caisseClosures: false,
    activityLogs: false
  });

  // Ref to skip redundant saveToStorage during initial component mount
  const hasMountedRef = useRef(false);
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  // View-Driven On-Demand Real-time Cloud Subscriptions
  // Loads and monitors ONLY the collections required for the active screen
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const sub = <T extends { id?: string }>(
      collectionKey: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      storageKey: string,
      refKey: string,
      options?: SubscribeQueryOptions
    ) => {
      const unsub = subscribeToCloudCollection<T>(collectionKey, (items) => {
        if (items && Array.isArray(items)) {
          isRemoteUpdateRef.current[refKey] = true;
          setter(items);
          saveToStorage(storageKey, items, false);
          setLastCloudSyncTime(new Date());
        }
      }, options);
      unsubs.push(unsub);
    };

    // Determine what needs to be listened to for the currentView
    const needsRentals = currentView === 'dashboard' || currentView === 'rentals' || currentView === 'caisse';
    const needsSales = currentView === 'dashboard' || currentView === 'sales' || currentView === 'caisse';
    const needsExpenses = currentView === 'dashboard' || currentView === 'expenses' || currentView === 'caisse';
    const needsCredits = currentView === 'dashboard' || currentView === 'credits';
    const needsStaffPayouts = currentView === 'dashboard' || currentView === 'staff' || currentView === 'caisse';
    const needsMaintenance = currentView === 'dashboard' || currentView === 'tailoring';

    const needsClothes = currentView === 'inventory' || currentView === 'sales' || currentView === 'rentals';
    const needsRawMaterials = currentView === 'inventory' || currentView === 'partners';
    const needsSuppliers = currentView === 'partners';
    const needsSeamstresses = currentView === 'partners';
    const needsStaffMembers = currentView === 'staff';
    const needsStaffAbsences = currentView === 'staff';
    const needsCaisse = currentView === 'caisse';
    const needsLogs = currentView === 'logs';

    if (needsRentals) {
      sub<Rental>(FIREBASE_COLLECTIONS.RENTALS, setRentals, STORAGE_KEYS.RENTALS, 'rentals', { limit: 120 });
    }
    if (needsSales) {
      sub<Sale>(FIREBASE_COLLECTIONS.SALES, setSales, STORAGE_KEYS.SALES, 'sales', { limit: 120 });
    }
    if (needsExpenses) {
      sub<Expense>(FIREBASE_COLLECTIONS.EXPENSES, setExpenses, STORAGE_KEYS.EXPENSES, 'expenses', { limit: 120 });
    }
    if (needsCredits) {
      sub<Credit>(FIREBASE_COLLECTIONS.CREDITS, setCredits, STORAGE_KEYS.CREDITS, 'credits', { limit: 100 });
    }
    if (needsStaffPayouts) {
      sub<StaffPayout>(FIREBASE_COLLECTIONS.STAFF_PAYOUTS, setStaffPayouts, STORAGE_KEYS.STAFF_PAYOUTS, 'staffPayouts', { limit: 60 });
    }
    if (needsMaintenance) {
      sub<MaintenanceOrder>(FIREBASE_COLLECTIONS.MAINTENANCE, setMaintenanceOrders, STORAGE_KEYS.MAINTENANCE, 'maintenanceOrders', { limit: 80 });
    }
    if (needsClothes) {
      sub<ClothItem>(FIREBASE_COLLECTIONS.CLOTHES, setClothes, STORAGE_KEYS.CLOTHES, 'clothes');
    }
    if (needsRawMaterials) {
      sub<RawMaterial>(FIREBASE_COLLECTIONS.RAW_MATERIALS, setRawMaterials, STORAGE_KEYS.RAW_MATERIALS, 'rawMaterials');
    }
    if (needsSuppliers) {
      sub<Supplier>(FIREBASE_COLLECTIONS.SUPPLIERS, setSuppliers, STORAGE_KEYS.SUPPLIERS, 'suppliers');
    }
    if (needsSeamstresses) {
      sub<Seamstress>(FIREBASE_COLLECTIONS.SEAMSTRESSES, setSeamstresses, STORAGE_KEYS.SEAMSTRESSES, 'seamstresses');
    }
    if (needsStaffMembers) {
      sub<StaffMember>(FIREBASE_COLLECTIONS.STAFF_MEMBERS, setStaffMembers, STORAGE_KEYS.STAFF_MEMBERS, 'staffMembers');
    }
    if (needsStaffAbsences) {
      sub<StaffAbsence>(FIREBASE_COLLECTIONS.STAFF_ABSENCES, setStaffAbsences, STORAGE_KEYS.STAFF_ABSENCES, 'staffAbsences');
    }
    if (needsCaisse) {
      sub<DailyCaisseClosure>(FIREBASE_COLLECTIONS.CAISSE_CLOSURES, setCaisseClosures, STORAGE_KEYS.CAISSE_CLOSURES, 'caisseClosures', { limit: 30 });
    }
    if (needsLogs) {
      sub<ActivityLog>(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, setActivityLogs, STORAGE_KEYS.ACTIVITY_LOGS, 'activityLogs', { limit: 120 });
    }

    return () => {
      unsubs.forEach(fn => fn());
    };
  }, [currentView]);

  // Sync to Local Storage (guard against unnecessary mount-time serializations)
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.CLOTHES, clothes, false); }, [clothes]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.RENTALS, rentals, false); }, [rentals]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.SALES, sales, false); }, [sales]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.EXPENSES, expenses, false); }, [expenses]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.CREDITS, credits, false); }, [credits]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.STAFF_PAYOUTS, staffPayouts, false); }, [staffPayouts]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.STAFF_MEMBERS, staffMembers, false); }, [staffMembers]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.STAFF_ABSENCES, staffAbsences, false); }, [staffAbsences]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.MAINTENANCE, maintenanceOrders, false); }, [maintenanceOrders]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.SUPPLIERS, suppliers, false); }, [suppliers]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.SEAMSTRESSES, seamstresses, false); }, [seamstresses]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.RAW_MATERIALS, rawMaterials, false); }, [rawMaterials]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.CAISSE_CLOSURES, caisseClosures, false); }, [caisseClosures]);
  useEffect(() => { if (hasMountedRef.current) saveToStorage(STORAGE_KEYS.ACTIVITY_LOGS, activityLogs, false); }, [activityLogs]);

  // Central Activity Logging Helper
  const logActivity = (
    actionType: ActivityActionType,
    category: ActivityCategory,
    title: string,
    details: string,
    amount?: number,
    itemCodeOrId?: string
  ) => {
    const newLog: ActivityLog = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      actionType,
      category,
      title,
      details,
      amount,
      itemCodeOrId,
      performedBy: 'المسؤول'
    };
    setActivityLogs(prev => [newLog, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, newLog);
  };

  // Activity Log Handlers with Password Enforcement
  const handleDeleteLog = (id: string, passwordVerified: boolean) => {
    if (!passwordVerified) return;
    setActivityLogs(prev => prev.filter(l => l.id !== id));
    deleteItemFromFirebase(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, id);
  };

  const handleClearAllLogs = (passwordVerified: boolean) => {
    if (!passwordVerified) return;
    setActivityLogs([]);
    syncCollectionToCloud(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, []);
  };

  const handleAddManualLog = (logData: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    const newLog: ActivityLog = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...logData
    };
    setActivityLogs(prev => [newLog, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, newLog);
  };

  // Full Manual Cloud Sync Handler
  const handleManualFullSync = async () => {
    setIsCloudSyncing(true);
    try {
      await Promise.all([
        syncCollectionToCloud(FIREBASE_COLLECTIONS.CLOTHES, clothes),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.RENTALS, rentals),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.SALES, sales),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.EXPENSES, expenses),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.CREDITS, credits),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.STAFF_PAYOUTS, staffPayouts),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.STAFF_MEMBERS, staffMembers),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.STAFF_ABSENCES, staffAbsences),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.MAINTENANCE, maintenanceOrders),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.SUPPLIERS, suppliers),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.SEAMSTRESSES, seamstresses),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.RAW_MATERIALS, rawMaterials),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.CAISSE_CLOSURES, caisseClosures),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, activityLogs)
      ]);
      setLastCloudSyncTime(new Date());
      showToast('تمت المزامنة وحفظ جميع التعديلات في Firebase بنجاح!');
    } catch (err) {
      showToast('تعذر إتمام المزامنة السحابية', 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // UI state
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [hideFinances, setHideFinances] = useState(() => localStorage.getItem('bm_hideFinances') !== 'false');
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [posScannedBarcode, setPosScannedBarcode] = useState<string | null>(null);

  // Modal active subjects
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [selectedTailoringOrder, setSelectedTailoringOrder] = useState<MaintenanceOrder | null>(null);
  const [preselectedRentalItemId, setPreselectedRentalItemId] = useState<string | undefined>(undefined);
  const [scannedItemAction, setScannedItemAction] = useState<ClothItem | null>(null);
  const [unknownScannedCode, setUnknownScannedCode] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // Overdue count calculation (Only active handed-over rentals can be overdue; future reserved bookings do not count)
  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return rentals.filter(r => {
      if (r.status !== 'active') return false;
      const exp = new Date(r.expectedReturnDate);
      const now = new Date(today);
      return exp.getTime() < now.getTime();
    }).length;
  }, [rentals]);

  // Pending absences count for staff badge
  const pendingAbsencesCount = useMemo(() => {
    return staffAbsences.filter(a => !a.isDeducted).length;
  }, [staffAbsences]);

  // Active maintenance count
  const activeMaintenanceCount = useMemo(() => {
    return maintenanceOrders.filter(o => o.status !== 'delivered').length;
  }, [maintenanceOrders]);

  // ==========================
  // RENTAL HANDLERS
  // ==========================
  const handleAddRental = (rentalData: any) => {
    const newRental: Rental = { ...rentalData, id: generateId() };
    
    // Add rental to state and granular cloud sync
    setRentals(prev => [newRental, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.RENTALS, newRental);

    // If active, increment rented count. If reserved (future booking), DO NOT deduct stock until handover/deal finalization!
    if (newRental.status === 'active') {
      setClothes(prev => prev.map(c => {
        if (c.id === rentalData.itemId) {
          const updated = { ...c, rentedCount: (c.rentedCount || 0) + (rentalData.qty || 1) };
          updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updated.rentedCount });
          return updated;
        }
        return c;
      }));
      logActivity(
        'deal',
        'rentals',
        'تسجيل كراء فوري',
        `الزبونة: ${newRental.customerName} - الفستان: ${newRental.itemName} - السعر: ${newRental.rentPrice} دج - المدفوع: ${newRental.paidAmount} دج`,
        newRental.paidAmount || newRental.rentPrice,
        newRental.itemId
      );
      showToast('تم تسجيل الكراء الفوري بنجاح');
    } else {
      logActivity(
        'create',
        'rentals',
        'حجز فستان مستقبلي',
        `حجز للزبونة: ${newRental.customerName} - الفستان: ${newRental.itemName} - تاريخ المناسبة: ${newRental.startDate} - العربون: ${newRental.paidAmount} دج`,
        newRental.paidAmount,
        newRental.itemId
      );
      showToast('تم تسجيل حجز الفستان مستقبلاً بنجاح (سيدخل في الكراء عند إتمام الصفقة وتسليمه)');
    }

    // If remaining amount > 0, add to credits/debts
    if (rentalData.remainingAmount > 0) {
      const newCredit: Credit = {
        id: generateId(),
        name: rentalData.customerName,
        phone: rentalData.customerPhone,
        type: newRental.status === 'reserved' ? 'متبقي حجز فستان' : 'دين كراء فستان',
        desc: `${newRental.status === 'reserved' ? 'متبقي حجز' : 'متبقي كراء'}: ${rentalData.itemName}`,
        amount: rentalData.remainingAmount,
        date: new Date().toISOString(),
        relatedRentalId: newRental.id
      };
      setCredits(prev => [newCredit, ...prev]);
      saveItemToFirebase(FIREBASE_COLLECTIONS.CREDITS, newCredit);
    }

    setActiveModal(null);
  };

  const handleActivateRental = (rental: Rental, collectedAmount: number = 0, handoverNotes: string = '') => {
    const newPaid = (rental.paidAmount || 0) + (collectedAmount || 0);
    const newRemaining = Math.max(0, rental.rentPrice - newPaid);
    const todayStr = new Date().toISOString().split('T')[0];

    const rentalUpdates = {
      status: 'active' as const,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      handoverDate: todayStr,
      notes: handoverNotes ? `${rental.notes ? rental.notes + ' | ' : ''}تسليم: ${handoverNotes}` : rental.notes
    };

    // 1. Activate rental and update payments
    setRentals(prev => prev.map(r => {
      if (r.id === rental.id) {
        return { ...r, ...rentalUpdates };
      }
      return r;
    }));
    updateItemInFirebase(FIREBASE_COLLECTIONS.RENTALS, rental.id, rentalUpdates);

    // 2. DEDUCT INVENTORY: Increment rented count upon deal finalization/handover!
    setClothes(prev => prev.map(c => {
      if (c.id === rental.itemId) {
        const updated = { ...c, rentedCount: (c.rentedCount || 0) + (rental.qty || 1) };
        updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updated.rentedCount });
        return updated;
      }
      return c;
    }));

    // 3. Update or clear credit
    setCredits(prev => {
      const filtered = prev.filter(c => c.relatedRentalId !== rental.id);
      const existingCredit = prev.find(c => c.relatedRentalId === rental.id);
      if (existingCredit) {
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, existingCredit.id);
      }
      if (newRemaining > 0) {
        const updatedCredit: Credit = {
          id: generateId(),
          name: rental.customerName,
          phone: rental.customerPhone,
          type: 'دين كراء فستان',
          desc: `متبقي كراء: ${rental.itemName}`,
          amount: newRemaining,
          date: new Date().toISOString(),
          relatedRentalId: rental.id
        };
        saveItemToFirebase(FIREBASE_COLLECTIONS.CREDITS, updatedCredit);
        return [updatedCredit, ...filtered];
      }
      return filtered;
    });

    logActivity(
      'deal',
      'rentals',
      'إتمام صفقة وتسليم فستان',
      `تسليم الفستان (${rental.itemName}) للزبونة ${rental.customerName} - تحصيل دفعة إضافية: ${collectedAmount} دج`,
      collectedAmount,
      rental.itemId
    );

    showToast('تمت الصفقة وتسليم الفستان بنجاح! دخل الفستان في الكراء الجاري وتم خصمه من المخزن');
  };

  const handleUpdateRental = (id: string, updatedData: any) => {
    const prevRental = rentals.find(r => r.id === id);
    if (prevRental) {
      const wasActive = prevRental.status === 'active';
      const isNowActive = updatedData.status === 'active';
      
      if (!wasActive && isNowActive) {
        // Transitioned to active -> increment item rentedCount
        setClothes(prev => prev.map(c => {
          if (c.id === updatedData.itemId) {
            const updated = { ...c, rentedCount: (c.rentedCount || 0) + (updatedData.qty || 1) };
            updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updated.rentedCount });
            return updated;
          }
          return c;
        }));
      } else if (wasActive && !isNowActive) {
        // Transitioned from active to reserved or returned -> decrement item rentedCount
        setClothes(prev => prev.map(c => {
          if (c.id === prevRental.itemId) {
            const updated = { ...c, rentedCount: Math.max(0, (c.rentedCount || 0) - (prevRental.qty || 1)) };
            updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updated.rentedCount });
            return updated;
          }
          return c;
        }));
      }
    }

    setRentals(prev => prev.map(r => r.id === id ? { ...r, ...updatedData } : r));
    updateItemInFirebase(FIREBASE_COLLECTIONS.RENTALS, id, updatedData);

    logActivity(
      'update',
      'rentals',
      'تعديل بيانات كراء',
      `تحديث بيانات الكراء للزبونة: ${updatedData.customerName || prevRental?.customerName || ''}`,
      updatedData.paidAmount,
      updatedData.itemId
    );

    showToast('تم تحديث بيانات الكراء');
    setActiveModal(null);
  };

  const handleDeleteRental = (id: string) => {
    const target = rentals.find(r => r.id === id);
    if (!target) return;

    setConfirmDelete({
      title: target.status === 'reserved' ? 'إلغاء حجز الفستان' : 'حذف عملية الكراء',
      message: target.status === 'reserved'
        ? 'هل أنت متأكد من إلغاء وحذف حجز الفستان المستقبلي؟'
        : 'هل أنت متأكد من حذف عملية الكراء؟ سيتم استرجاع القطعة إلى المخزن.',
      onConfirm: () => {
        if (target.status === 'active' || target.status === 'overdue') {
          // Return item count to inventory only if it was active
          setClothes(prev => prev.map(c => {
            if (c.id === target.itemId) {
              const updated = { ...c, rentedCount: Math.max(0, (c.rentedCount || 0) - (target.qty || 1)) };
              updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updated.rentedCount });
              return updated;
            }
            return c;
          }));
        }
        setRentals(prev => prev.filter(r => r.id !== id));
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.RENTALS, id);

        const linkedCredit = credits.find(c => c.relatedRentalId === id);
        if (linkedCredit) {
          deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, linkedCredit.id);
        }
        setCredits(prev => prev.filter(c => c.relatedRentalId !== id));

        logActivity(
          'delete',
          'rentals',
          target.status === 'reserved' ? 'إلغاء حجز فستان' : 'حذف عملية كراء',
          `حذف كراء (${target.itemName}) للزبونة ${target.customerName}`,
          target.paidAmount,
          target.itemBarcode || target.itemId
        );

        showToast(target.status === 'reserved' ? 'تم إلغاء الحجز بنجاح' : 'تم حذف عملية الكراء بنجاح');
        setConfirmDelete(null);
      }
    });
  };

  const handleConfirmReturn = (rentalId: string, returnData: any) => {
    const target = rentals.find(r => r.id === rentalId);
    if (!target) return;

    const returnUpdates = {
      status: 'returned' as const,
      actualReturnDate: new Date().toISOString().split('T')[0],
      conditionOnReturn: returnData.condition,
      cautionStatus: returnData.cautionAction === 'refund' ? 'refunded' as const : 'deducted' as const,
      penaltyAmount: returnData.penaltyAmount,
      paidAmount: target.paidAmount + (returnData.collectedRemaining || 0),
      remainingAmount: Math.max(0, (target.remainingAmount || 0) - (returnData.collectedRemaining || 0)),
      notes: returnData.notes ? `${target.notes ? target.notes + ' | ' : ''}إرجاع: ${returnData.notes}` : target.notes
    };

    // Update rental status
    setRentals(prev => prev.map(r => {
      if (r.id === rentalId) {
        return { ...r, ...returnUpdates };
      }
      return r;
    }));
    updateItemInFirebase(FIREBASE_COLLECTIONS.RENTALS, rentalId, returnUpdates);

    // Update inventory: decrease rentedCount, add to inCleaningCount if requested
    setClothes(prev => prev.map(c => {
      if (c.id === target.itemId) {
        const updated = {
          ...c,
          rentedCount: Math.max(0, (c.rentedCount || 0) - (target.qty || 1)),
          inCleaningCount: returnData.sendToCleaning ? (c.inCleaningCount || 0) + (target.qty || 1) : (c.inCleaningCount || 0)
        };
        updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, {
          rentedCount: updated.rentedCount,
          inCleaningCount: updated.inCleaningCount
        });
        return updated;
      }
      return c;
    }));

    logActivity(
      'return',
      'rentals',
      'استرجاع فستان من الكراء',
      `استرجاع (${target.itemName}) من الزبونة ${target.customerName} - حالة القطعة: ${returnData.condition === 'good' ? 'ممتازة' : 'تحتاج تنظيف أو صيانة'} - غرامة: ${returnData.penaltyAmount || 0} دج`,
      returnData.collectedRemaining || 0,
      target.itemBarcode || target.itemId
    );

    // If penalty was deducted or caution kept as revenue/compensation
    if (returnData.penaltyAmount > 0) {
      showToast(`تم استرجاع الفستان وخصم غرامة بقيمة ${returnData.penaltyAmount} دج`);
    } else {
      showToast('تم تأكيد استرجاع الفستان وتسوية الحساب بنجاح');
    }

    // Auto clear linked credit if collected
    if (returnData.collectedRemaining > 0) {
      const linkedCredit = credits.find(c => c.relatedRentalId === rentalId);
      if (linkedCredit) {
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, linkedCredit.id);
      }
      setCredits(prev => prev.filter(c => c.relatedRentalId !== rentalId));
    }

    setActiveModal(null);
  };

  // ==========================
  // CLOTHES & INVENTORY HANDLERS
  // ==========================
  const handleAddCloth = (itemData: any) => {
    const newCloth: ClothItem = { ...itemData, id: generateId() };
    setClothes(prev => [newCloth, ...prev]);
    
    logActivity(
      'create',
      'inventory',
      'إضافة قطعة ملابس للمخزن',
      `إضافة: ${newCloth.name} (المقاس: ${newCloth.size || 'متعدد'} - اللون: ${newCloth.color || 'متعدد'} - الكمية: ${(newCloth.stock1 || 0) + (newCloth.stock2 || 0) || newCloth.stock || 1})`,
      newCloth.rentPrice,
      newCloth.barcode || newCloth.id
    );

    showToast('تمت إضافة قطعة الملابس للمخزن');
  };

  const handleUpdateCloth = (id: string, itemData: any) => {
    setClothes(prev => prev.map(c => c.id === id ? { ...c, ...itemData } : c));
    
    logActivity(
      'update',
      'inventory',
      'تعديل بيانات قطعة في المخزن',
      `تعديل: ${itemData.name || 'قطعة'} (الكمية الإجمالية: ${(itemData.stock1 || 0) + (itemData.stock2 || 0) || itemData.stock || 1})`,
      itemData.rentPrice,
      itemData.barcode || id
    );

    showToast('تم تحديث بيانات القطعة');
  };

  const handleDeleteCloth = (id: string) => {
    const targetItem = clothes.find(c => c.id === id);
    setConfirmDelete({
      title: 'حذف قطعة من المخزن',
      message: 'هل أنت متأكد من حذف هذه القطعة من المخزن؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: () => {
        setClothes(prev => prev.filter(c => c.id !== id));
        
        logActivity(
          'delete',
          'inventory',
          'حذف قطعة من المخزن',
          `حذف القطعة: ${targetItem?.name || id} نهائياً من المخزن`,
          undefined,
          targetItem?.barcode || id
        );

        showToast('تم حذف القطعة من المخزن');
        setConfirmDelete(null);
      }
    });
  };

  // ==========================
  // SALES HANDLERS
  // ==========================
  const handleCompleteSale = (saleData: any) => {
    const newSale: Sale = { ...saleData, id: generateId() };
    setSales(prev => [newSale, ...prev]);

    // Decrease inventory stock accurately from stock1 or stock2
    saleData.items.forEach((item: any) => {
      setClothes(prev => prev.map(c => {
        if (c.id === item.itemId) {
          const s1 = c.stock1 !== undefined ? c.stock1 : c.stock;
          const s2 = c.stock2 !== undefined ? c.stock2 : 0;
          let newS1 = s1;
          let newS2 = s2;

          if (item.stockSource === 'stock2') {
            newS2 = Math.max(0, s2 - item.qty);
          } else {
            newS1 = Math.max(0, s1 - item.qty);
          }

          return { 
            ...c, 
            stock1: newS1,
            stock2: newS2,
            stock: newS1 + newS2 
          };
        }
        return c;
      }));
    });

    // If debt exists, add to credits
    if (saleData.debtAmount > 0) {
      const newCredit: Credit = {
        id: generateId(),
        name: saleData.customerName,
        phone: saleData.customerPhone,
        type: 'دين شراء ملابس',
        desc: `متبقي فاتورة بيع ملابس`,
        amount: saleData.debtAmount,
        date: new Date().toISOString()
      };
      setCredits(prev => [newCredit, ...prev]);
    }

    logActivity(
      'deal',
      'sales',
      'إتمام عملية بيع (نقطة البيع)',
      `بيع ${newSale.items.length} قطع للزبون: ${newSale.customerName || 'زبون عام'} - الإجمالي: ${newSale.totalAmount} دج - المدفوع: ${newSale.paidAmount} دج`,
      newSale.paidAmount || newSale.totalAmount,
      newSale.id
    );

    showToast('تم إتمام عملية البيع بنجاح');
  };

  const handleDeleteSale = (sale: Sale) => {
    setConfirmDelete({
      title: 'إلغاء عملية البيع',
      message: 'هل تريد إلغاء عملية البيع واسترجاع القطع للمخزن؟',
      onConfirm: () => {
        setSales(prev => prev.filter(s => s.id !== sale.id));
        sale.items.forEach(item => {
          setClothes(prev => prev.map(c => {
            if (c.id === item.itemId) {
              const s1 = c.stock1 !== undefined ? c.stock1 : c.stock;
              const s2 = c.stock2 !== undefined ? c.stock2 : 0;
              let newS1 = s1;
              let newS2 = s2;

              if (item.stockSource === 'stock2') {
                newS2 = s2 + item.qty;
              } else {
                newS1 = s1 + item.qty;
              }

              return { 
                ...c, 
                stock1: newS1,
                stock2: newS2,
                stock: newS1 + newS2 
              };
            }
            return c;
          }));
        });

        logActivity(
          'delete',
          'sales',
          'إلغاء فاتورة بيع',
          `إلغاء فاتورة بيع بقيمة ${sale.totalAmount} دج واسترجاع القطع للمخزون`,
          sale.totalAmount,
          sale.id
        );

        showToast('تم إلغاء البيع واسترجاع المخزون');
        setConfirmDelete(null);
      }
    });
  };

  // ==========================
  // EXPENSES, SUPPLIERS & CREDITS
  // ==========================
  const handleAddExpense = (expData: any) => {
    const newExpId = generateId();
    const newExp: Expense = { ...expData, id: newExpId };
    setExpenses(prev => [newExp, ...prev]);

    // If this is a supplier purchase with credit/debt remaining, auto-create a credit record
    if (expData.isSupplierPurchase && expData.creditAmount > 0) {
      const newCredit: Credit = {
        id: generateId(),
        name: expData.supplierName || 'مورد',
        phone: expData.supplierPhone || '',
        type: 'دين للمورد (كريدي سلعة)',
        desc: `متبقي شراء: ${expData.goodsDescription || expData.desc}`,
        amount: expData.creditAmount,
        date: expData.date || new Date().toISOString(),
        relatedExpenseId: newExpId,
        supplierDebt: true,
        supplierName: expData.supplierName,
        goodsDescription: expData.goodsDescription,
        totalInvoiceAmount: expData.totalInvoiceAmount,
        paidAmount: expData.paidAmount
      };
      setCredits(prev => [newCredit, ...prev]);

      logActivity(
        'create',
        'expenses',
        'تسجيل مشتريات مورد (سلعة)',
        `المورد: ${expData.supplierName} - السلعة: ${expData.goodsDescription || expData.desc} - المسدد: ${expData.paidAmount} دج - المتبقي دين: ${expData.creditAmount} دج`,
        expData.paidAmount,
        newExpId
      );

      showToast(`تم تسجيل مشتريات المورد (المسدد: ${expData.paidAmount?.toLocaleString()} دج + متبقي دين: ${expData.creditAmount?.toLocaleString()} دج)`);
    } else if (expData.isSupplierPurchase) {
      logActivity(
        'create',
        'expenses',
        'تسجيل مشتريات مورد كاش',
        `المورد: ${expData.supplierName} - السلعة: ${expData.goodsDescription || expData.desc} - المبلغ: ${expData.paidAmount || expData.amount} دج`,
        expData.paidAmount || expData.amount,
        newExpId
      );
      showToast(`تم تسجيل خلاص المورد بنجاح (${(expData.paidAmount || expData.amount)?.toLocaleString()} دج كاش)`);
    } else {
      logActivity(
        'create',
        'expenses',
        'تسجيل مصروف محل',
        `مصروف: ${expData.desc} - الصنف: ${expData.category || 'عام'} - المبلغ: ${expData.amount} دج`,
        expData.amount,
        newExpId
      );
      showToast('تم تسجيل المصروف بنجاح');
    }
  };

  const handleDeleteExpense = (id: string) => {
    const exp = expenses.find(e => e.id === id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    setCredits(prev => prev.filter(c => c.relatedExpenseId !== id));

    logActivity(
      'delete',
      'expenses',
      'حذف سجل مصروف',
      `حذف مصروف: ${exp?.desc || ''} بقيمة ${exp?.amount || 0} دج`,
      exp?.amount,
      id
    );

    showToast('تم حذف سجل المصروف');
  };

  const handleSettleSupplierCredit = (expenseId: string, paidNow: number) => {
    // 1. Update expense record
    setExpenses(prev => prev.map(exp => {
      if (exp.id === expenseId) {
        const currentPaid = exp.paidAmount !== undefined ? exp.paidAmount : exp.amount;
        const currentCredit = exp.creditAmount || 0;
        const newPaid = currentPaid + paidNow;
        const newCredit = Math.max(0, currentCredit - paidNow);
        return {
          ...exp,
          paidAmount: newPaid,
          amount: newPaid,
          creditAmount: newCredit
        };
      }
      return exp;
    }));

    // 2. Update or settle linked credit record
    setCredits(prev => {
      return prev.map(c => {
        if (c.relatedExpenseId === expenseId) {
          const newAmount = Math.max(0, c.amount - paidNow);
          return { ...c, amount: newAmount };
        }
        return c;
      }).filter(c => c.amount > 0);
    });

    logActivity(
      'payment',
      'partners',
      'تسديد دفعة دين لمورد',
      `تسديد مبلغ ${paidNow.toLocaleString()} دج لحساب دين سلعة لمورد`,
      paidNow,
      expenseId
    );

    showToast(`تم خلاص وتسديد مبلغ ${paidNow.toLocaleString()} دج للمورد بنجاح`);
  };

  const handleAddSupplier = (newSup: Supplier) => {
    setSuppliers(prev => {
      if (prev.some(s => s.name.trim().toLowerCase() === newSup.name.trim().toLowerCase())) return prev;
      return [newSup, ...prev];
    });
    
    logActivity(
      'create',
      'partners',
      'إضافة مورد جديد',
      `اسم المورد: ${newSup.name} - الهاتف: ${newSup.phone || 'غير مسجل'}`,
      undefined,
      newSup.id
    );

    showToast(`تمت إضافة المورد: ${newSup.name}`);
  };

  const handleUpdateSupplier = (id: string, data: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    
    logActivity(
      'update',
      'partners',
      'تحديث بيانات مورد',
      `تحديث معلومات المورد: ${data.name || id}`,
      undefined,
      id
    );

    showToast('تم تحديث بيانات المورد');
  };

  const handleDeleteSupplier = (id: string) => {
    const targetSup = suppliers.find(s => s.id === id);
    setConfirmDelete({
      title: 'حذف المورد',
      message: 'هل أنت متأكد من حذف هذا المورد؟',
      onConfirm: () => {
        setSuppliers(prev => prev.filter(s => s.id !== id));
        
        logActivity(
          'delete',
          'partners',
          'حذف مورد',
          `حذف المورد: ${targetSup?.name || id} من النظام`,
          undefined,
          id
        );

        showToast('تم حذف المورد بنجاح');
        setConfirmDelete(null);
      }
    });
  };

  // ==========================
  // SEAMSTRESSES & RAW MATERIALS HANDLERS
  // ==========================
  const handleAddSeamstress = (seam: Seamstress) => {
    setSeamstresses(prev => [seam, ...prev]);
    
    logActivity(
      'create',
      'partners',
      'إضافة خياطة جديدة',
      `اسم الخياطة: ${seam.name} - الهاتف: ${seam.phone || 'غير مسجل'}`,
      undefined,
      seam.id
    );

    showToast(`تمت إضافة الخياطة: ${seam.name}`);
  };

  const handleUpdateSeamstress = (id: string, data: Partial<Seamstress>) => {
    setSeamstresses(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    
    logActivity(
      'update',
      'partners',
      'تحديث بيانات خياطة',
      `تحديث معلومات الخياطة: ${data.name || id}`,
      undefined,
      id
    );

    showToast('تم تحديث بيانات الخياطة');
  };

  const handleDeleteSeamstress = (id: string) => {
    const seam = seamstresses.find(s => s.id === id);
    setConfirmDelete({
      title: 'حذف الخياطة',
      message: 'هل تريد حذف هذه الخياطة من النظام؟',
      onConfirm: () => {
        setSeamstresses(prev => prev.filter(s => s.id !== id));
        
        logActivity(
          'delete',
          'partners',
          'حذف خياطة',
          `حذف الخياطة: ${seam?.name || id} من النظام`,
          undefined,
          id
        );

        showToast('تم حذف الخياطة');
        setConfirmDelete(null);
      }
    });
  };

  const handleAddRawMaterial = (mat: RawMaterial) => {
    setRawMaterials(prev => [mat, ...prev]);
    
    logActivity(
      'create',
      'inventory',
      'إضافة قماش / سلعة أولية',
      `إضافة: ${mat.name} - الإجمالي: ${mat.totalMeters} متر (${mat.rollCount || 0} رولو) - سعر المتر: ${mat.costPerMeter} دج`,
      mat.totalCostValue || (mat.costPerMeter * mat.totalMeters),
      mat.id
    );

    showToast(`تمت إضافة القماش / السلعة: ${mat.name}`);
  };

  const handleUpdateRawMaterial = (id: string, data: Partial<RawMaterial>) => {
    setRawMaterials(prev => prev.map(m => m.id === id ? { ...m, ...data, updatedAt: new Date().toISOString() } : m));
    
    logActivity(
      'update',
      'inventory',
      'تحديث قماش / سلعة أولية',
      `تحديث بيانات القماش: ${data.name || id}`,
      undefined,
      id
    );

    showToast('تم تحديث بيانات القماش');
  };

  const handleDeleteRawMaterial = (id: string) => {
    const mat = rawMaterials.find(m => m.id === id);
    setConfirmDelete({
      title: 'حذف السلعة الأولية أو القماش',
      message: 'هل أنت متأكد من حذف هذا القماش من سجل المخزن؟',
      onConfirm: () => {
        setRawMaterials(prev => prev.filter(m => m.id !== id));
        
        logActivity(
          'delete',
          'inventory',
          'حذف قماش / سلعة أولية',
          `حذف القماش: ${mat?.name || id} من المخزن`,
          undefined,
          id
        );

        showToast('تم حذف القماش بنجاح');
        setConfirmDelete(null);
      }
    });
  };

  const handleAddCredit = (credData: any) => {
    const newCred: Credit = { ...credData, id: generateId() };
    setCredits(prev => [newCred, ...prev]);

    logActivity(
      'create',
      'credits',
      credData.supplierDebt ? 'تسجيل دين لمورد' : 'تسجيل دين على زبون',
      `الطرف: ${credData.name} - البيان: ${credData.desc} - المبلغ: ${credData.amount} دج`,
      credData.amount,
      newCred.id
    );

    showToast(credData.supplierDebt ? 'تم تسجيل دين للمورد' : 'تم تسجيل الدين على الزبون');
  };

  const handleSettleCredit = (id: string) => {
    const cred = credits.find(c => c.id === id);
    if (cred && cred.relatedExpenseId) {
      // Also update linked expense when settled from credits view
      setExpenses(prev => prev.map(exp => {
        if (exp.id === cred.relatedExpenseId) {
          const currentPaid = exp.paidAmount !== undefined ? exp.paidAmount : exp.amount;
          const newPaid = currentPaid + cred.amount;
          return {
            ...exp,
            paidAmount: newPaid,
            amount: newPaid,
            creditAmount: 0
          };
        }
        return exp;
      }));
    }
    setCredits(prev => prev.filter(c => c.id !== id));

    logActivity(
      'payment',
      'credits',
      'تسوية وتسديد دين',
      `تسوية دين: ${cred?.name || ''} - البيان: ${cred?.desc || ''} - المبلغ المسدد: ${cred?.amount || 0} دج`,
      cred?.amount,
      id
    );

    showToast('تم تسديد وتصفية الدين بنجاح');
  };

  const handleDeleteCredit = (id: string) => {
    const cred = credits.find(c => c.id === id);
    setCredits(prev => prev.filter(c => c.id !== id));

    logActivity(
      'delete',
      'credits',
      'حذف سجل دين',
      `حذف سجل دين للطرف: ${cred?.name || ''} بقيمة ${cred?.amount || 0} دج`,
      cred?.amount,
      id
    );

    showToast('تم حذف السجل');
  };

  // ==========================
  // CAISSE (CASH REGISTER) HANDLERS
  // ==========================
  const handleSaveCaisseClosure = (closure: DailyCaisseClosure) => {
    setCaisseClosures(prev => {
      const filtered = prev.filter(c => c.date !== closure.date);
      return [closure, ...filtered];
    });

    logActivity(
      'closure',
      'caisse',
      'إقفال الصندوق اليومي',
      `إقفال صندوق يوم ${closure.date}: الفعلي ${closure.actualAmount.toLocaleString()} دج - النظري ${closure.theoreticalAmount.toLocaleString()} دج (الفرق: ${closure.difference.toLocaleString()} دج)`,
      closure.actualAmount,
      closure.id
    );

    showToast(`تم إقفال وحفظ صندوق يوم ${closure.date} بنجاح`);
  };

  const handleDeleteCaisseClosure = (id: string) => {
    const closure = caisseClosures.find(c => c.id === id);
    setConfirmDelete({
      title: 'حذف إقفال الصندوق',
      message: 'هل أنت متأكد من حذف هذا السجل لصندوق اليومية؟',
      onConfirm: () => {
        setCaisseClosures(prev => prev.filter(c => c.id !== id));

        logActivity(
          'delete',
          'caisse',
          'حذف إقفال صندوق يومي',
          `حذف إقفال الصندوق ليوم: ${closure?.date || id}`,
          closure?.actualAmount,
          id
        );

        showToast('تم حذف سجل إقفال الصندوق');
        setConfirmDelete(null);
      }
    });
  };

  // ==========================
  // STAFF & ABSENCES HANDLERS
  // ==========================
  const handleAddStaffPayout = (data: any, deductedAbsenceIds?: string[]) => {
    const payoutId = generateId();
    const newPayout: StaffPayout = { ...data, id: payoutId };
    setStaffPayouts(prev => [newPayout, ...prev]);

    // If absences were deducted in this payout, mark them as deducted
    if (deductedAbsenceIds && deductedAbsenceIds.length > 0) {
      setStaffAbsences(prev => prev.map(a => {
        if (deductedAbsenceIds.includes(a.id)) {
          return { ...a, isDeducted: true, payoutId };
        }
        return a;
      }));
    }

    logActivity(
      'payment',
      'staff',
      'صرف راتب لعامل',
      `صرف مبلغ ${data.amount} دج للعامل/ة: ${data.staffName} (عن شهر ${data.month || ''})`,
      data.amount,
      payoutId
    );

    showToast('تم صرف الراتب وتطبيق خصم الغيابات بنجاح');
  };

  const handleDeleteStaffPayout = (id: string) => {
    const payout = staffPayouts.find(p => p.id === id);
    setStaffPayouts(prev => prev.filter(p => p.id !== id));
    // Restore deducted status if payout is deleted
    setStaffAbsences(prev => prev.map(a => a.payoutId === id ? { ...a, isDeducted: false, payoutId: undefined } : a));

    logActivity(
      'delete',
      'staff',
      'حذف سجل صرف راتب',
      `حذف راتب: ${payout?.staffName || ''} بقيمة ${payout?.amount || 0} دج`,
      payout?.amount,
      id
    );

    showToast('تم حذف سجل الراتب');
  };

  const handleAddStaffMember = (data: any) => {
    const newMember: StaffMember = { ...data, id: generateId() };
    setStaffMembers(prev => [...prev, newMember]);

    logActivity(
      'create',
      'staff',
      'إضافة عامل جديد',
      `اسم العامل: ${data.name} - الوظيفة: ${data.role || 'عامل'} - الراتب الأساسي: ${data.baseSalary || 0} دج`,
      data.baseSalary,
      newMember.id
    );

    showToast(`تمت إضافة العامل/ة ${data.name}`);
  };

  const handleUpdateStaffMember = (id: string, data: any) => {
    setStaffMembers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));

    logActivity(
      'update',
      'staff',
      'تحديث بيانات عامل',
      `تحديث ملف العامل: ${data.name || id}`,
      data.baseSalary,
      id
    );

    showToast('تم تحديث بيانات العامل');
  };

  const handleDeleteStaffMember = (id: string) => {
    const member = staffMembers.find(s => s.id === id);
    setConfirmDelete({
      title: 'حذف العامل',
      message: 'هل تريد حذف هذا العامل من النظام؟',
      onConfirm: () => {
        setStaffMembers(prev => prev.filter(s => s.id !== id));

        logActivity(
          'delete',
          'staff',
          'حذف عامل',
          `حذف العامل: ${member?.name || id} من النظام`,
          undefined,
          id
        );

        showToast('تم حذف العامل');
        setConfirmDelete(null);
      }
    });
  };

  const handleAddAbsence = (data: any) => {
    const newAbsence: StaffAbsence = { ...data, id: generateId() };
    setStaffAbsences(prev => [newAbsence, ...prev]);

    logActivity(
      'create',
      'staff',
      'تسجيل غياب وخصم',
      `غياب: ${data.staffName} بتاريخ ${data.date} - سبب: ${data.reason || 'غياب'} - خصم: ${data.deductionAmount} دج`,
      data.deductionAmount,
      newAbsence.id
    );

    showToast(`تم تسجيل غياب ${data.staffName} بقيمة خصم ${data.deductionAmount} دج`);
  };

  const handleDeleteAbsence = (id: string) => {
    const abs = staffAbsences.find(a => a.id === id);
    setStaffAbsences(prev => prev.filter(a => a.id !== id));

    logActivity(
      'delete',
      'staff',
      'حذف سجل غياب',
      `إلغاء غياب: ${abs?.staffName || ''} بتاريخ ${abs?.date || ''}`,
      abs?.deductionAmount,
      id
    );

    showToast('تم حذف سجل الغياب');
  };

  // ==========================
  // TAILORING & MAINTENANCE HANDLERS
  // ==========================
  const handleAddTailoringOrder = (data: Partial<MaintenanceOrder>) => {
    const newOrder: MaintenanceOrder = {
      id: generateId(),
      orderNumber: `TAIL-${Math.floor(100 + Math.random() * 900)}`,
      targetType: data.targetType || 'customer_order',
      itemId: data.itemId,
      itemName: data.itemName || 'فستان',
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      serviceType: data.serviceType || 'alteration',
      description: data.description || '',
      measurements: data.measurements,
      tailorName: data.tailorName,
      cost: Number(data.cost) || 0,
      price: Number(data.price) || 0,
      paidAmount: Number(data.paidAmount) || 0,
      remainingAmount: Number(data.remainingAmount) || 0,
      receivedDate: data.receivedDate || new Date().toISOString().split('T')[0],
      expectedDeliveryDate: data.expectedDeliveryDate || new Date().toISOString().split('T')[0],
      status: data.status || 'pending',
      notes: data.notes,
      createdAt: new Date().toISOString()
    };

    setMaintenanceOrders(prev => [newOrder, ...prev]);

    if (newOrder.remainingAmount > 0 && newOrder.customerName) {
      const newCredit: Credit = {
        id: generateId(),
        name: newOrder.customerName,
        phone: newOrder.customerPhone || '',
        type: 'دين خياطة وصيانة',
        desc: `متبقي خياطة: ${newOrder.itemName} (طلب #${newOrder.orderNumber})`,
        amount: newOrder.remainingAmount,
        date: new Date().toISOString()
      };
      setCredits(prev => [newCredit, ...prev]);
    }

    logActivity(
      'create',
      'tailoring',
      'تسجيل طلب خياطة وتفصيل',
      `طلب #${newOrder.orderNumber}: ${newOrder.itemName} للزبونة ${newOrder.customerName || 'عام'} - السعر: ${newOrder.price} دج - المدفوع: ${newOrder.paidAmount} دج`,
      newOrder.paidAmount || newOrder.price,
      newOrder.orderNumber
    );

    showToast('تم تسجيل طلب الخياطة والصيانة بنجاح');
    setActiveModal(null);
  };

  const handleUpdateTailoringOrder = (id: string, data: Partial<MaintenanceOrder>) => {
    setMaintenanceOrders(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
    
    logActivity(
      'update',
      'tailoring',
      'تحديث طلب خياطة',
      `تعديل بيانات طلب الخياطة: ${data.itemName || id}`,
      data.price,
      id
    );

    showToast('تم تحديث بيانات طلب الخياطة');
    setActiveModal(null);
  };

  const handleUpdateTailoringStatus = (id: string, newStatus: MaintenanceStatus) => {
    const ord = maintenanceOrders.find(o => o.id === id);
    setMaintenanceOrders(prev => prev.map(o => {
      if (o.id === id) {
        return { 
          ...o, 
          status: newStatus, 
          actualDeliveryDate: newStatus === 'delivered' ? new Date().toISOString().split('T')[0] : o.actualDeliveryDate 
        };
      }
      return o;
    }));

    logActivity(
      'status_change',
      'tailoring',
      'تحديث حالة طلب خياطة',
      `طلب #${ord?.orderNumber || id} أصبح في حالة: ${newStatus === 'delivered' ? 'تم التسليم للزبونة' : newStatus === 'ready' ? 'جاهز ومكتمل' : 'قيد العمل'}`,
      undefined,
      ord?.orderNumber || id
    );

    showToast('تم تحديث حالة الطلب');
  };

  const handleDeleteTailoringOrder = (id: string) => {
    const ord = maintenanceOrders.find(o => o.id === id);
    setConfirmDelete({
      title: 'حذف طلب الصيانة والخياطة',
      message: 'هل أنت متأكد من حذف هذا الطلب من سجل الخياطة؟',
      onConfirm: () => {
        setMaintenanceOrders(prev => prev.filter(o => o.id !== id));
        
        logActivity(
          'delete',
          'tailoring',
          'حذف طلب خياطة',
          `حذف طلب #${ord?.orderNumber || id} (${ord?.itemName || ''})`,
          ord?.price,
          ord?.orderNumber || id
        );

        showToast('تم حذف الطلب بنجاح');
        setConfirmDelete(null);
      }
    });
  };

  // ==========================
  // MESSAGING (WHATSAPP / SMS)
  // ==========================
  const handleSendMessage = (rental: Rental, method: 'whatsapp' | 'sms') => {
    const phone = rental.customerPhone.replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('0') ? '213' + phone.substring(1) : phone;
    
    const isOverdue = new Date(rental.expectedReturnDate).getTime() < new Date().getTime();
    let msgText = '';

    if (rental.status === 'reserved') {
      msgText = `سلام ${rental.customerName}، نذكروك بحجز فستان/قطعة (${rental.itemName}) لمناسبتكم القادمة بتاريخ ${rental.startDate}. يرجى الحضور لاستلام الفستان وإتمام الصفقة. نسعد دائماً بخدمتكم في بوتيك مانجر.`;
    } else if (isOverdue) {
      msgText = `سلام ${rental.customerName}، نذكروك بأن موعد إرجاع فستان/قطعة (${rental.itemName}) من بوتيك مانجر كان محدد بتاريخ ${rental.expectedReturnDate}. يرجى إرجاع القطعة في أقرب وقت. شكراً لتفهمكم.`;
    } else {
      msgText = `سلام ${rental.customerName}، نذكروك بموعد إرجاع فستان/قطعة (${rental.itemName}) المحدد بتاريخ ${rental.expectedReturnDate}. نسعد بخدمتك دائماً في بوتيك مانجر.`;
    }

    const encoded = encodeURIComponent(msgText);
    if (method === 'whatsapp') {
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    } else {
      window.open(`sms:${phone}?body=${encoded}`, '_blank');
    }
  };

  // ==========================
  // BACKUP & RESTORE
  // ==========================
  const handleExportBackup = () => {
    const backupData = {
      clothes,
      rentals,
      sales,
      expenses,
      credits,
      staffPayouts,
      staffMembers,
      staffAbsences,
      maintenanceOrders,
      suppliers,
      seamstresses,
      rawMaterials,
      caisseClosures,
      activityLogs,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_بوتيك_مانجر_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير النسخة الاحتياطية بنجاح');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          if (parsed.clothes) setClothes(parsed.clothes);
          if (parsed.rentals) setRentals(parsed.rentals);
          if (parsed.sales) setSales(parsed.sales);
          if (parsed.expenses) setExpenses(parsed.expenses);
          if (parsed.credits) setCredits(parsed.credits);
          if (parsed.staffPayouts) setStaffPayouts(parsed.staffPayouts);
          if (parsed.staffMembers) setStaffMembers(parsed.staffMembers);
          if (parsed.staffAbsences) setStaffAbsences(parsed.staffAbsences);
          if (parsed.maintenanceOrders) setMaintenanceOrders(parsed.maintenanceOrders);
          if (parsed.suppliers) setSuppliers(parsed.suppliers);
          if (parsed.seamstresses) setSeamstresses(parsed.seamstresses);
          if (parsed.rawMaterials) setRawMaterials(parsed.rawMaterials);
          if (parsed.caisseClosures) setCaisseClosures(parsed.caisseClosures);
          if (parsed.activityLogs) setActivityLogs(parsed.activityLogs);
          showToast('تمت استعادة البيانات بنجاح!');
          setActiveModal(null);
        } catch (err) {
          showToast('ملف غير صالح!', 'error');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="text-blue-900 w-full min-h-screen flex flex-col bg-white font-['Tajawal']" dir="rtl">
      {/* Toast Notification Container */}
      <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold text-white transition-all transform duration-300 ${
              t.type === 'success' ? 'bg-blue-600' : 'bg-black'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Main Top Header */}
      <header className="bg-white border-b border-blue-100 px-3 sm:px-6 py-2.5 z-20 sticky top-0 shadow-xs safe-top">
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
          {/* Top Row: Quick Tools & Actions */}
          <div className="flex items-center justify-between gap-2">
            {/* Action Tools */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setIsScanning(true)}
                title="مسح الباركود"
                aria-label="مسح الباركود"
                className="h-9 px-2.5 sm:px-3 rounded-xl bg-blue-50/50 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-300 border border-blue-100/70 active:scale-95 text-blue-800 flex items-center gap-1.5 transition-all text-xs font-bold group"
              >
                <svg className="w-4 h-4 text-blue-600 group-hover:text-blue-700 shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M3 7V5a2 2 0 012-2h2" />
                  <path d="M17 3h2a2 2 0 012 2v2" />
                  <path d="M21 17v2a2 2 0 01-2 2h-2" />
                  <path d="M7 21H5a2 2 0 01-2-2v-2" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                </svg>
                <span className="hidden sm:inline">مسح الباركود</span>
              </button>

              <button
                onClick={() => {
                  if (hideFinances) {
                    setActiveModal('privacyPassword');
                  } else {
                    setHideFinances(true);
                    localStorage.setItem('bm_hideFinances', 'true');
                  }
                }}
                title="إخفاء/إظهار المبالغ"
                aria-label="إخفاء/إظهار المبالغ"
                className={`h-9 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 text-xs font-bold border group ${
                  hideFinances 
                    ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' 
                    : 'bg-slate-100/90 text-slate-700 border-slate-200/70 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300'
                }`}
              >
                <svg className={`w-4 h-4 shrink-0 transition-colors ${hideFinances ? 'text-white' : 'text-slate-600 group-hover:text-blue-600'}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
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
                <span className="hidden sm:inline">{hideFinances ? 'إظهار المبالغ' : 'إخفاء المبالغ'}</span>
              </button>

              <button 
                onClick={() => setActiveModal('fullReport')} 
                title="التقرير المالي"
                className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100/90 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 border border-slate-200/70 rounded-xl transition-all shadow-2xs active:scale-95 group"
              >
                <svg className="w-4 h-4 text-slate-600 group-hover:text-blue-600 shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span className="hidden sm:inline">التقرير الشامل</span>
              </button>

              <button 
                onClick={() => setCurrentView('caisse')} 
                title="صندوق اليومية ومتابعة العجز (La Caisse)"
                className={`h-9 px-2.5 sm:px-3 flex items-center gap-1.5 text-xs font-bold rounded-xl transition-all border active:scale-95 group ${
                  currentView === 'caisse'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'text-blue-700 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300 border-blue-100/70'
                }`}
              >
                <Scale className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'caisse' ? 'text-white' : 'text-blue-600 group-hover:text-blue-700'}`} />
                <span className="hidden sm:inline">الصندوق اليومي</span>
                <span className="sm:hidden">الصندوق</span>
              </button>

              <button 
                onClick={() => setCurrentView('logs')} 
                title="سجل التحديثات والتعديلات (Logs)"
                className={`h-9 px-2.5 sm:px-3 flex items-center gap-1.5 text-xs font-bold rounded-xl transition-all border active:scale-95 group ${
                  currentView === 'logs'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'text-slate-700 bg-slate-100/90 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 border-slate-200/70'
                }`}
              >
                <History className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'logs' ? 'text-white' : 'text-slate-600 group-hover:text-blue-600'}`} />
                <span className="hidden sm:inline">السجل</span>
              </button>
            </div>

            {/* Primary Add Button */}
            <button
              onClick={() => setActiveModal('addRental')}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs shrink-0 transition-all hover:shadow-md hover:shadow-blue-500/20"
            >
              <span className="text-sm font-bold">+</span>
              <span>كراء جديد</span>
            </button>
          </div>

          {/* Bottom Row of Header: All Navigation Icons in a single compact row */}
          <nav className="grid grid-cols-11 gap-0.5 sm:gap-1 w-full pt-1 border-t border-blue-50" aria-label="أقسام التطبيق">
            <NavButton 
              icon="dashboard" 
              label="الرئيسية" 
              onClick={() => setCurrentView('dashboard')} 
              active={currentView === 'dashboard'} 
            />
            <NavButton 
              icon="rentals" 
              label="الكراء" 
              onClick={() => setCurrentView('rentals')} 
              active={currentView === 'rentals'} 
              badge={overdueCount}
            />
            <NavButton 
              icon="inventory" 
              label="المخزون" 
              onClick={() => setCurrentView('inventory')} 
              active={currentView === 'inventory'} 
            />
            <NavButton 
              icon="sales" 
              label="المبيعات" 
              onClick={() => setCurrentView('sales')} 
              active={currentView === 'sales'} 
            />
            <NavButton 
              icon="tailoring" 
              label="الخياطة" 
              onClick={() => setCurrentView('tailoring')} 
              active={currentView === 'tailoring'} 
              badge={activeMaintenanceCount}
            />
            <NavButton 
              icon="expenses" 
              label="المصاريف" 
              onClick={() => setCurrentView('expenses')} 
              active={currentView === 'expenses'} 
            />
            <NavButton 
              icon="credits" 
              label="الكريدي" 
              onClick={() => setCurrentView('credits')} 
              active={currentView === 'credits'} 
            />
            <NavButton 
              icon="partners" 
              label="الموردين والخياطات" 
              onClick={() => setCurrentView('partners')} 
              active={currentView === 'partners'} 
            />
            <NavButton 
              icon="caisse" 
              label="الصندوق" 
              onClick={() => setCurrentView('caisse')} 
              active={currentView === 'caisse'} 
            />
            <NavButton 
              icon="logs" 
              label="السجل" 
              onClick={() => setCurrentView('logs')} 
              active={currentView === 'logs'} 
            />
            <NavButton 
              icon="staff" 
              label="العمال" 
              onClick={() => setActiveModal('staffPayouts')} 
              badge={pendingAbsencesCount}
            />
          </nav>
        </div>
      </header>

      {/* Main Views Container */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 md:px-8 py-4 pb-12 overflow-y-auto">
        <React.Suspense fallback={<LoadingFallback />}>
          {currentView === 'dashboard' && (
            <DashboardView 
              rentals={rentals} 
              maintenanceOrders={maintenanceOrders}
              clothes={clothes}
              caisseClosures={caisseClosures}
              sales={sales}
              expenses={expenses}
              staffPayouts={staffPayouts}
              credits={credits}
              hideFinances={hideFinances}
              onPrivacyToggle={() => {
                if (hideFinances) {
                  setActiveModal('privacyPassword');
                } else {
                  setHideFinances(true);
                  localStorage.setItem('bm_hideFinances', 'true');
                }
              }}
              onNavigate={(v) => setCurrentView(v)}
              onOpenAddRental={() => setActiveModal('addRental')}
              onOpenReturnModal={(r) => { setSelectedRental(r); setActiveModal('returnRental'); }}
              onSendMessage={(r) => { setSelectedRental(r); setActiveModal('messageModal'); }}
            />
          )}

          {currentView === 'rentals' && (
            <RentalsView 
              rentals={rentals} 
              clothes={clothes}
              onAddRental={(itemId) => {
                setPreselectedRentalItemId(itemId);
                setActiveModal('addRental');
              }}
              onEditRental={(r) => { setSelectedRental(r); setActiveModal('editRental'); }}
              onDeleteRental={handleDeleteRental}
              onActivateRental={handleActivateRental}
              onOpenReturnModal={(r) => { setSelectedRental(r); setActiveModal('returnRental'); }}
              onOpenReceiptModal={(r) => { setSelectedRental(r); setActiveModal('receiptModal'); }}
              onSendMessage={(r) => { setSelectedRental(r); setActiveModal('messageModal'); }}
              onScanBarcode={() => setIsScanning(true)}
            />
          )}

          {currentView === 'inventory' && (
            <InventoryView 
              clothes={clothes}
              rawMaterials={rawMaterials}
              suppliers={suppliers}
              onAddCloth={handleAddCloth}
              onUpdateCloth={handleUpdateCloth}
              onDeleteCloth={handleDeleteCloth}
              onAddRawMaterial={handleAddRawMaterial}
              onUpdateRawMaterial={handleUpdateRawMaterial}
              onDeleteRawMaterial={handleDeleteRawMaterial}
              onScanBarcode={() => setIsScanning(true)}
            />
          )}

          {currentView === 'sales' && (
            <SalesPOSView 
              clothes={clothes}
              sales={sales}
              onCompleteSale={handleCompleteSale}
              onDeleteSale={handleDeleteSale}
              onScanBarcode={() => setIsScanning(true)}
              scannedCode={posScannedBarcode}
              onClearScannedCode={() => setPosScannedBarcode(null)}
            />
          )}

          {currentView === 'tailoring' && (
            <TailoringView 
              orders={maintenanceOrders}
              clothes={clothes}
              onOpenAddModal={() => setActiveModal('addTailoring')}
              onEditOrder={(order) => { setSelectedTailoringOrder(order); setActiveModal('editTailoring'); }}
              onDeleteOrder={handleDeleteTailoringOrder}
              onUpdateStatus={handleUpdateTailoringStatus}
              onOpenReceiptModal={(order) => { setSelectedTailoringOrder(order); setActiveModal('tailoringReceipt'); }}
            />
          )}

          {currentView === 'expenses' && (
            <ExpensesView 
              expenses={expenses}
              suppliers={suppliers}
              credits={credits}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onSettleSupplierCredit={handleSettleSupplierCredit}
              onAddSupplier={handleAddSupplier}
            />
          )}

          {currentView === 'credits' && (
            <CreditsView 
              credits={credits}
              suppliers={suppliers}
              onAddCredit={handleAddCredit}
              onSettleCredit={handleSettleCredit}
              onDeleteCredit={handleDeleteCredit}
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
              onSaveClosure={handleSaveCaisseClosure}
              onDeleteClosure={handleDeleteCaisseClosure}
              hideFinances={hideFinances}
              onPrivacyToggle={() => {
                if (hideFinances) {
                  setActiveModal('privacyPassword');
                } else {
                  setHideFinances(true);
                  localStorage.setItem('bm_hideFinances', 'true');
                }
              }}
            />
          )}

          {currentView === 'partners' && (
            <PartnersView 
              suppliers={suppliers}
              seamstresses={seamstresses}
              expenses={expenses}
              maintenanceOrders={maintenanceOrders}
              credits={credits}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onAddSeamstress={handleAddSeamstress}
              onUpdateSeamstress={handleUpdateSeamstress}
              onDeleteSeamstress={handleDeleteSeamstress}
              onSettleSupplierCredit={handleSettleSupplierCredit}
            />
          )}

          {currentView === 'logs' && (
            <LogsView 
              logs={activityLogs}
              onDeleteLog={handleDeleteLog}
              onClearAllLogs={handleClearAllLogs}
              onAddManualLog={handleAddManualLog}
              showToast={showToast}
            />
          )}
        </React.Suspense>
      </main>

      {/* ================= MODALS ================= */}
      <React.Suspense fallback={null}>
        {/* Add Tailoring Modal */}
        {activeModal === 'addTailoring' && (
          <TailoringModal
            clothes={clothes}
            staffMembers={staffMembers}
            onSave={handleAddTailoringOrder}
            onClose={() => setActiveModal(null)}
          />
        )}

      {/* Edit Tailoring Modal */}
      {activeModal === 'editTailoring' && selectedTailoringOrder && (
        <TailoringModal
          order={selectedTailoringOrder}
          clothes={clothes}
          staffMembers={staffMembers}
          onSave={(data) => handleUpdateTailoringOrder(selectedTailoringOrder.id, data)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Tailoring Receipt Modal */}
      {activeModal === 'tailoringReceipt' && selectedTailoringOrder && (
        <TailoringReceiptModal
          order={selectedTailoringOrder}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Add Rental Modal */}
      {activeModal === 'addRental' && (
        <Modal title="تسجيل عملية كراء أو حجز مستقبلي" onClose={() => { setActiveModal(null); setPreselectedRentalItemId(undefined); }}>
          <RentalModal 
            clothes={clothes} 
            initialItemId={preselectedRentalItemId}
            existingRentals={rentals}
            onSubmit={(data) => {
              handleAddRental(data);
              setPreselectedRentalItemId(undefined);
            }} 
          />
        </Modal>
      )}

      {/* Edit Rental Modal */}
      {activeModal === 'editRental' && selectedRental && (
        <Modal title="تعديل بيانات ومواعيد الكراء" onClose={() => setActiveModal(null)}>
          <RentalModal 
            clothes={clothes} 
            rental={selectedRental}
            existingRentals={rentals}
            onSubmit={(data) => handleUpdateRental(selectedRental.id, data)} 
          />
        </Modal>
      )}

      {/* Return Rental Modal */}
      {activeModal === 'returnRental' && selectedRental && (
        <Modal title="استرجاع فستان / قطعة كراء" onClose={() => setActiveModal(null)}>
          <ReturnRentalModal 
            rental={selectedRental}
            onConfirmReturn={handleConfirmReturn}
            onCancel={() => setActiveModal(null)}
          />
        </Modal>
      )}

      {/* Rental Receipt Modal */}
      {activeModal === 'receiptModal' && selectedRental && (
        <Modal title="وصل وعقد الكراء" onClose={() => setActiveModal(null)} wide>
          <RentalReceiptModal 
            rental={selectedRental}
            onClose={() => setActiveModal(null)}
          />
        </Modal>
      )}

      {/* WhatsApp / SMS Messaging Modal */}
      {activeModal === 'messageModal' && selectedRental && (
        <Modal title="إرسال تذكير للزبون" onClose={() => setActiveModal(null)}>
          <div className="space-y-4 text-right">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <h4 className="font-black text-slate-800 text-xs mb-1">الزبون: {selectedRental.customerName}</h4>
              <p className="text-xs text-slate-600">القطعة: {selectedRental.itemName}</p>
              <p className="text-xs text-black font-bold mt-1">تاريخ الإرجاع: {selectedRental.expectedReturnDate}</p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => { handleSendMessage(selectedRental, 'whatsapp'); setActiveModal(null); }} 
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824z"/></svg>
                إرسال عبر واتساب
              </button>
              <button 
                onClick={() => { handleSendMessage(selectedRental, 'sms'); setActiveModal(null); }} 
                className="flex-1 py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" strokeWidth="2"></path></svg>
                إرسال SMS
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Staff Payouts & Absences Modal */}
      {activeModal === 'staffPayouts' && (
        <Modal title="رواتب، غيابات وخلاص عمال البوتيك" onClose={() => setActiveModal(null)} wide>
          <StaffPayoutsModal 
            staffPayouts={staffPayouts} 
            staffMembers={staffMembers}
            staffAbsences={staffAbsences}
            onAddPayout={handleAddStaffPayout} 
            onDeletePayout={handleDeleteStaffPayout} 
            onAddStaffMember={handleAddStaffMember}
            onUpdateStaffMember={handleUpdateStaffMember}
            onDeleteStaffMember={handleDeleteStaffMember}
            onAddAbsence={handleAddAbsence}
            onDeleteAbsence={handleDeleteAbsence}
            hideFinances={hideFinances} 
          />
        </Modal>
      )}

      {/* Privacy Password Modal */}
      {activeModal === 'privacyPassword' && (
        <Modal title="كلمة المرور لإظهار الحسابات" onClose={() => setActiveModal(null)}>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem('pinCode') as HTMLInputElement);
              if (input && input.value === '9296') {
                setHideFinances(false); 
                localStorage.setItem('bm_hideFinances', 'false'); 
                setActiveModal(null);
                showToast('تم إظهار التفاصيل والمبالغ المالية');
              } else {
                showToast('رمز المرور غير صحيح', 'error');
              }
            }}
            className="space-y-4 text-center"
          >
            <p className="text-xs text-slate-500 font-medium">أدخل رمز المرور المخصص لإظهار التفاصيل المالية</p>
            <input 
              name="pinCode"
              id="privacy-pin-input"
              type="password" 
              autoFocus 
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-center text-2xl font-black outline-none tracking-widest focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" 
              placeholder="••••" 
              maxLength={6}
              onChange={(e) => {
                if (e.target.value === '9296') {
                  setHideFinances(false); 
                  localStorage.setItem('bm_hideFinances', 'false'); 
                  setActiveModal(null);
                  showToast('تم إظهار التفاصيل والمبالغ المالية');
                }
              }} 
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
              >
                تأكيد الرمز
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Firebase Cloud Sync Modal */}
      {activeModal === 'cloudSyncModal' && (
        <Modal title="المزامنة السحابية والمزامنة عبر الأجهزة (Firebase)" onClose={() => setActiveModal(null)} wide>
          <div className="space-y-4 py-1" dir="rtl">
            {/* Connection Status Card */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                    <h4 className="font-black text-sm text-white">الربط السحابي مع Firebase مفعل ونشط</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    معرف المشروع: <span className="font-mono text-blue-300 font-bold">ateliu-14e23</span>
                  </p>
                </div>
              </div>

              <button
                onClick={handleManualFullSync}
                disabled={isCloudSyncing}
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                <span>{isCloudSyncing ? 'جاري المزامنة...' : 'مزامنة سحابية الآن'}</span>
              </button>
            </div>

            {/* Cross Device Banner */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-slate-700" />
                <Laptop className="w-4 h-4 text-slate-700" />
                <h4 className="font-bold text-xs text-slate-900">مزامنة فورية على كل الأجهزة دون الحاجة لإعادة التحميل</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                أي تعديل، إضافة فستان، حجز كراء، أو تسجيل بيع تقوم به من الهاتف أو التابلت أو الحاسوب يُحفظ فوراً في قاعدة بيانات Firebase السحابية ويظهر في نفس الثانية على جميع الأجهزة الأخرى المتصلة.
              </p>
            </div>

            {/* Live Database Sync Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">فساتين المخزن</span>
                <span className="text-base font-black text-slate-900">{clothes.length}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">عمليات الكراء</span>
                <span className="text-base font-black text-slate-900">{rentals.length}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">المبيعات</span>
                <span className="text-base font-black text-slate-900">{sales.length}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">المصاريف والديون</span>
                <span className="text-base font-black text-slate-900">{expenses.length + credits.length}</span>
              </div>
            </div>

            {/* Last Sync Info & Safety Notice */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>آخر مزامنة ناجحة: {lastCloudSyncTime.toLocaleTimeString('ar-DZ')}</span>
              </div>
              <span className="text-slate-400">حفظ تلقائي مع دعم العمل بدون إنترنت (Offline-First)</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Backup & Restore Modal */}
      {activeModal === 'backupModal' && (
        <Modal title="النسخ الاحتياطي واستعادة البيانات" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <h4 className="font-bold text-sm text-slate-900 mb-1">حفظ نسخة احتياطية من بيانات البوتيك</h4>
              <p className="text-xs text-slate-600 mb-3">تنزيل ملف يحتوي على كافة ملابس المخزن، عمليات الكراء، المبيعات، والمصاريف.</p>
              <button 
                onClick={handleExportBackup} 
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                تنزيل النسخة الاحتياطية (JSON)
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-slate-700" />
                <h4 className="font-bold text-sm text-slate-900">تطبيق الصفحة الواحدة المستقل (index.html)</h4>
              </div>
              <p className="text-xs text-slate-700 mb-2 leading-relaxed">
                تم تهيئة المشروع لتوليد ملف <strong>index.html</strong> كامل ومستقل يشمل كافة الأكواد، التصاميم، والمكتبات داخل ملف واحد بدون أي ملفات خارجية منفصلة، جاهز للرفع المباشر على <strong>GitHub / GitHub Pages</strong>.
              </p>
              <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-900 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">أمر التجميع لملف واحد:</span>
                  <span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded font-bold">npm run build</span>
                </div>
                <div className="text-[10px] text-slate-600 font-sans">
                  ينتج الملف النهائي داخل مجلد: <code className="font-bold">dist/index.html</code>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <h4 className="font-bold text-sm text-slate-800 mb-1">استعادة البيانات من ملف</h4>
              <p className="text-xs text-slate-500 mb-3">يمكنك رفع ملف نسخة احتياطية تم تصديره مسبقاً لاسترجاع كافة البيانات في ثوانٍ.</p>
              <label className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer">
                اختيار ملف النسخة الاحتياطية
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>
        </Modal>
      )}

      {/* Full Financial Report */}
      {activeModal === 'fullReport' && (
        <Modal title="تقرير البوتيك الشامل" onClose={() => setActiveModal(null)} wide>
          <FullReport 
            clothes={clothes}
            rentals={rentals}
            sales={sales}
            expenses={expenses}
            credits={credits}
            staffPayouts={staffPayouts}
            hideFinances={hideFinances}
          />
        </Modal>
      )}

      {/* Barcode Scanner */}
      {isScanning && (
        <BarcodeScanner 
          onScan={(code) => {
            const cleanCode = code.trim().toLowerCase();
            const item = clothes.find(c => c.barcode.trim().toLowerCase() === cleanCode);
            setIsScanning(false);

            if (item) {
              showToast(`تم التعرف على: ${item.name} (${item.size})`);

              if (currentView === 'sales') {
                setPosScannedBarcode(cleanCode);
              } else if (currentView === 'rentals') {
                setPreselectedRentalItemId(item.id);
                setActiveModal('addRental');
              } else {
                // Open action chooser for this scanned item
                setScannedItemAction(item);
              }
            } else {
              // Code not in database -> prompt to add
              setUnknownScannedCode(code.trim());
            }
          }} 
          onClose={() => setIsScanning(false)} 
        />
      )}

      {/* Scanned Item Action Modal (When scanned from Dashboard / Top Bar) */}
      {scannedItemAction && (
        <Modal 
          title="إجراءات سريعة للقطعة الممسوحة" 
          onClose={() => setScannedItemAction(null)}
        >
          <div className="space-y-4 py-1 text-slate-800" dir="rtl">
            {/* Item Card */}
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              {scannedItemAction.imageUrl ? (
                <img 
                  src={scannedItemAction.imageUrl} 
                  alt={scannedItemAction.name} 
                  className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0" 
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Shirt className="w-8 h-8 text-slate-500" />
                </div>
              )}

              <div className="flex-1">
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                  {scannedItemAction.category}
                </span>
                <h4 className="font-black text-slate-900 text-sm mt-1">{scannedItemAction.name}</h4>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500 font-bold mt-1">
                  <span>مقاس: {scannedItemAction.size}</span>
                  <span>•</span>
                  <span>اللون: {scannedItemAction.color}</span>
                  <span>•</span>
                  <span className="font-mono text-slate-700">#{scannedItemAction.barcode}</span>
                </div>
                <div className="text-xs font-black text-slate-800 mt-1">
                  المتوفر بالمخزن: {scannedItemAction.stock - scannedItemAction.rentedCount} من {scannedItemAction.stock} قطعة
                </div>
              </div>
            </div>

            {/* 3 Main Action Choices */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Rent Action */}
              {(scannedItemAction.purpose === 'rent' || scannedItemAction.purpose === 'both') && (
                <button
                  onClick={() => {
                    const item = scannedItemAction;
                    setScannedItemAction(null);
                    setPreselectedRentalItemId(item.id);
                    setCurrentView('rentals');
                    setActiveModal('addRental');
                  }}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-center transition-all flex flex-col items-center justify-between gap-2 active:scale-95 group"
                >
                  <Shirt className="w-6 h-6 text-slate-700 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="block font-black text-xs text-slate-900">كراء الفستان</span>
                    <span className="text-[10px] text-slate-600 font-bold">{(scannedItemAction.rentPrice || 0).toLocaleString()} دج</span>
                  </div>
                </button>
              )}

              {/* Sell Action */}
              {(scannedItemAction.purpose === 'sell' || scannedItemAction.purpose === 'both') && (
                <button
                  onClick={() => {
                    const item = scannedItemAction;
                    setScannedItemAction(null);
                    setCurrentView('sales');
                    handleCompleteSale({
                      customerName: 'زبون عام',
                      items: [{
                        itemId: item.id,
                        name: item.name,
                        size: item.size,
                        color: item.color,
                        qty: 1,
                        stockSource: (item.stock1 && item.stock1 > 0) ? 'stock1' : 'stock2',
                        price: item.sellPrice,
                        cost: item.buyCost,
                        total: item.sellPrice,
                        imageUrl: item.imageUrl
                      }],
                      totalAmount: item.sellPrice,
                      paidAmount: item.sellPrice,
                      debtAmount: 0,
                      profit: item.sellPrice - item.buyCost,
                      date: new Date().toISOString()
                    });
                  }}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-center transition-all flex flex-col items-center justify-between gap-2 active:scale-95 group"
                >
                  <ShoppingBag className="w-6 h-6 text-slate-700 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="block font-black text-xs text-slate-900">بيع مباشر</span>
                    <span className="text-[10px] text-slate-600 font-bold">{(scannedItemAction.sellPrice || 0).toLocaleString()} دج</span>
                  </div>
                </button>
              )}

              {/* Stock Management */}
              <button
                onClick={() => {
                  setScannedItemAction(null);
                  setCurrentView('inventory');
                }}
                className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-center transition-all flex flex-col items-center justify-between gap-2 active:scale-95 group"
              >
                <Package className="w-6 h-6 text-slate-700 group-hover:scale-110 transition-transform" />
                <div>
                  <span className="block font-black text-xs text-slate-900">إدارة المخزون</span>
                  <span className="text-[10px] text-slate-600 font-bold">{scannedItemAction.stock} قطعة</span>
                </div>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Unknown Barcode Scanned Modal */}
      {unknownScannedCode && (
        <Modal 
          title="الباركود غير مسجل في المخزن" 
          onClose={() => setUnknownScannedCode(null)}
        >
          <div className="space-y-4 py-2 text-center" dir="rtl">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
              <Camera className="w-7 h-7 text-slate-700" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-sm">لم يتم العثور على قطعة مسجلة بهذا الرمز</h4>
              <p className="text-xs text-slate-500 font-mono mt-1 bg-slate-100 py-1.5 px-3 rounded-xl inline-block">
                #{unknownScannedCode}
              </p>
            </div>
            <p className="text-xs text-slate-600">
              هل ترغب في تسجيل هذا الباركود وإضافة قطعة ملابس / فستان جديد للمخزن الآن؟
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setUnknownScannedCode(null);
                  setCurrentView('inventory');
                }}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all shadow-xs active:scale-95"
              >
                + إضافة قطعة جديدة بهذا الباركود
              </button>
              <button
                onClick={() => setUnknownScannedCode(null)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Mobile More Sheet Modal */}
      {activeModal === 'mobileMore' && (
        <Modal title="المزيد من الأقسام والخدمات" onClose={() => setActiveModal(null)}>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              onClick={() => { setCurrentView('expenses'); setActiveModal(null); }}
              className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-right transition-all flex flex-col justify-between active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center mb-2">
                <Droplets className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-xs">المصاريف والغسيل</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Pressing وكراء المحل</p>
              </div>
            </button>

            <button
              onClick={() => { setCurrentView('credits'); setActiveModal(null); }}
              className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-right transition-all flex flex-col justify-between active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center mb-2">
                <CreditCardIcon className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-xs">الديون والكريدي</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">متابعة حسابات الزبائن</p>
              </div>
            </button>

            <button
              onClick={() => { setActiveModal('staffPayouts'); }}
              className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-right transition-all flex flex-col justify-between active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center mb-2">
                <Users className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-xs">رواتب وخلاص العمال</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">سجل دفعات الموظفين</p>
              </div>
            </button>

            <button
              onClick={() => { setActiveModal('fullReport'); }}
              className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-right transition-all flex flex-col justify-between active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center mb-2">
                <BarChart3 className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h4 className="font-black text-blue-900 text-xs">التقرير المالي الشامل</h4>
                <p className="text-[10px] text-blue-500 mt-0.5">طباعة وإحصائيات كاملة</p>
              </div>
            </button>

            <button
              onClick={() => { setActiveModal('backupModal'); }}
              className="p-4 bg-blue-50/50 hover:bg-blue-100/50 rounded-2xl border border-blue-100 text-right transition-all flex flex-col justify-between active:scale-95 col-span-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0">
                  <Save className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-black text-blue-900 text-xs">النسخ الاحتياطي واستعادة البيانات</h4>
                  <p className="text-[10px] text-blue-500 mt-0.5">تصدير أو استرجاع بيانات المحل (JSON)</p>
                </div>
              </div>
            </button>
          </div>
        </Modal>
      )}

      {/* In-App Delete Confirmation Modal */}
      {confirmDelete && (
        <Modal title={confirmDelete.title} onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4 py-2 text-center sm:text-right" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center mx-auto sm:mx-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-black text-blue-800 leading-relaxed">
                {confirmDelete.message}
              </p>
              <span className="text-xs text-blue-400 font-bold block mt-1">
                تأكيد حذف البيانات بشكل فوري وآمن.
              </span>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={confirmDelete.onConfirm}
                className="flex-1 bg-black hover:bg-blue-950 active:scale-95 text-white py-3 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-md shadow-blue-200 min-h-[44px]"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all min-h-[44px]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}
      </React.Suspense>
    </div>
  );
}
