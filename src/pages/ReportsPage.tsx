import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Card, Button, Spinner, EmptyState, formatDate } from '../components/ui';

export default function ReportsPage() {
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

  const exportCsv = (rows: any[], filename: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Reports</h1>
        <p className="text-sm text-slate-500">Export and review performance reports</p>
      </div>
      <ReportsView role={role} data={data} exportCsv={exportCsv} />
    </div>
  );
}

async function loadAdmin(setData: (d: any) => void) {
  const [profiles, courses, enrollments, attempts, alerts, attendance] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, role, status, created_at'),
    supabase.from('courses').select('id, title, status, category, created_at, professor_id'),
    supabase.from('enrollments').select('id, course_id, student_id, status, progress_pct, enrolled_at, completed_at, course:courses(title), student:profiles(full_name, email)'),
    supabase.from('exam_attempts').select('id, exam_id, student_id, score, total_marks, status, submitted_at, exam:exams(title), student:profiles(full_name)'),
    supabase.from('alerts').select('id, user_id, severity, title, message, created_at, read_at, user:profiles(full_name)'),
    supabase.from('live_attendance').select('id, session_id, user_id, joined_at, duration_seconds, session:live_sessions(title), user:profiles(full_name)'),
  ]);

  const allCourses = courses.data || [];
  const allEnroll = enrollments.data || [];
  const allAtt = attempts.data || [];
  const allProfs = (profiles.data || []).filter(p => p.role === 'professor');

  // Institution Performance (Totals & Aggregates)
  const institutionRows = [{
    'Total Users': (profiles.data || []).length,
    'Total Courses': allCourses.length,
    'Total Enrollments': allEnroll.length,
    'Total Exams Taken': allAtt.length,
    'Overall Pass Rate': allAtt.length ? `${Math.round((allAtt.filter(a => a.status === 'passed').length / allAtt.length) * 100)}%` : '0%',
  }];

  // Professor KPI
  const profRows = allProfs.map(p => {
    const profCourses = allCourses.filter(c => c.professor_id === p.id);
    const profEnroll = allEnroll.filter(e => profCourses.some(c => c.id === e.course_id));
    return {
      Professor: p.full_name || p.email,
      Status: p.status,
      'Active Courses': profCourses.length,
      'Total Students': profEnroll.length,
      Joined: formatDate(p.created_at)
    };
  });

  // Course Completions
  const completionRows = allEnroll.filter(e => e.status === 'completed').map(e => ({
    Student: (e.student as any)?.full_name || (e.student as any)?.email,
    Course: (e.course as any)?.title,
    'Enrolled Date': formatDate(e.enrolled_at),
    'Completed Date': e.completed_at ? formatDate(e.completed_at) : '—',
  }));

  setData({
    instRows: institutionRows,
    profRows: profRows,
    studentRows: allEnroll.map((e) => ({ Student: (e.student as any)?.full_name || (e.student as any)?.email, Course: (e.course as any)?.title, Status: e.status, Progress: e.progress_pct, Enrolled: formatDate(e.enrolled_at) })),
    attendanceRows: (attendance.data || []).map((a) => ({ Student: (a.user as any)?.full_name, Session: (a.session as any)?.title, Joined: formatDate(a.joined_at), 'Duration (Min)': Math.round((a.duration_seconds || 0) / 60) })),
    completionRows: completionRows,
    examRows: allAtt.map((a) => ({ Student: (a.student as any)?.full_name, Exam: (a.exam as any)?.title, Score: a.score, Total: a.total_marks, Status: a.status, Submitted: a.submitted_at ? formatDate(a.submitted_at) : '—' })),
    alertRows: (alerts.data || []).map((a) => ({ User: (a.user as any)?.full_name, Severity: a.severity, Title: a.title, Message: a.message, Created: formatDate(a.created_at) })),
    totals: { users: (profiles.data || []).length, courses: allCourses.length, enrollments: allEnroll.length, alerts: (alerts.data || []).length },
  });
}

