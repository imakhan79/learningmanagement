import { useEffect, useState } from 'react';
import { Target, Plus, AlertTriangle, CheckCircle2, Pencil, Video, GraduationCap, BarChart3, DollarSign, BadgeCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, KpiConfig, KpiSnapshot, Profile } from '../lib/supabase';
import { Button, Card, Input, Select, Textarea, Badge, Spinner, EmptyState, Modal, ProgressBar } from '../components/ui';

export default function KpiPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const [configs, setConfigs] = useState<KpiConfig[]>([]);
  const [snapshots, setSnapshots] = useState<KpiSnapshot[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<KpiConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');

  const load = async () => {
    setLoading(true);
    const { data: cfgs } = await supabase.from('kpi_configs').select('*').eq('active', true).order('created_at', { ascending: false });
    setConfigs(cfgs || []);
    if (role === 'admin') {
      const { data: us } = await supabase.from('profiles').select('*').in('role', ['professor', 'student']);
      setUsers(us || []);
      if (us && us.length) {
        const { data: snaps } = await supabase.from('kpi_snapshots').select('*').in('user_id', us.map((u) => u.id)).order('computed_at', { ascending: false });
        setSnapshots(snaps || []);
      }
    } else {
      const { data: snaps } = await supabase.from('kpi_snapshots').select('*').eq('user_id', profile!.id).order('computed_at', { ascending: false });
      setSnapshots(snaps || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const compute = async (userId: string) => {
    // compute actual values for each config
    for (const cfg of configs) {
      let actual = 0;
      if (cfg.metric_key === 'lectures_created') {
        const { data: cs } = await supabase.from('courses').select('id').eq('professor_id', userId);
        const ids = (cs || []).map((c) => c.id);
        if (ids.length) {
          const { count } = await supabase.from('lectures').select('id', { count: 'exact', head: true }).in('course_id', ids).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
          actual = count || 0;
        }
      } else if (cfg.metric_key === 'watch_time_pct' || cfg.metric_key === 'avg_watch_time_pct') {
        const { data: prog } = await supabase.from('lecture_progress').select('completion_pct').eq('student_id', userId).gte('last_viewed_at', new Date(Date.now() - 30 * 86400000).toISOString());
        actual = prog?.length ? prog.reduce((s, p) => s + (p.completion_pct || 0), 0) / prog.length : 0;
      } else if (cfg.metric_key === 'course_completion_days') {
        const { data: enr } = await supabase.from('enrollments').select('enrolled_at, completed_at').eq('student_id', userId).eq('status', 'completed');
        if (enr?.length) {
          const days = enr.map((e) => e.completed_at ? (new Date(e.completed_at).getTime() - new Date(e.enrolled_at).getTime()) / 86400000 : 30);
          actual = days.reduce((s, d) => s + d, 0) / days.length;
        }
      }
      const meets = cfg.comparison === 'gte' ? actual >= cfg.target_value : cfg.comparison === 'lte' ? actual <= cfg.target_value : actual === cfg.target_value;
      const status = meets ? 'on_track' : actual < cfg.target_value * 0.5 ? 'critical' : 'below_target';
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const { data: existing } = await supabase.from('kpi_snapshots').select('id').eq('user_id', userId).eq('kpi_config_id', cfg.id).eq('period_start', start.toISOString()).maybeSingle();
      const payload = { user_id: userId, kpi_config_id: cfg.id, period_start: start.toISOString(), period_end: end.toISOString(), actual_value: actual, target_value: cfg.target_value, status };
      if (existing) await supabase.from('kpi_snapshots').update(payload).eq('id', existing.id);
      else await supabase.from('kpi_snapshots').insert(payload);
      // generate alert if below target
      if (!meets) {
        const { data: existingAlert } = await supabase.from('alerts').select('id').eq('user_id', userId).eq('type', `kpi_${cfg.metric_key}`).gte('created_at', start.toISOString()).maybeSingle();
        if (!existingAlert) {
          await supabase.from('alerts').insert({
            user_id: userId, type: `kpi_${cfg.metric_key}`, severity: status === 'critical' ? 'critical' : 'warning',
            title: `KPI Below Target: ${cfg.name}`, message: `${cfg.name} is ${Math.round(actual * 100) / 100}${cfg.unit} vs target ${cfg.target_value}${cfg.unit}`,
          });
        }
      }
    }
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">KPI Monitoring</h1>
          <p className="text-sm text-slate-500">{role === 'admin' ? 'Configure and monitor KPIs across the institution' : 'Your performance against targets'}</p>
        </div>
        <div className="flex gap-2">
          {role === 'admin' && users.length > 0 && (
            <Select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} options={[{ value: '', label: 'Select user to compute…' }, ...users.map((u) => ({ value: u.id, label: `${u.full_name || u.email} (${u.role})` }))]} />
          )}
          {selectedUser && <Button onClick={() => compute(selectedUser)}><Target size={16} /> Compute KPIs</Button>}
          {(role === 'professor' || role === 'student') && <Button variant="outline" onClick={() => compute(profile!.id)}><Target size={16} /> Refresh My KPIs</Button>}
          {role === 'admin' && <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> New KPI</Button>}
        </div>
      </div>

      {(role === 'professor' || role === 'student') && (
        <div className="rounded-3xl p-6 sm:p-7 relative overflow-hidden text-white"
             style={{ background: 'linear-gradient(135deg,#312e81 0%,#4338ca 55%,#6366f1 120%)' }}>
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-25 -translate-y-1/3 translate-x-1/4"
               style={{ background: 'radial-gradient(circle,#a5b4fc,transparent 70%)' }} />
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Welcome Back</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">{profile?.full_name || (role === 'professor' ? 'Professor' : 'Student')}</h1>
          </div>
        </div>
      )}

      {(role === 'professor' || role === 'student') && (
        <div className="space-y-3">
          {configs.filter((c) => c.role === role).length === 0 ? (
            <Card><EmptyState icon={<Target size={28} />} title="No KPIs assigned" description="Admins need to configure KPI targets" /></Card>
          ) : snapshots.length === 0 ? (
            <Card><EmptyState icon={<Target size={28} />} title="No KPI snapshots yet" description={`Click "Refresh My KPIs" above to compute your latest performance.`} /></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {configs.filter((c) => c.role === role).map((c) => {
                const userSnaps = snapshots.filter((s) => s.kpi_config_id === c.id);
                if (userSnaps.length === 0) return null;
                const latest = userSnaps[0];
                const borderColor = latest.status === 'critical' ? 'border-l-danger-500' : latest.status === 'below_target' ? 'border-l-warning-500' : 'border-l-success-500';
                const badgeColor = latest.status === 'critical' ? 'danger' : latest.status === 'below_target' ? 'warning' : 'success';
                const badgeLabel = latest.status === 'critical' ? 'Critical' : latest.status === 'below_target' ? 'Watch' : 'Healthy';
                const Icon = kpiIcon(c.metric_key);
                const val = Math.round(latest.actual_value * 100) / 100;
                return (
                  <div key={c.id} className={`card p-5 border-l-4 ${borderColor}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                        <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><Icon size={15} /></span>
                        {c.name}
                      </span>
                      <Badge color={badgeColor}>{badgeLabel}</Badge>
                    </div>
                    <p className="text-3xl font-black text-slate-800 tracking-tight">{val}{c.unit === '%' ? '%' : ''}</p>
                    <p className={`text-xs font-semibold mt-1.5 ${latest.status === 'on_track' ? 'text-success-600' : 'text-danger-600'}`}>
                      {latest.status === 'on_track' ? `Meeting target of ${c.target_value}${c.unit}` : `Below threshold (${c.target_value}${c.unit})`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {snapshots.length > 0 && (
            <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg,#475569,#334155)' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2">Performance Insight</p>
              <p className="text-sm leading-relaxed text-white/90">
                {snapshots.some((s) => s.status !== 'on_track')
                  ? 'A few metrics are trending below target — keep content fresh and engaging to bring them back on track.'
                  : "You're meeting all your current targets. Keep up the consistent work."}
              </p>
            </div>
          )}
        </div>
      )}

      {role === 'admin' && (
        <div className="space-y-4">
          {(() => {
            const onTrack = snapshots.filter((s) => s.status === 'on_track').length;
            const total = snapshots.length || 1;
            const perf = Math.round((onTrack / total) * 1000) / 10;
            return (
              <div className="rounded-3xl p-6 sm:p-7 relative overflow-hidden text-white"
                   style={{ background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 55%,#4f46e5 120%)' }}>
                <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-25 -translate-y-1/3 translate-x-1/4"
                     style={{ background: 'radial-gradient(circle,#818cf8,transparent 70%)' }} />
                <div className="relative z-10">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/70">Current Performance</p>
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight">{snapshots.length ? `${perf}%` : '—'}</span>
                    <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-300">
                      <TrendingUpMini /> On Track
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">KPI Configurations</h3>
            {configs.length === 0 ? (
              <EmptyState icon={<Target size={28} />} title="No KPIs configured" description="Create KPI targets to monitor performance" />
            ) : (
              <div className="space-y-3">
                {configs.map((c) => {
                  const userSnaps = snapshots.filter((s) => s.kpi_config_id === c.id);
                  const alert = userSnaps.some((s) => s.status !== 'on_track');
                  const Icon = kpiIcon(c.metric_key);
                  return (
                    <div key={c.id} className={`flex items-center gap-4 p-4 rounded-2xl border hover-lift ${alert ? 'border-danger-200 bg-danger-50/40' : 'border-slate-100 bg-slate-50'}`}>
                      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-white text-primary-600 shadow-sm">
                        <Icon size={20} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 truncate">{c.name}</p>
                          {alert && <span className="w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0" />}
                        </div>
                        <p className="text-sm text-slate-500 truncate">{c.description || `${c.role} • ${c.period}`}</p>
                      </div>
                      <button
                        onClick={() => { setEditing(c); setShowForm(true); }}
                        className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-primary-600 hover:border-primary-300 transition-colors shrink-0"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configs.map((c) => {
            const userSnaps = snapshots.filter((s) => s.kpi_config_id === c.id);
            if (userSnaps.length === 0) return null;
            const latest = userSnaps[0];
            const pct = c.target_value ? Math.min(100, (latest.actual_value / c.target_value) * 100) : 100;
            const statusColor = latest.status === 'on_track' ? 'green' : latest.status === 'critical' ? 'red' : 'amber';
            const StatusIcon = latest.status === 'on_track' ? CheckCircle2 : AlertTriangle;
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div><p className="text-sm font-semibold text-slate-700">{c.name}</p><p className="text-xs text-slate-400">{c.description}</p></div>
                  <Badge color={statusColor}><StatusIcon size={12} className="mr-1" />{latest.status.replace('_', ' ')}</Badge>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-slate-800">{Math.round(latest.actual_value * 100) / 100}</span>
                  <span className="text-sm text-slate-400">/ {c.target_value} {c.unit}</span>
                </div>
                <ProgressBar value={pct} />
                <p className="text-xs text-slate-400 mt-2">Computed {new Date(latest.computed_at).toLocaleDateString()}</p>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && <KpiForm config={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function TrendingUpMini() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function kpiIcon(metricKey: string) {
  if (metricKey.includes('lecture')) return Video;
  if (metricKey.includes('course')) return GraduationCap;
  if (metricKey.includes('engagement') || metricKey.includes('watch')) return BarChart3;
  if (metricKey.includes('revenue') || metricKey.includes('fee')) return DollarSign;
  if (metricKey.includes('approval') || metricKey.includes('quiz')) return BadgeCheck;
  return Target;
}

function KpiForm({ config, onClose, onSaved }: { config: KpiConfig | null; onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState(config?.name || '');
  const [role, setRole] = useState<'professor' | 'student'>(config?.role || 'professor');
  const [metricKey, setMetricKey] = useState(config?.metric_key || 'lectures_created');
  const [target, setTarget] = useState(String(config?.target_value || 20));
  const [comparison, setComparison] = useState(config?.comparison || 'gte');
  const [period, setPeriod] = useState(config?.period || 'monthly');
  const [unit, setUnit] = useState(config?.unit || '');
  const [description, setDescription] = useState(config?.description || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const payload = { name, role, metric_key: metricKey, target_value: parseFloat(target), comparison, period, unit, description, active: true, created_by: profile!.id };
    if (config) await supabase.from('kpi_configs').update(payload).eq('id', config.id);
    else await supabase.from('kpi_configs').insert(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={config ? 'Edit KPI' : 'New KPI Configuration'}>
      <div className="space-y-4 p-6 pt-2">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lectures Created" required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as any)} options={[{ value: 'professor', label: 'Professor' }, { value: 'student', label: 'Student' }]} />
          <Select label="Metric" value={metricKey} onChange={(e) => setMetricKey(e.target.value)} options={[
            { value: 'lectures_created', label: 'Lectures Created' },
            { value: 'courses_created', label: 'Courses Created' },
            { value: 'lecture_completion_rate', label: 'Lecture Completion Rate' },
            { value: 'student_engagement', label: 'Student Engagement (min)' },
            { value: 'quiz_creation', label: 'Quiz Creation' },
            { value: 'assignment_upload', label: 'Assignment Upload' },
            { value: 'course_updates', label: 'Course Updates' },
            { value: 'avg_watch_time_pct', label: 'Avg Watch Time %' },
            { value: 'watch_time_pct', label: 'Student Watch %' },
            { value: 'course_completion_days', label: 'Course Completion Days' },
          ]} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Target" value={target} onChange={(e) => setTarget(e.target.value)} type="number" />
          <Select label="Comparison" value={comparison} onChange={(e) => setComparison(e.target.value as any)} options={[{ value: 'gte', label: '≥ Target' }, { value: 'lte', label: '≤ Target' }, { value: 'eq', label: '= Target' }]} />
          <Select label="Period" value={period} onChange={(e) => setPeriod(e.target.value as any)} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
        </div>
        <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="lectures, %, days…" />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving || !name}>{saving ? 'Saving…' : 'Save'}</Button></div>
      </div>
    </Modal>
  );
}
