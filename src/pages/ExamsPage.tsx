import { useEffect, useState } from 'react';
import { ScrollText, Plus, Play, Trash2, CheckCircle2, Clock, Award } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, Exam, QuestionBankItem, Course, ExamAttempt } from '../lib/supabase';
import { Button, Card, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal } from '../components/ui';

export default function ExamsPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const [exams, setExams] = useState<(Exam & { course?: Course; questionCount?: number; attempt?: ExamAttempt })[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [managing, setManaging] = useState<Exam | null>(null);
  const [taking, setTaking] = useState<Exam | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('exams').select('*, course:courses(id, title)').order('created_at', { ascending: false });
    if (role === 'professor') {
      const { data: cs } = await supabase.from('courses').select('id').eq('professor_id', profile!.id);
      const ids = (cs || []).map((c) => c.id);
      q = q.in('course_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (role === 'student') {
      const { data: enr } = await supabase.from('enrollments').select('course_id').eq('student_id', profile!.id);
      const ids = (enr || []).map((e) => e.course_id);
      q = q.eq('status', 'published').in('course_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    }
    const { data } = await q;
    const list = (data || []) as any[];
    if (list.length) {
      const ids = list.map((e) => e.id);
      const [eq, att] = await Promise.all([
        supabase.from('exam_questions').select('exam_id').in('exam_id', ids),
        role === 'student' ? supabase.from('exam_attempts').select('*').eq('student_id', profile!.id).in('exam_id', ids) : Promise.resolve({ data: [] }),
      ]);
      const qCount: Record<string, number> = {};
      (eq.data || []).forEach((x: any) => (qCount[x.exam_id] = (qCount[x.exam_id] || 0) + 1));
      const attMap = new Map((att.data || []).map((a: any) => [a.exam_id, a]));
      list.forEach((e) => { e.questionCount = qCount[e.id] || 0; e.attempt = attMap.get(e.id); });
    }
    setExams(list);
    if (role !== 'student') {
      let cq = supabase.from('courses').select('id, title');
      if (role === 'professor') cq = cq.eq('professor_id', profile!.id);
      const { data: cs } = await cq;
      setCourses(cs as Course[] || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Exams</h1>
          <p className="text-sm text-slate-500">{role === 'student' ? 'Your available exams' : 'Create and manage exams'}</p>
        </div>
        {role !== 'student' && <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> New Exam</Button>}
      </div>

      {exams.length === 0 ? (
        <Card><EmptyState icon={<ScrollText size={32} />} title="No exams" subtitle={role === 'student' ? 'No exams available' : 'Create your first exam'} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map((e) => (
            <Card key={e.id} className="p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-slate-800">{e.title}</h3>
                <Badge color={e.status === 'published' ? 'green' : e.status === 'closed' ? 'slate' : 'amber'}>{e.status}</Badge>
              </div>
              {e.course && <p className="text-xs text-slate-400 mb-2">{e.course.title}</p>}
              {e.description && <p className="text-sm text-slate-500 mb-3">{e.description}</p>}
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                <span><Clock size={12} className="inline mr-1" />{e.duration_minutes}min</span>
                <span>•</span><span>{e.questionCount || 0} questions</span>
                <span>•</span><span>Pass: {e.pass_marks}</span>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                {role === 'student' ? (
                  e.attempt?.status === 'submitted' || e.attempt?.status === 'graded' ? (
                    <Badge color="green"><CheckCircle2 size={12} className="mr-1" /> Submitted — {e.attempt.score}/{e.attempt.total_marks}</Badge>
                  ) : (
                    <Button size="sm" onClick={() => setTaking(e)} disabled={e.status !== 'published'}><Play size={14} /> {e.attempt ? 'Resume' : 'Start'} Exam</Button>
                  )
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setShowForm(true); }}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => setManaging(e)}>Manage Questions</Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      const next = e.status === 'draft' ? 'published' : e.status === 'published' ? 'closed' : 'draft';
                      await supabase.from('exams').update({ status: next }).eq('id', e.id); load();
                    }}>{e.status === 'draft' ? 'Publish' : e.status === 'published' ? 'Close' : 'Reopen'}</Button>
                    <Button size="sm" variant="ghost" onClick={async () => { await supabase.from('exams').delete().eq('id', e.id); load(); }}><Trash2 size={14} /></Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && <ExamForm exam={editing} courses={courses} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {managing && <ManageQuestions exam={managing} onClose={() => setManaging(null)} onDone={() => { setManaging(null); load(); }} />}
      {taking && <TakeExam exam={taking} onClose={() => { setTaking(null); load(); }} />}
    </div>
  );
}

function ExamForm({ exam, courses, onClose, onSaved }: { exam: Exam | null; courses: Course[]; onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState(exam?.title || '');
  const [description, setDescription] = useState(exam?.description || '');
  const [courseId, setCourseId] = useState(exam?.course_id || courses[0]?.id || '');
  const [duration, setDuration] = useState(String(exam?.duration_minutes || 60));
  const [passMarks, setPassMarks] = useState(String(exam?.pass_marks || 50));
  const [shuffleQ, setShuffleQ] = useState(exam?.shuffle_questions ?? true);
  const [shuffleO, setShuffleO] = useState(exam?.shuffle_options ?? true);
  const [allowResume, setAllowResume] = useState(exam?.allow_resume ?? true);
  const [autoEval, setAutoEval] = useState(exam?.auto_evaluate ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const payload = {
      title, description, course_id: courseId,
      duration_minutes: parseInt(duration) || 60,
      pass_marks: parseFloat(passMarks) || 50,
      shuffle_questions: shuffleQ, shuffle_options: shuffleO,
      allow_resume: allowResume, auto_evaluate: autoEval,
      created_by: profile!.id,
    };
    if (exam) await supabase.from('exams').update(payload).eq('id', exam.id);
    else await supabase.from('exams').insert(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={exam ? 'Edit Exam' : 'New Exam'} size="lg">
      <div className="space-y-4">
        <Input label="Title" value={title} onChange={setTitle} placeholder="Midterm Exam" required />
        <Textarea label="Description" value={description} onChange={setDescription} rows={2} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Course" value={courseId} onChange={setCourseId} options={courses.map((c) => ({ value: c.id, label: c.title }))} />
          <Input label="Duration (min)" value={duration} onChange={setDuration} type="number" />
        </div>
        <Input label="Pass Marks" value={passMarks} onChange={setPassMarks} type="number" />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)} className="rounded" /> Shuffle Questions</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={shuffleO} onChange={(e) => setShuffleO(e.target.checked)} className="rounded" /> Shuffle Options</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={allowResume} onChange={(e) => setAllowResume(e.target.checked)} className="rounded" /> Allow Resume</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={autoEval} onChange={(e) => setAutoEval(e.target.checked)} className="rounded" /> Auto Evaluate</label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title || !courseId}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ManageQuestions({ exam, onClose, onDone }: { exam: Exam; onClose: () => void; onDone: () => void }) {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      let qb = supabase.from('question_bank').select('*').eq('status', 'active').order('created_at', { ascending: false });
      if (profile?.role === 'professor') qb = qb.eq('created_by', profile.id);
      const { data: qs } = await qb;
      const { data: eq } = await supabase.from('exam_questions').select('question_id').eq('exam_id', exam.id);
      setQuestions(qs || []);
      setAssigned(new Set((eq || []).map((x) => x.question_id)));
      setLoading(false);
    })();
  }, [exam.id]);

  const toggle = async (qid: string) => {
    if (assigned.has(qid)) {
      await supabase.from('exam_questions').delete().eq('exam_id', exam.id).eq('question_id', qid);
      setAssigned((s) => { const n = new Set(s); n.delete(qid); return n; });
    } else {
      await supabase.from('exam_questions').insert({ exam_id: exam.id, question_id: qid, marks: questions.find((q) => q.id === qid)?.marks || 1 });
      setAssigned((s) => new Set(s).add(qid));
    }
  };

  const filtered = questions.filter((q) => !search || q.question_text.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal open onClose={onClose} title={`Manage Questions — ${exam.title}`} size="lg">
      {loading ? <Spinner /> : (
        <>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" className="w-full px-3 py-2 mb-3 border border-slate-300 rounded-lg text-sm" />
          <p className="text-sm text-slate-500 mb-3">{assigned.size} assigned • {questions.length} available</p>
          <div className="max-h-96 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2">
            {filtered.map((q) => (
              <label key={q.id} className={`flex items-start gap-3 p-2 rounded-md cursor-pointer ${assigned.has(q.id) ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={assigned.has(q.id)} onChange={() => toggle(q.id)} className="mt-1 rounded border-slate-300 text-sky-600" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color="slate">{q.type.replace('_', ' ')}</Badge>
                    <Badge color="slate">{q.difficulty}</Badge>
                    <span className="text-xs text-slate-400">{q.marks} marks</span>
                  </div>
                  <p className="text-sm text-slate-700">{q.question_text}</p>
                </div>
              </label>
            ))}
            {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No questions available</p>}
          </div>
          <div className="flex justify-end pt-4"><Button onClick={onDone}>Done</Button></div>
        </>
      )}
    </Modal>
  );
}

function TakeExam({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<(QuestionBankItem & { marks: number })[]>([]);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(exam.duration_minutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; pct: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: eq } = await supabase.from('exam_questions').select('question_id, marks, question:question_bank(*)').eq('exam_id', exam.id);
      const qs = (eq || []).map((x: any) => ({ ...x.question, marks: x.marks })).filter((q) => q.id);
      setQuestions(qs);

      const { data: att } = await supabase.from('exam_attempts').select('*').eq('exam_id', exam.id).eq('student_id', profile!.id).maybeSingle();
      if (att && att.status === 'in_progress') {
        setAttempt(att);
        const { data: ans } = await supabase.from('attempt_answers').select('*').eq('attempt_id', att.id);
        const am: Record<string, any> = {};
        (ans || []).forEach((a: any) => (am[a.question_id] = a.answer));
        setAnswers(am);
      } else if (!att) {
        const { data: newAtt } = await supabase.from('exam_attempts').insert({ exam_id: exam.id, student_id: profile!.id, total_marks: qs.reduce((s, q) => s + (q.marks || 0), 0) }).select().single();
        setAttempt(newAtt);
      } else {
        setResult({ score: att.score, total: att.total_marks, pct: att.total_marks ? (att.score / att.total_marks) * 100 : 0 });
      }
      setLoading(false);
    })();
  }, [exam.id]);

  useEffect(() => {
    if (loading || result || !attempt) return;
    if (timeLeft <= 0) { submit(); return; }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, loading, result]);

  const setAnswer = (qid: string, val: any) => setAnswers((a) => ({ ...a, [qid]: val }));

  const submit = async () => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    let score = 0;
    let total = 0;
    for (const q of questions) {
      total += q.marks || 0;
      const ans = answers[q.id];
      let isCorrect = false;
      if (q.type === 'mcq') isCorrect = Array.isArray(q.correct_answer) && q.correct_answer[0] === ans;
      else if (q.type === 'multiple_select') isCorrect = Array.isArray(q.correct_answer) && Array.isArray(ans) && q.correct_answer.length === ans.length && q.correct_answer.every((i: number) => ans.includes(i));
      else if (q.type === 'true_false') isCorrect = (q.correct_answer === true ? 'true' : 'false') === ans;
      else if (q.type === 'short_answer') isCorrect = String(q.correct_answer).toLowerCase().trim() === String(ans).toLowerCase().trim();
      if (isCorrect) score += q.marks || 0;
      const existing = await supabase.from('attempt_answers').select('id').eq('attempt_id', attempt.id).eq('question_id', q.id).maybeSingle();
      const payload = { attempt_id: attempt.id, question_id: q.id, answer: ans ?? null, marks_awarded: isCorrect ? q.marks : 0, is_correct: isCorrect, graded_at: new Date().toISOString() };
      if (existing.data) await supabase.from('attempt_answers').update(payload).eq('id', existing.data.id);
      else await supabase.from('attempt_answers').insert(payload);
    }
    const pct = total ? (score / total) * 100 : 0;
    await supabase.from('exam_attempts').update({
      status: 'submitted', submitted_at: new Date().toISOString(), score, total_marks: total,
      time_spent_seconds: exam.duration_minutes * 60 - timeLeft,
    }).eq('id', attempt.id);
    setResult({ score, total, pct });
    setSubmitting(false);
  };

  if (loading) return <Modal open onClose={onClose} title={exam.title}><Spinner /></Modal>;

  if (result) {
    const passed = result.pct >= exam.pass_marks;
    return (
      <Modal open onClose={onClose} title="Exam Results" size="md">
        <div className="text-center py-6">
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
            <Award size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{result.score} / {result.total}</h2>
          <p className="text-sm text-slate-500 mt-1">{Math.round(result.pct)}%</p>
          <Badge color={passed ? 'green' : 'red'}>{passed ? 'PASSED' : 'FAILED'}</Badge>
          <div className="mt-6"><Button onClick={onClose}>Close</Button></div>
        </div>
      </Modal>
    );
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <Modal open onClose={onClose} title={exam.title} size="xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge color={timeLeft < 60 ? 'red' : 'slate'}><Clock size={12} className="mr-1" /> {mins}:{secs.toString().padStart(2, '0')}</Badge>
          <span className="text-sm text-slate-500">{questions.length} questions</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-4">
          {questions.map((q, i) => (
            <Card key={q.id} className="p-4">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-sm font-semibold text-slate-400">Q{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{q.question_text}</p>
                  <span className="text-xs text-slate-400">{q.marks} marks • {q.type.replace('_', ' ')}</span>
                </div>
              </div>
              {q.type === 'mcq' && (q.options || []).map((o, oi) => (
                <label key={oi} className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswer(q.id, oi)} className="rounded border-slate-300 text-sky-600" />
                  <span className="text-sm text-slate-700">{o}</span>
                </label>
              ))}
              {q.type === 'multiple_select' && (q.options || []).map((o, oi) => {
                const sel: number[] = answers[q.id] || [];
                return (
                  <label key={oi} className="flex items-center gap-2 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={sel.includes(oi)} onChange={() => {
                      const n = sel.includes(oi) ? sel.filter((x) => x !== oi) : [...sel, oi];
                      setAnswer(q.id, n);
                    }} className="rounded border-slate-300 text-sky-600" />
                    <span className="text-sm text-slate-700">{o}</span>
                  </label>
                );
              })}
              {q.type === 'true_false' && (
                <div className="flex gap-4">
                  {[{ v: 'true', l: 'True' }, { v: 'false', l: 'False' }].map((o) => (
                    <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name={q.id} checked={answers[q.id] === o.v} onChange={() => setAnswer(q.id, o.v)} className="rounded border-slate-300 text-sky-600" />
                      <span className="text-sm text-slate-700">{o.l}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'short_answer' && (
                <input value={answers[q.id] || ''} onChange={(e) => setAnswer(q.id, e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Your answer…" />
              )}
              {q.type === 'essay' && (
                <textarea value={answers[q.id] || ''} onChange={(e) => setAnswer(q.id, e.target.value)} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Write your essay…" />
              )}
            </Card>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Exit (saves progress)</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Exam'}</Button>
        </div>
      </div>
    </Modal>
  );
}
