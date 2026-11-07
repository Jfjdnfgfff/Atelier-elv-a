import { get, set } from 'idb-keyval';
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
  Supplier,
  DailyCaisseClosure,
  RawMaterial,
  Seamstress,
  SeamstressPayment,
  ActivityLog
} from './types';
import { perfMonitor } from './utils/performanceMonitor';
import {
  CACHE_SCHEMA_VERSION,
  DEFAULT_CACHE_TTL_MS,
  evaluateCacheFreshness,
  getKnownRevision,
  type CacheStamp
} from './utils/cachePolicy';

export const STORAGE_KEYS = {
  CLOTHES: 'boutique_clothes',
  RENTALS: 'boutique_rentals',
  SALES: 'boutique_sales',
  EXPENSES: 'boutique_expenses',
  CREDITS: 'boutique_credits',
  CREDIT_PAYMENTS: 'boutique_credit_payments',
  STAFF_PAYOUTS: 'boutique_staff_payouts',
  STAFF_MEMBERS: 'boutique_staff_members',
  STAFF_ABSENCES: 'boutique_staff_absences',
  CUSTOMERS: 'boutique_customers',
  MAINTENANCE: 'boutique_maintenance',
  SUPPLIERS: 'boutique_suppliers',
  SEAMSTRESSES: 'boutique_seamstresses',
  SEAMSTRESS_PAYMENTS: 'boutique_seamstress_payments',
  RAW_MATERIALS: 'boutique_raw_materials',
  CAISSE_CLOSURES: 'boutique_caisse_closures',
  ACTIVITY_LOGS: 'boutique_activity_logs',
  SECURITY_PIN: 'bm_security_pin',
  STORE_CONFIG: 'boutique_store_config',
  GENERAL_FUND_BALANCE: 'boutique_general_fund_balance'
};

export const DEFAULT_ACTIVITY_LOGS: ActivityLog[] = [];
export const DEFAULT_RAW_MATERIALS: RawMaterial[] = [];
export const DEFAULT_SEAMSTRESSES: Seamstress[] = [];
export const DEFAULT_SEAMSTRESS_PAYMENTS: SeamstressPayment[] = [];
export const DEFAULT_SUPPLIERS: Supplier[] = [];
export const DEFAULT_MAINTENANCE: MaintenanceOrder[] = [];
export const DEFAULT_STAFF: StaffMember[] = [];
export const DEFAULT_STAFF_PAYOUTS: StaffPayout[] = [];
export const DEFAULT_STAFF_ABSENCES: StaffAbsence[] = [];
export const DEFAULT_CLOTHES: ClothItem[] = [];
export const DEFAULT_RENTALS: Rental[] = [];
export const DEFAULT_SALES: Sale[] = [];
export const DEFAULT_EXPENSES: Expense[] = [];
export const DEFAULT_CREDITS: Credit[] = [];
export const DEFAULT_CREDIT_PAYMENTS: CreditPayment[] = [];
export const DEFAULT_CAISSE_CLOSURES: DailyCaisseClosure[] = [];

// In-memory cache for fast, synchronous lookups without reading localStorage repeatedly
const memoryStore = new Map<string, any>();
const lastWrittenRef = new Map<string, any>();
const dirtyKeys = new Set<string>();
let idleFlushScheduled = false;

export interface CacheMeta {
  timestamp: number;
  version: number;
  updatedAt?: string;
}

export interface StorageEnvelope<T> {
  data: T;
  timestamp: number;
  version: number;
  updatedAt?: string;
  /** بصمة السحابة وقت كتابة الكاش (لمقارنتها ببصمة /system/cacheMeta) */
  revision?: number;
  /** نسخة مخطّط التخزين — تُبطل الكاش عند تغيّر شكل البيانات */
  schemaVersion?: number;
}

// فك غلاف التخزين مع دعم الصيغة القديمة (مصفوفات مباشرة) دون فقدان السجلات
export function parseStorageEnvelope<T>(raw: string | null, defaultValue: T): StorageEnvelope<T> {
  if (!raw) {
    return { data: defaultValue, timestamp: Date.now(), version: 1 };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'data' in parsed) {
      return {
        data: parsed.data as T,
        timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
        version: typeof parsed.version === 'number' ? parsed.version : 1,
        updatedAt: parsed.updatedAt,
        revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
        schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0
      };
    }
    // Legacy format: raw array or object saved directly in localStorage
    return {
      data: parsed as T,
      timestamp: Date.now(),
      version: 1
    };
  } catch (e) {
    console.error(`Failed to parse storage content:`, e);
    return { data: defaultValue, timestamp: Date.now(), version: 1 };
  }
}

