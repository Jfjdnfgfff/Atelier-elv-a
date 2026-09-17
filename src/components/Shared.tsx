import React from 'react';

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
          ✕
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
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="9" rx="2" />
            <rect x="14" y="3" width="7" height="5" rx="2" />
            <rect x="14" y="12" width="7" height="9" rx="2" />
            <rect x="3" y="16" width="7" height="5" rx="2" />
          </svg>
        );
      case 'rentals':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="3" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M12 14v3l2 1" />
          </svg>
        );
      case 'inventory':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        );
      case 'sales':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        );
      case 'tailoring':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
        );
      case 'expenses':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="2" y="5" width="20" height="14" rx="3" />
            <line x1="2" y1="10" x2="22" y2="10" />
            <path d="M7 15h3" />
            <path d="M15 15h2" />
            <circle cx="12" cy="7.5" r="0.75" fill="currentColor" />
          </svg>
        );
      case 'credits':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="2" y="4" width="20" height="16" rx="3" />
            <line x1="2" y1="9" x2="22" y2="9" />
            <line x1="6" y1="15" x2="10" y2="15" />
            <circle cx="16.5" cy="15" r="1.5" />
          </svg>
        );
      case 'customers':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        );
      case 'staff':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        );
      case 'caisse':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <circle cx="12" cy="12" r="3" />
            <path d="M6 12h.01M18 12h.01" />
            <path d="M2 9h20" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 w-full py-1 sm:py-1.5 px-0.5 sm:px-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-black transition-all min-h-[38px] sm:min-h-[42px] ${
        active
          ? 'bg-rose-600 text-white shadow-sm shadow-rose-200'
          : 'bg-slate-100/90 hover:bg-slate-200 text-slate-700 active:scale-95'
      }`}
    >
      <div className="shrink-0 scale-90 sm:scale-100">{getIcon()}</div>
      <span className="truncate leading-none text-[8.5px] sm:text-xs tracking-tighter sm:tracking-normal">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -left-1 min-w-[15px] h-[15px] sm:min-w-[17px] sm:h-[17px] px-0.5 bg-amber-500 text-white text-[8px] sm:text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-2xs">
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
  iconBg: string;
  icon: React.ReactNode;
  subtitle?: string;
  hideValue?: boolean;
  onClick?: () => void;
}> = ({ title, value, unit = 'دج', iconBg, icon, subtitle, hideValue, onClick }) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100/90 shadow-xs transition-all flex flex-col justify-between text-right w-full ${
        onClick ? 'hover:shadow-md hover:border-slate-200 cursor-pointer active:scale-[0.98]' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-2 w-full">
        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl ${iconBg} flex items-center justify-center text-white shadow-xs shrink-0 text-lg sm:text-xl`}>
          {icon}
        </div>
        {subtitle && (
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 truncate max-w-[130px]">
            {subtitle}
          </span>
        )}
      </div>
      <div className="w-full">
        <div className="text-[11px] sm:text-xs font-bold text-slate-500 mb-0.5 sm:mb-1">{title}</div>
        <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
          {hideValue ? (
            <span className="tracking-widest text-slate-300 font-sans">••••••</span>
          ) : (
            <>
              {typeof value === 'number' ? value.toLocaleString('fr-DZ') : value}
              {unit && <span className="text-[10px] sm:text-xs font-bold text-slate-400 mr-1">{unit}</span>}
            </>
          )}
        </div>
      </div>
    </Component>
  );
};
