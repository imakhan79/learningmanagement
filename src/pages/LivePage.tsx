import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Users,
  ExternalLink,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Film,
  ChevronRight,
  Edit2,
  Bell,
  Play,
  Link2,
  UserCheck,
  Radio,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  createLiveSession,
  getUpcomingLiveSessions,
  getPastLiveSessions,
  joinLiveSession,
  leaveLiveSession,
  deleteLiveSession,
  getSessionAttendance,
  updateLiveSession,
  getSessionRecordings,
  addSessionRecording,
  deleteSessionRecording,
  getEnrolledUsersForCourse,
  scheduleSessionReminders,
  type LiveSession,
  type LiveSessionRecording,
} from '../lib/liveStreaming';
import { Spinner, Badge, formatDateTime, formatDuration } from '../components/ui';

type Tab = 'upcoming' | 'past';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function courseTitle(s: any): string {
  const c = s.course;
  if (!c) return '';
  return Array.isArray(c) ? (c[0]?.title ?? '') : (c.title ?? '');
}

function instructorName(s: any): string {
  const i = s.instructor;
  if (!i) return '';
  return Array.isArray(i) ? (i[0]?.full_name ?? '') : (i.full_name ?? '');
}

function getStatus(s: any): 'live' | 'upcoming' | 'ended' {
  const now = new Date();
  const start = new Date(s.start_at);
  const end = s.end_at ? new Date(s.end_at) : null;
  if (end && now > end) return 'ended';
  if (now >= start && (!end || now <= end)) return 'live';
  return 'upcoming';
}

const STATUS_CONFIG = {
  live:     { label: 'Live Now', color: 'green', dot: true },
  upcoming: { label: 'Upcoming', color: 'blue',  dot: false },
  ended:    { label: 'Ended',    color: 'slate', dot: false },
};

