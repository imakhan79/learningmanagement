import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/* ──────────────────────────────────────────────────
   SPINNER
────────────────────────────────────────────────── */
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';
  return (
    <div className="flex items-center justify-center py-12">
      <div className={`${s} rounded-full border-2 border-slate-200 border-t-primary-600 animate-spin`} />
    </div>
  );
}

/* ──────────────────────────────────────────────────
   BADGE
────────────────────────────────────────────────── */
const BADGE_STYLES: Record<string, string> = {
  primary:   'bg-primary-100 text-primary-700 ring-primary-200',
  secondary: 'bg-secondary-100 text-secondary-700 ring-secondary-200',
  accent:    'bg-accent-100 text-accent-700 ring-accent-200',
  success:   'bg-success-100 text-success-700 ring-success-200',
  warning:   'bg-warning-100 text-warning-700 ring-warning-200',
  danger:    'bg-danger-100 text-danger-700 ring-danger-200',
  green:     'bg-green-100 text-green-700 ring-green-200',
  blue:      'bg-blue-100 text-blue-700 ring-blue-200',
  purple:    'bg-purple-100 text-purple-700 ring-purple-200',
  amber:     'bg-amber-100 text-amber-700 ring-amber-200',
  rose:      'bg-rose-100 text-rose-700 ring-rose-200',
  slate:     'bg-slate-100 text-slate-600 ring-slate-200',
};

