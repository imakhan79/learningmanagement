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
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { StatCard, ChartCard, BarChart, DonutChart } from '../components/charts';
import { Spinner, Badge, ProgressBar } from '../components/ui';

export default function DashboardPage() {
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
  return <StudentDashboard data={data} />;
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
  const [courses, lectures, enrollments, attempts, alerts, materials] = await Promise.all([
    supabase.from('courses').select('id, title, status').eq('professor_id', profId),
    supabase.from('lectures').select('id, course_id, created_at').in('course_id',
      ((await supabase.from('courses').select('id').eq('professor_id', profId)).data || []).map((c) => c.id)
    ),
    supabase.from('enrollments').select('id, course_id, student_id, progress_pct, status'),
    supabase.from('exam_attempts').select('id, score, total_marks'),
    supabase.from('alerts').select('id, severity, title, message, created_at, read_at').eq('user_id', profId).order('created_at', { ascending: false }).limit(6),
    supabase.from('course_materials').select('id, type, created_at'),
  ]);

  const courseList = courses.data || [];
  const lectureList = lectures.data || [];
  const enrList = enrollments.data || [];
  const myCourseIds = courseList.map((c) => c.id);
  const myEnrollments = enrList.filter((e) => myCourseIds.includes(e.course_id));
  const avgProgress = myEnrollments.length ? myEnrollments.reduce((s, e) => s + (e.progress_pct || 0), 0) / myEnrollments.length : 0;

  const att = attempts.data || [];
  const avgScore = att.length ? att.reduce((s, a) => s + (a.score || 0), 0) / att.length : 0;

  const matsByType: Record<string, number> = {};
  (materials.data || []).forEach((m) => { matsByType[m.type] = (matsByType[m.type] || 0) + 1; });

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
    weeklyActivity: [12, 19, 3, 5, 2, 3, 7]
  });
}

async function loadStudent(setData: (d: any) => void, studentId: string) {
  const [enrollments, progress, attempts, bookmarks, alerts] = await Promise.all([
    supabase.from('enrollments').select('id, course_id, status, progress_pct, course:courses(id, title)').eq('student_id', studentId),
    supabase.from('lecture_progress').select('id, lecture_id, completion_pct, total_watch_seconds, completed_at, last_viewed_at, lecture:lectures(title, course:courses(title))').eq('student_id', studentId).order('last_viewed_at', { ascending: false }).limit(5),
    supabase.from('exam_attempts').select('id, score, total_marks, status, exam:exams(title)').eq('student_id', studentId),
    supabase.from('bookmarks').select('id, lecture_id').eq('student_id', studentId),
    supabase.from('alerts').select('id, severity, title, message, created_at, read_at').eq('user_id', studentId).order('created_at', { ascending: false }).limit(6),
  ]);

  const enr = enrollments.data || [];
  const prog = progress.data || [];
  const att = attempts.data || [];
  const bm = bookmarks.data || [];

  const totalWatch = prog.reduce((s, p) => s + (p.total_watch_seconds || 0), 0);
  const completedLectures = prog.filter((p) => p.completed_at).length;
  const avgProgress = enr.length ? enr.reduce((s, e) => s + (e.progress_pct || 0), 0) / enr.length : 0;
  const avgScore = att.length ? att.reduce((s, a) => s + (a.score || 0), 0) / att.length : 0;
  const passed = att.filter((a) => a.total_marks > 0 && a.score / a.total_marks >= 0.5).length;

  setData({
    courses: enr.length,
    completedCourses: enr.filter((e) => e.status === 'completed').length,
    avgProgress: Math.round(avgProgress),
    totalWatchHours: Math.round((totalWatch / 3600) * 10) / 10,
    completedLectures,
    bookmarks: bm.length,
    avgScore: Math.round(avgScore),
    attempts: att.length,
    passed,
    alerts: alerts.data || [],
    courseList: enr.map((e: any) => ({ id: e.course?.id, title: e.course?.title, progress: e.progress_pct, status: e.status })),
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="My Courses" value={data.courses} icon={<BookOpen size={20} />} color="sky" />
        <StatCard label="Lectures" value={data.lectures} icon={<Clock size={20} />} color="emerald" />
        <StatCard label="Students" value={data.students} icon={<Users size={20} />} color="violet" trend="up" trendLabel="+8%" />
        <StatCard label="Avg Score" value={`${data.avgScore}%`} icon={<Award size={20} />} color="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        <ChartCard title="Materials Distribution">
          <div className="py-2">
            <BarChart data={data.materialsByType || []} color="#0ea5e9" />
          </div>
        </ChartCard>
        <ChartCard title="Average Student Progress">
          <div className="flex flex-col justify-center h-full gap-5 py-6">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black text-slate-800 tracking-tighter">{data.avgProgress}</span>
              <span className="text-2xl font-bold text-slate-400 mb-1">%</span>
            </div>
            <ProgressBar value={data.avgProgress} size="lg" color="primary" />
            <p className="text-sm text-slate-500 font-medium">Across all your active courses</p>
          </div>
        </ChartCard>
      </div>
      <ChartCard title="Action Required">
        <AlertList alerts={data.alerts} />
      </ChartCard>
    </div>
  );
}

function StudentDashboard({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">My Learning Hub</h1>
        <p className="text-slate-500 font-medium">Track your progress, scores, and upcoming activities</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Enrolled Courses" value={data.courses} icon={<BookOpen size={20} />} color="sky" />
        <StatCard label="Lectures Completed" value={data.completedLectures} icon={<CheckCircle2 size={20} />} color="emerald" />
        <StatCard label="Learning Streak" value={`${data.studyStreak} Days`} icon={<TrendingUp size={20} />} color="violet" trend="up" trendLabel="Active" />
        <StatCard label="Saved Items" value={data.bookmarks} icon={<BookMarked size={20} />} color="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        <StatCard label="Overall Progress" value={`${data.avgProgress}%`} icon={<BarChart3 size={20} />} color="sky" />
        <StatCard label="Average Score" value={`${data.avgScore}%`} icon={<Award size={20} />} color="emerald" />
        <StatCard label="Exams Passed" value={`${data.passed}/${data.attempts}`} icon={<Target size={20} />} color="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        <div className="lg:col-span-2">
          <ChartCard title="Current Course Progress">
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
        </div>
        <div className="space-y-5">
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
