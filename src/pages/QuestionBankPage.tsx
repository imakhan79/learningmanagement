import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Search, Archive, Trash2, Download } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, QuestionBankItem, Course } from '../lib/supabase';
import { Button, Card, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal } from '../components/ui';

const TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'multiple_select', label: 'Multiple Select' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
];
const DIFFICULTIES = [{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }];

export default function QuestionBankPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editing, setEditing] = useState<QuestionBankItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('question_bank').select('*').order('created_at', { ascending: false });
    if (role === 'professor') q = q.eq('created_by', profile!.id);
    const { data } = await q;
    setItems(data || []);
    const { data: cs } = await supabase.from('courses').select('id, title');
    setCourses(cs as Course[] || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const filtered = items.filter((i) => {
    if (typeFilter !== 'all' && i.type !== typeFilter) return false;
    if (search && !`${i.question_text} ${i.topic} ${i.subject}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'question_bank.json'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Question Bank</h1>
          <p className="text-sm text-slate-500">{items.length} questions</p>
        </div>
        <div className="flex gap-2">
          {role === 'admin' && <Button variant="outline" size="sm" onClick={exportJson}><Download size={14} /> Export</Button>}
          <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> New Question</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <Select value={typeFilter} onChange={setTypeFilter} options={[{ value: 'all', label: 'All Types' }, ...TYPES]} />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<ClipboardList size={32} />} title="No questions" subtitle="Create questions to use in exams" /></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => (
            <Card key={q.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge color="blue">{q.type.replace('_', ' ')}</Badge>
                    <Badge color="slate">{q.difficulty}</Badge>
                    <Badge color="slate">{q.subject || 'General'}</Badge>
                    {q.topic && <Badge color="slate">{q.topic}</Badge>}
                    <Badge color={q.status === 'active' ? 'green' : 'slate'}>{q.status}</Badge>
                    <span className="text-xs text-slate-400">{q.marks} marks</span>
                  </div>
                  <p className="text-sm text-slate-700">{q.question_text}</p>
                  {(q.type === 'mcq' || q.type === 'multiple_select') && q.options?.length > 0 && (
                    <ul className="mt-2 text-xs text-slate-500 list-disc list-inside">
                      {q.options.map((o, i) => (
                        <li key={i} className={Array.isArray(q.correct_answer) && q.correct_answer.includes(i) ? 'text-emerald-600 font-medium' : ''}>
                          {o}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.type === 'true_false' && <p className="mt-1 text-xs text-emerald-600">Answer: {q.correct_answer ? 'True' : 'False'}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(q); setShowForm(true); }}>Edit</Button>
                  {role === 'admin' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        await supabase.from('question_bank').update({ status: q.status === 'archived' ? 'active' : 'archived' }).eq('id', q.id);
                        load();
                      }}><Archive size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        await supabase.from('question_bank').delete().eq('id', q.id); load();
                      }}><Trash2 size={14} /></Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <QuestionForm question={editing} courses={courses} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function QuestionForm({ question, courses, onClose, onSaved }: { question: QuestionBankItem | null; courses: Course[]; onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const [type, setType] = useState(question?.type || 'mcq');
  const [text, setText] = useState(question?.question_text || '');
  const [subject, setSubject] = useState(question?.subject || '');
  const [topic, setTopic] = useState(question?.topic || '');
  const [difficulty, setDifficulty] = useState(question?.difficulty || 'medium');
  const [marks, setMarks] = useState(String(question?.marks || 1));
  const [time, setTime] = useState(String(question?.time_seconds || 0));
  const [courseId, setCourseId] = useState(question?.course_id || '');
  const [options, setOptions] = useState<string[]>(question?.options?.length ? question.options : ['', '', '', '']);
  const [correct, setCorrect] = useState<number[]>(Array.isArray(question?.correct_answer) ? question.correct_answer : []);
  const [tfAnswer, setTfAnswer] = useState(question?.type === 'true_false' ? (question.correct_answer ? 'true' : 'false') : 'true');
  const [textAnswer, setTextAnswer] = useState(question?.type === 'short_answer' || question?.type === 'essay' ? String(question?.correct_answer || '') : '');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [saving, setSaving] = useState(false);

  const updateOption = (i: number, v: string) => {
    const n = [...options]; n[i] = v; setOptions(n);
  };
  const toggleCorrect = (i: number) => {
    if (type === 'mcq') setCorrect([i]);
    else { const n = new Set(correct); if (n.has(i)) n.delete(i); else n.add(i); setCorrect([...n]); }
  };

  const save = async () => {
    setSaving(true);
    let correctAnswer: any = correct;
    if (type === 'true_false') correctAnswer = tfAnswer === 'true';
    if (type === 'short_answer' || type === 'essay') correctAnswer = textAnswer;
    const payload = {
      type, question_text: text, subject, topic, difficulty,
      marks: parseFloat(marks) || 1, time_seconds: parseInt(time) || 0,
      course_id: courseId || null,
      options: (type === 'mcq' || type === 'multiple_select') ? options.filter((o) => o) : [],
      correct_answer: correctAnswer,
      explanation,
      created_by: profile!.id,
    };
    if (question) await supabase.from('question_bank').update(payload).eq('id', question.id);
    else await supabase.from('question_bank').insert(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={question ? 'Edit Question' : 'New Question'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" value={type} onChange={(v) => setType(v as any)} options={TYPES} />
          <Select label="Difficulty" value={difficulty} onChange={(v) => setDifficulty(v as any)} options={DIFFICULTIES} />
        </div>
        <Textarea label="Question" value={text} onChange={setText} rows={2} placeholder="What is…" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Subject" value={subject} onChange={setSubject} />
          <Input label="Topic" value={topic} onChange={setTopic} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Marks" value={marks} onChange={setMarks} type="number" />
          <Input label="Time (s)" value={time} onChange={setTime} type="number" />
          <Select label="Course" value={courseId} onChange={setCourseId} options={[{ value: '', label: 'None' }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
        </div>

        {(type === 'mcq' || type === 'multiple_select') && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Options (check correct {type === 'mcq' ? 'one' : 'any'})</p>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type={type === 'mcq' ? 'radio' : 'checkbox'} checked={correct.includes(i)} onChange={() => toggleCorrect(i)} className="rounded border-slate-300 text-sky-600" />
                <input value={o} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
              </div>
            ))}
          </div>
        )}
        {type === 'true_false' && (
          <Select label="Correct Answer" value={tfAnswer} onChange={setTfAnswer} options={[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]} />
        )}
        {(type === 'short_answer' || type === 'essay') && (
          <Textarea label="Model Answer" value={textAnswer} onChange={setTextAnswer} rows={2} />
        )}
        <Textarea label="Explanation" value={explanation} onChange={setExplanation} rows={2} />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !text}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  );
}
