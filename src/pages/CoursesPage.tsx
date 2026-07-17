import { useEffect, useState } from 'react';
import { BookOpen, Plus, Archive, CheckCircle2, Users } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, Course, Profile } from '../lib/supabase';
import { Button, Card, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal, formatDate } from '../components/ui';

const CATEGORIES = ['General', 'Science', 'Mathematics', 'Engineering', 'Humanities', 'Business', 'Computer Science', 'Arts'];

export default function CoursesPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const [courses, setCourses] = useState<(Course & { professor?: Profile; enrolled?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Course | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [students, setStudents] = useState<Profile[]>([]);
  const [showEnroll, setShowEnroll] = useState<Course | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('courses').select('*, professor:profiles!courses_professor_id_fkey(id, email, full_name, role)').order('created_at', { ascending: false });
    if (role === 'professor') q = q.eq('professor_id', profile!.id);
    const { data } = await q;
    const list = (data || []) as any;

    if (role === 'student') {
      const { data: enr } = await supabase.from('enrollments').select('course_id, status').eq('student_id', profile!.id);
      const enrMap = new Map((enr || []).map((e) => [e.course_id, e.status]));
      setEnrolledIds((enr || []).map((e) => e.course_id));
      setCourses(list.filter((c: any) => enrMap.has(c.id) || c.status === 'published'));
    } else {
      const ids = list.map((c: any) => c.id);
      if (ids.length) {
        const { data: counts } = await supabase.from('enrollments').select('course_id').in('course_id', ids);
        const cm: Record<string, number> = {};
        (counts || []).forEach((c: any) => { cm[c.course_id] = (cm[c.course_id] || 0) + 1; });
        list.forEach((c: any) => (c.enrolled = cm[c.id] || 0));
      }
      setCourses(list);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (role !== 'student') {
      supabase.from('profiles').select('id, email, full_name, role, status, avatar_url, phone, created_at, updated_at').eq('role', 'student').then(({ data }) => setStudents(data as Profile[] || []));
    }
  }, [profile?.id]);

  const statusColor = (s: string) =>
    s === 'published' ? 'green' : s === 'approved' ? 'blue' : s === 'pending' ? 'amber' : s === 'archived' ? 'slate' : 'slate';

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Courses</h1>
          <p className="text-sm text-slate-500">{role === 'student' ? 'Your enrolled and available courses' : 'Manage course catalog'}</p>
        </div>
        {role !== 'student' && (
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={16} /> New Course
          </Button>
        )}
      </div>

      {courses.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen size={32} />} title="No courses yet" subtitle={role !== 'student' ? 'Create your first course' : 'No courses available'} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <Card key={c.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Badge color={statusColor(c.status)}>{c.status}</Badge>
                <Badge color="slate">{c.category}</Badge>
              </div>
              <h3 className="font-semibold text-slate-800 mb-1">{c.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-3 flex-1">{c.description || 'No description'}</p>
              {c.professor && <p className="text-xs text-slate-400 mb-3">By {c.professor.full_name || c.professor.email}</p>}
              {role !== 'student' && <p className="text-xs text-slate-400 mb-3">{c.enrolled || 0} enrolled</p>}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                {role === 'student' ? (
                  enrolledIds.includes(c.id) ? (
                    <Badge color="green"><CheckCircle2 size={12} className="mr-1" /> Enrolled</Badge>
                  ) : c.status === 'published' ? (
                    <Button size="sm" variant="outline" onClick={async () => {
                      await supabase.from('enrollments').insert({ course_id: c.id, student_id: profile!.id });
                      load();
                    }}>Enroll</Button>
                  ) : null
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setShowForm(true); }}>Edit</Button>
                    {role === 'admin' && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        const next = c.status === 'pending' ? 'approved' : c.status === 'approved' ? 'published' : c.status;
                        if (next !== c.status) {
                          await supabase.from('courses').update({ status: next }).eq('id', c.id);
                          load();
                        }
                      }}>
                        {c.status === 'pending' ? 'Approve' : c.status === 'approved' ? 'Publish' : 'Approved'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setShowEnroll(c)}>
                      <Users size={14} /> Assign
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      await supabase.from('courses').update({ status: 'archived' }).eq('id', c.id);
                      load();
                    }}>
                      <Archive size={14} />
                    </Button>
                  </>
                )}
                <span className="text-xs text-slate-400 ml-auto">{formatDate(c.created_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <CourseForm
          course={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {showEnroll && (
        <EnrollModal
          course={showEnroll}
          students={students}
          onClose={() => setShowEnroll(null)}
          onDone={() => { setShowEnroll(null); load(); }}
        />
      )}
    </div>
  );
}

function CourseForm({ course, onClose, onSaved }: { course: Course | null; onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState(course?.title || '');
  const [description, setDescription] = useState(course?.description || '');
  const [category, setCategory] = useState(course?.category || 'General');
  const [status, setStatus] = useState(course?.status || 'draft');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    if (course) {
      await supabase.from('courses').update({ title, description, category, status }).eq('id', course.id);
    } else {
      await supabase.from('courses').insert({ title, description, category, status, professor_id: profile!.id });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={course ? 'Edit Course' : 'New Course'}>
      <div className="space-y-4">
        <Input label="Title" value={title} onChange={setTitle} placeholder="Introduction to Biology" required />
        <Textarea label="Description" value={description} onChange={setDescription} placeholder="Course overview…" rows={4} />
        <Select label="Category" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <Select label="Status" value={status} onChange={(v) => setStatus(v as any)} options={[
          { value: 'draft', label: 'Draft' },
          { value: 'pending', label: 'Pending Approval' },
          { value: 'approved', label: 'Approved' },
          { value: 'published', label: 'Published' },
          { value: 'archived', label: 'Archived' },
        ]} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function EnrollModal({ course, students, onClose, onDone }: { course: Course; students: Profile[]; onClose: () => void; onDone: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('enrollments').select('student_id').eq('course_id', course.id);
      setExisting(new Set((data || []).map((e) => e.student_id)));
      setLoading(false);
    })();
  }, [course.id]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };

  const save = async () => {
    const toAdd = [...selected].filter((id) => !existing.has(id));
    if (toAdd.length) {
      await supabase.from('enrollments').insert(toAdd.map((student_id) => ({ course_id: course.id, student_id })));
    }
    onDone();
  };

  return (
    <Modal open onClose={onClose} title={`Assign students — ${course.title}`} size="lg">
      {loading ? <Spinner /> : (
        <>
          <p className="text-sm text-slate-500 mb-4">{existing.size} already enrolled. Select additional students to assign.</p>
          <div className="max-h-80 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2">
            {students.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No students found</p>
            ) : students.map((s) => {
              const isEx = existing.has(s.id);
              const isSel = selected.has(s.id);
              return (
                <label key={s.id} className={`flex items-center gap-3 p-2 rounded-md cursor-pointer ${isSel ? 'bg-sky-50' : 'hover:bg-slate-50'} ${isEx ? 'opacity-60' : ''}`}>
                  <input type="checkbox" checked={isSel || isEx} disabled={isEx} onChange={() => toggle(s.id)} className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{s.full_name || s.email}</p>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                  </div>
                  {isEx && <Badge color="green">Enrolled</Badge>}
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={selected.size === 0}>Assign {selected.size || ''}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