const cacheMetaStore = new Map<string, CacheMeta>();

// تفريغ فوري للمجموعات المعلّقة إلى التخزين (يُستدعى عند إغلاق أو إخفاء الصفحة)
export function flushPendingStorageSynchronously(): void {
  if (dirtyKeys.size === 0) return;

  const keysToFlush = Array.from(dirtyKeys);
  dirtyKeys.clear();

  for (let i = 0; i < keysToFlush.length; i++) {
    const key = keysToFlush[i];
    const dataToPersist = memoryStore.get(key);
    if (dataToPersist === undefined) continue;

    const meta = cacheMetaStore.get(key) || { timestamp: Date.now(), version: 1 };
    const cacheEnvelope: StorageEnvelope<unknown> = {
      data: dataToPersist,
      timestamp: meta.timestamp,
      version: meta.version,
      revision: getKnownRevision(key),
      schemaVersion: CACHE_SCHEMA_VERSION
    };

    // 1. IndexedDB write (completely independent of localStorage and outside its try/catch)
    set(key, cacheEnvelope)
      .catch(idbErr => console.warn(`[IndexedDB] Error setting ${key}:`, idbErr));

    // 2. localStorage write with 1MB size safety check for clothes
    try {
      let storageData = dataToPersist;
      if (key === STORAGE_KEYS.CLOTHES && Array.isArray(dataToPersist)) {
        storageData = dataToPersist.map((item: any) => {
          if (item && typeof item === 'object' && item.imageUrl && typeof item.imageUrl === 'string' && (item.thumbUrl || item.imageUrl.length > 20000)) {
            const copy = { ...item };
            delete copy.imageUrl;
            return copy;
          }
          return item;
        });
      }

      const payloadStr = JSON.stringify({
        data: storageData,
        timestamp: meta.timestamp,
        version: meta.version,
        revision: cacheEnvelope.revision,
        schemaVersion: cacheEnvelope.schemaVersion
      });

      // Disable localStorage write for clothes completely if size > 1MB
      if (key === STORAGE_KEYS.CLOTHES && payloadStr.length > 1024 * 1024) {
        console.warn(`[localStorage] Skipped writing clothes to localStorage (size: ${(payloadStr.length / (1024 * 1024)).toFixed(2)} MB > 1MB limit). Preserved safely in IndexedDB.`);
      } else {
        localStorage.setItem(key, payloadStr);
      }
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        console.warn(`[localStorage quota exceeded for ${key}]. Skipping localStorage write (data is saved in IndexedDB).`);
      } else {
        console.error(`Error flushing key ${key} to localStorage:`, e);
      }
    }
  }
}

// Non-blocking idle flush for localStorage disk I/O
function scheduleIdleStorageFlush() {
  if (idleFlushScheduled) return;
  idleFlushScheduled = true;

  const performFlush = () => {
    idleFlushScheduled = false;
    flushPendingStorageSynchronously();
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    // 200ms سقف أقصى: أقصر نافذة ممكنة بين التغيير والكتابة على القرص
    (window as any).requestIdleCallback(performFlush, { timeout: 200 });
  } else {
    setTimeout(performFlush, 120);
  }
}

// تأكيد كتابة كل ما هو معلّق قبل إغلاق الصفحة أو تجميد التطبيق (Page Lifecycle)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingStorageSynchronously);
  window.addEventListener('pagehide', flushPendingStorageSynchronously);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingStorageSynchronously();
    }
  });
  // Chrome: تجميد التبويب في الخلفية (آخر فرصة للكتابة قبل إيقاف العمليات)
  document.addEventListener('freeze', flushPendingStorageSynchronously as EventListener);

  // شبكة أمان: تفريغ دوري كل 20 ثانية حتى لو تأخر وقت الخمول
  window.setInterval(flushPendingStorageSynchronously, 20_000);
}

/**
 * طلب تخزين دائم من المتصفح (Storage Bucket) حتى لا يحذف النظام
 * بيانات IndexedDB/localStorage عند نقص مساحة الجهاز.
 * لا يضمن المتصفح الموافقة، لكنه يرفع الأولوية كثيراً عند الموافقة.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    const persisted = await navigator.storage.persisted?.();
    if (persisted) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

const isOffline = (): boolean =>
  typeof navigator !== 'undefined' && (navigator as any).onLine === false;

/**
 * هل يُسمح بعرض نسخة الكاش هذه؟ (TTL + بصمة السحابة + مخطّط التخزين)
 * في وضع عدم الاتصال نُفضّل عرض آخر نسخة معروفة على شاشة فارغة.
 */
