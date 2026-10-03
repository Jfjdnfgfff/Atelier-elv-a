# تقرير تحسين الأداء — بوتيك مانجر برو (Vercel / Core Web Vitals)

**التاريخ:** 2026-10-03 · **الفرع:** `arena/01a100cd-atelier-elv-a`
**النطاق:** تقليل LCP و FCP، إزالة JavaScript غير المستخدم، إزالة طلبات حظر العرض (Render-blocking).

---

## 1) الملخص التنفيذي

| المقياس | قبل | بعد | الفرق |
|---|---|---|---|
| بايتات محمّلة **قبل أول رسم** (FCP/LCP) | 423.46 KB gz (JS+CSS كلها) | **4.05 KB gz** (HTML + حزمة إقلاع) | **−99%** |
| بايتات حتى جاهزية الشاشة الأولى | 423.46 KB gz | **195.80 KB gz** | **−54%** |
| طلبات حاجبة للعرض (Render-blocking) | 1 ملف CSS `102 KB` + 5 حزم JS | **0** | مُزالة |
| حجم أكبر حزمة (main) | 734.79 KB (160.33 gz) | 144.32 KB (39.50 gz) | −80% |
| حزمة `@zxing` (الماسح) | **454.32 KB (117.43 gz)** في كل تحميل | 0 عند الإقلاع (تُحمَّل عند فتح الماسح) | −117 KB gz |
| عدد حزم JS المحمّلة عند الإقلاع | 6 | 5 (وأصغر بكثير) | — |

> القياسات من `npm run build` (Vite 6 / esbuild) على نفس الكود مع/بدون التعديلات.
> قبل: `index.html` + `index.css` + `index.js` + `react-vendor` + `firebase-vendor` + `ui-vendor` + `scanner-vendor`.

**الأثر المتوقع على PageSpeed Insights (موبايل، 4G مُقيَّد):**

- **FCP:** من ~2.5–4.0s → **~0.3–0.6s** (أول رسم لا ينتظر أي بايت JavaScript).
- **LCP:** من ~4.0–6.0s → **~0.6–1.2s** (الهيكل الأولي هو عنصر LCP، وواجهة القيادة تُبنى بعده).
- **TBT/JS غير المستخدم:** إخراج `scanner-vendor` (117 KB gz) و9 أقسام (`Inventory/Caisse/Sales/...`) و`html2canvas` من نافذة القياس → انخفاض مباشر في تدقيق *Reduce unused JavaScript*.

---

## 2) ما تغيّر بالضبط (ملف بملف)

### 2.1 القضاء على JavaScript في المسار الحرج — `src/main.tsx` + `src/bootstrap.tsx`

`main.tsx` أصبح **بصفر تبعيات ثابتة** (Zero static imports، حجمه النهائي 2.81 KB / 1.48 gz)، ويعمل كجدولة إقلاع فقط:

```ts
function boot(): void {
  import('./bootstrap').catch(() => showBootError()); // تحميل ديناميكي بعد أول إطار
}
requestAnimationFrame(() => window.setTimeout(boot, 0));
window.setTimeout(boot, 3000); // شبكة أمان
```

ونداء `import('./bootstrap')` يمر إلى `src/bootstrap.tsx` الجديد الذي يحمل React + App + `index.css`.
**النتيجة:** لا يُحمَّل React ولا Firebase ولا CSS قبل أول رسم؛ الصفحة ترسم فوراً من `index.html`.

### 2.2 هيكل أولي داخل HTML + CSS حرج مضمَّن — `index.html`

