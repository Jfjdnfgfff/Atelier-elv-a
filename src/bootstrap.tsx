/**
 * bootstrap.tsx — تحميل فعلي للتطبيق (React + App + Tailwind CSS)
 *
 * يُستورد ديناميكياً من main.tsx بعد أول رسم للصفحة، أي أنّ React و App و CSS
 * كلها خارج المسار الحرج لأول رسم. Vite يقوم تلقائياً بتحميل CSS الحزمة
 * (index.css) بالتوازي ويحجب تنفيذ الوحدة حتى يجهز الملف، فلا يظهر وميض بلا تنسيق.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// تحميل حزمة القسم الافتراضي (الرئيسية/لوحة القيادة) بالتوازي مع إقلاع التطبيق
// حتى لا يظهر هيكل الانتظار عند أول شاشة
void import('./components/DashboardView');

declare global {
  interface Window {
    __removeBootShell?: () => void;
  }
}

const Root: React.FC = () => {
  // يُستدعى بعد أول commit ناجح لـ React → نزيل هيكل التحميل دون وميض أبيض
  React.useEffect(() => {
    window.__removeBootShell?.();
    // قياس زمن الجاهزية الفعلي: boot:start (index.html) → boot:app-mounted (أول commit)
    try {
      performance.mark('boot:app-mounted');
      const measure = performance.measure('boot:app-mounted', 'boot:start', 'boot:app-mounted');
      // في التطوير فقط: طباعة زمن الجاهزية الحقيقي (يمكن رصده في الإنتاج عبر performance.getEntriesByType('measure'))
      if (location.port === '3000') {
        console.info(`[perf] app mounted (TTI proxy): ${Math.round(measure.duration)} ms`);
      }
    } catch {
      /* لا شيء */
    }
  }, []);

  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

const container = document.getElementById('root');
if (container) {
  ReactDOM.createRoot(container).render(<Root />);
}
