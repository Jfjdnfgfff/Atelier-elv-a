/**
 * سياسة الكاش وإبطاله (Cache policy & invalidation)
 * -------------------------------------------------
 * الكاش المحلي (IndexedDB + localStorage + الذاكرة) لا يُعرض للمستخدم إلا إذا كان «صالحاً».
 * يُعتبر الكاش صالحاً فقط عندما تتحقق كل الشروط التالية:
 *
 *   1. نفس نسخة المخطّط (CACHE_SCHEMA_VERSION) — تغيير شكل البيانات يُبطل كل شيء.
 *   2. بصمة السحابة (revision) لا تسبق بصمة الكاش — أي كتابة من أي جهاز آخر تُبطله.
 *   3. العمر لم يتجاوز TTL — حماية من بيانات «معلّقة» عند غياب أي إشارة تحديث.
 *
 * هذه الوحدة نقية (Pure) قدر الإمكان: لا تستورد Firebase ولا React، حتى يمكن اختبارها
 * وحدها، ويمكن استخدامها من storage.ts دون أي حلقة استيراد.
 */

export const CACHE_SCHEMA_VERSION = 2;

/** مدة صلاحية الكاش: 12 ساعة (تُبطله بصمة السحابة قبل ذلك عند أي تغيير) */
export const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const REVISIONS_STORAGE_KEY = 'bm_cache_revisions_v1';

export interface CacheStamp {
  /** بصمة آخر تعديل معروفة وقت كتابة الكاش (ms) */
  revision: number;
  /** وقت كتابة الكاش (ms) */
  cachedAt: number;
  /** نسخة المخطّط وقت الكتابة */
  schemaVersion: number;
  /** مدة الصلاحية الخاصة بهذا المفتاح (اختياري) */
  ttlMs?: number;
}

export type CacheStaleReason = 'ok' | 'schema' | 'revision' | 'expired' | 'missing';

export interface CacheEvaluation {
  fresh: boolean;
  reason: CacheStaleReason;
  ageMs: number;
}

/**
 * تقييم صلاحية مدخل كاش. `remoteRevision` هي بصمة السحابة الحالية (إن عُرفت).
 * البصمة المتزايدة (أحدث) من الكاش تعني أن هناك تعديلاً لم يره هذا الجهاز → إبطال.
 */
export function evaluateCacheFreshness(
  stamp: CacheStamp | null | undefined,
  remoteRevision: number | null | undefined,
  now: number = Date.now(),
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
  schemaVersion: number = CACHE_SCHEMA_VERSION
): CacheEvaluation {
  if (!stamp || typeof stamp.cachedAt !== 'number') {
    return { fresh: false, reason: 'missing', ageMs: Number.POSITIVE_INFINITY };
  }

  const ageMs = Math.max(0, now - stamp.cachedAt);

  if (stamp.schemaVersion !== schemaVersion) {
    return { fresh: false, reason: 'schema', ageMs };
  }

  const effectiveTtl = stamp.ttlMs && stamp.ttlMs > 0 ? stamp.ttlMs : ttlMs;
  if (ageMs > effectiveTtl) {
    return { fresh: false, reason: 'expired', ageMs };
  }

  if (
    typeof remoteRevision === 'number' &&
    Number.isFinite(remoteRevision) &&
    remoteRevision > (stamp.revision || 0)
  ) {
    return { fresh: false, reason: 'revision', ageMs };
  }

  return { fresh: true, reason: 'ok', ageMs };
}

export function makeCacheStamp(revision: number, now: number = Date.now()): CacheStamp {
  return {
    revision: Number.isFinite(revision) ? revision : 0,
    cachedAt: now,
    schemaVersion: CACHE_SCHEMA_VERSION
  };
}

// ---------------------------------------------------------------------------
// سجل بصمات المجموعات (محلي): آخر بصمة معروفة لكل مجموعة، تُحدَّث بعد كل كتابة
// ناجحة أو بعد قراءة البصمات من السحابة.
// ---------------------------------------------------------------------------

let revisionsLoaded = false;
let revisionRegistry: Record<string, number> = {};

function loadRevisionRegistry(): Record<string, number> {
  if (revisionsLoaded) return revisionRegistry;
  revisionsLoaded = true;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(REVISIONS_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const clean: Record<string, number> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
        }
        revisionRegistry = clean;
      }
    }
  } catch {
    revisionRegistry = {};
  }
  return revisionRegistry;
}

function persistRevisionRegistry(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REVISIONS_STORAGE_KEY, JSON.stringify(revisionRegistry));
    }
  } catch {
    // تجاوز الحصة أو وضع التصفح الخاص — لا شيء حرج
  }
}

export function getKnownRevision(key: string): number {
  const registry = loadRevisionRegistry();
  return typeof registry[key] === 'number' ? registry[key] : 0;
}

export function setKnownRevision(key: string, revision: number): void {
  if (!Number.isFinite(revision)) return;
  const registry = loadRevisionRegistry();
  if (registry[key] === revision) return;
  registry[key] = revision;
  persistRevisionRegistry();
}

export function getAllKnownRevisions(): Record<string, number> {
  return { ...loadRevisionRegistry() };
}

/** إعادة السجل إلى الصفر (يُستخدم عند تغيير المخطّط أو مسح البيانات) */
export function resetRevisionRegistry(): void {
  revisionRegistry = {};
  revisionsLoaded = true;
  persistRevisionRegistry();
}

/** هل تحتاج المجموعة إلى إبطال كاشها؟ */
export function shouldInvalidateCache(
  key: string,
  stamp: CacheStamp | null | undefined,
  now: number = Date.now()
): CacheEvaluation {
  return evaluateCacheFreshness(stamp, getKnownRevision(key), now);
}
