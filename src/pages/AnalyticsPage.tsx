import { useEffect, useState } from 'react';
import { 
  BarChart3, TrendingUp, Clock, Award, Target, CheckCircle, 
  ClipboardCheck, LogIn, Users, FileText, Activity, BookOpen, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { StatCard, ChartCard, BarChart, LineChart, DonutChart } from '../components/charts';
import { Spinner, ProgressBar, Badge } from '../components/ui';

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (role === 'admin') await loadAdmin(setData);
      else if (role === 'professor') await loadProf(setData, profile!.id);
      else await loadStudent(setData, profile!.id);
      setLoading(false);
    })();
  }, [role, profile?.id]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Activity size={24} className="text-indigo-600" />
          Analytics Engine
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {role === 'admin' ? 'Institution-wide metrics and KPIs' : 
           role === 'professor' ? 'Course performance and student engagement' : 
           'Your learning progress and performance insights'}
        </p>
      </div>
      <AnalyticsView role={role} data={data} />
    </div>
  );
}

// ─── ADMIN ANALYTICS ──────────────────────────────────────────────────────────
async function loadAdmin(setData: (d: any) => void) {
  // Fetch a broad set of global metrics
  const [profiles, courses, enrollments, attempts, lectures, logins] = await Promise.all([
    supabase.from('profiles').select('id, role, status, created_at'),
    supabase.from('courses').select('id, status, category'),
    supabase.from('enrollments').select('id, status, progress_pct, enrolled_at'),
    supabase.from('exam_attempts').select('score, total_marks, status, started_at'),
    supabase.from('lectures').select('id, created_at'),
    supabase.from('login_events').select('user_id, login_at').gte('login_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  ]);

  const p = profiles.data || [];
  const c = courses.data || [];
  const enr = enrollments.data || [];
  const att = attempts.data || [];
  
  // Active metrics
  const activeUsers = new Set((logins.data || []).map(l => l.user_id));
  const activeStudents = p.filter(x => x.role === 'student' && activeUsers.has(x.id)).length;
  const activeProfessors = p.filter(x => x.role === 'professor' && activeUsers.has(x.id)).length;
  const activeCourses = c.filter(x => x.status === 'published').length;

  // Success & Completion Rates
  const completedEnr = enr.filter(e => e.status === 'completed' || e.progress_pct === 100).length;
  const completionRate = enr.length ? (completedEnr / enr.length) * 100 : 0;
  
  const passedAttempts = att.filter(a => a.total_marks > 0 && (a.score / a.total_marks) >= 0.5).length;
  const successRate = att.length ? (passedAttempts / att.length) * 100 : 0;

  // Engagement Score (Global heuristic: active loggers + test takers / total students)
  const totalStudents = p.filter(x => x.role === 'student').length;
  const engagementScore = totalStudents ? (activeStudents / totalStudents) * 100 : 0;

  // Category Distribution
  const catDist: Record<string, number> = {};
  c.forEach(x => (catDist[x.category || 'General'] = (catDist[x.category || 'General'] || 0) + 1));

  // Platform Growth (Last 6 months)
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) { 
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString(undefined, { month: 'short' })); 
  }
  
  const growthByMonth = months.map((m, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const end = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    return { 
      label: m, 
      Users: p.filter(x => new Date(x.created_at) >= start && new Date(x.created_at) < end).length,
      Enrollments: enr.filter(x => new Date(x.enrolled_at) >= start && new Date(x.enrolled_at) < end).length
    };
  });

  setData({
    activeStudents, activeProfessors, activeCourses,
    completionRate: Math.round(completionRate),
    successRate: Math.round(successRate),
    engagementScore: Math.round(engagementScore),
    catDist: Object.entries(catDist).map(([label, value]) => ({ label, value })),
    growthByMonth
  });
}

// ─── PROFESSOR ANALYTICS ──────────────────────────────────────────────────────
async function loadProf(setData: (d: any) => void, profId: string) {
  const { data: courses } = await supabase.from('courses').select('id, title').eq('professor_id', profId);
  const ids = (courses || []).map(c => c.id);
  
  if (!ids.length) { setData({}); return; }

  const [lectures, enrollments, materials, attempts, progress] = await Promise.all([
    supabase.from('lectures').select('id, created_at').in('course_id', ids),
    supabase.from('enrollments').select('student_id, progress_pct, status').in('course_id', ids),
    supabase.from('course_materials').select('type, created_at, id').in('course_id', ids),
    supabase.from('exam_attempts').select('score, total_marks, time_spent_seconds').in('exam_id', 
      ((await supabase.from('exams').select('id').in('course_id', ids)).data || []).map(e => e.id)
    ),
    supabase.from('lecture_progress').select('completion_pct, total_watch_seconds').in('lecture_id', 
      ((await supabase.from('lectures').select('id').in('course_id', ids)).data || []).map(l => l.id)
    )
  ]);

  const enr = enrollments.data || [];
  const att = attempts.data || [];
  const prog = progress.data || [];
  const mats = materials.data || [];

  // Lecture Completion & Watch Time
  const avgLecCompletion = prog.length ? prog.reduce((s, p) => s + (p.completion_pct || 0), 0) / prog.length : 0;
  const totalWatchSecs = prog.reduce((s, p) => s + (p.total_watch_seconds || 0), 0);
  const avgWatchMins = prog.length ? (totalWatchSecs / prog.length) / 60 : 0;

  // Content Utilization
  const matByType: Record<string, number> = {};
  mats.forEach(m => (matByType[m.type] = (matByType[m.type] || 0) + 1));

  // Student Engagement (Composite)
  // Formula: (Avg Progress + Avg Lec Completion) / 2
  const avgProgress = enr.length ? enr.reduce((s, e) => s + (e.progress_pct || 0), 0) / enr.length : 0;
  const engagementScore = (avgProgress + avgLecCompletion) / 2;

  // Lecture Upload Trends (Last 6 months)
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) { 
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString(undefined, { month: 'short' })); 
  }
  const lecByMonth = months.map((m, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const end = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    return { 
      label: m, 
      value: (lectures.data || []).filter(l => new Date(l.created_at) >= start && new Date(l.created_at) < end).length 
    };
  });

  setData({
    totalStudents: new Set(enr.map(e => e.student_id)).size,
    avgProgress: Math.round(avgProgress),
    engagementScore: Math.round(engagementScore),
    avgLecCompletion: Math.round(avgLecCompletion),
    avgWatchMins: Math.round(avgWatchMins),
    matByType: Object.entries(matByType).map(([label, value]) => ({ label, value })),
    lecByMonth
  });
}