export function Badge({
  children, color = 'slate', dot = false, className = '',
}: {
  children: ReactNode; color?: string; dot?: boolean; className?: string;
}) {
  const style = BADGE_STYLES[color] || BADGE_STYLES.slate;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${style} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────
   PROGRESS BAR
────────────────────────────────────────────────── */
export function ProgressBar({ value, color = 'primary', showLabel = false, size = 'md' }: {
  value: number; color?: string; showLabel?: boolean; size?: 'sm' | 'md' | 'lg';
}) {
  const clamp = Math.min(100, Math.max(0, value));
  const h = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';
  const colors: Record<string, string> = {
    primary:   'from-primary-500 to-primary-400',
    secondary: 'from-secondary-500 to-secondary-400',
    success:   'from-success-500 to-success-400',
    warning:   'from-warning-500 to-warning-400',
    danger:    'from-danger-500 to-danger-400',
    accent:    'from-accent-500 to-accent-400',
  };
  const grad = colors[color] || colors.primary;
  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 ${h} bg-slate-100 rounded-full overflow-hidden`}>
        <div
          className={`${h} rounded-full bg-gradient-to-r ${grad} transition-all duration-700 ease-out`}
          style={{ width: `${clamp}%` }}
        />
      </div>
      {showLabel && <span className="text-xs font-semibold text-slate-500 w-9 text-right">{Math.round(clamp)}%</span>}
    </div>
  );
}

/* ──────────────────────────────────────────────────
   AVATAR
────────────────────────────────────────────────── */
export function Avatar({ name, src, size = 'md', color = 'primary' }: {
  name?: string; src?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; color?: string;
}) {
  const sizes = { xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-xl' };
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const grads: Record<string, string> = {
    primary: 'from-primary-500 to-primary-600', secondary: 'from-secondary-500 to-secondary-600',
    success: 'from-success-500 to-success-600', accent: 'from-accent-500 to-accent-600',
  };
  const grad = grads[color] || grads.primary;
  if (src) return <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover ring-2 ring-white shadow-sm`} />;
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-white`}>
      {initials}
    </div>
  );
}

/* ──────────────────────────────────────────────────
   EMPTY STATE
────────────────────────────────────────────────── */
export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center animate-fade-up">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────
   SKELETON LOADER
────────────────────────────────────────────────── */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-8 w-1/3 mt-2" />
    </div>
  );
}

/* ──────────────────────────────────────────────────
   STAT CARD (used in dashboards)
────────────────────────────────────────────────── */
export function StatCard({ label, value, icon, trend, trendValue, color = 'primary', gradient }: {
  label: string; value: string | number; icon?: ReactNode;
  trend?: 'up' | 'down' | 'flat'; trendValue?: string;
  color?: string; gradient?: string;
}) {
  const iconBg: Record<string, string> = {
    primary: 'bg-primary-100 text-primary-600',
    secondary: 'bg-secondary-100 text-secondary-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    danger: 'bg-danger-100 text-danger-600',
    accent: 'bg-accent-100 text-accent-600',
  };
  const trendColor = trend === 'up' ? 'text-success-600 bg-success-50' : trend === 'down' ? 'text-danger-600 bg-danger-50' : 'text-slate-500 bg-slate-50';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className={`card p-5 flex flex-col gap-4 hover-lift ${gradient ? 'text-white overflow-hidden relative' : ''}`}
         style={gradient ? { background: gradient } : undefined}>
      {gradient && <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />}
      <div className="flex items-start justify-between">
        {icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gradient ? 'bg-white/20' : (iconBg[color] || iconBg.primary)}`}>
            {icon}
          </div>
        )}
        {trend && trendValue && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${gradient ? 'bg-white/20 text-white' : trendColor}`}>
            <TrendIcon size={12} /> {trendValue}
          </span>
        )}
      </div>
      <div>
        <p className={`text-2xl font-bold tracking-tight ${gradient ? 'text-white' : 'text-slate-800'}`}>{value}</p>
        <p className={`text-sm mt-0.5 ${gradient ? 'text-white/70' : 'text-slate-500'}`}>{label}</p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   BUTTON
────────────────────────────────────────────────── */
export function Button({
  children, variant = 'primary', size = 'md', className = '', ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'gradient';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none select-none';
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  };
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md',
    gradient: 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md shadow-primary-500/30 hover:shadow-lg hover:shadow-primary-500/40 border-none',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
    outline: 'border-2 border-slate-200 text-slate-700 hover:border-primary-400 hover:text-primary-600',
    danger: 'bg-danger-500 text-white hover:bg-danger-600 shadow-sm'
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

/* ──────────────────────────────────────────────────
   FORMS
────────────────────────────────────────────────── */
export function Input({ label, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const field = <input className={`input-field ${className}`} {...props} />;
  if (!label) return field;
  return (
    <label className="block">
      <span className="label">{label}</span>
      {field}
    </label>
  );
}

export function Textarea({ label, className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const field = <textarea className={`textarea-field ${className}`} {...props} />;
  if (!label) return field;
  return (
    <label className="block">
      <span className="label">{label}</span>
      {field}
    </label>
  );
}

export function Select({ label, className = '', options, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options?: { value: string; label: string }[] }) {
  const field = (
    <select className={`select-field ${className}`} {...props}>
      {options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}
    </select>
  );
  if (!label) return field;
  return (
    <label className="block">
      <span className="label">{label}</span>
      {field}
    </label>
  );
}

/* ──────────────────────────────────────────────────
   CARD
────────────────────────────────────────────────── */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

/* ──────────────────────────────────────────────────
   LIVE / AI BADGES
────────────────────────────────────────────────── */
export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm border border-white/20 shadow-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> Live
    </span>
  );
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-violet-500/80 to-fuchsia-500/80 text-white backdrop-blur-sm border border-white/20 shadow-sm">
      AI Generated
    </span>
  );
}

/* ──────────────────────────────────────────────────
   MODAL
────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, maxW = 'max-w-lg' }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; maxW?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
         onClick={onClose}>
      <div className={`bg-white rounded-3xl shadow-2xl w-full ${maxW} animate-scale-in overflow-hidden`}
           style={{ boxShadow: 'var(--shadow-modal)' }}
           onClick={e => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <span className="text-xl leading-none">×</span>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   HELPER FUNCTIONS
────────────────────────────────────────────────── */
export function formatDateTime(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}
