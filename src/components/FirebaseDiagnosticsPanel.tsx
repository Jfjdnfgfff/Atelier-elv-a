import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  WifiOff,
  XCircle,
  Copy,
  Check
} from 'lucide-react';
import { firebaseConfig } from '../firebase';
import { onFirebaseErrors, getRecentFirebaseErrors, clearRecentFirebaseErrors, FirebaseErrorEntry } from '../firebase';
import {
  runFirebaseDiagnostics,
  testWritePermission,
  DiagnosticCheck,
  DiagnosticReport
} from '../utils/firebaseDiagnostics';

const statusStyles: Record<DiagnosticCheck['status'], string> = {
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warn: 'bg-amber-50 border-amber-200 text-amber-900',
  error: 'bg-rose-50 border-rose-200 text-rose-900'
};

const StatusIcon: React.FC<{ status: DiagnosticCheck['status'] }> = ({ status }) => {
  if (status === 'ok') return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
  return <XCircle className="w-4 h-4 text-rose-600 shrink-0" />;
};

export const FirebaseDiagnosticsPanel: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [writeCheck, setWriteCheck] = useState<DiagnosticCheck | null>(null);
  const [writeLoading, setWriteLoading] = useState(false);
  const [errors, setErrors] = useState<FirebaseErrorEntry[]>(() => getRecentFirebaseErrors());
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setWriteCheck(null);
    try {
      const res = await runFirebaseDiagnostics();
      setReport(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
    return onFirebaseErrors(setErrors);
  }, [run]);

  const runWriteTest = useCallback(async () => {
    setWriteLoading(true);
    try {
      setWriteCheck(await testWritePermission());
    } finally {
      setWriteLoading(false);
    }
  }, []);

  const copyReport = useCallback(async () => {
    const lines: string[] = [];
    lines.push(`Firebase diagnostics — ${new Date().toLocaleString('ar-DZ')}`);
    lines.push(`project: ${firebaseConfig.projectId}`);
    lines.push(`databaseURL: ${firebaseConfig.databaseURL}`);
    lines.push('');
    (report?.checks || []).forEach(c => {
      lines.push(`[${c.status.toUpperCase()}] ${c.label} — ${c.detail}${c.ms != null ? ` (${c.ms}ms)` : ''}`);
      if (c.hint) lines.push(`   ↳ ${c.hint}`);
    });
    if (writeCheck) lines.push(`[${writeCheck.status.toUpperCase()}] ${writeCheck.label} — ${writeCheck.detail}`);
    if (errors.length) {
      lines.push('');
      lines.push('SDK errors:');
      errors.forEach(e => lines.push(`- ${e.scope}: ${e.message}${e.code ? ` (${e.code})` : ''}`));
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* الحافظة غير متاحة */
    }
  }, [report, writeCheck, errors]);

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-500" />
          <h4 className="font-black text-xs text-slate-900">تشخيص قراءة بيانات Firebase</h4>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={copyReport}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'تم النسخ' : 'نسخ التقرير'}</span>
          </button>
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'جاري الفحص...' : 'إعادة الفحص'}</span>
          </button>
        </div>
      </div>

      {report && (
        <div className={`p-3 rounded-xl border text-xs font-bold leading-relaxed ${
          report.errorCount > 0
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : report.checks.some(c => c.status === 'warn')
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          {report.errorCount > 0 ? <WifiOff className="w-4 h-4 inline-block ml-1 align-text-bottom" /> : null}
          {report.verdict}
        </div>
      )}

      {loading && !report && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          جاري فحص الاتصال بخوادم Firebase...
        </div>
      )}

      {report && (
        <div className="space-y-1.5">
          {report.checks.map((check, idx) => (
            <div key={`${check.id}-${idx}`} className={`p-2.5 rounded-xl border ${statusStyles[check.status]}`}>
              <div className="flex items-start gap-2">
                <StatusIcon status={check.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black">{check.label}</span>
                    {check.ms != null && (
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">{check.ms}ms</span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-700 mt-0.5 break-words">{check.detail}</p>
                  {check.rootKeys && check.rootKeys.length > 0 && (
                    <div className="mt-1 bg-white/70 rounded-lg p-1.5 border border-white/80 max-h-28 overflow-y-auto custom-scrollbar">
                      {check.rootKeys.map((entry, i) => (
                        <p key={i} className="text-[10px] font-mono text-slate-600 leading-relaxed break-all" dir="ltr">
                          {entry}
                        </p>
                      ))}
                    </div>
                  )}
                  {check.hint && (
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed bg-white/60 rounded-lg p-1.5 border border-white/80">
                      💡 {check.hint}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!compact && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-slate-800">اختبار الكتابة (حفظ تجريبي ثم حذفه)</span>
            <button
              type="button"
              onClick={runWriteTest}
              disabled={writeLoading}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-[11px] font-bold transition-all active:scale-95"
            >
              {writeLoading ? 'جاري الاختبار...' : 'اختبار الكتابة'}
            </button>
          </div>
          {writeCheck && (
            <div className={`p-2.5 rounded-lg border text-[11px] font-bold ${statusStyles[writeCheck.status]}`}>
              <div className="flex items-start gap-2">
                <StatusIcon status={writeCheck.status} />
                <div>
                  <p>{writeCheck.detail}</p>
                  {writeCheck.hint && <p className="font-medium text-slate-700 mt-1">{writeCheck.hint}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div className="p-3 bg-slate-900 rounded-xl">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-black text-slate-100">أخطاء Firebase المسجّلة ({errors.length})</span>
            <button
              type="button"
              onClick={() => clearRecentFirebaseErrors()}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-200"
            >
              مسح
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1" dir="ltr">
            {errors.slice(0, 10).map((e, i) => (
              <p key={i} className="text-[10px] font-mono text-rose-300 break-words">
                {e.scope}: {e.message}
                {e.code ? ` (${e.code})` : ''}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
