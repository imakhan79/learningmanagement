import { useEffect, useState } from 'react';
import { Target, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
            <Select value={selectedUser} onChange={setSelectedUser} options={[{ value: '', label: 'Select user to compute…' }, ...users.map((u) => ({ value: u.id, label: `${u.full_name || u.email} (${u.role})` }))]} />
          )}
          {selectedUser && <Button onClick={() => compute(selectedUser)}><Target size={16} /> Compute KPIs</Button>}
          {role === 'professor' && <Button variant="outline" onClick={() => compute(profile!.id)}><Target size={16} /> Refresh My KPIs</Button>}
          {role === 'admin' && <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> New KPI</Button>}
        </div>
      </div>

      {role === 'admin' && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">KPI Configurations</h3>
          {configs.length === 0 ? (
            <EmptyState icon={<Target size={28} />} title="No KPIs configured" subtitle="Create KPI targets to monitor performance" />
          ) : (
            <div className="space-y-2">
              {configs.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><p className="text-sm font-medium text-slate-700">{c.name}</p><Badge color="slate">{c.role}</Badge><Badge color="slate">{c.period}</Badge></div>
                    <p className="text-xs text-slate-500 mt-0.5">Target: {c.target_value} {c.unit} ({c.comparison}) • {c.metric_key}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setShowForm(true); }}>Edit</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {configs.map((c) => {
          const userSnaps = role === 'admin' ? snapshots.filter((s) => s.kpi_config_id === c.id) : snapshots.filter((s) => s.kpi_config_id === c.id);
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
        {configs.length === 0 && role !== 'admin' && (
          <Card className="md:col-span-2"><EmptyState icon={<Target size={28} />} title="No KPIs assigned" subtitle="Admins need to configure KPI targets" /></Card>
        )}
      </div>

      {showForm && <KpiForm config={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
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
      <div className="space-y-4">
        <Input label="Name" value={name} onChange={setName} placeholder="Lectures Created" required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Role" value={role} onChange={(v) => setRole(v as any)} options={[{ value: 'professor', label: 'Professor' }, { value: 'student', label: 'Student' }]} />
          <Select label="Metric" value={metricKey} onChange={setMetricKey} options={[
            { value: 'lectures_created', label: 'Lectures Created' },
            { value: 'avg_watch_time_pct', label: 'Avg Watch Time %' },
            { value: 'watch_time_pct', label: 'Student Watch %' },
            { value: 'course_completion_days', label: 'Course Completion Days' },
          ]} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Target" value={target} onChange={setTarget} type="number" />
          <Select label="Comparison" value={comparison} onChange={(v) => setComparison(v as any)} options={[{ value: 'gte', label: '≥ Target' }, { value: 'lte', label: '≤ Target' }, { value: 'eq', label: '= Target' }]} />
          <Select label="Period" value={period} onChange={(v) => setPeriod(v as any)} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
        </div>
        <Input label="Unit" value={unit} onChange={setUnit} placeholder="lectures, %, days…" />
        <Textarea label="Description" value={description} onChange={setDescription} rows={2} />
        <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving || !name}>{saving ? 'Saving…' : 'Save'}</Button></div>
      </div>
    </Modal>
  );
}
