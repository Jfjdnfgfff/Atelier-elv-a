import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  Database,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Link2
} from 'lucide-react';
import { FIREBASE_COLLECTIONS } from '../firebaseProject';
import { baseUrl, restFetch, explainHttpFailure } from '../utils/firebaseDiagnostics';
import {
  LOGICAL_COLLECTIONS,
  getCloudLayout,
  setPathOverride,
  clearPathOverrides,
  readPathOverrides
} from '../utils/cloudLayout';

// ---------------------------------------------------------------------------
// مستعرض بيانات Firebase الخام
// ---------------------------------------------------------------------------
// يعرض ما هو موجود فعلاً في القاعدة (كل عقدة وعدد سجلاتها) ويتيح ربط أي عقدة
// بأي مجموعة في التطبيق (مثال: boutique_clothes ← المخزون). الربط يُحفظ
// ويُطبّق فوراً على القراءة والكتابة.
// ---------------------------------------------------------------------------

const LOGICAL_LABELS: Record<string, string> = {
  clothes: 'المخزون / الفساتين',
  rentals: 'الكراء',
  sales: 'المبيعات',
  expenses: 'المصاريف',
  credits: 'الديون',
  creditPayments: 'تسديدات الديون',
  staffPayouts: 'أجور الموظفين',
  staffMembers: 'الموظفون',
  staffAbsences: 'غيابات الموظفين',
  maintenanceOrders: 'الخياطة والصيانة',
  suppliers: 'الموردون',
  seamstresses: 'الخياطات',
  rawMaterials: 'المواد الأولية',
  caisseClosures: 'إغلاقات الصندوق',
  activityLogs: 'سجل العمليات',
  clothThumbs: 'صور مصغّرة',
  clothImages: 'صور المنتجات',
  appSettings: 'إعدادات (الصندوق)'
};

interface NodeState {
  loading?: boolean;
  keys?: string[];
  error?: string;
  preview?: string;
}

