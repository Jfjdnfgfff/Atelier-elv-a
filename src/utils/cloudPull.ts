import { FIREBASE_COLLECTIONS } from '../firebase';
import { baseUrl, restFetch, explainHttpFailure } from './firebaseDiagnostics';

// ---------------------------------------------------------------------------
// جلب البيانات الحقيقية من Firebase Realtime Database إلى التطبيق
// ---------------------------------------------------------------------------
// الهدف: أن تصل بيانات القاعدة إلى الواجهة حتى لو كانت مخزّنة تحت مسار جذري
// مختلف عن أسماء المجموعات الافتراضية (مثال: /boutique/clothes بدل /clothes).
// الخطوات:
//   1) قراءة مفاتيح الجذر بشكل سطحي (shallow) لمعرفة ما هو موجود فعلاً.
//   2) تحديد «جذر البيانات» تلقائياً: الجذر نفسه أو أول عقدة تحتوي مجموعاتنا.
//   3) قراءة كل مجموعة بالكامل وتحويلها إلى مصفوفة سجلات موحّدة.
// ---------------------------------------------------------------------------

export const PULLABLE_COLLECTIONS = Object.values(FIREBASE_COLLECTIONS);

export interface CloudPullProgress {
  done: number;
  total: number;
  current?: string;
}

export interface CloudPullResult {
  rootPath: string;
  detected: boolean;
  rootKeys: string[];
  counts: Record<string, number>;
  total: number;
  data: Record<string, any[]>;
  errors: string[];
  elapsedMs: number;
}

export class CloudPullError extends Error {
  hint?: string;
  status?: number;
  constructor(message: string, hint?: string, status?: number) {
    super(message);
    this.name = 'CloudPullError';
    this.hint = hint;
    this.status = status;
  }
}

async function getJson(path: string): Promise<{ ok: boolean; status: number; body: string; json: any }> {
  const url = `${baseUrl()}/${path}`;
  const res = await restFetch(url);
  const body = await res.text();
  let json: any = null;
  try {
    json = body && body !== 'null' ? JSON.parse(body) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, body, json };
}

// قائمة المفاتيح الموجودة في مسار معيّن (قراءة سطحية بلا تنزيل البيانات)
export async function getShallowKeys(path: string): Promise<string[]> {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const suffix = clean ? `${clean}/.json?shallow=true` : '.json?shallow=true';
  const result = await getJson(suffix);
  if (!result.ok) {
    const info = explainHttpFailure(result.status, result.body);
    throw new CloudPullError(info.detail, info.hint, result.status);
  }
  const val = result.json;
  if (!val || typeof val !== 'object') return [];
  return Object.keys(val);
}

const KNOWN = new Set<string>(PULLABLE_COLLECTIONS as string[]);

function intersectionScore(keys: string[]): number {
  return keys.reduce((acc, k) => (KNOWN.has(k) ? acc + 1 : acc), 0);
}

// تحديد مسار البيانات: '' (الجذر) أو 'اسم/عقدة/'
export async function detectDataRoot(): Promise<{ rootPath: string; detected: boolean; rootKeys: string[] }> {
  const rootKeys = await getShallowKeys('');
  if (rootKeys.length === 0) {
    return { rootPath: '', detected: false, rootKeys };
  }
  if (intersectionScore(rootKeys) > 0) {
    return { rootPath: '', detected: true, rootKeys };
  }

  // لا توجد مجموعات معروفة في الجذر — نفحص أول مستوى من العقد الفرعية
  const candidates = rootKeys.slice(0, 12);
  const probes = await Promise.all(
    candidates.map(async key => {
      try {
        const keys = await getShallowKeys(key);
        return { key, keys, score: intersectionScore(keys) };
      } catch {
        return { key, keys: [] as string[], score: 0 };
      }
    })
  );
  probes.sort((a, b) => b.score - a.score);
  if (probes[0] && probes[0].score > 0) {
    return { rootPath: `${probes[0].key}/`, detected: true, rootKeys };
  }
  return { rootPath: '', detected: false, rootKeys };
}

// تحويل قيمة Firebase (كائن مفاتيح أو مصفوفة) إلى مصفوفة سجلات موحّدة
export function normalizeRecords(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((item, index) => (item && typeof item === 'object' ? { ...item, id: item.id || String(index) } : null))
      .filter(Boolean);
  }
  if (typeof val === 'object') {
    return Object.keys(val)
      .map(key => {
        const item = val[key];
        if (!item || typeof item !== 'object') return null;
        return { ...item, id: item.id || key };
      })
      .filter(Boolean);
  }
  return [];
}

export async function pullCollection(rootPath: string, collectionKey: string): Promise<any[]> {
  const cleanRoot = rootPath ? `${rootPath.replace(/\/+$/g, '')}/` : '';
  const result = await getJson(`${cleanRoot}${collectionKey}.json`);
  if (!result.ok) {
    const info = explainHttpFailure(result.status, result.body);
    throw new CloudPullError(info.detail, info.hint, result.status);
  }
  return normalizeRecords(result.json);
}

// جلب كل المجموعات — يُستدعى عند بدء التطبيق وعند الضغط على «جلب من السحابة»
export async function pullAllFromCloud(
  collectionKeys: string[] = PULLABLE_COLLECTIONS,
  onProgress?: (progress: CloudPullProgress) => void
): Promise<CloudPullResult> {
  const started = Date.now();
  const { rootPath, detected, rootKeys } = await detectDataRoot();

  const counts: Record<string, number> = {};
  const data: Record<string, any[]> = {};
  const errors: string[] = [];
  let done = 0;

  const runOne = async (key: string) => {
    try {
      const items = await pullCollection(rootPath, key);
      data[key] = items;
      counts[key] = items.length;
    } catch (err: any) {
      errors.push(`${key}: ${err?.message || err}`);
      data[key] = [];
      counts[key] = 0;
    } finally {
      done += 1;
      onProgress?.({ done, total: collectionKeys.length, current: key });
    }
  };

  // دفعات صغيرة لتفادي إغراق الشبكة على الهواتف
  const BATCH = 6;
  for (let i = 0; i < collectionKeys.length; i += BATCH) {
    await Promise.all(collectionKeys.slice(i, i + BATCH).map(runOne));
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    rootPath,
    detected,
    rootKeys,
    counts,
    total,
    data,
    errors,
    elapsedMs: Date.now() - started
  };
}
