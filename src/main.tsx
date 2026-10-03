/**
 * نقطة الدخول (Entry) — صفر تبعيات ثابتة (Zero static imports)
 *
 * الهدف: ألا ينتظر أول رسم للصفحة (FCP/LCP) أي JavaScript إطلاقاً.
 * الهيكل الأولي (#boot-shell) مرسوم مسبقاً بـ CSS مضمّن في index.html،
 * وهذا الملف (بحجم < 1KB) يقوم فقط بجدولة تحميل حزمة التطبيق بعد أول إطار.
 *
 * لا تُضِف أي `import` ثابت هنا — كل تبعية يجب أن تكون ديناميكية داخل bootstrap.tsx
 * حتى يبقى هذا الملف بالحجم الأدنى ولا يدخل في المسار الحرج للعرض.
 */

type BootWindow = Window & {
  __removeBootShell?: () => void;
  __bootFailed?: boolean;
};

const win = window as BootWindow;
const shell = document.getElementById('boot-shell');

// نقطة قياس حقيقية (Field Data) لزمن إقلاع التطبيق — تُقرأ بـ performance.getEntriesByName
try {
  performance.mark('boot:start');
} catch {
  /* لا شيء */
}

/** يزيل هيكل التحميل بنعومة (يُستدعى من bootstrap.tsx عند أول commit لـ React) */
function removeBootShell(): void {
  if (!shell || shell.classList.contains('is-hidden')) return;
  shell.classList.add('is-hidden');
  window.setTimeout(() => shell.remove(), 240);
}
win.__removeBootShell = removeBootShell;

/** شاشة احتياطية عند فشل تحميل الحزمة (شبكة/كاش/CDN) */
function showBootError(): void {
  if (!shell || win.__bootFailed) return;
  win.__bootFailed = true;
  const body = shell.querySelector('.bs-body');
  if (!body) return;
  body.innerHTML =
    '<span class="bs-error">تعذّر تحميل التطبيق. تحقّق من الاتصال بالإنترنت ثم أعد تحميل الصفحة.</span>';
}

let booted = false;

/** تحميل حزمة التطبيق (React + App) بعد الرسم الأول — Dynamic import */
function boot(): void {
  if (booted) return;
  booted = true;
  import('./bootstrap').catch((error) => {
    console.error('[boot] failed to load app bundle', error);
    showBootError();
  });
}

// 1) ننتظر أول إطار (رُسم الهيكل فعلياً) 2) نخرج من مهمة الرسم الحالية 3) نحمّل التطبيق
if (typeof requestAnimationFrame === 'function') {
  requestAnimationFrame(() => {
    window.setTimeout(boot, 0);
  });
} else {
  window.setTimeout(boot, 0);
}

// شبكة أمان: إن لم يُستدعَ boot لأي سبب خلال 3 ثوانٍ (WebView قديم/حالة حافة)
window.setTimeout(boot, 3000);

export {};
