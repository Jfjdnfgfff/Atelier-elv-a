import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ClothItem, 
  Rental, 
  Sale, 
  Expense, 
  Credit, 
  CreditPayment,
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
  FundSource
} from './types';
import { 
  loadFromStorage, 
  saveToStorage, 
  generateId, 
  STORAGE_KEYS, 
  DEFAULT_CLOTHES,
  DEFAULT_RENTALS,
  DEFAULT_SALES,
  DEFAULT_EXPENSES,
  DEFAULT_CREDITS,
  DEFAULT_CREDIT_PAYMENTS,
  DEFAULT_STAFF,
  DEFAULT_STAFF_PAYOUTS,
  DEFAULT_STAFF_ABSENCES,
  DEFAULT_SUPPLIERS,
  DEFAULT_MAINTENANCE,
  DEFAULT_CAISSE_CLOSURES,
  DEFAULT_RAW_MATERIALS,
  DEFAULT_SEAMSTRESSES,
  DEFAULT_ACTIVITY_LOGS,
  initializeStorage,
  hydrateFromIndexedDB
} from './storage';
import { perfMonitor } from './utils/performanceMonitor';
import {
  isGeneralFundExpense,
  paymentsForCredit,
  generalFundEffectOfPayment
} from './utils/fundBalance';
import { 
  FIREBASE_COLLECTIONS, 
  saveItemToFirebase, 
  updateItemInFirebase, 
  deleteItemFromFirebase, 
  fetchCollectionPage,
  syncCollectionToCloud, 
  migrateEmbeddedCreditPayments,
  SubscriptionManager, 
  areArraysEqual,
  firebaseConfig,
  downloadFullFirebaseBackupDirect
} from './firebase';

import { Modal } from './components/Shared';
import AppNavigation from './components/AppNavigation';
import { TrashModal } from './components/TrashModal';
import { ImageMigrationModal } from './components/ImageMigrationModal';
import { AsyncProductImage } from './components/AsyncProductImage';
import { getListImage } from './utils/imageUtils';
import { imageStore } from './utils/imageStore';
import { preloadIdleViews } from './components/viewRegistry';

// النوافذ المنبثقة تُحمَّل كسلاً وتُجهَّز مسبقاً في وقت الخمول لفتح فوري
const BarcodeScanner = React.lazy(() => import('./components/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })));
const FullReport = React.lazy(() => import('./components/FullReport').then(m => ({ default: m.FullReport })));
const RentalModal = React.lazy(() => import('./components/RentalModal').then(m => ({ default: m.RentalModal })));
const ReturnRentalModal = React.lazy(() => import('./components/ReturnRentalModal').then(m => ({ default: m.ReturnRentalModal })));
const RentalReceiptModal = React.lazy(() => import('./components/RentalReceiptModal').then(m => ({ default: m.RentalReceiptModal })));
const StaffPayoutsModal = React.lazy(() => import('./components/StaffPayoutsModal').then(m => ({ default: m.StaffPayoutsModal })));
const TailoringModal = React.lazy(() => import('./components/TailoringModal').then(m => ({ default: m.TailoringModal })));
const TailoringReceiptModal = React.lazy(() => import('./components/TailoringReceiptModal').then(m => ({ default: m.TailoringReceiptModal })));

// ---------------------------------------------------------------------------
// استراتيجية التحميل المسبق (Preloading Strategy)
// ---------------------------------------------------------------------------
// القاعدة: لا نُنزِّل أي كود لا يحتاجه المستخدم فوراً، لأن ذلك يرفع FCP/LCP
// ويُسجَّل كـ«JavaScript غير مستخدم» في PageSpeed Insights.
// بدلاً من ذلك نعتمد على «نيّة المستخدم» (أول تفاعل) لتمييز الحزم الثقيلة،
// مع شبكة أمان زمنية للاستخدام على الشاشات اللمسية/الواجهات بدون تفاعل.
if (typeof window !== 'undefined') {
  const warmDeferredModals = () => {
    preloadIdleViews(); // تمييز تدريجي لأقسام التطبيق واحداً بعد الآخر
    void import('./components/RentalModal');
    void import('./components/ReturnRentalModal');
    void import('./components/RentalReceiptModal');
    void import('./components/TailoringModal');
    void import('./components/TailoringReceiptModal');
    void import('./components/StaffPayoutsModal');
    void import('./components/FullReport');
  };

  const intentEvents = ['pointerdown', 'touchstart', 'keydown', 'wheel'];
  const onFirstIntent = () => {
    intentEvents.forEach((ev) => window.removeEventListener(ev, onFirstIntent, true));
    warmDeferredModals();
  };

  intentEvents.forEach((ev) =>
    window.addEventListener(ev, onFirstIntent, { capture: true, passive: true })
  );

  // شبكة أمان: إن لم يتفاعل المستخدم إطلاقاً (شاشة عرض/تابلت في المحل) نُجهّز الحزم لاحقاً
  window.setTimeout(onFirstIntent, 15000);
}

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
  Plus,
  Cloud,
  CheckCircle,
  RefreshCw,
  Database
} from 'lucide-react';

initializeStorage();

const PAGE_SIZE = 5;

type PaginatedCollection = 'clothes' | 'sales';

function mergeRecordsById<T extends { id?: string; createdAt?: string; updatedAt?: string; date?: string; timestamp?: string }>(
  current: T[],
  incoming: T[]
): T[] {
  const byId = new Map<string, T>();
  current.forEach(item => item?.id && byId.set(item.id, item));
  incoming.forEach(item => item?.id && byId.set(item.id, item));

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = a.createdAt || a.updatedAt || a.date || a.timestamp || '';
    const bTime = b.createdAt || b.updatedAt || b.date || b.timestamp || '';
    return aTime && bTime ? bTime.localeCompare(aTime) : 0;
  });
}