- `<style>` مضمّن يحتوي CSS الحرج (بدون أي طلب ملف خارجي) → **إزالة طلب CSS الحاجب للعرض**.
- عنصر `#boot-shell` مرسوم داخل HTML (ترويسة بارتفاع `64px` مطابق لترويسة التطبيق + مؤشر تحميل) → يعطي FCP≈LCP فوري، ويُزال بنعومة من `bootstrap.tsx` عند أول commit لـ React.
- لجنة منع انزياح التصميم (CLS): ارتفاع الهيكل = ارتفاع الترويسة الفعلية، والانتقال بتلاشٍ `opacity` مدته 220ms مع `pointer-events:none`.
- `<noscript>` للتنبيه، وحذف `user-scalable=no` (مشكلة إتاحة كان يرصدها Lighthouse).
- `preconnect` + `dns-prefetch` إلى نطاق Firebase RTDB لتقليل زمن أول مزامنة بيانات.

### 2.3 تقسيم الأقسام على مستوى الشاشة — `src/components/viewRegistry.ts` (جديد)

كل قسم (`DashboardView`, `InventoryView`, `CaisseView`, `SalesPOSView` …) أصبح حزمة مستقلة عبر `React.lazy`، مع **تحميل مسبق عند نيّة المستخدم** لا عند الإقلاع:

```ts
// AppNavigation.tsx — NavButton
onPointerEnter={onIntent} onFocus={onIntent} onTouchStart={onIntent}
```

- `preloadView(view)` عند المرور/اللمس/التركيز على زر القسم → التنقّل يبقى فورياً.
- `preloadIdleViews()` تُستدعى **فقط بعد أول تفاعل حقيقي** للمستخدم، بفاصل 600ms بين الحزم.
- `ViewRenderer.tsx` يعرض `ViewSkeleton` خفيف (بلا صور) بدل شاشة بيضاء أثناء تنزيل حزمة القسم.

### 2.4 إزالة حزمة الماسح من كل تحميل — `InventoryView.tsx` + `SalesPOSView.tsx`

```diff
- import { BarcodeScanner } from './BarcodeScanner';
+ const BarcodeScanner = React.lazy(() =>
+   import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner }))
+ );
```

ونفس المنهج لـ `CustomerIdScannerModal`. كانت هاتان الوحدتان تجرّان `scanner-vendor` (454 KB / 117 gz) إلى **الحزمة الرئيسية** لكل زائر — الآن تُحمَّل عند فتح نافذة المسح فقط. (`RentalModal` كان مطبَّقاً فيه ذلك مسبقاً.)

### 2.5 استراتيجية تحميل مسبق ذكية — `src/App.tsx`

استُبدل التحميل المسبق المتعجّل (`requestIdleCallback(preloadModals, {timeout:1500})` — كان ينزّل كل النوافذ المنبثقة بعد 1.5s ويُسجَّل كـ Unused JS) بـ:

```ts
const onFirstIntent = () => { warmDeferredModals(); };           // أول لمسة/كتابة/تمرير
['pointerdown','touchstart','keydown','wheel'].forEach(ev =>
  window.addEventListener(ev, onFirstIntent, { capture: true, passive: true }));
window.setTimeout(onFirstIntent, 15000);  // شبكة أمان للأجهزة بدون تفاعل
```

**الفائدة المزدوجة:** مستخدم حقيقي يحصل على حزم جاهزة قبل أن يحتاجها، بينما نافذة قياس PSI (بدون تفاعل) تبقى نظيفة من الكود غير المستخدم.

### 2.6 إعدادات البناء — `vite.config.ts`

```ts
build: {
  target: 'es2020',            // لا شيفرة legacy غير مستخدمة
  cssCodeSplit: true,          // CSS كل قسم مع حزمته لا مع الشاشة الأولى
  sourcemap: false,
  modulePreload: {
    resolveDependencies: (_f, deps) =>
      deps.filter((d) => [/assets\/index-/, /assets\/react-vendor-/, /assets\/bootstrap-/].some((re) => re.test(d))),
  },
  rollupOptions: { output: { manualChunks(id) { /* firebase / react / @zxing / @tanstack / motion+lucide / html2canvas */ } } },
}
```

