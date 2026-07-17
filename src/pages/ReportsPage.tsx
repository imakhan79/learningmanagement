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
  const [profiles, courses, enrollments, attempts, alerts] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, role, status, created_at'),
    supabase.from('courses').select('id, title, status, category, created_at'),
    supabase.from('enrollments').select('id, course_id, student_id, status, progress_pct, enrolled_at, completed_at'),
    supabase.from('exam_attempts').select('id, exam_id, student_id, score, total_marks, status, submitted_at'),
    supabase.from('alerts').select('id, user_id, severity, title, message, created_at, read_at'),
  ]);
  setData({
    userRows: (profiles.data || []).map((p) => ({ Email: p.email, Name: p.full_name, Role: p.role, Status: p.status, Joined: formatDate(p.created_at) })),
    courseRows: (courses.data || []).map((c) => ({ Title: c.title, Status: c.status, Category: c.category, Created: formatDate(c.created_at) })),
    enrollRows: (enrollments.data || []).map((e) => ({ Course: e.course_id, Student: e.student_id, Status: e.status, Progress: e.progress_pct, Enrolled: formatDate(e.enrolled_at) })),
    examRows: (attempts.data || []).map((a) => ({ Exam: a.exam_id, Student: a.student_id, Score: a.score, Total: a.total_marks, Status: a.status, Submitted: a.submitted_at ? formatDate(a.submitted_at) : '—' })),
    alertRows: (alerts.data || []).map((a) => ({ Severity: a.severity, Title: a.title, Message: a.message, Created: formatDate(a.created_at), Read: a.read_at ? 'Yes' : 'No' })),
    totals: { users: (profiles.data || []).length, courses: (courses.data || []).length, enrollments: (enrollments.data || []).length, attempts: (attempts.data || []).length, alerts: (alerts.data || []).length },
  });
}

async function loadProf(setData: (d: any) => void, profId: string) {
  const { data: courses } = await supabase.from('courses').select('id, title').eq('professor_id', profId);
  const ids = (courses || []).map((c) => c.id);
  if (!ids.length) { setData({}); return; }
  const [enrollments, lectures, attempts] = await Promise.all([
    supabase.from('enrollments').select('student_id, course_id, progress_pct, status').in('course_id', ids),
    supabase.from('lectures').select('id, title, created_at').in('course_id', ids),
    supabase.from('exam_attempts').select('id, score, total_marks, status, student_id').in('exam_id',
      ((await supabase.from('exams').select('id').in('course_id', ids)).data || []).map((e) => e.id)),
  ]);
  setData({
    studentRows: (enrollments.data || []).map((e) => ({ Student: e.student_id, Course: courses?.find((c) => c.id === e.course_id)?.title, Progress: e.progress_pct, Status: e.status })),
    lectureRows: (lectures.data || []).map((l) => ({ Title: l.title, Created: formatDate(l.created_at) })),
    examRows: (attempts.data || []).map((a) => ({ Student: a.student_id, Score: a.score, Total: a.total_marks, Status: a.status })),
    totals: { students: new Set((enrollments.data || []).map((e) => e.student_id)).size, lectures: (lectures.data || []).length, attempts: (attempts.data || []).length },
  });
}

async function loadStudent(setData: (d: any) => void, studentId: string) {
  const [enr, prog, att] = await Promise.all([
    supabase.from('enrollments').select('progress_pct, status, course:courses(title), enrolled_at, completed_at').eq('student_id', studentId),
    supabase.from('lecture_progress').select('lecture:lectures(title), completion_pct, total_watch_seconds, completed_at').eq('student_id', studentId),
    supabase.from('exam_attempts').select('score, total_marks, status, exam:exams(title), submitted_at').eq('student_id', studentId),
  ]);
  setData({
    courseRows: (enr.data || []).map((e: any) => ({ Course: e.course?.title, Progress: e.progress_pct, Status: e.status, Enrolled: formatDate(e.enrolled_at), Completed: e.completed_at ? formatDate(e.completed_at) : '—' })),
    lectureRows: (prog.data || []).map((p: any) => ({ Lecture: p.lecture?.title, Completion: p.completion_pct, WatchMin: Math.round((p.total_watch_seconds || 0) / 60), Completed: p.completed_at ? 'Yes' : 'No' })),
    examRows: (att.data || []).map((a: any) => ({ Exam: a.exam?.title, Score: a.score, Total: a.total_marks, Status: a.status, Submitted: a.submitted_at ? formatDate(a.submitted_at) : '—' })),
    totals: { courses: (enr.data || []).length, lectures: (prog.data || []).length, exams: (att.data || []).length },
  });
}

function ReportsView({ role, data, exportCsv }: { role: string; data: any; exportCsv: (r: any[], f: string) => void }) {
  const sections = {
    admin: [
      { title: 'User Report', rows: data.userRows, file: 'users.csv' },
      { title: 'Course Report', rows: data.courseRows, file: 'courses.csv' },
      { title: 'Enrollment Report', rows: data.enrollRows, file: 'enrollments.csv' },
      { title: 'Exam Performance', rows: data.examRows, file: 'exam_performance.csv' },
      { title: 'Alert History', rows: data.alertRows, file: 'alerts.csv' },
    ],
    professor: [
      { title: 'Student Performance', rows: data.studentRows, file: 'student_performance.csv' },
      { title: 'Lecture Analytics', rows: data.lectureRows, file: 'lecture_analytics.csv' },
      { title: 'Quiz Results', rows: data.examRows, file: 'quiz_results.csv' },
    ],
    student: [
      { title: 'Progress Report', rows: data.courseRows, file: 'my_progress.csv' },
      { title: 'Attendance / Lecture Report', rows: data.lectureRows, file: 'my_lectures.csv' },
      { title: 'Exam Results', rows: data.examRows, file: 'my_exams.csv' },
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
