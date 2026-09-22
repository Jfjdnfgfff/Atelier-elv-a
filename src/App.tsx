import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  ActivityLog
} from './types';
import { 
  loadFromStorage, 
  saveToStorage, 
  generateId, 
  STORAGE_KEYS, 
  DEFAULT_CLOTHES,
  DEFAULT_RENTALS,
  DEFAULT_EXPENSES,
  DEFAULT_STAFF,
  DEFAULT_SUPPLIERS,
  DEFAULT_MAINTENANCE,
  DEFAULT_CAISSE_CLOSURES,
  DEFAULT_RAW_MATERIALS,
  DEFAULT_SEAMSTRESSES,
  DEFAULT_ACTIVITY_LOGS,
  initializeStorage,
  getCachedCollection
} from './storage';
import { perfMonitor } from './utils/performanceMonitor';
import { 
  syncCollectionToCloud, 
  SubscriptionManager, 
  saveItemToFirebase,
  updateItemInFirebase,
  deleteItemFromFirebase,
  FIREBASE_COLLECTIONS,
  firebaseConfig,
  areArraysEqual
} from './firebase';

// Components
import { Modal } from './components/Shared';
import AppNavigation from './components/AppNavigation';

const BarcodeScanner = React.lazy(() => import('./components/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })));
const FullReport = React.lazy(() => import('./components/FullReport').then(m => ({ default: m.FullReport })));
const RentalModal = React.lazy(() => import('./components/RentalModal').then(m => ({ default: m.RentalModal })));
const ReturnRentalModal = React.lazy(() => import('./components/ReturnRentalModal').then(m => ({ default: m.ReturnRentalModal })));
const RentalReceiptModal = React.lazy(() => import('./components/RentalReceiptModal').then(m => ({ default: m.RentalReceiptModal })));
const StaffPayoutsModal = React.lazy(() => import('./components/StaffPayoutsModal').then(m => ({ default: m.StaffPayoutsModal })));
const TailoringModal = React.lazy(() => import('./components/TailoringModal').then(m => ({ default: m.TailoringModal })));
const TailoringReceiptModal = React.lazy(() => import('./components/TailoringReceiptModal').then(m => ({ default: m.TailoringReceiptModal })));
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
  Plus
} from 'lucide-react';

export default function App() {
  perfMonitor.recordAppRender();

  // 1. Core Collections (Loaded directly and live from Firebase Realtime Database)
  const [clothes, setClothes] = useState<ClothItem[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffAbsences, setStaffAbsences] = useState<StaffAbsence[]>([]);
  const [caisseClosures, setCaisseClosures] = useState<DailyCaisseClosure[]>([]);

  // 2. Lazy Collections (Deferred until section or modal is opened)
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [staffPayouts, setStaffPayouts] = useState<StaffPayout[]>([]);
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [seamstresses, setSeamstresses] = useState<Seamstress[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' }[]>([]);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Track loaded collections & active singleton listeners to prevent duplicate subscriptions
  const loadedCollectionsRef = useRef<Set<string>>(new Set([
    'clothes', 'staffMembers', 'staffAbsences', 'caisseClosures', 'activityLogs'
  ]));
  const activeSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // UI state (activeView is now owned entirely by AppNavigation to avoid App re-renders!)
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Navigation callback refs to communicate with AppNavigation without triggering App re-renders
  const navRef = useRef<(view: ViewType) => void>(() => {});
  const getCurrentViewRef = useRef<() => ViewType>(() => 'dashboard');

  const handleInitNav = useCallback((navFn: (view: ViewType) => void, getViewFn: () => ViewType) => {
    navRef.current = navFn;
    getCurrentViewRef.current = getViewFn;
  }, []);

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
    caisseClosures: false
  });

  const lastSyncUpdateTimestampRef = useRef<number>(0);
  const markCloudSyncActive = useCallback(() => {
    const now = Date.now();
    if (now - lastSyncUpdateTimestampRef.current > 2500) {
      lastSyncUpdateTimestampRef.current = now;
      setLastCloudSyncTime(new Date());
    }
  }, []);

  // 1. Core Permanent Real-time Cloud Subscriptions (Small Essential Global Collections)
  useEffect(() => {
    // Clothes
    const unsubClothes = SubscriptionManager.subscribe<ClothItem>(FIREBASE_COLLECTIONS.CLOTHES, (items) => {
      if (items && Array.isArray(items) && items.length > 0) {
        isRemoteUpdateRef.current.clothes = true;
        setClothes(prev => areArraysEqual(prev, items) ? prev : items);
        markCloudSyncActive();
      } else {
        const local = loadFromStorage<ClothItem[]>(STORAGE_KEYS.CLOTHES, []);
        if (local.length > 0) syncCollectionToCloud(FIREBASE_COLLECTIONS.CLOTHES, local);
      }
    });

    // Staff Members
    const unsubStaffMembers = SubscriptionManager.subscribe<StaffMember>(FIREBASE_COLLECTIONS.STAFF_MEMBERS, (items) => {
      if (items && Array.isArray(items) && items.length > 0) {
        isRemoteUpdateRef.current.staffMembers = true;
        setStaffMembers(prev => areArraysEqual(prev, items) ? prev : items);
        markCloudSyncActive();
      } else {
        const local = loadFromStorage<StaffMember[]>(STORAGE_KEYS.STAFF_MEMBERS, DEFAULT_STAFF);
        if (local.length > 0) syncCollectionToCloud(FIREBASE_COLLECTIONS.STAFF_MEMBERS, local);
      }
    });

    // Staff Absences
    const unsubStaffAbsences = SubscriptionManager.subscribe<StaffAbsence>(FIREBASE_COLLECTIONS.STAFF_ABSENCES, (items) => {
      if (items && Array.isArray(items)) {
        isRemoteUpdateRef.current.staffAbsences = true;
        setStaffAbsences(prev => areArraysEqual(prev, items) ? prev : items);
        markCloudSyncActive();
      }
    });

    // Caisse Closures
    const unsubCaisse = SubscriptionManager.subscribe<DailyCaisseClosure>(FIREBASE_COLLECTIONS.CAISSE_CLOSURES, (items) => {
      if (items && Array.isArray(items) && items.length > 0) {
        isRemoteUpdateRef.current.caisseClosures = true;
        setCaisseClosures(prev => areArraysEqual(prev, items) ? prev : items);
        markCloudSyncActive();
      } else {
        const local = loadFromStorage<DailyCaisseClosure[]>(STORAGE_KEYS.CAISSE_CLOSURES, DEFAULT_CAISSE_CLOSURES);
        if (local.length > 0) syncCollectionToCloud(FIREBASE_COLLECTIONS.CAISSE_CLOSURES, local);
      }
    });

    // Activity Logs
    const unsubLogs = SubscriptionManager.subscribe<ActivityLog>(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, (items) => {
      if (items && Array.isArray(items) && items.length > 0) {
        isRemoteUpdateRef.current.activityLogs = true;
        setActivityLogs(prev => areArraysEqual(prev, items) ? prev : items);
        markCloudSyncActive();
      } else {
        const local = loadFromStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, DEFAULT_ACTIVITY_LOGS);
        if (local.length > 0) syncCollectionToCloud(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, local);
      }
    });

    return () => {
      unsubClothes();
      unsubStaffMembers();
      unsubStaffAbsences();
      unsubCaisse();
      unsubLogs();
    };
  }, [markCloudSyncActive]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ACTIVITY_LOGS, activityLogs);
  }, [activityLogs]);

  const addActivityLog = useCallback((log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    const newLog: ActivityLog = {
      ...log,
      id: generateId(),
      timestamp: new Date().toISOString(),
      performedBy: log.performedBy || 'إدارة البوتيك'
    };
    setActivityLogs(prev => [newLog, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, newLog);
  }, []);

  const handleDeleteLog = useCallback((id: string, passwordVerified: boolean) => {
    if (!passwordVerified) return;
    setActivityLogs(prev => prev.filter(l => l.id !== id));
    deleteItemFromFirebase(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, id);
    showToast('تم حذف السجل بنجاح');
  }, [showToast]);

  const handleClearAllLogs = useCallback((passwordVerified: boolean) => {
    if (!passwordVerified) return;
    activityLogs.forEach(l => deleteItemFromFirebase(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, l.id));
    setActivityLogs([]);
    showToast('تم مسح جميع سجلات العمليات بنجاح');
  }, [activityLogs, showToast]);

  const handleAddManualLog = useCallback((log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    addActivityLog(log);
  }, [addActivityLog]);

  // First usable UI instrumentation & cleanup
  useEffect(() => {
    const coreRecords = clothes.length + staffMembers.length + staffAbsences.length + caisseClosures.length;
    perfMonitor.markFirstUsableUI(coreRecords);
  }, []);

  useEffect(() => {
    return () => {
      activeSubscriptionsRef.current.forEach(unsub => unsub());
      activeSubscriptionsRef.current.clear();
    };
  }, []);

  // On-demand collection loader: Real-time Firebase Subscriptions
  const ensureCollection = useCallback((key: string) => {
    if (loadedCollectionsRef.current.has(key)) {
      return;
    }
    loadedCollectionsRef.current.add(key);

    switch (key) {
      case 'rentals': {
        const unsub = SubscriptionManager.subscribe<Rental>(FIREBASE_COLLECTIONS.RENTALS, (items) => {
          if (items && Array.isArray(items)) {
            setRentals(prev => {
              if (areArraysEqual(prev, items)) return prev;
              isRemoteUpdateRef.current.rentals = true;
              return items;
            });
            markCloudSyncActive();
          }
        });
        activeSubscriptionsRef.current.set(key, unsub);
        break;
      }
      case 'sales': {
        const unsub = SubscriptionManager.subscribe<Sale>(FIREBASE_COLLECTIONS.SALES, (items) => {
          if (items && Array.isArray(items)) {
            setSales(prev => {
              if (areArraysEqual(prev, items)) return prev;
              isRemoteUpdateRef.current.sales = true;
              return items;
            });
            markCloudSyncActive();
          }
        });
        activeSubscriptionsRef.current.set(key, unsub);
        break;
      }
      case 'expenses': {
        const unsub = SubscriptionManager.subscribe<Expense>(FIREBASE_COLLECTIONS.EXPENSES, (items) => {
          if (items && Array.isArray(items)) {
            setExpenses(prev => {
              if (areArraysEqual(prev, items)) return prev;
              isRemoteUpdateRef.current.expenses = true;
              return items;
            });
            markCloudSyncActive();
          }
        });
        activeSubscriptionsRef.current.set(key, unsub);
        break;
      }
      case 'credits': {
        const unsub = SubscriptionManager.subscribe<Credit>(FIREBASE_COLLECTIONS.CREDITS, (items) => {
          if (items && Array.isArray(items)) {
            setCredits(prev => {
              if (areArraysEqual(prev, items)) return prev;
              isRemoteUpdateRef.current.credits = true;
              return items;
            });
            markCloudSyncActive();
          }
        });
        activeSubscriptionsRef.current.set(key, unsub);
        break;
      }
      case 'staffPayouts': {
        const unsub = SubscriptionManager.subscribe<StaffPayout>(FIREBASE_COLLECTIONS.STAFF_PAYOUTS, (items) => {
          if (items && Array.isArray(items)) {
            setStaffPayouts(prev => {
              if (areArraysEqual(prev, items)) return prev;
              isRemoteUpdateRef.current.staffPayouts = true;
              return items;
            });
            markCloudSyncActive();
          }
        });
        activeSubscriptionsRef.current.set(key, unsub);
        break;
      }
      case 'maintenance': {
        const unsub = SubscriptionManager.subscribe<MaintenanceOrder>(FIREBASE_COLLECTIONS.MAINTENANCE, (items) => {
          if (items && Array.isArray(items)) {
            setMaintenanceOrders(prev => {
              if (areArraysEqual(prev, items)) return prev;
              isRemoteUpdateRef.current.maintenanceOrders = true;
              return items;
            });
            markCloudSyncActive();
          }
        });
        activeSubscriptionsRef.current.set(key, unsub);
        break;
      }
      case 'suppliers': {
        const unsub = SubscriptionManager.subscribe<Supplier>(FIREBASE_COLLECTIONS.SUPPLIERS, (items) => {
          if (items && Array.isArray(items)) {
            setSuppliers(prev => {
              if (areArraysEqual(prev, items)) return prev;
              isRemoteUpdateRef.current.suppliers = true;
              return items;
            });
            markCloudSyncActive();
          }
        });
        activeSubscriptionsRef.current.set(key, unsub);
        break;
      }
      case 'seamstresses': {
        const unsub = SubscriptionManager.subscribe<Seamstress>(FIREBASE_COLLECTIONS.SEAMSTRESSES, (items) => {
          if (items && Array.isArray(items)) {
            setSeamstresses(prev => {
              if (areArraysEqual(prev, items)) return prev;
              isRemoteUpdateRef.current.seamstresses = true;
              return items;
            });
            markCloudSyncActive();
          }
        });
        activeSubscriptionsRef.current.set(key, unsub);
        break;
      }
      case 'rawMaterials': {
        const unsub = SubscriptionManager.subscribe<RawMaterial>(FIREBASE_COLLECTIONS.RAW_MATERIALS, (items) => {
          if (items && Array.isArray(items)) {
            setRawMaterials(prev => {
              if (areArraysEqual(prev, items)) return prev;
              isRemoteUpdateRef.current.rawMaterials = true;
              return items;
            });
            markCloudSyncActive();
          }
        });
        activeSubscriptionsRef.current.set(key, unsub);
        break;
      }
    }
  }, [markCloudSyncActive]);

  const ensureCollectionsForView = useCallback((view: ViewType) => {
    switch (view) {
      case 'rentals':
        ensureCollection('rentals');
        break;
      case 'sales':
        ensureCollection('sales');
        ensureCollection('rentals');
        break;
      case 'inventory':
        ensureCollection('rawMaterials');
        ensureCollection('suppliers');
        break;
      case 'tailoring':
        ensureCollection('maintenance');
        ensureCollection('seamstresses');
        ensureCollection('rawMaterials');
        break;
      case 'expenses':
        ensureCollection('expenses');
        ensureCollection('suppliers');
        break;
      case 'credits':
        ensureCollection('credits');
        ensureCollection('suppliers');
        break;
      case 'partners':
        ensureCollection('suppliers');
        ensureCollection('seamstresses');
        break;
      case 'caisse':
        ensureCollection('sales');
        ensureCollection('rentals');
        ensureCollection('expenses');
        ensureCollection('staffPayouts');
        break;
      case 'dashboard':
        ensureCollection('sales');
        ensureCollection('rentals');
        ensureCollection('expenses');
        ensureCollection('credits');
        break;
    }
  }, [ensureCollection]);

  // Immediately pre-load core financial/income collections at startup for zero-delay loading
  useEffect(() => {
    ensureCollection('sales');
    ensureCollection('rentals');
    ensureCollection('expenses');
    ensureCollection('credits');
  }, [ensureCollection]);

  const handleEnsureCollection = useCallback((view: ViewType) => {
    ensureCollectionsForView(view);
  }, [ensureCollectionsForView]);

  // Ensure collections when modals are opened
  useEffect(() => {
    if (!activeModal) return;
    if (['fullReport'].includes(activeModal)) {
      ensureCollection('rentals');
      ensureCollection('sales');
      ensureCollection('expenses');
      ensureCollection('credits');
      ensureCollection('staffPayouts');
      ensureCollection('maintenance');
      ensureCollection('suppliers');
    } else if (['addRental', 'editRental', 'returnRental', 'receiptModal'].includes(activeModal)) {
      ensureCollection('rentals');
    } else if (['addTailoring', 'editTailoring', 'tailoringReceipt', 'tailoringModal'].includes(activeModal)) {
      ensureCollection('maintenance');
      ensureCollection('seamstresses');
      ensureCollection('rawMaterials');
    } else if (['staffPayouts'].includes(activeModal)) {
      ensureCollection('staffPayouts');
    } else if (['supplierModal'].includes(activeModal)) {
      ensureCollection('suppliers');
    } else if (['seamstressModal'].includes(activeModal)) {
      ensureCollection('seamstresses');
    } else if (['rawMaterialModal'].includes(activeModal)) {
      ensureCollection('rawMaterials');
    }
  }, [activeModal, ensureCollection]);

  // Local Storage Persistence (Guarded: only writes to storage if the collection was loaded)
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CLOTHES, clothes);
  }, [clothes]);

  useEffect(() => {
    if (loadedCollectionsRef.current.has('rentals')) {
      saveToStorage(STORAGE_KEYS.RENTALS, rentals);
    }
  }, [rentals]);

  useEffect(() => {
    if (loadedCollectionsRef.current.has('sales')) {
      saveToStorage(STORAGE_KEYS.SALES, sales);
    }
  }, [sales]);

  useEffect(() => {
    if (loadedCollectionsRef.current.has('expenses')) {
      saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
    }
  }, [expenses]);

  useEffect(() => {
    if (loadedCollectionsRef.current.has('credits')) {
      saveToStorage(STORAGE_KEYS.CREDITS, credits);
    }
  }, [credits]);

  useEffect(() => {
    if (loadedCollectionsRef.current.has('staffPayouts')) {
      saveToStorage(STORAGE_KEYS.STAFF_PAYOUTS, staffPayouts);
    }
  }, [staffPayouts]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.STAFF_MEMBERS, staffMembers);
  }, [staffMembers]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.STAFF_ABSENCES, staffAbsences);
  }, [staffAbsences]);

  useEffect(() => {
    if (loadedCollectionsRef.current.has('maintenance')) {
      saveToStorage(STORAGE_KEYS.MAINTENANCE, maintenanceOrders);
    }
  }, [maintenanceOrders]);

  useEffect(() => {
    if (loadedCollectionsRef.current.has('suppliers')) {
      saveToStorage(STORAGE_KEYS.SUPPLIERS, suppliers);
    }
  }, [suppliers]);

  useEffect(() => {
    if (loadedCollectionsRef.current.has('seamstresses')) {
      saveToStorage(STORAGE_KEYS.SEAMSTRESSES, seamstresses);
    }
  }, [seamstresses]);

  useEffect(() => {
    if (loadedCollectionsRef.current.has('rawMaterials')) {
      saveToStorage(STORAGE_KEYS.RAW_MATERIALS, rawMaterials);
    }
  }, [rawMaterials]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CAISSE_CLOSURES, caisseClosures);
  }, [caisseClosures]);

  // Full Manual Cloud Sync Handler
  const handleManualFullSync = async () => {
    setIsCloudSyncing(true);
    try {
      const syncPromises = [
        syncCollectionToCloud(FIREBASE_COLLECTIONS.CLOTHES, clothes),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.STAFF_MEMBERS, staffMembers),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.STAFF_ABSENCES, staffAbsences),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.CAISSE_CLOSURES, caisseClosures)
      ];
      if (loadedCollectionsRef.current.has('rentals')) syncPromises.push(syncCollectionToCloud(FIREBASE_COLLECTIONS.RENTALS, rentals));
      if (loadedCollectionsRef.current.has('sales')) syncPromises.push(syncCollectionToCloud(FIREBASE_COLLECTIONS.SALES, sales));
      if (loadedCollectionsRef.current.has('expenses')) syncPromises.push(syncCollectionToCloud(FIREBASE_COLLECTIONS.EXPENSES, expenses));
      if (loadedCollectionsRef.current.has('credits')) syncPromises.push(syncCollectionToCloud(FIREBASE_COLLECTIONS.CREDITS, credits));
      if (loadedCollectionsRef.current.has('staffPayouts')) syncPromises.push(syncCollectionToCloud(FIREBASE_COLLECTIONS.STAFF_PAYOUTS, staffPayouts));
      if (loadedCollectionsRef.current.has('maintenance')) syncPromises.push(syncCollectionToCloud(FIREBASE_COLLECTIONS.MAINTENANCE, maintenanceOrders));
      if (loadedCollectionsRef.current.has('suppliers')) syncPromises.push(syncCollectionToCloud(FIREBASE_COLLECTIONS.SUPPLIERS, suppliers));
      if (loadedCollectionsRef.current.has('seamstresses')) syncPromises.push(syncCollectionToCloud(FIREBASE_COLLECTIONS.SEAMSTRESSES, seamstresses));
      if (loadedCollectionsRef.current.has('rawMaterials')) syncPromises.push(syncCollectionToCloud(FIREBASE_COLLECTIONS.RAW_MATERIALS, rawMaterials));

      await Promise.all(syncPromises);
      setLastCloudSyncTime(new Date());
      showToast('تمت المزامنة وحفظ جميع التعديلات في Firebase بنجاح!');
    } catch (err) {
      showToast('تعذر إتمام المزامنة السحابية', 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // UI state
  const [hideFinances, setHideFinances] = useState(() => localStorage.getItem('bm_hideFinances') !== 'false');
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

  // Memoized clothes barcode and ID index for O(1) instantaneous scanning lookups
  const clothesBarcodeIndex = useMemo(() => {
    const map = new Map<string, ClothItem>();
    for (let i = 0; i < clothes.length; i++) {
      const item = clothes[i];
      if (item.barcode) {
        map.set(item.barcode.trim().toLowerCase(), item);
      }
      if (item.id) {
        map.set(item.id.trim().toLowerCase(), item);
      }
    }
    return map;
  }, [clothes]);

  const openAddRentalModal = useCallback(() => {
    setPreselectedRentalItemId(undefined);
    setActiveModal('addRental');
  }, []);

  const openFullReportModal = useCallback(() => {
    setActiveModal('fullReport');
  }, []);

  const openStaffPayoutsModal = useCallback(() => {
    setActiveModal('staffPayouts');
  }, []);

  const openBarcodeScan = useCallback(() => {
    setIsScanning(true);
  }, []);

  const toggleFinances = useCallback(() => {
    if (hideFinances) {
      setActiveModal('privacyPassword');
    } else {
      setHideFinances(true);
      localStorage.setItem('bm_hideFinances', 'true');
    }
  }, [hideFinances]);

  // Stable Modal and Navigation Callback Handlers
  const handleOpenAddRental = useCallback(() => {
    setPreselectedRentalItemId(undefined);
    setActiveModal('addRental');
  }, []);

  const handleOpenAddRentalWithItem = useCallback((itemId?: string) => {
    setPreselectedRentalItemId(itemId);
    setActiveModal('addRental');
  }, []);

  const handleOpenEditRentalModal = useCallback((r: Rental) => {
    setSelectedRental(r);
    setActiveModal('editRental');
  }, []);

  const handleOpenReturnModal = useCallback((r: Rental) => {
    setSelectedRental(r);
    setActiveModal('returnRental');
  }, []);

  const handleOpenReceiptModal = useCallback((r: Rental) => {
    setSelectedRental(r);
    setActiveModal('receiptModal');
  }, []);

  const handleOpenMessageModal = useCallback((r: Rental) => {
    setSelectedRental(r);
    setActiveModal('messageModal');
  }, []);

  const handleOpenAddTailoringModal = useCallback(() => {
    setActiveModal('addTailoring');
  }, []);

  const handleOpenEditTailoringModal = useCallback((order: MaintenanceOrder) => {
    setSelectedTailoringOrder(order);
    setActiveModal('editTailoring');
  }, []);

  const handleOpenTailoringReceiptModal = useCallback((order: MaintenanceOrder) => {
    setSelectedTailoringOrder(order);
    setActiveModal('tailoringReceipt');
  }, []);

  const handleClearPosScannedBarcode = useCallback(() => {
    setPosScannedBarcode(null);
  }, []);

  // ==========================
  // RENTAL HANDLERS
  // ==========================
  const handleAddRental = useCallback((rentalData: any) => {
    const newRental: Rental = { ...rentalData, id: generateId() };
    
    // Add rental to state
    setRentals(prev => [newRental, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.RENTALS, newRental);

    addActivityLog({
      actionType: newRental.status === 'active' ? 'deal' : 'create',
      category: 'rentals',
      title: newRental.status === 'active' ? 'تسجيل كراء فستان جديد' : 'تسجيل حجز فستان مستقبلي',
      details: `كراء القطعة: ${newRental.itemName} (مقاس ${newRental.itemSize}) للزبونة ${newRental.customerName} بمبلغ ${newRental.rentPrice} دج`,
      amount: newRental.rentPrice
    });

    // If active, increment rented count. If reserved (future booking), DO NOT deduct stock until handover/deal finalization!
    if (newRental.status === 'active') {
      setClothes(prev => prev.map(c => {
        if (c.id === rentalData.itemId) {
          const updatedCount = (c.rentedCount || 0) + (rentalData.qty || 1);
          updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updatedCount });
          return { ...c, rentedCount: updatedCount };
        }
        return c;
      }));
      showToast('تم تسجيل الكراء الفوري بنجاح');
    } else {
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
  }, []);

  const handleActivateRental = useCallback((rental: Rental, collectedAmount: number = 0, handoverNotes: string = '') => {
    const newPaid = (rental.paidAmount || 0) + (collectedAmount || 0);
    const newRemaining = Math.max(0, rental.rentPrice - newPaid);
    const todayStr = new Date().toISOString().split('T')[0];
    const notesStr = handoverNotes ? `${rental.notes ? rental.notes + ' | ' : ''}تسليم: ${handoverNotes}` : rental.notes;

    // 1. Activate rental and update payments
    setRentals(prev => prev.map(r => {
      if (r.id === rental.id) {
        return {
          ...r,
          status: 'active',
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          handoverDate: todayStr,
          notes: notesStr
        };
      }
      return r;
    }));
    updateItemInFirebase(FIREBASE_COLLECTIONS.RENTALS, rental.id, {
      status: 'active',
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      handoverDate: todayStr,
      notes: notesStr
    });

    // 2. DEDUCT INVENTORY: Increment rented count upon deal finalization/handover!
    setClothes(prev => prev.map(c => {
      if (c.id === rental.itemId) {
        const updatedCount = (c.rentedCount || 0) + (rental.qty || 1);
        updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updatedCount });
        return { ...c, rentedCount: updatedCount };
      }
      return c;
    }));

    // 3. Update or clear credit
    setCredits(prev => {
      const filtered = prev.filter(c => c.relatedRentalId !== rental.id);
      prev.filter(c => c.relatedRentalId === rental.id).forEach(c => {
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, c.id);
      });
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

    addActivityLog({
      actionType: 'deal',
      category: 'rentals',
      title: 'تسليم وتفعيل حجز فستان',
      details: `تسليم الفستان ${rental.itemName} للزبونة ${rental.customerName} وتفعيل عقد الكراء`,
      amount: rental.rentPrice
    });

    showToast('تمت الصفقة وتسليم الفستان بنجاح! دخل الفستان في الكراء الجاري وتم خصمه من المخزن');
  }, []);

  const handleUpdateRental = useCallback((id: string, updatedData: any) => {
    addActivityLog({
      actionType: 'update',
      category: 'rentals',
      title: 'تعديل بيانات كراء فستان',
      details: `تحديث بيانات الكراء للقطعة أو الحجز`
    });
    setRentals(prev => {
      const prevRental = prev.find(r => r.id === id);
      if (prevRental) {
        const wasActive = prevRental.status === 'active';
        const isNowActive = updatedData.status === 'active';
        
        if (!wasActive && isNowActive) {
          // Transitioned to active -> increment item rentedCount
          setClothes(clothesPrev => clothesPrev.map(c => {
            if (c.id === updatedData.itemId) {
              const updatedCount = (c.rentedCount || 0) + (updatedData.qty || 1);
              updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updatedCount });
              return { ...c, rentedCount: updatedCount };
            }
            return c;
          }));
        } else if (wasActive && !isNowActive) {
          // Transitioned from active to reserved or returned -> decrement item rentedCount
          setClothes(clothesPrev => clothesPrev.map(c => {
            if (c.id === prevRental.itemId) {
              const updatedCount = Math.max(0, (c.rentedCount || 0) - (prevRental.qty || 1));
              updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updatedCount });
              return { ...c, rentedCount: updatedCount };
            }
            return c;
          }));
        }
      }
      return prev.map(r => r.id === id ? { ...r, ...updatedData } : r);
    });

    updateItemInFirebase(FIREBASE_COLLECTIONS.RENTALS, id, updatedData);
    showToast('تم تحديث بيانات الكراء');
    setActiveModal(null);
  }, []);

  const handleDeleteRental = useCallback((id: string) => {
    setRentals(currentRentals => {
      const target = currentRentals.find(r => r.id === id);
      if (!target) return currentRentals;

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
                const updatedCount = Math.max(0, (c.rentedCount || 0) - (target.qty || 1));
                updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updatedCount });
                return { ...c, rentedCount: updatedCount };
              }
              return c;
            }));
          }
          setRentals(prev => prev.filter(r => r.id !== id));
          deleteItemFromFirebase(FIREBASE_COLLECTIONS.RENTALS, id);

          addActivityLog({
            actionType: 'delete',
            category: 'rentals',
            title: target.status === 'reserved' ? 'إلغاء حجز فستان' : 'حذف عملية كراء فستان',
            details: `حذف كراء أو حجز القطعة ${target.itemName} للزبونة ${target.customerName}`
          });
          setCredits(prev => {
            prev.filter(c => c.relatedRentalId === id).forEach(c => {
              deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, c.id);
            });
            return prev.filter(c => c.relatedRentalId !== id);
          });
          showToast(target.status === 'reserved' ? 'تم إلغاء الحجز بنجاح' : 'تم حذف عملية الكراء بنجاح');
          setConfirmDelete(null);
        }
      });
      return currentRentals;
    });
  }, []);

  const handleConfirmReturn = useCallback((rentalId: string, returnData: any) => {
    setRentals(currentRentals => {
      const target = currentRentals.find(r => r.id === rentalId);
      if (!target) return currentRentals;

      const returnUpdates = {
        status: 'returned',
        actualReturnDate: new Date().toISOString().split('T')[0],
        conditionOnReturn: returnData.condition,
        cautionStatus: returnData.cautionAction === 'refund' ? 'refunded' : 'deducted',
        penaltyAmount: returnData.penaltyAmount,
        paidAmount: target.paidAmount + (returnData.collectedRemaining || 0),
        remainingAmount: Math.max(0, (target.remainingAmount || 0) - (returnData.collectedRemaining || 0)),
        notes: returnData.notes ? `${target.notes ? target.notes + ' | ' : ''}إرجاع: ${returnData.notes}` : target.notes
      };

      // Update rental status
      updateItemInFirebase(FIREBASE_COLLECTIONS.RENTALS, rentalId, returnUpdates);

      // Update inventory: decrease rentedCount, add to inCleaningCount if requested
      setClothes(prev => prev.map(c => {
        if (c.id === target.itemId) {
          const newRented = Math.max(0, (c.rentedCount || 0) - (target.qty || 1));
          const newCleaning = returnData.sendToCleaning ? (c.inCleaningCount || 0) + (target.qty || 1) : (c.inCleaningCount || 0);
          updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, {
            rentedCount: newRented,
            inCleaningCount: newCleaning
          });
          return {
            ...c,
            rentedCount: newRented,
            inCleaningCount: newCleaning
          };
        }
        return c;
      }));

      // If penalty was deducted or caution kept as revenue/compensation
      if (returnData.penaltyAmount > 0) {
        showToast(`تم استرجاع الفستان وخصم غرامة بقيمة ${returnData.penaltyAmount} دج`);
      } else {
        showToast('تم تأكيد استرجاع الفستان وتسوية الحساب بنجاح');
      }

      // Auto clear linked credit if collected
      if (returnData.collectedRemaining > 0) {
        setCredits(prev => {
          prev.filter(c => c.relatedRentalId === rentalId).forEach(c => {
            deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, c.id);
          });
          return prev.filter(c => c.relatedRentalId !== rentalId);
        });
      }

      return currentRentals.map(r => r.id === rentalId ? { ...r, ...returnUpdates } : r);
    });

    addActivityLog({
      actionType: 'return',
      category: 'rentals',
      title: 'استرجاع فستان من الكراء',
      details: `استرجاع الفستان للزبونة وتسوية الحساب`,
    });

    setActiveModal(null);
  }, []);

  // ==========================
  // CLOTHES & INVENTORY HANDLERS
  // ==========================
  const handleAddCloth = useCallback((itemData: any) => {
    const newCloth: ClothItem = { ...itemData, id: generateId() };
    setClothes(prev => [newCloth, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.CLOTHES, newCloth);

    addActivityLog({
      actionType: 'create',
      category: 'inventory',
      title: 'إضافة قطعة ملابس جديدة للمخزن',
      details: `إضافة فستان/قطعة: ${itemData.name} (مقاس ${itemData.size} - لون ${itemData.color})`,
      amount: itemData.sellPrice || itemData.rentPrice,
      itemCodeOrId: itemData.barcode
    });

    showToast('تمت إضافة قطعة الملابس للمخزن');
  }, []);

  const handleUpdateCloth = useCallback((id: string, itemData: any) => {
    setClothes(prev => prev.map(c => c.id === id ? { ...c, ...itemData } : c));
    updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, id, itemData);

    addActivityLog({
      actionType: 'update',
      category: 'inventory',
      title: 'تعديل قطعة ملابس في المخزن',
      details: `تحديث بيانات ومخزون القطعة`,
      itemCodeOrId: id
    });

    showToast('تم تحديث بيانات القطعة');
  }, []);

  const handleDeleteCloth = useCallback((id: string) => {
    setConfirmDelete({
      title: 'حذف قطعة من المخزن',
      message: 'هل أنت متأكد من حذف هذه القطعة من المخزن؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: () => {
        setClothes(prev => prev.filter(c => c.id !== id));
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.CLOTHES, id);

        addActivityLog({
          actionType: 'delete',
          category: 'inventory',
          title: 'حذف قطعة من المخزن',
          details: `حذف نهائي لقطعة ملابس من المخزن`,
          itemCodeOrId: id
        });

        showToast('تم حذف القطعة من المخزن');
        setConfirmDelete(null);
      }
    });
  }, []);

  // ==========================
  // SALES HANDLERS
  // ==========================
  const handleCompleteSale = useCallback((saleData: any) => {
    const newSale: Sale = { ...saleData, id: generateId() };
    setSales(prev => [newSale, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.SALES, newSale);

    addActivityLog({
      actionType: 'create',
      category: 'sales',
      title: 'تسجيل عملية بيع ملابس',
      details: `بيع مباشر للزبون ${saleData.customerName || 'عام'} بقيمة ${saleData.totalAmount} دج`,
      amount: saleData.totalAmount
    });

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

          const updatedCloth = { 
            ...c, 
            stock1: newS1,
            stock2: newS2,
            stock: newS1 + newS2 
          };
          updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, {
            stock1: newS1,
            stock2: newS2,
            stock: newS1 + newS2
          });
          return updatedCloth;
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
      saveItemToFirebase(FIREBASE_COLLECTIONS.CREDITS, newCredit);
    }

    showToast('تم إتمام عملية البيع بنجاح');
  }, []);

  const handleDeleteSale = useCallback((sale: Sale) => {
    setConfirmDelete({
      title: 'إلغاء عملية البيع',
      message: 'هل تريد إلغاء عملية البيع واسترجاع القطع للمخزن؟',
      onConfirm: () => {
        setSales(prev => prev.filter(s => s.id !== sale.id));
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.SALES, sale.id);

        addActivityLog({
          actionType: 'delete',
          category: 'sales',
          title: 'إلغاء عملية بيع',
          details: `إلغاء فاتورة بيع للزبون ${sale.customerName || 'عام'} واسترجاع القطع للمخزن`,
          amount: sale.totalAmount
        });
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

              const updatedCloth = { 
                ...c, 
                stock1: newS1,
                stock2: newS2,
                stock: newS1 + newS2 
              };
              updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, {
                stock1: newS1,
                stock2: newS2,
                stock: newS1 + newS2
              });
              return updatedCloth;
            }
            return c;
          }));
        });
        showToast('تم إلغاء البيع واسترجاع المخزون');
        setConfirmDelete(null);
      }
    });
  }, []);

  // ==========================
  // EXPENSES, SUPPLIERS & CREDITS
  // ==========================
  const handleAddExpense = useCallback((expData: any) => {
    const newExpId = generateId();
    const newExp: Expense = { ...expData, id: newExpId };
    setExpenses(prev => [newExp, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.EXPENSES, newExp);

    addActivityLog({
      actionType: 'create',
      category: 'expenses',
      title: expData.isSupplierPurchase ? 'تسجيل مشتريات وموردين' : 'تسجيل مصروف جديد',
      details: `${expData.category}: ${expData.desc || expData.goodsDescription} (${expData.amount} دج)`,
      amount: expData.amount
    });

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
      saveItemToFirebase(FIREBASE_COLLECTIONS.CREDITS, newCredit);
      showToast(`تم تسجيل مشتريات المورد (المسدد: ${expData.paidAmount?.toLocaleString()} دج + متبقي دين: ${expData.creditAmount?.toLocaleString()} دج)`);
    } else if (expData.isSupplierPurchase) {
      showToast(`تم تسجيل خلاص المورد بنجاح (${(expData.paidAmount || expData.amount)?.toLocaleString()} دج كاش)`);
    } else {
      showToast('تم تسجيل المصروف بنجاح');
    }
  }, []);

  const handleDeleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    deleteItemFromFirebase(FIREBASE_COLLECTIONS.EXPENSES, id);
    setCredits(prev => {
      prev.filter(c => c.relatedExpenseId === id).forEach(c => {
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, c.id);
      });
      return prev.filter(c => c.relatedExpenseId !== id);
    });

    addActivityLog({
      actionType: 'delete',
      category: 'expenses',
      title: 'حذف مصروف أو مشتريات',
      details: `حذف قيد مصروف أو مشتريات من السجل`
    });

    showToast('تم حذف سجل المصروف');
  }, []);

  const handleSettleSupplierCredit = useCallback((expenseId: string, paidNow: number) => {
    // 1. Update expense record
    setExpenses(prev => prev.map(exp => {
      if (exp.id === expenseId) {
        const currentPaid = exp.paidAmount !== undefined ? exp.paidAmount : exp.amount;
        const currentCredit = exp.creditAmount || 0;
        const newPaid = currentPaid + paidNow;
        const newCredit = Math.max(0, currentCredit - paidNow);
        const updatedExp = {
          ...exp,
          paidAmount: newPaid,
          amount: newPaid,
          creditAmount: newCredit
        };
        updateItemInFirebase(FIREBASE_COLLECTIONS.EXPENSES, expenseId, {
          paidAmount: newPaid,
          amount: newPaid,
          creditAmount: newCredit
        });
        return updatedExp;
      }
      return exp;
    }));

    // 2. Update or settle linked credit record
    setCredits(prev => {
      return prev.map(c => {
        if (c.relatedExpenseId === expenseId) {
          const newAmount = Math.max(0, c.amount - paidNow);
          if (newAmount === 0) {
            deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, c.id);
          } else {
            updateItemInFirebase(FIREBASE_COLLECTIONS.CREDITS, c.id, { amount: newAmount });
          }
          return { ...c, amount: newAmount };
        }
        return c;
      }).filter(c => c.amount > 0);
    });

    addActivityLog({
      actionType: 'payment',
      category: 'expenses',
      title: 'خلاص وتسديد دين مورد',
      details: `تسديد مبلغ ${paidNow.toLocaleString()} دج للمورد`,
      amount: paidNow
    });

    showToast(`تم خلاص وتسديد مبلغ ${paidNow.toLocaleString()} دج للمورد بنجاح`);
  }, []);

  const handleAddSupplier = useCallback((newSup: Supplier) => {
    setSuppliers(prev => {
      if (prev.some(s => s.name.trim().toLowerCase() === newSup.name.trim().toLowerCase())) return prev;
      saveItemToFirebase(FIREBASE_COLLECTIONS.SUPPLIERS, newSup);
      return [newSup, ...prev];
    });

    addActivityLog({
      actionType: 'create',
      category: 'partners',
      title: 'إضافة مورد جديد',
      details: `إضافة المورد: ${newSup.name}`
    });

    showToast(`تمت إضافة المورد: ${newSup.name}`);
  }, []);

  const handleUpdateSupplier = useCallback((id: string, data: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    updateItemInFirebase(FIREBASE_COLLECTIONS.SUPPLIERS, id, data);

    addActivityLog({
      actionType: 'update',
      category: 'partners',
      title: 'تعديل بيانات مورد',
      details: `تحديث بيانات المورد`
    });

    showToast('تم تحديث بيانات المورد');
  }, []);

  const handleDeleteSupplier = useCallback((id: string) => {
    setConfirmDelete({
      title: 'حذف المورد',
      message: 'هل أنت متأكد من حذف هذا المورد؟',
      onConfirm: () => {
        setSuppliers(prev => {
          const next = prev.filter(s => s.id !== id);
          saveToStorage(STORAGE_KEYS.SUPPLIERS, next, true);
          return next;
        });
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.SUPPLIERS, id);

        addActivityLog({
          actionType: 'delete',
          category: 'partners',
          title: 'حذف مورد',
          details: `حذف مورد من قائمة الشركاء`
        });

        showToast('تم حذف المورد بنجاح');
        setConfirmDelete(null);
      }
    });
  }, []);

  // ==========================
  // SEAMSTRESSES & RAW MATERIALS HANDLERS
  // ==========================
  const handleAddSeamstress = useCallback((seam: Seamstress) => {
    setSeamstresses(prev => [seam, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.SEAMSTRESSES, seam);

    addActivityLog({
      actionType: 'create',
      category: 'partners',
      title: 'إضافة خياطة جديدة',
      details: `إضافة الخياطة: ${seam.name}`
    });

    showToast(`تمت إضافة الخياطة: ${seam.name}`);
  }, []);

  const handleUpdateSeamstress = useCallback((id: string, data: Partial<Seamstress>) => {
    setSeamstresses(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    updateItemInFirebase(FIREBASE_COLLECTIONS.SEAMSTRESSES, id, data);

    addActivityLog({
      actionType: 'update',
      category: 'partners',
      title: 'تعديل بيانات خياطة',
      details: `تحديث بيانات الخياطة`
    });

    showToast('تم تحديث بيانات الخياطة');
  }, []);

  const handleDeleteSeamstress = useCallback((id: string) => {
    setConfirmDelete({
      title: 'حذف الخياطة',
      message: 'هل تريد حذف هذه الخياطة من النظام؟',
      onConfirm: () => {
        setSeamstresses(prev => {
          const next = prev.filter(s => s.id !== id);
          saveToStorage(STORAGE_KEYS.SEAMSTRESSES, next, true);
          return next;
        });
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.SEAMSTRESSES, id);

        addActivityLog({
          actionType: 'delete',
          category: 'partners',
          title: 'حذف خياطة',
          details: `حذف خياطة من القائمة`
        });

        showToast('تم حذف الخياطة');
        setConfirmDelete(null);
      }
    });
  }, []);

  const handleAddRawMaterial = useCallback((mat: RawMaterial) => {
    setRawMaterials(prev => [mat, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.RAW_MATERIALS, mat);

    addActivityLog({
      actionType: 'create',
      category: 'inventory',
      title: 'إضافة رولو قماش أو سلعة أولية',
      details: `إضافة القماش: ${mat.name} (${mat.fabricType})`,
      amount: mat.totalCostValue
    });

    showToast(`تمت إضافة القماش / السلعة: ${mat.name}`);
  }, []);

  const handleUpdateRawMaterial = useCallback((id: string, data: Partial<RawMaterial>) => {
    setRawMaterials(prev => prev.map(m => m.id === id ? { ...m, ...data, updatedAt: new Date().toISOString() } : m));
    updateItemInFirebase(FIREBASE_COLLECTIONS.RAW_MATERIALS, id, { ...data, updatedAt: new Date().toISOString() });

    addActivityLog({
      actionType: 'update',
      category: 'inventory',
      title: 'تعديل رولو قماش',
      details: `تحديث بيانات القماش`
    });

    showToast('تم تحديث بيانات القماش');
  }, []);

  const handleDeleteRawMaterial = useCallback((id: string) => {
    setConfirmDelete({
      title: 'حذف السلعة الأولية أو القماش',
      message: 'هل أنت متأكد من حذف هذا القماش من سجل المخزن؟',
      onConfirm: () => {
        setRawMaterials(prev => prev.filter(m => m.id !== id));
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.RAW_MATERIALS, id);

        addActivityLog({
          actionType: 'delete',
          category: 'inventory',
          title: 'حذف قماش أولي',
          details: `حذف سلعة من مخزن الأقمشة`
        });

        showToast('تم حذف القماش بنجاح');
        setConfirmDelete(null);
      }
    });
  }, []);

  const handleAddCredit = useCallback((credData: any) => {
    const newCred: Credit = { ...credData, id: generateId() };
    setCredits(prev => [newCred, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.CREDITS, newCred);

    addActivityLog({
      actionType: 'create',
      category: 'credits',
      title: 'تسجيل دين / كريدي جديد',
      details: `تسجيل دين للزبون ${credData.name}: ${credData.desc} بقيمة ${credData.amount} دج`,
      amount: credData.amount
    });

    showToast(credData.supplierDebt ? 'تم تسجيل دين للمورد' : 'تم تسجيل الدين على الزبون');
  }, []);

  const handleSettleCredit = useCallback((id: string) => {
    setCredits(currentCredits => {
      const cred = currentCredits.find(c => c.id === id);
      if (cred && cred.relatedExpenseId) {
        // Also update linked expense when settled from credits view
        setExpenses(prev => prev.map(exp => {
          if (exp.id === cred.relatedExpenseId) {
            const currentPaid = exp.paidAmount !== undefined ? exp.paidAmount : exp.amount;
            const newPaid = currentPaid + cred.amount;
            const updated = {
              ...exp,
              paidAmount: newPaid,
              amount: newPaid,
              creditAmount: 0
            };
            updateItemInFirebase(FIREBASE_COLLECTIONS.EXPENSES, cred.relatedExpenseId!, {
              paidAmount: newPaid,
              amount: newPaid,
              creditAmount: 0
            });
            return updated;
          }
          return exp;
        }));
      }
      deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, id);
      return currentCredits.filter(c => c.id !== id);
    });

    addActivityLog({
      actionType: 'payment',
      category: 'credits',
      title: 'تسديد وتصفية دين',
      details: `تسديد الدين بالكامل وإبراء ذمة الزبون أو المورد`
    });

    showToast('تم تسديد وتصفية الدين بنجاح');
  }, []);

  const handleDeleteCredit = useCallback((id: string) => {
    setCredits(prev => prev.filter(c => c.id !== id));
    deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, id);

    addActivityLog({
      actionType: 'delete',
      category: 'credits',
      title: 'حذف قيد دين',
      details: `حذف سجل دين من النظام`
    });

    showToast('تم حذف السجل');
  }, []);

  // ==========================
  // CAISSE (CASH REGISTER) HANDLERS
  // ==========================
  const handleSaveCaisseClosure = useCallback((closure: DailyCaisseClosure) => {
    setCaisseClosures(prev => {
      const filtered = prev.filter(c => c.date !== closure.date);
      return [closure, ...filtered];
    });
    saveItemToFirebase(FIREBASE_COLLECTIONS.CAISSE_CLOSURES, closure);

    addActivityLog({
      actionType: 'closure',
      category: 'caisse',
      title: 'إقفال الصندوق اليومي',
      details: `إقفال صندوق يوم ${closure.date}. الحالة: ${closure.status} (الفارق: ${closure.difference} دج)`,
      amount: closure.actualAmount
    });

    showToast(`تم إقفال وحفظ صندوق يوم ${closure.date} بنجاح`);
  }, []);

  const handleDeleteCaisseClosure = useCallback((id: string) => {
    setConfirmDelete({
      title: 'حذف إقفال الصندوق',
      message: 'هل أنت متأكد من حذف هذا السجل لصندوق اليومية؟',
      onConfirm: () => {
        setCaisseClosures(prev => prev.filter(c => c.id !== id));
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.CAISSE_CLOSURES, id);

        addActivityLog({
          actionType: 'delete',
          category: 'caisse',
          title: 'حذف إقفال صندوق',
          details: `حذف سجل إقفال الصندوق اليومي`
        });

        showToast('تم حذف سجل إقفال الصندوق');
        setConfirmDelete(null);
      }
    });
  }, []);

  // ==========================
  // STAFF & ABSENCES HANDLERS
  // ==========================
  const handleAddStaffPayout = useCallback((data: any, deductedAbsenceIds?: string[]) => {
    const payoutId = generateId();
    const newPayout: StaffPayout = { ...data, id: payoutId };
    setStaffPayouts(prev => [newPayout, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.STAFF_PAYOUTS, newPayout);

    // If absences were deducted in this payout, mark them as deducted
    if (deductedAbsenceIds && deductedAbsenceIds.length > 0) {
      setStaffAbsences(prev => prev.map(a => {
        if (deductedAbsenceIds.includes(a.id)) {
          const updated = { ...a, isDeducted: true, payoutId };
          updateItemInFirebase(FIREBASE_COLLECTIONS.STAFF_ABSENCES, a.id, { isDeducted: true, payoutId });
          return updated;
        }
        return a;
      }));
    }

    addActivityLog({
      actionType: 'payment',
      category: 'staff',
      title: 'صرف راتب أو دفعة لعامل',
      details: `صرف مبلغ ${data.amount} دج للعامل ${data.name}`,
      amount: data.amount
    });

    showToast('تم صرف الراتب وتطبيق خصم الغيابات بنجاح');
  }, []);

  const handleDeleteStaffPayout = useCallback((id: string) => {
    setStaffPayouts(prev => prev.filter(p => p.id !== id));
    deleteItemFromFirebase(FIREBASE_COLLECTIONS.STAFF_PAYOUTS, id);
    // Restore deducted status if payout is deleted
    setStaffAbsences(prev => prev.map(a => {
      if (a.payoutId === id) {
        updateItemInFirebase(FIREBASE_COLLECTIONS.STAFF_ABSENCES, a.id, { isDeducted: false, payoutId: null });
        return { ...a, isDeducted: false, payoutId: undefined };
      }
      return a;
    }));

    addActivityLog({
      actionType: 'delete',
      category: 'staff',
      title: 'حذف سجل راتب',
      details: `حذف دفعة أو راتب عامل`
    });

    showToast('تم حذف سجل الراتب');
  }, []);

  const handleAddStaffMember = useCallback((data: any) => {
    const newMember: StaffMember = { ...data, id: generateId() };
    setStaffMembers(prev => [...prev, newMember]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.STAFF_MEMBERS, newMember);

    addActivityLog({
      actionType: 'create',
      category: 'staff',
      title: 'إضافة موظف جديد',
      details: `إضافة العامل: ${data.name}`,
      amount: data.baseSalary
    });

    showToast(`تمت إضافة العامل/ة ${data.name}`);
  }, []);

  const handleUpdateStaffMember = useCallback((id: string, data: any) => {
    setStaffMembers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    updateItemInFirebase(FIREBASE_COLLECTIONS.STAFF_MEMBERS, id, data);

    addActivityLog({
      actionType: 'update',
      category: 'staff',
      title: 'تعديل بيانات موظف',
      details: `تحديث بيانات الموظف`
    });

    showToast('تم تحديث بيانات العامل');
  }, []);

  const handleDeleteStaffMember = useCallback((id: string) => {
    setConfirmDelete({
      title: 'حذف العامل',
      message: 'هل تريد حذف هذا العامل من النظام؟',
      onConfirm: () => {
        setStaffMembers(prev => prev.filter(s => s.id !== id));
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.STAFF_MEMBERS, id);

        addActivityLog({
          actionType: 'delete',
          category: 'staff',
          title: 'حذف موظف',
          details: `حذف عامل من الطاقم`
        });

        showToast('تم حذف العامل');
        setConfirmDelete(null);
      }
    });
  }, []);

  const handleAddAbsence = useCallback((data: any) => {
    const newAbsence: StaffAbsence = { ...data, id: generateId() };
    setStaffAbsences(prev => [newAbsence, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.STAFF_ABSENCES, newAbsence);

    addActivityLog({
      actionType: 'create',
      category: 'staff',
      title: 'تسجيل غياب أو خصم موظف',
      details: `تسجيل غياب ${data.staffName} بقيمة خصم ${data.deductionAmount} دج`,
      amount: data.deductionAmount
    });

    showToast(`تم تسجيل غياب ${data.staffName} بقيمة خصم ${data.deductionAmount} دج`);
  }, []);

  const handleDeleteAbsence = useCallback((id: string) => {
    setStaffAbsences(prev => prev.filter(a => a.id !== id));
    deleteItemFromFirebase(FIREBASE_COLLECTIONS.STAFF_ABSENCES, id);

    addActivityLog({
      actionType: 'delete',
      category: 'staff',
      title: 'حذف سجل غياب',
      details: `حذف سجل غياب موظف`
    });

    showToast('تم حذف سجل الغياب');
  }, []);

  // ==========================
  // TAILORING & MAINTENANCE HANDLERS
  // ==========================
  const handleAddTailoringOrder = useCallback((data: Partial<MaintenanceOrder>) => {
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
    saveItemToFirebase(FIREBASE_COLLECTIONS.MAINTENANCE, newOrder);

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
      saveItemToFirebase(FIREBASE_COLLECTIONS.CREDITS, newCredit);
    }

    addActivityLog({
      actionType: 'create',
      category: 'tailoring',
      title: 'تسجيل طلب خياطة وصيانة',
      details: `طلب ${newOrder.serviceType} للقطعة ${newOrder.itemName} للزبون ${newOrder.customerName || 'داخلي'}`,
      amount: newOrder.price
    });

    showToast('تم تسجيل طلب الخياطة والصيانة بنجاح');
    setActiveModal(null);
  }, []);

  const handleUpdateTailoringOrder = useCallback((id: string, data: Partial<MaintenanceOrder>) => {
    setMaintenanceOrders(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
    updateItemInFirebase(FIREBASE_COLLECTIONS.MAINTENANCE, id, data);

    addActivityLog({
      actionType: 'update',
      category: 'tailoring',
      title: 'تعديل طلب خياطة',
      details: `تعديل تفاصيل أمر الخياطة والصيانة`
    });

    showToast('تم تحديث بيانات طلب الخياطة');
    setActiveModal(null);
  }, []);

  const handleUpdateTailoringStatus = useCallback((id: string, newStatus: MaintenanceStatus) => {
    const updates = { 
      status: newStatus, 
      actualDeliveryDate: newStatus === 'delivered' ? new Date().toISOString().split('T')[0] : undefined 
    };
    setMaintenanceOrders(prev => prev.map(o => {
      if (o.id === id) {
        return { 
          ...o, 
          ...updates
        };
      }
      return o;
    }));
    updateItemInFirebase(FIREBASE_COLLECTIONS.MAINTENANCE, id, updates);

    addActivityLog({
      actionType: 'update',
      category: 'tailoring',
      title: 'تغيير حالة طلب خياطة',
      details: `تحديث حالة طلب الخياطة والصيانة إلى: ${newStatus}`
    });

    showToast('تم تحديث حالة الطلب');
  }, []);

  const handleDeleteTailoringOrder = useCallback((id: string) => {
    setConfirmDelete({
      title: 'حذف طلب الصيانة والخياطة',
      message: 'هل أنت متأكد من حذف هذا الطلب من سجل الخياطة؟',
      onConfirm: () => {
        setMaintenanceOrders(prev => prev.filter(o => o.id !== id));
        deleteItemFromFirebase(FIREBASE_COLLECTIONS.MAINTENANCE, id);

        addActivityLog({
          actionType: 'delete',
          category: 'tailoring',
          title: 'حذف طلب خياطة',
          details: `حذف أمر خياطة أو صيانة من السجل`
        });

        showToast('تم حذف الطلب بنجاح');
        setConfirmDelete(null);
      }
    });
  }, []);

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
              t.type === 'success' ? 'bg-blue-600' : 'bg-blue-900'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Main Navigation & View Container */}
      <AppNavigation
        onInitNav={handleInitNav}
        onEnsureCollection={handleEnsureCollection}
        overdueCount={overdueCount}
        activeMaintenanceCount={activeMaintenanceCount}
        pendingAbsencesCount={pendingAbsencesCount}
        openBarcodeScan={openBarcodeScan}
        hideFinances={hideFinances}
        toggleFinances={toggleFinances}
        openFullReportModal={openFullReportModal}
        openAddRentalModal={openAddRentalModal}
        openStaffPayoutsModal={openStaffPayoutsModal}
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
        posScannedBarcode={posScannedBarcode}
        onOpenAddRental={handleOpenAddRental}
        onOpenReturnModal={handleOpenReturnModal}
        onSendMessage={handleOpenMessageModal}
        onDeleteLog={handleDeleteLog}
        onClearAllLogs={handleClearAllLogs}
        onAddManualLog={handleAddManualLog}
        onAddRentalWithItem={handleOpenAddRentalWithItem}
        onEditRentalModal={handleOpenEditRentalModal}
        onDeleteRental={handleDeleteRental}
        onActivateRental={handleActivateRental}
        onOpenReceiptModal={handleOpenReceiptModal}
        onAddCloth={handleAddCloth}
        onUpdateCloth={handleUpdateCloth}
        onDeleteCloth={handleDeleteCloth}
        onAddRawMaterial={handleAddRawMaterial}
        onUpdateRawMaterial={handleUpdateRawMaterial}
        onDeleteRawMaterial={handleDeleteRawMaterial}
        onCompleteSale={handleCompleteSale}
        onDeleteSale={handleDeleteSale}
        onClearPosScannedBarcode={handleClearPosScannedBarcode}
        onOpenAddTailoringModal={handleOpenAddTailoringModal}
        onEditTailoringModal={handleOpenEditTailoringModal}
        onDeleteTailoringOrder={handleDeleteTailoringOrder}
        onUpdateTailoringStatus={handleUpdateTailoringStatus}
        onOpenTailoringReceiptModal={handleOpenTailoringReceiptModal}
        onAddExpense={handleAddExpense}
        onDeleteExpense={handleDeleteExpense}
        onSettleSupplierCredit={handleSettleSupplierCredit}
        onAddSupplier={handleAddSupplier}
        onUpdateSupplier={handleUpdateSupplier}
        onDeleteSupplier={handleDeleteSupplier}
        onAddCredit={handleAddCredit}
        onSettleCredit={handleSettleCredit}
        onDeleteCredit={handleDeleteCredit}
        onSaveCaisseClosure={handleSaveCaisseClosure}
        onDeleteCaisseClosure={handleDeleteCaisseClosure}
        onAddSeamstress={handleAddSeamstress}
        onUpdateSeamstress={handleUpdateSeamstress}
        onDeleteSeamstress={handleDeleteSeamstress}
      />

      {/* ================= MODALS ================= */}

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
              <p className="text-xs text-blue-900 font-bold mt-1">تاريخ الإرجاع: {selectedRental.expectedReturnDate}</p>
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
                className="flex-1 py-3.5 bg-blue-900 hover:bg-blue-800 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xs"
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
            <div className="p-4 bg-blue-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-800/80 text-blue-200 border border-blue-700 flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                    <h4 className="font-black text-sm text-white">الربط السحابي مع Firebase مفعل ونشط</h4>
                  </div>
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    معرف المشروع: <span className="font-mono text-white font-bold">{firebaseConfig.projectId}</span>
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
              <label className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer shadow-xs">
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
            const item = clothesBarcodeIndex.get(cleanCode);
            setIsScanning(false);

            if (item) {
              showToast(`تم التعرف على: ${item.name} (${item.size})`);

              if (getCurrentViewRef.current() === 'sales') {
                setPosScannedBarcode(cleanCode);
              } else if (getCurrentViewRef.current() === 'rentals') {
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
                    navRef.current('rentals');
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
                    navRef.current('sales');
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
                  navRef.current('inventory');
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
                  navRef.current('inventory');
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
              onClick={() => { navRef.current('expenses'); setActiveModal(null); }}
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
              onClick={() => { navRef.current('credits'); setActiveModal(null); }}
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
                className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-3 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-md shadow-blue-200 min-h-[44px]"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all min-h-[44px] border border-blue-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
