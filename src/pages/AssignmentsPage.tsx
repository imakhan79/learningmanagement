import { useEffect, useState } from 'react';
import {
  ClipboardCheck, Plus, Settings, Trash2, Upload, Download, Clock, CheckCircle2,
  AlertTriangle, FileText, Users, X, Award,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import {
  supabase, Assignment, AssignmentSubmission, Course, RubricCriterion,
  uploadAssignmentSubmissionFile, getAssignmentSubmissionUrl,
} from '../lib/supabase';
import { Button, Card, Input, Textarea, Badge, Spinner, EmptyState, Modal, formatDateTime } from '../components/ui';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

function dueBadge(dueDate: string | null, submitted: boolean, graded: boolean) {
  if (graded) return { label: 'Graded', color: 'success' as const };
  if (!dueDate) return submitted ? { label: 'Submitted', color: 'primary' as const } : { label: 'Open', color: 'slate' as const };
  const overdue = new Date(dueDate).getTime() < Date.now();
  if (submitted) return { label: 'Submitted', color: 'primary' as const };
  if (overdue) return { label: 'Overdue', color: 'danger' as const };
  return { label: 'Open', color: 'slate' as const };
}

export default function AssignmentsPage({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, AssignmentSubmission>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewingSubmissions, setViewingSubmissions] = useState<Assignment | null>(null);
  const [submitting, setSubmitting] = useState<Assignment | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (role === 'professor') {
        const [{ data: cs, error: csErr }, { data: as, error: asErr }] = await Promise.all([
          supabase.from('courses').select('id, title').eq('professor_id', profile!.id),
          supabase.from('assignments').select('*, course:courses(id, title)').eq('professor_id', profile!.id).order('created_at', { ascending: false }),
        ]);
        if (csErr) throw csErr;
        if (asErr) throw asErr;
        setCourses((cs || []) as Course[]);
        setAssignments((as || []) as Assignment[]);
      } else if (role === 'student') {
        const { data: enr, error: enrErr } = await supabase.from('enrollments').select('course_id').eq('student_id', profile!.id).eq('status', 'active');
        if (enrErr) throw enrErr;
        const courseIds = (enr || []).map((e: any) => e.course_id);
        if (courseIds.length === 0) { setAssignments([]); setMySubmissions({}); setLoading(false); return; }

        const { data: as, error: asErr } = await supabase
          .from('assignments')
          .select('*, course:courses(id, title)')
          .eq('status', 'published')
          .in('course_id', courseIds)
          .order('due_date', { ascending: true });
        if (asErr) throw asErr;
        const list = (as || []) as Assignment[];
        setAssignments(list);

        const assignmentIds = list.map((a) => a.id);
        if (assignmentIds.length > 0) {
          const { data: subs, error: subErr } = await supabase
            .from('assignment_submissions')
            .select('*')
            .eq('student_id', profile!.id)
            .in('assignment_id', assignmentIds);
          if (subErr) throw subErr;
          const map: Record<string, AssignmentSubmission> = {};
          (subs || []).forEach((s: any) => { map[s.assignment_id] = s; });
          setMySubmissions(map);
        } else {
          setMySubmissions({});
        }
      } else {
        setAssignments([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profile?.id, role]);

  const remove = async (a: Assignment) => {
    if (!confirm(`Delete "${a.title}"? This also removes all student submissions.`)) return;
    try {
      const { error: delErr } = await supabase.from('assignments').delete().eq('id', a.id);
      if (delErr) throw delErr;
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete assignment.');
    }
  };

  const cycleStatus = async (a: Assignment) => {
    const next = a.status === 'draft' ? 'published' : a.status === 'published' ? 'closed' : 'draft';
    try {
      const { error: updErr } = await supabase.from('assignments').update({ status: next }).eq('id', a.id);
      if (updErr) throw updErr;
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to update status.');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <ClipboardCheck size={28} className="text-primary-600 drop-shadow-sm" />
            Assignments
          </h1>
          <p className="text-slate-500 font-medium">
            {role === 'student' ? 'Your assignments and submission status' : 'Create, publish, and grade assignments'}
          </p>
        </div>
        {role === 'professor' && (
          <Button
            variant="gradient"
            onClick={() => { setEditing(null); setShowForm(true); }}
            disabled={courses.length === 0}
            title={courses.length === 0 ? 'Create a course first — assignments must belong to a course.' : undefined}
          >
            <Plus size={16} /> New Assignment
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm font-semibold text-danger-700 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {role === 'professor' && courses.length === 0 ? (
        <Card className="py-4">
          <EmptyState
            icon={<ClipboardCheck size={32} className="text-primary-400" />}
            title="Create a course first"
            description="Assignments belong to a course — create one first, then come back here to add assignments."
            action={onNavigate ? <Button variant="gradient" onClick={() => onNavigate('courses')}><Plus size={16} /> Create a Course</Button> : undefined}
          />
        </Card>
      ) : assignments.length === 0 ? (
        <Card className="py-4">
          <EmptyState
            icon={<ClipboardCheck size={32} className="text-primary-400" />}
            title="No assignments"
            description={role === 'student' ? 'No assignments have been published for your enrolled courses yet.' : 'Create your first assignment to get started.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.map((a) => {
            const sub = mySubmissions[a.id];
            const badge = role === 'student' ? dueBadge(a.due_date, !!sub, sub?.status === 'graded') : null;

            return (
              <div key={a.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col card-hover relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                <div className="flex items-start justify-between gap-3 mb-4 mt-2">
                  {role !== 'student' ? (
                    <Badge color={a.status === 'published' ? 'success' : a.status === 'closed' ? 'slate' : 'warning'}>{a.status}</Badge>
                  ) : (
                    <Badge color={badge!.color}>{badge!.label}</Badge>
                  )}
                </div>

                <h3 className="text-xl font-bold text-slate-800 line-clamp-1 mb-1 group-hover:text-primary-600 transition-colors tracking-tight">{a.title}</h3>
                {a.course && <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 truncate">{a.course.title}</p>}

                <p className="text-sm text-slate-500 mb-6 line-clamp-2 flex-grow leading-relaxed">{a.description || 'No description provided.'}</p>

                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> {a.due_date ? formatDateTime(a.due_date) : 'No due date'}</span>
                  <span className="flex items-center gap-1.5"><Award size={14} className="text-emerald-500" /> {a.max_score} pts</span>
                </div>

                {role === 'student' ? (
                  sub ? (
                    <div className="pt-4 border-t border-slate-100 mt-auto space-y-2">
                      {sub.status === 'graded' ? (
                        <div className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-emerald-100 bg-emerald-50 text-emerald-700 font-bold text-sm">
                          <span className="flex items-center gap-2"><Award size={16} /> Score: {sub.score}/{a.max_score}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-600 font-semibold text-sm">
                          <CheckCircle2 size={16} className="text-primary-500" /> Submitted {formatDateTime(sub.submitted_at)}
                        </div>
                      )}
                      <Button size="sm" variant="secondary" className="w-full" onClick={() => setSubmitting(a)}>
                        {sub.status === 'graded' ? 'View Feedback' : 'Resubmit'}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="gradient" className="w-full mt-auto" onClick={() => setSubmitting(a)}>
                      <Upload size={16} className="mr-1" /> Submit Assignment
                    </Button>
                  )
                ) : (
                  <div className="flex flex-wrap gap-2 w-full pt-4 border-t border-slate-100 mt-auto">
                    <Button size="sm" variant="secondary" className="flex-1 min-w-[88px]" onClick={() => { setEditing(a); setShowForm(true); }}>
                      <Settings size={14} /> Edit
                    </Button>
                    <Button size="sm" variant="primary" className="flex-1 min-w-[88px] bg-primary-50 text-primary-700 hover:bg-primary-100" onClick={() => setViewingSubmissions(a)}>
                      <Users size={14} /> Submissions
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 min-w-[88px] text-slate-500 hover:text-slate-800" onClick={() => cycleStatus(a)}>
                      {a.status === 'draft' ? 'Publish' : a.status === 'published' ? 'Close' : 'Reopen'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger-500 hover:text-danger-700" onClick={() => remove(a)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <AssignmentForm
          assignment={editing}
          courses={courses}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
      {viewingSubmissions && (
        <SubmissionsModal
          assignment={viewingSubmissions}
          onClose={() => setViewingSubmissions(null)}
        />
      )}
      {submitting && (
        <SubmitModal
          assignment={submitting}
          existing={mySubmissions[submitting.id]}
          onClose={() => setSubmitting(null)}
          onDone={() => { setSubmitting(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Assignment Form (create/edit) ─────────────────────────────────────────────
function AssignmentForm({ assignment, courses, onClose, onSaved }: {
  assignment: Assignment | null; courses: Course[]; onClose: () => void; onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [title, setTitle] = useState(assignment?.title || '');
  const [description, setDescription] = useState(assignment?.description || '');
  const [instructions, setInstructions] = useState(assignment?.instructions || '');
  const [courseId, setCourseId] = useState(assignment?.course_id || courses[0]?.id || '');
  const [dueDate, setDueDate] = useState(assignment?.due_date ? assignment.due_date.slice(0, 16) : '');
  const [maxScore, setMaxScore] = useState(String(assignment?.max_score ?? 100));
  const [rubric, setRubric] = useState<RubricCriterion[]>(assignment?.rubric || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addCriterion = () => setRubric((r) => [...r, { criterion: '', max_points: 10 }]);
  const updateCriterion = (idx: number, patch: Partial<RubricCriterion>) =>
    setRubric((r) => r.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const removeCriterion = (idx: number) => setRubric((r) => r.filter((_, i) => i !== idx));

  const save = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!courseId) { setError('Select a course.'); return; }
    const score = parseFloat(maxScore);
    if (isNaN(score) || score <= 0) { setError('Max score must be a positive number.'); return; }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description,
        instructions,
        course_id: courseId,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        max_score: score,
        rubric,
        professor_id: profile!.id,
      };
      if (assignment) {
        const { error: updErr } = await supabase.from('assignments').update(payload).eq('id', assignment.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('assignments').insert(payload);
        if (insErr) throw insErr;
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save assignment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={assignment ? 'Edit Assignment' : 'New Assignment'} maxW="max-w-2xl">
      <div className="space-y-6 p-6 pt-2 max-h-[75vh] overflow-y-auto custom-scrollbar">
        {error && (
          <div className="flex items-center gap-2 text-sm font-semibold text-danger-700 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="shrink-0" /> {error}
          </div>
        )}

        <div>
          <label className="label">Assignment Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Research Paper Draft" required />
        </div>

        <div>
          <label className="label">Course</label>
          <select className="select-field" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Short summary shown to students..." />
        </div>

        <div>
          <label className="label">Instructions</label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder="Detailed submission instructions..." />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="label">Due Date</label>
            <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Max Score</label>
            <Input type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Rubric (optional)</label>
            <Button size="sm" variant="ghost" onClick={addCriterion}><Plus size={14} /> Add Criterion</Button>
          </div>
          {rubric.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No rubric criteria added.</p>
          ) : (
            <div className="space-y-2">
              {rubric.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <Input
                    value={c.criterion}
                    onChange={(e) => updateCriterion(idx, { criterion: e.target.value })}
                    placeholder="Criterion (e.g. Clarity)"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={c.max_points}
                    onChange={(e) => updateCriterion(idx, { max_points: parseFloat(e.target.value) || 0 })}
                    placeholder="Points"
                    className="w-24"
                  />
                  <button onClick={() => removeCriterion(idx)} className="text-slate-400 hover:text-danger-600 p-1.5" aria-label="Remove criterion">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !title || !courseId}>
            {saving ? 'Saving...' : 'Save Assignment'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Submissions (professor grading view) ──────────────────────────────────────
function SubmissionsModal({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<AssignmentSubmission[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('assignment_submissions')
        .select('*, student:profiles(id, full_name, email)')
        .eq('assignment_id', assignment.id)
        .order('submitted_at', { ascending: false });
      if (err) throw err;
      setRows((data || []) as AssignmentSubmission[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [assignment.id]);

  const openFile = async (s: AssignmentSubmission) => {
    setOpening(s.id);
    try {
      const url = await getAssignmentSubmissionUrl(s.file_url);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message || 'Failed to open file.');
    } finally {
      setOpening(null);
    }
  };

  const saveGrade = async (s: AssignmentSubmission) => {
    const draft = drafts[s.id];
    const scoreStr = draft?.score ?? String(s.score ?? '');
    const feedback = draft?.feedback ?? s.feedback ?? '';
    const score = parseFloat(scoreStr);
    if (isNaN(score)) { setError('Enter a valid score before saving.'); return; }
    if (score < 0 || score > assignment.max_score) { setError(`Score must be between 0 and ${assignment.max_score}.`); return; }

    setError('');
    setSaving(s.id);
    try {
      const { error: updErr } = await supabase
        .from('assignment_submissions')
        .update({ score, feedback, status: 'graded', graded_by: profile!.id, graded_at: new Date().toISOString() })
        .eq('id', s.id);
      if (updErr) throw updErr;
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to save grade.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Submissions — ${assignment.title}`} maxW="max-w-4xl">
      {loading ? (
        <div className="p-12 flex justify-center"><Spinner /></div>
      ) : (
        <div className="flex flex-col max-h-[75vh] p-6 pt-2">
          {error && (
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-danger-700 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="shrink-0" /> {error}
            </div>
          )}
          {rows.length === 0 ? (
            <EmptyState icon={<Users size={32} className="text-primary-400" />} title="No submissions yet" description="No students have submitted this assignment." />
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {rows.map((s) => {
                const draft = drafts[s.id];
                return (
                  <div key={s.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="font-bold text-slate-800">{s.student?.full_name || s.student?.email || 'Student'}</p>
                        <p className="text-xs text-slate-400">Submitted {formatDateTime(s.submitted_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={s.status === 'graded' ? 'success' : s.status === 'late' ? 'danger' : 'slate'}>{s.status}</Badge>
                        <Button size="sm" variant="secondary" disabled={opening === s.id} onClick={() => openFile(s)}>
                          <Download size={14} /> {opening === s.id ? 'Opening...' : (s.file_name || 'File')}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="label text-xs">Score (/ {assignment.max_score})</label>
                        <Input
                          type="number"
                          min={0}
                          max={assignment.max_score}
                          defaultValue={s.score ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: { score: e.target.value, feedback: d[s.id]?.feedback ?? s.feedback ?? '' } }))}
                          className="w-28"
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="label text-xs">Feedback</label>
                        <Input
                          defaultValue={s.feedback ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: { score: d[s.id]?.score ?? String(s.score ?? ''), feedback: e.target.value } }))}
                          placeholder="Feedback for the student..."
                        />
                      </div>
                      <Button size="sm" variant="gradient" disabled={saving === s.id} onClick={() => saveGrade(s)}>
                        {saving === s.id ? 'Saving...' : draft || s.status === 'graded' ? 'Update Grade' : 'Save Grade'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-end pt-6 mt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={onClose} size="lg">Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Submit / Resubmit (student) ───────────────────────────────────────────────
function SubmitModal({ assignment, existing, onClose, onDone }: {
  assignment: Assignment; existing?: AssignmentSubmission; onClose: () => void; onDone: () => void;
}) {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const isGraded = existing?.status === 'graded';

  const submit = async () => {
    if (!file) { setError('Choose a file to submit.'); return; }
    if (file.size > MAX_FILE_BYTES) { setError('File is too large (25MB max).'); return; }

    setError('');
    setUploading(true);
    try {
      const path = await uploadAssignmentSubmissionFile(assignment.id, profile!.id, file);
      const isLate = assignment.due_date ? new Date(assignment.due_date).getTime() < Date.now() : false;
      const payload = {
        assignment_id: assignment.id,
        student_id: profile!.id,
        file_url: path,
        file_name: file.name,
        file_size_bytes: file.size,
        submitted_at: new Date().toISOString(),
        status: isLate ? 'late' : 'submitted',
      };
      const { error: upsertErr } = await supabase
        .from('assignment_submissions')
        .upsert(payload, { onConflict: 'assignment_id,student_id' });
      if (upsertErr) throw upsertErr;
      onDone();
    } catch (err: any) {
      setError(err.message || 'Failed to submit assignment.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={assignment.title} maxW="max-w-lg">
      <div className="space-y-5 p-6 pt-2">
        {assignment.instructions && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Instructions</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{assignment.instructions}</p>
          </div>
        )}

        {isGraded ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-emerald-100 bg-emerald-50 text-emerald-700 font-bold">
              <span className="flex items-center gap-2"><Award size={18} /> Score</span>
              <span>{existing!.score} / {assignment.max_score}</span>
            </div>
            {existing!.feedback && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Feedback</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{existing!.feedback}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {existing && (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <FileText size={14} /> Currently submitted: {existing.file_name}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm font-semibold text-danger-700 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="shrink-0" /> {error}
              </div>
            )}
            <div>
              <label className="label">{existing ? 'Replace File' : 'Upload File'}</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary-50 file:text-primary-700 file:font-semibold hover:file:bg-primary-100"
              />
              <p className="text-xs text-slate-400 mt-1.5">Max file size: 25MB</p>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>{isGraded ? 'Close' : 'Cancel'}</Button>
          {!isGraded && (
            <Button variant="gradient" onClick={submit} disabled={uploading || !file}>
              {uploading ? 'Uploading...' : existing ? 'Resubmit' : 'Submit'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
