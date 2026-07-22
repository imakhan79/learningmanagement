import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList, Plus, Search, Archive, RotateCcw, Trash2, Pencil,
  BookOpen, CheckCircle2, Clock, Send, Tag,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, QuestionBankItem } from '../lib/supabase';
import { StatCard, ChartCard, BarChart } from '../components/charts';
import { Button, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal } from '../components/ui';

const TYPES = [
  { value: 'mcq', label: 'Multiple Choice (MCQ)' },
  { value: 'true_false', label: 'True / False' },
  { value: 'multiple_select', label: 'Multiple Select' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
];
const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];
const STATUS_COLORS: Record<string, string> = { draft: 'amber', submitted: 'blue', approved: 'success', archived: 'slate' };
const diffColor = (d: string) => (d === 'easy' ? 'success' : d === 'medium' ? 'amber' : 'danger');

interface CourseOption { id: string; title: string; }

export default function QuestionsHubPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<QuestionBankItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuestionBankItem | null>(null);

  const load = async () => {
    setLoading(true);
    const [itemsRes, coursesRes] = await Promise.all([
      supabase.from('question_bank').select('*').order('created_at', { ascending: false }),
      supabase.from('courses').select('id, title').order('title', { ascending: true }),
    ]);
    setItems((itemsRes.data || []) as QuestionBankItem[]);
    setCourses(coursesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.title || 'Unassigned';

  const byCourse = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((i) => { const label = courseName(i.course_id); m[label] = (m[label] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [items, courses]);

  const filtered = items.filter((i) => {
    if (courseFilter === 'unassigned' && i.course_id) return false;
    if (courseFilter !== 'all' && courseFilter !== 'unassigned' && i.course_id !== courseFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (search && !`${i.question_text} ${i.topic} ${i.subject}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: items.length,
    approved: items.filter((i) => i.status === 'approved').length,
    pending: items.filter((i) => i.status === 'draft' || i.status === 'submitted').length,
    archived: items.filter((i) => i.status === 'archived').length,
  };

  const toggleArchive = async (q: QuestionBankItem) => {
    await supabase.from('question_bank').update({ status: q.status === 'archived' ? 'draft' : 'archived' }).eq('id', q.id);
    load();
  };

  const deleteQuestion = async (q: QuestionBankItem) => {
    await supabase.from('question_bank').delete().eq('id', q.id);
    setConfirmDelete(null);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Questions Hub</h1>
          <p className="text-slate-500 font-medium">Course-wise question bank setup, editing, and lifecycle</p>
        </div>
        <Button variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={16} /> New Question
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <StatCard label="Total Questions" value={stats.total} icon={<ClipboardList size={20} />} color="violet" />
        <StatCard label="Approved" value={stats.approved} icon={<CheckCircle2 size={20} />} color="emerald" />
        <StatCard label="Pending Review" value={stats.pending} icon={<Send size={20} />} color="amber" />
        <StatCard label="Archived" value={stats.archived} icon={<Archive size={20} />} color="slate" />
      </div>

      <ChartCard title="Questions by Course">
        <div className="py-2"><BarChart data={byCourse} color="#8b5cf6" /></div>
      </ChartCard>

      <ChartCard
        title="Question Bank"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-48">
              <option value="all">All Courses</option>
              <option value="unassigned">Unassigned</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
        }
      >
        <div className="relative mt-2 mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by question, topic, or subject..." className="pl-9" />
        </div>
        <div className="space-y-2.5">
          {filtered.map((q) => (
            <div key={q.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
              <span className="w-9 h-9 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                <ClipboardList size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <Badge color={STATUS_COLORS[q.status]}>{q.status}</Badge>
                  <Badge color="blue">{q.type.replace('_', ' ')}</Badge>
                  <Badge color={diffColor(q.difficulty)}>{q.difficulty}</Badge>
                  <Badge color="violet">{courseName(q.course_id)}</Badge>
                  <span className="text-xs font-semibold text-slate-400">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                </div>
                <p className="text-sm font-semibold text-slate-700 line-clamp-2">{q.question_text}</p>
                {q.topic && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Tag size={10} /> {q.topic}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(q); setShowForm(true); }}><Pencil size={13} /></Button>
                <Button size="sm" variant="ghost" onClick={() => toggleArchive(q)}>
                  {q.status === 'archived' ? <RotateCcw size={13} /> : <Archive size={13} />}
                </Button>
                <Button size="sm" variant="ghost" className="hover:text-danger-600" onClick={() => setConfirmDelete(q)}><Trash2 size={13} /></Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon={<ClipboardList size={24} />} title="No questions found" description="Try adjusting your filters or add a new question." />}
        </div>
      </ChartCard>

      {showForm && (
        <QuestionFormModal
          question={editing}
          courses={courses}
          defaultCourseId={courseFilter !== 'all' && courseFilter !== 'unassigned' ? courseFilter : ''}
          creatorId={profile!.id}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} title="Delete Question" maxW="max-w-sm">
          <div className="p-6 pt-2 space-y-5">
            <p className="text-sm text-slate-600">
              Delete this question permanently? <span className="block mt-2 text-slate-800 font-semibold bg-slate-50 border border-slate-100 rounded-lg p-2.5">{confirmDelete.question_text}</span>
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => deleteQuestion(confirmDelete)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function QuestionFormModal({ question, courses, defaultCourseId, creatorId, onClose, onSaved }: {
  question: QuestionBankItem | null;
  courses: CourseOption[];
  defaultCourseId: string;
  creatorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState(question?.type || 'mcq');
  const [text, setText] = useState(question?.question_text || '');
  const [subject, setSubject] = useState(question?.subject || '');
  const [topic, setTopic] = useState(question?.topic || '');
  const [difficulty, setDifficulty] = useState(question?.difficulty || 'medium');
  const [marks, setMarks] = useState(String(question?.marks || 1));
  const [time, setTime] = useState(String(question?.time_seconds || 0));
  const [courseId, setCourseId] = useState(question?.course_id || defaultCourseId);
  const [status, setStatus] = useState(question?.status || 'draft');
  const [options, setOptions] = useState<string[]>(question?.options?.length ? question.options : ['', '', '', '']);
  const [correct, setCorrect] = useState<number[]>(Array.isArray(question?.correct_answer) ? question.correct_answer : []);
  const [tfAnswer, setTfAnswer] = useState(question?.type === 'true_false' ? (question.correct_answer ? 'true' : 'false') : 'true');
  const [textAnswer, setTextAnswer] = useState((question?.type === 'short_answer' || question?.type === 'essay') ? String(question?.correct_answer || '') : '');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [saving, setSaving] = useState(false);

  const updateOption = (i: number, v: string) => { const n = [...options]; n[i] = v; setOptions(n); };
  const addOption = () => setOptions([...options, '']);
  const toggleCorrect = (i: number) => {
    if (type === 'mcq') setCorrect([i]);
    else { const n = new Set(correct); n.has(i) ? n.delete(i) : n.add(i); setCorrect([...n]); }
  };

  const save = async () => {
    setSaving(true);
    let correctAnswer: any = correct;
    if (type === 'true_false') correctAnswer = tfAnswer === 'true';
    if (type === 'short_answer' || type === 'essay') correctAnswer = textAnswer;
    const payload: any = {
      type, question_text: text, subject, topic,
      difficulty,
      marks: parseFloat(marks) || 1,
      time_seconds: parseInt(time, 10) || 0,
      course_id: courseId || null,
      options: (type === 'mcq' || type === 'multiple_select') ? options.filter((o) => o) : [],
      correct_answer: correctAnswer,
      explanation,
      status,
    };
    if (question) {
      await supabase.from('question_bank').update(payload).eq('id', question.id);
    } else {
      await supabase.from('question_bank').insert({ ...payload, created_by: creatorId });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={question ? 'Edit Question' : 'Setup New Question'} maxW="max-w-2xl">
      <div className="space-y-4 p-6 pt-2 max-h-[75vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <Select value={type} onChange={(e) => setType(e.target.value as any)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
            {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
        </div>

        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Type your question here..." />

        <div className="grid grid-cols-2 gap-3">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (e.g. Mathematics)" />
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (e.g. Algebra)" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="Marks" />
          <Input type="number" value={time} onChange={(e) => setTime(e.target.value)} placeholder="Time (seconds)" />
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">— Unassigned —</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
        </div>

        {(type === 'mcq' || type === 'multiple_select') && (
          <div className="space-y-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-sm font-semibold text-slate-700">Answer Options</p>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={type === 'mcq' ? 'radio' : 'checkbox'}
                  checked={correct.includes(i)}
                  onChange={() => toggleCorrect(i)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600"
                />
                <span className="w-5 text-xs font-bold text-slate-400">{String.fromCharCode(65 + i)}.</span>
                <input
                  value={o}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addOption}>+ Add Option</Button>
          </div>
        )}

        {type === 'true_false' && (
          <Select value={tfAnswer} onChange={(e) => setTfAnswer(e.target.value)}>
            <option value="true">True</option>
            <option value="false">False</option>
          </Select>
        )}

        {(type === 'short_answer' || type === 'essay') && (
          <Textarea value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} rows={type === 'essay' ? 4 : 2} placeholder="Model answer..." />
        )}

        <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} placeholder="Explanation shown after submission (optional)..." />

        <div>
          <label className="label">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="archived">Archived</option>
          </Select>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !text}>{saving ? 'Saving...' : 'Save Question'}</Button>
        </div>
      </div>
    </Modal>
  );
}
