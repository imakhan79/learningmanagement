import { useEffect, useMemo, useState } from 'react';
import {
  Radio, Video, Film, PlayCircle, ExternalLink, Search, Plus, Trash2, Pencil,
  Clock, Calendar as CalendarIcon, KeyRound, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  createLiveSession, updateLiveSession, deleteLiveSession,
  getUpcomingLiveSessions, getPastLiveSessions,
  getProviderSettings, saveProviderSetting, MeetingProviderSetting,
} from '../lib/liveStreaming';
import { ChartCard } from '../components/charts';
import { Button, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal, formatDate, formatDateTime, formatDuration } from '../components/ui';

interface CourseOption { id: string; title: string; professor_id: string; professorName: string; }

const TABS = [
  { id: 'live', label: 'Live Sessions', icon: <Radio size={16} /> },
  { id: 'lectures', label: 'Recorded Lectures', icon: <Film size={16} /> },
  { id: 'providers', label: 'Provider Settings', icon: <KeyRound size={16} /> },
] as const;

const PROVIDERS: { id: 'zoom' | 'google_meet' | 'teams'; name: string; keyLabel: string; secretLabel: string }[] = [
  { id: 'zoom', name: 'Zoom', keyLabel: 'API Key', secretLabel: 'API Secret' },
  { id: 'google_meet', name: 'Google Meet', keyLabel: 'OAuth Client ID', secretLabel: 'OAuth Client Secret' },
  { id: 'teams', name: 'Microsoft Teams', keyLabel: 'OAuth Client ID', secretLabel: 'OAuth Client Secret' },
];

type TabId = typeof TABS[number]['id'];

function toInputDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromInputDateTime(val: string): string | undefined {
  return val ? new Date(val).toISOString() : undefined;
}

function sessionStatus(s: any): 'live' | 'upcoming' | 'ended' {
  const now = new Date();
  const start = new Date(s.start_at);
  const end = s.end_at ? new Date(s.end_at) : null;
  if (end && now > end) return 'ended';
  if (now >= start && (!end || now <= end)) return 'live';
  return 'upcoming';
}
const STATUS_COLOR: Record<string, string> = { live: 'success', upcoming: 'blue', ended: 'slate' };

export default function LearningHubPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('live');
  const [courses, setCourses] = useState<CourseOption[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('courses').select('id, title, professor_id, professor:profiles!courses_professor_id_fkey(full_name)').order('title', { ascending: true });
      setCourses((data || []).map((c: any) => ({ id: c.id, title: c.title, professor_id: c.professor_id, professorName: c.professor?.full_name || 'Unassigned' })));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Learning Hub</h1>
        <p className="text-slate-500 font-medium">Live session scheduling and the recorded lecture library</p>
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

      {activeTab === 'live' && <LiveSessionsTab courses={courses} adminId={profile!.id} />}
      {activeTab === 'lectures' && <RecordedLecturesTab courses={courses} />}
      {activeTab === 'providers' && <ProviderSettingsTab adminId={profile!.id} />}
    </div>
  );
}

