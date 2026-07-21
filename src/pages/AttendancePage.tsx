import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, CalendarDays, TrendingUp, BookOpen } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { StatCard, ChartCard, BarChart } from '../components/charts';
import { Spinner, Badge, ProgressBar, EmptyState, Card } from '../components/ui';

interface LectureRow {
  id: string;
  title: string;
  course_id: string;
  course_title: string;
  publish_date: string;
  present: boolean;
  attended_at: string | null;
}

export default function AttendancePage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LectureRow[]>([]);
  const [courseFilter, setCourseFilter] = useState<string>('all');

  useEffect(() => {
    if (!profile) return;
    load();
  }, [profile?.id]);

  async function load() {
    setLoading(true);
    const { data: enr } = await supabase
      .from('enrollments')
      .select('course_id, course:courses(id, title)')
      .eq('student_id', profile!.id);

    const courseIds = (enr || []).map((e: any) => e.course_id);
    const courseTitleMap: Record<string, string> = {};
    (enr || []).forEach((e: any) => { courseTitleMap[e.course_id] = e.course?.title || 'Course'; });

    if (courseIds.length === 0) { setRows([]); setLoading(false); return; }

    const { data: lectures } = await supabase
      .from('lectures')
      .select('id, title, course_id, publish_date')
      .in('course_id', courseIds)
      .lte('publish_date', new Date().toISOString())
      .order('publish_date', { ascending: false });

    const lectureIds = (lectures || []).map((l) => l.id);
    let attMap: Record<string, string> = {};
    if (lectureIds.length) {
      const { data: att } = await supabase
        .from('lecture_attendance')
        .select('lecture_id, status, attended_at')
        .eq('student_id', profile!.id)
        .in('lecture_id', lectureIds);
      (att || []).forEach((a: any) => { if (a.status === 'present') attMap[a.lecture_id] = a.attended_at; });
    }

    const built: LectureRow[] = (lectures || []).map((l: any) => ({
      id: l.id,
      title: l.title,
      course_id: l.course_id,
      course_title: courseTitleMap[l.course_id] || 'Course',
      publish_date: l.publish_date,
      present: !!attMap[l.id],
      attended_at: attMap[l.id] || null,
    }));

    setRows(built);
    setLoading(false);
  }

  if (loading) return <Spinner />;

  const filtered = courseFilter === 'all' ? rows : rows.filter((r) => r.course_id === courseFilter);
  const totalLectures = filtered.length;
  const presentCount = filtered.filter((r) => r.present).length;
  const absentCount = totalLectures - presentCount;
  const attendanceRate = totalLectures ? Math.round((presentCount / totalLectures) * 100) : 0;

  const courses = Array.from(new Set(rows.map((r) => r.course_id))).map((id) => ({
    id, title: rows.find((r) => r.course_id === id)?.course_title || 'Course',
  }));

  // Course-wise breakdown
  const courseWise = courses.map((c) => {
    const cRows = rows.filter((r) => r.course_id === c.id);
    const cPresent = cRows.filter((r) => r.present).length;
    return { label: c.title, value: cRows.length ? Math.round((cPresent / cRows.length) * 100) : 0 };
  });

  // Monthly report (last 6 months)
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString(undefined, { month: 'short' }) });
  }
  const monthly = months.map((m) => {
    const [y, mo] = m.key.split('-').map(Number);
    const inMonth = filtered.filter((r) => {
      const d = new Date(r.publish_date);
      return d.getFullYear() === y && d.getMonth() === mo;
    });
    const present = inMonth.filter((r) => r.present).length;
    return { label: m.label, value: inMonth.length ? Math.round((present / inMonth.length) * 100) : 0 };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <CalendarDays size={28} className="text-primary-600 drop-shadow-sm" />
            Attendance
          </h1>
          <p className="text-slate-500 font-medium">Your lecture attendance across enrolled courses</p>
        </div>
        {courses.length > 0 && (
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="select-field w-full md:w-64"
          >
            <option value="all">All Courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="py-4">
          <EmptyState icon={<CalendarDays size={32} />} title="No attendance data yet" description="Attendance is recorded automatically as you complete lectures." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard label="Attendance Rate" value={`${attendanceRate}%`} icon={<TrendingUp size={20} />} color="emerald" />
            <StatCard label="Present" value={presentCount} icon={<CheckCircle2 size={20} />} color="sky" />
            <StatCard label="Absent" value={absentCount} icon={<XCircle size={20} />} color="rose" />
            <StatCard label="Total Lectures" value={totalLectures} icon={<BookOpen size={20} />} color="violet" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Monthly Attendance %">
              <div className="py-2"><BarChart data={monthly} color="#10b981" /></div>
            </ChartCard>
            <ChartCard title="Course-wise Attendance">
              <div className="py-2">
                {courseWise.length ? <BarChart data={courseWise} color="#4f46e5" /> : <p className="text-sm text-slate-400 text-center py-4">No data</p>}
              </div>
            </ChartCard>
          </div>

          <ChartCard title="Attendance History">
            <div className="space-y-2 pt-2 max-h-[420px] overflow-y-auto custom-scrollbar">
              {filtered.map((r) => (
                <div key={r.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${r.present ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    {r.present ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{r.title}</p>
                    <p className="text-xs text-slate-500 truncate">{r.course_title} &middot; {new Date(r.publish_date).toLocaleDateString()}</p>
                  </div>
                  <Badge color={r.present ? 'success' : 'danger'}>{r.present ? 'Present' : 'Absent'}</Badge>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No lectures in this range yet</p>}
            </div>
          </ChartCard>

          <ChartCard title="Course Progress Overview">
            <div className="space-y-4 pt-2">
              {courses.map((c) => {
                const cRows = rows.filter((r) => r.course_id === c.id);
                const cPresent = cRows.filter((r) => r.present).length;
                const pct = cRows.length ? Math.round((cPresent / cRows.length) * 100) : 0;
                return (
                  <div key={c.id} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm font-bold text-slate-700 truncate">{c.title}</span>
                        <span className="text-sm font-black text-slate-600">{cPresent}/{cRows.length}</span>
                      </div>
                      <ProgressBar value={pct} color={pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger'} />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}
