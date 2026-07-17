import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Clock, Award, Target } from 'lucide-react';
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
        <h1 className="text-xl font-bold text-slate-800">Analytics</h1>
        <p className="text-sm text-slate-500">{role === 'admin' ? 'Institution-wide performance' : role === 'professor' ? 'Your teaching analytics' : 'Your learning analytics'}</p>
      </div>
      <AnalyticsView role={role} data={data} />
    </div>
  );
}

async function loadAdmin(setData: (d: any) => void) {
  const [profiles, courses, enrollments, attempts, lectures] = await Promise.all([
    supabase.from('profiles').select('role, status, created_at'),
    supabase.from('courses').select('status, category'),
    supabase.from('enrollments').select('status, progress_pct'),
    supabase.from('exam_attempts').select('score, total_marks, status'),
    supabase.from('lectures').select('created_at'),
  ]);
  const p = profiles.data || [];
  const roleDist = { admin: 0, professor: 0, student: 0 };
  p.forEach((x) => (roleDist[x.role as keyof typeof roleDist]++));
  const c = courses.data || [];
  const catDist: Record<string, number> = {};
  c.forEach((x) => (catDist[x.category] = (catDist[x.category] || 0) + 1));
  const enr = enrollments.data || [];
  const att = attempts.data || [];
  const avgScore = att.length ? att.reduce((s, a) => s + (a.score || 0), 0) / att.length : 0;
  const passRate = att.length ? (att.filter((a) => a.total_marks > 0 && a.score / a.total_marks >= 0.5).length / att.length) * 100 : 0;
  const completionRate = enr.length ? (enr.filter((e) => e.status === 'completed').length / enr.length) * 100 : 0;
  // lectures per month (last 6)
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d.toLocaleString(undefined, { month: 'short' })); }
  const lecByMonth = months.map((m, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const end = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    return { label: m, value: (lectures.data || []).filter((l) => { const d = new Date(l.created_at); return d >= start && d < end; }).length };
  });
  setData({ roleDist, catDist: Object.entries(catDist).map(([label, value]) => ({ label, value })), avgScore: Math.round(avgScore), passRate: Math.round(passRate), completionRate: Math.round(completionRate), totalLectures: (lectures.data || []).length, lecByMonth, activeUsers: p.filter((x) => x.status === 'active').length });
}

async function loadProf(setData: (d: any) => void, profId: string) {
  const { data: courses } = await supabase.from('courses').select('id, title').eq('professor_id', profId);
  const ids = (courses || []).map((c) => c.id);
  if (!ids.length) { setData({}); return; }
  const [lectures, enrollments, materials, attempts] = await Promise.all([
    supabase.from('lectures').select('id, created_at').in('course_id', ids),
    supabase.from('enrollments').select('student_id, progress_pct, status').in('course_id', ids),
    supabase.from('course_materials').select('type, created_at').in('course_id', ids),
    supabase.from('exam_attempts').select('score, total_marks').in('exam_id',
      ((await supabase.from('exams').select('id').in('course_id', ids)).data || []).map((e) => e.id)
    ),
  ]);
  const matByType: Record<string, number> = {};
  (materials.data || []).forEach((m) => (matByType[m.type] = (matByType[m.type] || 0) + 1));
  const enr = enrollments.data || [];
  const avgProgress = enr.length ? enr.reduce((s, e) => s + (e.progress_pct || 0), 0) / enr.length : 0;
  const att = attempts.data || [];
  const avgScore = att.length ? att.reduce((s, a) => s + (a.score || 0), 0) / att.length : 0;
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d.toLocaleString(undefined, { month: 'short' })); }
  const lecByMonth = months.map((m, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const end = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    return { label: m, value: (lectures.data || []).filter((l) => { const d = new Date(l.created_at); return d >= start && d < end; }).length };
  });
  setData({ courses: courses?.length || 0, lectures: (lectures.data || []).length, students: new Set(enr.map((e) => e.student_id)).size, avgProgress: Math.round(avgProgress), avgScore: Math.round(avgScore), matByType: Object.entries(matByType).map(([label, value]) => ({ label, value })), lecByMonth });
}

