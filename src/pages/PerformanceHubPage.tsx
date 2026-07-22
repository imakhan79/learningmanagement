import { useEffect, useState } from 'react';
import {
  Target, AlertTriangle, CheckCircle2, Pencil, Trash2, Plus, Shield, GraduationCap, Users,
} from 'lucide-react';
import { supabase, KpiConfig, KpiSnapshot } from '../lib/supabase';
import { StatCard, ChartCard } from '../components/charts';
import { Button, Input, Select, Textarea, Badge, Spinner, EmptyState, Modal, ProgressBar } from '../components/ui';

type Role = 'admin' | 'professor' | 'student';

const METRIC_OPTIONS: Record<Role, { value: string; label: string }[]> = {
  admin: [
    { value: 'courses_approved', label: 'Courses Approved/Published' },
    { value: 'certificates_issued', label: 'Certificates Issued' },
    { value: 'new_users_onboarded', label: 'New Users Onboarded' },
  ],
  professor: [
    { value: 'lectures_created', label: 'Lectures Created' },
    { value: 'courses_created', label: 'Courses Created' },
    { value: 'lecture_completion_rate', label: 'Lecture Completion Rate' },
    { value: 'student_engagement', label: 'Student Engagement (min)' },
    { value: 'quiz_creation', label: 'Quizzes Created' },
    { value: 'assignment_upload', label: 'Worksheets Uploaded' },
    { value: 'course_updates', label: 'Course Updates' },
  ],
  student: [
    { value: 'watch_time_pct', label: 'Avg Watch Completion %' },
    { value: 'course_completion_days', label: 'Avg Course Completion (days)' },
  ],
};

const TABS = [
  { id: 'admin', label: 'Admin Performance', icon: <Shield size={16} /> },
  { id: 'professor', label: 'Professor Performance', icon: <GraduationCap size={16} /> },
  { id: 'student', label: 'Student Performance', icon: <Users size={16} /> },
  { id: 'setup', label: 'KPI Setup', icon: <Target size={16} /> },
] as const;

type TabId = typeof TABS[number]['id'];

export default function PerformanceHubPage() {
  const [activeTab, setActiveTab] = useState<TabId>('admin');
  const [configs, setConfigs] = useState<KpiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KpiConfig | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<KpiConfig | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('kpi_configs').select('*').order('created_at', { ascending: false });
    setConfigs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteConfig = async (id: string) => {
    await supabase.from('kpi_snapshots').delete().eq('kpi_config_id', id);
    await supabase.from('kpi_configs').delete().eq('id', id);
    setConfirmDelete(null);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Performance Hub</h1>
          <p className="text-slate-500 font-medium">Role-wide KPI performance and configuration</p>
        </div>
        <Button variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={16} /> Setup KPI
        </Button>
      </div>

      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 w-fit overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'admin' && <PerformanceTab role="admin" configs={configs.filter((c) => c.role === 'admin')} />}
      {activeTab === 'professor' && <PerformanceTab role="professor" configs={configs.filter((c) => c.role === 'professor')} />}
      {activeTab === 'student' && <PerformanceTab role="student" configs={configs.filter((c) => c.role === 'student')} />}

      {activeTab === 'setup' && (
        <ChartCard title="KPI Configurations">
          <div className="space-y-2.5 pt-2">
            {configs.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                  <Target size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">{c.description || `${c.metric_key} · ${c.period}`}</p>
                </div>
                <Badge color="violet">{c.role}</Badge>
                <Badge color={c.active ? 'success' : 'slate'}>{c.active ? 'active' : 'inactive'}</Badge>
                <span className="text-xs font-bold text-slate-500 shrink-0">{c.comparison} {c.target_value} {c.unit}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setShowForm(true); }}><Pencil size={13} /></Button>
                  <Button size="sm" variant="ghost" className="hover:text-danger-600" onClick={() => setConfirmDelete(c)}><Trash2 size={13} /></Button>
                </div>
              </div>
            ))}
            {configs.length === 0 && <EmptyState icon={<Target size={24} />} title="No KPIs configured" description="Set up a KPI to start tracking performance." />}
          </div>
        </ChartCard>
      )}

      {showForm && (
        <KpiFormModal
          config={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} title="Delete KPI" maxW="max-w-sm">
          <div className="p-6 pt-2 space-y-5">
            <p className="text-sm text-slate-600">Delete <span className="font-bold text-slate-800">{confirmDelete.name}</span> and all its recorded snapshots? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => deleteConfig(confirmDelete.id)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PerformanceTab({ role, configs }: { role: Role; configs: KpiConfig[] }) {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<(KpiSnapshot & { userName: string })[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: users } = await supabase.from('profiles').select('id, full_name').eq('role', role);
      const userMap: Record<string, string> = {};
      (users || []).forEach((u: any) => { userMap[u.id] = u.full_name; });
      const userIds = (users || []).map((u: any) => u.id);
      const configIds = configs.map((c) => c.id);
      if (!userIds.length || !configIds.length) { setSnapshots([]); setLoading(false); return; }
      const { data } = await supabase
        .from('kpi_snapshots')
        .select('*')
        .in('user_id', userIds)
        .in('kpi_config_id', configIds)
        .order('computed_at', { ascending: false });
      setSnapshots((data || []).map((s: any) => ({ ...s, userName: userMap[s.user_id] || 'Unknown' })));
      setLoading(false);
    })();
  }, [role, configs.map((c) => c.id).join(',')]);

  if (loading) return <Spinner />;
  if (configs.length === 0) return <EmptyState icon={<Target size={24} />} title={`No ${role} KPIs configured`} description="Use Setup KPI to add one." />;

  return (
    <div className="space-y-5">
      {configs.map((cfg) => {
        const rows = snapshots.filter((s) => s.kpi_config_id === cfg.id);
        // latest snapshot per user
        const latestByUser = new Map<string, KpiSnapshot & { userName: string }>();
        rows.forEach((r) => { if (!latestByUser.has(r.user_id)) latestByUser.set(r.user_id, r); });
        const latest = [...latestByUser.values()];
        const avg = latest.length ? Math.round((latest.reduce((s, r) => s + r.actual_value, 0) / latest.length) * 10) / 10 : 0;
        const onTrack = latest.filter((r) => r.status === 'on_track').length;
        const flagged = latest.filter((r) => r.status !== 'on_track').sort((a, b) => a.actual_value - b.actual_value);

        return (
          <ChartCard key={cfg.id} title={cfg.name}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 mb-4">
              <StatCard label="Org Average" value={`${avg} ${cfg.unit}`} icon={<Target size={20} />} color="violet" />
              <StatCard label="On Track" value={`${onTrack}/${latest.length || 0}`} icon={<CheckCircle2 size={20} />} color="emerald" />
              <StatCard label="Target" value={`${cfg.comparison} ${cfg.target_value} ${cfg.unit}`} icon={<AlertTriangle size={20} />} color="amber" />
            </div>
            {latest.length === 0 ? (
              <p className="text-sm font-medium text-slate-400 text-center py-6">No snapshots computed yet</p>
            ) : (
              <div className="space-y-2">
                {flagged.map((r) => {
                  const pct = cfg.target_value ? Math.min(100, (r.actual_value / cfg.target_value) * 100) : 100;
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{r.userName}</p>
                        <ProgressBar value={pct} color={r.status === 'critical' ? 'danger' : 'warning'} size="sm" />
                      </div>
                      <Badge color={r.status === 'critical' ? 'danger' : 'amber'}>{r.actual_value} {cfg.unit}</Badge>
                    </div>
                  );
                })}
                {flagged.length === 0 && <p className="text-sm font-semibold text-success-600 text-center py-4">Everyone is on track</p>}
              </div>
            )}
          </ChartCard>
        );
      })}
    </div>
  );
}