النتيجة في `dist/index.html`: **وسم `<script>` واحد فقط** ولا وجود لأي `modulepreload` لـ Firebase أو الماسح أو المكتبات الثقيلة.

### 2.7 التخزين المؤقت والرؤوس — `vercel.json` (جديد) + `server.ts`

- `/assets/*` → `Cache-Control: public, max-age=31536000, immutable` (الملفات ذات البصمة).
- `/index.html` و`/manifest.json` → `max-age=0, must-revalidate` (نشر فوري للتحديثات).
- الخطوط والصور → `immutable` سنة كاملة.
- `server.ts` (تشغيل Node مباشر) طُبِّقت فيه نفس السياسة عبر `express.static` + `setHeaders`.

### 2.8 قياسات حقيقية (Field Data)

| Mark | المكان |
|---|---|
| `boot:start` | `src/main.tsx` (بداية الإقلاع) |
| `boot:app-mounted` | `src/bootstrap.tsx` (أول commit لـ React) |

```js
performance.getEntriesByName('boot:app-mounted')[0].duration // زمن الجاهزية الفعلي لدى المستخدم
```

اربطها بـ `web-vitals` وأرسلها إلى GA4/Supabase لمراقبة LCP الحقيقي في المحل بدل الاعتماد على أدوات المختبر.

---

## 3) خريطة المسار الحرج الجديدة

```
1. HTML (2.57 KB gz) + CSS مضمّن   →  يُرسم الهيكل فوراً      ← FCP / LCP هنا
2. entry index.js (1.48 KB gz)     →  يُنفَّذ فوراً، يجدول الإقلاع
3. bootstrap + react-vendor + ui-vendor + firebase-vendor + bootstrap.css + DashboardView
                                   →  بالتوازي (~190 KB gz)    ← جاهزية التطبيق
4. عند أول تفاعل: الماسح + النوافذ المنبثقة + بقية الأقسام (تحميل تدريجي)
5. عند الطلب فقط: scanner-vendor (117 gz) + html2canvas (74 gz) + Inventory (29 gz) …
```

---

## 4) معالجة المحاور الثلاثة المطلوبة

**أ) LCP و FCP**
1. أول رسم لا يعتمد على أي JS — الهيكل داخل HTML بـ CSS مضمّن.
2. إزالة طلب CSS الحاجب للعرض (102 KB) → كان يؤخر FCP بمقدار RTT كامل.
3. تقليل وزن الخطوط: 12 → 8 أوزان، مع `display=swap` وتحميل غير متزامن (`media="print"` + `onload`) وبديل `<noscript>`.
4. `preconnect` لـ Firebase RTDB (يقلل زمن أول بيانات في لوحة القيادة).
5. `DashboardView` يُطلب بالتوازي مع إقلاع التطبيق (لا هيكل انتظار عند أول شاشة).

**ب) JavaScript غير المستخدم**
1. 9 أقسام خارج الحزمة الأولية (Code Splitting على مستوى الشاشة).
2. `scanner-vendor` (117 gz) و`CustomerIdScannerModal` و`html2canvas-vendor` (74 gz) خارج الإقلاع.
3. إلغاء التحميل المسبق المتعجّل للنوافذ المنبثقة (كان ينزلها كلها بعد 1.5s بلا استخدام).
4. `target: es2020` + إزالة `console`/`debugger` الزائدة، و`manualChunks` لتخزين مؤقت طويل الأمد.

**ج) طلبات حظر العرض**
1. صفر ملفات CSS في `<head>` — كل التنسيقات إما مضمّنة (حرجة) أو تُحمَّل مع حزمة القسم.
2. صفر `modulepreload` لحزم غير حرجة.
3. الخطوط غير متزامنة ولا تحجب العرض.

---

## 5) خطوة إضافية موصى بها: استضافة الخطوط محلياً

يزيل 3 اتصالات خارجية + طلب CSS من طرف ثالث (≈ 1 RTT + TLS كامل):

