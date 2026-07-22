import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, ClipboardList, Archive, RotateCcw, Pencil, Plus, Users,
  Award, ScrollText, Search, X, Landmark, ShieldCheck, TrendingUp, Mail,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, Exam } from '../lib/supabase';
import { StatCard, ChartCard } from '../components/charts';
import { Button, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal, Avatar, formatDate, formatDateTime } from '../components/ui';

interface ExamRow extends Exam {
  courseName: string;
  professorName: string;
  questionCount: number;
  registeredCount: number;
}

interface CourseOption { id: string; title: string; }

const TABS = [
  { id: 'calendar', label: 'Calendar', icon: <CalendarClock size={16} /> },
  { id: 'manage', label: 'Setup & Manage', icon: <ClipboardList size={16} /> },
  { id: 'registration', label: 'Registration', icon: <Users size={16} /> },
  { id: 'results', label: 'Results', icon: <ScrollText size={16} /> },
  { id: 'certificates', label: 'Certificates', icon: <Award size={16} /> },
] as const;

type TabId = typeof TABS[number]['id'];

function toInputDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromInputDateTime(val: string): string | null {
  return val ? new Date(val).toISOString() : null;
}

const STATUS_COLOR: Record<string, string> = { draft: 'amber', published: 'success', closed: 'blue', archived: 'slate' };

