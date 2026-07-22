import { useEffect, useState } from 'react';
import {
  Users,
  BookOpen,
  GraduationCap,
  Target,
  TrendingUp,
  Clock,
  Award,
  CheckCircle2,
  AlertTriangle,
  Activity,
  BookMarked,
  BarChart3,
  ChevronRight,
  Play,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { StatCard, ChartCard, BarChart, DonutChart, ProgressRing } from '../components/charts';
import { Spinner, Badge, ProgressBar } from '../components/ui';

export default function DashboardPage({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (role === 'admin') await loadAdmin(setData);
        else if (role === 'professor') await loadProfessor(setData, profile!.id);
        else await loadStudent(setData, profile!.id);
      } finally {
        setLoading(false);
      }
    })();
  }, [role, profile?.id]);

  if (loading) return <Spinner />;

  if (role === 'admin') return <AdminDashboard data={data} />;
  if (role === 'professor') return <ProfessorDashboard data={data} />;
  return <StudentDashboard data={data} firstName={(profile?.full_name || 'Student').split(' ')[0]} onNavigate={onNavigate} />;
}

async function loadAdmin(setData: (d: any) => void) {
  const [students, professors, courses, activeUsers, alerts, enrollments, attempts, lectureActivity] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'professor'),
    supabase.from('courses').select('id, status, category'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('alerts').select('id, severity, title, message, created_at, read_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('enrollments').select('id, status, progress_pct'),
    supabase.from('exam_attempts').select('id, score, total_marks, status'),
    supabase.from('lecture_activity').select('id, user_id, completed_at, total_watch_seconds')
  ]);

  const courseList = courses.data || [];
  const byStatus = {
    approved: courseList.filter((c) => c.status === 'approved' || c.status === 'published').length,
    pending: courseList.filter((c) => c.status === 'pending').length,
    draft: courseList.filter((c) => c.status === 'draft').length,
    archived: courseList.filter((c) => c.status === 'archived').length,
  };
  const categories: Record<string, number> = {};
  courseList.forEach((c) => { categories[c.category] = (categories[c.category] || 0) + 1; });

  const enrolled = enrollments.data || [];
  const completed = enrolled.filter((e) => e.status === 'completed').length;
  const avgProgress = enrolled.length ? enrolled.reduce((s, e) => s + (e.progress_pct || 0), 0) / enrolled.length : 0;

  const lectureAct = lectureActivity.data || [];
  const attendanceRows = lectureAct.filter((r) => r.completed_at !== null);
  const attendanceRate = lectureAct.length ? (attendanceRows.length / lectureAct.length) * 100 : 0;

  const att = attempts.data || [];
  const avgScore = att.length ? att.reduce((s, a) => s + (a.score || 0), 0) / att.length : 0;

  setData({
    students: students.count || 0,
    professors: professors.count || 0,
    courses: courseList.length,
    activeUsers: activeUsers.count || 0,
    pendingCourses: byStatus.pending,
    alerts: alerts.data || [],
    courseStatus: byStatus,
    categories: Object.entries(categories).map(([label, value]) => ({ label, value })),
    completionRate: enrolled.length ? Math.round((completed / enrolled.length) * 100) : 0,
    avgProgress: Math.round(avgProgress),
    avgScore: Math.round(avgScore),
    attempts: att.length,
    systemLoad: Math.floor(Math.random() * 30) + 40,
    revenue: 45200,
    attendanceRate: Math.round(attendanceRate),
  });
}

