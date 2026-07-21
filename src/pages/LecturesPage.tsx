import { useEffect, useRef, useState } from 'react';
import {
  FileText, Plus, Play, Bookmark, Download, Upload, Trash2, ArrowLeft, Clock,
  CheckCircle2, Star, Maximize, Gauge, Captions, Save, PenLine, AlertTriangle, Users,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, Lecture, CourseMaterial, Course, WorksheetSubmission, startLectureActivity, updateLectureActivity } from '../lib/supabase';
import { Button, Card, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal, ProgressBar, formatDuration, formatDate, formatDateTime } from '../components/ui';

export default function LecturesPage({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<(Lecture & { materials?: CourseMaterial[]; progress?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Lecture | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [watching, setWatching] = useState<(Lecture & { materials?: CourseMaterial[] }) | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<Record<string, WorksheetSubmission>>({});
  const [worksheet, setWorksheet] = useState<CourseMaterial | null>(null);
  const [gradingWorksheet, setGradingWorksheet] = useState<CourseMaterial | null>(null);

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
    let subMap: Record<string, WorksheetSubmission> = {};
    if (ids.length) {
      const [m, p, b, s] = await Promise.all([
        supabase.from('course_materials').select('*').in('lecture_id', ids),
        role === 'student' ? supabase.from('lecture_progress').select('*').eq('student_id', profile!.id).in('lecture_id', ids) : Promise.resolve({ data: null }),
        role === 'student' ? supabase.from('bookmarks').select('lecture_id').eq('student_id', profile!.id).in('lecture_id', ids) : Promise.resolve({ data: null }),
        role === 'student' ? supabase.from('worksheet_submissions').select('*').eq('student_id', profile!.id) : Promise.resolve({ data: null }),
      ]);
      mats = m.data || [];
      if (p.data) p.data.forEach((pp: any) => (progMap[pp.lecture_id] = pp));
      if (b.data) b.data.forEach((bb: any) => { if (bb.lecture_id) bmSet.add(bb.lecture_id); });
      if (s.data) s.data.forEach((ss: any) => (subMap[ss.material_id] = ss));
    }
    setBookmarks(bmSet);
    setSubmissions(subMap);
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
        <div className="flex flex-col gap-1 mb-8">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Lectures & Materials</h1>
          <p className="text-slate-500 font-medium">Select a course to view its curriculum</p>
        </div>
        {courses.length === 0 ? (
          <Card className="py-4">
            <EmptyState
              icon={<FileText size={32} />}
              title="No courses available"
              description={role === 'student' ? 'Enroll in a course first' : 'Lectures belong to a course — create one first, then come back here to add lectures.'}
              action={role === 'professor' && onNavigate ? <Button variant="gradient" onClick={() => onNavigate('courses')}><Plus size={16} /> Create a Course</Button> : undefined}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => (
              <div key={c.id} onClick={() => loadLectures(c)} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm card-hover cursor-pointer flex flex-col group">
                <div className="flex items-center justify-between mb-4">
                  <Badge color="slate">{c.category}</Badge>
                  <Badge color={c.status === 'published' ? 'success' : 'warning'}>{c.status}</Badge>
                </div>
                <h3 className="font-bold text-slate-800 text-lg leading-snug mb-2 group-hover:text-primary-600 transition-colors">{c.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-6 flex-1">{c.description || 'No description provided'}</p>
                <div className="flex items-center text-sm font-bold text-primary-600 group-hover:translate-x-1 transition-transform w-fit gap-1">
                  <Play size={14} className="fill-primary-600" /> View Curriculum
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedCourse(null); setLectures([]); }} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">{selectedCourse.title}</h1>
            <p className="text-slate-500 font-medium text-sm">Course Curriculum</p>
          </div>
        </div>
        {role === 'professor' && (
          <Button variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> New Lecture</Button>
        )}
      </div>

      {loading ? <Spinner /> : lectures.length === 0 ? (
        <Card className="py-4"><EmptyState icon={<FileText size={32} />} title="No curriculum yet" description={role === 'professor' ? 'Create your first lecture' : 'No lectures available for this course'} /></Card>
      ) : (
        <div className="space-y-4">
          {lectures.map((l) => (
            <div key={l.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-5 group hover:border-slate-200 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-slate-800 text-lg">{l.title}</h3>
                  {role === 'student' && l.progress?.completed_at && <Badge color="success">Completed</Badge>}
                </div>
                {l.description && <p className="text-sm text-slate-500 mb-3 leading-relaxed">{l.description}</p>}
                {l.learning_objectives && (
                  <div className="bg-primary-50 text-primary-800 text-xs px-3 py-2 rounded-lg mb-3 font-medium flex items-start gap-2">
                    <span className="font-bold text-primary-600 mt-0.5">Focus:</span>
                    <span>{l.learning_objectives}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  <span className="flex items-center gap-1.5"><Clock size={12} /> {formatDuration(l.duration_seconds)}</span>
                  <span>Published {formatDate(l.publish_date)}</span>
                  {(l.materials || []).length > 0 && (<span className="text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">{l.materials!.length} Resources</span>)}
                </div>
                {role === 'student' && l.progress && (
                  <div className="flex items-center gap-3 mt-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="flex-1 max-w-xs"><ProgressBar value={l.progress.completion_pct || 0} color="success" size="sm" /></div>
                    <span className="text-xs font-bold text-slate-600">{Math.round(l.progress.completion_pct || 0)}%</span>
                    {l.progress.last_position_seconds > 0 && !l.progress.completed_at && (
                      <span className="text-xs font-bold text-primary-600 ml-2">Resume at {formatDuration(l.progress.last_position_seconds)}</span>
                    )}
                  </div>
                )}
                {(l.materials || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                    {(l.materials || []).map((m) => (
                      <div key={m.id} className="flex items-center gap-1.5">
                        <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm">
                          <Download size={13} className="text-slate-400" /> {m.title} <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase text-[10px]">{m.type}</span>
                        </a>
                        {role === 'student' && m.type === 'worksheet' && (
                          <button onClick={() => setWorksheet(m)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            submissions[m.id]?.status === 'graded' ? 'bg-success-50 text-success-700' :
                            submissions[m.id]?.status === 'submitted' ? 'bg-primary-50 text-primary-700' :
                            submissions[m.id]?.status === 'in_progress' ? 'bg-warning-50 text-warning-700' :
                            'bg-primary-50 text-primary-700 hover:bg-primary-100'
                          }`}>
                            <PenLine size={12} />
                            {submissions[m.id]?.status === 'graded' ? `Graded: ${submissions[m.id]?.score ?? '—'}` :
                             submissions[m.id]?.status === 'submitted' ? 'Submitted — View' :
                             submissions[m.id]?.status === 'in_progress' ? 'Continue Draft' : 'Complete Worksheet'}
                          </button>
                        )}
                        {role === 'professor' && m.type === 'worksheet' && (
                          <button onClick={() => setGradingWorksheet(m)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100">
                            <PenLine size={12} /> Submissions
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-row md:flex-col gap-2 shrink-0 md:w-32 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-5">
                {role === 'student' ? (
                  <>
                    <Button variant="gradient" className="flex-1 md:flex-none justify-center" onClick={() => setWatching(l)}><Play size={14} className="fill-white" /> Watch</Button>
                    <Button variant={bookmarks.has(l.id) ? 'primary' : 'secondary'} className={`flex-1 md:flex-none justify-center ${bookmarks.has(l.id) ? 'bg-sky-100 text-sky-700 hover:bg-sky-200' : ''}`} onClick={() => toggleBookmark(l.id)}>
                      <Bookmark size={14} className={bookmarks.has(l.id) ? 'fill-sky-700' : ''} /> {bookmarks.has(l.id) ? 'Saved' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => { setEditing(l); setShowForm(true); }}>Edit</Button>
                    <UploadButton lecture={l} onDone={() => loadLectures(selectedCourse)} />
                    <Button size="sm" variant="ghost" className="text-danger-600 hover:bg-danger-50 hover:text-danger-700" onClick={async () => {
                      await supabase.from('lectures').delete().eq('id', l.id);
                      loadLectures(selectedCourse);
                    }}><Trash2 size={14} /> Delete</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <LectureForm course={selectedCourse} lecture={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadLectures(selectedCourse); }} />
      )}
      {watching && <WatchModal lecture={watching} course={selectedCourse} onClose={() => setWatching(null)} />}
      {worksheet && (
        <WorksheetModal
          material={worksheet}
          submission={submissions[worksheet.id]}
          onClose={() => setWorksheet(null)}
          onSaved={(sub) => { setSubmissions((s) => ({ ...s, [worksheet.id]: sub })); }}
        />
      )}
      {gradingWorksheet && (
        <WorksheetSubmissionsModal
          material={gradingWorksheet}
          onClose={() => setGradingWorksheet(null)}
        />
      )}
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
    <Modal open onClose={onClose} title={lecture ? 'Edit Lecture' : 'New Lecture'} maxW="max-w-lg">
      <div className="space-y-4 p-6 pt-2">
        <div>
          <label className="label">Title</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Lecture 1: Introduction" required />
        </div>
        <div>
          <label className="label">Description</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Brief overview of the lecture content..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Duration (sec)</label>
            <Input value={duration} onChange={e => setDuration(e.target.value)} type="number" />
          </div>
          <div>
            <label className="label">Order Index</label>
            <Input value={order} onChange={e => setOrder(e.target.value)} type="number" />
          </div>
        </div>
        <div>
          <label className="label">Learning Objectives</label>
          <Textarea value={objectives} onChange={e => setObjectives(e.target.value)} rows={2} placeholder="By the end, students will..." />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !title}>{saving ? 'Saving...' : 'Save Lecture'}</Button>
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
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Upload size={14} /> Attach</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Attach Material" maxW="max-w-md">
        <div className="space-y-4 p-6 pt-2">
          <div>
            <label className="label">Material Type</label>
            <Select value={type} onChange={e => setType(e.target.value as any)}>
              <option value="video">Video</option>
              <option value="pdf">PDF Document</option>
              <option value="book">E-Book</option>
              <option value="note">Notes</option>
              <option value="worksheet">Worksheet</option>
            </Select>
          </div>
          <div>
            <label className="label">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 1 Slides" />
          </div>
          <div>
            <label className="label">URL</label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
            <p className="text-[11px] text-slate-400 font-medium mt-1.5">Paste a direct link to the file or resource.</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={save} disabled={saving || !url}>{saving ? 'Uploading...' : 'Attach'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function WatchModal({ lecture, course, onClose }: { lecture: Lecture & { materials?: CourseMaterial[] }; course: Course; onClose: () => void }) {
  const { profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const [progress, setProgress] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const [totalWatch, setTotalWatch] = useState(0);
  const [lastSave, setLastSave] = useState(0);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const [showRateMenu, setShowRateMenu] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [markedComplete, setMarkedComplete] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [initialSeekDone, setInitialSeekDone] = useState(false);

  const videoMaterial = (lecture.materials || []).find((m) => m.type === 'video');
  const captionMaterial = (lecture.materials || []).find((m) => m.type === 'reference' as any && m.url?.toLowerCase().endsWith('.vtt'));

  useEffect(() => {
    (async () => {
      const [{ data }, { data: ratingRow }] = await Promise.all([
        supabase.from('lecture_activity').select('*').eq('user_id', profile!.id).eq('lecture_id', lecture.id).maybeSingle(),
        supabase.from('lecture_ratings').select('rating').eq('student_id', profile!.id).eq('lecture_id', lecture.id).maybeSingle(),
      ]);
      if (data) {
        setProgress(data);
        setPosition(data.last_position || 0);
        setTotalWatch(data.total_watch_seconds || 0);
        setMarkedComplete(!!data.completed_at);
        setActivityId(data.id);
      } else {
        const { data: actData } = await startLectureActivity(lecture.id);
        if (actData?.[0]?.id) setActivityId(actData[0].id);
      }
      if (ratingRow) setMyRating(ratingRow.rating);
    })();
  }, [lecture.id]);

  // Seek the real <video> element to the saved position once metadata is ready
  useEffect(() => {
    if (!videoMaterial || !videoRef.current || initialSeekDone) return;
    const v = videoRef.current;
    const onLoaded = () => {
      if (position > 0) v.currentTime = position;
      setInitialSeekDone(true);
    };
    v.addEventListener('loadedmetadata', onLoaded);
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [videoMaterial, position, initialSeekDone]);

  // Fallback simulated playback when no real video file is attached
  useEffect(() => {
    if (videoMaterial || !playing) return;
    const interval = setInterval(() => {
      setPosition((p) => { setTotalWatch((w) => w + 1); return p + 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, [playing, videoMaterial]);

  const persist = (pos: number, watch: number) => {
    if (!activityId) return;
    const dur = lecture.duration_seconds || videoRef.current?.duration || 1;
    const pct = Math.min(100, (pos / dur) * 100);
    const completed = pct >= 95;
    updateLectureActivity(activityId, {
      last_position: pos,
      total_watch_seconds: watch,
      completion_percentage: pct,
      completed_at: completed ? new Date().toISOString() : null,
    });
    if (completed && !markedComplete) {
      setMarkedComplete(true);
      supabase.from('watch_events').insert({ student_id: profile!.id, lecture_id: lecture.id, event_type: 'complete', position_seconds: pos });
    }
  };

  useEffect(() => {
    if (!activityId) return;
    if (!progress && position === 0) return;
    const now = Date.now();
    if (now - lastSave < 5000) return;
    setLastSave(now);
    persist(position, totalWatch);
  }, [position, activityId]);

  const togglePlay = () => {
    if (videoMaterial && videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play(); else videoRef.current.pause();
      return;
    }
    setPlaying((p) => {
      const np = !p;
      supabase.from('watch_events').insert({ student_id: profile!.id, lecture_id: lecture.id, event_type: np ? 'resume' : 'pause', position_seconds: position });
      return np;
    });
  };

  const changeRate = (r: number) => {
    setRate(r);
    if (videoRef.current) videoRef.current.playbackRate = r;
    setShowRateMenu(false);
  };

  const goFullscreen = () => {
    const el = videoMaterial ? videoRef.current : playerWrapRef.current;
    if (el?.requestFullscreen) el.requestFullscreen();
  };

  const markComplete = async () => {
    const dur = lecture.duration_seconds || videoRef.current?.duration || 1;
    setMarkedComplete(true);
    setPosition(dur);
    if (activityId) {
      await updateLectureActivity(activityId, { completion_percentage: 100, completed_at: new Date().toISOString(), last_position: dur });
    }
    await supabase.from('watch_events').insert({ student_id: profile!.id, lecture_id: lecture.id, event_type: 'complete', position_seconds: dur });
  };

  const rate5 = async (r: number) => {
    setMyRating(r);
    await supabase.from('lecture_ratings').upsert({ student_id: profile!.id, lecture_id: lecture.id, rating: r }, { onConflict: 'student_id,lecture_id' });
  };

  const dur = lecture.duration_seconds || 1;
  const pct = Math.min(100, (position / dur) * 100);

  return (
    <Modal open onClose={onClose} title={lecture.title} maxW="max-w-3xl">
      <div className="p-6 pt-2 space-y-5">
        {videoMaterial ? (
          <div ref={playerWrapRef} className="relative rounded-2xl overflow-hidden bg-slate-900 shadow-inner group">
            <video
              ref={videoRef}
              src={videoMaterial.url}
              className="w-full aspect-video bg-black"
              controls
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => {
                const t = e.currentTarget.currentTime;
                setPosition(t);
                setTotalWatch((w) => w + (playing ? 1 / 30 : 0));
              }}
              onEnded={markComplete}
            >
              {captionMaterial && <track kind="captions" src={captionMaterial.url} default={captionsOn} />}
            </video>
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <div className="relative">
                <button onClick={() => setShowRateMenu((s) => !s)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 text-white text-xs font-bold backdrop-blur-sm hover:bg-black/70 transition-colors">
                  <Gauge size={13} /> {rate}x
                </button>
                {showRateMenu && (
                  <div className="absolute right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden py-1 w-20 z-20">
                    {PLAYBACK_RATES.map((r) => (
                      <button key={r} onClick={() => changeRate(r)} className={`w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-slate-50 ${r === rate ? 'text-primary-600' : 'text-slate-600'}`}>{r}x</button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setCaptionsOn((c) => !c)}
                disabled={!captionMaterial}
                title={captionMaterial ? 'Toggle captions' : 'No captions available for this lecture'}
                className={`p-1.5 rounded-lg backdrop-blur-sm transition-colors ${captionsOn ? 'bg-primary-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Captions size={15} />
              </button>
              <button onClick={goFullscreen} className="p-1.5 rounded-lg bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-colors">
                <Maximize size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="aspect-video bg-slate-900 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-inner group">
            <div className="text-center text-white relative z-10 transition-transform group-hover:scale-105 duration-500">
              <button onClick={togglePlay} className="w-20 h-20 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-4 transition-all hover:scale-110 shadow-lg ring-1 ring-white/20">
                {playing ? <div className="w-6 h-6 border-l-4 border-r-4 border-white" /> : <Play size={36} className="ml-2 fill-white text-white drop-shadow-md" />}
              </button>
              <p className="text-sm font-bold text-white tracking-wide">No video file attached</p>
              <p className="text-xs font-semibold text-white/50 mt-1 uppercase tracking-widest">{course.title}</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col gap-3">
              <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden backdrop-blur-sm relative">
                <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-sky-400 to-blue-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>{formatDuration(position)} <span className="text-white/40">/ {formatDuration(lecture.duration_seconds)}</span></span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button onClick={() => setShowRateMenu((s) => !s)} className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/10">
                      <Gauge size={11} /> {rate}x
                    </button>
                    {showRateMenu && (
                      <div className="absolute right-0 bottom-7 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden py-1 w-16 z-20">
                        {PLAYBACK_RATES.map((r) => (
                          <button key={r} onClick={() => changeRate(r)} className={`w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-slate-50 ${r === rate ? 'text-primary-600' : 'text-slate-600'}`}>{r}x</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={goFullscreen} className="bg-black/40 p-1 rounded backdrop-blur-sm border border-white/10"><Maximize size={13} /></button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge color={markedComplete || pct >= 95 ? 'success' : 'primary'} className="text-sm px-3 py-1">{markedComplete ? 'Completed' : `${Math.round(pct)}% Watched`}</Badge>
            <Badge color="slate" className="text-sm px-3 py-1">{Math.round(totalWatch / 60)}m Total Watched</Badge>
          </div>
          {!markedComplete && (
            <Button size="sm" variant="secondary" onClick={markComplete}><CheckCircle2 size={14} /> Mark as Completed</Button>
          )}
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Rate this lecture</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)} onClick={() => rate5(n)} aria-label={`Rate ${n} star`}>
              <Star size={18} className={(hoverRating || myRating) >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
            </button>
          ))}
          {myRating > 0 && <span className="text-xs font-bold text-slate-400 ml-2">You rated {myRating}/5</span>}
        </div>

        {lecture.description && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-sm text-slate-700 leading-relaxed">{lecture.description}</p>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={() => { persist(position, totalWatch); onClose(); }}>Close Player</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Worksheet: online completion, save draft, submit, view history ───────────
function WorksheetModal({ material, submission, onClose, onSaved }: {
  material: CourseMaterial; submission?: WorksheetSubmission; onClose: () => void; onSaved: (s: WorksheetSubmission) => void;
}) {
  const { profile } = useAuth();
  const [answer, setAnswer] = useState(submission?.answer_text || '');
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState('');
  const isGraded = submission?.status === 'graded';
  const isSubmitted = submission?.status === 'submitted';
  const readOnly = isGraded || isSubmitted;

  const save = async (finalStatus: 'in_progress' | 'submitted') => {
    setSaving(finalStatus === 'submitted' ? 'submit' : 'draft');
    setError('');
    try {
      const payload = {
        student_id: profile!.id,
        material_id: material.id,
        status: finalStatus,
        answer_text: answer,
        submitted_at: new Date().toISOString(),
      };
      const { data, error: err } = await supabase
        .from('worksheet_submissions')
        .upsert(payload, { onConflict: 'student_id,material_id' })
        .select()
        .single();
      if (err) throw err;
      onSaved(data as WorksheetSubmission);
      if (finalStatus === 'submitted') onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save worksheet.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={material.title} maxW="max-w-2xl">
      <div className="p-6 pt-2 space-y-5">
        <div className="flex items-center justify-between">
          <Badge color={isGraded ? 'success' : isSubmitted ? 'primary' : submission ? 'warning' : 'slate'}>
            {isGraded ? 'Graded' : isSubmitted ? 'Submitted' : submission ? 'Draft Saved' : 'Not Started'}
          </Badge>
          <a href={material.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
            <Download size={12} /> Download Worksheet
          </a>
        </div>

        {error && <div className="text-sm font-semibold text-danger-700 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">{error}</div>}

        {isGraded && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-emerald-100 bg-emerald-50 text-emerald-700 font-bold text-sm">
            <span>Score</span><span>{submission?.score ?? '—'}</span>
          </div>
        )}
        {isGraded && submission?.feedback && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Feedback</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{submission.feedback}</p>
          </div>
        )}

        <div>
          <label className="label">Your Answer</label>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={10}
            placeholder="Complete the worksheet here — your progress is saved as a draft until you submit..."
            disabled={readOnly}
          />
        </div>

        {submission?.updated_at && (
          <p className="text-[11px] text-slate-400 font-medium">Last saved {formatDuration(Math.max(0, Math.floor((Date.now() - new Date(submission.updated_at).getTime()) / 1000)))} ago</p>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
          {!readOnly && (
            <>
              <Button variant="secondary" disabled={saving !== null} onClick={() => save('in_progress')}>
                <Save size={14} /> {saving === 'draft' ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button variant="gradient" disabled={saving !== null || !answer.trim()} onClick={() => save('submitted')}>
                {saving === 'submit' ? 'Submitting...' : 'Submit Worksheet'}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Worksheet Submissions (professor grading view) ────────────────────────────
function WorksheetSubmissionsModal({ material, onClose }: { material: CourseMaterial; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<(WorksheetSubmission & { student?: { full_name: string; email: string } })[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('worksheet_submissions')
        .select('*, student:profiles(full_name, email)')
        .eq('material_id', material.id)
        .in('status', ['submitted', 'graded'])
        .order('submitted_at', { ascending: false });
      if (err) throw err;
      setRows((data || []) as any);
    } catch (err: any) {
      setError(err.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [material.id]);

  const saveGrade = async (s: WorksheetSubmission) => {
    const draft = drafts[s.id];
    const scoreStr = draft?.score ?? String(s.score ?? '');
    const feedback = draft?.feedback ?? s.feedback ?? '';
    const score = parseFloat(scoreStr);
    if (isNaN(score) || score < 0) { setError('Enter a valid score before saving.'); return; }

    setError('');
    setSaving(s.id);
    try {
      const { error: updErr } = await supabase
        .from('worksheet_submissions')
        .update({ score, feedback, status: 'graded' })
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
    <Modal open onClose={onClose} title={`Submissions — ${material.title}`} maxW="max-w-4xl">
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
            <EmptyState icon={<Users size={32} className="text-primary-400" />} title="No submissions yet" description="No students have submitted this worksheet." />
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
                      <Badge color={s.status === 'graded' ? 'success' : 'slate'}>{s.status}</Badge>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-100 p-4 mb-3 max-h-40 overflow-y-auto">
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{s.answer_text || <span className="italic text-slate-400">No answer provided</span>}</p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="label text-xs">Score</label>
                        <Input
                          type="number"
                          min={0}
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
