import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, CalendarDays, TrendingUp, BookOpen, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { StatCard, ChartCard, BarChart } from '../components/charts';
import { Spinner, Badge, ProgressBar, EmptyState, Card, Avatar } from '../components/ui';

export default function AttendancePage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  if (role === 'professor') return <ProfessorAttendance />;
  return <StudentAttendance />;
}

/* ══════════════════════════════════════════════════════════════════════
   PROFESSOR — attendance overview across all owned courses
   ══════════════════════════════════════════════════════════════════════ */

interface StudentAttendanceRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  present: number;
  total: number;
}

function ProfessorAttendance() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [rows, setRows] = useState<StudentAttendanceRow[]>([]);
  const [courseFilter, setCourseFilter] = useState<string>('all');

  useEffect(() => {
    if (!profile) return;
    load();
  }, [profile?.id]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: myCourses, error: cErr } = await supabase
        .from('courses')
        .select('id, title')
        .eq('professor_id', profile!.id);
      if (cErr) throw cErr;
      const courseList = myCourses || [];
      setCourses(courseList);
      const courseIds = courseList.map((c) => c.id);

      if (courseIds.length === 0) { setRows([]); setLoading(false); return; }

      const [{ data: enr, error: enrErr }, { data: lectures, error: lecErr }] = await Promise.all([
        supabase.from('enrollments').select('student_id, course_id, status, student:profiles(id, full_name, email)').in('course_id', courseIds).eq('status', 'active'),
        supabase.from('lectures').select('id, course_id, publish_date').in('course_id', courseIds).lte('publish_date', new Date().toISOString()),
      ]);
      if (enrErr) throw enrErr;
      if (lecErr) throw lecErr;

      const lectureIds = (lectures || []).map((l: any) => l.id);
      const lecturesByCourse: Record<string, number> = {};
      (lectures || []).forEach((l: any) => { lecturesByCourse[l.course_id] = (lecturesByCourse[l.course_id] || 0) + 1; });

      let attendanceByStudentCourse: Record<string, number> = {};
      if (lectureIds.length) {
        const { data: att, error: attErr } = await supabase
          .from('lecture_attendance')
          .select('student_id, course_id, status')
          .in('lecture_id', lectureIds)
          .eq('status', 'present');
        if (attErr) throw attErr;
        (att || []).forEach((a: any) => {
          const key = `${a.student_id}:${a.course_id}`;
          attendanceByStudentCourse[key] = (attendanceByStudentCourse[key] || 0) + 1;
        });
      }

      const courseTitleMap: Record<string, string> = {};
      courseList.forEach((c) => { courseTitleMap[c.id] = c.title; });

      const built: StudentAttendanceRow[] = (enr || []).map((e: any) => {
        const key = `${e.student_id}:${e.course_id}`;
        return {
          studentId: e.student_id,
          studentName: e.student?.full_name || e.student?.email || 'Student',
          studentEmail: e.student?.email || '',
          courseId: e.course_id,
          courseTitle: courseTitleMap[e.course_id] || 'Course',
          present: attendanceByStudentCourse[key] || 0,
          total: lecturesByCourse[e.course_id] || 0,
        };
      });

      setRows(built);
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Spinner />;

  const filtered = courseFilter === 'all' ? rows : rows.filter((r) => r.courseId === courseFilter);
  const totalPresent = filtered.reduce((s, r) => s + r.present, 0);
  const totalPossible = filtered.reduce((s, r) => s + r.total, 0);
  const overallRate = totalPossible ? Math.round((totalPresent / totalPossible) * 100) : 0;
  const studentIds = new Set(filtered.map((r) => r.studentId));
  const lowAttendance = filtered.filter((r) => r.total > 0 && (r.present / r.total) * 100 < 75).length;

  const courseWise = courses.map((c) => {
    const cRows = rows.filter((r) => r.courseId === c.id);
    const present = cRows.reduce((s, r) => s + r.present, 0);
    const total = cRows.reduce((s, r) => s + r.total, 0);
    return { label: c.title, value: total ? Math.round((present / total) * 100) : 0 };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <CalendarDays size={28} className="text-primary-600 drop-shadow-sm" />
            Attendance Overview
          </h1>
          <p className="text-slate-500 font-medium">Student attendance across your courses</p>
        </div>
        {courses.length > 0 && (
          <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="select-field w-full md:w-64">
            <option value="all">All Courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm font-semibold text-danger-700 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {courses.length === 0 ? (
        <Card className="py-4">
          <EmptyState icon={<BookOpen size={32} />} title="No courses yet" description="Create a course to start tracking student attendance." />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="py-4">
          <EmptyState icon={<CalendarDays size={32} />} title="No attendance data yet" description="Attendance is recorded automatically as enrolled students complete lectures." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard label="Overall Attendance" value={`${overallRate}%`} icon={<TrendingUp size={20} />} color="emerald" />
            <StatCard label="Students Tracked" value={studentIds.size} icon={<Users size={20} />} color="sky" />
            <StatCard label="Below 75%" value={lowAttendance} icon={<XCircle size={20} />} color="rose" />
            <StatCard label="Courses" value={courses.length} icon={<BookOpen size={20} />} color="violet" />
          </div>

          <ChartCard title="Attendance Rate by Course">
            <div className="py-2"><BarChart data={courseWise} color="#4f46e5" /></div>
          </ChartCard>

          <ChartCard title="Student Roster">
            <div className="space-y-2 pt-2 max-h-[480px] overflow-y-auto custom-scrollbar">
              {filtered.map((r) => {
                const pct = r.total ? Math.round((r.present / r.total) * 100) : 0;
                return (
                  <div key={`${r.studentId}:${r.courseId}`} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <Avatar name={r.studentName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{r.studentName}</p>
                      <p className="text-xs text-slate-500 truncate">{r.courseTitle} &middot; {r.present}/{r.total} lectures</p>
                    </div>
                    <div className="w-32 hidden sm:block">
                      <ProgressBar value={pct} color={pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger'} />
                    </div>
                    <Badge color={pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger'}>{pct}%</Badge>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No students enrolled in this course yet</p>}
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STUDENT — personal attendance record
   ══════════════════════════════════════════════════════════════════════ */

interface LectureRow {
  id: string;
  title: string;
  course_id: string;
  course_title: string;
  publish_date: string;
  present: boolean;
  attended_at: string | null;
}

function StudentAttendance() {
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
