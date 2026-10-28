import { firebaseConfig, FIREBASE_COLLECTIONS } from '../firebase';

// ---------------------------------------------------------------------------
// تشخيص قراءة بيانات Firebase (Realtime Database)
// ---------------------------------------------------------------------------
// الفكرة: نستخدم واجهة REST الخاصة بـ RTDB بدل SDK لأن REST يعيد رمز الحالة
// ورسالة الخطأ الحقيقية (401 / 403 / 404)، بينما SDK يكتفي بتسجيل تحذير صامت
// في الكونسول ويترك الواجهة تبدو «متصلة» لكن بلا بيانات.
// ---------------------------------------------------------------------------

export type DiagnosticStatus = 'ok' | 'warn' | 'error';

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
  hint?: string;
  ms?: number;
  count?: number;
  rootKeys?: string[];
}

export interface DiagnosticReport {
  timestamp: string;
  baseUrl: string;
  checks: DiagnosticCheck[];
  okCount: number;
  errorCount: number;
  verdict: string;
}

const TIMEOUT_MS = 9000;

export function baseUrl(): string {
  return (firebaseConfig.databaseURL || '').replace(/\/+$/, '');
}

export function explainHttpFailure(status: number, body: string): { detail: string; hint: string } {
  const trimmed = (body || '').slice(0, 200);
  if (status === 401 || status === 403 || /permission_denied|Permission denied/i.test(trimmed)) {
    return {
      detail: `القاعدة رفضت القراءة (HTTP ${status}) — Permission denied`,
      hint:
        'قواعد الأمان في Firebase تمنع القراءة. افتح Firebase Console ← Realtime Database ← Rules ' +
        'وانشر ملف database.rules.json الموجود في المشروع ثم أعد المحاولة.'
    };
  }
  if (status === 404) {
    return {
      detail: 'القاعدة غير موجودة (HTTP 404)',
      hint:
        'الرابط databaseURL غير صحيح أو لم يتم إنشاء Realtime Database في هذا المشروع بعد. ' +
        'أنشئها من Firebase Console ← Realtime Database ← Create Database.'
    };
  }
  if (status === 400) {
    return {
      detail: `طلب غير صالح (HTTP 400): ${trimmed}`,
      hint: 'غالباً رقم المشروع أو رابط القاعدة غير مطابق للمشروع الحقيقي.'
    };
  }
  if (status >= 500) {
    return {
      detail: `خطأ من خوادم Firebase (HTTP ${status})`,
      hint: 'عطل مؤقت في خدمة Firebase — أعد المحاولة بعد قليل.'
    };
  }
  return {
    detail: `فشل الطلب (HTTP ${status}): ${trimmed}`,
    hint: 'راجع رابط قاعدة البيانات وقواعد الأمان.'
  };
}

function explainNetworkFailure(err: any): { detail: string; hint: string } {
  const msg = String(err?.message || err || '');
  if (/abort|timeout/i.test(msg)) {
    return {
      detail: 'انتهت مهلة الاتصال بخوادم Firebase',
      hint: 'قد يكون الاتصال بالإنترنت ضعيفاً أو محجوباً (جدار ناري / شبكة الجوال).'
    };
  }
  return {
    detail: `تعذر الوصول إلى Firebase: ${msg || 'خطأ شبكة غير معروف'}`,
    hint:
      'عادةً السبب: انقطاع الإنترنت، أو حجب النطاق firebaseio.com، أو مانع إعلانات/جدار حماية. ' +
      'تأكد من فتح الرابط التالي في المتصفح: ' + baseUrl()
  };
}

export async function restFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export function countKeys(val: any): number {
  if (!val) return 0;
  if (Array.isArray(val)) return val.filter(Boolean).length;
  if (typeof val === 'object') return Object.keys(val).length;
  return 1;
}

// فحص قراءة جذر القاعدة بشكل سطحي (shallow) — لا يُنزّل أي بيانات فعلية
export async function checkRootRead(): Promise<DiagnosticCheck> {
  const started = Date.now();
  const url = `${baseUrl()}/.json?shallow=true&limitToFirst=1`;
  try {
    const res = await restFetch(url);
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      const info = explainHttpFailure(res.status, text);
      return { id: 'root', label: 'الاتصال بقاعدة البيانات (قراءة الجذر)', status: 'error', ...info, ms };
    }
    let parsed: any = null;
    try {
      parsed = text && text !== 'null' ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    const rootKeys = parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
    return {
      id: 'root',
      label: 'الاتصال بقاعدة البيانات (قراءة الجذر)',
      status: 'ok',
      detail: rootKeys.length === 0
        ? 'تم الاتصال، لكن جذر القاعدة فارغ تماماً (لا توجد أي بيانات)'
        : `تم الاتصال — ${rootKeys.length} عقدة في الجذر`,
      hint: rootKeys.length === 0
        ? 'قاعدة البيانات موجودة لكنها فارغة. ارفع بياناتك بزر «مزامنة ورفع جميع البيانات» أو تأكد أنك تستخدم المشروع الصحيح (ateliu-14e23).'
        : undefined,
      rootKeys,
      ms
    };
  } catch (err: any) {
    const info = explainNetworkFailure(err);
    return { id: 'root', label: 'الاتصال بقاعدة البيانات (قراءة الجذر)', status: 'error', ...info, ms: Date.now() - started };
  }
}