export default function App() {
  perfMonitor.recordAppRender();

  // مجموعات أساسية تُهيأ فوراً من التخزين المحلي للعرض السريع
  const [clothes, setClothes] = useState<ClothItem[]>(() => loadFromStorage(STORAGE_KEYS.CLOTHES, DEFAULT_CLOTHES));
  const [rentals, setRentals] = useState<Rental[]>(() => loadFromStorage(STORAGE_KEYS.RENTALS, DEFAULT_RENTALS));
  const [caisseClosures, setCaisseClosures] = useState<DailyCaisseClosure[]>(() => loadFromStorage(STORAGE_KEYS.CAISSE_CLOSURES, DEFAULT_CAISSE_CLOSURES));
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => loadFromStorage(STORAGE_KEYS.ACTIVITY_LOGS, DEFAULT_ACTIVITY_LOGS));
  const [sales, setSales] = useState<Sale[]>(() => loadFromStorage(STORAGE_KEYS.SALES, DEFAULT_SALES));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromStorage(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES));
  const [credits, setCredits] = useState<Credit[]>(() => loadFromStorage(STORAGE_KEYS.CREDITS, DEFAULT_CREDITS));
  // رصيد الصندوق العام (الخزينة) — مشترك بين كل الأجهزة عبر إعدادات Firebase
  const [generalFundBalance, setGeneralFundBalance] = useState<number>(() => {
    const stored = Number(loadFromStorage<number>(STORAGE_KEYS.GENERAL_FUND_BALANCE, 0));
    return Number.isFinite(stored) ? stored : 0;
  });

  // مجموعات ثانوية تُحمَّل فقط عند فتح القسم أو النافذة التي تحتاجها
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffAbsences, setStaffAbsences] = useState<StaffAbsence[]>([]);
  const [staffPayouts, setStaffPayouts] = useState<StaffPayout[]>([]);
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [seamstresses, setSeamstresses] = useState<Seamstress[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);

  // المجموعات المحمّلة حالياً في حالة التطبيق
  const loadedCollectionsRef = useRef<Set<string>>(new Set([
    STORAGE_KEYS.CLOTHES,
    STORAGE_KEYS.RENTALS,
    STORAGE_KEYS.CAISSE_CLOSURES,
    STORAGE_KEYS.ACTIVITY_LOGS,
    STORAGE_KEYS.SALES,
    STORAGE_KEYS.EXPENSES,
    STORAGE_KEYS.CREDITS
  ]));

  const paginationRef = useRef<Record<PaginatedCollection, {
    cursor: string | null;
    hasMore: boolean;
    isLoading: boolean;
    initialized: boolean;
  }>>({
    clothes: { cursor: null, hasMore: true, isLoading: false, initialized: false },
    sales: { cursor: null, hasMore: true, isLoading: false, initialized: false }
  });
  const [hasMoreClothes, setHasMoreClothes] = useState(true);
  const [isLoadingMoreClothes, setIsLoadingMoreClothes] = useState(false);
  const [hasMoreSales, setHasMoreSales] = useState(true);
  const [isLoadingMoreSales, setIsLoadingMoreSales] = useState(false);

  // تحميل مجموعة من التخزين المحلي عند الحاجة فقط
  const ensureCollectionLoaded = useCallback((storageKey: string) => {
    if (loadedCollectionsRef.current.has(storageKey)) return;
    loadedCollectionsRef.current.add(storageKey);
    switch (storageKey) {
      case STORAGE_KEYS.SALES:
        setSales(loadFromStorage<Sale[]>(STORAGE_KEYS.SALES, DEFAULT_SALES));
        break;
      case STORAGE_KEYS.EXPENSES:
        setExpenses(loadFromStorage<Expense[]>(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES));
        break;
      case STORAGE_KEYS.CREDITS:
        setCredits(loadFromStorage<Credit[]>(STORAGE_KEYS.CREDITS, DEFAULT_CREDITS));
        break;
      case STORAGE_KEYS.CREDIT_PAYMENTS:
        setCreditPayments(loadFromStorage<CreditPayment[]>(STORAGE_KEYS.CREDIT_PAYMENTS, DEFAULT_CREDIT_PAYMENTS));
        break;
      case STORAGE_KEYS.STAFF_PAYOUTS:
        setStaffPayouts(loadFromStorage<StaffPayout[]>(STORAGE_KEYS.STAFF_PAYOUTS, DEFAULT_STAFF_PAYOUTS));
        break;
      case STORAGE_KEYS.STAFF_MEMBERS:
        setStaffMembers(loadFromStorage<StaffMember[]>(STORAGE_KEYS.STAFF_MEMBERS, DEFAULT_STAFF));
        break;
      case STORAGE_KEYS.STAFF_ABSENCES:
        setStaffAbsences(loadFromStorage<StaffAbsence[]>(STORAGE_KEYS.STAFF_ABSENCES, DEFAULT_STAFF_ABSENCES));
        break;
      case STORAGE_KEYS.MAINTENANCE:
        setMaintenanceOrders(loadFromStorage<MaintenanceOrder[]>(STORAGE_KEYS.MAINTENANCE, DEFAULT_MAINTENANCE));
        break;
      case STORAGE_KEYS.SUPPLIERS:
        setSuppliers(loadFromStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, DEFAULT_SUPPLIERS));
        break;
      case STORAGE_KEYS.SEAMSTRESSES:
        setSeamstresses(loadFromStorage<Seamstress[]>(STORAGE_KEYS.SEAMSTRESSES, DEFAULT_SEAMSTRESSES));
        break;
      case STORAGE_KEYS.RAW_MATERIALS:
        setRawMaterials(loadFromStorage<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, DEFAULT_RAW_MATERIALS));
        break;
      case STORAGE_KEYS.CLOTHES:
        setClothes(loadFromStorage<ClothItem[]>(STORAGE_KEYS.CLOTHES, DEFAULT_CLOTHES));
        break;
      case STORAGE_KEYS.RENTALS:
        setRentals(loadFromStorage<Rental[]>(STORAGE_KEYS.RENTALS, DEFAULT_RENTALS));
        break;
      case STORAGE_KEYS.CAISSE_CLOSURES:
        setCaisseClosures(loadFromStorage<DailyCaisseClosure[]>(STORAGE_KEYS.CAISSE_CLOSURES, DEFAULT_CAISSE_CLOSURES));
        break;
      case STORAGE_KEYS.ACTIVITY_LOGS:
        setActivityLogs(loadFromStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, DEFAULT_ACTIVITY_LOGS));
        break;
    }
  }, []);

  // حالة الاتصال والمزامنة السحابية
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(null);
  const isRemoteUpdateRef = useRef<Record<string, boolean>>({});

  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' }[]>([]);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const [activeModal, setActiveModal] = useState<string | null>(null);

  const navRef = useRef<(view: ViewType) => void>(() => {});
  const getCurrentViewRef = useRef<() => ViewType>(() => 'dashboard');

  const handleInitNav = useCallback((navFn: (view: ViewType) => void, getViewFn: () => ViewType) => {
    navRef.current = navFn;
    getCurrentViewRef.current = getViewFn;
  }, []);

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
    setActivityLogs([]);
    syncCollectionToCloud(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, []);
    showToast('تم مسح جميع سجلات العمليات بنجاح');
  }, [showToast]);

  const handleAddManualLog = useCallback((log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    addActivityLog(log);
  }, [addActivityLog]);

  useEffect(() => {
    const coreRecords = clothes.length + rentals.length + caisseClosures.length + activityLogs.length;
    perfMonitor.markFirstUsableUI(coreRecords);
  }, []);

  useEffect(() => {
    perfMonitor.setFirebaseListenerQuery(() => ({
      count: SubscriptionManager.getActiveSubscriptionsCount(),
      collections: SubscriptionManager.getActiveCollections()
    }));
  }, []);

  // حفظ محلي للمجموعات المحمّلة فقط (الكتابة على القرص تتم في وقت الخمول دون تعطيل الواجهة)
  useEffect(() => {
    const loaded = loadedCollectionsRef.current;
    const collections: Array<[string, unknown]> = [
      [STORAGE_KEYS.CLOTHES, clothes],
      [STORAGE_KEYS.RENTALS, rentals],
      [STORAGE_KEYS.SALES, sales],
      [STORAGE_KEYS.EXPENSES, expenses],
      [STORAGE_KEYS.CREDITS, credits],
      [STORAGE_KEYS.CREDIT_PAYMENTS, creditPayments],
      [STORAGE_KEYS.STAFF_PAYOUTS, staffPayouts],
      [STORAGE_KEYS.STAFF_MEMBERS, staffMembers],
      [STORAGE_KEYS.STAFF_ABSENCES, staffAbsences],
      [STORAGE_KEYS.MAINTENANCE, maintenanceOrders],
      [STORAGE_KEYS.SUPPLIERS, suppliers],
      [STORAGE_KEYS.SEAMSTRESSES, seamstresses],
      [STORAGE_KEYS.RAW_MATERIALS, rawMaterials],
      [STORAGE_KEYS.CAISSE_CLOSURES, caisseClosures],
      [STORAGE_KEYS.ACTIVITY_LOGS, activityLogs]
    ];
    for (const [key, data] of collections) {
      if (loaded.has(key)) saveToStorage(key, data);
    }
  }, [
    clothes, rentals, sales, expenses, credits, creditPayments, staffPayouts,
    staffMembers, staffAbsences, maintenanceOrders, suppliers, seamstresses,
    rawMaterials, caisseClosures, activityLogs
  ]);

  // قراءة مخزون المتصفح ثم مراقبة حالة الاتصال السحابي
  useEffect(() => {
    hydrateFromIndexedDB().then(() => {
      setClothes(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.CLOTHES, DEFAULT_CLOTHES) : prev));
      setRentals(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.RENTALS, DEFAULT_RENTALS) : prev));
      setSales(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.SALES, DEFAULT_SALES) : prev));
      setExpenses(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES) : prev));
      setCredits(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.CREDITS, DEFAULT_CREDITS) : prev));
      setCreditPayments(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.CREDIT_PAYMENTS, DEFAULT_CREDIT_PAYMENTS) : prev));
      setStaffPayouts(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.STAFF_PAYOUTS, DEFAULT_STAFF_PAYOUTS) : prev));
      setStaffMembers(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.STAFF_MEMBERS, DEFAULT_STAFF) : prev));
      setStaffAbsences(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.STAFF_ABSENCES, DEFAULT_STAFF_ABSENCES) : prev));
      setMaintenanceOrders(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.MAINTENANCE, DEFAULT_MAINTENANCE) : prev));
      setSuppliers(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.SUPPLIERS, DEFAULT_SUPPLIERS) : prev));
      setSeamstresses(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.SEAMSTRESSES, DEFAULT_SEAMSTRESSES) : prev));
      setRawMaterials(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.RAW_MATERIALS, DEFAULT_RAW_MATERIALS) : prev));
      setCaisseClosures(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.CAISSE_CLOSURES, DEFAULT_CAISSE_CLOSURES) : prev));
      setActivityLogs(prev => (prev.length === 0 ? loadFromStorage(STORAGE_KEYS.ACTIVITY_LOGS, DEFAULT_ACTIVITY_LOGS) : prev));
    }).catch(err => console.warn('Hydration error:', err));

    const unsub = SubscriptionManager.onConnectionStatus(connected => {
      setIsFirebaseConnected(connected);
    });
    return () => unsub();
  }, []);

  // ترحيل الدفعات المضمّنة داخل الديون القديمة إلى مجموعة مستندات الدفعات المستقلة
  const migratedCreditsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (credits.length === 0) return;
    const legacy = credits.filter(c =>
      Array.isArray(c.payments) && c.payments.length > 0 && !migratedCreditsRef.current.has(c.id)
    );
    if (legacy.length === 0) return;
    legacy.forEach(c => migratedCreditsRef.current.add(c.id));

    const docs: CreditPayment[] = [];
    for (const credit of legacy) {
      for (const payment of credit.payments || []) {
        if (payment?.id) docs.push({ ...payment, creditId: credit.id, createdAt: (payment as any).createdAt || new Date().toISOString() });
      }
    }

    setCreditPayments(prev => {
      const seen = new Set(prev.map(p => p.id));
      const fresh = docs.filter(d => !seen.has(d.id));
      return fresh.length > 0 ? [...fresh, ...prev] : prev;
    });
    setCredits(prev => prev.map(c => (migratedCreditsRef.current.has(c.id) && Array.isArray(c.payments) && c.payments.length > 0 ? { ...c, payments: undefined } : c)));

    migrateEmbeddedCreditPayments(legacy);
  }, [credits]);

  const subscribeToCollection = useCallback((collection: string, options?: { limit?: number; sort?: boolean }): () => void => {
    switch (collection) {
      case FIREBASE_COLLECTIONS.CLOTHES: {
        const onClothes = (items: ClothItem[]) => {
          if (!Array.isArray(items)) return;
          loadedCollectionsRef.current.add(STORAGE_KEYS.CLOTHES);

          if (options?.limit) {
            const pageState = paginationRef.current.clothes;
            const wasInitialized = pageState.initialized;
            if (!wasInitialized || !pageState.cursor) {
              pageState.cursor = items[0]?.id || pageState.cursor;
            }
            pageState.initialized = true;
            setHasMoreClothes(items.length >= options.limit);
            pageState.hasMore = items.length >= options.limit;
            const pageItems = items.slice().reverse();
            setClothes(prev => {
              const next = wasInitialized ? mergeRecordsById(prev, pageItems) : pageItems;
              return areArraysEqual(prev, next) ? prev : next;
            });
          } else {
            setClothes(prev => areArraysEqual(prev, items) ? prev : items);
          }
        };

        if (options?.limit) {
          return SubscriptionManager.subscribe<ClothItem>(
            FIREBASE_COLLECTIONS.CLOTHES,
            onClothes,
            { limit: options.limit, sort: false }
          );
        }

        return SubscriptionManager.subscribeGranular<ClothItem>(
          FIREBASE_COLLECTIONS.CLOTHES,
          onClothes,
          { sort: false }
        );
      }
      case FIREBASE_COLLECTIONS.RENTALS:
        return SubscriptionManager.subscribe<Rental>(FIREBASE_COLLECTIONS.RENTALS, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.RENTALS);
            setRentals(prev => areArraysEqual(prev, items) ? prev : items);
          }
        }, { limit: 150, ...options });
      case FIREBASE_COLLECTIONS.CAISSE_CLOSURES:
        return SubscriptionManager.subscribe<DailyCaisseClosure>(FIREBASE_COLLECTIONS.CAISSE_CLOSURES, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.CAISSE_CLOSURES);
            setCaisseClosures(prev => areArraysEqual(prev, items) ? prev : items);
          }
        }, { limit: 90, ...options });
      case FIREBASE_COLLECTIONS.SALES: {
        const onSales = (items: Sale[]) => {
          if (!Array.isArray(items)) return;
          loadedCollectionsRef.current.add(STORAGE_KEYS.SALES);

          if (options?.limit) {
            const pageState = paginationRef.current.sales;
            const wasInitialized = pageState.initialized;
            if (!wasInitialized || !pageState.cursor) {
              pageState.cursor = items[0]?.id || pageState.cursor;
            }
            pageState.initialized = true;
            setHasMoreSales(items.length >= options.limit);
            pageState.hasMore = items.length >= options.limit;
            const pageItems = items.slice().reverse();
            setSales(prev => {
              const next = wasInitialized ? mergeRecordsById(prev, pageItems) : pageItems;
              return areArraysEqual(prev, next) ? prev : next;
            });
          } else {
            setSales(prev => areArraysEqual(prev, items) ? prev : items);
          }
        };

        return SubscriptionManager.subscribe<Sale>(
          FIREBASE_COLLECTIONS.SALES,
          onSales,
          { limit: options?.limit || 150, ...options }
        );
      }
      case FIREBASE_COLLECTIONS.EXPENSES:
        return SubscriptionManager.subscribe<Expense>(FIREBASE_COLLECTIONS.EXPENSES, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.EXPENSES);
            setExpenses(prev => areArraysEqual(prev, items) ? prev : items);
          }
        }, { limit: 150, ...options });
      case FIREBASE_COLLECTIONS.CREDITS:
        return SubscriptionManager.subscribe<Credit>(FIREBASE_COLLECTIONS.CREDITS, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.CREDITS);
            setCredits(prev => areArraysEqual(prev, items) ? prev : items);
          }
        }, { limit: 150, ...options });
      case FIREBASE_COLLECTIONS.CREDIT_PAYMENTS:
        return SubscriptionManager.subscribe<CreditPayment>(FIREBASE_COLLECTIONS.CREDIT_PAYMENTS, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.CREDIT_PAYMENTS);
            setCreditPayments(prev => areArraysEqual(prev, items) ? prev : items);
          }
        }, { limit: 500, ...options });
      case FIREBASE_COLLECTIONS.STAFF_PAYOUTS:
        return SubscriptionManager.subscribe<StaffPayout>(FIREBASE_COLLECTIONS.STAFF_PAYOUTS, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.STAFF_PAYOUTS);
            setStaffPayouts(prev => areArraysEqual(prev, items) ? prev : items);
          }
        });
      case FIREBASE_COLLECTIONS.STAFF_MEMBERS:
        return SubscriptionManager.subscribe<StaffMember>(FIREBASE_COLLECTIONS.STAFF_MEMBERS, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.STAFF_MEMBERS);
            setStaffMembers(prev => areArraysEqual(prev, items) ? prev : items);
          }
        });
      case FIREBASE_COLLECTIONS.STAFF_ABSENCES:
        return SubscriptionManager.subscribe<StaffAbsence>(FIREBASE_COLLECTIONS.STAFF_ABSENCES, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.STAFF_ABSENCES);
            setStaffAbsences(prev => areArraysEqual(prev, items) ? prev : items);
          }
        });
      case FIREBASE_COLLECTIONS.MAINTENANCE:
        return SubscriptionManager.subscribe<MaintenanceOrder>(FIREBASE_COLLECTIONS.MAINTENANCE, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.MAINTENANCE);
            setMaintenanceOrders(prev => areArraysEqual(prev, items) ? prev : items);
          }
        });
      case FIREBASE_COLLECTIONS.SUPPLIERS:
        return SubscriptionManager.subscribe<Supplier>(FIREBASE_COLLECTIONS.SUPPLIERS, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.SUPPLIERS);
            setSuppliers(prev => areArraysEqual(prev, items) ? prev : items);
          }
        });
      case FIREBASE_COLLECTIONS.SEAMSTRESSES:
        return SubscriptionManager.subscribe<Seamstress>(FIREBASE_COLLECTIONS.SEAMSTRESSES, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.SEAMSTRESSES);
            setSeamstresses(prev => areArraysEqual(prev, items) ? prev : items);
          }
        });
      case FIREBASE_COLLECTIONS.RAW_MATERIALS:
        return SubscriptionManager.subscribe<RawMaterial>(FIREBASE_COLLECTIONS.RAW_MATERIALS, (items) => {
          if (Array.isArray(items)) {
            loadedCollectionsRef.current.add(STORAGE_KEYS.RAW_MATERIALS);
            setRawMaterials(prev => areArraysEqual(prev, items) ? prev : items);
          }
        });
      case FIREBASE_COLLECTIONS.ACTIVITY_LOGS:
        return SubscriptionManager.subscribe<ActivityLog>(
          FIREBASE_COLLECTIONS.ACTIVITY_LOGS, 
          (items) => {
            if (Array.isArray(items)) {
              loadedCollectionsRef.current.add(STORAGE_KEYS.ACTIVITY_LOGS);
              setActivityLogs(prev => areArraysEqual(prev, items) ? prev : items);
            }
          }, 
          { limit: 200 }
        );
      default:
        return () => {};
    }
  }, []);

  // ما يحتاجه كل قسم من مجموعات التخزين المحلي
  const VIEW_STORAGE_MAP: Record<ViewType, readonly string[]> = {
    dashboard: [
      STORAGE_KEYS.CLOTHES,
      STORAGE_KEYS.RENTALS,
      STORAGE_KEYS.SALES,
      STORAGE_KEYS.EXPENSES,
      STORAGE_KEYS.CREDITS,
      STORAGE_KEYS.CREDIT_PAYMENTS,
      STORAGE_KEYS.STAFF_PAYOUTS,
      STORAGE_KEYS.MAINTENANCE,
      STORAGE_KEYS.CAISSE_CLOSURES,
      STORAGE_KEYS.ACTIVITY_LOGS
    ],
    rentals: [
      STORAGE_KEYS.RENTALS, 
      STORAGE_KEYS.CLOTHES
    ],
    inventory: [
      STORAGE_KEYS.CLOTHES,
      STORAGE_KEYS.RAW_MATERIALS,
      STORAGE_KEYS.SUPPLIERS
    ],
    sales: [
      STORAGE_KEYS.SALES, 
      STORAGE_KEYS.CLOTHES
    ],
    tailoring: [
      STORAGE_KEYS.MAINTENANCE, 
      STORAGE_KEYS.CLOTHES, 
      STORAGE_KEYS.STAFF_MEMBERS
    ],
    expenses: [
      STORAGE_KEYS.EXPENSES, 
      STORAGE_KEYS.SUPPLIERS, 
      STORAGE_KEYS.CREDITS,
      STORAGE_KEYS.CREDIT_PAYMENTS
    ],
    credits: [
      STORAGE_KEYS.CREDITS, 
      STORAGE_KEYS.CREDIT_PAYMENTS,
      STORAGE_KEYS.SUPPLIERS
    ],
    partners: [
      STORAGE_KEYS.SUPPLIERS, 
      STORAGE_KEYS.SEAMSTRESSES,
      STORAGE_KEYS.EXPENSES,
      STORAGE_KEYS.MAINTENANCE,
      STORAGE_KEYS.CREDITS,
      STORAGE_KEYS.CREDIT_PAYMENTS
    ],
    caisse: [
      STORAGE_KEYS.CAISSE_CLOSURES,
      STORAGE_KEYS.SALES,
      STORAGE_KEYS.RENTALS,
      STORAGE_KEYS.EXPENSES,
      STORAGE_KEYS.CREDITS,
      STORAGE_KEYS.CREDIT_PAYMENTS,
      STORAGE_KEYS.STAFF_PAYOUTS,
      STORAGE_KEYS.MAINTENANCE
    ],
    customers: [],
    logs: [
      STORAGE_KEYS.ACTIVITY_LOGS
    ]
  };

  // ما يحتاجه كل قسم من مجموعات السحابة (اشتراكات عند الدخول للقسم فقط)
  const VIEW_COLLECTIONS_MAP: Record<ViewType, readonly string[]> = {
    dashboard: [
      FIREBASE_COLLECTIONS.CLOTHES,
      FIREBASE_COLLECTIONS.RENTALS,
      FIREBASE_COLLECTIONS.SALES,
      FIREBASE_COLLECTIONS.EXPENSES,
      FIREBASE_COLLECTIONS.CREDITS,
      FIREBASE_COLLECTIONS.CREDIT_PAYMENTS,
      FIREBASE_COLLECTIONS.STAFF_PAYOUTS,
      FIREBASE_COLLECTIONS.MAINTENANCE,
      FIREBASE_COLLECTIONS.CAISSE_CLOSURES,
      FIREBASE_COLLECTIONS.ACTIVITY_LOGS
    ],
    rentals: [
      FIREBASE_COLLECTIONS.RENTALS, 
      FIREBASE_COLLECTIONS.CLOTHES
    ],
    inventory: [
      FIREBASE_COLLECTIONS.CLOTHES,
      FIREBASE_COLLECTIONS.RAW_MATERIALS,
      FIREBASE_COLLECTIONS.SUPPLIERS
    ],
    sales: [
      FIREBASE_COLLECTIONS.SALES, 
      FIREBASE_COLLECTIONS.CLOTHES
    ],
    tailoring: [
      FIREBASE_COLLECTIONS.MAINTENANCE, 
      FIREBASE_COLLECTIONS.CLOTHES, 
      FIREBASE_COLLECTIONS.STAFF_MEMBERS
    ],
    expenses: [
      FIREBASE_COLLECTIONS.EXPENSES, 
      FIREBASE_COLLECTIONS.SUPPLIERS, 
      FIREBASE_COLLECTIONS.CREDITS,
      FIREBASE_COLLECTIONS.CREDIT_PAYMENTS
    ],
    credits: [
      FIREBASE_COLLECTIONS.CREDITS, 
      FIREBASE_COLLECTIONS.CREDIT_PAYMENTS,
      FIREBASE_COLLECTIONS.SUPPLIERS
    ],
    partners: [
      FIREBASE_COLLECTIONS.SUPPLIERS, 
      FIREBASE_COLLECTIONS.SEAMSTRESSES,
      FIREBASE_COLLECTIONS.EXPENSES,
      FIREBASE_COLLECTIONS.MAINTENANCE,
      FIREBASE_COLLECTIONS.CREDITS,
      FIREBASE_COLLECTIONS.CREDIT_PAYMENTS
    ],
    caisse: [
      FIREBASE_COLLECTIONS.CAISSE_CLOSURES,
      FIREBASE_COLLECTIONS.SALES,
      FIREBASE_COLLECTIONS.RENTALS,
      FIREBASE_COLLECTIONS.EXPENSES,
      FIREBASE_COLLECTIONS.CREDITS,
      FIREBASE_COLLECTIONS.CREDIT_PAYMENTS,
      FIREBASE_COLLECTIONS.STAFF_PAYOUTS,
      FIREBASE_COLLECTIONS.MAINTENANCE
    ],
    customers: [],
    logs: [
      FIREBASE_COLLECTIONS.ACTIVITY_LOGS
    ]
  };

  const resetPaginatedCollection = useCallback((collection: PaginatedCollection) => {
    const state = paginationRef.current[collection];
    state.cursor = null;
    state.hasMore = true;
    state.isLoading = false;
    state.initialized = false;

    if (collection === 'clothes') {
      setHasMoreClothes(true);
      setIsLoadingMoreClothes(false);
      setClothes(prev => prev.slice(0, PAGE_SIZE));
    } else {
      setHasMoreSales(true);
      setIsLoadingMoreSales(false);
      setSales(prev => prev.slice(0, PAGE_SIZE));
    }
  }, []);

  const loadMorePaginatedCollection = useCallback(async (collection: PaginatedCollection) => {
    const state = paginationRef.current[collection];
    if (state.isLoading || !state.hasMore) return;

    state.isLoading = true;
    if (collection === 'clothes') setIsLoadingMoreClothes(true);
    else setIsLoadingMoreSales(true);

    try {
      const result = collection === 'clothes'
        ? await fetchCollectionPage<ClothItem>(FIREBASE_COLLECTIONS.CLOTHES, { limit: PAGE_SIZE, cursor: state.cursor })
        : await fetchCollectionPage<Sale>(FIREBASE_COLLECTIONS.SALES, { limit: PAGE_SIZE, cursor: state.cursor });

      state.cursor = result.nextCursor || state.cursor;
      state.hasMore = result.hasMore;
      if (collection === 'clothes') {
        setHasMoreClothes(result.hasMore);
        if (result.items.length > 0) setClothes(prev => mergeRecordsById(prev, result.items as ClothItem[]));
      } else {
        setHasMoreSales(result.hasMore);
        if (result.items.length > 0) setSales(prev => mergeRecordsById(prev, result.items as Sale[]));
      }
    } catch (error) {
      console.warn(`[Pagination] Failed to load more ${collection}:`, error);
    } finally {
      state.isLoading = false;
      if (collection === 'clothes') setIsLoadingMoreClothes(false);
      else setIsLoadingMoreSales(false);
    }
  }, []);

  const loadMoreClothes = useCallback(() => loadMorePaginatedCollection('clothes'), [loadMorePaginatedCollection]);
  const loadMoreSales = useCallback(() => loadMorePaginatedCollection('sales'), [loadMorePaginatedCollection]);

  const activeViewUnsubsMapRef = useRef<Map<string, () => void>>(new Map());
  const currentActiveViewRef = useRef<ViewType | null>(null);

  const handleEnsureCollection = useCallback((view: ViewType) => {
    const neededStorageKeys = VIEW_STORAGE_MAP[view] || [];
    for (const key of neededStorageKeys) {
      ensureCollectionLoaded(key);
    }

    const previousView = currentActiveViewRef.current;
    const viewChanged = previousView !== view;
    const paginatedView = view === 'inventory' || view === 'sales';
    const previousPaginatedView = previousView === 'inventory' || previousView === 'sales';
    if (viewChanged && paginatedView) {
      resetPaginatedCollection('clothes');
      if (view === 'sales') resetPaginatedCollection('sales');
    }
    currentActiveViewRef.current = view;

    const neededCollections = VIEW_COLLECTIONS_MAP[view] || [
      FIREBASE_COLLECTIONS.CLOTHES,
      FIREBASE_COLLECTIONS.RENTALS
    ];

    const activeMap = activeViewUnsubsMapRef.current;

    const neededSet = new Set(neededCollections);
    const existingCols = Array.from(activeMap.keys()) as string[];
    for (const col of existingCols) {
      const shouldRefreshPagination = viewChanged && (
        (col === FIREBASE_COLLECTIONS.CLOTHES && (paginatedView || previousPaginatedView)) ||
        (col === FIREBASE_COLLECTIONS.SALES && (view === 'sales' || previousView === 'sales'))
      );
      if (!neededSet.has(col) || shouldRefreshPagination) {
        const unsub = activeMap.get(col);
        if (unsub) {
          try {
            unsub();
          } catch (err) {
            console.error(`[App] Unsubscribe error for ${col}:`, err);
          }
        }
        activeMap.delete(col);
      }
    }

    for (const col of neededCollections) {
      if (!activeMap.has(col)) {
        const options = (
          (col === FIREBASE_COLLECTIONS.CLOTHES && paginatedView) ||
          (col === FIREBASE_COLLECTIONS.SALES && view === 'sales')
        ) ? { limit: PAGE_SIZE, sort: false } : undefined;
        const unsub = subscribeToCollection(col, options);
        activeMap.set(col, unsub);
      }
    }
  }, [subscribeToCollection, ensureCollectionLoaded, resetPaginatedCollection]);

  useEffect(() => {
    handleEnsureCollection('dashboard');

    return () => {
      for (const unsub of activeViewUnsubsMapRef.current.values()) {
        try {
          unsub();
        } catch (e) {
        }
      }
      activeViewUnsubsMapRef.current.clear();
      currentActiveViewRef.current = null;
    };
  }, [handleEnsureCollection]);

  // هل تم استلام رصيد الخزينة المشترك من Firebase؟ (نمنع الكتابة قبله حتى لا نطمس قيمة أحدث من جهاز آخر)
  const [isSettingsSynced, setIsSettingsSynced] = useState(false);

  // استقبال رصيد الصندوق العام من الأجهزة الأخرى
  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => setIsSettingsSynced(true), 3000);
    const unsubscribe = SubscriptionManager.subscribe<{ id: string; balance?: number }>(
      FIREBASE_COLLECTIONS.SETTINGS,
      (items) => {
        setIsSettingsSynced(true);
        if (!Array.isArray(items)) return;
        const record = items.find(item => item?.id === 'generalFund');
        if (record && typeof record.balance === 'number' && Number.isFinite(record.balance)) {
          setGeneralFundBalance(prev => (prev === record.balance ? prev : record.balance as number));
        }
      }
    );
    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  // كل تغيير على الرصيد يُحفظ محلياً فوراً ثم يُرفع إلى Firebase (سجل واحد مشترك بين الأجهزة).
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.GENERAL_FUND_BALANCE, generalFundBalance);
    if (!isSettingsSynced) return;
    const timeout = window.setTimeout(() => {
      saveItemToFirebase(FIREBASE_COLLECTIONS.SETTINGS, {
        id: 'generalFund',
        balance: generalFundBalance
      });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [generalFundBalance, isSettingsSynced]);

  // تعديل رصيد الصندوق العام يدوياً (تغذية الخزينة أو تصحيح الرصيد الفعلي)
  const handleSetGeneralFundBalance = useCallback((value: number) => {
    const safeValue = Math.round((Number(value) || 0) * 100) / 100;
    setGeneralFundBalance(safeValue);
    addActivityLog({
      actionType: 'update',
      category: 'caisse',
      title: 'تعديل رصيد الصندوق العام',
      details: `تم ضبط رصيد الصندوق العام (الخزينة) على ${safeValue.toLocaleString()} دج`,
      amount: safeValue
    });
    showToast(`تم تحديث رصيد الصندوق العام (${safeValue.toLocaleString()} دج)`);
  }, [addActivityLog, showToast]);

  // تغذية الصندوق العام بمبلغ (إضافة) أو سحب مبلغ منه
  const handleFeedGeneralFund = useCallback((amount: number) => {
    const safeAmount = Number(amount) || 0;
    if (safeAmount === 0) return;
    setGeneralFundBalance(prev => Math.round((prev + safeAmount) * 100) / 100);
    addActivityLog({
      actionType: 'payment',
      category: 'caisse',
      title: safeAmount > 0 ? 'تغذية الصندوق العام' : 'سحب من الصندوق العام',
      details: `${safeAmount > 0 ? 'إضافة' : 'خصم'} مبلغ ${Math.abs(safeAmount).toLocaleString()} دج ${safeAmount > 0 ? 'إلى' : 'من'} الصندوق العام (الخزينة)`,
      amount: Math.abs(safeAmount)
    });
    showToast(safeAmount > 0
      ? `تمت إضافة ${safeAmount.toLocaleString()} دج إلى الصندوق العام`
      : `تم خصم ${Math.abs(safeAmount).toLocaleString()} دج من الصندوق العام`);
  }, [addActivityLog, showToast]);

  useEffect(() => {
    if (activeModal === 'staffPayouts') {
      ensureCollectionLoaded(STORAGE_KEYS.STAFF_PAYOUTS);
      ensureCollectionLoaded(STORAGE_KEYS.STAFF_MEMBERS);
      ensureCollectionLoaded(STORAGE_KEYS.STAFF_ABSENCES);
      const unsubs = [
        subscribeToCollection(FIREBASE_COLLECTIONS.STAFF_PAYOUTS),
        subscribeToCollection(FIREBASE_COLLECTIONS.STAFF_MEMBERS),
        subscribeToCollection(FIREBASE_COLLECTIONS.STAFF_ABSENCES)
      ];
      return () => {
        unsubs.forEach(u => u());
      };
    }
    if (activeModal === 'fullReport') {
      ensureCollectionLoaded(STORAGE_KEYS.SALES);
      ensureCollectionLoaded(STORAGE_KEYS.EXPENSES);
      ensureCollectionLoaded(STORAGE_KEYS.CREDITS);
      ensureCollectionLoaded(STORAGE_KEYS.STAFF_PAYOUTS);
      ensureCollectionLoaded(STORAGE_KEYS.MAINTENANCE);
      ensureCollectionLoaded(STORAGE_KEYS.RENTALS);
      ensureCollectionLoaded(STORAGE_KEYS.CAISSE_CLOSURES);
      const unsubs = [
        subscribeToCollection(FIREBASE_COLLECTIONS.SALES),
        subscribeToCollection(FIREBASE_COLLECTIONS.EXPENSES),
        subscribeToCollection(FIREBASE_COLLECTIONS.CREDITS),
        subscribeToCollection(FIREBASE_COLLECTIONS.STAFF_PAYOUTS)
      ];
      return () => {
        unsubs.forEach(u => u());
      };
    }
  }, [activeModal, subscribeToCollection, ensureCollectionLoaded]);

  const handleSyncAllToCloud = useCallback(async () => {
    setIsCloudSyncing(true);
    try {
      await Promise.all([
        syncCollectionToCloud(FIREBASE_COLLECTIONS.CLOTHES, clothes),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.RENTALS, rentals),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.SALES, sales),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.EXPENSES, expenses),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.CREDITS, credits),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.CREDIT_PAYMENTS, creditPayments),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.STAFF_PAYOUTS, staffPayouts),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.STAFF_MEMBERS, staffMembers),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.STAFF_ABSENCES, staffAbsences),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.MAINTENANCE, maintenanceOrders),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.SUPPLIERS, suppliers),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.SEAMSTRESSES, seamstresses),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.RAW_MATERIALS, rawMaterials),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.CAISSE_CLOSURES, caisseClosures),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.ACTIVITY_LOGS, activityLogs),
        syncCollectionToCloud(FIREBASE_COLLECTIONS.SETTINGS, [{ id: 'generalFund', balance: generalFundBalance }])
      ]);
      const nowStr = new Date().toLocaleTimeString('ar-DZ');
      setLastCloudSyncTime(nowStr);
      showToast('تمت مزامنة ورفع جميع بيانات البوتيك إلى Firebase بنجاح!');
    } catch (e) {
      console.error(e);
      showToast('تعذر استكمال المزامنة السحابية', 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  }, [
    clothes, rentals, sales, expenses, credits, creditPayments, staffPayouts, 
    staffMembers, staffAbsences, maintenanceOrders, suppliers, 
    seamstresses, rawMaterials, caisseClosures, activityLogs, generalFundBalance, showToast
  ]);

  const [hideFinances, setHideFinances] = useState(() => localStorage.getItem('bm_hideFinances') !== 'false');
  const [isScanning, setIsScanning] = useState(false);
  const [posScannedBarcode, setPosScannedBarcode] = useState<string | null>(null);

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

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return rentals.filter(r => {
      if (r.status !== 'active') return false;
      const exp = new Date(r.expectedReturnDate);
      const now = new Date(today);
      return exp.getTime() < now.getTime();
    }).length;
  }, [rentals]);

  const pendingAbsencesCount = useMemo(() => {
    return staffAbsences.filter(a => !a.isDeducted).length;
  }, [staffAbsences]);

  const activeMaintenanceCount = useMemo(() => {
    return maintenanceOrders.filter(o => o.status !== 'delivered').length;
  }, [maintenanceOrders]);

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

  const handleAddRental = useCallback((rentalData: any) => {
    const newRental: Rental = { ...rentalData, id: generateId() };
    const rentalDebt = Math.max(0, Number(rentalData.remainingAmount) || 0);
    
    setRentals(prev => [newRental, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.RENTALS, newRental);

    addActivityLog({
      actionType: newRental.status === 'active' ? 'deal' : 'create',
      category: 'rentals',
      title: newRental.status === 'active' ? 'تسجيل كراء فستان جديد' : 'تسجيل حجز فستان مستقبلي',
      details: `كراء القطعة: ${newRental.itemName} (مقاس ${newRental.itemSize}) للزبونة ${newRental.customerName} بمبلغ ${newRental.rentPrice} دج`,
      amount: newRental.rentPrice
    });

    if (newRental.status === 'active') {
      setClothes(prev => prev.map(c => {
        if (c.id === rentalData.itemId) {
          const updatedCount = (c.rentedCount || 0) + (rentalData.qty || 1);
          updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updatedCount });
          return { ...c, rentedCount: updatedCount };
        }
        return c;
      }));
      showToast(rentalDebt > 0
        ? `تم تسجيل الكراء الفوري، والمتبقي ${rentalDebt.toLocaleString()} دج سُجِّل في قسم الكريدي`
        : 'تم تسجيل الكراء الفوري بنجاح');
    } else {
      showToast(rentalDebt > 0
        ? `تم تسجيل الحجز، والمتبقي ${rentalDebt.toLocaleString()} دج سُجِّل ككريدي للحجز`
        : 'تم تسجيل حجز الفستان مستقبلاً بنجاح (سيدخل في الكراء عند إتمام الصفقة وتسليمه)');
    }

    if (rentalDebt > 0) {
      const newCredit: Credit = {
        id: generateId(),
        name: rentalData.customerName,
        phone: rentalData.customerPhone,
        type: newRental.status === 'reserved' ? 'متبقي حجز فستان' : 'دين كراء فستان',
        desc: `${newRental.status === 'reserved' ? 'متبقي حجز' : 'متبقي كراء'}: ${rentalData.itemName}`,
        amount: rentalDebt,
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

    const rentalUpdates = {
      status: 'active' as const,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      handoverDate: todayStr,
      notes: notesStr
    };

    setRentals(prev => prev.map(r => {
      if (r.id === rental.id) {
        return {
          ...r,
          ...rentalUpdates
        };
      }
      return r;
    }));
    updateItemInFirebase(FIREBASE_COLLECTIONS.RENTALS, rental.id, rentalUpdates);

    setClothes(prev => prev.map(c => {
      if (c.id === rental.itemId) {
        const updatedCount = (c.rentedCount || 0) + (rental.qty || 1);
        updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updatedCount });
        return { ...c, rentedCount: updatedCount };
      }
      return c;
    }));

    setCredits(prev => {
      const filtered = prev.filter(c => {
        if (c.relatedRentalId === rental.id) {
          deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, c.id);
          return false;
        }
        return true;
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
          setClothes(clothesPrev => clothesPrev.map(c => {
            if (c.id === updatedData.itemId) {
              const updatedCount = (c.rentedCount || 0) + (updatedData.qty || 1);
              updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, c.id, { rentedCount: updatedCount });
              return { ...c, rentedCount: updatedCount };
            }
            return c;
          }));
        } else if (wasActive && !isNowActive) {
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
            prev.filter(c => c.relatedRentalId === id).forEach(c => deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, c.id));
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
        status: 'returned' as const,
        actualReturnDate: new Date().toISOString().split('T')[0],
        conditionOnReturn: returnData.condition,
        cautionStatus: (returnData.cautionAction === 'refund' ? 'refunded' : 'deducted') as ('refunded' | 'deducted'),
        penaltyAmount: returnData.penaltyAmount,
        paidAmount: target.paidAmount + (returnData.collectedRemaining || 0),
        remainingAmount: Math.max(0, (target.remainingAmount || 0) - (returnData.collectedRemaining || 0)),
        notes: returnData.notes ? `${target.notes ? target.notes + ' | ' : ''}إرجاع: ${returnData.notes}` : target.notes
      };

      updateItemInFirebase(FIREBASE_COLLECTIONS.RENTALS, rentalId, returnUpdates);

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

      if (returnData.penaltyAmount > 0) {
        showToast(`تم استرجاع الفستان وخصم غرامة بقيمة ${returnData.penaltyAmount} دج`);
      } else {
        showToast('تم تأكيد استرجاع الفستان وتسوية الحساب بنجاح');
      }

      if (returnData.collectedRemaining > 0) {
        setCredits(prev => {
          prev.filter(c => c.relatedRentalId === rentalId).forEach(c => deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, c.id));
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

  const handleAddCloth = useCallback((itemData: any, pendingFullUrl?: string) => {
    const newCloth: ClothItem = { ...itemData, id: generateId() };
    setClothes(prev => [newCloth, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.CLOTHES, newCloth);

    if (pendingFullUrl) {
      imageStore.saveFull(newCloth.id, pendingFullUrl);
    }

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

  const handleUpdateCloth = useCallback((id: string, itemData: any, pendingFullUrl?: string) => {
    setClothes(prev => prev.map(c => c.id === id ? { ...c, ...itemData } : c));
    updateItemInFirebase(FIREBASE_COLLECTIONS.CLOTHES, id, itemData);

    if (pendingFullUrl) {
      imageStore.saveFull(id, pendingFullUrl);
    }

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

  const handleCompleteSale = useCallback((saleData: any) => {
    const saleDebt = Math.max(0, Number(saleData.debtAmount) || 0);
    const sanitizedItems = (saleData.items || []).map((item: any) => {
      const { imageUrl, ...rest } = item;
      return rest;
    });

    const newSale: Sale = { ...saleData, items: sanitizedItems, id: generateId() };
    setSales(prev => [newSale, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.SALES, newSale);

    addActivityLog({
      actionType: 'create',
      category: 'sales',
      title: 'تسجيل عملية بيع ملابس',
      details: `بيع مباشر للزبون ${saleData.customerName || 'عام'} بقيمة ${saleData.totalAmount} دج`,
      amount: saleData.totalAmount
    });

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

    if (saleDebt > 0) {
      const newCredit: Credit = {
        id: generateId(),
        name: saleData.customerName,
        phone: saleData.customerPhone,
        type: 'دين شراء ملابس',
        desc: `متبقي فاتورة بيع ملابس`,
        amount: saleDebt,
        date: new Date().toISOString()
      };
      setCredits(prev => [newCredit, ...prev]);
      saveItemToFirebase(FIREBASE_COLLECTIONS.CREDITS, newCredit);
    }

    showToast(saleDebt > 0
      ? `تم البيع بنجاح، وسُجِّل المتبقي ${saleDebt.toLocaleString()} دج في قسم الكريدي`
      : 'تم إتمام عملية البيع بنجاح');
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

  const handleAddExpense = useCallback((expData: any) => {
    const newExpId = generateId();
    const newExp: Expense = { ...expData, id: newExpId };
    setExpenses(prev => [newExp, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.EXPENSES, newExp);

    // مصروف من الصندوق العام (الخزينة) → يُخصم مبلغه مباشرة من الرصيد
    if (isGeneralFundExpense(newExp)) {
      const amount = Number(newExp.amount) || 0;
      setGeneralFundBalance(prev => Math.round((prev - amount) * 100) / 100);
    }

    const fundLabel = expData.fundSource === 'general' ? 'الصندوق العام (الخزينة)' : 'صندوق اليوم (الدرج)';

    addActivityLog({
      actionType: 'create',
      category: 'expenses',
      title: expData.isSupplierPurchase ? 'تسجيل مشتريات وموردين' : 'تسجيل مصروف جديد',
      details: `${expData.category}: ${expData.desc || expData.goodsDescription} (${expData.amount} دج) — مصدر الدفع: ${fundLabel}`,
      amount: expData.amount
    });

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
  }, [addActivityLog, showToast]);

  const handleDeleteExpense = useCallback((id: string) => {
    // حذف مصروف كان مسحوباً من الصندوق العام → يُرجع مبلغه إلى الرصيد
    const target = expenses.find(e => e.id === id);
    if (target && isGeneralFundExpense(target)) {
      const amount = Number(target.amount) || 0;
      setGeneralFundBalance(prev => Math.round((prev + amount) * 100) / 100);
    }

    setExpenses(prev => prev.filter(e => e.id !== id));
    deleteItemFromFirebase(FIREBASE_COLLECTIONS.EXPENSES, id);
    setCredits(prev => {
      prev.filter(c => c.relatedExpenseId === id).forEach(c => deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, c.id));
      return prev.filter(c => c.relatedExpenseId !== id);
    });

    addActivityLog({
      actionType: 'delete',
      category: 'expenses',
      title: 'حذف مصروف أو مشتريات',
      details: `حذف قيد مصروف أو مشتريات من السجل`
    });

    showToast('تم حذف سجل المصروف');
  }, [expenses, addActivityLog, showToast]);

  const handleSettleSupplierCredit = useCallback((expenseId: string, paidNow: number) => {
    // تسديد دفعة إضافية لمصروف كان مسحوباً من الصندوق العام → تُخصم من رصيد الخزينة
    const settledExpense = expenses.find(e => e.id === expenseId);
    if (settledExpense && isGeneralFundExpense(settledExpense)) {
      const paidAmount = Number(paidNow) || 0;
      setGeneralFundBalance(prev => Math.round((prev - paidAmount) * 100) / 100);
    }

    setExpenses(prev => prev.map(exp => {
      if (exp.id === expenseId) {
        const currentPaid = exp.paidAmount !== undefined ? exp.paidAmount : exp.amount;
        const currentCredit = exp.creditAmount || 0;
        const newPaid = currentPaid + paidNow;
        const newCredit = Math.max(0, currentCredit - paidNow);
        const updates = {
          paidAmount: newPaid,
          amount: newPaid,
          creditAmount: newCredit
        };
        updateItemInFirebase(FIREBASE_COLLECTIONS.EXPENSES, expenseId, updates);
        return {
          ...exp,
          ...updates
        };
      }
      return exp;
    }));

    setCredits(prev => {
      return prev.map(c => {
        if (c.relatedExpenseId === expenseId) {
          const newAmount = Math.max(0, c.amount - paidNow);
          if (newAmount <= 0) {
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
  }, [expenses, addActivityLog, showToast]);

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
          deleteItemFromFirebase(FIREBASE_COLLECTIONS.SUPPLIERS, id);
          return next;
        });

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
          deleteItemFromFirebase(FIREBASE_COLLECTIONS.SEAMSTRESSES, id);
          return next;
        });

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
    const updates = { ...data, updatedAt: new Date().toISOString() };
    setRawMaterials(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    updateItemInFirebase(FIREBASE_COLLECTIONS.RAW_MATERIALS, id, updates);

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

  // تسديد كريدي: الدفعة تُحفظ كمستند مستقل في مجموعة الدفعات مرتبطة بالدين عبر creditId
  const handleSettleCredit = useCallback((
    creditId: string,
    paymentData: { amount: number; date: string; fundSource: FundSource; note?: string }
  ) => {
    const credit = credits.find(c => c.id === creditId);
    if (!credit) return;

    const amount = Number(paymentData?.amount) || 0;
    if (amount <= 0) return;

    const fundSource: FundSource = paymentData?.fundSource === 'general' ? 'general' : 'daily';
    const paymentDate = (paymentData?.date || new Date().toISOString().split('T')[0]).substring(0, 10);

    const payment: CreditPayment = {
      id: generateId(),
      creditId,
      amount,
      date: paymentDate,
      fundSource,
      note: paymentData?.note,
      createdAt: new Date().toISOString()
    };

    setCreditPayments(prev => [payment, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.CREDIT_PAYMENTS, payment);

    // الأثر على الصندوق العام (إضافة عند التحصيل من الزبون، خصم عند الدفع للمورد)
    if (fundSource === 'general') {
      const effect = generalFundEffectOfPayment(credit, amount);
      setGeneralFundBalance(prev => Math.round((prev + effect) * 100) / 100);
    }

    // دين مورد مرتبط بمصروف شراء → تحديث المدفوع والمتبقي في المصروف أيضاً
    if (credit.supplierDebt && credit.relatedExpenseId) {
      setExpenses(prev => prev.map(exp => {
        if (exp.id !== credit.relatedExpenseId) return exp;
        const currentPaid = exp.paidAmount !== undefined ? exp.paidAmount : exp.amount;
        const newPaid = currentPaid + amount;
        const newCredit = Math.max(0, (exp.creditAmount || 0) - amount);
        const updates = { paidAmount: newPaid, amount: newPaid, creditAmount: newCredit };
        updateItemInFirebase(FIREBASE_COLLECTIONS.EXPENSES, exp.id, updates);
        return { ...exp, ...updates };
      }));
    }

    const totalPaid = paymentsForCredit(credit, creditPayments).reduce((sum, p) => sum + (Number(p.amount) || 0), 0) + amount;
    const remaining = Math.max(0, (Number(credit.amount) || 0) - totalPaid);
    const isCustomer = !credit.supplierDebt;

    addActivityLog({
      actionType: 'payment',
      category: 'credits',
      title: isCustomer ? 'تحصيل دفعة من دين زبون' : 'تسديد دفعة دين مورد',
      details: `${isCustomer ? 'تحصيل' : 'دفع'} ${amount.toLocaleString()} دج ${isCustomer ? 'من' : 'إلى'} ${credit.name} بتاريخ ${paymentDate} — ${fundSource === 'general' ? 'الصندوق العام (الخزينة)' : 'صندوق اليوم (الدرج)'}${remaining > 0 ? ` • المتبقي: ${remaining.toLocaleString()} دج` : ' • تسديد كامل'}`,
      amount
    });

    if (remaining <= 0) {
      showToast(isCustomer
        ? `تم تحصيل ${amount.toLocaleString()} دج وإبراء ذمة ${credit.name} بالكامل`
        : `تم تسديد ${amount.toLocaleString()} دج للمورد ${credit.name} بالكامل`);
    } else {
      showToast(`تم تسجيل دفعة ${amount.toLocaleString()} دج • المتبقي: ${remaining.toLocaleString()} دج`);
    }
  }, [credits, creditPayments, addActivityLog, showToast]);

  const handleDeleteCredit = useCallback((id: string) => {
    const target = credits.find(c => c.id === id);
    if (target) {
      // عكس أثر الدفعات المسددة من/إلى الصندوق العام
      const mergedPayments = paymentsForCredit(target, creditPayments);
      let effect = 0;
      let paidViaCredit = 0;
      for (const payment of mergedPayments) {
        const paymentAmount = Number(payment.amount) || 0;
        paidViaCredit += paymentAmount;
        if (payment.fundSource === 'general') effect += generalFundEffectOfPayment(target, paymentAmount);
      }
      if (effect !== 0) {
        setGeneralFundBalance(prev => Math.round((prev - effect) * 100) / 100);
      }

      // دين مورد مرتبط بمصروف شراء: إرجاع المدفوع في المصروف حتى لا يُحتسب مرتين
      if (target.supplierDebt && target.relatedExpenseId && paidViaCredit > 0) {
        setExpenses(prev => prev.map(exp => {
          if (exp.id !== target.relatedExpenseId) return exp;
          const currentPaid = exp.paidAmount !== undefined ? exp.paidAmount : exp.amount;
          const newPaid = Math.max(0, currentPaid - paidViaCredit);
          const invoiceTotal = Number(exp.totalInvoiceAmount) || 0;
          const newCredit = invoiceTotal > 0
            ? Math.max(0, invoiceTotal - newPaid)
            : (Number(exp.creditAmount) || 0) + paidViaCredit;
          const updates = { paidAmount: newPaid, amount: newPaid, creditAmount: newCredit };
          updateItemInFirebase(FIREBASE_COLLECTIONS.EXPENSES, exp.id, updates);
          return { ...exp, ...updates };
        }));
      }

      // حذف مستندات دفعات الدين من مجموعة الدفعات
      creditPayments.filter(p => p.creditId === id).forEach(p => deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDIT_PAYMENTS, p.id));
      setCreditPayments(prev => prev.filter(p => p.creditId !== id));
    }

    setCredits(prev => prev.filter(c => c.id !== id));
    deleteItemFromFirebase(FIREBASE_COLLECTIONS.CREDITS, id);

    addActivityLog({
      actionType: 'delete',
      category: 'credits',
      title: 'حذف قيد دين',
      details: `حذف سجل دين من النظام`
    });

    showToast('تم حذف السجل');
  }, [credits, creditPayments, addActivityLog, showToast]);

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

  const handleAddStaffPayout = useCallback((data: any, deductedAbsenceIds?: string[]) => {
    const payoutId = generateId();
    const newPayout: StaffPayout = { ...data, id: payoutId };
    setStaffPayouts(prev => [newPayout, ...prev]);
    saveItemToFirebase(FIREBASE_COLLECTIONS.STAFF_PAYOUTS, newPayout);

    if (deductedAbsenceIds && deductedAbsenceIds.length > 0) {
      setStaffAbsences(prev => prev.map(a => {
        if (deductedAbsenceIds.includes(a.id)) {
          updateItemInFirebase(FIREBASE_COLLECTIONS.STAFF_ABSENCES, a.id, { isDeducted: true, payoutId });
          return { ...a, isDeducted: true, payoutId };
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
      paymentDate: data.paymentDate || data.receivedDate || new Date().toISOString().split('T')[0],
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

  const handleExportBackup = async () => {
    try {
      showToast('جاري قراءة جميع المجموعات مباشرة من Firebase...');
      const report = await downloadFullFirebaseBackupDirect();
      if (report.verified) {
        showToast('تم التحقق والتأكد من مطابقة السجلات وتنزيل النسخة بنجاح!', 'success');
      } else {
        showToast('تم تنزيل النسخة الاحتياطية المباشرة بنجاح!');
      }
    } catch (err) {
      console.error('Backup failed:', err);
      showToast('حدث خطأ أثناء تصدير النسخة الاحتياطية', 'error');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          const raw = parsed.data || parsed;
          const collectionsToMerge: { key: string; name: string; items: any[] }[] = [];

          if (Array.isArray(raw.clothes) && raw.clothes.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.CLOTHES, name: 'الملابس والمخزون', items: raw.clothes });
          if (Array.isArray(raw.rentals) && raw.rentals.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.RENTALS, name: 'الكراء والإيجار', items: raw.rentals });
          if (Array.isArray(raw.sales) && raw.sales.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.SALES, name: 'المبيعات', items: raw.sales });
          if (Array.isArray(raw.expenses) && raw.expenses.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.EXPENSES, name: 'المصاريف', items: raw.expenses });
          if (Array.isArray(raw.credits) && raw.credits.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.CREDITS, name: 'الديون والمستحقات', items: raw.credits });
          if (Array.isArray(raw.creditPayments) && raw.creditPayments.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.CREDIT_PAYMENTS, name: 'دفعات تسديد الديون', items: raw.creditPayments });
          if (Array.isArray(raw.staffPayouts) && raw.staffPayouts.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.STAFF_PAYOUTS, name: 'رواتب الموظفين', items: raw.staffPayouts });
          if (Array.isArray(raw.staffMembers) && raw.staffMembers.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.STAFF_MEMBERS, name: 'الموظفين', items: raw.staffMembers });
          if (Array.isArray(raw.staffAbsences) && raw.staffAbsences.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.STAFF_ABSENCES, name: 'غيابات الموظفين', items: raw.staffAbsences });
          if (Array.isArray(raw.maintenanceOrders) && raw.maintenanceOrders.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.MAINTENANCE, name: 'طلبات الخياطة والتعديل', items: raw.maintenanceOrders });
          if (Array.isArray(raw.suppliers) && raw.suppliers.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.SUPPLIERS, name: 'الموردين', items: raw.suppliers });
          if (Array.isArray(raw.seamstresses) && raw.seamstresses.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.SEAMSTRESSES, name: 'الخياطات', items: raw.seamstresses });
          if (Array.isArray(raw.rawMaterials) && raw.rawMaterials.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.RAW_MATERIALS, name: 'الأقمشة والمواد الخام', items: raw.rawMaterials });
          if (Array.isArray(raw.caisseClosures) && raw.caisseClosures.length > 0) collectionsToMerge.push({ key: FIREBASE_COLLECTIONS.CAISSE_CLOSURES, name: 'إغلاقات الصندوق', items: raw.caisseClosures });

          if (collectionsToMerge.length === 0) {
            showToast('الملف لا يحتوي على سجلات قابلة للدمج!', 'error');
            return;
          }

          const summaryText = collectionsToMerge.map(c => `• ${c.name}: ${c.items.length} سجل`).join('\n');
          const confirmed = window.confirm(
            `تأكيد الدمج الآمن السحابي:\n\nسيتم دمج السجلات التالية في قاعدة البيانات السحابية دون حذف السجلات الحالية:\n\n${summaryText}\n\nهل تريد المتابعة؟`
          );

          if (!confirmed) {
            showToast('تم إلغاء عملية الاستعادة');
            return;
          }

          // دمج المجموعات بالتوازي بدل الرفع التسلسلي
          await Promise.all(collectionsToMerge.map(col => syncCollectionToCloud(col.key, col.items)));

          showToast('تم دمج البيانات السحابية بنجاح دون حذف السجلات القديمة!', 'success');
          setActiveModal(null);
        } catch (err) {
          console.error(err);
          showToast('ملف غير صالح!', 'error');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="text-blue-900 w-full min-h-screen flex flex-col bg-white font-['Tajawal']" dir="rtl">
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
        isFirebaseConnected={isFirebaseConnected}
        isCloudSyncing={isCloudSyncing}
        openCloudSyncModal={() => setActiveModal('cloudSync')}
        rentals={rentals}
        clothes={clothes}
        sales={sales}
        expenses={expenses}
        credits={credits}
        creditPayments={creditPayments}
        staffPayouts={staffPayouts}
        maintenanceOrders={maintenanceOrders}
        caisseClosures={caisseClosures}
        suppliers={suppliers}
        seamstresses={seamstresses}
        rawMaterials={rawMaterials}
        activityLogs={activityLogs}
        posScannedBarcode={posScannedBarcode}
        hasMoreClothes={hasMoreClothes}
        isLoadingMoreClothes={isLoadingMoreClothes}
        onLoadMoreClothes={loadMoreClothes}
        hasMoreSales={hasMoreSales}
        isLoadingMoreSales={isLoadingMoreSales}
        onLoadMoreSales={loadMoreSales}
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
        generalFundBalance={generalFundBalance}
        onSetGeneralFundBalance={handleSetGeneralFundBalance}
        onFeedGeneralFund={handleFeedGeneralFund}
        onDeleteStaffPayout={handleDeleteStaffPayout}
        onAddSeamstress={handleAddSeamstress}
        onUpdateSeamstress={handleUpdateSeamstress}
        onDeleteSeamstress={handleDeleteSeamstress}
      />


      {activeModal === 'addTailoring' && (
        <TailoringModal
          clothes={clothes}
          staffMembers={staffMembers}
          onSave={handleAddTailoringOrder}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'editTailoring' && selectedTailoringOrder && (
        <TailoringModal
          order={selectedTailoringOrder}
          clothes={clothes}
          staffMembers={staffMembers}
          onSave={(data) => handleUpdateTailoringOrder(selectedTailoringOrder.id, data)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'tailoringReceipt' && selectedTailoringOrder && (
        <TailoringReceiptModal
          order={selectedTailoringOrder}
          onClose={() => setActiveModal(null)}
        />
      )}

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

      {activeModal === 'returnRental' && selectedRental && (
        <Modal title="استرجاع فستان / قطعة كراء" onClose={() => setActiveModal(null)}>
          <ReturnRentalModal 
            rental={selectedRental}
            onConfirmReturn={handleConfirmReturn}
            onCancel={() => setActiveModal(null)}
          />
        </Modal>
      )}

      {activeModal === 'receiptModal' && selectedRental && (
        <Modal title="وصل وعقد الكراء" onClose={() => setActiveModal(null)} wide>
          <RentalReceiptModal 
            rental={selectedRental}
            onClose={() => setActiveModal(null)}
          />
        </Modal>
      )}

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

            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl">
              <h4 className="font-bold text-sm text-amber-900 mb-1">سلة المهملات والمحذوفات</h4>
              <p className="text-xs text-amber-700 mb-3">العناصر المحذوفة محفوظة مؤقتاً ويمكنك استعراضها وإعادتها فوراً.</p>
              <button
                type="button"
                onClick={() => setActiveModal('trash')}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                فتح سلة المحذوفات لاسترجاع البيانات
              </button>
            </div>
          </div>
        </Modal>
      )}

      {activeModal === 'trash' && (
        <TrashModal 
          onClose={() => setActiveModal(null)} 
          onRestored={() => {
            showToast('تم استرجاع السجل المختار بنجاح!', 'success');
          }} 
        />
      )}

      {activeModal === 'cloudSync' && (
        <Modal title="مزامنة وسحابة Firebase" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border ${
              isFirebaseConnected 
                ? 'bg-emerald-50/70 border-emerald-200' 
                : 'bg-amber-50/70 border-amber-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${
                    isCloudSyncing ? 'bg-blue-500 animate-ping' : isFirebaseConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                  <span className="font-black text-sm text-slate-900">
                    {isCloudSyncing ? 'جاري رفع ومزامنة البيانات...' : isFirebaseConnected ? 'متصل بسحابة Firebase بنجاح' : 'جاري الاتصال بقاعدة البيانات'}
                  </span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isFirebaseConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isFirebaseConnected ? 'أونلاين (Online)' : 'أوفلاين (Offline)'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                قاعدة البيانات السحابية تضمن حفظ ومزامنة كافة عمليات الكراء، المبيعات، ومخزون الفساتين تلقائياً وفورياً بين الهواتف والأجهزة المختلفة.
              </p>
              {lastCloudSyncTime && (
                <p className="text-[11px] text-emerald-700 font-bold mt-2">
                  ✓ آخر مزامنة مكتملة: {lastCloudSyncTime}
                </p>
              )}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">معرف المشروع:</span>
                <span className="font-mono text-slate-800 font-bold">{firebaseConfig.projectId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">قاعدة البيانات:</span>
                <span className="font-mono text-slate-800 font-bold text-[10px] truncate max-w-[200px]" title={firebaseConfig.databaseURL}>
                  {firebaseConfig.databaseURL}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-600 font-medium">الفساتين والمخزون</span>
                <span className="font-black text-blue-900">{clothes.length}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-600 font-medium">عمليات الكراء</span>
                <span className="font-black text-blue-900">{rentals.length}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-600 font-medium">فواتير البيع</span>
                <span className="font-black text-blue-900">{sales.length}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-600 font-medium">المصاريف والمشتريات</span>
                <span className="font-black text-blue-900">{expenses.length}</span>
              </div>
            </div>

            <button
              onClick={() => setActiveModal('imageMigration')}
              className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>تحسين وترحيل صور المنتجات (إخراج الصور من السجلات)</span>
            </button>

            <button
              onClick={handleSyncAllToCloud}
              disabled={isCloudSyncing}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span>{isCloudSyncing ? 'جاري المزامنة مع السحابة...' : 'مزامنة ورفع جميع البيانات إلى Firebase الآن'}</span>
            </button>
          </div>
        </Modal>
      )}

      {activeModal === 'imageMigration' && (
        <ImageMigrationModal
          clothes={clothes}
          sales={sales}
          onClose={() => setActiveModal(null)}
          showToast={showToast}
        />
      )}

      {activeModal === 'fullReport' && (
        <Modal title="التقرير المالي والإداري المفصل للبوتيك" onClose={() => setActiveModal(null)} wide>
          <FullReport 
            clothes={clothes}
            rentals={rentals}
            sales={sales}
            expenses={expenses}
            credits={credits}
            staffPayouts={staffPayouts}
            maintenanceOrders={maintenanceOrders}
            caisseClosures={caisseClosures}
            hideFinances={hideFinances}
          />
        </Modal>
      )}

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
                setScannedItemAction(item);
              }
            } else {
              setUnknownScannedCode(code.trim());
            }
          }} 
          onClose={() => setIsScanning(false)} 
        />
      )}

      {scannedItemAction && (
        <Modal 
          title="إجراءات سريعة للقطعة الممسوحة" 
          onClose={() => setScannedItemAction(null)}
        >
          <div className="space-y-4 py-1 text-slate-800" dir="rtl">
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              {(getListImage(scannedItemAction) || scannedItemAction.imageUrl) ? (
                <AsyncProductImage item={scannedItemAction} mode="thumb" className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0" />
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                        total: item.sellPrice
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
