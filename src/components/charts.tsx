import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  color = 'sky',
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  color?: string;
}) {
  const colors: Record<string, { bg: string; icon: string; val: string }> = {
    sky:     { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',     val: 'text-blue-700' },
    emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700' },
    amber:   { bg: 'bg-amber-50',   icon: 'bg-amber-100 text-amber-600',   val: 'text-amber-700' },
    rose:    { bg: 'bg-red-50',     icon: 'bg-red-100 text-red-600',       val: 'text-red-700' },
    violet:  { bg: 'bg-violet-50',  icon: 'bg-violet-100 text-violet-600', val: 'text-violet-700' },
    slate:   { bg: 'bg-slate-50',   icon: 'bg-slate-100 text-slate-600',   val: 'text-slate-700' },
  };
  const c = colors[color] || colors.sky;
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <div className={`${c.bg} rounded-2xl p-5 border border-white shadow-sm card-hover`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <p className={`mt-2 text-3xl font-extrabold ${c.val}`}>{value}</p>
        </div>
        {icon && (
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${c.icon}`}>
            {icon}
          </div>
        )}
      </div>
      {trendLabel && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          <TrendIcon
            size={13}
            className={trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400'}
          />
          <span className={trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400'}>
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}

export function ChartCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function BarChart({ data, color = '#0ea5e9' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <div className="w-28 text-xs text-slate-600 truncate">{d.label}</div>
          <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}
            >
              <span className="text-xs font-medium text-white">{d.value}</span>
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No data</p>}
    </div>
  );
}

export function LineChart({
  data,
  color = '#0ea5e9',
  height = 180,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 100;
  const h = 100;
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data.map((d, i) => `${i * step},${h - (d.value / max) * h}`).join(' ');
  return (
    <div style={{ height }} className="w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={i * step}
            cy={h - (d.value / max) * h}
            r="1.2"
            fill={color}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="flex justify-between mt-2">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-slate-400">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  segments,
  size = 140,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        {segments.map((s, i) => {
          const len = (s.value / total) * circumference;
          const dash = `${len} ${circumference - len}`;
          const el = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="text-slate-400">({Math.round((s.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