function KpiFormModal({ config, onClose, onSaved }: { config: KpiConfig | null; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<Role>(config?.role || 'admin');
  const [name, setName] = useState(config?.name || '');
  const [metricKey, setMetricKey] = useState(config?.metric_key || METRIC_OPTIONS[config?.role || 'admin'][0].value);
  const [targetValue, setTargetValue] = useState(String(config?.target_value ?? 1));
  const [comparison, setComparison] = useState(config?.comparison || 'gte');
  const [period, setPeriod] = useState(config?.period || 'monthly');
  const [unit, setUnit] = useState(config?.unit || '');
  const [description, setDescription] = useState(config?.description || '');
  const [active, setActive] = useState(config?.active ?? true);
  const [saving, setSaving] = useState(false);

  const changeRole = (r: Role) => { setRole(r); setMetricKey(METRIC_OPTIONS[r][0].value); };

  const save = async () => {
    setSaving(true);
    const payload = {
      role, name, metric_key: metricKey,
      target_value: parseFloat(targetValue) || 0,
      comparison, period, unit, description, active,
    };
    if (config) await supabase.from('kpi_configs').update(payload).eq('id', config.id);
    else await supabase.from('kpi_configs').insert(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={config ? 'Edit KPI' : 'Setup New KPI'} maxW="max-w-lg">
      <div className="space-y-5 p-6 pt-2 max-h-[75vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Role</label>
            <Select value={role} onChange={(e) => changeRole(e.target.value as Role)} disabled={!!config}>
              <option value="admin">Admin</option>
              <option value="professor">Professor</option>
              <option value="student">Student</option>
            </Select>
          </div>
          <div>
            <label className="label">Metric</label>
            <Select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
              {METRIC_OPTIONS[role].map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <label className="label">KPI Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly Course Approvals" />
        </div>
        <div>
          <label className="label">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional context for this KPI..." />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Comparison</label>
            <Select value={comparison} onChange={(e) => setComparison(e.target.value as any)}>
              <option value="gte">At least (≥)</option>
              <option value="lte">At most (≤)</option>
              <option value="eq">Exactly (=)</option>
            </Select>
          </div>
          <div>
            <label className="label">Target</label>
            <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </div>
          <div>
            <label className="label">Unit</label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. %, days" />
          </div>
        </div>
        <div>
          <label className="label">Period</label>
          <Select value={period} onChange={(e) => setPeriod(e.target.value as any)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary-600" />
          Active
        </label>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !name}>{saving ? 'Saving...' : 'Save KPI'}</Button>
        </div>
      </div>
    </Modal>
  );
}
