import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Package,
  ShoppingBag,
  Scissors,
  Receipt,
  CreditCard,
  Scale,
  Users,
  X,
} from 'lucide-react';

export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none" dir="rtl">
    <div 
      className={`bg-white rounded-t-3xl sm:rounded-3xl w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} max-w-full p-4 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] sm:max-h-[92vh] flex flex-col my-0 sm:my-auto overflow-x-hidden animate-in fade-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 safe-bottom`}
    >
      {/* Mobile handle indicator */}
      <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

      <div className="flex justify-between items-center pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-100 shrink-0">
        <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
          {title}
        </h3>
        <button 
          onClick={onClose} 
          aria-label="إغلاق"
          className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors active:scale-95 text-sm font-bold"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-y-auto overflow-x-hidden flex-1 pr-1 pl-1 custom-scrollbar pb-2 touch-pan-y overscroll-x-none">
        {children}
      </div>
    </div>
  </div>
);

export const NavButton: React.FC<{
  icon: 'dashboard' | 'rentals' | 'inventory' | 'sales' | 'expenses' | 'credits' | 'customers' | 'staff' | 'packages' | 'absence' | 'tailoring' | 'caisse';
  label: string;
  onClick: () => void;
  active?: boolean;
  color?: string;
  badge?: number;
}> = ({ icon, label, onClick, active, color = 'slate', badge }) => {
  const getIcon = () => {
    switch (icon) {
      case 'dashboard':
        return <LayoutDashboard className="w-4 h-4" />;
      case 'rentals':
        return <Calendar className="w-4 h-4" />;
      case 'inventory':
        return <Package className="w-4 h-4" />;
      case 'sales':
        return <ShoppingBag className="w-4 h-4" />;
      case 'tailoring':
        return <Scissors className="w-4 h-4" />;
      case 'expenses':
        return <Receipt className="w-4 h-4" />;
      case 'credits':
        return <CreditCard className="w-4 h-4" />;
      case 'customers':
      case 'staff':
      case 'absence':
        return <Users className="w-4 h-4" />;
      case 'caisse':
        return <Scale className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 w-full py-1.5 px-0.5 sm:px-1.5 rounded-xl text-[9.5px] sm:text-xs font-bold transition-all min-h-[38px] sm:min-h-[42px] ${
        active
          ? 'bg-slate-900 text-white shadow-xs'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 active:scale-95'
      }`}
    >
      <div className="shrink-0 scale-90 sm:scale-100">{getIcon()}</div>
      <span className="truncate leading-none text-[8.5px] sm:text-xs tracking-tight">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -left-1 min-w-[15px] h-[15px] sm:min-w-[17px] sm:h-[17px] px-1 bg-slate-800 text-white text-[8px] sm:text-[9px] font-bold rounded-full flex items-center justify-center border border-white shadow-xs">
          {badge}
        </span>
      )}
    </button>
  );
};

export const StatCard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  iconBg?: string;
  icon: React.ReactNode;
  subtitle?: string;
  hideValue?: boolean;
  onClick?: () => void;
}> = ({ title, value, unit = 'دج', iconBg, icon, subtitle, hideValue, onClick }) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs transition-all flex flex-col justify-between text-right w-full ${
        onClick ? 'hover:border-slate-300 hover:shadow-sm cursor-pointer active:scale-[0.99]' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-2.5 w-full">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 text-base sm:text-lg border border-slate-200/60">
          {icon}
        </div>
        {subtitle && (
          <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 truncate max-w-[130px]">
            {subtitle}
          </span>
        )}
      </div>
      <div className="w-full">
        <div className="text-[11px] sm:text-xs font-medium text-slate-500 mb-0.5 sm:mb-1">{title}</div>
        <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
          {hideValue ? (
            <span className="tracking-widest text-slate-300 font-sans">••••••</span>
          ) : (
            <>
              {typeof value === 'number' ? value.toLocaleString('fr-DZ') : value}
              {unit && <span className="text-[10px] sm:text-xs font-medium text-slate-400 mr-1 font-sans">{unit}</span>}
            </>
          )}
        </div>
      </div>
    </Component>
  );
};