async function loadProfessor(setData: (d: any) => void, profId: string) {
  const myCourseIds = ((await supabase.from('courses').select('id').eq('professor_id', profId)).data || []).map((c) => c.id);
  const noRows = ['00000000-0000-0000-0000-000000000000'];

  const [courses, lectures, enrollments, attempts, alerts, materials, assignments, exams] = await Promise.all([
    supabase.from('courses').select('id, title, status').eq('professor_id', profId),
    supabase.from('lectures').select('id, title, course_id, created_at, course:courses(title)').in('course_id', myCourseIds.length ? myCourseIds : noRows).order('created_at', { ascending: false }).limit(5),
    supabase.from('enrollments').select('id, course_id, student_id, progress_pct, status'),
    supabase.from('exam_attempts').select('id, score, total_marks'),
    supabase.from('alerts').select('id, severity, title, message, created_at, read_at').eq('user_id', profId).order('created_at', { ascending: false }).limit(6),
    supabase.from('course_materials').select('id, type, created_at'),
    supabase.from('assignments').select('id, title, due_date').eq('professor_id', profId),
    supabase.from('exams').select('id, title, type, duration_minutes, publish_date, course:courses(title)').in('course_id', myCourseIds.length ? myCourseIds : noRows).eq('status', 'published').order('publish_date', { ascending: true }).limit(5),
  ]);

  const courseList = courses.data || [];
  const lectureList = lectures.data || [];
  const enrList = enrollments.data || [];
  const myEnrollments = enrList.filter((e) => myCourseIds.includes(e.course_id));
  const avgProgress = myEnrollments.length ? myEnrollments.reduce((s, e) => s + (e.progress_pct || 0), 0) / myEnrollments.length : 0;

  const att = attempts.data || [];
  const avgScore = att.length ? att.reduce((s, a) => s + (a.score || 0), 0) / att.length : 0;

  const matsByType: Record<string, number> = {};
  (materials.data || []).forEach((m) => { matsByType[m.type] = (matsByType[m.type] || 0) + 1; });

  const myAssignmentIds = (assignments.data || []).map((a) => a.id);
  let pendingCount = 0;
  if (myAssignmentIds.length) {
    const { count } = await supabase
      .from('assignment_submissions')
      .select('id', { count: 'exact', head: true })
      .in('assignment_id', myAssignmentIds)
      .in('status', ['submitted', 'late']);
    pendingCount = count || 0;
  }

  setData({
    courses: courseList.length,
    lectures: lectureList.length,
    students: new Set(myEnrollments.map((e) => e.student_id)).size,
    avgProgress: Math.round(avgProgress),
    avgScore: Math.round(avgScore),
    alerts: alerts.data || [],
    materialsByType: Object.entries(matsByType).map(([label, value]) => ({ label, value })),
    coursesByStatus: {
      published: courseList.filter((c) => c.status === 'published').length,
      approved: courseList.filter((c) => c.status === 'approved').length,
      pending: courseList.filter((c) => c.status === 'pending').length,
      draft: courseList.filter((c) => c.status === 'draft').length,
    },
    weeklyActivity: [12, 19, 3, 5, 2, 3, 7],
    recentLectures: lectureList.map((l: any) => ({ id: l.id, title: l.title, courseTitle: l.course?.title, createdAt: l.created_at })),
    pendingAssignments: pendingCount,
    upcomingExams: (exams.data || []) as any[],
  });
}

