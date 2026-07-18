import { useEffect, useState, useRef } from 'react';
import {
  ScrollText, Plus, Play, Trash2, CheckCircle2, Clock, Award,
  Settings, UserCheck, AlertTriangle, FileText, Activity, Save, Shuffle, AlertCircle
} from 'lucide-react';
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
  const [viewingResult, setViewingResult] = useState<ExamAttempt | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('exams').select('*, course:courses(id, title)').order('created_at', { ascending: false });
    
    if (role === 'professor') {
      const { data: cs } = await supabase.from('courses').select('id').eq('professor_id', profile!.id);
      const ids = (cs || []).map((c) => c.id);
      if (ids.length > 0) q = q.in('course_id', ids);
      else q = q.in('course_id', ['00000000-0000-0000-0000-000000000000']); // Force empty
    } else if (role === 'student') {
      const { data: enr } = await supabase.from('enrollments').select('course_id').eq('student_id', profile!.id);
      const ids = (enr || []).map((e) => e.course_id);
      if (ids.length > 0) q = q.eq('status', 'published').in('course_id', ids);
      else q = q.eq('status', 'published').in('course_id', ['00000000-0000-0000-0000-000000000000']);
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
      
      list.forEach((e) => {
        e.questionCount = qCount[e.id] || 0;
        e.attempt = attMap.get(e.id);
      });
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

  useEffect(() => { load(); }, [profile?.id, role]);

  const viewAttemptResult = async (examId: string) => {
    const { data } = await supabase.from('exam_attempts').select('*, exam:exams(*)').eq('exam_id', examId).eq('student_id', profile!.id).single();
    if (data) setViewingResult(data);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Award size={24} className="text-indigo-600" />
            Exams & Quizzes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {role === 'student' ? 'Your available assessments and history' : 'Create and manage assessments'}
          </p>
        </div>
        {role !== 'student' && (
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
            <Plus size={16} /> New Assessment
          </Button>
        )}
      </div>

      {exams.length === 0 ? (
        <Card>
          <EmptyState 
            icon={<ScrollText size={32} className="text-indigo-400" />} 
            title="No assessments" 
            subtitle={role === 'student' ? 'No exams available for your enrolled courses' : 'Create your first exam or quiz'} 
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {exams.map((e) => {
            const isQuiz = e.type === 'quiz';
            const isStudent = role === 'student';
            const attempt = e.attempt;
            const completed = attempt?.status === 'submitted' || attempt?.status === 'graded';
            const pct = completed && attempt?.total_marks ? Math.round((attempt.score / attempt.total_marks) * 100) : 0;
            const passed = pct >= (e.pass_marks || 50);

            return (
              <Card key={e.id} className={`p-5 flex flex-col hover:shadow-lg transition-shadow border-t-4 ${isQuiz ? 'border-t-purple-400' : 'border-t-indigo-500'}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge color={isQuiz ? 'purple' : 'indigo'}>{e.type?.toUpperCase() || 'EXAM'}</Badge>
                    <Badge color={e.status === 'published' ? 'green' : e.status === 'closed' ? 'slate' : 'amber'}>{e.status}</Badge>
                  </div>
                  {isStudent && completed && (
                    <Badge color={passed ? 'green' : 'red'}>{passed ? 'PASS' : 'FAIL'}</Badge>
                  )}
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 line-clamp-1 mb-1">{e.title}</h3>
                {e.course && <p className="text-xs font-medium text-slate-500 mb-2 truncate">{e.course.title}</p>}
                
                <p className="text-sm text-slate-600 mb-4 line-clamp-2 flex-grow">{e.description || 'No description provided.'}</p>
                
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mb-4 bg-slate-50 p-2 rounded-lg">
                  <span className="flex items-center gap-1"><Clock size={14} className="text-indigo-400" /> {e.duration_minutes}m</span>
                  <span className="flex items-center gap-1"><FileText size={14} className="text-indigo-400" /> {e.questionCount || 0} Qs</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-500" /> {e.pass_marks}%</span>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-auto flex flex-wrap gap-2">
                  {isStudent ? (
                    completed ? (
                      <Button size="sm" variant="outline" className="w-full justify-between border-slate-200" onClick={() => viewAttemptResult(e.id)}>
                        <span className="flex items-center gap-2">
                          <Award size={14} className={passed ? 'text-emerald-500' : 'text-rose-500'} /> 
                          Score: {attempt.score}/{attempt.total_marks}
                        </span>
                        <span className="font-bold">{pct}%</span>
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        className={`w-full ${e.status !== 'published' ? 'opacity-50' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        onClick={() => setTaking(e)} 
                        disabled={e.status !== 'published'}
                      >
                        {attempt ? (
                          <><Activity size={14} className="mr-2" /> Resume {isQuiz ? 'Quiz' : 'Exam'}</>
                        ) : (
                          <><Play size={14} className="mr-2" /> Start {isQuiz ? 'Quiz' : 'Exam'}</>
                        )}
                      </Button>
                    )
                  ) : (
                    <div className="flex gap-2 w-full">
                      <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setEditing(e); setShowForm(true); }}>
                        <Settings size={14} />
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => setManaging(e)}>
                        <FileText size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1" onClick={async () => {
                        const next = e.status === 'draft' ? 'published' : e.status === 'published' ? 'closed' : 'draft';
                        await supabase.from('exams').update({ status: next }).eq('id', e.id); 
                        load();
                      }}>
                        {e.status === 'draft' ? 'Publish' : e.status === 'published' ? 'Close' : 'Reopen'}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && <ExamForm exam={editing} courses={courses} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {managing && <ManageQuestions exam={managing} onClose={() => setManaging(null)} onDone={() => { setManaging(null); load(); }} />}
      {taking && <TakeExam exam={taking} onClose={() => { setTaking(null); load(); }} />}
      {viewingResult && <ExamResult attempt={viewingResult} onClose={() => setViewingResult(null)} />}
    </div>
  );
}

// ─── Exam Form ────────────────────────────────────────────────────────────────
function ExamForm({ exam, courses, onClose, onSaved }: { exam: Exam | null; courses: Course[]; onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState(exam?.title || '');
  const [description, setDescription] = useState(exam?.description || '');
  const [courseId, setCourseId] = useState(exam?.course_id || courses[0]?.id || '');
  const [type, setType] = useState(exam?.type || 'exam');
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
      title, description, course_id: courseId, type,
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
    <Modal open onClose={onClose} title={exam ? 'Edit Assessment' : 'New Assessment'} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Title" value={title} onChange={setTitle} placeholder="e.g. Midterm Exam" required />
          <Select label="Type" value={type} onChange={setType} options={[{ value: 'exam', label: 'Formal Exam' }, { value: 'quiz', label: 'Practice Quiz' }]} />
        </div>
        
        <Select label="Course" value={courseId} onChange={setCourseId} options={courses.map((c) => ({ value: c.id, label: c.title }))} />
        
        <Textarea label="Description / Instructions" value={description} onChange={setDescription} rows={3} placeholder="Instructions for students..." />
        
        <div className="grid grid-cols-2 gap-4">
          <Input label="Duration (minutes)" value={duration} onChange={setDuration} type="number" />
          <Input label="Passing Score (%)" value={passMarks} onChange={setPassMarks} type="number" />
        </div>
        
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <Shuffle size={16} className="text-slate-400" /> Randomise Question Order
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" checked={shuffleO} onChange={(e) => setShuffleO(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <Shuffle size={16} className="text-slate-400" /> Randomise Options
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" checked={allowResume} onChange={(e) => setAllowResume(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <Activity size={16} className="text-slate-400" /> Allow Resume
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" checked={autoEval} onChange={(e) => setAutoEval(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <CheckCircle2 size={16} className="text-slate-400" /> Auto Evaluate
          </label>
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title || !courseId} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? 'Saving…' : 'Save Assessment'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Manage Questions ─────────────────────────────────────────────────────────
function ManageQuestions({ exam, onClose, onDone }: { exam: Exam; onClose: () => void; onDone: () => void }) {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      let qb = supabase.from('question_bank').select('*').eq('status', 'approved').order('created_at', { ascending: false });
      // If we want professors to only see their own approved questions:
      // if (profile?.role === 'professor') qb = qb.eq('created_by', profile.id);
      
      const { data: qs } = await qb;
      const { data: eq } = await supabase.from('exam_questions').select('question_id').eq('exam_id', exam.id);
      
      setQuestions(qs || []);
      setAssigned(new Set((eq || []).map((x) => x.question_id)));
      setLoading(false);
    })();
  }, [exam.id, profile?.id, profile?.role]);

  const toggle = async (qid: string) => {
    if (assigned.has(qid)) {
      await supabase.from('exam_questions').delete().eq('exam_id', exam.id).eq('question_id', qid);
      setAssigned((s) => { const n = new Set(s); n.delete(qid); return n; });
    } else {
      // Find question to get max marks (assuming order_index is handled by DB defaults or we don't care)
      const qmarks = questions.find((q) => q.id === qid)?.marks || 1;
      await supabase.from('exam_questions').insert({ exam_id: exam.id, question_id: qid, order_index: assigned.size });
      setAssigned((s) => new Set(s).add(qid));
    }
  };

  const filtered = questions.filter((q) => !search || q.question_text.toLowerCase().includes(search.toLowerCase()) || q.category?.toLowerCase().includes(search.toLowerCase()));
  const totalMarks = Array.from(assigned).reduce((acc, id) => acc + (questions.find(q => q.id === id)?.marks || 0), 0);

  return (
    <Modal open onClose={onClose} title={`Manage Questions — ${exam.title}`} size="xl">
      {loading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
        <div className="flex flex-col h-[70vh]">
          <div className="flex items-center gap-4 mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-900">{assigned.size} Questions Selected</p>
              <p className="text-xs text-indigo-700">Total: {totalMarks} Marks</p>
            </div>
            <Input value={search} onChange={setSearch} placeholder="Search question bank..." className="w-64 bg-white" />
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2 bg-slate-50">
            {filtered.map((q) => {
              const isAssigned = assigned.has(q.id);
              return (
                <div 
                  key={q.id} 
                  onClick={() => toggle(q.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                    isAssigned 
                      ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="mt-0.5">
                    <input 
                      type="checkbox" 
                      checked={isAssigned} 
                      onChange={() => {}} // Handled by div click
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-none" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge color={q.difficulty === 'hard' ? 'red' : q.difficulty === 'medium' ? 'amber' : 'green'}>{q.difficulty}</Badge>
                      <Badge color="slate">{q.type.replace('_', ' ')}</Badge>
                      {q.category && <Badge color="violet">{q.category}</Badge>}
                      <span className="text-xs font-semibold text-slate-500 ml-auto">{q.marks} Marks</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 line-clamp-2">{q.question_text}</p>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <ScrollText size={32} className="mb-2 opacity-50" />
                <p>No questions match your search.</p>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-4 mt-2">
            <p className="text-xs text-slate-500">Changes are saved automatically.</p>
            <Button onClick={onDone} className="bg-indigo-600 hover:bg-indigo-700">Done Editing</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Take Exam ────────────────────────────────────────────────────────────────
function TakeExam({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<(QuestionBankItem & { examMarks: number })[]>([]);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(exam.duration_minutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; pct: number } | null>(null);
  
  // Navigation
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    (async () => {
      // Fetch questions
      const { data: eq } = await supabase.from('exam_questions').select('question_id, order_index, question:question_bank(*)').eq('exam_id', exam.id);
      
      let qs = (eq || []).map((x: any) => ({ ...x.question, examMarks: x.question.marks })).filter((q) => q.id);
      
      if (exam.shuffle_questions) {
        qs = qs.sort(() => Math.random() - 0.5);
      } else {
        // Assume sorting by order_index if available
        qs = qs.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
      }

      setQuestions(qs);

      // Setup or fetch attempt
      const { data: att } = await supabase.from('exam_attempts').select('*').eq('exam_id', exam.id).eq('student_id', profile!.id).maybeSingle();
      
      if (att && att.status === 'in_progress') {
        setAttempt(att);
        
        // Load saved answers
        const { data: ans } = await supabase.from('exam_responses').select('*').eq('attempt_id', att.id);
        const am: Record<string, any> = {};
        (ans || []).forEach((a: any) => {
          if (a.selected_option_ids) am[a.question_id] = a.selected_option_ids;
          else if (a.answer_text) am[a.question_id] = a.answer_text;
        });
        setAnswers(am);
        
        // Calculate remaining time
        const elapsed = Math.floor((new Date().getTime() - new Date(att.started_at).getTime()) / 1000);
        const remaining = Math.max(0, (exam.duration_minutes * 60) - elapsed);
        setTimeLeft(remaining);
        
      } else if (!att || (exam.allow_resume && att.status === 'in_progress')) {
        // Create new attempt
        const total_marks = qs.reduce((s, q) => s + (q.examMarks || 0), 0);
        const { data: newAtt } = await supabase.from('exam_attempts').insert({ 
          exam_id: exam.id, 
          student_id: profile!.id, 
          total_marks 
        }).select().single();
        setAttempt(newAtt);
      } else {
        // Already completed
        setResult({ score: att.score, total: att.total_marks, pct: att.total_marks ? (att.score / att.total_marks) * 100 : 0 });
      }
      setLoading(false);
    })();
  }, [exam.id, profile?.id]);

  // Timer effect
  useEffect(() => {
    if (loading || result || !attempt) return;
    if (timeLeft <= 0) { 
      if (!submitting) submit(); 
      return; 
    }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, loading, result, submitting]);

  const setAnswer = (qid: string, val: any) => {
    setAnswers((a) => ({ ...a, [qid]: val }));
  };

  const submit = async () => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    
    let score = 0;
    let total = 0;
    
    for (const q of questions) {
      total += q.examMarks || 0;
      const ans = answers[q.id];
      let isCorrect = false;
      let marksAwarded = 0;
      
      // Auto-evaluation logic
      if (exam.auto_evaluate) {
        if (q.type === 'mcq') {
          // Compare answer text or index depending on how it's stored. Assume index array for single choice
          isCorrect = Array.isArray(q.correct_answer) && q.correct_answer[0] === ans;
        } else if (q.type === 'multiple_select') {
          isCorrect = Array.isArray(q.correct_answer) && Array.isArray(ans) && 
                      q.correct_answer.length === ans.length && 
                      q.correct_answer.every((i: number) => ans.includes(i));
        } else if (q.type === 'true_false') {
          isCorrect = (q.correct_answer === true ? 'true' : 'false') === String(ans);
        } else if (q.type === 'short_answer') {
          isCorrect = String(q.correct_answer).toLowerCase().trim() === String(ans).toLowerCase().trim();
        }
        // Essay cannot be auto-evaluated, requires manual grading
        if (isCorrect) marksAwarded = q.examMarks || 0;
      }
      
      score += marksAwarded;
      
      // Save response
      const payload = { 
        attempt_id: attempt.id, 
        question_id: q.id, 
        answer_text: (q.type === 'short_answer' || q.type === 'essay' || q.type === 'true_false') ? String(ans || '') : null,
        selected_option_ids: (q.type === 'mcq' || q.type === 'multiple_select') ? (Array.isArray(ans) ? ans : [ans]) : null,
        is_correct: exam.auto_evaluate && q.type !== 'essay' ? isCorrect : null,
        marks_awarded: exam.auto_evaluate && q.type !== 'essay' ? marksAwarded : null,
      };
      
      // Upsert
      await supabase.from('exam_responses').upsert(payload, { onConflict: 'attempt_id, question_id' });
    }
    
    const pct = total ? (score / total) * 100 : 0;
    const timeSpent = (exam.duration_minutes * 60) - timeLeft;
    
    await supabase.from('exam_attempts').update({
      status: 'submitted', 
      submitted_at: new Date().toISOString(), 
      score, 
      total_marks: total,
      time_spent_seconds: timeSpent,
      auto_evaluated: exam.auto_evaluate
    }).eq('id', attempt.id);
    
    setResult({ score, total, pct });
    setSubmitting(false);
  };

  const handleExitAndSave = async () => {
    // Basic saving is done when submitting, but here we can just update status if needed or just close.
    // In a real app we'd periodically save answers to DB to prevent data loss.
    onClose();
  };

  if (loading) return <Modal open onClose={() => {}} title={exam.title}><Spinner /></Modal>;

  if (result) {
    const passed = result.pct >= exam.pass_marks;
    return (
      <Modal open onClose={onClose} title="Assessment Complete" size="md">
        <div className="text-center py-8">
          <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center shadow-inner ${passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
            <Award size={40} />
          </div>
          <h2 className="text-4xl font-extrabold text-slate-800 mb-2">{result.score} <span className="text-xl text-slate-400 font-medium">/ {result.total}</span></h2>
          <p className="text-lg font-medium text-slate-600 mb-4">{Math.round(result.pct)}% Score</p>
          
          <div className="inline-block px-4 py-1.5 rounded-full font-bold text-sm tracking-wide mb-8 border" style={{
            backgroundColor: passed ? '#d1fae5' : '#ffe4e6',
            color: passed ? '#059669' : '#e11d48',
            borderColor: passed ? '#a7f3d0' : '#fecdd3'
          }}>
            {passed ? 'PASSED' : 'FAILED'}
          </div>
          
          <div className="flex flex-col gap-2">
            <Button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3">Return to Dashboard</Button>
          </div>
        </div>
      </Modal>
    );
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isTimeLow = timeLeft < 300; // less than 5 mins

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== '').length;

  return (
    <Modal open onClose={() => {}} title={exam.title} size="xl">
      <div className="flex flex-col h-[75vh] bg-slate-50 -m-6">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-lg ${isTimeLow ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
              <Clock size={18} /> 
              {mins}:{secs.toString().padStart(2, '0')}
            </div>
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Progress</span>
              <span className="text-sm font-bold text-slate-700">{answeredCount} of {questions.length} Answered</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleExitAndSave} disabled={submitting}>
              <Save size={14} className="mr-2" /> Save & Pause
            </Button>
            <Button onClick={() => {
              if (answeredCount < questions.length && !confirm("You haven't answered all questions. Submit anyway?")) return;
              submit();
            }} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
              {submitting ? 'Submitting...' : 'Submit Exam'}
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Question Navigator Sidebar */}
          <div className="w-full md:w-64 bg-white border-r border-slate-200 p-4 overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Questions</h3>
            <div className="grid grid-cols-5 md:grid-cols-4 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '' && (Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : true);
                const isCurrent = currentIndex === idx;
                
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-lg text-sm font-bold flex items-center justify-center border-2 transition-colors ${
                      isCurrent 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : isAnswered 
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Question Display */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
            {currentQ && (
              <div className="max-w-3xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800">Question {currentIndex + 1}</h2>
                  <Badge color="slate" className="text-sm px-3 py-1 bg-white shadow-sm border border-slate-200">{currentQ.examMarks} Marks</Badge>
                </div>
                
                <Card className="p-6 mb-6 shadow-sm border-0 ring-1 ring-slate-200">
                  <p className="text-lg text-slate-800 font-medium leading-relaxed mb-6">
                    {currentQ.question_text}
                  </p>
                  
                  <div className="space-y-3">
                    {currentQ.type === 'mcq' && (currentQ.options || []).map((o, oi) => (
                      <label key={oi} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        answers[currentQ.id] === oi ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'
                      }`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          answers[currentQ.id] === oi ? 'border-indigo-600' : 'border-slate-300'
                        }`}>
                          {answers[currentQ.id] === oi && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                        </div>
                        <span className="text-base text-slate-700 font-medium">{o}</span>
                      </label>
                    ))}
                    
                    {currentQ.type === 'multiple_select' && (currentQ.options || []).map((o, oi) => {
                      const sel: number[] = answers[currentQ.id] || [];
                      const isSelected = sel.includes(oi);
                      return (
                        <label key={oi} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                          isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'
                        }`}>
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-indigo-600 text-white' : 'border-2 border-slate-300'
                          }`}>
                            {isSelected && <CheckCircle2 size={14} />}
                          </div>
                          <span className="text-base text-slate-700 font-medium">{o}</span>
                        </label>
                      );
                    })}
                    
                    {currentQ.type === 'true_false' && (
                      <div className="grid grid-cols-2 gap-4">
                        {[{ v: 'true', l: 'True' }, { v: 'false', l: 'False' }].map((o) => {
                          const isSelected = answers[currentQ.id] === o.v;
                          return (
                            <label key={o.v} className={`flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 cursor-pointer transition-colors ${
                              isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'
                            }`}>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-indigo-600' : 'border-slate-300'
                              }`}>
                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                              </div>
                              <span className="text-lg font-bold text-slate-700">{o.l}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    
                    {currentQ.type === 'short_answer' && (
                      <Input 
                        value={answers[currentQ.id] || ''} 
                        onChange={(val) => setAnswer(currentQ.id, val)} 
                        placeholder="Type your answer here..." 
                        className="text-lg py-4 shadow-inner bg-slate-50"
                      />
                    )}
                    
                    {currentQ.type === 'essay' && (
                      <Textarea 
                        value={answers[currentQ.id] || ''} 
                        onChange={(val) => setAnswer(currentQ.id, val)} 
                        rows={8} 
                        placeholder="Write your detailed response here..." 
                        className="text-base leading-relaxed shadow-inner bg-slate-50"
                      />
                    )}
                  </div>
                </Card>

                {/* Next/Prev Buttons */}
                <div className="flex items-center justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="px-6 border-slate-300 text-slate-600"
                  >
                    Previous
                  </Button>
                  
                  {currentIndex < questions.length - 1 ? (
                    <Button 
                      onClick={() => setCurrentIndex(currentIndex + 1)}
                      className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    >
                      Next Question
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => submit()}
                      className="px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                      Finish & Submit
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Exam Result View ──────────────────────────────────────────────────────────
function ExamResult({ attempt, onClose }: { attempt: ExamAttempt & { exam?: Exam }, onClose: () => void }) {
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('exam_responses')
        .select('*, question:question_bank(*)')
        .eq('attempt_id', attempt.id);
      setResponses(data || []);
      setLoading(false);
    })();
  }, [attempt.id]);

  if (loading) return <Modal open onClose={onClose}><Spinner /></Modal>;

  const exam = attempt.exam;
  const passed = attempt.total_marks ? ((attempt.score / attempt.total_marks) * 100) >= (exam?.pass_marks || 50) : false;
  const pct = attempt.total_marks ? Math.round((attempt.score / attempt.total_marks) * 100) : 0;

  return (
    <Modal open onClose={onClose} title={`Results: ${exam?.title || 'Exam'}`} size="2xl">
      <div className="space-y-6">
        
        {/* Score Header */}
        <div className={`p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6 ${passed ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
          <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 shadow-sm bg-white ${passed ? 'border-emerald-400 text-emerald-600' : 'border-rose-400 text-rose-600'}`}>
            <span className="text-2xl font-black">{pct}%</span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">{passed ? 'Congratulations, you passed!' : 'You did not pass this time.'}</h2>
            <p className="text-slate-600 mb-4">You scored <span className="font-bold">{attempt.score}</span> out of <span className="font-bold">{attempt.total_marks}</span> points.</p>
            
            <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1.5"><Clock size={16} className="text-slate-400" /> Time taken: {Math.floor((attempt.time_spent_seconds || 0) / 60)}m {(attempt.time_spent_seconds || 0) % 60}s</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-slate-400" /> Required: {exam?.pass_marks}%</span>
            </div>
          </div>
        </div>

        {/* Detailed Review */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Detailed Review</h3>
          
          {responses.map((resp, i) => {
            const q = resp.question;
            if (!q) return null;
            
            const isCorrect = resp.is_correct;
            const needsGrading = q.type === 'essay' && resp.graded_at === null;

            return (
              <Card key={resp.question_id} className={`p-5 border-l-4 ${
                needsGrading ? 'border-l-amber-400' : 
                isCorrect ? 'border-l-emerald-500' : 
                'border-l-rose-500'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 font-bold text-white shadow-sm ${
                    needsGrading ? 'bg-amber-400' :
                    isCorrect ? 'bg-emerald-500' : 
                    'bg-rose-500'
                  }`}>
                    {i + 1}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-base font-medium text-slate-800 leading-snug">{q.question_text}</p>
                      <Badge color="slate" className="ml-4 shrink-0">{resp.marks_awarded || 0} / {q.marks} Pts</Badge>
                    </div>
                    
                    <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Answer</p>
                      
                      {q.type === 'mcq' && (
                        <p className="text-sm font-medium text-slate-700">
                          {q.options[resp.selected_option_ids?.[0]] || <span className="italic text-slate-400">No answer provided</span>}
                        </p>
                      )}
                      {q.type === 'multiple_select' && (
                        <ul className="list-disc list-inside text-sm font-medium text-slate-700">
                          {(resp.selected_option_ids || []).map((idx: number) => (
                            <li key={idx}>{q.options[idx]}</li>
                          ))}
                          {(!resp.selected_option_ids || resp.selected_option_ids.length === 0) && <span className="italic text-slate-400">No answer provided</span>}
                        </ul>
                      )}
                      {(q.type === 'short_answer' || q.type === 'essay' || q.type === 'true_false') && (
                        <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">
                          {resp.answer_text || <span className="italic text-slate-400">No answer provided</span>}
                        </p>
                      )}
                    </div>
                    
                    {!isCorrect && q.correct_answer && q.type !== 'essay' && (
                      <div className="mt-3 p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Correct Answer</p>
                        <p className="text-sm font-medium text-emerald-800">
                          {q.type === 'mcq' ? q.options[q.correct_answer[0]] : 
                           q.type === 'true_false' ? (q.correct_answer ? 'True' : 'False') :
                           q.correct_answer}
                        </p>
                      </div>
                    )}
                    
                    {q.explanation && (
                      <div className="mt-3 flex gap-2 text-sm text-slate-600 bg-sky-50 p-3 rounded-lg border border-sky-100">
                        <AlertCircle size={16} className="text-sky-500 shrink-0 mt-0.5" />
                        <p>{q.explanation}</p>
                      </div>
                    )}
                    
                    {needsGrading && (
                      <div className="mt-3 flex gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 font-medium">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <p>This essay response is pending manual grading by your professor.</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <Button onClick={onClose}>Close Review</Button>
        </div>
      </div>
    </Modal>
  );
}
