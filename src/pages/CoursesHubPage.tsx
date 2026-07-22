import { useEffect, useMemo, useState } from 'react';
import {
  Layers, BookOpen, Archive, Pencil, Trash2, Plus, Users, TrendingUp,
  Mail, Calendar, X, LayoutDashboard, FolderKanban,
} from 'lucide-react';
import { supabase, Course, Profile } from '../lib/supabase';
import { StatCard, ChartCard, BarChart } from '../components/charts';
import { Button, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal, Avatar, formatDate } from '../components/ui';

const CATEGORIES = ['General', 'Science', 'Mathematics', 'Engineering', 'Humanities', 'Business', 'Computer Science', 'Arts'];
const ACTIVE_STATUSES = ['approved', 'published'];
const DRAFT_STATUSES = ['draft', 'pending'];

interface CourseRow extends Course {
  professorName: string;
  enrolled: number;
}

interface StudentPerf {
  id: string;
  name: string;
  email: string;
  enrolledAt: string;
  performance: number | null;
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
  { id: 'enrollment', label: 'Enrollment', icon: <Users size={16} /> },
  { id: 'draft', label: 'Draft', icon: <Pencil size={16} /> },
  { id: 'archived', label: 'Archived', icon: <Archive size={16} /> },
  { id: 'management', label: 'Management', icon: <FolderKanban size={16} /> },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CoursesHubPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [professors, setProfessors] = useState<Pick<Profile, 'id' | 'full_name' | 'email'>[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CourseRow | null>(null);

  const [studentsModalCourse, setStudentsModalCourse] = useState<CourseRow | null>(null);
  const [studentsModalRows, setStudentsModalRows] = useState<StudentPerf[]>([]);
  const [studentsModalLoading, setStudentsModalLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [coursesRes, professorsRes] = await Promise.all([
      supabase.from('courses').select('*, professor:profiles!courses_professor_id_fkey(id, full_name, email)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'professor').order('full_name', { ascending: true }),
    ]);

    const list = (coursesRes.data || []) as any[];
    const ids = list.map((c) => c.id);
    const countMap: Record<string, number> = {};
    if (ids.length) {
      const { data: enr } = await supabase.from('enrollments').select('course_id').in('course_id', ids);
      (enr || []).forEach((e: any) => { countMap[e.course_id] = (countMap[e.course_id] || 0) + 1; });
    }

    setCourses(list.map((c) => ({
      ...c,
      professorName: c.professor?.full_name || c.professor?.email || 'Unassigned',
      enrolled: countMap[c.id] || 0,
    })));
    setProfessors(professorsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activeCourses = useMemo(() => courses.filter((c) => ACTIVE_STATUSES.includes(c.status)), [courses]);
  const draftCourses = useMemo(() => courses.filter((c) => DRAFT_STATUSES.includes(c.status)), [courses]);
  const archivedCourses = useMemo(() => courses.filter((c) => c.status === 'archived'), [courses]);

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    activeCourses.forEach((c) => { m[c.category] = (m[c.category] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [activeCourses]);

  const byProfessor = useMemo(() => {
    const m: Record<string, number> = {};
    activeCourses.forEach((c) => { m[c.professorName] = (m[c.professorName] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [activeCourses]);

  const byEnrollment = useMemo(() => [...activeCourses].sort((a, b) => b.enrolled - a.enrolled), [activeCourses]);

  const openStudents = async (course: CourseRow) => {
    setStudentsModalCourse(course);
    setStudentsModalLoading(true);
    try {
      const { data: enr } = await supabase
        .from('enrollments')
        .select('student_id, enrolled_at, student:profiles(full_name, email)')
        .eq('course_id', course.id)
        .order('enrolled_at', { ascending: false });

      const rows = enr || [];
      const studentIds = rows.map((r: any) => r.student_id);

      const scoreMap: Record<string, { sum: number; count: number }> = {};
      if (studentIds.length) {
        const { data: exams } = await supabase.from('exams').select('id').eq('course_id', course.id);
        const examIds = (exams || []).map((e: any) => e.id);
        if (examIds.length) {
          const { data: attempts } = await supabase
            .from('exam_attempts')
            .select('student_id, score, total_marks, status')
            .in('exam_id', examIds)
            .in('student_id', studentIds)
            .in('status', ['graded', 'submitted']);
          (attempts || []).forEach((a: any) => {
            if (!a.total_marks) return;
            const pct = (a.score / a.total_marks) * 100;
            const cur = scoreMap[a.student_id] || { sum: 0, count: 0 };
            cur.sum += pct; cur.count += 1;
            scoreMap[a.student_id] = cur;
          });
        }
      }

      setStudentsModalRows(rows.map((r: any) => ({
        id: r.student_id,
        name: r.student?.full_name || r.student?.email || 'Unknown',
        email: r.student?.email || '',
        enrolledAt: r.enrolled_at,
        performance: scoreMap[r.student_id] ? Math.round(scoreMap[r.student_id].sum / scoreMap[r.student_id].count) : null,
      })));
    } finally {
      setStudentsModalLoading(false);
    }
  };

  const archiveCourse = async (id: string) => {
    await supabase.from('courses').update({ status: 'archived' }).eq('id', id);
    load();
  };

  const deleteCourse = async (id: string) => {
    await supabase.from('courses').delete().eq('id', id);
    setConfirmDelete(null);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Courses Hub</h1>
          <p className="text-slate-500 font-medium">Lifecycle, enrollment, and management across every course</p>
        </div>
        <Button variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={16} /> New Course
        </Button>
      </div>

      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 w-fit overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            <StatCard label="Active Courses" value={activeCourses.length} icon={<BookOpen size={20} />} color="emerald" />
            <StatCard label="Draft Courses" value={draftCourses.length} icon={<Pencil size={20} />} color="amber" />
            <StatCard label="Archived Courses" value={archivedCourses.length} icon={<Archive size={20} />} color="slate" />
          </div>

          <ChartCard title="Active Courses" action={<Badge color="slate">{activeCourses.length}</Badge>}>
            <CourseList rows={activeCourses} emptyLabel="No active courses" />
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Active Courses by Category">
              <div className="py-2"><BarChart data={byCategory} color="#8b5cf6" /></div>
            </ChartCard>
            <ChartCard title="Active Courses by Professor">
              <div className="py-2"><BarChart data={byProfessor} color="#0ea5e9" /></div>
            </ChartCard>
          </div>
        </div>
      )}

      {activeTab === 'enrollment' && (
        <ChartCard title="Active Courses by Enrollment" action={<Badge color="slate">Highest → Lowest</Badge>}>
          <div className="space-y-2.5 pt-2">
            {byEnrollment.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="w-9 h-9 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <TrendingUp size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{c.title}</p>
                  <p className="text-xs text-slate-500 truncate">{c.category} &middot; {c.professorName}</p>
                </div>
                <Badge color="primary">{c.enrolled} student{c.enrolled === 1 ? '' : 's'}</Badge>
                <Button size="sm" variant="outline" onClick={() => openStudents(c)}>
                  <Users size={13} /> View Students
                </Button>
              </div>
            ))}
            {byEnrollment.length === 0 && <EmptyState icon={<Users size={24} />} title="No active courses" />}
          </div>
        </ChartCard>
      )}

      {activeTab === 'draft' && (
        <ChartCard title="Draft Courses" action={<Badge color="amber">{draftCourses.length}</Badge>}>
          <CourseList rows={draftCourses} emptyLabel="No draft courses" />
        </ChartCard>
      )}

      {activeTab === 'archived' && (
        <ChartCard title="Archived Courses" action={<Badge color="slate">{archivedCourses.length}</Badge>}>
          <CourseList rows={archivedCourses} emptyLabel="No archived courses" />
        </ChartCard>
      )}

      {activeTab === 'management' && (
        <ChartCard title="All Courses">
          <div className="space-y-2.5 pt-2">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="w-9 h-9 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                  <Layers size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{c.title}</p>
                  <p className="text-xs text-slate-500 truncate">{c.category} &middot; {c.professorName} &middot; {c.enrolled} student{c.enrolled === 1 ? '' : 's'}</p>
                </div>
                <Badge color={c.status === 'published' ? 'success' : c.status === 'archived' ? 'slate' : c.status === 'approved' ? 'blue' : 'amber'}>{c.status}</Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setShowForm(true); }}>
                    <Pencil size={13} />
                  </Button>
                  {c.status !== 'archived' && (
                    <Button size="sm" variant="ghost" onClick={() => archiveCourse(c.id)}>
                      <Archive size={13} />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="hover:text-danger-600" onClick={() => setConfirmDelete(c)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
            {courses.length === 0 && <EmptyState icon={<BookOpen size={24} />} title="No courses yet" />}
          </div>
        </ChartCard>
      )}

      {showForm && (
        <CourseHubForm
          course={editing}
          professors={professors}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} title="Delete Course" maxW="max-w-sm">
          <div className="p-6 pt-2 space-y-5">
            <p className="text-sm text-slate-600">
              Delete <span className="font-bold text-slate-800">{confirmDelete.title}</span>? This permanently removes the course and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => deleteCourse(confirmDelete.id)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      {studentsModalCourse && (
        <Modal open onClose={() => setStudentsModalCourse(null)} title={`Enrolled Students — ${studentsModalCourse.title}`} maxW="max-w-2xl">
          <div className="p-6 pt-2">
            {studentsModalLoading ? <Spinner /> : (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
                {studentsModalRows.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                    <Avatar name={s.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{s.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 min-w-0">
                        <span className="flex items-center gap-1 min-w-0"><Mail size={11} className="shrink-0" /> <span className="truncate">{s.email}</span></span>
                        <span className="flex items-center gap-1 shrink-0"><Calendar size={11} /> Enrolled {formatDate(s.enrolledAt)}</span>
                      </div>
                    </div>
                    <Badge color={s.performance === null ? 'slate' : s.performance >= 50 ? 'success' : 'danger'}>
                      {s.performance === null ? 'No grades yet' : `${s.performance}% avg`}
                    </Badge>
                  </div>
                ))}
                {studentsModalRows.length === 0 && <p className="text-sm font-medium text-slate-400 text-center py-8">No students enrolled yet</p>}
              </div>
            )}
            <div className="flex justify-end pt-5 mt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setStudentsModalCourse(null)}><X size={14} /> Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CourseList({ rows, emptyLabel }: { rows: CourseRow[]; emptyLabel: string }) {
  return (
    <div className="space-y-2.5 pt-2">
      {rows.map((c) => (
        <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
          <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <BookOpen size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-700 truncate">{c.title}</p>
            <p className="text-xs text-slate-500 truncate">{c.category} &middot; {c.professorName}</p>
          </div>
          <Badge color="slate">{c.enrolled} student{c.enrolled === 1 ? '' : 's'}</Badge>
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">{formatDate(c.created_at)}</span>
        </div>
      ))}
      {rows.length === 0 && <EmptyState icon={<BookOpen size={24} />} title={emptyLabel} />}
    </div>
  );
}

function CourseHubForm({ course, professors, onClose, onSaved }: {
  course: Course | null;
  professors: Pick<Profile, 'id' | 'full_name' | 'email'>[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(course?.title || '');
  const [description, setDescription] = useState(course?.description || '');
  const [category, setCategory] = useState(course?.category || 'General');
  const [status, setStatus] = useState(course?.status || 'draft');
  const [professorId, setProfessorId] = useState(course?.professor_id || professors[0]?.id || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    if (course) {
      await supabase.from('courses').update({ title, description, category, status, professor_id: professorId }).eq('id', course.id);
    } else {
      await supabase.from('courses').insert({ title, description, category, status, professor_id: professorId });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={course ? 'Edit Course' : 'Create New Course'} maxW="max-w-lg">
      <div className="space-y-5 p-6 pt-2">
        <div>
          <label className="label">Course Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advanced Machine Learning" required />
        </div>
        <div>
          <label className="label">Course Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide a detailed overview of what students will learn..." rows={4} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <label className="label">Status</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="draft">Draft</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
        </div>
        <div>
          <label className="label">Professor</label>
          <Select value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
            {professors.length === 0 && <option value="">No professors available</option>}
            {professors.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </Select>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !title || !professorId}>{saving ? 'Saving...' : 'Save Course'}</Button>
        </div>
      </div>
    </Modal>
  );
}