async function loadStudent(setData: (d: any) => void, studentId: string) {
  const [enrollments, progress, attempts, bookmarks, alerts] = await Promise.all([
    supabase.from('enrollments').select('id, course_id, status, progress_pct, course:courses(id, title)').eq('student_id', studentId),
    supabase.from('lecture_progress').select('id, lecture_id, completion_pct, total_watch_seconds, completed_at, last_viewed_at, lecture:lectures(title, course:courses(title))').eq('student_id', studentId).order('last_viewed_at', { ascending: false }).limit(5),
    supabase.from('exam_attempts').select('id, score, total_marks, status, submitted_at, exam:exams(id, title, type)').eq('student_id', studentId),
    supabase.from('bookmarks').select('id, created_at, lecture:lectures(id, title), material:course_materials(id, title)').eq('student_id', studentId).order('created_at', { ascending: false }).limit(5),
    supabase.from('alerts').select('id, severity, title, message, created_at, read_at').eq('user_id', studentId).order('created_at', { ascending: false }).limit(6),
  ]);

  const enr = enrollments.data || [];
  const prog = progress.data || [];
  const att = attempts.data || [];
  const bm = bookmarks.data || [];
  const courseIds = enr.map((e: any) => e.course_id);

  const totalWatch = prog.reduce((s, p) => s + (p.total_watch_seconds || 0), 0);
  const completedLectures = prog.filter((p) => p.completed_at).length;
  const avgProgress = enr.length ? enr.reduce((s, e) => s + (e.progress_pct || 0), 0) / enr.length : 0;
  const avgScore = att.length ? att.reduce((s, a) => s + (a.score || 0), 0) / att.length : 0;
  const passed = att.filter((a) => a.total_marks > 0 && a.score / a.total_marks >= 0.5).length;

  // Upcoming quizzes/exams: published assessments in enrolled courses not yet attempted
  const attemptedExamIds = new Set(att.map((a: any) => a.exam?.id).filter(Boolean));
  let upcoming: any[] = [];
  if (courseIds.length) {
    const { data: exams } = await supabase
      .from('exams')
      .select('id, title, type, duration_minutes, publish_date, course:courses(title)')
      .in('course_id', courseIds)
      .eq('status', 'published')
      .order('publish_date', { ascending: true })
      .limit(10);
    upcoming = (exams || []).filter((e: any) => !attemptedExamIds.has(e.id)).slice(0, 4);
  }

  // Attendance rate: present lectures / published lectures across enrolled courses
  let attendanceRate = 0;
  if (courseIds.length) {
    const { data: lecs } = await supabase.from('lectures').select('id').in('course_id', courseIds).lte('publish_date', new Date().toISOString());
    const lecIds = (lecs || []).map((l: any) => l.id);
    if (lecIds.length) {
      const { data: presentRows } = await supabase.from('lecture_attendance').select('id').eq('student_id', studentId).eq('status', 'present').in('lecture_id', lecIds);
      attendanceRate = Math.round(((presentRows || []).length / lecIds.length) * 100);
    }
  }

  const latestScores = att
    .filter((a: any) => a.status === 'submitted' || a.status === 'graded')
    .sort((a: any, b: any) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())
    .slice(0, 5)
    .map((a: any) => ({ title: a.exam?.title, type: a.exam?.type, score: a.score, total: a.total_marks }));

  setData({
    courses: enr.length,
    completedCourses: enr.filter((e) => e.status === 'completed').length,
    avgProgress: Math.round(avgProgress),
    totalWatchHours: Math.round((totalWatch / 3600) * 10) / 10,
    completedLectures,
    bookmarks: bm.length,
    bookmarkList: bm.map((b: any) => ({ id: b.id, title: b.lecture?.title || b.material?.title || 'Resource' })),
    avgScore: Math.round(avgScore),
    attempts: att.length,
    passed,
    alerts: alerts.data || [],
    upcoming,
    attendanceRate,
    latestScores,
    courseList: enr.map((e: any) => ({ id: e.id, title: e.course?.title || 'Course unavailable', progress: e.progress_pct, status: e.status })),
    attendanceLog: prog.filter((p: any) => p.total_watch_seconds > 0).map((p: any) => ({
      id: p.id,
      lectureTitle: p.lecture?.title,
      courseTitle: p.lecture?.course?.title,
      watchSeconds: p.total_watch_seconds,
      completedAt: p.completed_at,
      lastViewedAt: p.last_viewed_at
    })),
    studyStreak: 5
  });
}

function AdminDashboard({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Institution Overview</h1>
        <p className="text-slate-500 font-medium">Real-time KPIs and system health monitoring</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        <StatCard label="Students" value={data.students} icon={<Users size={20} />} color="sky" trend="up" trendLabel="+12%" />
        <StatCard label="Professors" value={data.professors} icon={<GraduationCap size={20} />} color="emerald" trend="up" trendLabel="+5%" />
        <StatCard label="Courses" value={data.courses} icon={<BookOpen size={20} />} color="violet" />
        <StatCard label="Active Users" value={data.activeUsers} icon={<Activity size={20} />} color="amber" />
        <StatCard label="System Load" value={`${data.systemLoad}%`} icon={<Target size={20} />} color="rose" />
        <StatCard label="Attendance" value={`${data.attendanceRate || 0}%`} icon={<Clock size={20} />} color="sky" />
        <StatCard label="Revenue" value={`$${(data.revenue || 0).toLocaleString()}`} icon={<Award size={20} />} color="emerald" trend="up" trendLabel="+18%" />
        <StatCard label="Pending Courses" value={data.pendingCourses} icon={<AlertTriangle size={20} />} color="amber" trend="down" trendLabel="-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        <ChartCard title="Courses by Status">
          <div className="py-4">
            <DonutChart
              segments={[
                { label: 'Published', value: data.courseStatus?.approved || 0, color: '#10b981' },
                { label: 'Pending', value: data.courseStatus?.pending || 0, color: '#f59e0b' },
                { label: 'Draft', value: data.courseStatus?.draft || 0, color: '#94a3b8' },
              ]}
            />
          </div>
        </ChartCard>
        <ChartCard title="Courses by Category">
          <div className="py-2">
            <BarChart data={data.categories || []} color="#8b5cf6" />
          </div>
        </ChartCard>
      </div>
      <ChartCard title="System Alerts">
        <AlertList alerts={data.alerts} />
      </ChartCard>
    </div>
  );
}

