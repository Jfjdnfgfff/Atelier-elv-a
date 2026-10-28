import { FIREBASE_COLLECTIONS } from '../firebaseProject';
import { baseUrl, restFetch } from './firebaseDiagnostics';

// ---------------------------------------------------------------------------
// مخطط مسارات قاعدة البيانات (Cloud Layout)
// ---------------------------------------------------------------------------
// قاعدة البيانات الحقيقية لا تخزّن المجموعات بأسمائها البرمجية فقط، بل قد
// تستخدم بادئات أو تُجمّعها داخل عقدة (مثال واقعي لمشروع ateliu-14e23):
//
//   /appSettings
//   /boutique_activity_logs
//   /boutique_caisse_closures
//   /boutique_clothes
//   /boutique_staff_members
//   /boutique_store/(rentals, sales, expenses, ...)
//
// لذلك نكتشف المخطط مرة واحدة عند الإقلاع ثم نقرأ ونكتب على المسارات
// الحقيقية، بدل إنشاء نسخة موازية فارغة تحت /clothes و/sales.
// ---------------------------------------------------------------------------

export type CloudLayoutMap = Record<string, string>;

export interface CloudLayout {
  resolved: CloudLayoutMap;
  /** أسلوب التسمية المستنتج للجذر، مثل boutique_ أو '' */
  rootPrefix: string;
  /** العقدة الحاضنة إن كانت المجموعات مجمّعة داخلها (مثل boutique_store) */
  container: string;
  rootKeys: string[];
  detectedAt: string;
  ok: boolean;
}

export const LOGICAL_COLLECTIONS: string[] = Object.values(FIREBASE_COLLECTIONS);

const SPECIAL_KEYS = new Set<string>([FIREBASE_COLLECTIONS.SETTINGS, 'appSettings', 'settings', 'trash', '_diagnostics']);

// مرادفات الأسماء: الشكل البرمجي (camelCase) ↔ الشكل المخزّن (snake_case)
const ALIASES: Record<string, string[]> = {
  activityLogs: ['activityLogs', 'activity_logs'],
  caisseClosures: ['caisseClosures', 'caisse_closures'],
  staffMembers: ['staffMembers', 'staff_members'],
  staffPayouts: ['staffPayouts', 'staff_payouts'],
  staffAbsences: ['staffAbsences', 'staff_absences'],
  creditPayments: ['creditPayments', 'credit_payments'],
  rawMaterials: ['rawMaterials', 'raw_materials'],
  maintenanceOrders: ['maintenanceOrders', 'maintenance_orders'],
  clothImages: ['clothImages', 'cloth_images'],
  clothThumbs: ['clothThumbs', 'cloth_thumbs'],
  appSettings: ['appSettings', 'app_settings', 'settings']
};

const KNOWN_PREFIXES = ['boutique_', 'boutique-', 'bm_', 'atelier_'];

function toSnake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function stripKnownPrefix(segment: string): string {
  const lower = segment.toLowerCase();
  for (const prefix of KNOWN_PREFIXES) {
    if (lower.startsWith(prefix)) return segment.slice(prefix.length);
  }
  return segment;
}

/** يحوّل اسم عقدة مخزّنة (boutique_staff_members) إلى اسم منطقي (staffMembers) */
export function logicalNameForNode(segment: string): string | null {
  const bare = stripKnownPrefix(segment);
  const candidates = new Set<string>([
    bare,
    bare.toLowerCase(),
    bare.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())
  ]);
  for (const key of LOGICAL_COLLECTIONS) {
    const names = new Set<string>([key, ...(ALIASES[key] || [])]);
    for (const name of names) {
      if (candidates.has(name) || candidates.has(name.toLowerCase())) return key;
    }
  }
  return null;
}

function isKnownCollectionName(segment: string): boolean {
  return logicalNameForNode(segment) !== null;
}

// ---- الحالة المخزّنة (تُقرأ بشكل متزامن من بقية الملفات) ----------------

let current: CloudLayout | null = null;
let pending: Promise<CloudLayout> | null = null;

export function getCloudLayout(): CloudLayout | null {
  return current;
}

/**
 * المسار الحقيقي لمجموعة منطقية — متزامن.
 * قبل انتهاء الاكتشاف يعيد الاسم المنطقي كما هو (السلوك القديم).
 */
export function cloudPath(collectionKey: string): string {
  if (current && current.resolved[collectionKey]) return current.resolved[collectionKey];
  return collectionKey;
}

export function getLayoutSummary(): string {
  if (!current || !current.ok) return 'غير مكتشف بعد';
  return Object.entries(current.resolved)
    .map(([logical, path]) => `${logical} → /${path}`)
    .join(' • ');
}

async function shallowKeys(path: string): Promise<string[] | null> {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const url = `${baseUrl()}/${clean ? `${clean}/` : ''}.json?shallow=true`;
  try {
    const res = await restFetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text === 'null') return [];
    const val = JSON.parse(text);
    if (!val || typeof val !== 'object') return [];
    return Object.keys(val);
  } catch {
    return null;
  }
}

