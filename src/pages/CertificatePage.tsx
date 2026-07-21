import { useEffect, useState } from 'react';
import {
  Award, GraduationCap, Calendar, ExternalLink, Download,
  Star, BookOpen, Search
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Spinner } from '../components/ui';

interface CertRecord {
  id: string;
  title: string;
  course: string;
  instructor: string;
  completedAt: string;
  grade: number;
  category: string;
  certId: string;
}

function generateCertId(enrollmentId: string) {
  return 'CERT-' + enrollmentId.replace(/-/g, '').toUpperCase().slice(0, 12);
}

function gradeLabel(score: number) {
  if (score >= 90) return { label: 'Distinction', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
  if (score >= 75) return { label: 'Merit', color: 'text-primary-600', bg: 'bg-primary-50 border-primary-200' };
  if (score >= 60) return { label: 'Pass', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  return { label: 'Completion', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' };
}

function downloadCertificate(cert: CertRecord, studentName: string) {
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;
  const completedDate = new Date(cert.completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  win.document.write(`<!doctype html><html><head><title>${cert.certId}</title><style>
    @page { size: landscape; margin: 0; }
    body { margin: 0; font-family: Georgia, 'Times New Roman', serif; background: #fdf6e3; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .cert { width: 90%; max-width: 900px; border: 10px solid #f59e0b; border-radius: 16px; padding: 60px 50px; text-align: center; background: linear-gradient(135deg,#fffbeb,#fef3c7); }
    .kicker { letter-spacing: 6px; text-transform: uppercase; font-size: 12px; font-weight: bold; color: #b45309; }
    .sub { color: #64748b; margin: 18px 0 4px; font-size: 14px; }
    .name { font-size: 34px; font-weight: bold; color: #1e293b; margin: 6px 0 16px; }
    .course { font-size: 22px; font-weight: bold; color: #4338ca; margin: 10px 0 24px; }
    .meta { display: flex; justify-content: center; gap: 40px; margin-top: 28px; }
    .meta div { text-align: center; }
    .meta p.label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; margin: 0 0 4px; }
    .meta p.value { font-size: 16px; font-weight: bold; color: #1e293b; margin: 0; }
    .certid { margin-top: 30px; font-size: 11px; letter-spacing: 2px; color: #94a3b8; }
  </style></head><body>
    <div class="cert">
      <p class="kicker">Certificate of Completion</p>
      <p class="sub">This is to certify that</p>
      <p class="name">${studentName}</p>
      <p class="sub">has successfully completed</p>
      <p class="course">${cert.course}</p>
      <div class="meta">
        <div><p class="label">Grade</p><p class="value">${cert.grade}%</p></div>
        <div><p class="label">Completed</p><p class="value">${completedDate}</p></div>
        <div><p class="label">Instructor</p><p class="value">${cert.instructor}</p></div>
      </div>
      <p class="certid">${cert.certId}</p>
    </div>
    <script>window.onload = () => { window.print(); }</script>
  </body></html>`);
  win.document.close();
}

export default function CertificatePage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [certs, setCerts] = useState<CertRecord[]>([]);
  const [search, setSearch] = useState('');
  const [previewCert, setPreviewCert] = useState<CertRecord | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== 'student') { setLoading(false); return; }
    load();
  }, [profile?.id]);

  async function load() {
    setLoading(true);
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, progress_pct, status, enrolled_at, updated_at, course:courses(title, category, professor:profiles!courses_professor_id_fkey(full_name))')
      .eq('student_id', profile!.id)
      .or('status.eq.completed,progress_pct.gte.100');

    const { data: attempts } = await supabase
      .from('exam_attempts')
      .select('score, total_marks, exam:exams(course_id)')
      .eq('student_id', profile!.id)
      .eq('status', 'submitted');

    const avgScoresByCourse: Record<string, number> = {};
    if (attempts) {
      const byCourse: Record<string, number[]> = {};
      attempts.forEach((a: any) => {
        const cid = a.exam?.course_id;
        if (cid && a.total_marks > 0) {
          const pct = Math.round((a.score / a.total_marks) * 100);
          if (!byCourse[cid]) byCourse[cid] = [];
          byCourse[cid].push(pct);
        }
      });
      Object.entries(byCourse).forEach(([cid, scores]) => {
        avgScoresByCourse[cid] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      });
    }

    const records: CertRecord[] = (enrollments || []).map((e: any) => {
      const course = Array.isArray(e.course) ? e.course[0] : e.course;
      const instructor = Array.isArray(course?.professor) ? course.professor[0] : course?.professor;
      return {
        id: e.id,
        title: `Certificate of Completion`,
        course: course?.title || 'Unknown Course',
        instructor: instructor?.full_name || 'Course Instructor',
        completedAt: e.updated_at || e.enrolled_at,
        grade: avgScoresByCourse[course?.id] ?? 80,
        category: course?.category || 'General',
        certId: generateCertId(e.id),
      };
    });

    setCerts(records);
    setLoading(false);
  }

  const filtered = certs.filter(c =>
    c.course.toLowerCase().includes(search.toLowerCase()) ||
    c.certId.toLowerCase().includes(search.toLowerCase())
  );

  if (!profile) return <div className="p-12 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <Award size={28} className="text-amber-500 drop-shadow-sm" />
            My Certificates
          </h1>
          <p className="text-slate-500 font-medium">
            {loading ? 'Loading...' : `${certs.length} certificate${certs.length !== 1 ? 's' : ''} earned`}
          </p>
        </div>

        {certs.length > 0 && (
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary-400 outline-none shadow-sm w-64"
              placeholder="Search certificates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {profile.role !== 'student' ? (
        <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center justify-center gap-4">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
            <Award size={40} className="text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-600 tracking-tight">Certificates are for students</p>
            <p className="text-slate-400 font-medium mt-1">This section shows student course completion certificates.</p>
          </div>
        </div>
      ) : loading ? (
        <div className="p-12 flex justify-center"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center justify-center gap-4">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
            <GraduationCap size={40} className="text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-600 tracking-tight">
              {search ? 'No matching certificates' : 'No certificates yet'}
            </p>
            <p className="text-slate-400 font-medium mt-1">
              {search ? 'Try a different search term.' : 'Complete a course to earn your first certificate!'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filtered.map(cert => {
            const grade = gradeLabel(cert.grade);
            return (
              <div
                key={cert.id}
                className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group cursor-pointer"
                onClick={() => setPreviewCert(cert)}
              >
                {/* Certificate decorative header */}
                <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 opacity-15 p-3 group-hover:scale-110 transition-transform duration-500">
                    <Award size={100} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-white/30 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <Star size={16} className="text-white fill-white" />
                      </div>
                      <span className="text-white font-black text-xs tracking-widest uppercase">Certificate of Completion</span>
                    </div>
                    <h3 className="text-white font-black text-xl tracking-tight leading-tight">{cert.course}</h3>
                  </div>
                </div>

                {/* Details */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`px-3 py-1 rounded-full border text-xs font-black ${grade.bg} ${grade.color}`}>
                      {grade.label}
                    </div>
                    <span className="text-2xl font-black text-slate-700 tracking-tight">{cert.grade}%</span>
                  </div>

                  <div className="space-y-2.5 text-sm text-slate-500 font-medium">
                    <div className="flex items-center gap-2.5">
                      <BookOpen size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{cert.category}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <GraduationCap size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{cert.instructor}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Calendar size={14} className="text-slate-400 shrink-0" />
                      <span>{new Date(cert.completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 font-mono tracking-wider">{cert.certId}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); setPreviewCert(cert); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
                      >
                        <ExternalLink size={12} /> View
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); downloadCertificate(cert, profile!.full_name || profile!.email); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                      >
                        <Download size={12} /> Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Certificate Preview Modal */}
      {previewCert && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewCert(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Certificate */}
            <div className="relative bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 p-12 text-center border-8 border-amber-200 m-6 rounded-2xl overflow-hidden">
              {/* Decorative corners */}
              <div className="absolute top-3 left-3 w-12 h-12 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
              <div className="absolute top-3 right-3 w-12 h-12 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
              <div className="absolute bottom-3 left-3 w-12 h-12 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
              <div className="absolute bottom-3 right-3 w-12 h-12 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
              {/* Background watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-5">
                <Award size={300} className="text-amber-600" />
              </div>

              <div className="relative z-10 space-y-4">
                <div className="flex justify-center mb-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <Award size={32} className="text-white" />
                  </div>
                </div>
                <p className="text-xs font-black tracking-[0.4em] uppercase text-amber-700">Certificate of Completion</p>
                <p className="text-slate-500 font-medium text-sm">This is to certify that</p>
                <p className="text-3xl font-black text-slate-900 tracking-tight">{profile.full_name || profile.email}</p>
                <p className="text-slate-500 font-medium text-sm">has successfully completed</p>
                <p className="text-xl font-black text-primary-700 tracking-tight px-4">{previewCert.course}</p>
                <div className="flex items-center justify-center gap-6 pt-4">
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Grade</p>
                    <p className="text-2xl font-black text-slate-800">{previewCert.grade}%</p>
                  </div>
                  <div className="w-px h-10 bg-amber-300" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Completed</p>
                    <p className="text-sm font-black text-slate-800">{new Date(previewCert.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <div className="w-px h-10 bg-amber-300" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Instructor</p>
                    <p className="text-sm font-black text-slate-800 max-w-[100px] truncate">{previewCert.instructor}</p>
                  </div>
                </div>
                <p className="text-xs font-mono text-slate-400 tracking-widest pt-4 border-t border-amber-200">{previewCert.certId}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-8 pb-8 flex gap-4">
              <button onClick={() => setPreviewCert(null)} className="flex-1 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors">
                Close
              </button>
              <button
                onClick={() => downloadCertificate(previewCert, profile.full_name || profile.email)}
                className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
              >
                <Download size={18} /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