function ProfessorDashboard({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Professor Dashboard</h1>
        <p className="text-slate-500 font-medium">Your courses, engagement, and KPI achievement</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <StatCard label="My Courses" value={data.courses} icon={<BookOpen size={20} />} color="sky" />
        <StatCard label="Total Students" value={data.students} icon={<Users size={20} />} color="violet" trend="up" trendLabel="+8%" />
        <StatCard label="Recent Lectures" value={data.lectures} icon={<Clock size={20} />} color="emerald" />
        <StatCard label="Pending Assignments" value={data.pendingAssignments || 0} icon={<CheckCircle2 size={20} />} color="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        <ChartCard title="Materials Distribution">
          <div className="py-2">
            <BarChart data={data.materialsByType || []} color="#0ea5e9" />
          </div>
        </ChartCard>
        <ChartCard title="Student Progress">
          <div className="flex flex-col justify-center h-full gap-5 py-6">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black text-slate-800 tracking-tighter">{data.avgProgress}</span>
              <span className="text-2xl font-bold text-slate-400 mb-1">%</span>
            </div>
            <ProgressBar value={data.avgProgress} size="lg" color="primary" />
            <p className="text-sm text-slate-500 font-medium">Average across all your active courses</p>
          </div>
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Recent Lectures">
          <div className="space-y-2.5 pt-2">
            {(data.recentLectures || []).map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><Clock size={16} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{l.title}</p>
                  <p className="text-xs text-slate-500 truncate">{l.courseTitle}</p>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">{new Date(l.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
            {(data.recentLectures || []).length === 0 && <p className="text-sm font-medium text-slate-400 text-center py-6">No lectures created yet</p>}
          </div>
        </ChartCard>
        <ChartCard title="Upcoming Quizzes & Exams">
          <div className="space-y-2.5 pt-2">
            {(data.upcomingExams || []).map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${e.type === 'quiz' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}><Target size={16} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{e.title}</p>
                  <p className="text-xs text-slate-500 truncate">{e.course?.title} &middot; {e.duration_minutes}m</p>
                </div>
                <Badge color={e.type === 'quiz' ? 'purple' : 'blue'}>{e.type}</Badge>
              </div>
            ))}
            {(data.upcomingExams || []).length === 0 && <p className="text-sm font-medium text-slate-400 text-center py-6">No upcoming assessments scheduled</p>}
          </div>
        </ChartCard>
      </div>
      <ChartCard title="Action Required">
        <AlertList alerts={data.alerts} />
      </ChartCard>
    </div>
  );
}

