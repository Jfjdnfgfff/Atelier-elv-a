import React, { useState } from 'react';
import { Credit, Supplier } from '../types';
import { CustomerIdScannerModal, ExtractedCustomerData } from './CustomerIdScannerModal';
import {
  Users,
  Building2,
  Scale,
  CreditCard,
  Phone,
  Calendar,
  Check,
  Trash2,
  Plus
} from 'lucide-react';

interface CreditsViewProps {
  credits: Credit[];
  suppliers?: Supplier[];
  onAddCredit: (data: any) => void;
  onSettleCredit: (id: string) => void;
  onDeleteCredit: (id: string) => void;
}

export const CreditsView: React.FC<CreditsViewProps> = ({
  credits,
  suppliers = [],
  onAddCredit,
  onSettleCredit,
  onDeleteCredit
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'customers' | 'suppliers'>('all');
  const [debtCategory, setDebtCategory] = useState<'customer' | 'supplier'>('customer');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState('دين كراء فستان');
  const [showScanner, setShowScanner] = useState(false);

  const customerCreditTypes = [
    'دين كراء فستان',
    'دين شراء ملابس',
    'متبقي حجز فستان',
    'دين تعديل وخياطة',
    'دين زبون آخر'
  ];

  const supplierCreditTypes = [
    'دين للمورد (كريدي سلعة)',
    'متبقي فاتورة مورد',
    'دين قماش ومستلزمات',
    'دين مورد آخر'
  ];

  const handleCustomerExtracted = (data: ExtractedCustomerData) => {
    if (data.name) setName(data.name);
    if (data.phone) setPhone(data.phone);
    if (data.idNumber && !desc) setDesc(`بطاقة تعريف: ${data.idNumber}`);
  };

  const handleSupplierSelect = (supName: string) => {
    setName(supName);
    const sup = suppliers.find(s => s.name === supName);
    if (sup && sup.phone) setPhone(sup.phone);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;

    const isSup = debtCategory === 'supplier';

    onAddCredit({
      name: name.trim(),
      phone: phone.trim(),
      desc: desc.trim(),
      amount: Number(amount),
      type: isSup ? (type.includes('مورد') ? type : 'دين للمورد (كريدي سلعة)') : type,
      supplierDebt: isSup,
      supplierName: isSup ? name.trim() : undefined,
      goodsDescription: isSup ? desc.trim() : undefined,
      date: new Date().toISOString()
    });

    setName('');
    setPhone('');
    setDesc('');
    setAmount('');
  };

  // Calculations
  const customerDebts = credits.filter(c => !c.supplierDebt);
  const supplierDebts = credits.filter(c => !!c.supplierDebt);

  const totalCustomerDebt = customerDebts.reduce((s, c) => s + Number(c.amount), 0);
  const totalSupplierDebt = supplierDebts.reduce((s, c) => s + Number(c.amount), 0);
  const netDebtBalance = totalCustomerDebt - totalSupplierDebt;

  const filteredCredits = credits.filter(c => {
    if (filterTab === 'customers') return !c.supplierDebt;
    if (filterTab === 'suppliers') return !!c.supplierDebt;
    return true;
  });

  return (
    <div className="space-y-6 p-3 sm:p-6" dir="rtl">
      {/* Top Banner & Stats */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-blue-600">سجل الديون والكريدي الشامل</h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              متابعة ديون الزبائن (أموال لنا في الخارج) وديون الموردين (التزامات شراء السلعة).
            </p>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-500" />
                <span>ديون على الزبائن (لنا):</span>
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {customerDebts.length} زبائن
              </span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
              {totalCustomerDebt.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">مبالغ كراء وبيع بانتظار التحصيل</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>ديون للموردين (علينا):</span>
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {supplierDebts.length} موردين
              </span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
              {totalSupplierDebt.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">متبقي كريدي شراء سلع وفواتير</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-slate-500" />
                <span>صافي الميزان الائتماني:</span>
              </span>
              <span className="text-[10px] font-medium text-slate-500">(لنا - علينا)</span>
            </div>
            <span className={`text-lg sm:text-xl font-bold font-mono ${
              netDebtBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {netDebtBalance >= 0 ? `+${netDebtBalance.toLocaleString()}` : netDebtBalance.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {netDebtBalance >= 0 ? 'رصيد إيجابي لصالح البوتيك' : 'التزامات الموردين تتجاوز ديون الزبائن'}
            </span>
          </div>
        </div>
      </div>

      {/* Add Debt Form */}
      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-sm">تسجيل دين / كريدي جديد</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setDebtCategory('customer'); setType('دين كراء فستان'); }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  debtCategory === 'customer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>على زبون (لنا)</span>
              </button>
              <button
                type="button"
                onClick={() => { setDebtCategory('supplier'); setType('دين للمورد (كريدي سلعة)'); }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  debtCategory === 'supplier' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>للمورد (علينا)</span>
              </button>
            </div>
          </div>

          {debtCategory === 'customer' && (
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 active:scale-95 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>مسح بطاقة الهوية / الباركود</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              {debtCategory === 'supplier' ? 'اسم المورد *' : 'اسم الزبون *'}
            </label>
            {debtCategory === 'supplier' && suppliers.length > 0 ? (
              <div className="space-y-1">
                <select
                  onChange={(e) => handleSupplierSelect(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold bg-white focus:outline-none"
                >
                  <option value="">-- اختر مورد أو اكتب أدناه --</option>
                  {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم المورد..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-slate-800"
                />
              </div>
            ) : (
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="الاسم واللقب..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-slate-800"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">رقم الهاتف</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05 / 06 / 07..."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">مبلغ الدين (دج) *</label>
            <input
              type="number"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-900 focus:outline-none focus:border-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">نوع الدين</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none"
            >
              {(debtCategory === 'supplier' ? supplierCreditTypes : customerCreditTypes).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            {debtCategory === 'supplier' ? 'تفاصيل السلعة المشتراة أو الفاتورة' : 'البيان / ملاحظات'}
          </label>
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={debtCategory === 'supplier' ? "مثال: متبقي شراء 3 فساتين سهرة تركية..." : "مثال: متبقي كراء فستان أسود..."}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] bg-slate-900 hover:bg-slate-800 flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>{debtCategory === 'supplier' ? 'تسجيل دين للمورد' : 'تسجيل دين على الزبون'}</span>
        </button>
      </form>

      {/* Scanner Modal */}
      {showScanner && (
        <CustomerIdScannerModal
          title="مسح بطاقة هوية أو باركود الزبون (كريدي)"
          onExtract={handleCustomerExtracted}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Credit List with Filters */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="font-bold text-slate-900 text-base">قائمة الديون المسجلة</h3>
          
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              الكل ({credits.length})
            </button>
            <button
              onClick={() => setFilterTab('customers')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                filterTab === 'customers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>ديون الزبائن ({customerDebts.length})</span>
            </button>
            <button
              onClick={() => setFilterTab('suppliers')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                filterTab === 'suppliers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>ديون الموردين ({supplierDebts.length})</span>
            </button>
          </div>
        </div>

        {filteredCredits.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">لا توجد أي ديون مسجلة في هذا القسم.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCredits.map(credit => {
              const isSupplierDebt = credit.supplierDebt;

              return (
                <div key={credit.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{credit.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                        {isSupplierDebt ? 'دين مورد (علينا)' : 'دين زبون (لنا)'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-2">
                      {credit.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{credit.phone}</span>
                        </span>
                      )}
                      <span>• {credit.type}</span>
                      {credit.desc && <span className="text-slate-700">({credit.desc})</span>}
                      <span className="flex items-center gap-1">
                        • <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{new Date(credit.date).toLocaleDateString('ar-DZ')}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="font-bold text-sm font-mono text-slate-900">
                      {credit.amount.toLocaleString()} دج
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onSettleCredit(credit.id)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1 active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تم التسديد</span>
                      </button>

                      <button
                        onClick={() => onDeleteCredit(credit.id)}
                        className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors active:scale-95"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
