#!/usr/bin/env node
/**
 * self-host-fonts.mjs — استضافة الخطوط محلياً (اختياري، لكنه يزيل 3 اتصالات خارجية + طلب CSS حاجب)
 *
 * التشغيل (يحتاج اتصال إنترنت):
 *   node scripts/self-host-fonts.mjs
 *
 * المخرجات:
 *   public/fonts/*.woff2      → ملفات الخطوط
 *   public/fonts.css          → تعريفات @font-face مع font-display: swap
 *
 * الخطوة الأخيرة (يدوية) في index.html:
 *   1) احذف وسم  fonts.googleapis.com (...)  وروابط preconnect الخاصة به.
 *   2) أضف قبل </head>:
 *        <link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/tajawal-arabic-700.woff2">
 *        <link rel="stylesheet" href="/fonts.css">
 *   المتوقع: توفير ~1 RTT للاتصال بـ fonts.googleapis.com + إمكانية تخزين immutable للملفات.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap';
// وكيل متصفح حديث لتحصل على woff2 فقط
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const root = path.resolve(import.meta.dirname, '..');
const fontsDir = path.join(root, 'public', 'fonts');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function main() {
  await mkdir(fontsDir, { recursive: true });

  const res = await fetch(CSS_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Google Fonts CSS failed: ${res.status}`);
  const css = await res.text();

  const blocks = css.split('@font-face').slice(1);
  const outCss = [];
  let saved = 0;

  for (const block of blocks) {
    const family = /font-family:\s*'([^']+)'/.exec(block)?.[1];
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1] ?? '400';
    const unicodeRange = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
    const url = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
    if (!family || !url) continue;

    // اسم مميز: العائلة + النطاق (عربي/لاتيني) + الوزن
    const subset = /U\+0600/i.test(unicodeRange ?? '')
      ? 'arabic'
      : /U\+0100/i.test(unicodeRange ?? '')
        ? 'latin-ext'
        : 'latin';
    const file = `${slug(family)}-${subset}-${weight}.woff2`;

    const fontRes = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!fontRes.ok) continue;
    const buf = Buffer.from(await fontRes.arrayBuffer());
    await writeFile(path.join(fontsDir, file), buf);
    saved += buf.length;

    outCss.push(
      `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
        `src:url(/fonts/${file}) format('woff2');` +
        (unicodeRange ? `unicode-range:${unicodeRange};` : '') +
        '}'
    );
    console.log(`✔ ${file} (${(buf.length / 1024).toFixed(1)} KB)`);
  }

  await writeFile(path.join(root, 'public', 'fonts.css'), outCss.join('\n') + '\n', 'utf8');
  console.log(
    `\nتم إنشاء public/fonts.css و ${blocks.length} تعريف خط (${(saved / 1024).toFixed(0)} KB).`
  );
  console.log('اتبع الخطوات المكتوبة في تعليق هذا الملف لتشغيلها في index.html.');
}

main().catch((err) => {
  console.error('فشل تنزيل الخطوط:', err.message);
  process.exit(1);
});