export default function LivePage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const canManage = role === 'professor' || role === 'admin';

  // ── Data state ──
  const [tab, setTab] = useState<Tab>('upcoming');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);

  // ── Active session state ──
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [realtimeCount, setRealtimeCount] = useState(0);
  const channelRef = useRef<any>(null);

  // ── Detail panel ──
  const [detailSession, setDetailSession] = useState<any | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<LiveSessionRecording[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newRecordingUrl, setNewRecordingUrl] = useState('');
  const [addingRecording, setAddingRecording] = useState(false);
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  // ── Create modal ──
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    course_id: '',
    start_at: '',
    end_at: '',
    provider: 'free' as 'free' | 'paid',
    join_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Edit modal ──
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<LiveSession>>({});
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ── Load data ──
  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const fn = tab === 'upcoming' ? getUpcomingLiveSessions : getPastLiveSessions;
    const { data } = await fn(profile.id, role);
    setSessions(data || []);

    if (canManage) {
      const query = role === 'professor'
        ? supabase.from('courses').select('id, title').eq('instructor_id', profile.id)
        : supabase.from('courses').select('id, title');
      const { data: c } = await query;
      setCourses(c || []);
    }
    setLoading(false);
  }, [profile, role, tab, canManage]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime attendee count while in a session ──
  useEffect(() => {
    if (!activeSession) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      setRealtimeCount(0);
      return;
    }
    const ch = supabase
      .channel(`live_attendance:${activeSession.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_attendance',
        filter: `session_id=eq.${activeSession.id}`,
      }, async () => {
        const { count } = await supabase
          .from('live_attendance')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', activeSession.id)
          .is('left_at', null);
        setRealtimeCount(count || 0);
      })
      .subscribe();

    // Initial count
    supabase
      .from('live_attendance')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', activeSession.id)
      .is('left_at', null)
      .then(({ count }) => setRealtimeCount(count || 0));

    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [activeSession?.id]);

  // ── Detail panel helpers ──
  async function openDetail(s: any) {
    setDetailSession(s);
    setDetailLoading(true);
    setReminderSent(false);
    setNewRecordingUrl('');
    const [{ data: att }, { data: rec }] = await Promise.all([
      getSessionAttendance(s.id),
      getSessionRecordings(s.id),
    ]);
    setAttendees(att || []);
    setRecordings((rec || []) as LiveSessionRecording[]);
    setDetailLoading(false);
  }

  function closeDetail() {
    setDetailSession(null);
    setAttendees([]);
    setRecordings([]);
  }

  // ── Join / Leave ──
  async function handleJoin(s: any) {
    const { data } = await joinLiveSession(s.id, profile!.id);
    if (data) setAttendanceId(data.id);
    if (s.join_url) window.open(s.join_url, '_blank');
    setActiveSession(s);
  }

  async function handleLeave() {
    if (attendanceId) await leaveLiveSession(attendanceId);
    setAttendanceId(null);
    setActiveSession(null);
    load();
  }

  // ── Create ──
  async function handleCreate() {
    if (!form.title || !form.course_id || !form.start_at) {
      setFormError('Title, course, and start time are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    const { error: e } = await createLiveSession({
      ...form,
      instructor_id: profile!.id,
      join_url: form.provider === 'paid' ? form.join_url : undefined,
    });
    setSaving(false);
    if (e) { setFormError(e.message); return; }
    setShowCreate(false);
    setForm({ title: '', description: '', course_id: '', start_at: '', end_at: '', provider: 'free', join_url: '' });
    load();
  }

  // ── Edit ──
  function openEdit(s: any) {
    setEditForm({
      title: s.title,
      description: s.description ?? '',
      start_at: s.start_at?.slice(0, 16), // datetime-local format
      end_at: s.end_at?.slice(0, 16) ?? '',
      join_url: s.join_url ?? '',
    });
    setDetailSession(s); // keep detail context
    setShowEdit(true);
    setEditError('');
  }

  async function handleEdit() {
    if (!detailSession) return;
    if (!editForm.title || !editForm.start_at) {
      setEditError('Title and start time are required.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    const { error: e } = await updateLiveSession(detailSession.id, editForm);
    setEditSaving(false);
    if (e) { setEditError(e.message); return; }
    setShowEdit(false);
    load();
    openDetail({ ...detailSession, ...editForm });
  }

  // ── Delete ──
  async function handleDelete(id: string) {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    await deleteLiveSession(id);
    closeDetail();
    load();
  }

  // ── Recordings ──
  async function handleAddRecording() {
    if (!detailSession || !newRecordingUrl.trim()) return;
    setAddingRecording(true);
    const { data } = await addSessionRecording(detailSession.id, newRecordingUrl.trim());
    if (data) {
      setRecordings((prev) => [...prev, data as LiveSessionRecording]);
      setNewRecordingUrl('');
    }
    setAddingRecording(false);
  }

  async function handleDeleteRecording(id: string) {
    await deleteSessionRecording(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }

  // ── Send Reminders ──
  async function handleSendReminders() {
    if (!detailSession) return;
    setReminderSending(true);
    const userIds = await getEnrolledUsersForCourse(detailSession.course_id);
    if (userIds.length > 0) {
      await scheduleSessionReminders(detailSession as LiveSession, userIds);
    }
    setReminderSending(false);
    setReminderSent(true);
  }

  if (loading) return <Spinner />;

  const status = detailSession ? getStatus(detailSession) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30">
            <Video size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Live Sessions</h1>
            <p className="text-sm text-slate-500">Real-time virtual classes and webinars</p>
          </div>
        </div>
        {canManage && (
          <button
            id="btn-schedule-session"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-md shadow-rose-500/25"
          >
            <Plus size={16} /> Schedule Session
          </button>
        )}
      </div>

      {/* ── Active Session Banner ── */}
      {activeSession && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <Radio size={20} className="animate-pulse" />
            <div>
              <p className="font-semibold">You're in: {activeSession.title}</p>
              <p className="text-sm opacity-80">
                {realtimeCount} participant{realtimeCount !== 1 ? 's' : ''} online
              </p>
            </div>
          </div>
          <button
            onClick={handleLeave}
            className="flex items-center gap-2 px-4 py-2 bg-white text-green-700 rounded-xl font-medium text-sm hover:bg-green-50 transition-colors"
          >
            <X size={14} /> Leave Session
          </button>
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(['upcoming', 'past'] as Tab[]).map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 capitalize ${
              tab === t
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Sessions Grid ── */}
      {sessions.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Video size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold text-slate-500">No {tab} sessions</p>
          <p className="text-sm mt-1">
            {tab === 'upcoming'
              ? 'Sessions you schedule or are enrolled in will appear here'
              : 'Past sessions you attended or hosted will show here'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => {
            const st = getStatus(s);
            const cfg = STATUS_CONFIG[st];
            const ct = courseTitle(s);
            const name = instructorName(s);
            return (
              <div
                key={s.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => openDetail(s)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h2 className="text-base font-semibold text-slate-800 truncate">{s.title}</h2>
                      <Badge color={cfg.color}>
                        {cfg.dot && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1" />
                        )}
                        {cfg.label}
                      </Badge>
                      <Badge color={s.provider === 'free' ? 'slate' : 'purple'}>
                        {s.provider === 'free' ? '🆓 Jitsi' : '💳 Paid'}
                      </Badge>
                    </div>
                    {s.description && (
                      <p className="text-sm text-slate-500 mb-2 line-clamp-1">{s.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      {ct && (
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {ct}
                        </span>
                      )}
                      {name && (
                        <span className="flex items-center gap-1">
                          <UserCheck size={12} /> {name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {new Date(s.start_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(s.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {s.end_at && ` – ${new Date(s.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.join_url && st !== 'ended' && (
                      <button
                        id={`btn-join-${s.id}`}
                        onClick={(e) => { e.stopPropagation(); handleJoin(s); }}
                        className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        <ExternalLink size={14} /> Join
                      </button>
                    )}
                    <ChevronRight
                      size={18}
                      className="text-slate-300 group-hover:text-slate-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          DETAIL SLIDE-OVER
      ═══════════════════════════════════════════ */}
      {detailSession && !showEdit && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={closeDetail}
          />
          {/* Panel */}
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-pink-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-100 rounded-lg">
                  <Video size={16} className="text-rose-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm leading-tight line-clamp-1">{detailSession.title}</p>
                  {status && (
                    <Badge color={STATUS_CONFIG[status].color}>
                      {STATUS_CONFIG[status].dot && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1" />
                      )}
                      {STATUS_CONFIG[status].label}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canManage && (
                  <button
                    id="btn-edit-session"
                    onClick={() => openEdit(detailSession)}
                    className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-colors"
                    title="Edit session"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                {canManage && (
                  <button
                    id="btn-delete-session"
                    onClick={() => handleDelete(detailSession.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-colors"
                    title="Delete session"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button onClick={closeDetail} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {detailLoading ? (
                <Spinner />
              ) : (
                <>
                  {/* Info */}
                  <div className="space-y-3">
                    {detailSession.description && (
                      <p className="text-sm text-slate-600 leading-relaxed">{detailSession.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-400 font-medium mb-1">Start</p>
                        <p className="text-sm font-semibold text-slate-700">{formatDateTime(detailSession.start_at)}</p>
                      </div>
                      {detailSession.end_at && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-xs text-slate-400 font-medium mb-1">End</p>
                          <p className="text-sm font-semibold text-slate-700">{formatDateTime(detailSession.end_at)}</p>
                        </div>
                      )}
                      {courseTitle(detailSession) && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-xs text-slate-400 font-medium mb-1">Course</p>
                          <p className="text-sm font-semibold text-slate-700">{courseTitle(detailSession)}</p>
                        </div>
                      )}
                      {instructorName(detailSession) && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-xs text-slate-400 font-medium mb-1">Instructor</p>
                          <p className="text-sm font-semibold text-slate-700">{instructorName(detailSession)}</p>
                        </div>
                      )}
                    </div>

                    {detailSession.join_url && (
                      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl">
                        <Link2 size={15} className="text-green-600 shrink-0" />
                        <a
                          href={detailSession.join_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 text-sm font-medium truncate hover:underline flex-1"
                        >
                          {detailSession.join_url}
                        </a>
                        {getStatus(detailSession) !== 'ended' && (
                          <button
                            id="btn-join-detail"
                            onClick={() => handleJoin(detailSession)}
                            className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
                          >
                            <Play size={12} /> Join
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Reminders */}
                  {canManage && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Reminders</h3>
                      <button
                        id="btn-send-reminders"
                        onClick={handleSendReminders}
                        disabled={reminderSending || reminderSent}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-amber-300 text-amber-700 bg-amber-50 rounded-xl text-sm font-medium hover:bg-amber-100 disabled:opacity-60 transition-colors"
                      >
                        {reminderSent ? (
                          <><CheckCircle2 size={16} className="text-green-600" /> Reminders Sent!</>
                        ) : (
                          <><Bell size={16} /> {reminderSending ? 'Sending...' : 'Send Reminder to All Enrolled Students'}</>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Attendees */}
                  {(canManage || role === 'student') && attendees.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Users size={13} /> Attendees ({attendees.length})
                      </h3>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {attendees.map((a: any) => {
                          const u = Array.isArray(a.user) ? a.user[0] : a.user;
                          return (
                            <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
                              <div>
                                <p className="text-sm font-medium text-slate-700">{u?.full_name || u?.email || 'Unknown'}</p>
                                <p className="text-xs text-slate-400">
                                  Joined {new Date(a.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {a.left_at && ` · Left ${new Date(a.left_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </p>
                              </div>
                              {a.duration_seconds && (
                                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                  {formatDuration(a.duration_seconds)}
                                </span>
                              )}
                              {!a.left_at && (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                  Online
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recordings */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Film size={13} /> Recordings ({recordings.length})
                    </h3>

                    {recordings.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No recordings added yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {recordings.map((r) => (
                          <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl group/rec">
                            <Play size={14} className="text-rose-500 shrink-0" />
                            <a
                              href={r.recording_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-sm text-blue-600 hover:underline truncate"
                            >
                              {r.recording_url}
                            </a>
                            {r.duration_seconds && (
                              <span className="text-xs text-slate-400 shrink-0">{formatDuration(r.duration_seconds)}</span>
                            )}
                            {canManage && (
                              <button
                                onClick={() => handleDeleteRecording(r.id)}
                                className="opacity-0 group-hover/rec:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {canManage && (
                      <div className="mt-3 flex gap-2">
                        <input
                          id="input-recording-url"
                          type="url"
                          value={newRecordingUrl}
                          onChange={(e) => setNewRecordingUrl(e.target.value)}
                          placeholder="https://recording-url..."
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddRecording()}
                        />
                        <button
                          id="btn-add-recording"
                          onClick={handleAddRecording}
                          disabled={addingRecording || !newRecordingUrl.trim()}
                          className="px-3 py-2 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          EDIT MODAL
      ═══════════════════════════════════════════ */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Edit Session</h2>
              <button onClick={() => setShowEdit(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {editError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                  <AlertCircle size={16} /> {editError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Session Title *</label>
                <input
                  id="edit-title"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  value={editForm.title ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  id="edit-description"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                  rows={2}
                  value={editForm.description ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time *</label>
                  <input
                    id="edit-start-at"
                    type="datetime-local"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    value={editForm.start_at ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, start_at: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                  <input
                    id="edit-end-at"
                    type="datetime-local"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    value={editForm.end_at ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, end_at: e.target.value })}
                  />
                </div>
              </div>
              {detailSession?.provider === 'paid' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Join URL</label>
                  <input
                    id="edit-join-url"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    value={editForm.join_url ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, join_url: e.target.value })}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                Cancel
              </button>
              <button
                id="btn-save-edit"
                onClick={handleEdit}
                disabled={editSaving}
                className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          CREATE MODAL
      ═══════════════════════════════════════════ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-slate-800">Schedule Live Session</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Session Title *</label>
                <input
                  id="create-title"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Week 4 Lecture"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  id="create-description"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional session description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course *</label>
                <select
                  id="create-course"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  value={form.course_id}
                  onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                >
                  <option value="">Select a course...</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time *</label>
                  <input
                    id="create-start-at"
                    type="datetime-local"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    value={form.start_at}
                    onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                  <input
                    id="create-end-at"
                    type="datetime-local"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    value={form.end_at}
                    onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['free', 'paid'] as const).map((p) => (
                    <button
                      key={p}
                      id={`provider-${p}`}
                      onClick={() => setForm({ ...form, provider: p })}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                        form.provider === p
                          ? 'border-rose-400 bg-rose-50 text-rose-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {p === 'free' ? '🆓 Jitsi Meet (Free)' : '💳 Paid Provider'}
                    </button>
                  ))}
                </div>
              </div>
              {form.provider === 'paid' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Join URL (from provider)</label>
                  <input
                    id="create-join-url"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    value={form.join_url}
                    onChange={(e) => setForm({ ...form, join_url: e.target.value })}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              )}
              {form.provider === 'free' && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-sm flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>A unique Jitsi Meet room will be auto-generated for this session. No account required.</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                id="btn-create-session"
                onClick={handleCreate}
                disabled={saving}
                className="px-5 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving...' : 'Create Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
