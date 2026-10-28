#!/usr/bin/env node
/**
 * check-firebase.mjs — تشخيص سريع لاتصال قاعدة Firebase Realtime Database
 *
 * التشغيل:
 *   npm run check:firebase
 *   DATABASE_URL="https://my-project-default-rtdb.firebaseio.com" node scripts/check-firebase.mjs
 *
 * يفحص ثلاث طبقات منفصلة حتى تعرف أين المشكلة بالضبط:
 *   1) هل النطاق يستجيب أصلاً (DNS/شبكة)؟
 *   2) هل قاعدة البيانات موجودة في هذا العنوان؟
 *   3) هل قواعد الأمان تسمح بالقراءة؟  ← هذا هو السبب الأكثر شيوعاً لـ «Firebase لا يقرأ»
 *
 * الرموز: 0 = كل شيء سليم، 1 = فشل يحتاج تدخلاً
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const ok = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const bad = (m) => console.log(`${C.red}✗${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}!${C.reset} ${m}`);
const info = (m) => console.log(`${C.dim}  ${m}${C.reset}`);
const head = (m) => console.log(`\n${C.bold}${C.cyan}${m}${C.reset}`);

/** يقرأ databaseURL/projectId من src/firebase.ts دون تنفيذ الشيفرة */
async function readProjectConfig() {
  try {
    const source = await readFile(path.join(root, 'src', 'firebase.ts'), 'utf8');
    const grab = (key) => {
      const re = new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`);
      return re.exec(source)?.[1] ?? null;
    };
    return {
      databaseURL: grab('databaseURL'),
      projectId: grab('projectId')
    };
  } catch {
    return { databaseURL: null, projectId: null };
  }
}

async function timedFetch(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    return { response, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`\n${C.bold}تشخيص اتصال Firebase Realtime Database${C.reset}`);

  const fileConfig = await readProjectConfig();
  const databaseURL = (
    process.env.DATABASE_URL ||
    process.env.VITE_FIREBASE_DATABASE_URL ||
    fileConfig.databaseURL ||
    ''
  ).replace(/\/$/, '');
  const projectId = process.env.FIREBASE_PROJECT_ID || fileConfig.projectId || '(غير معروف)';

  if (!databaseURL) {
    bad('لم أجد databaseURL في src/firebase.ts ولا في متغيّرات البيئة.');
    info('مرّر العنوان صراحة: DATABASE_URL="https://....firebaseio.com" npm run check:firebase');
    process.exit(1);
  }

  head('1) الإعدادات');
  info(`المشروع     : ${projectId}`);
  info(`قاعدة البيانات: ${databaseURL}`);

  // ── الطبقة 1: هل النطاق يستجيب؟
  head('2) الوصول للشبكة');
  let probe;
  try {
    probe = await timedFetch(`${databaseURL}/.json?shallow=true`);
  } catch (error) {
    bad(`تعذّر الوصول للنطاق — ${error?.name === 'AbortError' ? 'انتهت المهلة' : error?.message}`);
    info('أسباب محتملة: لا يوجد اتصال بالإنترنت، أو الشبكة/الجدار الناري يحجب *.firebaseio.com');
    info('جرّب فتح العنوان في المتصفح مباشرة. إن فشل أيضاً فالمشكلة في الشبكة لا في التطبيق.');
    process.exit(1);
  }
  ok(`النطاق يستجيب (${probe.latencyMs}ms) — رمز HTTP ${probe.response.status}`);

  // ── الطبقة 2: هل القاعدة موجودة؟ (404 = لم تُنشأ في هذا العنوان)
  if (probe.response.status === 404) {
    bad('القاعدة غير موجودة في هذا العنوان (HTTP 404).');
    info('افتح Firebase Console ← Realtime Database وتأكد أن القاعدة أُنشئت فعلاً.');
    info('إن أُنشئت في منطقة أخرى فسيكون العنوان مختلفاً مثل:');
    info('  https://<project>-default-rtdb.europe-west1.firebasedatabase.app');
    process.exit(1);
  }

  // ── الطبقة 3: هل القواعد تسمح بالقراءة؟
  head('3) قواعد الأمان (القراءة)');
  const body = await probe.response.text().catch(() => '');
  const permissionDenied =
    probe.response.status === 401 ||
    probe.response.status === 403 ||
    /permission denied/i.test(body);

  if (permissionDenied) {
    bad('الوصول مرفوض: Permission denied');
    info('القاعدة موجودة والشبكة سليمة، لكن قواعدها الحالية تمنع القراءة والكتابة.');
    info('هذا سبب «البيانات لا تصل إلى Firebase» و«Firebase لا يقرأ» عندك.');
    console.log(`\n${C.bold}الحل — اختر واحداً:${C.reset}`);
    console.log(`  ${C.cyan}أ) سطر أوامر${C.reset}  (ينشر database.rules.json مباشرة)`);
    console.log(`     npx firebase-tools login`);
    console.log(`     npm run deploy:rules`);
    console.log(`  ${C.cyan}ب) من لوحة التحكم${C.reset}`);
    console.log(`     Firebase Console ← Realtime Database ← Rules ← الصق محتوى database.rules.json ← Publish`);
    console.log(`\n${C.dim}تنبيه أمني: القواعد الحالية تجعل القاعدة عامة (بدون مصادقة).`);
    console.log(`مناسب لتطبيق داخلي، لكن أي شخص يعرف العنوان يستطيع القراءة والكتابة.${C.reset}\n`);
    process.exit(1);
  }

  if (!probe.response.ok) {
    bad(`ردّ غير متوقع: HTTP ${probe.response.status} — ${body.slice(0, 200)}`);
    process.exit(1);
  }

  ok('القراءة مسموحة — قواعد الأمان سليمة.');

  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    /* ليست JSON — نتجاهل */
  }
  const rootKeys = parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
  if (rootKeys.length === 0) {
    warn('القاعدة فارغة (لا توجد مسارات بعد). هذا طبيعي إن لم تُزامن أي بيانات.');
  } else {
    ok(`المسارات الجذرية الموجودة (${rootKeys.length}): ${rootKeys.slice(0, 12).join(', ')}`);
  }

  console.log(`\n${C.green}${C.bold}النتيجة: الاتصال بقاعدة Firebase يعمل بشكل سليم.${C.reset}\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