// ─── STUDENT ANALYTICS ────────────────────────────────────────────────────────
async function loadStudent(setData: (d: any) => void, studentId: string) {
  const [enr, prog, att, attendance, responses] = await Promise.all([
    supabase.from('enrollments').select('progress_pct, status, course:courses(title), enrolled_at').eq('student_id', studentId),
    supabase.from('lecture_progress').select('total_watch_seconds, completed_at, created_at').eq('student_id', studentId),
    supabase.from('exam_attempts').select('score, total_marks, exam:exams(type)').eq('student_id', studentId),
    supabase.from('lecture_attendance').select('status').eq('student_id', studentId),
    supabase.from('exam_responses').select('is_correct, question:question_bank(subject, topic)').eq('student_id', studentId) // Assuming we join attempt to get student_id, simplified here by fetching all responses via attempt join in real app.
  ]);

  // For real app, fetching weak topics requires joining attempts and responses:
  const { data: realResponses } = await supabase
    .from('exam_responses')
    .select('is_correct, attempt:exam_attempts!inner(student_id), question:question_bank(subject, topic)')
    .eq('attempt.student_id', studentId);

  const e = enr.data || [];
  const p = prog.data || [];
  const a = att.data || [];
  const r = realResponses || [];

  // Learning Hours
  const totalWatchSecs = p.reduce((s, x) => s + (x.total_watch_seconds || 0), 0);
  const learningHours = (totalWatchSecs / 3600).toFixed(1);

  // Attendance
  const attTotal = attendance.data?.length || 0;
  const attPresent = attendance.data?.filter(x => x.status === 'present').length || 0;
  const attendanceRate = attTotal ? (attPresent / attTotal) * 100 : 0;

  // Quiz vs Exam Scores
  const quizzes = a.filter(x => x.exam?.type === 'quiz');
  const exams = a.filter(x => x.exam?.type === 'exam');
  
  const avgQuiz = quizzes.length ? quizzes.reduce((s, q) => s + (q.score / (q.total_marks || 1)), 0) / quizzes.length * 100 : 0;
  const avgExam = exams.length ? exams.reduce((s, ex) => s + (ex.score / (ex.total_marks || 1)), 0) / exams.length * 100 : 0;

  // Progress Trends (Cumulative completion over last 6 months)
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) { 
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString(undefined, { month: 'short' })); 
  }
  let cumulativeWatch = 0;
  const progressTrends = months.map((m, i) => {
    const end = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    const mWatch = p.filter(x => new Date(x.created_at) < end).reduce((s, x) => s + (x.total_watch_seconds || 0) / 3600, 0);
    return { label: m, Hours: Math.round(mWatch * 10) / 10 };
  });

  // Weak Topics
  const topicStats: Record<string, { correct: number, total: number }> = {};
  r.forEach((resp: any) => {
    const q = resp.question;
    if (!q) return;
    const topic = q.topic || q.subject || 'General';
    if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
    topicStats[topic].total += 1;
    if (resp.is_correct) topicStats[topic].correct += 1;
  });

  const weakTopics = Object.entries(topicStats)
    .map(([label, stats]) => ({
      label,
      score: Math.round((stats.correct / stats.total) * 100)
    }))
    .sort((a, b) => a.score - b.score) // lowest first
    .slice(0, 5); // top 5 weakest

  setData({
    learningHours,
    attendanceRate: Math.round(attendanceRate),
    avgQuiz: Math.round(avgQuiz),
    avgExam: Math.round(avgExam),
    courseCount: e.length,
    completedCourses: e.filter(x => x.status === 'completed' || x.progress_pct === 100).length,
    progressTrends,
    weakTopics
  });
}