async function loadProf(setData: (d: any) => void, profId: string) {
  const { data: courses } = await supabase.from('courses').select('id, title').eq('professor_id', profId);
  const ids = (courses || []).map((c) => c.id);
  if (!ids.length) { setData({}); return; }

  const [enrollments, lectures, attempts, prog, liveAtt] = await Promise.all([
    supabase.from('enrollments').select('student_id, course_id, progress_pct, status, completed_at, student:profiles(full_name, email)').in('course_id', ids),
    supabase.from('lectures').select('id, title, created_at, course_id').in('course_id', ids),
    supabase.from('exam_attempts').select('id, score, total_marks, status, student_id, submitted_at, exam:exams(title), student:profiles(full_name)').in('exam_id', ((await supabase.from('exams').select('id').in('course_id', ids)).data || []).map((e) => e.id)),
    supabase.from('lecture_progress').select('student_id, lecture_id, completion_pct, total_watch_seconds, student:profiles(full_name), lecture:lectures(title)').in('lecture_id', ((await supabase.from('lectures').select('id').in('course_id', ids)).data || []).map((l) => l.id)),
    supabase.from('live_attendance').select('user_id, session_id, duration_seconds, user:profiles(full_name), session:live_sessions(title)').in('session_id', ((await supabase.from('live_sessions').select('id').in('course_id', ids)).data || []).map((s) => s.id)),
  ]);

  const allEnroll = enrollments.data || [];
  
  setData({
    studentRows: allEnroll.map((e) => ({ Student: (e.student as any)?.full_name || (e.student as any)?.email, Course: courses?.find((c) => c.id === e.course_id)?.title, Progress: `${e.progress_pct}%`, Status: e.status })),
    lectureRows: (lectures.data || []).map((l) => ({ Title: l.title, Course: courses?.find((c) => c.id === l.course_id)?.title, Created: formatDate(l.created_at) })),
    completionRows: allEnroll.filter(e => e.status === 'completed').map(e => ({ Student: (e.student as any)?.full_name, Course: courses?.find((c) => c.id === e.course_id)?.title, Completed: e.completed_at ? formatDate(e.completed_at) : '—' })),
    examRows: (attempts.data || []).map((a) => ({ Student: (a.student as any)?.full_name, Quiz: (a.exam as any)?.title, Score: a.score, Total: a.total_marks, Status: a.status, Submitted: a.submitted_at ? formatDate(a.submitted_at) : '—' })),
    engagementRows: [
      ...(prog.data || []).map((p) => ({ Student: (p.student as any)?.full_name, Activity: `Lecture: ${(p.lecture as any)?.title}`, Metric: `${Math.round((p.total_watch_seconds || 0) / 60)} mins watched`, Type: 'VOD' })),
      ...(liveAtt.data || []).map((a) => ({ Student: (a.user as any)?.full_name, Activity: `Live: ${(a.session as any)?.title}`, Metric: `${Math.round((a.duration_seconds || 0) / 60)} mins attended`, Type: 'Live' }))
    ],
    totals: { students: new Set(allEnroll.map((e) => e.student_id)).size, courses: ids.length, lectures: (lectures.data || []).length, attempts: (attempts.data || []).length },
  });
}

async function loadStudent(setData: (d: any) => void, studentId: string) {
  const [enr, prog, att, liveAtt] = await Promise.all([
    supabase.from('enrollments').select('progress_pct, status, course:courses(title), enrolled_at, completed_at').eq('student_id', studentId),
    supabase.from('lecture_progress').select('lecture:lectures(title), completion_pct, total_watch_seconds, completed_at').eq('student_id', studentId),
    supabase.from('exam_attempts').select('score, total_marks, status, exam:exams(title), submitted_at').eq('student_id', studentId),
    supabase.from('live_attendance').select('joined_at, duration_seconds, session:live_sessions(title)').eq('user_id', studentId),
  ]);

  const allEnroll = enr.data || [];

  setData({
    courseRows: allEnroll.map((e: any) => ({ Course: e.course?.title, Progress: `${e.progress_pct}%`, Status: e.status, Enrolled: formatDate(e.enrolled_at) })),
    attendanceRows: [
      ...(prog.data || []).map((p: any) => ({ Activity: `Lecture: ${p.lecture?.title}`, 'Duration (Min)': Math.round((p.total_watch_seconds || 0) / 60), Type: 'VOD', Completed: p.completed_at ? 'Yes' : 'No' })),
      ...(liveAtt.data || []).map((a: any) => ({ Activity: `Live Session: ${a.session?.title}`, 'Duration (Min)': Math.round((a.duration_seconds || 0) / 60), Type: 'Live', Completed: '—' }))
    ],
    examRows: (att.data || []).map((a: any) => ({ Quiz: a.exam?.title, Score: a.score, Total: a.total_marks, Status: a.status, Submitted: a.submitted_at ? formatDate(a.submitted_at) : '—' })),
    certRows: allEnroll.filter(e => e.status === 'completed').map((e: any) => ({ Course: e.course?.title, Completed: e.completed_at ? formatDate(e.completed_at) : '—', 'Certificate Status': 'Eligible / Auto-Issued' })),
    totals: { courses: allEnroll.length, completions: allEnroll.filter(e => e.status === 'completed').length, quizzes: (att.data || []).length },
  });
}