function LiveSessionsTab({ courses, adminId }: { courses: CourseOption[]; adminId: string }) {
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const fn = view === 'upcoming' ? getUpcomingLiveSessions : getPastLiveSessions;
    const { data } = await fn(adminId, 'admin');
    setSessions(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [view]);

  const deleteSession = async (id: string) => {
    await deleteLiveSession(id);
    setConfirmDelete(null);
    load();
  };

  return (
    <ChartCard
      title="Live Sessions"
      action={
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {(['upcoming', 'past'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${view === v ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}>
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={14} /> Setup Session
          </Button>
        </div>
      }
    >
      {loading ? <Spinner /> : (
        <div className="space-y-2.5 pt-2">
          {sessions.map((s) => {
            const status = sessionStatus(s);
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Video size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{s.title}</p>
                  <p className="text-xs text-slate-500 truncate">{s.course?.title || 'Unknown'} &middot; {s.instructor?.full_name || 'Unassigned'}</p>
                </div>
                <Badge color={STATUS_COLOR[status]} dot={status === 'live'}>{status}</Badge>
                <span className="text-xs font-bold text-slate-500 shrink-0">{formatDateTime(s.start_at)}</span>
                {s.join_url && (
                  <a href={s.join_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button size="sm" variant="outline"><ExternalLink size={12} /> Join</Button>
                  </a>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setShowForm(true); }}><Pencil size={13} /></Button>
                  <Button size="sm" variant="ghost" className="hover:text-danger-600" onClick={() => setConfirmDelete(s)}><Trash2 size={13} /></Button>
                </div>
              </div>
            );
          })}
          {sessions.length === 0 && <EmptyState icon={<Radio size={24} />} title={`No ${view} sessions`} />}
        </div>
      )}

      {showForm && (
        <SessionFormModal
          session={editing}
          courses={courses}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} title="Delete Live Session" maxW="max-w-sm">
          <div className="p-6 pt-2 space-y-5">
            <p className="text-sm text-slate-600">Delete <span className="font-bold text-slate-800">{confirmDelete.title}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => deleteSession(confirmDelete.id)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}
    </ChartCard>
  );
}

function SessionFormModal({ session, courses, onClose, onSaved }: {
  session: any | null; courses: CourseOption[]; onClose: () => void; onSaved: () => void;
}) {
  const [courseId, setCourseId] = useState(session?.course_id || courses[0]?.id || '');
  const [title, setTitle] = useState(session?.title || '');
  const [description, setDescription] = useState(session?.description || '');
  const [startAt, setStartAt] = useState(toInputDateTime(session?.start_at));
  const [endAt, setEndAt] = useState(toInputDateTime(session?.end_at));
  const [provider, setProvider] = useState<'free' | 'paid'>(session?.provider === 'paid' ? 'paid' : 'free');
  const [joinUrl, setJoinUrl] = useState(session?.join_url || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCourse = courses.find((c) => c.id === courseId);

  const save = async () => {
    if (!title || !courseId || !startAt) { setError('Title, course, and start time are required.'); return; }
    if (provider === 'paid' && !joinUrl) { setError('Join URL is required for a custom/paid provider.'); return; }
    setSaving(true);
    setError('');
    if (session) {
      const { error: e } = await updateLiveSession(session.id, {
        title, description, start_at: fromInputDateTime(startAt), end_at: fromInputDateTime(endAt),
        join_url: provider === 'paid' ? joinUrl : session.join_url,
      });
      setSaving(false);
      if (e) { setError(e.message); return; }
    } else {
      const { error: e } = await createLiveSession({
        course_id: courseId,
        instructor_id: selectedCourse!.professor_id,
        title, description,
        start_at: fromInputDateTime(startAt)!,
        end_at: fromInputDateTime(endAt),
        provider,
        join_url: provider === 'paid' ? joinUrl : undefined,
      });
      setSaving(false);
      if (e) { setError(e.message); return; }
    }
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={session ? 'Edit Live Session' : 'Setup & Schedule Live Session'} maxW="max-w-lg">
      <div className="space-y-5 p-6 pt-2 max-h-[75vh] overflow-y-auto">
        <div>
          <label className="label">Course</label>
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!!session}>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
          {selectedCourse && <p className="text-xs text-slate-400 mt-1">Instructor: {selectedCourse.professorName}</p>}
        </div>
        <div>
          <label className="label">Session Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 5 Live Q&A" />
        </div>
        <div>
          <label className="label">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional details for this session..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start</label>
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div>
            <label className="label">End</label>
            <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
        </div>
        {!session && (
          <div>
            <label className="label">Provider</label>
            <Select value={provider} onChange={(e) => setProvider(e.target.value as any)}>
              <option value="free">Free (Jitsi Meet, auto-generated)</option>
              <option value="paid">Custom / Paid Provider (manual join link)</option>
            </Select>
          </div>
        )}
        {provider === 'paid' && (
          <div>
            <label className="label">Join URL</label>
            <Input value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} placeholder="https://..." />
          </div>
        )}
        {error && <p className="text-sm font-semibold text-danger-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Session'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function RecordedLecturesTab({ courses }: { courses: CourseOption[] }) {
  const [loading, setLoading] = useState(true);
  const [lectures, setLectures] = useState<any[]>([]);
  const [recordingMap, setRecordingMap] = useState<Record<string, string>>({});
  const [courseFilter, setCourseFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('lectures').select('*, course:courses(title)').order('publish_date', { ascending: false });
      const list = data || [];
      setLectures(list);
      const ids = list.map((l: any) => l.id);
      if (ids.length) {
        const { data: mats } = await supabase.from('course_materials').select('lecture_id, url').eq('type', 'video').in('lecture_id', ids);
        const m: Record<string, string> = {};
        (mats || []).forEach((r: any) => { if (r.lecture_id) m[r.lecture_id] = r.url; });
        setRecordingMap(m);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = lectures.filter((l) => {
    if (courseFilter !== 'all' && l.course_id !== courseFilter) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <ChartCard
      title="Recorded Lectures"
      action={
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-56">
          <option value="all">All Courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
      }
    >
      <div className="relative mt-2 mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lectures by title..." className="pl-9" />
      </div>
      {loading ? <Spinner /> : (
        <div className="space-y-2.5">
          {filtered.map((l) => {
            const recordingUrl = recordingMap[l.id];
            return (
              <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <PlayCircle size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{l.title}</p>
                  <p className="text-xs text-slate-500 truncate">{l.course?.title || 'Unknown'}</p>
                </div>
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0"><Clock size={11} /> {formatDuration(l.duration_seconds || 0)}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 shrink-0"><CalendarIcon size={10} /> {formatDate(l.publish_date)}</span>
                {recordingUrl ? (
                  <a href={recordingUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Badge color="success">Recording Available</Badge>
                  </a>
                ) : (
                  <Badge color="slate">No Recording</Badge>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <EmptyState icon={<Film size={24} />} title="No lectures found" description="Try adjusting your filters." />}
        </div>
      )}
    </ChartCard>
  );
}

function ProviderSettingsTab({ adminId }: { adminId: string }) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, MeetingProviderSetting>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await getProviderSettings();
    const m: Record<string, MeetingProviderSetting> = {};
    (data || []).forEach((s: any) => { m[s.provider] = s; });
    setSettings(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Spinner />;

  return (
    <ChartCard title="Meeting Provider API Keys">
      <p className="text-sm text-slate-500 mb-4">
        Store credentials for premium providers here. Sessions still use a manually-pasted join link — a configured provider is marked "Connected" for professors when scheduling.
      </p>
      <div className="space-y-4">
        {PROVIDERS.map((p) => (
          <ProviderRow key={p.id} provider={p} setting={settings[p.id]} adminId={adminId} onSaved={load} />
        ))}
      </div>
    </ChartCard>
  );
}

function ProviderRow({ provider, setting, adminId, onSaved }: {
  provider: { id: 'zoom' | 'google_meet' | 'teams'; name: string; keyLabel: string; secretLabel: string };
  setting?: MeetingProviderSetting;
  adminId: string;
  onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState(setting?.api_key || '');
  const [apiSecret, setApiSecret] = useState(setting?.api_secret || '');
  const [saving, setSaving] = useState(false);
  const connected = !!setting?.api_key;

  const save = async () => {
    setSaving(true);
    await saveProviderSetting(provider.id, apiKey, apiSecret, adminId);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="p-4 rounded-xl border border-slate-100 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700">{provider.name}</p>
        {connected ? <Badge color="success"><CheckCircle2 size={11} /> Connected</Badge> : <Badge color="slate">Not Configured</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider.keyLabel} type="password" />
        <Input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder={provider.secretLabel} type="password" />
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="gradient" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </div>
  );
}