function isEnvelopeUsable(key: string, env: StorageEnvelope<unknown>): boolean {
  const stamp: CacheStamp = {
    revision: env.revision || 0,
    cachedAt: env.timestamp || 0,
    schemaVersion: env.schemaVersion || 0
  };
  const evaluation = evaluateCacheFreshness(
    stamp,
    getKnownRevision(key),
    Date.now(),
    DEFAULT_CACHE_TTL_MS,
    CACHE_SCHEMA_VERSION
  );
  if (evaluation.fresh) return true;
  if (isOffline() && evaluation.reason !== 'schema') {
    // بدون شبكة: نعرض الكاش مع علم أنه غير مُتحقَّق منه حديثاً
    return true;
  }
  if (evaluation.reason !== 'missing') {
    perfMonitor.recordStorageRead(`stale:${key}:${evaluation.reason}`);
    void removeStoredEntry(key);
  }
  return false;
}

async function removeStoredEntry(key: string): Promise<void> {
  try {
    const { del } = await import('idb-keyval');
    await del(key);
  } catch {
    // تجاهل
  }
}

/**
 * إبطال كاش مفتاح واحد: الذاكرة + localStorage + IndexedDB.
 * يُستدعى عند اكتشاف أن بصمة السحابة أحدث من النسخة المحلية.
 */
export const invalidateStoredKey = (key: string): void => {
  memoryStore.delete(key);
  lastWrittenRef.delete(key);
  dirtyKeys.delete(key);
  cacheMetaStore.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // تجاهل
  }
  void removeStoredEntry(key);
};

export const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  perfMonitor.recordStorageRead(key);
  if (memoryStore.has(key)) {
    const memVal = memoryStore.get(key);
    if (Array.isArray(memVal) && memVal.length === 0 && Array.isArray(defaultValue) && defaultValue.length > 0) {
      memoryStore.set(key, defaultValue);
      return defaultValue as T;
    }
    return memVal as T;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      memoryStore.set(key, defaultValue);
      cacheMetaStore.set(key, { timestamp: Date.now(), version: 1 });
      return defaultValue;
    }
    const env = parseStorageEnvelope<T>(raw, defaultValue);
    if (!isEnvelopeUsable(key, env)) {
      memoryStore.set(key, defaultValue);
      cacheMetaStore.set(key, { timestamp: Date.now(), version: 1, updatedAt: new Date().toISOString() });
      return defaultValue;
    }
    if (Array.isArray(env.data) && env.data.length === 0 && Array.isArray(defaultValue) && defaultValue.length > 0) {
      memoryStore.set(key, defaultValue);
      cacheMetaStore.set(key, { 
        timestamp: Date.now(), 
        version: 1, 
        updatedAt: new Date().toISOString() 
      });
      lastWrittenRef.set(key, defaultValue);
      return defaultValue;
    }
    memoryStore.set(key, env.data);
    cacheMetaStore.set(key, { 
      timestamp: env.timestamp, 
      version: env.version, 
      updatedAt: env.updatedAt 
    });
    lastWrittenRef.set(key, env.data);
    return env.data;
  } catch (e) {
    console.error(`Error loading key ${key} from storage:`, e);
    memoryStore.set(key, defaultValue);
    cacheMetaStore.set(key, { timestamp: Date.now(), version: 1 });
    return defaultValue;
  }
};

export const saveToStorage = <T>(key: string, data: T): void => {
  perfMonitor.recordStorageWrite(key);
  // نفس المرجع = لا حاجة لإعادة الكتابة
  if (lastWrittenRef.get(key) === data) return;
  lastWrittenRef.set(key, data);
  cacheMetaStore.set(key, {
    timestamp: Date.now(),
    version: 1,
    updatedAt: new Date().toISOString()
  });

  memoryStore.set(key, data);
  dirtyKeys.add(key);

  scheduleIdleStorageFlush();
};

/** معلومات الكاش لمفتاح (للتشخيص): العمر والبصمة */
export const getCacheDiagnostics = (key: string): { knownRevision: number; cachedAt: number | null; hasMemory: boolean } => {
  const meta = cacheMetaStore.get(key);
  return {
    knownRevision: getKnownRevision(key),
    cachedAt: meta ? meta.timestamp : null,
    hasMemory: memoryStore.has(key)
  };
};