export const FirebaseDataExplorer: React.FC = () => {
  const [rootKeys, setRootKeys] = useState<string[] | null>(null);
  const [rootError, setRootError] = useState<{ detail: string; hint?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<Record<string, NodeState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>(() => readPathOverrides());
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const layout = getCloudLayout();
    return layout ? { ...layout.resolved } : {};
  });
  const [ms, setMs] = useState<number | null>(null);

  const loadNode = useCallback(async (path: string, withPreview: boolean) => {
    setNodes(prev => ({ ...prev, [path]: { ...prev[path], loading: true, error: undefined } }));
    try {
      const res = await restFetch(`${baseUrl()}/${path}/.json?shallow=true`);
      const text = await res.text();
      if (!res.ok) {
        const info = explainHttpFailure(res.status, text);
        setNodes(prev => ({ ...prev, [path]: { loading: false, error: info.detail } }));
        return;
      }
      const val = text && text !== 'null' ? JSON.parse(text) : null;
      const keys = val && typeof val === 'object' ? Object.keys(val).sort() : [];

      let preview: string | undefined;
      if (withPreview && keys.length > 0) {
        const firstKey = keys[0];
        const res2 = await restFetch(`${baseUrl()}/${path}/${encodeURIComponent(firstKey)}.json`);
        if (res2.ok) {
          const raw = await res2.text();
          preview = raw.length > 1200 ? `${raw.slice(0, 1200)}…` : raw;
        }
      }
      setNodes(prev => ({ ...prev, [path]: { loading: false, keys, preview } }));
    } catch (err: any) {
      setNodes(prev => ({ ...prev, [path]: { loading: false, error: err?.message || 'خطأ شبكة' } }));
    }
  }, []);

  const loadRoot = useCallback(async () => {
    setLoading(true);
    setRootError(null);
    const started = Date.now();
    try {
      const res = await restFetch(`${baseUrl()}/.json?shallow=true`);
      const text = await res.text();
      if (!res.ok) {
        const info = explainHttpFailure(res.status, text);
        setRootError(info);
        setRootKeys(null);
        return;
      }
      const val = text && text !== 'null' ? JSON.parse(text) : null;
      const keys = val && typeof val === 'object' ? Object.keys(val).sort() : [];
      setRootKeys(keys);
      setMs(Date.now() - started);
    } catch (err: any) {
      setRootError({ detail: err?.message || 'تعذر الاتصال بخوادم Firebase' });
      setRootKeys(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot]);

  const toggle = useCallback(
    (path: string) => {
      const nextOpen = !expanded[path];
      setExpanded(prev => ({ ...prev, [path]: nextOpen }));
      if (nextOpen && !nodes[path]?.keys) void loadNode(path, true);
    },
    [expanded, nodes, loadNode]
  );

  const bind = useCallback((logical: string, path: string) => {
    setPathOverride(logical, path);
    setOverrides(readPathOverrides());
    const layout = getCloudLayout();
    if (layout) setMapping({ ...layout.resolved });
  }, []);

  const resetAll = useCallback(() => {
    clearPathOverrides();
    setOverrides({});
  }, []);

  const totalOverrides = Object.keys(overrides).length;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" />
          <h4 className="font-black text-xs text-slate-900">مستعرض بيانات Firebase (الخام)</h4>
        </div>
        <button
          type="button"
          onClick={() => void loadRoot()}
          disabled={loading}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'جاري القراءة...' : 'قراءة القاعدة'}</span>
        </button>
      </div>

      <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-2">
        هذه هي العقد الموجودة فعلاً في قاعدتك. افتح أي عقدة لرؤية عدد سجلاتها وأول سجل، ثم اربطها بالقسم
        المناسب في التطبيق (مثال: <span className="font-mono">boutique_clothes</span> ← المخزون).
      </p>

      {rootError && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-900">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <div>
              <p>{rootError.detail}</p>
              {rootError.hint && <p className="font-medium mt-1">{rootError.hint}</p>}
            </div>
          </div>
        </div>
      )}

      {loading && !rootKeys && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-[11px] font-bold text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" /> جاري قراءة جذر القاعدة…
        </div>
      )}

      {rootKeys && rootKeys.length === 0 && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900">
          القاعدة متصلة لكنها فارغة تمامًا (لا توجد أي عقدة في الجذر). تأكد أنك في المشروع الصحيح
          <span className="font-mono"> ateliu-14e23</span>.
        </div>
      )}

      {rootKeys && rootKeys.length > 0 && (
        <div className="space-y-1.5">
          {rootKeys.map(key => {
            const state = nodes[key] || {};
            const isOpen = !!expanded[key];
            const count = state.keys?.length;
            return (
              <div key={key} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="w-full px-2.5 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 transition-all"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="font-mono text-[11px] font-bold text-slate-800 truncate" dir="ltr">/{key}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {state.loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                    {typeof count === 'number' && (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                        count > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {count} سجل
                      </span>
                    )}
                  </span>
                </button>

                {state.error && (
                  <p className="px-2.5 pb-2 text-[10px] font-bold text-rose-700">{state.error}</p>
                )}

                {isOpen && typeof count === 'number' && (
                  <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-slate-100 pt-1.5">
                    {count === 0 && (
                      <p className="text-[10px] font-bold text-slate-500">عقدة فارغة (لا تحتوي أي سجل)</p>
                    )}

                    {count > 0 && (
                      <>
                        <div className="flex flex-wrap gap-1">
                          {state.keys!.slice(0, 12).map(child => (
                            <span key={child} className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded" dir="ltr">
                              {child}
                            </span>
                          ))}
                          {count > 12 && (
                            <span className="text-[9px] font-bold text-slate-500">+{count - 12}</span>
                          )}
                        </div>

                        {state.preview && (
                          <details className="bg-slate-900 rounded-lg p-2">
                            <summary className="text-[10px] font-bold text-slate-300 cursor-pointer flex items-center gap-1">
                              <Eye className="w-3 h-3" /> معاينة أول سجل
                            </summary>
                            <pre className="mt-1 text-[9px] text-emerald-300 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto custom-scrollbar" dir="ltr">
                              {state.preview}
                            </pre>
                          </details>
                        )}

                        <div className="flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <select
                            defaultValue=""
                            onChange={e => {
                              const logical = e.target.value;
                              if (logical) bind(logical, key);
                              e.target.value = '';
                            }}
                            className="flex-1 text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700"
                          >
                            <option value="">اربط هذه العقدة بـ… (اختر القسم)</option>
                            {LOGICAL_COLLECTIONS.map(logical => (
                              <option key={logical} value={logical}>
                                {LOGICAL_LABELS[logical] || logical}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* الجذر نفسه كحاضنة: نعرض أبناءه أيضاً كعقد قابلة للربط */}
                        <details className="pt-1">
                          <summary className="text-[10px] font-bold text-slate-500 cursor-pointer">
                            ربط ابن داخل هذه العقدة (مثال: /{key}/sales)
                          </summary>
                          <div className="mt-1 space-y-1">
                            {state.keys!.slice(0, 20).map(child => (
                              <div key={child} className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] text-slate-600 flex-1 truncate" dir="ltr">
                                  /{key}/{child}
                                </span>
                                <select
                                  defaultValue=""
                                  onChange={e => {
                                    const logical = e.target.value;
                                    if (logical) bind(logical, `${key}/${child}`);
                                    e.target.value = '';
                                  }}
                                  className="text-[9px] font-bold bg-slate-50 border border-slate-200 rounded px-1 py-0.5"
                                >
                                  <option value="">ربط…</option>
                                  {LOGICAL_COLLECTIONS.map(logical => (
                                    <option key={logical} value={logical}>
                                      {LOGICAL_LABELS[logical] || logical}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {ms != null && (
        <p className="text-[10px] font-mono text-slate-400" dir="ltr">root read: {ms}ms</p>
      )}

      {/* جدول الربط الحالي */}
      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-black text-slate-800">الربط الحالي (يُستخدم فعليًا)</span>
          {totalOverrides > 0 && (
            <button
              type="button"
              onClick={resetAll}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> مسح التجاوزات ({totalOverrides})
            </button>
          )}
        </div>
        <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-0.5">
          {Object.entries(mapping).map(([logical, path]) => (
            <div key={logical} className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-slate-600">
                {LOGICAL_LABELS[logical] || logical}
                {overrides[logical] && <CheckCircle2 className="w-3 h-3 text-emerald-600 inline-block mr-1" />}
              </span>
              <span className="font-mono text-[9px] text-slate-500 truncate max-w-[55%]" dir="ltr">/{path}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed">
        بعد الربط: أغلق هذه النافذة ثم أعد تحميل الصفحة (أو استخدم زر «جلب كامل البيانات») ليُطبّق المسار الجديد.
      </p>
    </div>
  );
};