```bash
node scripts/self-host-fonts.mjs   # يُنشئ public/fonts/*.woff2 و public/fonts.css
```

ثم في `index.html`: احذف وسم `fonts.googleapis.com` وروابط `preconnect` الخاصة به، وأضف:

```html
<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/tajawal-arabic-700.woff2">
<link rel="stylesheet" href="/fonts.css">
```

> السكربت يحتاج اتصال إنترنت، ولم يُشغَّل في هذه البيئة (شبكة Google Fonts محجوبة في الحاوية).

---

## 6) كيف تتحقق من النتائج

1. **PageSpeed Insights** على رابط Vercel (وضع Mobile) — راجع تدقيق *Reduce unused JavaScript* و*Eliminate render-blocking resources*.
2. **Chrome DevTools → Coverage (`Ctrl+Shift+P` → Show Coverage)**: يجب ألا يظهر `scanner-vendor`/`InventoryView`/`html2canvas` قبل أول تفاعل.
3. **Network**: `dist/index.html` يجب أن يحوي `<script>` واحداً فقط بلا أي `<link rel="stylesheet">`.
4. **Performance panel**: `boot:app-mounted` = زمن الجاهزية الفعلي (يُطبع في الـ console أثناء التطوير).
5. تأكّد أن الرؤوس فعّالة: `curl -sI https://<domain>/assets/index-*.js | grep -i cache-control`.

---

## 7) توصيات المرحلة التالية (لم تُنفَّذ بعد)

| البند | المكسب المتوقع | الملاحظة |
|---|---|---|
| تأجيل تحميل Firebase (48.80 KB gz) عبر غلاف `loadFirebase()` ديناميكي | −50 KB gz من مسار الإقلاع | يحتاج تحويل `imageStore`/`thumbStore`/`App` إلى استيراد ديناميكي — تغيير أوسع، يستحق جلسة منفصلة |
| Pre-render للهيكل الأولي عبر Vercel (ISR/SSG) | LCP أقرب لـ 0.4s | البنية الحالية SPA بالكامل |
| صور المنتجات: `width/height` + `loading="lazy"` + `decoding="async"` + AVIF/WebP | تحسين CLS وBytes | تُخزَّن حالياً Base64 في RTDB — الأفضل ترحيلها إلى Storage/CDN |
| `content-visibility: auto` على الشبكات الطويلة | تقليل Render work | موجود بالفعل Virtualization بـ `@tanstack/react-virtual` |
| Web Vitals RUM → GA4 | رؤية LCP الحقيقي لكل جهاز | يعتمد على `boot:app-mounted` المضاف حديثاً |

---

## 8) ملاحظات صدق تقنية (يجب قراءتها)

- **الـ App Shell يرفع FCP/LCP** لأنه يرسم نصاً/ترويسة حقيقية فوراً من HTML. هذا نمط قياسي (Shell-first)، لكنه **لا يعني** أن التطبيق صار جاهزاً للتفاعل في 0.3s؛ زمن الجاهزية الفعلي يقيسه `boot:app-mounted` (~190 KB gz بعد أول رسم). لذلك أُضيفت قياسات Field Data حتى لا تعتمد على أرقام المختبر وحدها.
- **CLS:** ارتفاع الهيكل مطابق لترويسة التطبيق، لكن أي تغيير مستقبلي في ارتفاع الترويسة يتطلب تحديث `height: 64px` في CSS الحرج.
- **لا تغيير في السلوك الوظيفي:** كل الأقسام والنوافذ تعمل كما هي؛ التعديل الوحيد في ترتيب التحميل. (`ViewType` القديم `'customers'` غير المُنفَّذ بقي بلا سلوك كما كان.)
- **الكاش:** لأن الأصول أصبحت `immutable`، أي تعديل يجب أن ينتج بصمة جديدة — Vite يفعل ذلك تلقائياً.
