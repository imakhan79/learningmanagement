import { useEffect, useState, useRef } from 'react';
import {
  ScrollText, Plus, Play, Trash2, CheckCircle2, Clock, Award,
  Settings, UserCheck, AlertTriangle, FileText, Activity, Save, Shuffle, AlertCircle
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, Exam, QuestionBankItem, Course, ExamAttempt } from '../lib/supabase';
import { Button, Card, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal, formatDateTime } from '../components/ui';

export default function ExamsPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const [exams, setExams] = useState<(Exam & { course?: Course; questionCount?: number; attempt?: ExamAttempt; hasEssay?: boolean; pendingGrading?: number })[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [managing, setManaging] = useState<Exam | null>(null);
  const [taking, setTaking] = useState<Exam | null>(null);
  const [viewingResult, setViewingResult] = useState<ExamAttempt | null>(null);
  const [grading, setGrading] = useState<Exam | null>(null);

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
        supabase.from('exam_questions').select('exam_id, question_id, question:question_bank(type)').in('exam_id', ids),
        role === 'student'
          ? supabase.from('exam_attempts').select('*').eq('student_id', profile!.id).in('exam_id', ids)
          : supabase.from('exam_attempts').select('id, exam_id').in('exam_id', ids),
      ]);

      const qCount: Record<string, number> = {};
      const essayQuestionIds = new Set<string>();
      const essayExamIds = new Set<string>();
      (eq.data || []).forEach((x: any) => {
        qCount[x.exam_id] = (qCount[x.exam_id] || 0) + 1;
        if (x.question?.type === 'essay') {
          essayQuestionIds.add(x.question_id);
          essayExamIds.add(x.exam_id);
        }
      });

      if (role === 'student') {
        const attMap = new Map((att.data || []).map((a: any) => [a.exam_id, a]));
        list.forEach((e) => {
          e.questionCount = qCount[e.id] || 0;
          e.attempt = attMap.get(e.id);
        });
      } else {
        const attemptToExam = new Map((att.data || []).map((a: any) => [a.id, a.exam_id]));
        const attemptIds = (att.data || []).map((a: any) => a.id);
        const pendingByExam: Record<string, number> = {};
        if (attemptIds.length && essayQuestionIds.size) {
          const { data: pending } = await supabase
            .from('exam_responses')
            .select('attempt_id, question_id')
            .in('attempt_id', attemptIds)
            .in('question_id', Array.from(essayQuestionIds))
            .is('graded_at', null);
          (pending || []).forEach((r: any) => {
            const examId = attemptToExam.get(r.attempt_id);
            if (examId) pendingByExam[examId] = (pendingByExam[examId] || 0) + 1;
          });
        }
        list.forEach((e) => {
          e.questionCount = qCount[e.id] || 0;
          e.hasEssay = essayExamIds.has(e.id);
          e.pendingGrading = pendingByExam[e.id] || 0;
        });
      }
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <Award size={28} className="text-primary-600 drop-shadow-sm" />
            Exams & Quizzes
          </h1>
          <p className="text-slate-500 font-medium">
            {role === 'student' ? 'Your available assessments and history' : 'Create and manage assessments'}
          </p>
        </div>
        {role !== 'student' && (
          <Button variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={16} /> New Assessment
          </Button>
        )}
      </div>

      {exams.length === 0 ? (
        <Card className="py-4">
          <EmptyState 
            icon={<ScrollText size={32} className="text-primary-400" />} 
            title="No assessments" 
            description={role === 'student' ? 'No exams available for your enrolled courses' : 'Create your first exam or quiz'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((e) => {
            const isQuiz = e.type === 'quiz';
            const isStudent = role === 'student';
            const attempt = e.attempt;
            const completed = attempt?.status === 'submitted' || attempt?.status === 'graded';
            const pct = completed && attempt?.total_marks ? Math.round((attempt.score / attempt.total_marks) * 100) : 0;
            const passed = pct >= (e.pass_marks || 50);

            return (
              <div key={e.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col card-hover relative overflow-hidden group">
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${isQuiz ? 'bg-gradient-to-r from-violet-400 to-fuchsia-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`} />
                <div className="flex items-start justify-between gap-3 mb-4 mt-2">
                  <div className="flex items-center gap-2">
                    <Badge color={isQuiz ? 'purple' : 'blue'}>{e.type?.toUpperCase() || 'EXAM'}</Badge>
                    <Badge color={e.status === 'published' ? 'success' : e.status === 'closed' ? 'slate' : 'warning'}>{e.status}</Badge>
                  </div>
                  {isStudent && completed && (
                    <Badge color={passed ? 'success' : 'danger'} className="shadow-sm">{passed ? 'PASSED' : 'FAILED'}</Badge>
                  )}
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 line-clamp-1 mb-1 group-hover:text-primary-600 transition-colors tracking-tight">{e.title}</h3>
                {e.course && <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 truncate">{e.course.title}</p>}
                
                <p className="text-sm text-slate-500 mb-6 line-clamp-2 flex-grow leading-relaxed">{e.description || 'No description provided.'}</p>
                
                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> {e.duration_minutes}m</span>
                  <span className="flex items-center gap-1.5"><FileText size={14} className="text-slate-400" /> {e.questionCount || 0} Qs</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> {e.pass_marks}% Pass</span>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-auto flex flex-wrap gap-3">
                  {isStudent ? (
                    completed ? (
                      <button className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all font-bold text-sm ${passed ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-100/50' : 'border-rose-100 bg-rose-50 text-rose-700 hover:border-rose-200 hover:bg-rose-100/50'}`} onClick={() => viewAttemptResult(e.id)}>
                        <span className="flex items-center gap-2">
                          <Award size={16} className={passed ? 'text-emerald-500' : 'text-rose-500'} /> 
                          Score: {attempt.score}/{attempt.total_marks}
                        </span>
                        <span className="text-base">{pct}%</span>
                      </button>
                    ) : (
                      <Button 
                        size="md" 
                        variant="gradient"
                        className={`w-full ${e.status !== 'published' ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                        onClick={() => setTaking(e)} 
                        disabled={e.status !== 'published'}
                      >
                        {attempt ? (
                          <><Activity size={16} className="mr-1" /> Resume {isQuiz ? 'Quiz' : 'Exam'}</>
                        ) : (
                          <><Play size={16} className="mr-1 fill-white" /> Start {isQuiz ? 'Quiz' : 'Exam'}</>
                        )}
                      </Button>
                    )
                  ) : (
                    <div className="flex flex-wrap gap-2 w-full">
                      <Button size="sm" variant="secondary" className="flex-1 min-w-[88px]" onClick={() => { setEditing(e); setShowForm(true); }}>
                        <Settings size={14} /> Edit
                      </Button>
                      <Button size="sm" variant="primary" className="flex-1 min-w-[88px] bg-primary-50 text-primary-700 hover:bg-primary-100" onClick={() => setManaging(e)}>
                        <FileText size={14} /> Setup
                      </Button>
                      {e.hasEssay && (
                        <Button size="sm" variant="primary" className="flex-1 min-w-[88px] bg-amber-50 text-amber-700 hover:bg-amber-100 relative" onClick={() => setGrading(e)}>
                          <UserCheck size={14} /> Grade
                          {!!e.pendingGrading && (
                            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                              {e.pendingGrading}
                            </span>
                          )}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="flex-1 min-w-[88px] text-slate-500 hover:text-slate-800" onClick={async () => {
                        const next = e.status === 'draft' ? 'published' : e.status === 'published' ? 'closed' : 'draft';
                        await supabase.from('exams').update({ status: next }).eq('id', e.id);
                        load();
                      }}>
                        {e.status === 'draft' ? 'Publish' : e.status === 'published' ? 'Close' : 'Reopen'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <ExamForm exam={editing} courses={courses} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {managing && <ManageQuestions exam={managing} onClose={() => setManaging(null)} onDone={() => { setManaging(null); load(); }} />}
      {taking && <TakeExam exam={taking} onClose={() => { setTaking(null); load(); }} />}
      {viewingResult && <ExamResult attempt={viewingResult} onClose={() => setViewingResult(null)} />}
      {grading && <GradeEssays exam={grading} onClose={() => setGrading(null)} onDone={() => { setGrading(null); load(); }} />}
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
    <Modal open onClose={onClose} title={exam ? 'Edit Assessment' : 'New Assessment'} maxW="max-w-2xl">
      <div className="space-y-6 p-6 pt-2">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="label">Assessment Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Midterm Exam" required />
          </div>
          <div>
            <label className="label">Type</label>
            <Select value={type} onChange={e => setType(e.target.value as 'exam' | 'quiz')}>
              <option value="exam">Formal Exam</option>
              <option value="quiz">Practice Quiz</option>
            </Select>
          </div>
        </div>
        
        <div>
          <label className="label">Associated Course</label>
          <Select value={courseId} onChange={e => setCourseId(e.target.value)}>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
        </div>
        
        <div>
          <label className="label">Description / Instructions</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Instructions for students..." />
        </div>
        
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="label">Duration (minutes)</label>
            <Input value={duration} onChange={e => setDuration(e.target.value)} type="number" />
          </div>
          <div>
            <label className="label">Passing Score (%)</label>
            <Input value={passMarks} onChange={e => setPassMarks(e.target.value)} type="number" />
          </div>
        </div>
        
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-inner-soft">
          <label className="flex items-center gap-3 text-sm font-bold text-slate-700 cursor-pointer group">
            <input type="checkbox" checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            <Shuffle size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors" /> Randomise Questions
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-slate-700 cursor-pointer group">
            <input type="checkbox" checked={shuffleO} onChange={(e) => setShuffleO(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            <Shuffle size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors" /> Randomise Options
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-slate-700 cursor-pointer group">
            <input type="checkbox" checked={allowResume} onChange={(e) => setAllowResume(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            <Activity size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors" /> Allow Resume
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-slate-700 cursor-pointer group">
            <input type="checkbox" checked={autoEval} onChange={(e) => setAutoEval(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            <CheckCircle2 size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors" /> Auto Evaluate
          </label>
        </div>
        
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !title || !courseId}>
            {saving ? 'Saving...' : 'Save Assessment'}
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
      await supabase.from('exam_questions').insert({ exam_id: exam.id, question_id: qid, order_index: assigned.size });
      setAssigned((s) => new Set(s).add(qid));
    }
  };

  const filtered = questions.filter((q) => !search || q.question_text.toLowerCase().includes(search.toLowerCase()) || q.category?.toLowerCase().includes(search.toLowerCase()));
  const totalMarks = Array.from(assigned).reduce((acc, id) => acc + (questions.find(q => q.id === id)?.marks || 0), 0);

  return (
    <Modal open onClose={onClose} title={`Manage Questions — ${exam.title}`} maxW="max-w-4xl">
      {loading ? <div className="p-12 flex justify-center"><Spinner /></div> : (
        <div className="flex flex-col h-[75vh] p-6 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner-soft">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center font-black text-xl shadow-sm">
                {assigned.size}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 tracking-tight">Questions Selected</p>
                <p className="text-xs font-bold text-primary-600 uppercase tracking-widest">{totalMarks} Total Marks</p>
              </div>
            </div>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search question bank..." className="sm:w-72 bg-white shadow-sm" />
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {filtered.map((q) => {
              const isAssigned = assigned.has(q.id);
              return (
                <div 
                  key={q.id} 
                  onClick={() => toggle(q.id)}
                  className={`flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 group ${
                    isAssigned 
                      ? 'bg-primary-50/50 border-primary-200 shadow-sm' 
                      : 'bg-white border-transparent hover:border-slate-200 hover:shadow-sm'
                  }`}
                >
                  <div className="mt-1">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isAssigned ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-300 text-transparent group-hover:border-primary-400'}`}>
                      <CheckCircle2 size={16} className={isAssigned ? 'opacity-100' : 'opacity-0'} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge color={q.difficulty === 'hard' ? 'danger' : q.difficulty === 'medium' ? 'warning' : 'success'}>{q.difficulty}</Badge>
                      <Badge color="slate" className="bg-slate-100 text-slate-600">{q.type.replace('_', ' ')}</Badge>
                      {q.category && <Badge color="purple" className="bg-purple-100 text-purple-700">{q.category}</Badge>}
                      <span className="text-xs font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md ml-auto">{q.marks} Marks</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 line-clamp-3 leading-relaxed">{q.question_text}</p>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
                <ScrollText size={48} className="mb-4 opacity-20" />
                <p className="font-medium text-slate-500">No questions match your search.</p>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-6 mt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Save size={12} /> Auto-saved</p>
            <Button variant="gradient" onClick={onDone} size="lg" className="px-8 shadow-md">Done Editing</Button>
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
    onClose();
  };

  if (loading) return <Modal open onClose={() => {}} title={exam.title} maxW="max-w-md"><Spinner /></Modal>;

  if (result) {
    const passed = result.pct >= exam.pass_marks;
    return (
      <Modal open onClose={onClose} title="Assessment Complete" maxW="max-w-md">
        <div className="text-center py-10 px-6">
          <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center shadow-inner-soft border-4 ${passed ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
            <Award size={48} />
          </div>
          <h2 className="text-5xl font-black text-slate-800 mb-2 tracking-tighter">{result.score} <span className="text-2xl text-slate-400 font-bold">/ {result.total}</span></h2>
          <p className="text-lg font-bold text-slate-500 mb-6 uppercase tracking-widest">{Math.round(result.pct)}% Score</p>
          
          <div className={`inline-block px-6 py-2 rounded-full font-black text-sm tracking-widest mb-10 border-2 uppercase ${
            passed ? 'bg-emerald-100/50 text-emerald-600 border-emerald-200' : 'bg-rose-100/50 text-rose-600 border-rose-200'
          }`}>
            {passed ? 'PASSED' : 'FAILED'}
          </div>
          
          <div className="flex flex-col gap-3">
            <Button onClick={onClose} variant="gradient" className="w-full py-4 text-lg">Return to Dashboard</Button>
          </div>
        </div>
      </Modal>
    );
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isTimeLow = timeLeft < 300;

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== '' && (Array.isArray(answers[k]) ? answers[k].length > 0 : true)).length;

  return (
    <Modal open onClose={() => {}} title={exam.title} maxW="max-w-6xl">
      <div className="flex flex-col h-[85vh] bg-slate-50 -m-6 rounded-b-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-black text-xl shadow-sm border ${isTimeLow ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
              <Clock size={20} className={isTimeLow ? 'text-rose-500' : 'text-slate-400'} /> 
              {mins}:{secs.toString().padStart(2, '0')}
            </div>
            <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Progress</span>
              <span className="text-sm font-black text-primary-600">{answeredCount} of {questions.length} Answered</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleExitAndSave} disabled={submitting} className="font-bold border-slate-300 text-slate-600 hover:bg-slate-50">
              <Save size={16} className="mr-2" /> Save & Pause
            </Button>
            <Button variant="gradient" onClick={() => {
              if (answeredCount < questions.length && !confirm("You haven't answered all questions. Submit anyway?")) return;
              submit();
            }} disabled={submitting} className="px-6 font-bold shadow-md">
              {submitting ? 'Submitting...' : 'Submit Exam'}
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
          
          {/* Question Navigator Sidebar */}
          <div className="w-full md:w-72 bg-white border-r border-slate-200 p-5 overflow-y-auto custom-scrollbar shadow-sm z-0">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Question Navigator</h3>
            <div className="grid grid-cols-5 md:grid-cols-4 gap-2.5">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '' && (Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : true);
                const isCurrent = currentIndex === idx;
                
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-11 rounded-xl text-sm font-black flex items-center justify-center border-2 transition-all ${
                      isCurrent 
                        ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm scale-105' 
                        : isAnswered 
                          ? 'border-success-400 bg-success-50 text-success-700' 
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Question Display */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            {currentQ && (
              <div className="max-w-4xl mx-auto flex flex-col min-h-full">
                <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Question {currentIndex + 1}</h2>
                  <Badge color="primary" className="text-sm px-3 py-1 shadow-sm font-bold">{currentQ.examMarks} Marks</Badge>
                </div>
                
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-6 flex-grow flex flex-col">
                  <p className="text-xl text-slate-800 font-medium leading-relaxed mb-8">
                    {currentQ.question_text}
                  </p>
                  
                  <div className="space-y-4 mt-auto">
                    {currentQ.type === 'mcq' && (currentQ.options || []).map((o, oi) => (
                      <label key={oi} className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all group ${
                        answers[currentQ.id] === oi ? 'border-primary-500 bg-primary-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-slate-50'
                      }`}>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          answers[currentQ.id] === oi ? 'border-primary-600' : 'border-slate-300 group-hover:border-primary-400'
                        }`}>
                          {answers[currentQ.id] === oi && <div className="w-3 h-3 rounded-full bg-primary-600" />}
                        </div>
                        <span className="text-lg text-slate-700 font-medium">{o}</span>
                      </label>
                    ))}
                    
                    {currentQ.type === 'multiple_select' && (currentQ.options || []).map((o, oi) => {
                      const sel: number[] = answers[currentQ.id] || [];
                      const isSelected = sel.includes(oi);
                      return (
                        <label key={oi} className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all group ${
                          isSelected ? 'border-primary-500 bg-primary-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-slate-50'
                        }`}>
                          <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'border-2 border-slate-300 text-transparent group-hover:border-primary-400'
                          }`}>
                            <CheckCircle2 size={16} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                          </div>
                          <span className="text-lg text-slate-700 font-medium">{o}</span>
                        </label>
                      );
                    })}
                    
                    {currentQ.type === 'true_false' && (
                      <div className="grid grid-cols-2 gap-5">
                        {[{ v: 'true', l: 'True' }, { v: 'false', l: 'False' }].map((o) => {
                          const isSelected = answers[currentQ.id] === o.v;
                          return (
                            <label key={o.v} className={`flex flex-col items-center justify-center gap-3 py-8 rounded-2xl border-2 cursor-pointer transition-all group ${
                              isSelected ? 'border-primary-500 bg-primary-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-slate-50'
                            }`}>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                isSelected ? 'border-primary-600' : 'border-slate-300 group-hover:border-primary-400'
                              }`}>
                                {isSelected && <div className="w-3 h-3 rounded-full bg-primary-600" />}
                              </div>
                              <span className="text-xl font-black text-slate-700 tracking-tight">{o.l}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    
                    {currentQ.type === 'short_answer' && (
                      <Input
                        value={answers[currentQ.id] || ''}
                        onChange={(e) => setAnswer(currentQ.id, e.target.value)}
                        placeholder="Type your answer here..."
                        className="text-lg py-4 shadow-inner-soft bg-slate-50 rounded-2xl border-slate-200 focus:bg-white"
                      />
                    )}

                    {currentQ.type === 'essay' && (
                      <Textarea
                        value={answers[currentQ.id] || ''}
                        onChange={(e) => setAnswer(currentQ.id, e.target.value)}
                        rows={10}
                        placeholder="Write your detailed response here..." 
                        className="text-base leading-relaxed shadow-inner-soft bg-slate-50 rounded-2xl border-slate-200 focus:bg-white p-5"
                      />
                    )}
                  </div>
                </div>

                {/* Next/Prev Buttons */}
                <div className="flex items-center justify-between mt-auto">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="px-8 py-3 font-bold text-slate-600 border-slate-300 hover:bg-white shadow-sm"
                  >
                    Previous
                  </Button>
                  
                  {currentIndex < questions.length - 1 ? (
                    <Button 
                      variant="primary"
                      onClick={() => setCurrentIndex(currentIndex + 1)}
                      className="px-10 py-3 font-bold shadow-md text-lg"
                    >
                      Next Question
                    </Button>
                  ) : (
                    <Button 
                      variant="gradient"
                      onClick={() => submit()}
                      className="px-10 py-3 font-bold shadow-md text-lg"
                    >
                      Finish Exam
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
    <Modal open onClose={onClose} title={`Results: ${exam?.title || 'Exam'}`} maxW="max-w-4xl">
      <div className="space-y-6 p-6 pt-2">
        
        {/* Score Header */}
        <div className={`p-8 rounded-3xl flex flex-col md:flex-row items-center gap-8 shadow-sm border ${passed ? 'bg-success-50 border-success-200' : 'bg-danger-50 border-danger-200'}`}>
          <div className={`w-28 h-28 rounded-full flex flex-col items-center justify-center border-4 shadow-md bg-white shrink-0 ${passed ? 'border-success-400 text-success-600' : 'border-danger-400 text-danger-600'}`}>
            <span className="text-3xl font-black">{pct}%</span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">{passed ? 'Congratulations, you passed!' : 'You did not pass this time.'}</h2>
            <p className="text-slate-600 text-lg mb-6">You scored <span className="font-black text-slate-800">{attempt.score}</span> out of <span className="font-black text-slate-800">{attempt.total_marks}</span> points.</p>
            
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              <span className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm text-sm font-bold text-slate-600">
                <Clock size={16} className="text-primary-500" /> Time taken: {Math.floor((attempt.time_spent_seconds || 0) / 60)}m {(attempt.time_spent_seconds || 0) % 60}s
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm text-sm font-bold text-slate-600">
                <CheckCircle2 size={16} className="text-success-500" /> Required: {exam?.pass_marks}%
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Review */}
        <div className="space-y-5">
          <h3 className="text-xl font-black text-slate-800 tracking-tight pl-2 border-l-4 border-primary-500">Detailed Review</h3>
          
          {responses.map((resp, i) => {
            const q = resp.question;
            if (!q) return null;
            
            const isCorrect = resp.is_correct;
            const needsGrading = q.type === 'essay' && resp.graded_at === null;

            return (
              <div key={resp.question_id} className={`bg-white p-6 rounded-3xl border shadow-sm ${
                needsGrading ? 'border-warning-200' : 
                isCorrect ? 'border-success-200' : 
                'border-danger-200'
              }`}>
                <div className="flex items-start gap-5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-lg text-white shadow-sm ${
                    needsGrading ? 'bg-warning-500' :
                    isCorrect ? 'bg-success-500' : 
                    'bg-danger-500'
                  }`}>
                    {i + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                      <p className="text-lg font-bold text-slate-800 leading-snug">{q.question_text}</p>
                      <Badge color="slate" className="shrink-0 bg-slate-100 text-slate-600 shadow-sm font-black whitespace-nowrap">{resp.marks_awarded || 0} / {q.marks} Pts</Badge>
                    </div>
                    
                    <div className="mt-5 p-5 rounded-2xl bg-slate-50 border border-slate-100 shadow-inner-soft">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Your Answer</p>
                      
                      {q.type === 'mcq' && (
                        <p className="text-base font-bold text-slate-700">
                          {resp.selected_option_ids?.[0] !== undefined ? q.options[resp.selected_option_ids[0]] : <span className="italic text-slate-400 font-medium">No answer provided</span>}
                        </p>
                      )}
                      {q.type === 'multiple_select' && (
                        <ul className="list-disc list-inside space-y-1 text-base font-bold text-slate-700">
                          {(resp.selected_option_ids || []).map((idx: number) => (
                            <li key={idx}>{q.options[idx]}</li>
                          ))}
                          {(!resp.selected_option_ids || resp.selected_option_ids.length === 0) && <span className="italic text-slate-400 font-medium">No answer provided</span>}
                        </ul>
                      )}
                      {(q.type === 'short_answer' || q.type === 'essay' || q.type === 'true_false') && (
                        <p className="text-base font-medium text-slate-700 whitespace-pre-wrap">
                          {resp.answer_text || <span className="italic text-slate-400">No answer provided</span>}
                        </p>
                      )}
                    </div>
                    
                    {!isCorrect && q.correct_answer !== null && q.correct_answer !== undefined && q.type !== 'essay' && (
                      <div className="mt-4 p-5 rounded-2xl bg-success-50 border border-success-100">
                        <p className="text-xs font-black text-success-600 uppercase tracking-widest mb-2">Correct Answer</p>
                        <p className="text-base font-bold text-success-800">
                          {q.type === 'mcq' ? q.options[q.correct_answer[0]] : 
                           q.type === 'true_false' ? (q.correct_answer ? 'True' : 'False') :
                           q.correct_answer}
                        </p>
                      </div>
                    )}
                    
                    {q.explanation && (
                      <div className="mt-4 flex items-start gap-3 text-sm font-medium text-slate-700 bg-primary-50 p-4 rounded-2xl border border-primary-100">
                        <AlertCircle size={18} className="text-primary-600 shrink-0 mt-0.5" />
                        <p>{q.explanation}</p>
                      </div>
                    )}
                    
                    {needsGrading && (
                      <div className="mt-4 flex items-start gap-3 text-sm font-bold text-warning-800 bg-warning-50 p-4 rounded-2xl border border-warning-200">
                        <AlertTriangle size={18} className="text-warning-600 shrink-0 mt-0.5" />
                        <p>This essay response is pending manual grading by your professor.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <Button variant="secondary" onClick={onClose} size="lg">Close Review</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Grade Essays (manual grading) ─────────────────────────────────────────────
interface GradeGroup {
  attemptId: string;
  student: { id: string; full_name: string; email: string } | null;
  totalMarks: number;
  submittedAt: string | null;
  responses: {
    questionId: string;
    questionText: string;
    maxMarks: number;
    answerText: string;
    marksAwarded: number | null;
    gradedAt: string | null;
  }[];
}

function GradeEssays({ exam, onClose, onDone }: { exam: Exam; onClose: () => void; onDone: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [groups, setGroups] = useState<GradeGroup[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: eq, error: eqErr } = await supabase
        .from('exam_questions')
        .select('question_id, marks, question:question_bank(question_text, type)')
        .eq('exam_id', exam.id);
      if (eqErr) throw eqErr;

      const essayQuestions = (eq || []).filter((x: any) => x.question?.type === 'essay');
      if (essayQuestions.length === 0) { setGroups([]); setLoading(false); return; }
      const essayQIds = essayQuestions.map((x: any) => x.question_id);
      const qMap = new Map(essayQuestions.map((x: any) => [x.question_id, x]));

      const { data: attempts, error: attErr } = await supabase
        .from('exam_attempts')
        .select('id, student_id, submitted_at, status, total_marks, student:profiles(id, full_name, email)')
        .eq('exam_id', exam.id)
        .in('status', ['submitted', 'graded']);
      if (attErr) throw attErr;
      if (!attempts || attempts.length === 0) { setGroups([]); setLoading(false); return; }
      const attemptIds = attempts.map((a: any) => a.id);

      const { data: responses, error: respErr } = await supabase
        .from('exam_responses')
        .select('attempt_id, question_id, answer_text, marks_awarded, graded_at')
        .in('attempt_id', attemptIds)
        .in('question_id', essayQIds);
      if (respErr) throw respErr;

      const respByAttempt = new Map<string, any[]>();
      (responses || []).forEach((r: any) => {
        const arr = respByAttempt.get(r.attempt_id) || [];
        arr.push(r);
        respByAttempt.set(r.attempt_id, arr);
      });

      const built: GradeGroup[] = attempts
        .map((a: any) => {
          const resp = respByAttempt.get(a.id) || [];
          if (resp.length === 0) return null;
          return {
            attemptId: a.id,
            student: a.student,
            totalMarks: a.total_marks,
            submittedAt: a.submitted_at,
            responses: resp.map((r: any) => {
              const q = qMap.get(r.question_id);
              return {
                questionId: r.question_id,
                questionText: q?.question?.question_text || '',
                maxMarks: q?.marks ?? 0,
                answerText: r.answer_text || '',
                marksAwarded: r.marks_awarded,
                gradedAt: r.graded_at,
              };
            }),
          };
        })
        .filter((g: GradeGroup | null): g is GradeGroup => g !== null);

      setGroups(built);
    } catch (err: any) {
      setError(err.message || 'Failed to load submissions for grading.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [exam.id]);

  const saveResponse = async (attemptId: string, questionId: string, maxMarks: number) => {
    const key = `${attemptId}:${questionId}`;
    const raw = drafts[key];
    const value = raw !== undefined ? parseFloat(raw) : NaN;
    if (isNaN(value)) { setError('Enter a valid mark before saving.'); return; }
    if (value < 0 || value > maxMarks) { setError(`Marks must be between 0 and ${maxMarks}.`); return; }
    setError('');
    setSaving(key);
    try {
      const { error: updErr } = await supabase
        .from('exam_responses')
        .update({ marks_awarded: value, is_correct: value > 0, graded_by: profile!.id, graded_at: new Date().toISOString() })
        .eq('attempt_id', attemptId)
        .eq('question_id', questionId);
      if (updErr) throw updErr;

      // Recompute the attempt's total score across ALL its responses (auto-graded + essay)
      const { data: allResp, error: allErr } = await supabase
        .from('exam_responses')
        .select('marks_awarded, graded_at, question:question_bank(type)')
        .eq('attempt_id', attemptId);
      if (allErr) throw allErr;

      const score = (allResp || []).reduce((s: number, r: any) => s + (r.marks_awarded || 0), 0);
      const stillPending = (allResp || []).some((r: any) => r.question?.type === 'essay' && !r.graded_at);

      const { error: attErr } = await supabase
        .from('exam_attempts')
        .update({ score, status: stillPending ? 'submitted' : 'graded' })
        .eq('id', attemptId);
      if (attErr) throw attErr;

      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to save grade.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Grade Essay Responses — ${exam.title}`} maxW="max-w-4xl">
      {loading ? (
        <div className="p-12 flex justify-center"><Spinner /></div>
      ) : (
        <div className="flex flex-col max-h-[75vh] p-6 pt-2">
          {error && (
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-danger-700 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="shrink-0" /> {error}
            </div>
          )}
          {groups.length === 0 ? (
            <EmptyState
              icon={<UserCheck size={32} className="text-primary-400" />}
              title="Nothing to grade yet"
              description="No essay responses have been submitted for this assessment."
            />
          ) : (
            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
              {groups.map((g) => (
                <div key={g.attemptId} className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="font-bold text-slate-800">{g.student?.full_name || g.student?.email || 'Student'}</p>
                      <p className="text-xs text-slate-400">Submitted {g.submittedAt ? formatDateTime(g.submittedAt) : '—'}</p>
                    </div>
                    <Badge color="slate">{g.totalMarks} total marks</Badge>
                  </div>
                  <div className="space-y-4">
                    {g.responses.map((r) => {
                      const key = `${g.attemptId}:${r.questionId}`;
                      const graded = !!r.gradedAt;
                      return (
                        <div key={key} className="bg-white rounded-xl border border-slate-100 p-4">
                          <p className="text-sm font-semibold text-slate-700 mb-2">{r.questionText}</p>
                          <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-3 whitespace-pre-wrap">
                            {r.answerText || <span className="italic text-slate-400">No answer provided</span>}
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <Input
                              type="number"
                              min={0}
                              max={r.maxMarks}
                              step="0.5"
                              placeholder={`0–${r.maxMarks}`}
                              defaultValue={r.marksAwarded ?? undefined}
                              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                              className="w-28"
                            />
                            <span className="text-xs text-slate-400">/ {r.maxMarks} marks</span>
                            <Button
                              size="sm"
                              variant={graded ? 'secondary' : 'gradient'}
                              disabled={saving === key}
                              onClick={() => saveResponse(g.attemptId, r.questionId, r.maxMarks)}
                            >
                              {saving === key ? 'Saving...' : graded ? 'Update Grade' : 'Save Grade'}
                            </Button>
                            {graded && <Badge color="success">Graded</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-6 mt-4 border-t border-slate-100">
            <Button variant="gradient" onClick={onDone} size="lg" className="px-8 shadow-md">Done Grading</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