export default function ExamsHubPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('calendar');
  const [calendarView, setCalendarView] = useState<'upcoming' | 'past'>('upcoming');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExamRow | null>(null);
  const [questionsExam, setQuestionsExam] = useState<ExamRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [examsRes, coursesRes] = await Promise.all([
      supabase.from('exams').select('*, course:courses(title, professor:profiles!courses_professor_id_fkey(full_name))').order('created_at', { ascending: false }),
      supabase.from('courses').select('id, title').order('title', { ascending: true }),
    ]);
    const list = (examsRes.data || []) as any[];
    const ids = list.map((e) => e.id);
    const [qRes, rRes] = await Promise.all([
      ids.length ? supabase.from('exam_questions').select('exam_id').in('exam_id', ids) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from('exam_registrations').select('exam_id').in('exam_id', ids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const qMap: Record<string, number> = {}; (qRes.data || []).forEach((q: any) => { qMap[q.exam_id] = (qMap[q.exam_id] || 0) + 1; });
    const rMap: Record<string, number> = {}; (rRes.data || []).forEach((r: any) => { rMap[r.exam_id] = (rMap[r.exam_id] || 0) + 1; });

    setExams(list.map((e) => ({
      ...e,
      courseName: e.course?.title || 'Unknown',
      professorName: e.course?.professor?.full_name || 'Unassigned',
      questionCount: qMap[e.id] || 0,
      registeredCount: rMap[e.id] || 0,
    })));
    setCourses(coursesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const nonArchived = useMemo(() => exams.filter((e) => e.status !== 'archived'), [exams]);
  const upcoming = useMemo(() => nonArchived
    .filter((e) => !e.scheduled_start || new Date(e.scheduled_start) >= new Date())
    .sort((a, b) => new Date(a.scheduled_start || a.created_at).getTime() - new Date(b.scheduled_start || b.created_at).getTime()), [nonArchived]);
  const past = useMemo(() => nonArchived
    .filter((e) => e.scheduled_start && new Date(e.scheduled_start) < new Date())
    .sort((a, b) => new Date(b.scheduled_start!).getTime() - new Date(a.scheduled_start!).getTime()), [nonArchived]);

  const setStatus = async (id: string, status: string) => {
    await supabase.from('exams').update({ status }).eq('id', id);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Exams Hub</h1>
          <p className="text-slate-500 font-medium">Schedule, register, grade, and certify across every exam</p>
        </div>
        <Button variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={16} /> New Exam
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

      {activeTab === 'calendar' && (
        <ChartCard
          title="Exam Calendar"
          action={
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              {(['upcoming', 'past'] as const).map((v) => (
                <button key={v} onClick={() => setCalendarView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${calendarView === v ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}>
                  {v}
                </button>
              ))}
            </div>
          }
        >
          <div className="space-y-2.5 pt-2">
            {(calendarView === 'upcoming' ? upcoming : past).map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <CalendarClock size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{e.title}</p>
                  <p className="text-xs text-slate-500 truncate">{e.courseName} &middot; {e.professorName}</p>
                </div>
                <Badge color={e.type === 'quiz' ? 'purple' : 'blue'}>{e.type}</Badge>
                <span className="text-xs font-bold text-slate-500 shrink-0">
                  {e.scheduled_start ? formatDateTime(e.scheduled_start) : 'Not scheduled'}
                </span>
              </div>
            ))}
            {(calendarView === 'upcoming' ? upcoming : past).length === 0 && (
              <EmptyState icon={<CalendarClock size={24} />} title={`No ${calendarView} exams`} />
            )}
          </div>
        </ChartCard>
      )}

      {activeTab === 'manage' && (
        <ChartCard title="All Exams">
          <div className="space-y-2.5 pt-2">
            {exams.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="w-9 h-9 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                  <ScrollText size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{e.title}</p>
                  <p className="text-xs text-slate-500 truncate">{e.courseName} &middot; {e.professorName} &middot; {e.questionCount} question{e.questionCount === 1 ? '' : 's'} &middot; {e.registeredCount} registered</p>
                </div>
                <Badge color={STATUS_COLOR[e.status]}>{e.status}</Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setShowForm(true); }}><Pencil size={13} /></Button>
                  <Button size="sm" variant="outline" onClick={() => setQuestionsExam(e)}>Questions</Button>
                  {e.status === 'archived' ? (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(e.id, 'draft')}><RotateCcw size={13} /> Enable</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(e.id, 'archived')}><Archive size={13} /></Button>
                  )}
                </div>
              </div>
            ))}
            {exams.length === 0 && <EmptyState icon={<ScrollText size={24} />} title="No exams yet" />}
          </div>
        </ChartCard>
      )}

      {activeTab === 'registration' && <RegistrationTab exams={nonArchived} profileId={profile!.id} />}
      {activeTab === 'results' && <ResultsTab exams={exams} />}
      {activeTab === 'certificates' && <CertificatesTab profileId={profile!.id} />}

      {showForm && (
        <ExamFormModal
          exam={editing}
          courses={courses}
          creatorId={profile!.id}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {questionsExam && (
        <QuestionPickerModal exam={questionsExam} onClose={() => { setQuestionsExam(null); load(); }} />
      )}
    </div>
  );
}