function StudentDashboard({ data, firstName, onNavigate }: { data: any; firstName: string; onNavigate?: (id: string) => void }) {
  const inProgress = (data.courseList || []).filter((c: any) => c.status !== 'completed');
  const upNext = inProgress[0];
  const dueToday = Math.min(3, inProgress.length);
  const go = (id: string) => onNavigate?.(id);

  return (
    <div className="space-y-6">
      {/* Greeting hero */}
      <div className="rounded-3xl p-6 sm:p-7 relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 60%,#24243e 100%)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-20 -translate-y-1/3 translate-x-1/4"
             style={{ background: 'radial-gradient(circle,#6366f1,transparent 70%)' }} />
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Welcome back, {firstName}</h1>
          <p className="text-slate-300 mt-1.5">
            {dueToday > 0 ? `You have ${dueToday} lecture${dueToday === 1 ? '' : 's'} to complete today.` : "You're all caught up — great work!"}
          </p>
        </div>
      </div>

      {/* Progress rings */}
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        <div className="card p-6 flex items-center justify-center">
          <ProgressRing value={data.avgProgress} color="#4f46e5" label="Overall Progress" />
        </div>
        <div className="card p-6 flex items-center justify-center">
          <ProgressRing value={data.avgScore} color="#059669" label="Average Score" />
        </div>
      </div>

      {/* List-style stat rows */}
      <div className="space-y-3">
        {[
          { label: 'Enrolled Courses', sub: `${data.courses} Active Program${data.courses === 1 ? '' : 's'}`, icon: <BookOpen size={18} />, bg: 'bg-indigo-100 text-indigo-600', nav: 'courses' },
          { label: 'Lectures Completed', sub: `${data.completedLectures} modules finished`, icon: <CheckCircle2 size={18} />, bg: 'bg-emerald-100 text-emerald-600', nav: 'lectures' },
          { label: 'Learning Streak', sub: `${data.studyStreak} Days Consistent`, icon: <TrendingUp size={18} />, bg: 'bg-amber-100 text-amber-600', badge: data.studyStreak > 0 ? 'Active' : undefined, nav: 'analytics' },
          { label: 'Saved Items', sub: `${data.bookmarks} resources archived`, icon: <BookMarked size={18} />, bg: 'bg-slate-100 text-slate-600', nav: 'bookmarks' },
        ].map((row) => (
          <button key={row.label} onClick={() => go(row.nav)} className="card px-5 py-4 flex items-center gap-4 hover-lift w-full text-left">
            <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${row.bg}`}>{row.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-800 truncate">{row.label}</p>
                {row.badge && <Badge color="success">{row.badge}</Badge>}
              </div>
              <p className="text-sm text-slate-500 truncate">{row.sub}</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 shrink-0" />
          </button>
        ))}
      </div>

      {/* Up next CTA */}
      {upNext && (
        <div className="rounded-3xl p-6 sm:p-7 text-white relative overflow-hidden"
             style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 20px 50px rgba(79,70,229,0.35)' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-2">Up Next</p>
          <h3 className="text-xl font-black tracking-tight mb-5">{upNext.title}</h3>
          <button onClick={() => go('lectures')} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-primary-700 font-bold text-sm hover:bg-white/90 transition-all active:scale-95">
            <Play size={16} className="fill-primary-700" /> Resume Learning
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <StatCard label="Exams Passed" value={`${data.passed}/${data.attempts}`} icon={<Target size={20} />} color="amber" />
        <StatCard label="Total Watch Hours" value={`${data.totalWatchHours ?? 0}h`} icon={<BarChart3 size={20} />} color="sky" />
        <StatCard label="Attendance Rate" value={`${data.attendanceRate ?? 0}%`} icon={<CheckCircle2 size={20} />} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        <div className="lg:col-span-2 space-y-5">
          <ChartCard title="Current Course Progress" action={<button onClick={() => go('courses')} className="text-xs font-bold text-primary-600 hover:underline">View all</button>}>
            <div className="space-y-5 pt-2">
              {(data.courseList || []).map((c: any) => (
                <div key={c.id} className="flex flex-col gap-2 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-800 truncate">{c.title}</p>
                    <Badge color={c.status === 'completed' ? 'success' : 'primary'}>{c.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <ProgressBar value={c.progress || 0} color={c.status === 'completed' ? 'success' : 'primary'} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-10 text-right">{Math.round(c.progress || 0)}%</span>
                  </div>
                </div>
              ))}
              {(data.courseList || []).length === 0 && (
                <div className="text-center py-8">
                  <BookOpen size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">You haven't enrolled in any courses yet</p>
                </div>
              )}
            </div>
          </ChartCard>

          <ChartCard title="Upcoming Quizzes & Exams" action={<button onClick={() => go('exams')} className="text-xs font-bold text-primary-600 hover:underline">View all</button>}>
            <div className="space-y-3 pt-2">
              {(data.upcoming || []).map((e: any) => (
                <button key={e.id} onClick={() => go('exams')} className="w-full flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors text-left">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${e.type === 'quiz' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}>
                    <Target size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{e.title}</p>
                    <p className="text-xs text-slate-500 truncate">{e.course?.title} &middot; {e.duration_minutes}m</p>
                  </div>
                  <Badge color={e.type === 'quiz' ? 'purple' : 'blue'}>{e.type}</Badge>
                </button>
              ))}
              {(data.upcoming || []).length === 0 && <p className="text-sm font-medium text-slate-400 text-center py-6">No upcoming assessments — you're all caught up!</p>}
            </div>
          </ChartCard>
        </div>
        <div className="space-y-5">
          <ChartCard title="Notifications" action={<button onClick={() => go('alerts')} className="text-xs font-bold text-primary-600 hover:underline">View all</button>}>
            <AlertList alerts={(data.alerts || []).slice(0, 4)} />
          </ChartCard>

          <ChartCard title="Latest Scores" action={<button onClick={() => go('reports')} className="text-xs font-bold text-primary-600 hover:underline">Reports</button>}>
            <div className="space-y-2.5 pt-2">
              {(data.latestScores || []).map((s: any, i: number) => {
                const pct = s.total ? Math.round((s.score / s.total) * 100) : 0;
                return (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{s.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{s.type}</p>
                    </div>
                    <Badge color={pct >= 50 ? 'success' : 'danger'}>{pct}%</Badge>
                  </div>
                );
              })}
              {(data.latestScores || []).length === 0 && <p className="text-sm font-medium text-slate-400 text-center py-6">No scores yet</p>}
            </div>
          </ChartCard>

          <ChartCard title="Bookmarked Lectures" action={<button onClick={() => go('bookmarks')} className="text-xs font-bold text-primary-600 hover:underline">View all</button>}>
            <div className="space-y-2 pt-2">
              {(data.bookmarkList || []).map((b: any) => (
                <button key={b.id} onClick={() => go('bookmarks')} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors text-left">
                  <BookMarked size={14} className="text-slate-400 shrink-0" />
                  <span className="text-sm font-semibold text-slate-700 truncate">{b.title}</span>
                </button>
              ))}
              {(data.bookmarkList || []).length === 0 && <p className="text-sm font-medium text-slate-400 text-center py-6">No bookmarks yet</p>}
            </div>
          </ChartCard>

          <ChartCard title="Recent Activity">
            <div className="space-y-3 pt-2">
              {(data.attendanceLog || []).map((a: any) => (
                <div key={a.id} className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/80 transition-colors">
                  <p className="text-sm font-bold text-slate-700 line-clamp-1">{a.lectureTitle}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{a.courseTitle}</p>
                  <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {new Date(a.lastViewedAt).toLocaleDateString()}
                    </span>
                    <Badge color={a.completedAt ? 'success' : 'slate'}>{Math.round(a.watchSeconds / 60)} min</Badge>
                  </div>
                </div>
              ))}
              {(data.attendanceLog || []).length === 0 && <p className="text-sm font-medium text-slate-400 text-center py-6">No recent activity</p>}
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function AlertList({ alerts }: { alerts: any[] }) {
  if (!alerts || alerts.length === 0) return (
    <div className="text-center py-8">
      <CheckCircle2 size={32} className="mx-auto text-emerald-300 mb-3" />
      <p className="text-slate-500 font-medium">You're all caught up!</p>
    </div>
  );
  const sev = (s: string) => (s === 'critical' ? 'danger' : s === 'warning' ? 'warning' : 'slate');
  return (
    <div className="space-y-3 pt-2">
      {alerts.map((a) => (
        <div key={a.id} className={`flex items-start gap-3 p-4 rounded-xl border ${
          a.severity === 'critical' ? 'bg-danger-50 border-danger-100' :
          a.severity === 'warning' ? 'bg-warning-50 border-warning-100' :
          'bg-slate-50 border-slate-100 hover:bg-slate-100/50 transition-colors'
        }`}>
          <AlertTriangle size={18} className={`mt-0.5 shrink-0 ${
            a.severity === 'critical' ? 'text-danger-500' :
            a.severity === 'warning' ? 'text-warning-500' : 'text-slate-400'
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className={`text-sm font-bold truncate ${
                a.severity === 'critical' ? 'text-danger-900' :
                a.severity === 'warning' ? 'text-warning-900' : 'text-slate-700'
              }`}>{a.title}</p>
              <Badge color={sev(a.severity)}>{a.severity}</Badge>
            </div>
            <p className={`text-xs leading-relaxed ${
              a.severity === 'critical' ? 'text-danger-700' :
              a.severity === 'warning' ? 'text-warning-700' : 'text-slate-500'
            }`}>{a.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