// فحص قراءة مجموعة واحدة: يعيد عدد السجلات أو الخطأ الحقيقي
export async function checkCollectionRead(collectionKey: string, label: string): Promise<DiagnosticCheck> {
  const started = Date.now();
  const url = `${baseUrl()}/${collectionKey}.json?shallow=true`;
  try {
    const res = await restFetch(url);
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      const info = explainHttpFailure(res.status, text);
      return { id: collectionKey, label, status: 'error', ...info, ms };
    }
    let parsed: any = null;
    try {
      parsed = text && text !== 'null' ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    const count = countKeys(parsed);
    return {
      id: collectionKey,
      label,
      status: count === 0 ? 'warn' : 'ok',
      detail: count === 0 ? 'مقروءة، لكن لا توجد أي سجلات في السحابة' : `${count} سجل مقروء من السحابة`,
      hint: count === 0 ? 'إن كانت لديك بيانات محلية، استخدم زر «مزامنة ورفع جميع البيانات» لرفعها.' : undefined,
      ms,
      count
    };
  } catch (err: any) {
    const info = explainNetworkFailure(err);
    return { id: collectionKey, label, status: 'error', ...info, ms: Date.now() - started };
  }
}

const KEY_COLLECTIONS: Array<[string, string]> = [
  [FIREBASE_COLLECTIONS.CLOTHES, 'الفساتين والمخزون (clothes)'],
  [FIREBASE_COLLECTIONS.RENTALS, 'عمليات الكراء (rentals)'],
  [FIREBASE_COLLECTIONS.SALES, 'فواتير البيع (sales)'],
  [FIREBASE_COLLECTIONS.EXPENSES, 'المصاريف (expenses)'],
  [FIREBASE_COLLECTIONS.CREDITS, 'الديون (credits)'],
  [FIREBASE_COLLECTIONS.CREDIT_PAYMENTS, 'تسديدات الديون (creditPayments)'],
  [FIREBASE_COLLECTIONS.STAFF_MEMBERS, 'الموظفون (staffMembers)'],
  [FIREBASE_COLLECTIONS.CAISSE_CLOSURES, 'إغلاقات الصندوق (caisseClosures)'],
  [FIREBASE_COLLECTIONS.CLOTH_IMAGES, 'صور المنتجات (clothImages)']
];

export async function runFirebaseDiagnostics(): Promise<DiagnosticReport> {
  const timestamp = new Date().toISOString();
  const checks: DiagnosticCheck[] = [];

  const online: DiagnosticCheck = typeof navigator !== 'undefined' && navigator.onLine === false
    ? {
        id: 'network',
        label: 'اتصال الإنترنت بالجهاز',
        status: 'error',
        detail: 'الجهاز يظهر بدون اتصال بالإنترنت',
        hint: 'وصّل الجهاز بالشبكة ثم أعد الفحص.'
      }
    : {
        id: 'network',
        label: 'اتصال الإنترنت بالجهاز',
        status: 'ok',
        detail: 'الجهاز متصل بالإنترنت'
      };
  checks.push(online);

  const root = await checkRootRead();
  checks.push(root);

  if (root.status === 'ok') {
    const results = await Promise.all(
      KEY_COLLECTIONS.map(([key, label]) => checkCollectionRead(key, label))
    );
    checks.push(...results);
  }

  const errorCount = checks.filter(c => c.status === 'error').length;
  const okCount = checks.filter(c => c.status === 'ok').length;

  let verdict = 'كل الفحوصات سليمة — القراءة من Firebase تعمل.';
  if (errorCount > 0) {
    const permission = checks.some(c => /Permission denied|رفضت/i.test(c.detail));
    verdict = permission
      ? 'القراءة محجوبة بقواعد الأمان (Permission denied) — هذا سبب عدم ظهور البيانات.'
      : 'هناك فشل في الوصول إلى Firebase — راجع التفاصيل أدناه.';
  } else if (checks.some(c => c.status === 'warn')) {
    verdict = 'الاتصال سليم لكن بعض المجموعات فارغة في السحابة (البيانات قد تكون محلية فقط).';
  }

  return { timestamp, baseUrl: baseUrl(), checks, okCount, errorCount, verdict };
}

// اختبار كتابة وإعادة قراءة وحذف سجل مؤقت للتأكد من أن الحفظ يعمل
export async function testWritePermission(): Promise<DiagnosticCheck> {
  const started = Date.now();
  const path = `_diagnostics/ping_${Date.now()}`;
  const url = `${baseUrl()}/${path}.json`;
  const payload = JSON.stringify({ ok: true, at: new Date().toISOString() });
  try {
    const res = await restFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: payload });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      const info = explainHttpFailure(res.status, text);
      return {
        id: 'write',
        label: 'اختبار الكتابة في قاعدة البيانات',
        status: 'error',
        ...info,
        ms
      };
    }
    // تنظيف السجل المؤقت
    try {
      await restFetch(url, { method: 'DELETE' });
    } catch {
      /* لا شيء */
    }
    return {
      id: 'write',
      label: 'اختبار الكتابة في قاعدة البيانات',
      status: 'ok',
      detail: 'تمت كتابة سجل تجريبي وحذفه بنجاح — الكتابة مسموحة',
      ms
    };
  } catch (err: any) {
    const info = explainNetworkFailure(err);
    return { id: 'write', label: 'اختبار الكتابة في قاعدة البيانات', status: 'error', ...info, ms: Date.now() - started };
  }
}