/**
 * اكتشاف المخطط: قراءة سطحية للجذر ثم للعقد غير المعروفة فقط.
 * عدد الطلبات صغير جداً (طلب واحد عادةً + طلب لكل عقدة حاضنة).
 */
export async function detectCloudLayout(): Promise<CloudLayout> {
  const rootKeys = (await shallowKeys('')) || [];
  const resolved: CloudLayoutMap = {};
  const prefixVotes = new Map<string, number>();
  const containerVotes = new Map<string, number>();

  const registerMatch = (logical: string, path: string) => {
    if (!resolved[logical]) resolved[logical] = path;
    // تصويت على أسلوب الجذر: هل المسار في الجذر أم داخل عقدة حاضنة؟
    const segments = path.split('/');
    if (segments.length === 1) {
      const bare = stripKnownPrefix(segments[0]);
      const prefix = segments[0].slice(0, segments[0].length - bare.length);
      prefixVotes.set(prefix, (prefixVotes.get(prefix) || 0) + 1);
    } else {
      containerVotes.set(segments[0], (containerVotes.get(segments[0]) || 0) + 1);
    }
  };

  // 1) مطابقة مفاتيح الجذر مباشرة
  const unknownRoots: string[] = [];
  for (const key of rootKeys) {
    const logical = logicalNameForNode(key);
    if (logical) registerMatch(logical, key);
    else if (!SPECIAL_KEYS.has(key)) unknownRoots.push(key);
  }

  // 2) فحص العقد غير المعروفة (قد تكون حاضنة لمجموعات)
  const probes = await Promise.all(
    unknownRoots.slice(0, 8).map(async key => ({ key, children: (await shallowKeys(key)) || [] }))
  );
  for (const probe of probes) {
    const looksLikeContainer = probe.children.some(child => isKnownCollectionName(child));
    if (!looksLikeContainer) continue;
    for (const child of probe.children) {
      const logical = logicalNameForNode(child);
      if (logical) registerMatch(logical, `${probe.key}/${child}`);
    }
  }

  // 3) استنتاج مسار الكتابة للمجموعات غير الموجودة بعد
  // قاعدة الأولوية: إذا وُجدت عقدة حاضنة (مثل boutique_store) تحتوي مجموعات
  // معروفة، فكل المجموعات المتبقية تُكتب داخلها بنفس أسلوب التسمية المستخدم
  // هناك. وإلا نستخدم أسلوب تسمية الجذر (مثل boutique_).
  const bestPrefix = Array.from(prefixVotes.entries()).sort((a, b) => b[1] - a[1])[0];
  const bestContainer = Array.from(containerVotes.entries()).sort((a, b) => b[1] - a[1])[0];
  const rootPrefix = bestPrefix ? bestPrefix[0] : '';

  // أسلوب تسمية أبناء العقدة الحاضنة (ببادئة أم لا)
  let containerPrefix = '';
  if (bestContainer) {
    const sample = Object.values(resolved).find((path: string) => path.startsWith(`${bestContainer[0]}/`));
    if (sample) {
      const leaf = sample.split('/')[1] || '';
      const bare = stripKnownPrefix(leaf);
      containerPrefix = leaf.slice(0, leaf.length - bare.length);
    }
  }

  for (const logical of LOGICAL_COLLECTIONS) {
    if (resolved[logical]) continue;
    if (logical === FIREBASE_COLLECTIONS.SETTINGS) {
      resolved[logical] = 'appSettings';
      continue;
    }
    if (bestContainer) {
      resolved[logical] = `${bestContainer[0]}/${containerPrefix}${toSnake(logical)}`;
    } else {
      resolved[logical] = rootPrefix ? `${rootPrefix}${toSnake(logical)}` : toSnake(logical);
    }
  }

  const layout: CloudLayout = {
    resolved,
    rootPrefix,
    container: bestContainer ? bestContainer[0] : '',
    rootKeys,
    detectedAt: new Date().toISOString(),
    ok: rootKeys.length > 0
  };

  current = layout;
  pending = null;
  return layout;
}

/** يضمن اكتشاف المخطط مرة واحدة فقط (آمن للاستدعاء المتكرر/المتوازي) */
export async function ensureCloudLayout(force: boolean = false): Promise<CloudLayout> {
  if (!force && current) return current;
  if (!force && pending) return pending;
  pending = detectCloudLayout().catch(err => {
    pending = null;
    const fallback: CloudLayout = {
      resolved: Object.fromEntries(LOGICAL_COLLECTIONS.map(key => [key, key])),
      rootPrefix: '',
      container: '',
      rootKeys: [],
      detectedAt: new Date().toISOString(),
      ok: false
    };
    current = fallback;
    console.warn('[CloudLayout] detection failed, using default paths:', err);
    return fallback;
  });
  return pending;
}
