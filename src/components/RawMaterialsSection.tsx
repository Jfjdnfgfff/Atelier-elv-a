import React, { useState, useMemo } from 'react';
import { RawMaterial, Supplier } from '../types';
import { LettersInput, NumbersInput } from './Shared';
import { POPULAR_COLORS, getColorHex } from './InventoryView';
import { 
  Package, 
  Scissors, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  Sparkles, 
  MinusCircle, 
  PlusCircle, 
  Tag, 
  Building2, 
  MapPin, 
  X, 
  Check 
} from 'lucide-react';

interface RawMaterialsSectionProps {
  rawMaterials: RawMaterial[];
  suppliers?: Supplier[];
  onAddRawMaterial: (mat: RawMaterial) => void;
  onUpdateRawMaterial: (id: string, mat: Partial<RawMaterial>) => void;
  onDeleteRawMaterial: (id: string) => void;
}

export const FABRIC_TYPES = [
  'ساتان ملكي فاخر',
  'كريب جورجيت فرنسي',
  'مخمل قطيفة راقية',
  'تول ودانتيل مطرز',
  'حرير طبيعي وصناعي',
  'قماش تقليدي (كراكو/قفطان)',
  'بطانة وساتان خفيف',
  'شيفون وأورجانزا',
  'أخرى'
];