function ExamFormModal({ exam, courses, creatorId, onClose, onSaved }: {
  exam: ExamRow | null; courses: CourseOption[]; creatorId: string; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(exam?.title || '');
  const [type, setType] = useState(exam?.type || 'exam');
  const [courseId, setCourseId] = useState(exam?.course_id || courses[0]?.id || '');
  const [description, setDescription] = useState(exam?.description || '');
  const [duration, setDuration] = useState(String(exam?.duration_minutes ?? 60));
  const [passMarks, setPassMarks] = useState(String(exam?.pass_marks ?? 50));
  const [scheduledStart, setScheduledStart] = useState(toInputDateTime(exam?.scheduled_start));
  const [scheduledEnd, setScheduledEnd] = useState(toInputDateTime(exam?.scheduled_end));
  const [status, setStatus] = useState(exam?.status || 'draft');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const payload = {
      title, type, course_id: courseId, description,
      duration_minutes: parseInt(duration, 10) || 60,
      pass_marks: parseFloat(passMarks) || 50,
      scheduled_start: fromInputDateTime(scheduledStart),
      scheduled_end: fromInputDateTime(scheduledEnd),
      status,
    };
    if (exam) {
      await supabase.from('exams').update(payload).eq('id', exam.id);
    } else {
      await supabase.from('exams').insert({ ...payload, created_by: creatorId });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={exam ? 'Edit Exam' : 'Setup New Exam'} maxW="max-w-lg">
      <div className="space-y-5 p-6 pt-2 max-h-[75vh] overflow-y-auto">
        <div>
          <label className="label">Exam Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midterm Examination" required />
        </div>
        <div>
          <label className="label">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Instructions or scope for this exam..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Course</label>
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </div>
          <div>
            <label className="label">Type</label>
            <Select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="exam">Exam</option>
              <option value="quiz">Quiz</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Scheduled Start</label>
            <Input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
          </div>
          <div>
            <label className="label">Scheduled End</label>
            <Input type="datetime-local" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Duration (minutes)</label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <label className="label">Pass Marks (%)</label>
            <Input type="number" value={passMarks} onChange={(e) => setPassMarks(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !title || !courseId}>{saving ? 'Saving...' : 'Save Exam'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function QuestionPickerModal({ exam, onClose }: { exam: ExamRow; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const [poolRes, existingRes] = await Promise.all([
        supabase.from('question_bank').select('id, topic, question_text, difficulty, type, marks').eq('course_id', exam.course_id).eq('status', 'approved').order('topic', { ascending: true }),
        supabase.from('exam_questions').select('question_id').eq('exam_id', exam.id),
      ]);
      setPool(poolRes.data || []);
      setSelected(new Set((existingRes.data || []).map((r: any) => r.question_id)));
      setLoading(false);
    })();
  }, [exam.id, exam.course_id]);

  const toggle = async (qid: string) => {
    if (selected.has(qid)) {
      await supabase.from('exam_questions').delete().eq('exam_id', exam.id).eq('question_id', qid);
      setSelected((s) => { const n = new Set(s); n.delete(qid); return n; });
    } else {
      const nextOrder = selected.size;
      await supabase.from('exam_questions').insert({ exam_id: exam.id, question_id: qid, order_index: nextOrder });
      setSelected((s) => new Set(s).add(qid));
    }
  };

  const filtered = pool.filter((q) => !search.trim() || q.question_text.toLowerCase().includes(search.toLowerCase()) || q.topic.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal open onClose={onClose} title={`Select Questions — ${exam.title}`} maxW="max-w-2xl">
      <div className="p-6 pt-2">
        <p className="text-sm text-slate-500 mb-3">Approved questions from <span className="font-bold">{exam.courseName}</span>&apos;s question bank. {selected.size} selected.</p>
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by topic or question text..." className="pl-9" />
        </div>
        {loading ? <Spinner /> : (
          <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
            {filtered.map((q) => {
              const isSel = selected.has(q.id);
              return (
                <label key={q.id} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all ${isSel ? 'bg-primary-50 border-primary-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                  <input type="checkbox" checked={isSel} onChange={() => toggle(q.id)} className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 line-clamp-2">{q.question_text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge color="slate">{q.topic}</Badge>
                      <Badge color="amber">{q.difficulty}</Badge>
                      <span className="text-xs text-slate-400">{q.marks} marks</span>
                    </div>
                  </div>
                </label>
              );
            })}
            {filtered.length === 0 && <EmptyState icon={<ClipboardList size={24} />} title="No approved questions for this course" description="Add and approve questions in the Question Bank first." />}
          </div>
        )}
        <div className="flex justify-end pt-5 mt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}><X size={14} /> Done</Button>
        </div>
      </div>
    </Modal>
  );
}

function RegistrationTab({ exams, profileId }: { exams: ExamRow[]; profileId: string }) {
  const [examId, setExamId] = useState(exams[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [enrolled, setEnrolled] = useState<{ id: string; name: string; email: string }[]>([]);
  const [registered, setRegistered] = useState<Set<string>>(new Set());

  const exam = exams.find((e) => e.id === examId) || null;

  useEffect(() => {
    if (!examId) return;
    (async () => {
      setLoading(true);
      const current = exams.find((e) => e.id === examId)!;
      const [enrRes, regRes] = await Promise.all([
        supabase.from('enrollments').select('student_id, student:profiles(full_name, email)').eq('course_id', current.course_id),
        supabase.from('exam_registrations').select('student_id').eq('exam_id', examId),
      ]);
      setEnrolled((enrRes.data || []).map((r: any) => ({ id: r.student_id, name: r.student?.full_name || r.student?.email || 'Unknown', email: r.student?.email || '' })));
      setRegistered(new Set((regRes.data || []).map((r: any) => r.student_id)));
      setLoading(false);
    })();
  }, [examId]);

  const registerAll = async () => {
    const missing = enrolled.filter((s) => !registered.has(s.id));
    if (!missing.length) return;
    await supabase.from('exam_registrations').insert(missing.map((s) => ({ exam_id: examId, student_id: s.id, registered_by: profileId })));
    setRegistered((r) => new Set([...r, ...missing.map((s) => s.id)]));
  };

  const registerOne = async (studentId: string) => {
    await supabase.from('exam_registrations').insert({ exam_id: examId, student_id: studentId, registered_by: profileId });
    setRegistered((r) => new Set(r).add(studentId));
  };

  const removeOne = async (studentId: string) => {
    await supabase.from('exam_registrations').delete().eq('exam_id', examId).eq('student_id', studentId);
    setRegistered((r) => { const n = new Set(r); n.delete(studentId); return n; });
  };

  return (
    <ChartCard
      title="Exam Registration"
      action={
        <Select value={examId} onChange={(e) => setExamId(e.target.value)} className="w-64">
          {exams.map((e) => <option key={e.id} value={e.id}>{e.title} &mdash; {e.courseName}</option>)}
        </Select>
      }
    >
      {!exam ? (
        <EmptyState icon={<Users size={24} />} title="No exams available" />
      ) : loading ? <Spinner /> : (
        <div className="pt-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{registered.size} of {enrolled.length} enrolled students registered for <span className="font-bold text-slate-700">{exam.title}</span></p>
            <Button size="sm" variant="gradient" onClick={registerAll} disabled={registered.size === enrolled.length}>
              <Users size={13} /> Register All Enrolled
            </Button>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {enrolled.map((s) => {
              const isReg = registered.has(s.id);
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                  <Avatar name={s.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{s.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 min-w-0"><Mail size={11} className="shrink-0" /> <span className="truncate">{s.email}</span></p>
                  </div>
                  {isReg ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge color="success">Registered</Badge>
                      <Button size="sm" variant="ghost" onClick={() => removeOne(s.id)}>Remove</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => registerOne(s.id)}>Register</Button>
                  )}
                </div>
              );
            })}
            {enrolled.length === 0 && <EmptyState icon={<Users size={24} />} title="No students enrolled in this course" />}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function ResultsTab({ exams }: { exams: ExamRow[] }) {
  const [examId, setExamId] = useState(exams[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<{ id: string; name: string; email: string; score: number; total: number; status: string; submittedAt: string | null }[]>([]);

  const exam = exams.find((e) => e.id === examId) || null;

  useEffect(() => {
    if (!examId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('exam_attempts')
        .select('id, score, total_marks, status, submitted_at, student:profiles(full_name, email)')
        .eq('exam_id', examId);
      setAttempts((data || []).map((a: any) => ({
        id: a.id, name: a.student?.full_name || a.student?.email || 'Unknown', email: a.student?.email || '',
        score: a.score || 0, total: a.total_marks || 0, status: a.status, submittedAt: a.submitted_at,
      })));
      setLoading(false);
    })();
  }, [examId]);

  const graded = attempts.filter((a) => a.total > 0);
  const avgPct = graded.length ? Math.round(graded.reduce((s, a) => s + (a.score / a.total) * 100, 0) / graded.length) : 0;
  const passRate = graded.length && exam ? Math.round((graded.filter((a) => (a.score / a.total) * 100 >= exam.pass_marks).length / graded.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <ChartCard
        title="Exam Results"
        action={
          <Select value={examId} onChange={(e) => setExamId(e.target.value)} className="w-64">
            {exams.map((e) => <option key={e.id} value={e.id}>{e.title} &mdash; {e.courseName}</option>)}
          </Select>
        }
      >
        {!exam ? <EmptyState icon={<ScrollText size={24} />} title="No exams available" /> : loading ? <Spinner /> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 mb-5">
              <StatCard label="Attempts" value={attempts.length} icon={<Users size={20} />} color="sky" />
              <StatCard label="Average Score" value={`${avgPct}%`} icon={<TrendingUp size={20} />} color="violet" />
              <StatCard label="Pass Rate" value={`${passRate}%`} icon={<ShieldCheck size={20} />} color="emerald" />
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {attempts.map((a) => {
                const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                    <Avatar name={a.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{a.name}</p>
                      <p className="text-xs text-slate-500 truncate">{a.email}</p>
                    </div>
                    <Badge color={a.status === 'graded' ? 'success' : a.status === 'submitted' ? 'blue' : 'amber'}>{a.status}</Badge>
                    <span className="text-sm font-bold text-slate-700 w-16 text-right">{a.total ? `${pct}%` : '—'}</span>
                  </div>
                );
              })}
              {attempts.length === 0 && <EmptyState icon={<ScrollText size={24} />} title="No attempts yet" />}
            </div>
          </>
        )}
      </ChartCard>
    </div>
  );
}

interface CertCandidate {
  studentId: string; studentName: string; courseId: string; courseName: string;
  grade: number | null; professorCleared: boolean; financeCleared: boolean;
  status: 'pending' | 'issued' | 'revoked'; certNumber: string | null; issuedAt: string | null;
}

function CertificatesTab({ profileId }: { profileId: string }) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CertCandidate[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: enr } = await supabase
      .from('enrollments')
      .select('student_id, progress_pct, status, course_id, student:profiles(full_name), course:courses(title)')
      .or('status.eq.completed,progress_pct.gte.100');

    const rows = enr || [];
    const studentIds = [...new Set(rows.map((r: any) => r.student_id))];
    const courseIds = [...new Set(rows.map((r: any) => r.course_id))];

    const [certsRes, feeRes, examsRes] = await Promise.all([
      supabase.from('certificates').select('*').in('student_id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('fee_assessments').select('student_id, status').in('student_id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('exams').select('id, course_id').in('course_id', courseIds.length ? courseIds : ['00000000-0000-0000-0000-000000000000']),
    ]);

    const certMap: Record<string, any> = {};
    (certsRes.data || []).forEach((c: any) => { certMap[`${c.student_id}:${c.course_id}`] = c; });

    const outstanding = new Set((feeRes.data || []).filter((f: any) => f.status === 'unpaid' || f.status === 'overdue').map((f: any) => f.student_id));

    const examsByCourse: Record<string, string[]> = {};
    (examsRes.data || []).forEach((e: any) => { (examsByCourse[e.course_id] ||= []).push(e.id); });

    const allExamIds = (examsRes.data || []).map((e: any) => e.id);
    const { data: attempts } = allExamIds.length
      ? await supabase.from('exam_attempts').select('student_id, exam_id, score, total_marks, status').in('exam_id', allExamIds).in('status', ['submitted', 'graded'])
      : { data: [] as any[] };

    const gradeFor = (studentId: string, courseId: string) => {
      const examIds = new Set(examsByCourse[courseId] || []);
      const relevant = (attempts || []).filter((a: any) => a.student_id === studentId && examIds.has(a.exam_id) && a.total_marks > 0);
      if (!relevant.length) return null;
      return Math.round(relevant.reduce((s: number, a: any) => s + (a.score / a.total_marks) * 100, 0) / relevant.length);
    };

    setCandidates(rows.map((r: any) => {
      const cert = certMap[`${r.student_id}:${r.course_id}`];
      return {
        studentId: r.student_id,
        studentName: r.student?.full_name || 'Unknown',
        courseId: r.course_id,
        courseName: r.course?.title || 'Unknown',
        grade: gradeFor(r.student_id, r.course_id),
        professorCleared: cert?.professor_cleared || false,
        financeCleared: !outstanding.has(r.student_id),
        status: cert?.status || 'pending',
        certNumber: cert?.cert_number || null,
        issuedAt: cert?.issued_at || null,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleProfessorClearance = async (c: CertCandidate) => {
    await supabase.from('certificates').upsert({
      student_id: c.studentId, course_id: c.courseId,
      professor_cleared: !c.professorCleared, professor_cleared_by: profileId, professor_cleared_at: new Date().toISOString(),
    }, { onConflict: 'student_id,course_id' });
    load();
  };

  const award = async (c: CertCandidate) => {
    const certNumber = c.certNumber || `CERT-${c.courseId.slice(0, 4)}${c.studentId.slice(0, 4)}-${Date.now().toString(36)}`.toUpperCase();
    await supabase.from('certificates').upsert({
      student_id: c.studentId, course_id: c.courseId,
      professor_cleared: true, professor_cleared_by: profileId,
      finance_cleared_at: new Date().toISOString(),
      status: 'issued', issued_at: new Date().toISOString(), issued_by: profileId,
      cert_number: certNumber, grade: c.grade,
    }, { onConflict: 'student_id,course_id' });
    load();
  };

  if (loading) return <Spinner />;

  const pending = candidates.filter((c) => c.status !== 'issued');
  const issued = candidates.filter((c) => c.status === 'issued');

  return (
    <div className="space-y-6">
      <ChartCard title="Pending Clearance" action={<Badge color="amber">{pending.length}</Badge>}>
        <div className="space-y-2.5 pt-2">
          {pending.map((c) => (
            <div key={`${c.studentId}:${c.courseId}`} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
              <Avatar name={c.studentName} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">{c.studentName}</p>
                <p className="text-xs text-slate-500 truncate">{c.courseName} &middot; Grade: {c.grade === null ? 'N/A' : `${c.grade}%`}</p>
              </div>
              <Button size="sm" variant={c.professorCleared ? 'secondary' : 'outline'} onClick={() => toggleProfessorClearance(c)}>
                <ShieldCheck size={13} /> {c.professorCleared ? 'Professor Cleared' : 'Clear (Professor)'}
              </Button>
              <Badge color={c.financeCleared ? 'success' : 'danger'}>
                <Landmark size={11} /> {c.financeCleared ? 'Finance Cleared' : 'Fees Outstanding'}
              </Badge>
              <Button size="sm" variant="gradient" disabled={!c.professorCleared || !c.financeCleared} onClick={() => award(c)}>
                <Award size={13} /> Award
              </Button>
            </div>
          ))}
          {pending.length === 0 && <EmptyState icon={<Award size={24} />} title="No students awaiting certificates" description="Completed enrollments will appear here." />}
        </div>
      </ChartCard>

      <ChartCard title="Issued Certificates" action={<Badge color="success">{issued.length}</Badge>}>
        <div className="space-y-2.5 pt-2">
          {issued.map((c) => (
            <div key={`${c.studentId}:${c.courseId}`} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
              <Avatar name={c.studentName} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">{c.studentName}</p>
                <p className="text-xs text-slate-500 truncate">{c.courseName} &middot; {c.certNumber}</p>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase shrink-0">{c.issuedAt ? formatDate(c.issuedAt) : ''}</span>
            </div>
          ))}
          {issued.length === 0 && <EmptyState icon={<Award size={24} />} title="No certificates issued yet" />}
        </div>
      </ChartCard>
    </div>
  );
}
