import { useEffect, useState } from 'react';
import { BookOpen, Plus, Archive, CheckCircle2, Users, Star, Clock, Pencil } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, Course, Profile } from '../lib/supabase';
import { Button, Card, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal, LiveBadge, AiBadge, ProgressBar, formatDate } from '../components/ui';

const CATEGORIES = ['General', 'Science', 'Mathematics', 'Engineering', 'Humanities', 'Business', 'Computer Science', 'Arts'];

// Deterministic gradient per course id for thumbnail backgrounds
const GRADIENTS = [
  'from-blue-500 via-indigo-500 to-purple-600',
  'from-emerald-400 via-teal-500 to-cyan-600',
  'from-orange-400 via-rose-500 to-pink-600',
  'from-violet-500 via-purple-500 to-indigo-600',
  'from-amber-400 via-orange-500 to-red-500',
  'from-sky-400 via-blue-500 to-indigo-500',
];

function courseGradient(id: string) {
  const sum = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[sum % GRADIENTS.length];
}


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
  const [tab, setTab] = useState<'active' | 'draft' | 'archived'>('active');

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

  const filtered = courses.filter((c) => {
    if (tab === 'active')   return c.status === 'published' || c.status === 'approved' || c.status === 'pending';
    if (tab === 'draft')    return c.status === 'draft';
    if (tab === 'archived') return c.status === 'archived';
    return true;
  });

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">My Courses</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {role === 'student'
              ? 'Your enrolled and available courses'
              : 'Manage your curriculum and track student engagement across all platforms.'}
          </p>
        </div>
        {role !== 'student' && (
          <Button variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={16} /> New Course
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white rounded-2xl border border-slate-100 shadow-sm w-fit">
        {(['active', 'draft', 'archived'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all duration-200 ${
              tab === t
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'active' ? 'Active' : t === 'draft' ? 'Drafts' : 'Archived'}
          </button>
        ))}
      </div>

      {/* Course grid */}
      {filtered.length === 0 ? (
        <Card className="py-2">
          <EmptyState
            icon={<BookOpen size={28} />}
            title={`No ${tab} courses`}
            subtitle={role !== 'student' ? 'Create your first course to get started.' : 'No courses available in this category.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => {
            const grad = courseGradient(c.id);
            const isEnrolled = enrolledIds.includes(c.id);
            const isLive = c.status === 'published';
            const isAiGenerated = c.category === 'Computer Science';

            return (
              <div key={c.id} className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm card-hover flex flex-col">
                {/* Thumbnail */}
                <div className={`relative h-40 bg-gradient-to-br ${grad} flex items-center justify-center`}>
                  {/* Pattern overlay */}
                  <div className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
                      backgroundSize: '30px 30px',
                    }}
                  />
                  <div className="relative text-white/30 text-8xl font-black select-none">
                    {c.title.charAt(0)}
                  </div>
                  {/* Status badge top-left */}
                  <div className="absolute top-3 left-3">
                    {isLive ? <LiveBadge /> : isAiGenerated ? <AiBadge /> : (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm`}>
                        {c.status}
                      </span>
                    )}
                  </div>
                  {/* Category top-right */}
                  <div className="absolute top-3 right-3">
                    <span className="text-xs font-semibold bg-black/25 text-white px-2.5 py-1 rounded-full backdrop-blur-sm">
                      {c.category}
                    </span>
                  </div>
                  {/* Edit button for non-students */}
                  {role !== 'student' && (
                    <button
                      onClick={() => { setEditing(c); setShowForm(true); }}
                      className="absolute bottom-3 right-3 w-8 h-8 bg-white/20 backdrop-blur-sm hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-all"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-slate-800 text-base leading-snug mb-1.5 line-clamp-2">{c.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-3 flex-1">{c.description || 'No description provided.'}</p>

                  {/* Stats row */}
                  {role !== 'student' ? (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span className="font-medium">Enrollment Progress</span>
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <Users size={11} /> {c.enrolled || 0} Students
                        </span>
                      </div>
                      <ProgressBar value={Math.min(100, ((c.enrolled || 0) / 50) * 100)} color="blue" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                      {c.professor && (
                        <span className="flex items-center gap-1">
                          <Star size={11} className="text-amber-400" /> {c.professor.full_name || c.professor.email}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                    {role === 'student' ? (
                      isEnrolled ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 size={14} /> Enrolled
                        </span>
                      ) : c.status === 'published' ? (
                        <Button size="sm" variant="gradient" onClick={async () => {
                          await supabase.from('enrollments').insert({ course_id: c.id, student_id: profile!.id });
                          load();
                        }}>
                          Enroll Now
                        </Button>
                      ) : null
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {role === 'admin' && c.status === 'pending' && (
                          <Button size="sm" variant="primary" onClick={async () => {
                            await supabase.from('courses').update({ status: 'approved' }).eq('id', c.id);
                            load();
                          }}>Approve</Button>
                        )}
                        {role === 'admin' && c.status === 'approved' && (
                          <Button size="sm" variant="gradient" onClick={async () => {
                            await supabase.from('courses').update({ status: 'published' }).eq('id', c.id);
                            load();
                          }}>Publish</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setShowEnroll(c)}>
                          <Users size={13} /> Assign
                        </Button>
                        {c.status !== 'archived' && (
                          <Button size="sm" variant="ghost" onClick={async () => {
                            await supabase.from('courses').update({ status: 'archived' }).eq('id', c.id);
                            load();
                          }}>
                            <Archive size={13} />
                          </Button>
                        )}
                      </div>
                    )}
                    <span className="text-[11px] text-slate-400 ml-auto flex items-center gap-1">
                      <Clock size={11} /> {formatDate(c.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
          <Button variant="gradient" onClick={save} disabled={saving || !title}>{saving ? 'Saving…' : 'Save Course'}</Button>
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
    <Modal open onClose={onClose} title={`Assign Students — ${course.title}`} size="lg">
      {loading ? <Spinner /> : (
        <>
          <p className="text-sm text-slate-500 mb-4">{existing.size} already enrolled. Select additional students to assign.</p>
          <div className="max-h-80 overflow-y-auto space-y-1 border border-slate-100 rounded-xl p-2 bg-slate-50">
            {students.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No students found</p>
            ) : students.map((s) => {
              const isEx = existing.has(s.id);
              const isSel = selected.has(s.id);
              return (
                <label key={s.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${isSel ? 'bg-blue-50' : 'hover:bg-white'} ${isEx ? 'opacity-60' : ''}`}>
                  <input type="checkbox" checked={isSel || isEx} disabled={isEx} onChange={() => toggle(s.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    {(s.full_name || s.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{s.full_name || s.email}</p>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                  </div>
                  {isEx && <Badge color="green">Enrolled</Badge>}
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="gradient" onClick={save} disabled={selected.size === 0}>
              Assign {selected.size > 0 ? `${selected.size} Students` : ''}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