export const generateId = (): string => {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
};

export const clearAllStorage = () => {
  try {
    localStorage.removeItem('bm_cache_schema_v1');
    localStorage.removeItem('bm_cache_revisions_v1');
  } catch {
    // تجاهل
  }

  const collections = [
    STORAGE_KEYS.CLOTHES,
    STORAGE_KEYS.RENTALS,
    STORAGE_KEYS.SALES,
    STORAGE_KEYS.EXPENSES,
    STORAGE_KEYS.CREDITS,
    STORAGE_KEYS.CREDIT_PAYMENTS,
    STORAGE_KEYS.RAW_MATERIALS,
    STORAGE_KEYS.MAINTENANCE,
    STORAGE_KEYS.SUPPLIERS,
    STORAGE_KEYS.SEAMSTRESSES,
    STORAGE_KEYS.SEAMSTRESS_PAYMENTS,
    STORAGE_KEYS.STAFF_MEMBERS,
    STORAGE_KEYS.STAFF_PAYOUTS,
    STORAGE_KEYS.STAFF_ABSENCES,
    STORAGE_KEYS.CAISSE_CLOSURES,
    STORAGE_KEYS.ACTIVITY_LOGS
  ];

  collections.forEach(key => {
    localStorage.setItem(key, JSON.stringify({ data: [], timestamp: Date.now(), version: 1 }));
    memoryStore.set(key, []);
    lastWrittenRef.set(key, []);
  });

  // إفراغ صندوق الكتابات المعلّقة أيضاً حتى لا تُعاد بيانات قديمة
  try {
    localStorage.removeItem('bm_write_outbox_v1');
  } catch {
    // تجاهل
  }
};

export const initializeStorage = () => {
  const RESET_VERSION = 'boutique_wipe_empty_v1';
  if (localStorage.getItem('boutique_empty_data_flag') !== RESET_VERSION) {
    clearAllStorage();
    localStorage.setItem('boutique_empty_data_flag', RESET_VERSION);
  }

  // تغيّر مخطّط الكاش (شكل البيانات) ⇒ إبطال كل الكاش المحلي مرة واحدة
  const storedSchema = localStorage.getItem('bm_cache_schema_v1');
  if (storedSchema !== String(CACHE_SCHEMA_VERSION)) {
    invalidateAllCachedCollections();
    localStorage.setItem('bm_cache_schema_v1', String(CACHE_SCHEMA_VERSION));
  }
};

/** إبطال كل مفاتيح المجموعات دفعة واحدة (تغيّر المخطّط أو مسح شامل) */
export const invalidateAllCachedCollections = (): void => {
  for (const key of Object.values(STORAGE_KEYS)) {
    if (key === STORAGE_KEYS.SECURITY_PIN) continue;
    memoryStore.delete(key);
    lastWrittenRef.delete(key);
    dirtyKeys.delete(key);
    cacheMetaStore.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // تجاهل
    }
    void removeStoredEntry(key);
  }
};

// تعبئة كل المجموعات من IndexedDB بالتوازي (بدل قراءة تسلسلية بطيئة) قبل الاشتراكات السحابية
export async function hydrateFromIndexedDB(): Promise<void> {
  await Promise.all(Object.values(STORAGE_KEYS).map(async key => {
    try {
      const idbVal = await get(key);
      if (idbVal && idbVal.data) {
        const envelope: StorageEnvelope<unknown> = {
          data: idbVal.data,
          timestamp: idbVal.timestamp || 0,
          version: idbVal.version || 1,
          revision: typeof idbVal.revision === 'number' ? idbVal.revision : 0,
          schemaVersion: typeof idbVal.schemaVersion === 'number' ? idbVal.schemaVersion : 0
        };
        // لا نُعبّئ الذاكرة من IndexedDB إلا إذا كانت النسخة صالحة (TTL + بصمة السحابة)
        if (!isEnvelopeUsable(key, envelope)) return;
        const memVal = memoryStore.get(key);
        if (!memVal || (Array.isArray(memVal) && memVal.length === 0 && Array.isArray(idbVal.data) && idbVal.data.length > 0)) {
          memoryStore.set(key, idbVal.data);
          cacheMetaStore.set(key, {
            timestamp: idbVal.timestamp || Date.now(),
            version: idbVal.version || 1
          });
        }
      }
    } catch (err) {
      console.warn(`[IndexedDB Hydrate] Error reading ${key}:`, err);
    }
  }));
}
