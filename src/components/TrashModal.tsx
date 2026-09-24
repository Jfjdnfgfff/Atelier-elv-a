import React, { useEffect, useState } from 'react';
import { Modal } from './Shared';
import { fetchTrashItems, restoreItemFromTrash, purgeOldTrashItems } from '../firebase';
import { Trash2, RotateCcw, Clock, RefreshCw, AlertTriangle } from 'lucide-react';

interface TrashModalProps {
  onClose: () => void;
  onRestored: () => void;
}

export const TrashModal: React.FC<TrashModalProps> = ({ onClose, onRestored }) => {
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const loadTrash = async () => {
    setLoading(true);
    const items = await fetchTrashItems();
    setTrashItems(items);
    setLoading(false);
  };

  const handlePurgeOld = async () => {
    setIsPurging(true);
    const count = await purgeOldTrashItems(30);
    setIsPurging(false);
    setShowPurgeConfirm(false);
    await loadTrash();
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (item: any) => {
    setRestoringId(item.id);
    const success = await restoreItemFromTrash(item.collection, item.id);
    if (success) {
      setTrashItems(prev => prev.filter(i => i.id !== item.id));
      onRestored();
    }
    setRestoringId(null);
  };

  const getCollectionNameAr = (col: string) => {
    const names: Record<string, string> = {
      clothes: 'منتج/فستان',
      sales: 'عملية بيع',
      rentals: 'عقد كراء',
      expenses: 'مصروف',
      credits: 'دين/مستحق',
      maintenanceOrders: 'طلب خياطة',
      suppliers: 'مورد',
      seamstresses: 'خياطة',
      rawMaterials: 'قماش/مادة خام',
      activityLogs: 'سجل نشاط'
    };
    return names[col] || col;
  };

  return (
    <Modal title="سلة المهملات والمحذوفات (30 يوم للحرية والأمان)" onClose={onClose} wide>
      <div className="space-y-4 font-['Tajawal']" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-amber-600 shrink-0" />
            <span>جميع العناصر المحذوفة تحفظ هنا تلقائياً ويمكنك استرجاعها بضغطة زر.</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setShowPurgeConfirm(true)} 
              className="flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors"
              title="حذف العناصر التي مر عليها أكثر من 30 يوماً بشكل دائم"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>تنظيف القديم (+30 يوم)</span>
            </button>
            <button 
              type="button"
              onClick={loadTrash} 
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
          </div>
        </div>

        {/* Confirmation Modal for Purging Items Older Than 30 Days */}
        {showPurgeConfirm && (
          <div className="bg-red-50/90 border border-red-200 p-4 rounded-2xl space-y-3 animate-in fade-in">
            <div className="flex items-start gap-2.5 text-red-900 text-xs">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-sm">تأكيد تنظيف العناصر القديمة</h4>
                <p className="mt-1 leading-relaxed">
                  هل أنت تأكد من الحذف النهائي لجميع العناصر المحذوفة التي مضى على وجودها في السلة أكثر من 30 يوماً؟ هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handlePurgeOld}
                disabled={isPurging}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {isPurging && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>تأكيد الحذف النهائي</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPurgeConfirm(false)}
                disabled={isPurging}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            جاري تحميل العناصر المحذوفة...
          </div>
        ) : trashItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
            سلة المهملات فارغة حالياً (لا توجد عناصر محذوفة).
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
            {trashItems.map((item) => {
              const name = item.name || item.itemName || item.customerName || item.desc || item.title || item.id;
              const colName = getCollectionNameAr(item.collection);
              const deletedDate = item.deletedAt ? new Date(item.deletedAt).toLocaleDateString('ar-DZ') : 'غير محدد';

              return (
                <div 
                  key={`${item.collection}_${item.id}`}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-colors shadow-xs"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[11px] rounded-md">
                        {colName}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        تاريخ الحذف: {deletedDate}
                      </span>
                      {item.barcode && <span>الباركود: {item.barcode}</span>}
                      {item.amount && <span>المبلغ: {Number(item.amount).toLocaleString('ar-DZ')} دج</span>}
                      {item.totalAmount && <span>المبلغ: {Number(item.totalAmount).toLocaleString('ar-DZ')} دج</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(item)}
                    disabled={restoringId === item.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${restoringId === item.id ? 'animate-spin' : ''}`} />
                    استرجاع
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
