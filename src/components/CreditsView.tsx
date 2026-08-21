import React, { useState } from 'react';
import { Credit, Supplier } from '../types';
import { CustomerIdScannerModal, ExtractedCustomerData } from './CustomerIdScannerModal';

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
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-900">سجل الديون والكريدي الشامل</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              متابعة ديون الزبائن (أموال لنا في الخارج) وديون الموردين (التزامات شراء السلعة).
            </p>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-amber-800 font-bold">👤 ديون على الزبائن (لنا):</span>
              <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                {customerDebts.length} زبائن
              </span>
            </div>
            <span className="text-lg sm:text-xl font-black text-amber-900 font-mono">
              {totalCustomerDebt.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-amber-700 block mt-0.5">مبالغ كراء وبيع بانتظار التحصيل</span>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-indigo-800 font-bold">🏢 ديون للموردين (علينا):</span>
              <span className="text-[10px] bg-indigo-200/70 text-indigo-900 px-2 py-0.5 rounded-full font-bold">
                {supplierDebts.length} موردين
              </span>
            </div>
            <span className="text-lg sm:text-xl font-black text-indigo-950 font-mono">
              {totalSupplierDebt.toLocaleString()} دج
            </span>
            <span className="text-[10px] text-indigo-600 block mt-0.5">متبقي كريدي شراء سلع وفواتير</span>
          </div>

          <div className={`p-4 rounded-2xl border ${
            netDebtBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
          }`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-700">⚖️ صافي الميزان الائتماني:</span>
              <span className="text-[10px] font-bold text-slate-500">(لنا - علينا)</span>
            </div>
            <span className={`text-lg sm:text-xl font-black font-mono ${
              netDebtBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'
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
      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-800 text-sm">تسجيل دين / كريدي جديد</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setDebtCategory('customer'); setType('دين كراء فستان'); }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  debtCategory === 'customer' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-500'
                }`}
              >
                👤 على زبون (لنا)
              </button>
              <button
                type="button"
                onClick={() => { setDebtCategory('supplier'); setType('دين للمورد (كريدي سلعة)'); }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  debtCategory === 'supplier' ? 'bg-white text-indigo-800 shadow-xs' : 'text-slate-500'
                }`}
              >
                🏢 للمورد (علينا)
              </button>
            </div>
          </div>

          {debtCategory === 'customer' && (
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 active:scale-95 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <span>💳</span>
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
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
            ) : (
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="الاسم واللقب..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
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
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
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
              className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black focus:outline-none ${
                debtCategory === 'supplier' ? 'text-indigo-800 focus:border-indigo-500' : 'text-amber-700 focus:border-amber-500'
              }`}
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
          className={`w-full py-3 text-white rounded-2xl text-xs font-black transition-all shadow-md active:scale-[0.98] ${
            debtCategory === 'supplier' 
              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' 
              : 'bg-amber-600 hover:bg-amber-700 shadow-amber-100'
          }`}
        >
          {debtCategory === 'supplier' ? '+ تسجيل دين للمورد' : '+ تسجيل دين على الزبون'}
        </button>
      </form>

      {/* Scanner Modal */}
      {showScanner && (
        <CustomerIdScannerModal
          title="مسح بطاقة هوية أو باركود الزبون (كريدي) 💳"
          onExtract={handleCustomerExtracted}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Credit List with Filters */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="font-black text-slate-900 text-base">قائمة الديون المسجلة</h3>
          
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              الكل ({credits.length})
            </button>
            <button
              onClick={() => setFilterTab('customers')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'customers' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              👤 ديون الزبائن ({customerDebts.length})
            </button>
            <button
              onClick={() => setFilterTab('suppliers')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              🏢 ديون الموردين ({supplierDebts.length})
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
                      <span className="font-black text-slate-900 text-sm">{credit.name}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                        isSupplierDebt ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {isSupplierDebt ? '🏢 دين مورد (علينا)' : '👤 دين زبون (لنا)'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-bold mt-1 flex flex-wrap items-center gap-2">
                      {credit.phone && <span>📞 {credit.phone}</span>}
                      <span>• {credit.type}</span>
                      {credit.desc && <span className="text-slate-700 font-medium">({credit.desc})</span>}
                      <span>• 📅 {new Date(credit.date).toLocaleDateString('ar-DZ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <span className={`font-black text-sm font-mono ${
                      isSupplierDebt ? 'text-indigo-900' : 'text-amber-800'
                    }`}>
                      {credit.amount.toLocaleString()} دج
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onSettleCredit(credit.id)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1 active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>تم التسديد</span>
                      </button>

                      <button
                        onClick={() => onDeleteCredit(credit.id)}
                        className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors active:scale-95"
                        title="حذف"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