async function loadStudent(setData: (d: any) => void, studentId: string) {
  const [enr, prog, att, watch] = await Promise.all([
    supabase.from('enrollments').select('progress_pct, status, course:courses(title)').eq('student_id', studentId),
    supabase.from('lecture_progress').select('completion_pct, total_watch_seconds, completed_at, created_at').eq('student_id', studentId),
    supabase.from('exam_attempts').select('score, total_marks, status, exam:exams(title)').eq('student_id', studentId),
    supabase.from('watch_events').select('event_type, created_at').eq('student_id', studentId).order('created_at', { ascending: true }).limit(500),
  ]);
  const e = enr.data || [];
  const p = prog.data || [];
  const a = att.data || [];
  const totalWatch = p.reduce((s, x) => s + (x.total_watch_seconds || 0), 0);
  const avgProgress = e.length ? e.reduce((s, x) => s + (x.progress_pct || 0), 0) / e.length : 0;
  const avgScore = a.length ? a.reduce((s, x) => s + (x.score || 0), 0) / a.length : 0;
  const passed = a.filter((x) => x.total_marks > 0 && x.score / x.total_marks >= 0.5).length;
  // watch activity last 7 days
  const days: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push(d.toLocaleString(undefined, { weekday: 'short' })); }
  const watchByDay = days.map((d, i) => {
    const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - (6 - i)); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    return { label: d, value: (watch.data || []).filter((w) => { const t = new Date(w.created_at); return t >= dayStart && t < dayEnd; }).length };
  });
  setData({ courses: e.length, avgProgress: Math.round(avgProgress), avgScore: Math.round(avgScore), passed, attempts: a.length, totalWatchHours: Math.round((totalWatch / 3600) * 10) / 10, completedLectures: p.filter((x) => x.completed_at).length, watchByDay, courseList: e.map((x: any) => ({ title: x.course?.title, progress: x.progress_pct, status: x.status })) });
}

function AnalyticsView({ role, data }: { role: string; data: any }) {
  if (role === 'admin') {
    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Users" value={data.activeUsers} icon={<TrendingUp size={20} />} color="emerald" />
          <StatCard label="Total Lectures" value={data.totalLectures} icon={<Clock size={20} />} color="sky" />
          <StatCard label="Pass Rate" value={`${data.passRate}%`} icon={<Award size={20} />} color="amber" />
          <StatCard label="Completion Rate" value={`${data.completionRate}%`} icon={<Target size={20} />} color="violet" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Users by Role"><DonutChart segments={[
            { label: 'Students', value: data.roleDist?.student || 0, color: '#0ea5e9' },
            { label: 'Professors', value: data.roleDist?.professor || 0, color: '#10b981' },
            { label: 'Admins', value: data.roleDist?.admin || 0, color: '#f59e0b' },
          ]} /></ChartCard>
          <ChartCard title="Courses by Category"><BarChart data={data.catDist || []} color="#8b5cf6" /></ChartCard>
        </div>
        <ChartCard title="Lectures Created (6 months)"><LineChart data={data.lecByMonth || []} /></ChartCard>
      </>
    );
  }
  if (role === 'professor') {
    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Courses" value={data.courses} icon={<BarChart3 size={20} />} color="sky" />
          <StatCard label="Lectures" value={data.lectures} icon={<Clock size={20} />} color="emerald" />
          <StatCard label="Students" value={data.students} icon={<TrendingUp size={20} />} color="violet" />
          <StatCard label="Avg Score" value={data.avgScore} icon={<Award size={20} />} color="amber" />
        </div>
        <ChartCard title="Avg Student Progress"><div className="flex items-center gap-4"><div className="text-3xl font-bold text-slate-800">{data.avgProgress}%</div><ProgressBar value={data.avgProgress} className="flex-1" /></div></ChartCard>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Materials by Type"><BarChart data={data.matByType || []} /></ChartCard>
          <ChartCard title="Lectures Created (6 months)"><LineChart data={data.lecByMonth || []} color="#10b981" /></ChartCard>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Courses" value={data.courses} icon={<BarChart3 size={20} />} color="sky" />
        <StatCard label="Completed Lectures" value={data.completedLectures} icon={<Target size={20} />} color="emerald" />
        <StatCard label="Watch Hours" value={data.totalWatchHours} icon={<Clock size={20} />} color="violet" />
        <StatCard label="Exams Passed" value={`${data.passed}/${data.attempts}`} icon={<Award size={20} />} color="amber" />
      </div>
      <ChartCard title="Course Progress">
        <div className="space-y-3">
          {(data.courseList || []).map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1"><div className="flex justify-between mb-1"><span className="text-sm text-slate-700">{c.title}</span><Badge color={c.status === 'completed' ? 'green' : 'blue'}>{c.status}</Badge></div><ProgressBar value={c.progress || 0} /></div>
              <span className="text-sm font-semibold text-slate-600 w-12 text-right">{Math.round(c.progress || 0)}%</span>
            </div>
          ))}
          {(!data.courseList || data.courseList.length === 0) && <p className="text-sm text-slate-400 text-center py-4">No courses</p>}
        </div>
      </ChartCard>
      <ChartCard title="Watch Activity (7 days)"><LineChart data={data.watchByDay || []} color="#8b5cf6" /></ChartCard>
    </>
  );
}