function ReportsView({ role, data, exportCsv }: { role: string; data: any; exportCsv: (r: any[], f: string) => void }) {
  const sections = {
    admin: [
      { title: 'Institution Performance', rows: data.instRows, file: 'institution_performance.csv' },
      { title: 'Professor KPI Report', rows: data.profRows, file: 'professor_kpi.csv' },
      { title: 'Student Progress Report', rows: data.studentRows, file: 'student_progress.csv' },
      { title: 'Attendance Report', rows: data.attendanceRows, file: 'attendance.csv' },
      { title: 'Course Completion Report', rows: data.completionRows, file: 'course_completions.csv' },
      { title: 'Exam Performance Report', rows: data.examRows, file: 'exam_performance.csv' },
      { title: 'Alert History', rows: data.alertRows, file: 'alerts.csv' },
    ],
    professor: [
      { title: 'Student Performance', rows: data.studentRows, file: 'student_performance.csv' },
      { title: 'Lecture Analytics', rows: data.lectureRows, file: 'lecture_analytics.csv' },
      { title: 'Course Completions', rows: data.completionRows, file: 'course_completions.csv' },
      { title: 'Quiz Results', rows: data.examRows, file: 'quiz_results.csv' },
      { title: 'Engagement Report', rows: data.engagementRows, file: 'student_engagement.csv' },
    ],
    student: [
      { title: 'Progress Report', rows: data.courseRows, file: 'my_progress.csv' },
      { title: 'Attendance & Viewing Report', rows: data.attendanceRows, file: 'my_attendance.csv' },
      { title: 'Quiz History & Exam Results', rows: data.examRows, file: 'my_exams.csv' },
      { title: 'Course Completion Certificate Status', rows: data.certRows, file: 'my_certificates.csv' },
    ],
  } as any;

  const list = sections[role] || [];
  if (list.length === 0 || !data.totals) return <Card><EmptyState icon={<FileText size={28} />} title="No data" subtitle="No report data available yet" /></Card>;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {Object.entries(data.totals).map(([k, v]) => (
          <Card key={k} className="p-4"><p className="text-xs text-slate-500 capitalize">{k}</p><p className="text-2xl font-bold text-slate-800">{v as number}</p></Card>
        ))}
      </div>
      <div className="space-y-4">
        {list.map((s: any) => (
          <Card key={s.title} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">{s.title}</h3>
              <Button size="sm" variant="outline" onClick={() => exportCsv(s.rows || [], s.file)} disabled={!s.rows?.length}><Download size={14} /> Export CSV</Button>
            </div>
            {s.rows?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50"><tr>{Object.keys(s.rows[0]).map((h) => <th key={h} className="text-left px-3 py-2 font-medium text-slate-600">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {s.rows.slice(0, 5).map((r: any, i: number) => (
                      <tr key={i}>{Object.values(r).map((v: any, j: number) => <td key={j} className="px-3 py-2 text-slate-600">{String(v ?? '—')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
                {s.rows.length > 5 && <p className="text-xs text-slate-400 mt-2">Showing 5 of {s.rows.length} rows — export to see all</p>}
              </div>
            ) : <p className="text-sm text-slate-400 text-center py-4">No data</p>}
          </Card>
        ))}
      </div>
    </>
  );
}