export const RawMaterialsSection: React.FC<RawMaterialsSectionProps> = ({
  rawMaterials,
  suppliers = [],
  onAddRawMaterial,
  onUpdateRawMaterial,
  onDeleteRawMaterial
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [consumeModalMaterial, setConsumeModalMaterial] = useState<RawMaterial | null>(null);
  const [consumeMeters, setConsumeMeters] = useState<string>('');
  const [consumeReason, setConsumeReason] = useState<string>('');
  const [addRollsModalMaterial, setAddRollsModalMaterial] = useState<RawMaterial | null>(null);
  const [addRollsCount, setAddRollsCount] = useState<string>('');

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [fabricType, setFabricType] = useState(FABRIC_TYPES[0]);
  const [color, setColor] = useState('أسود');
  const [customColor, setCustomColor] = useState('');
  const [rollCount, setRollCount] = useState<string>('1');
  const [metersPerRoll, setMetersPerRoll] = useState<string>('25');
  const [looseMeters, setLooseMeters] = useState<string>('0');
  const [costPerMeter, setCostPerMeter] = useState<string>('1000');
  const [supplierName, setSupplierName] = useState('');
  const [storageLocation, setStorageLocation] = useState('ورشة الخياطة');
  const [minAlertMeters, setMinAlertMeters] = useState<string>('10');
  const [notes, setNotes] = useState('');

  // Auto calculations for form
  const parsedRolls = Number(rollCount) || 0;
  const parsedMetersPerRoll = Number(metersPerRoll) || 0;
  const parsedLoose = Number(looseMeters) || 0;
  const formTotalMeters = (parsedRolls * parsedMetersPerRoll) + parsedLoose;
  const parsedCostPerMeter = Number(costPerMeter) || 0;
  const formTotalCost = formTotalMeters * parsedCostPerMeter;
  const formCostPerRoll = parsedMetersPerRoll * parsedCostPerMeter;

  // Global Statistics for Raw Materials ("المجموع تاع سلعة أولية وش عندي")
  const stats = useMemo(() => {
    const totalRolls = rawMaterials.reduce((s, m) => s + (m.rollCount || 0), 0);
    const totalMeters = rawMaterials.reduce((s, m) => s + (m.totalMeters || 0), 0);
    const totalCostValue = rawMaterials.reduce((s, m) => s + (m.totalCostValue || (m.totalMeters * m.costPerMeter) || 0), 0);
    const lowStockCount = rawMaterials.filter(m => m.totalMeters <= (m.minAlertMeters || 10)).length;

    const uniqueColors = new Set(rawMaterials.map(m => m.color).filter(Boolean));
    const uniqueTypes = new Set(rawMaterials.map(m => m.fabricType).filter(Boolean));

    return {
      totalRolls,
      totalMeters,
      totalCostValue,
      lowStockCount,
      uniqueColorsCount: uniqueColors.size,
      uniqueTypesCount: uniqueTypes.size
    };
  }, [rawMaterials]);

  // Unique colors in list for filtering
  const availableColors = useMemo(() => {
    return Array.from(new Set(rawMaterials.map(m => m.color).filter(Boolean)));
  }, [rawMaterials]);

  // Filtered list
  const filteredMaterials = useMemo(() => {
    return rawMaterials.filter(item => {
      if (filterType !== 'all' && item.fabricType !== filterType) return false;
      if (filterColor !== 'all' && item.color !== filterColor) return false;
      if (showLowStockOnly && item.totalMeters > (item.minAlertMeters || 10)) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = (item.code || '').toLowerCase().includes(q);
        const matchColor = item.color.toLowerCase().includes(q);
        const matchSupplier = (item.supplierName || '').toLowerCase().includes(q);
        const matchLocation = (item.storageLocation || '').toLowerCase().includes(q);
        return matchName || matchCode || matchColor || matchSupplier || matchLocation;
      }
      return true;
    });
  }, [rawMaterials, filterType, filterColor, showLowStockOnly, search]);

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    setName('');
    setCode('FAB-' + Math.floor(100 + Math.random() * 900));
    setFabricType(FABRIC_TYPES[0]);
    setColor('أسود');
    setCustomColor('');
    setRollCount('2');
    setMetersPerRoll('25');
    setLooseMeters('0');
    setCostPerMeter('1200');
    setSupplierName(suppliers[0]?.name || '');
    setStorageLocation('ورشة الخياطة');
    setMinAlertMeters('10');
    setNotes('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (mat: RawMaterial) => {
    setEditingMaterial(mat);
    setName(mat.name);
    setCode(mat.code || '');
    setFabricType(mat.fabricType || FABRIC_TYPES[0]);
    setColor(mat.color);
    setCustomColor('');
    setRollCount(String(mat.rollCount || 0));
    setMetersPerRoll(String(mat.metersPerRoll || 25));
    setLooseMeters(String(mat.looseMeters || 0));
    setCostPerMeter(String(mat.costPerMeter || 0));
    setSupplierName(mat.supplierName || '');
    setStorageLocation(mat.storageLocation || 'ورشة الخياطة');
    setMinAlertMeters(String(mat.minAlertMeters || 10));
    setNotes(mat.notes || '');
    setShowAddModal(true);
  };

  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalColor = customColor.trim() || color;
    const rCount = Math.max(0, Number(rollCount) || 0);
    const mPerRoll = Math.max(1, Number(metersPerRoll) || 1);
    const lMeters = Math.max(0, Number(looseMeters) || 0);
    const totMeters = (rCount * mPerRoll) + lMeters;
    const cPerMeter = Math.max(0, Number(costPerMeter) || 0);
    const totCost = totMeters * cPerMeter;
    const cPerRoll = mPerRoll * cPerMeter;

    if (editingMaterial) {
      onUpdateRawMaterial(editingMaterial.id, {
        name: name.trim(),
        code: code.trim() || undefined,
        fabricType,
        color: finalColor,
        rollCount: rCount,
        metersPerRoll: mPerRoll,
        looseMeters: lMeters,
        totalMeters: totMeters,
        costPerMeter: cPerMeter,
        costPerRoll: cPerRoll,
        totalCostValue: totCost,
        supplierName: supplierName.trim() || undefined,
        storageLocation: storageLocation.trim() || undefined,
        minAlertMeters: Number(minAlertMeters) || 10,
        notes: notes.trim() || undefined,
        updatedAt: new Date().toISOString()
      });
    } else {
      onAddRawMaterial({
        id: 'mat_' + Date.now(),
        name: name.trim(),
        code: code.trim() || undefined,
        fabricType,
        color: finalColor,
        rollCount: rCount,
        metersPerRoll: mPerRoll,
        looseMeters: lMeters,
        totalMeters: totMeters,
        costPerMeter: cPerMeter,
        costPerRoll: cPerRoll,
        totalCostValue: totCost,
        supplierName: supplierName.trim() || undefined,
        storageLocation: storageLocation.trim() || undefined,
        minAlertMeters: Number(minAlertMeters) || 10,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString()
      });
    }

    setShowAddModal(false);
  };

  // Consume / Cut meters for dress tailoring
  const handleConfirmConsume = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumeModalMaterial || !consumeMeters || Number(consumeMeters) <= 0) return;

    const cutQty = Number(consumeMeters);
    const currentTot = consumeModalMaterial.totalMeters;
    const newTot = Math.max(0, currentTot - cutQty);
    
    // Recalculate rolls and loose meters
    const mPerRoll = consumeModalMaterial.metersPerRoll || 25;
    const newRollCount = Math.floor(newTot / mPerRoll);
    const newLoose = Number((newTot % mPerRoll).toFixed(2));
    const newTotalCost = newTot * consumeModalMaterial.costPerMeter;

    onUpdateRawMaterial(consumeModalMaterial.id, {
      totalMeters: newTot,
      rollCount: newRollCount,
      looseMeters: newLoose,
      totalCostValue: newTotalCost,
      notes: consumeReason.trim() 
        ? `${consumeModalMaterial.notes || ''}\n[قص ${cutQty} م: ${consumeReason.trim()} في ${new Date().toISOString().split('T')[0]}]`.trim() 
        : consumeModalMaterial.notes,
      updatedAt: new Date().toISOString()
    });

    setConsumeModalMaterial(null);
    setConsumeMeters('');
    setConsumeReason('');
  };

  // Add rolls restock
  const handleConfirmAddRolls = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addRollsModalMaterial || !addRollsCount || Number(addRollsCount) <= 0) return;

    const added = Number(addRollsCount);
    const newRolls = (addRollsModalMaterial.rollCount || 0) + added;
    const mPerRoll = addRollsModalMaterial.metersPerRoll || 25;
    const newTotMeters = (newRolls * mPerRoll) + (addRollsModalMaterial.looseMeters || 0);
    const newTotalCost = newTotMeters * addRollsModalMaterial.costPerMeter;

    onUpdateRawMaterial(addRollsModalMaterial.id, {
      rollCount: newRolls,
      totalMeters: newTotMeters,
      totalCostValue: newTotalCost,
      updatedAt: new Date().toISOString()
    });

    setAddRollsModalMaterial(null);
    setAddRollsCount('');
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Banner & KPI Cards: مجموع السلع الأولية وش عندي */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-blue-600 flex items-center gap-2">
              <span>مخزون السلع الأولية والأقمشة بالرولو (Rouleaux & Tissus)</span>
              <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-xl font-bold border border-blue-100">
                {rawMaterials.length} أصناف أقمشة
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              متابعة الرولويات، الأمتار المتوفرة، أسعار الشراء بالمتر والرولو، وقص الأقمشة للخياطة.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md shadow-blue-200 active:scale-95 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة رولو / قماش جديد</span>
          </button>
        </div>

        {/* 4 Rich KPI Metric Cards: وش عندي سلعة أولية */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-bold block mb-0.5">إجمالي الرولويات المتوفرة:</span>
            <span className="text-2xl font-black text-slate-900">{stats.totalRolls.toLocaleString()} <span className="text-xs font-bold text-slate-500">رولو</span></span>
            <span className="text-[10px] text-slate-400 block mt-0.5">({stats.uniqueTypesCount} أصناف أقمشة)</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-bold block mb-0.5">إجمالي الأمتار الكلية:</span>
            <span className="text-2xl font-black text-blue-700 font-mono">{stats.totalMeters.toLocaleString()} <span className="text-xs font-bold text-blue-600">متر</span></span>
            <span className="text-[10px] text-slate-400 block mt-0.5">جاهزة للتفصيل والخياطة</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-bold block mb-0.5">قيمة السلع الأولية (تكلِفة):</span>
            <span className="text-2xl font-black text-slate-900 font-mono">{stats.totalCostValue.toLocaleString()} <span className="text-xs font-bold text-slate-500">دج</span></span>
            <span className="text-[10px] text-slate-400 block mt-0.5">رأس مال الأقمشة والمواد</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-bold block mb-0.5">تنبيهات نقص الأقمشة:</span>
            <span className={`text-2xl font-black ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {stats.lowStockCount} <span className="text-xs font-bold text-slate-500">أصناف</span>
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">أقل من الحد الأدنى</span>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم القماش، الكود، اللون، المورد، أو مكان التخزين..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">كل أنواع الأقمشة</option>
              {FABRIC_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={filterColor}
              onChange={(e) => setFilterColor(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">كل الألوان</option>
              {availableColors.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                showLowStockOnly ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ⚠️ الناقصة فقط ({stats.lowStockCount})
            </button>
          </div>
        </div>
      </div>

      {/* Materials List Grid */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 space-y-2">
          <p className="text-sm font-bold text-slate-600">لا توجد أقمشة أو سلع أولية مسجلة مطابقة للبحث</p>
          <button onClick={handleOpenAdd} className="text-xs text-blue-600 font-bold hover:underline">
            + إضافة قماش / رولو جديد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredMaterials.map(item => {
            const isLow = item.totalMeters <= (item.minAlertMeters || 10);
            const colorHex = getColorHex(item.color);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl p-5 border transition-all flex flex-col justify-between space-y-3.5 shadow-xs ${
                  isLow ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Top Bar */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.code && (
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                            {item.code}
                          </span>
                        )}
                        <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-md">
                          {item.fabricType}
                        </span>
                      </div>
                      <h4 className="font-black text-slate-900 text-base mt-1 truncate">{item.name}</h4>
                    </div>

                    {/* Color Badge */}
                    <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200 shrink-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 shadow-xs"
                        style={{ backgroundColor: colorHex }}
                      />
                      <span className="text-[11px] font-bold text-slate-800">{item.color}</span>
                    </div>
                  </div>

                  {/* Stock Metrics (الرولو والأمتار) */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">عدد الرولويات</span>
                      <span className="text-sm font-black text-slate-900">{item.rollCount} رولو</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">إجمالي الأمتار</span>
                      <span className="text-sm font-black text-blue-700 font-mono">{item.totalMeters} م</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">سعر المتر</span>
                      <span className="text-sm font-black text-slate-900 font-mono">{item.costPerMeter.toLocaleString()} دج</span>
                    </div>
                  </div>

                  {/* Storage, Supplier & Value Details */}
                  <div className="text-xs text-slate-500 space-y-1 pt-0.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span>القيمة الإجمالية للسلعة:</span>
                      <span className="font-black text-slate-900 font-mono">
                        {(item.totalCostValue || (item.totalMeters * item.costPerMeter)).toLocaleString()} دج
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span>المكان: <span className="font-bold text-slate-700">{item.storageLocation || 'الورشة'}</span></span>
                      {item.supplierName && (
                        <span>المورد: <span className="font-bold text-slate-700">{item.supplierName}</span></span>
                      )}
                    </div>
                  </div>

                  {/* Low Stock Warning */}
                  {isLow && (
                    <div className="bg-amber-100/70 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>تنبيه: متبقي {item.totalMeters} متر فقط (تحت الحد الأدنى {item.minAlertMeters || 10}م)</span>
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2">
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Quick Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setConsumeModalMaterial(item);
                        setConsumeMeters('3');
                        setConsumeReason('');
                      }}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs active:scale-95"
                      title="قص واستهلاك أمتار لخياطة فستان"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>قص أمتار</span>
                    </button>
                    <button
                      onClick={() => {
                        setAddRollsModalMaterial(item);
                        setAddRollsCount('1');
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                      title="إضافة رولويات جديدة"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ رولو</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-all"
                      title="تعديل"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف القماش "${item.name}"؟`)) {
                          onDeleteRawMaterial(item.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-all"
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

      {/* ==================================================== */}
      {/* MODAL: ADD / EDIT RAW MATERIAL */}
      {/* ==================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-xl p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <span>{editingMaterial ? 'تعديل بيانات القماش / السلعة الأولية' : 'إضافة قماش ورولويات جديدة'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    اسم القماش / السلعة الأولية <span className="text-red-500">* (حروف فقط)</span>
                  </label>
                  <LettersInput
                    value={name}
                    onChange={setName}
                    placeholder="مثال: ساتان حريري ملكي، كريب فرنسي..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    كود / المرجع
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="FAB-101"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    نوع وصنف القماش
                  </label>
                  <select
                    value={fabricType}
                    onChange={(e) => setFabricType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {FABRIC_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    اللون
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        setCustomColor('');
                      }}
                      className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      {POPULAR_COLORS.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <LettersInput
                      value={customColor}
                      onChange={setCustomColor}
                      placeholder="أو لون مخصص..."
                      className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Quantities & Rolls */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 block">تفاصيل الرولويات والأمتار:</span>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      عدد الرولويات (Rouleaux) <span className="text-slate-400">(أرقام)</span>
                    </label>
                    <NumbersInput
                      value={rollCount}
                      onChange={setRollCount}
                      placeholder="2"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-900 text-center focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      طول الرولو (متر) <span className="text-slate-400">(أرقام)</span>
                    </label>
                    <NumbersInput
                      value={metersPerRoll}
                      onChange={setMetersPerRoll}
                      placeholder="25"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-900 text-center focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      أمتار مقصوصة / متبقية <span className="text-slate-400">(أرقام)</span>
                    </label>
                    <NumbersInput
                      value={looseMeters}
                      onChange={setLooseMeters}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-900 text-center focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs font-bold text-blue-700 bg-blue-50 p-2 rounded-xl flex justify-between items-center">
                  <span>المجموع المحسوب للأمتار:</span>
                  <span className="font-mono text-sm">{formTotalMeters} متر</span>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    سعر الشراء للمتر الواحد (دج) <span className="text-red-500">* (أرقام فقط)</span>
                  </label>
                  <NumbersInput
                    value={costPerMeter}
                    onChange={setCostPerMeter}
                    placeholder="1200"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    القيمة الإجمالية المحسوبة
                  </label>
                  <div className="bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-900 font-mono">
                    {formTotalCost.toLocaleString()} دج
                  </div>
                </div>
              </div>

              {/* Supplier & Storage Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    المورد
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="اسم المورد أو الشركة"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    مكان التخزين
                  </label>
                  <select
                    value={storageLocation}
                    onChange={(e) => setStorageLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="ورشة الخياطة">ورشة الخياطة</option>
                    <option value="مستودع الأقمشة">مستودع الأقمشة (Stock 2)</option>
                    <option value="صالة العرض / المحل">صالة العرض / المحل (Stock 1)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    تنبيه النقص (متر)
                  </label>
                  <NumbersInput
                    value={minAlertMeters}
                    onChange={setMinAlertMeters}
                    placeholder="10"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ملاحظات
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="ملاحظات حول جودة القماش، تفصيل موديلات معينة..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs"
                >
                  {editingMaterial ? 'حفظ التعديلات' : 'إضافة القماش للمخزن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CONSUME / CUT METERS */}
      {/* ==================================================== */}
      {consumeModalMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Scissors className="w-5 h-5 text-blue-600" />
                <span>قص واستهلاك أقمشة للخياطة</span>
              </h3>
              <button
                onClick={() => setConsumeModalMaterial(null)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmConsume} className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div>القماش: <span className="font-black text-slate-900">{consumeModalMaterial.name} ({consumeModalMaterial.color})</span></div>
                <div>المتوفر حالياً: <span className="font-bold text-blue-700 font-mono">{consumeModalMaterial.totalMeters} متر</span> ({consumeModalMaterial.rollCount} رولو)</div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  عدد الأمتار المراد قصها <span className="text-red-500">* (أرقام فقط)</span>
                </label>
                <NumbersInput
                  value={consumeMeters}
                  onChange={setConsumeMeters}
                  placeholder="مثال: 3.5"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  السبب / رقم طلبية الخياطة
                </label>
                <input
                  type="text"
                  value={consumeReason}
                  onChange={(e) => setConsumeReason(e.target.value)}
                  placeholder="مثال: خياطة فستان خطوبة للزبونة سميرة..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConsumeModalMaterial(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs"
                >
                  تأكيد خصم الأمتار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD ROLLS (RESTOCK) */}
      {/* ==================================================== */}
      {addRollsModalMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                <span>إضافة وتزويد رولويات جديدة</span>
              </h3>
              <button
                onClick={() => setAddRollsModalMaterial(null)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddRolls} className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div>القماش: <span className="font-black text-slate-900">{addRollsModalMaterial.name} ({addRollsModalMaterial.color})</span></div>
                <div>الرولويات الحالية: <span className="font-bold text-slate-900">{addRollsModalMaterial.rollCount} رولو</span> ({addRollsModalMaterial.totalMeters} متر)</div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  عدد الرولويات المضافة <span className="text-red-500">* (أرقام فقط)</span>
                </label>
                <NumbersInput
                  value={addRollsCount}
                  onChange={setAddRollsCount}
                  placeholder="مثال: 2"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddRollsModalMaterial(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs"
                >
                  إضافة الرولويات للمخزن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
