import { useEffect, useRef, useState } from 'react';
import {
  ClipboardList, Plus, Search, Archive, Trash2, Download, Upload, CheckCircle,
  Clock, Tag, BookOpen, RefreshCw, Send, Filter, ChevronDown
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, QuestionBankItem, Course } from '../lib/supabase';
import { Button, Card, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal } from '../components/ui';

// ─── constants ────────────────────────────────────────────────────────────────
const TYPES = [
  { value: 'mcq', label: 'Multiple Choice (MCQ)' },
  { value: 'true_false', label: 'True / False' },
  { value: 'multiple_select', label: 'Multiple Select' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
];
const DIFFICULTIES = [
  { value: 'easy', label: '🟢 Easy' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'hard', label: '🔴 Hard' },
];
const STATUS_COLORS: Record<string, string> = {
  draft: 'amber', submitted: 'blue', approved: 'green', archived: 'slate',
};

// ─── helpers ──────────────────────────────────────────────────────────────────
const diffColor = (d: string) => d === 'easy' ? 'green' : d === 'medium' ? 'amber' : 'red';

// ─── main page ────────────────────────────────────────────────────────────────
export default function QuestionBankPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editing, setEditing] = useState<QuestionBankItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [reusing, setReusing] = useState<QuestionBankItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('question_bank').select('*').order('created_at', { ascending: false });
    if (role === 'professor') q = q.eq('created_by', profile!.id);
    const { data } = await q;
    setItems((data || []) as QuestionBankItem[]);
    const { data: cs } = await supabase.from('courses').select('id, title');
    setCourses((cs as Course[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  // ── derived filters ──────────────────────────────────────────────────────────
  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[];
  const filtered = items.filter((i) => {
    if (typeFilter !== 'all' && i.type !== typeFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    if (search && !`${i.question_text} ${i.topic} ${i.subject} ${i.category} ${(i.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── export ───────────────────────────────────────────────────────────────────
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'question_bank.json'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── import ───────────────────────────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let parsed: any[];
    try { parsed = JSON.parse(text); } catch { alert('Invalid JSON file'); return; }
    if (!Array.isArray(parsed)) { alert('File must contain a JSON array'); return; }
    const rows = parsed.map((r: any) => ({
      subject: r.subject || 'General',
      topic: r.topic || '',
      category: r.category || null,
      tags: r.tags || [],
      difficulty: r.difficulty || 'medium',
      type: r.type || 'mcq',
      question_text: r.question_text || r.question || '',
      options: r.options || [],
      correct_answer: r.correct_answer ?? null,
      explanation: r.explanation || '',
      marks: r.marks || 1,
      time_seconds: r.time_seconds || 0,
      course_id: r.course_id || null,
      status: 'draft',
      created_by: profile!.id,
    }));
    await supabase.from('question_bank').insert(rows);
    e.target.value = '';
    load();
  };

  // ── archive / delete ─────────────────────────────────────────────────────────
  const toggleArchive = async (q: QuestionBankItem) => {
    await supabase.from('question_bank').update({ status: q.status === 'archived' ? 'draft' : 'archived' }).eq('id', q.id);
    load();
  };
  const deleteQ = async (q: QuestionBankItem) => {
    if (!confirm('Delete this question permanently?')) return;
    await supabase.from('question_bank').delete().eq('id', q.id);
    load();
  };

  // ── approve (admin) ──────────────────────────────────────────────────────────
  const approveQ = async (q: QuestionBankItem) => {
    await supabase.from('question_bank').update({
      status: 'approved',
      approved_by: profile!.id,
      approved_at: new Date().toISOString(),
    }).eq('id', q.id);
    load();
  };

  // ── submit for review (professor) ────────────────────────────────────────────
  const submitQ = async (q: QuestionBankItem) => {
    await supabase.from('question_bank').update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }).eq('id', q.id);
    load();
  };

  if (loading) return <Spinner />;

  // ── stats bar ─────────────────────────────────────────────────────────────────
  const stats = { total: items.length, approved: items.filter(i => i.status === 'approved').length, submitted: items.filter(i => i.status === 'submitted').length, draft: items.filter(i => i.status === 'draft').length };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList size={24} className="text-sky-600" /> Question Bank
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{items.length} questions across {categories.length} categories</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {role === 'admin' && (
            <>
              <Button variant="outline" size="sm" onClick={exportJson}>
                <Download size={14} /> Export JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
                <Upload size={14} /> Import
              </Button>
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </>
          )}
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={16} /> New Question
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: <BookOpen size={16} />, color: 'sky' },
          { label: 'Approved', value: stats.approved, icon: <CheckCircle size={16} />, color: 'emerald' },
          { label: 'Pending Review', value: stats.submitted, icon: <Send size={16} />, color: 'blue' },
          { label: 'Draft', value: stats.draft, icon: <Clock size={16} />, color: 'amber' },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3 group hover:-translate-y-0.5 transition-transform duration-200">
            <div className={`w-9 h-9 rounded-xl bg-${s.color}-100 text-${s.color}-600 flex items-center justify-center`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-xl font-bold text-slate-800">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by question, topic, subject, category, tag…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={14} /> Filters <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={[{ value: 'all', label: 'All Types' }, ...TYPES]}
              label="Type"
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'draft', label: 'Draft' },
                { value: 'submitted', label: 'Submitted' },
                { value: 'approved', label: 'Approved' },
                { value: 'archived', label: 'Archived' },
              ]}
              label="Status"
            />
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: 'all', label: 'All Categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
              label="Category"
            />
          </div>
        )}
      </Card>

      {/* Question list */}
      {filtered.length === 0 ? (
        <Card><EmptyState icon={<ClipboardList size={32} />} title="No questions found" subtitle="Try adjusting your filters or create a new question" /></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => (
            <Card
              key={q.id}
              className={`p-4 border-l-4 hover:shadow-md transition-all duration-200 ${
                q.status === 'approved' ? 'border-l-emerald-400' :
                q.status === 'submitted' ? 'border-l-sky-400' :
                q.status === 'archived' ? 'border-l-slate-300 opacity-60' :
                'border-l-amber-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* Badges row */}
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <Badge color={STATUS_COLORS[q.status] as any}>{q.status}</Badge>
                    <Badge color="blue">{q.type.replace('_', ' ')}</Badge>
                    <Badge color={diffColor(q.difficulty) as any}>{q.difficulty}</Badge>
                    {q.category && <Badge color="violet">{q.category}</Badge>}
                    {q.subject && <Badge color="slate">{q.subject}</Badge>}
                    {q.topic && <span className="text-xs text-slate-400">• {q.topic}</span>}
                    <span className="text-xs font-semibold text-slate-500 ml-auto">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Question text */}
                  <p className="text-sm text-slate-800 font-medium leading-snug">{q.question_text}</p>

                  {/* Options for MCQ / Multiple Select */}
                  {(q.type === 'mcq' || q.type === 'multiple_select') && q.options?.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                      {q.options.map((o: string, i: number) => (
                        <li key={i} className={`flex items-center gap-1.5 ${Array.isArray(q.correct_answer) && q.correct_answer.includes(i) ? 'text-emerald-600 font-semibold' : ''}`}>
                          <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] shrink-0">{String.fromCharCode(65 + i)}</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.type === 'true_false' && (
                    <p className="mt-1 text-xs text-emerald-600 font-medium">Answer: {q.correct_answer ? 'True' : 'False'}</p>
                  )}

                  {/* Tags */}
                  {q.tags?.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <Tag size={10} className="text-slate-400" />
                      {q.tags.map((t) => (
                        <span key={t} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(q); setShowForm(true); }}>Edit</Button>

                  {/* Professor: submit for review */}
                  {role === 'professor' && q.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={() => submitQ(q)}>
                      <Send size={12} /> Submit
                    </Button>
                  )}

                  {/* Professor: reuse */}
                  {role === 'professor' && (
                    <Button size="sm" variant="ghost" onClick={() => setReusing(q)}>
                      <RefreshCw size={12} /> Reuse
                    </Button>
                  )}

                  {/* Admin: approve */}
                  {role === 'admin' && q.status === 'submitted' && (
                    <Button size="sm" variant="outline" onClick={() => approveQ(q)}>
                      <CheckCircle size={12} /> Approve
                    </Button>
                  )}

                  {/* Admin: archive / unarchive + delete */}
                  {role === 'admin' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => toggleArchive(q)}>
                        <Archive size={12} /> {q.status === 'archived' ? 'Restore' : 'Archive'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteQ(q)}>
                        <Trash2 size={12} className="text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit form modal */}
      {showForm && (
        <QuestionForm
          question={editing}
          courses={courses}
          role={role}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {/* Reuse modal */}
      {reusing && (
        <ReuseModal
          source={reusing}
          courses={courses}
          profileId={profile!.id}
          onClose={() => setReusing(null)}
          onSaved={() => { setReusing(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Reuse Modal ──────────────────────────────────────────────────────────────
function ReuseModal({ source, courses, profileId, onClose, onSaved }: {
  source: QuestionBankItem;
  courses: Course[];
  profileId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [courseId, setCourseId] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, updated_at, approved_by, approved_at, submitted_at, ...rest } = source;
    await supabase.from('question_bank').insert({
      ...rest,
      course_id: courseId || source.course_id,
      created_by: profileId,
      status: 'draft',
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Reuse Question" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">{source.question_text}</p>
        <Select
          label="Assign to Course (optional)"
          value={courseId}
          onChange={setCourseId}
          options={[{ value: '', label: 'Same course' }, ...courses.map((c) => ({ value: c.id, label: c.title }))]}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            <RefreshCw size={14} /> {saving ? 'Duplicating…' : 'Duplicate & Reuse'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Create / Edit Form ───────────────────────────────────────────────────────
function QuestionForm({ question, courses, role, onClose, onSaved }: {
  question: QuestionBankItem | null;
  courses: Course[];
  role: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [type, setType] = useState(question?.type || 'mcq');
  const [text, setText] = useState(question?.question_text || '');
  const [subject, setSubject] = useState(question?.subject || '');
  const [topic, setTopic] = useState(question?.topic || '');
  const [category, setCategory] = useState(question?.category || '');
  const [tagsInput, setTagsInput] = useState((question?.tags || []).join(', '));
  const [difficulty, setDifficulty] = useState(question?.difficulty || 'medium');
  const [marks, setMarks] = useState(String(question?.marks || 1));
  const [time, setTime] = useState(String(question?.time_seconds || 0));
  const [courseId, setCourseId] = useState(question?.course_id || '');
  const [options, setOptions] = useState<string[]>(question?.options?.length ? question.options : ['', '', '', '']);
  const [correct, setCorrect] = useState<number[]>(Array.isArray(question?.correct_answer) ? question.correct_answer : []);
  const [tfAnswer, setTfAnswer] = useState(question?.type === 'true_false' ? (question.correct_answer ? 'true' : 'false') : 'true');
  const [textAnswer, setTextAnswer] = useState((question?.type === 'short_answer' || question?.type === 'essay') ? String(question?.correct_answer || '') : '');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [saveAndSubmit, setSaveAndSubmit] = useState(false);
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
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const payload: any = {
      type, question_text: text, subject, topic,
      category: category || null, tags,
      difficulty,
      marks: parseFloat(marks) || 1,
      time_seconds: parseInt(time) || 0,
      course_id: courseId || null,
      options: (type === 'mcq' || type === 'multiple_select') ? options.filter((o) => o) : [],
      correct_answer: correctAnswer,
      explanation,
      created_by: profile!.id,
      status: saveAndSubmit ? 'submitted' : (question?.status === 'approved' ? 'approved' : 'draft'),
    };
    if (saveAndSubmit) payload.submitted_at = new Date().toISOString();
    if (question) await supabase.from('question_bank').update(payload).eq('id', question.id);
    else await supabase.from('question_bank').insert(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={question ? 'Edit Question' : 'New Question'} size="lg">
      <div className="space-y-4">
        {/* Type & Difficulty */}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Question Type" value={type} onChange={(v) => setType(v as any)} options={TYPES} />
          <Select label="Difficulty" value={difficulty} onChange={(v) => setDifficulty(v as any)} options={DIFFICULTIES} />
        </div>

        {/* Question text */}
        <Textarea label="Question Text" value={text} onChange={setText} rows={3} placeholder="Type your question here…" />

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Subject" value={subject} onChange={setSubject} placeholder="e.g. Mathematics" />
          <Input label="Topic" value={topic} onChange={setTopic} placeholder="e.g. Algebra" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Category" value={category} onChange={setCategory} placeholder="e.g. Midterm Pool" />
          <Input label="Tags (comma separated)" value={tagsInput} onChange={setTagsInput} placeholder="e.g. calculus, limits" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Marks" value={marks} onChange={setMarks} type="number" />
          <Input label="Time (seconds)" value={time} onChange={setTime} type="number" />
          <Select label="Course" value={courseId} onChange={setCourseId} options={[{ value: '', label: '— None —' }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
        </div>

        {/* Options for MCQ / Multiple Select */}
        {(type === 'mcq' || type === 'multiple_select') && (
          <div className="space-y-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Answer Options</p>
              <span className="text-xs text-slate-400">Check the correct {type === 'mcq' ? 'answer' : 'answers'}</span>
            </div>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={type === 'mcq' ? 'radio' : 'checkbox'}
                  checked={correct.includes(i)}
                  onChange={() => toggleCorrect(i)}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600 accent-sky-600"
                />
                <span className="w-5 text-xs font-bold text-slate-400">{String.fromCharCode(65 + i)}.</span>
                <input
                  value={o}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addOption}>+ Add Option</Button>
          </div>
        )}

        {/* True / False */}
        {type === 'true_false' && (
          <Select label="Correct Answer" value={tfAnswer} onChange={setTfAnswer} options={[{ value: 'true', label: '✅ True' }, { value: 'false', label: '❌ False' }]} />
        )}

        {/* Short answer / Essay model answer */}
        {(type === 'short_answer' || type === 'essay') && (
          <Textarea label="Model Answer" value={textAnswer} onChange={setTextAnswer} rows={type === 'essay' ? 4 : 2} placeholder="Expected answer…" />
        )}

        {/* Explanation */}
        <Textarea label="Explanation (shown after submission)" value={explanation} onChange={setExplanation} rows={2} placeholder="Why is this the correct answer?" />

        {/* Action buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {role === 'professor' && (
            <Button
              variant="outline"
              onClick={() => { setSaveAndSubmit(true); setTimeout(save, 0); }}
              disabled={saving || !text}
            >
              <Send size={14} /> Save & Submit for Review
            </Button>
          )}
          <Button onClick={save} disabled={saving || !text}>
            {saving ? 'Saving…' : 'Save as Draft'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