// ─── VIEW COMPONENT ───────────────────────────────────────────────────────────
function AnalyticsView({ role, data }: { role: string; data: any }) {
  if (role === 'admin') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Active Students" value={data.activeStudents} icon={<Users size={18} />} color="indigo" />
          <StatCard label="Active Profs" value={data.activeProfessors} icon={<ClipboardCheck size={18} />} color="sky" />
          <StatCard label="Active Courses" value={data.activeCourses} icon={<BookOpen size={18} />} color="violet" />
          <StatCard label="Completion Rate" value={`${data.completionRate}%`} icon={<Target size={18} />} color="emerald" />
          <StatCard label="Success Rate" value={`${data.successRate}%`} icon={<Award size={18} />} color="amber" />
          <StatCard label="Engagement" value={`${data.engagementScore}/100`} icon={<Activity size={18} />} color="rose" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChartCard title="Platform Growth (Users & Enrollments)">
              <BarChart data={data.growthByMonth || []} color="#4f46e5" />
            </ChartCard>
          </div>
          <div>
            <ChartCard title="Courses by Category">
              <DonutChart segments={(data.catDist || []).map((d: any, i: number) => ({
                label: d.label, value: d.value, color: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5]
              }))} />
            </ChartCard>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'professor') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Student Engagement" value={`${data.engagementScore}/100`} icon={<Activity size={20} />} color="rose" />
          <StatCard label="Avg Lec. Completion" value={`${data.avgLecCompletion}%`} icon={<CheckCircle size={20} />} color="emerald" />
          <StatCard label="Avg Watch Time" value={`${data.avgWatchMins}m`} icon={<Clock size={20} />} color="indigo" />
          <StatCard label="Total Students" value={data.totalStudents} icon={<Users size={20} />} color="sky" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Content Utilization (by Type)">
            <DonutChart segments={(data.matByType || []).map((d: any, i: number) => ({
              label: d.label.toUpperCase(), value: d.value, color: ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'][i % 5]
            }))} />
          </ChartCard>
          <ChartCard title="Lecture Upload Trends">
            <LineChart data={data.lecByMonth || []} color="#8b5cf6" />
          </ChartCard>
        </div>
      </div>
    );
  }

  // Student Role
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Learning Hours" value={data.learningHours} icon={<Clock size={18} />} color="indigo" />
        <StatCard label="Attendance" value={`${data.attendanceRate}%`} icon={<CheckCircle size={18} />} color="emerald" />
        <StatCard label="Enrolled Courses" value={data.courseCount} icon={<BookOpen size={18} />} color="sky" />
        <StatCard label="Completed" value={data.completedCourses} icon={<Target size={18} />} color="violet" />
        <StatCard label="Avg Quiz Score" value={`${data.avgQuiz}%`} icon={<ClipboardCheck size={18} />} color="amber" />
        <StatCard label="Avg Exam Score" value={`${data.avgExam}%`} icon={<Award size={18} />} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard title="Progress Trends (Learning Hours)">
            <LineChart data={data.progressTrends || []} color="#4f46e5" />
          </ChartCard>
        </div>
        <div>
          <ChartCard title="Areas for Improvement">
            <div className="space-y-4">
              {(data.weakTopics || []).map((wt: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{wt.label}</span>
                      <span className="text-xs font-bold text-rose-600">{wt.score}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${Math.max(wt.score, 5)}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
              {(!data.weakTopics || data.weakTopics.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <AlertTriangle size={32} className="mb-2 opacity-50 text-emerald-500" />
                  <p className="text-sm text-center">No weak topics identified yet.<br/>Keep taking quizzes!</p>
                </div>
              )}
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
