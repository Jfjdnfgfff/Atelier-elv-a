import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * استراتيجية البناء لأداء أفضل على Vercel (Core Web Vitals):
 * 1. حزمة إقلاع (entry) شبه فارغة: main.tsx بدون أي import ثابت → لا JavaScript في مسار أول رسم.
 * 2. تقسيم الأقسام والنوافذ على مستوى الوحدة (Code Splitting) → إزالة «JavaScript غير المستخدم».
 * 3. منع التحميل المسبق (modulepreload) لأي حزمة غير لازمة للشاشة الأولى.
 * 4. فصل مكتبات الطرف الثالث (React / Firebase / Scanner / UI) لتخزين مؤقت طويل المدى وImmutable.
 */
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  // الحزم التي يُسمح للـ HTML بتحميلها مسبقاً (المسار الحرج فقط)
  const CRITICAL_PRELOAD = [/assets\/index-/, /assets\/react-vendor-/, /assets\/bootstrap-/];

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2020', // لا شيفرة توافقية (legacy) غير مستخدمة في المتصفحات الحديثة
      cssCodeSplit: true, // CSS الأقسام تُحمَّل مع حزمتها لا مع الشاشة الأولى
      cssTarget: 'chrome100',
      sourcemap: false,
      minify: 'esbuild',
      reportCompressedSize: true,
      modulePreload: {
        polyfill: true,
        // لا تُحمّل مسبقاً إلا حزم المسار الحرج: Firebase/Scanner/الجداول الافتراضية تُحمَّل عند الحاجة
        resolveDependencies: (_filename, deps) =>
          deps.filter((dep) => CRITICAL_PRELOAD.some((re) => re.test(dep))),
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) {
              return 'firebase-vendor';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/@zxing')) {
              return 'scanner-vendor';
            }
            if (id.includes('node_modules/@tanstack')) {
              return 'virtual-vendor';
            }
            if (id.includes('node_modules/motion') || id.includes('node_modules/lucide-react')) {
              return 'ui-vendor';
            }
            if (id.includes('node_modules/html2canvas')) {
              return 'html2canvas-vendor';
            }
          },
        },
      },
    },
    esbuild: {
      drop: isProd ? ['debugger'] : [],
      legalComments: 'none',
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
