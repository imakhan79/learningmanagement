import { useEffect, useState } from 'react';
import { FileText, Plus, Play, Bookmark, Download, Upload, Trash2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, Lecture, CourseMaterial, Course } from '../lib/supabase';
import { Button, Card, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal, ProgressBar, formatDuration, formatDate } from '../components/ui';

export default function LecturesPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<(Lecture & { materials?: CourseMaterial[]; progress?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Lecture | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [watching, setWatching] = useState<Lecture | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  const loadCourses = async () => {
    let q = supabase.from('courses').select('*').order('created_at', { ascending: false });
    if (role === 'professor') q = q.eq('professor_id', profile!.id);
    else if (role === 'student') {
      const { data: enr } = await supabase.from('enrollments').select('course_id').eq('student_id', profile!.id);
      const ids = (enr || []).map((e) => e.course_id);
      q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).in('status', ['approved', 'published']);
    }
    const { data } = await q;
    setCourses(data || []);
    setLoading(false);
  };

  useEffect(() => { loadCourses(); }, [profile?.id]);

  const loadLectures = async (course: Course) => {
    setSelectedCourse(course);
    setLoading(true);
    const { data: lecs } = await supabase.from('lectures').select('*').eq('course_id', course.id).order('order_index', { ascending: true });
    const ids = (lecs || []).map((l) => l.id);
    let mats: any[] = [];
    let progMap: Record<string, any> = {};
    let bmSet = new Set<string>();
    if (ids.length) {
      const [m, p, b] = await Promise.all([
        supabase.from('course_materials').select('*').in('lecture_id', ids),
        role === 'student' ? supabase.from('lecture_progress').select('*').eq('student_id', profile!.id).in('lecture_id', ids) : Promise.resolve({ data: null }),
        role === 'student' ? supabase.from('bookmarks').select('lecture_id').eq('student_id', profile!.id).in('lecture_id', ids) : Promise.resolve({ data: null }),
      ]);
      mats = m.data || [];
      if (p.data) p.data.forEach((pp: any) => (progMap[pp.lecture_id] = pp));
      if (b.data) b.data.forEach((bb: any) => bmSet.add(bb.lecture_id));
    }
    setBookmarks(bmSet);
    setLectures((lecs || []).map((l: any) => ({ ...l, materials: mats.filter((m) => m.lecture_id === l.id), progress: progMap[l.id] })));
    setLoading(false);
  };

  const toggleBookmark = async (lectureId: string) => {
    if (bookmarks.has(lectureId)) {
      await supabase.from('bookmarks').delete().eq('student_id', profile!.id).eq('lecture_id', lectureId);
      setBookmarks((s) => { const n = new Set(s); n.delete(lectureId); return n; });
    } else {
      await supabase.from('bookmarks').insert({ student_id: profile!.id, lecture_id: lectureId });
      setBookmarks((s) => { const n = new Set(s); n.add(lectureId); return n; });
    }
  };

  if (loading && !selectedCourse) return <Spinner />;

  if (!selectedCourse) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Lectures</h1>
          <p className="text-sm text-slate-500">Select a course to view lectures</p>
        </div>
        {courses.length === 0 ? (
          <Card><EmptyState icon={<FileText size={32} />} title="No courses" subtitle={role === 'student' ? 'Enroll in a course first' : 'Create a course first'} /></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <Card key={c.id} className="p-5 cursor-pointer hover:border-sky-300 hover:shadow-md transition-all" >
                <div className="flex items-center justify-between mb-2">
                  <Badge color="slate">{c.category}</Badge>
                  <Badge color={c.status === 'published' ? 'green' : 'amber'}>{c.status}</Badge>
                </div>
                <h3 className="font-semibold text-slate-800 mb-1">{c.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-3">{c.description || 'No description'}</p>
                <Button size="sm" variant="outline" onClick={() => loadLectures(c)}><Play size={14} /> View Lectures</Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedCourse(null); setLectures([]); }}><ArrowLeft size={16} /> Back</Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{selectedCourse.title}</h1>
          <p className="text-sm text-slate-500">Lectures & materials</p>
        </div>
        {role === 'professor' && (
          <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> New Lecture</Button>
        )}
      </div>

      {loading ? <Spinner /> : lectures.length === 0 ? (
        <Card><EmptyState icon={<FileText size={32} />} title="No lectures yet" subtitle={role === 'professor' ? 'Create your first lecture' : 'No lectures available'} /></Card>
      ) : (
        <div className="space-y-3">
          {lectures.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800">{l.title}</h3>
                    {role === 'student' && l.progress?.completed_at && <Badge color="green">Completed</Badge>}
                  </div>
                  {l.description && <p className="text-sm text-slate-500 mb-2">{l.description}</p>}
                  {l.learning_objectives && (
                    <p className="text-xs text-slate-400 mb-2"><span className="font-medium">Objectives:</span> {l.learning_objectives}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                    <span>{formatDuration(l.duration_seconds)}</span>
                    <span>•</span>
                    <span>Published {formatDate(l.publish_date)}</span>
                    {(l.materials || []).length > 0 && (<><span>•</span><span>{l.materials!.length} materials</span></>)}
                  </div>
                  {role === 'student' && l.progress && (
                    <div className="flex items-center gap-2 mt-2">
                      <ProgressBar value={l.progress.completion_pct || 0} className="flex-1 max-w-xs" />
                      <span className="text-xs text-slate-500">{Math.round(l.progress.completion_pct || 0)}%</span>
                      {l.progress.last_position_seconds > 0 && !l.progress.completed_at && (
                        <span className="text-xs text-sky-600">Resume @ {formatDuration(l.progress.last_position_seconds)}</span>
                      )}
                    </div>
                  )}
                  {(l.materials || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(l.materials || []).map((m) => (
                        <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs hover:bg-slate-200">
                          <Download size={12} /> {m.title} <Badge color="slate">{m.type}</Badge>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {role === 'student' ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setWatching(l)}><Play size={14} /> Watch</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleBookmark(l.id)}>
                        <Bookmark size={14} className={bookmarks.has(l.id) ? 'fill-sky-500 text-sky-500' : ''} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(l); setShowForm(true); }}>Edit</Button>
                      <UploadButton lecture={l} onDone={() => loadLectures(selectedCourse)} />
                      <Button size="sm" variant="ghost" onClick={async () => {
                        await supabase.from('lectures').delete().eq('id', l.id);
                        loadLectures(selectedCourse);
                      }}><Trash2 size={14} /></Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <LectureForm course={selectedCourse} lecture={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadLectures(selectedCourse); }} />
      )}
      {watching && <WatchModal lecture={watching} course={selectedCourse} onClose={() => setWatching(null)} />}
    </div>
  );
}

function LectureForm({ course, lecture, onClose, onSaved }: { course: Course; lecture: Lecture | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(lecture?.title || '');
  const [description, setDescription] = useState(lecture?.description || '');
  const [duration, setDuration] = useState(String(lecture?.duration_seconds || 0));
  const [objectives, setObjectives] = useState(lecture?.learning_objectives || '');
  const [order, setOrder] = useState(String(lecture?.order_index || 0));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const payload = {
      course_id: course.id,
      title,
      description,
      duration_seconds: parseInt(duration) || 0,
      learning_objectives: objectives,
      order_index: parseInt(order) || 0,
    };
    if (lecture) await supabase.from('lectures').update(payload).eq('id', lecture.id);
    else await supabase.from('lectures').insert(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={lecture ? 'Edit Lecture' : 'New Lecture'}>
      <div className="space-y-4">
        <Input label="Title" value={title} onChange={setTitle} placeholder="Lecture 1: Introduction" required />
        <Textarea label="Description" value={description} onChange={setDescription} rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Duration (seconds)" value={duration} onChange={setDuration} type="number" />
          <Input label="Order" value={order} onChange={setOrder} type="number" />
        </div>
        <Textarea label="Learning Objectives" value={objectives} onChange={setObjectives} rows={2} placeholder="By the end, students will…" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function UploadButton({ lecture, onDone }: { lecture: Lecture; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'video' | 'pdf' | 'book' | 'note' | 'worksheet'>('pdf');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await supabase.from('course_materials').insert({
      course_id: lecture.course_id,
      lecture_id: lecture.id,
      type,
      title: title || `${type} material`,
      url,
    });
    setSaving(false);
    setOpen(false);
    setTitle(''); setUrl('');
    onDone();
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Upload size={14} /></Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Material">
        <div className="space-y-4">
          <Select label="Type" value={type} onChange={(v) => setType(v as any)} options={[
            { value: 'video', label: 'Video' }, { value: 'pdf', label: 'PDF' }, { value: 'book', label: 'Book' },
            { value: 'note', label: 'Note' }, { value: 'worksheet', label: 'Worksheet' },
          ]} />
          <Input label="Title" value={title} onChange={setTitle} placeholder="Lecture slides" />
          <Input label="URL" value={url} onChange={setUrl} placeholder="https://…" />
          <p className="text-xs text-slate-400">Paste a link to the file (video stream URL, PDF, etc.).</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !url}>{saving ? 'Uploading…' : 'Add'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function WatchModal({ lecture, course, onClose }: { lecture: Lecture; course: Course; onClose: () => void }) {
  const { profile } = useAuth();
  const [position, setPosition] = useState(0);
  const [progress, setProgress] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const [totalWatch, setTotalWatch] = useState(0);
  const [lastSave, setLastSave] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('lecture_progress').select('*').eq('student_id', profile!.id).eq('lecture_id', lecture.id).maybeSingle();
      if (data) {
        setProgress(data);
        setPosition(data.last_position_seconds || 0);
        setTotalWatch(data.total_watch_seconds || 0);
      } else {
        await supabase.from('lecture_progress').insert({ student_id: profile!.id, lecture_id: lecture.id });
        await supabase.from('watch_events').insert({ student_id: profile!.id, lecture_id: lecture.id, event_type: 'start', position_seconds: 0 });
      }
    })();
  }, [lecture.id]);

  // simulate playback timer
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setPosition((p) => {
        const np = p + 1;
        setTotalWatch((w) => w + 1);
        return np;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [playing]);

  // persist progress every 5s
  useEffect(() => {
    if (!progress && position === 0) return;
    const now = Date.now();
    if (now - lastSave < 5000) return;
    setLastSave(now);
    const dur = lecture.duration_seconds || 1;
    const pct = Math.min(100, (position / dur) * 100);
    const completed = pct >= 95;
    supabase.from('lecture_progress').update({
      last_position_seconds: position,
      completion_pct: pct,
      total_watch_seconds: totalWatch,
      last_viewed_at: new Date().toISOString(),
      completed_at: completed ? new Date().toISOString() : null,
      resume_count: (progress?.resume_count || 0) + (playing && position > 0 ? 0 : 0),
    }).eq('student_id', profile!.id).eq('lecture_id', lecture.id);
    if (completed && !progress?.completed_at) {
      supabase.from('watch_events').insert({ student_id: profile!.id, lecture_id: lecture.id, event_type: 'complete', position_seconds: position });
    }
  }, [position]);

  const togglePlay = () => {
    setPlaying((p) => {
      const np = !p;
      supabase.from('watch_events').insert({
        student_id: profile!.id, lecture_id: lecture.id,
        event_type: np ? 'resume' : 'pause', position_seconds: position,
      });
      return np;
    });
  };

  const dur = lecture.duration_seconds || 1;
  const pct = Math.min(100, (position / dur) * 100);

  return (
    <Modal open onClose={onClose} title={lecture.title} size="lg">
      <div className="space-y-4">
        <div className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center relative overflow-hidden">
          <div className="text-center text-white">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
              <Play size={28} className="ml-1" />
            </div>
            <p className="text-sm text-slate-300">Video Player (demo)</p>
            <p className="text-xs text-slate-400 mt-1">{course.title}</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
            <div className="w-full bg-white/20 rounded-full h-1.5 mb-2 overflow-hidden">
              <div className="h-full bg-sky-400 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-white">
              <span>{formatDuration(position)} / {formatDuration(lecture.duration_seconds)}</span>
              <button onClick={togglePlay} className="px-3 py-1 rounded-md bg-white/20 hover:bg-white/30">
                {playing ? 'Pause' : 'Play'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge color={pct >= 95 ? 'green' : 'blue'}>{Math.round(pct)}% complete</Badge>
          <Badge color="slate">{Math.round(totalWatch / 60)}min watched</Badge>
        </div>
        {lecture.description && <p className="text-sm text-slate-600">{lecture.description}</p>}
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
