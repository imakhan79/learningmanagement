import { useEffect, useMemo, useState } from 'react';
import { Search, FileText, BookMarked, Download, Eye, Bookmark, Clock } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Spinner, Badge, EmptyState, Card, Button, Input, formatDate } from '../components/ui';

interface MaterialRow {
  id: string;
  title: string;
  type: string;
  url: string;
  size_bytes: number;
  course_id: string;
  course_title: string;
  created_at: string;
  lastViewedAt?: string;
}

const TYPES = ['pdf', 'note', 'book'] as const;

export default function LibraryPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [bookmarked, setBookmarked] = useState<Record<string, string>>({}); // material_id -> bookmark row id
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  useEffect(() => { if (profile) load(); }, [profile?.id]);

  async function load() {
    setLoading(true);
    const { data: enr } = await supabase.from('enrollments').select('course_id, course:courses(id, title)').eq('student_id', profile!.id);
    const courseIds = (enr || []).map((e: any) => e.course_id);
    const courseTitleMap: Record<string, string> = {};
    (enr || []).forEach((e: any) => { courseTitleMap[e.course_id] = e.course?.title || 'Course'; });

    if (!courseIds.length) { setMaterials([]); setLoading(false); return; }

    const [{ data: mats }, { data: bms }, { data: views }] = await Promise.all([
      supabase.from('course_materials').select('*').in('course_id', courseIds).in('type', TYPES as any).order('created_at', { ascending: false }),
      supabase.from('bookmarks').select('id, material_id').eq('student_id', profile!.id).not('material_id', 'is', null),
      supabase.from('material_views').select('material_id, viewed_at').eq('student_id', profile!.id).order('viewed_at', { ascending: false }),
    ]);

    const bmMap: Record<string, string> = {};
    (bms || []).forEach((b: any) => { bmMap[b.material_id] = b.id; });
    setBookmarked(bmMap);

    const viewMap: Record<string, string> = {};
    (views || []).forEach((v: any) => { if (!viewMap[v.material_id]) viewMap[v.material_id] = v.viewed_at; });

    setMaterials((mats || []).map((m: any) => ({
      id: m.id, title: m.title, type: m.type, url: m.url, size_bytes: m.size_bytes,
      course_id: m.course_id, course_title: courseTitleMap[m.course_id] || 'Course',
      created_at: m.created_at, lastViewedAt: viewMap[m.id],
    })));
    setLoading(false);
  }

  const toggleBookmark = async (materialId: string) => {
    if (bookmarked[materialId]) {
      await supabase.from('bookmarks').delete().eq('id', bookmarked[materialId]);
      setBookmarked((b) => { const n = { ...b }; delete n[materialId]; return n; });
    } else {
      const { data } = await supabase.from('bookmarks').insert({ student_id: profile!.id, material_id: materialId }).select().single();
      if (data) setBookmarked((b) => ({ ...b, [materialId]: data.id }));
    }
  };

  const openMaterial = async (m: MaterialRow) => {
    await supabase.from('material_views').insert({ student_id: profile!.id, material_id: m.id });
    window.open(m.url, '_blank', 'noopener,noreferrer');
    setMaterials((prev) => prev.map((x) => x.id === m.id ? { ...x, lastViewedAt: new Date().toISOString() } : x));
  };

  const courses = useMemo(() => Array.from(new Map(materials.map((m) => [m.course_id, m.course_title])).entries()), [materials]);

  const filtered = materials.filter((m) => {
    if (typeFilter !== 'all' && m.type !== typeFilter) return false;
    if (courseFilter !== 'all' && m.course_id !== courseFilter) return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const recentlyOpened = materials.filter((m) => m.lastViewedAt).sort((a, b) => new Date(b.lastViewedAt!).getTime() - new Date(a.lastViewedAt!).getTime()).slice(0, 4);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
          <FileText size={28} className="text-primary-600 drop-shadow-sm" />
          PDFs & Notes
        </h1>
        <p className="text-slate-500 font-medium">Books, PDFs, and notes across your enrolled courses</p>
      </div>

      {recentlyOpened.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-slate-400" />
            <h3 className="text-sm font-bold text-slate-700">Recently Opened</h3>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {recentlyOpened.map((m) => (
              <button key={m.id} onClick={() => openMaterial(m)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary-200 hover:bg-primary-50 transition-colors text-left">
                <FileText size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs font-bold text-slate-700 truncate max-w-[160px]">{m.title}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PDFs, notes, books..." className="pl-10" />
        </div>
        <select className="select-field w-full sm:w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="pdf">PDF</option>
          <option value="note">Notes</option>
          <option value="book">E-Book</option>
        </select>
        <select className="select-field w-full sm:w-52" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="all">All Courses</option>
          {courses.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-4">
          <EmptyState icon={<FileText size={32} />} title="No resources found" description={materials.length ? 'Try a different search or filter.' : 'No PDFs or notes have been uploaded to your courses yet.'} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-3 card-hover">
              <div className="flex items-start justify-between gap-2">
                <span className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  {m.type === 'book' ? <BookMarked size={18} /> : <FileText size={18} />}
                </span>
                <button onClick={() => toggleBookmark(m.id)} className={`p-1.5 rounded-lg transition-colors ${bookmarked[m.id] ? 'text-sky-600 bg-sky-50' : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'}`} aria-label="Bookmark">
                  <Bookmark size={16} className={bookmarked[m.id] ? 'fill-sky-600' : ''} />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm line-clamp-2">{m.title}</p>
                <p className="text-xs text-slate-500 mt-1 truncate">{m.course_title}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <Badge color="slate">{m.type.toUpperCase()}</Badge>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(m.created_at)}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => openMaterial(m)}><Eye size={13} /> View</Button>
                <a href={m.url} download target="_blank" rel="noreferrer" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Download size={13} /> Download</Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
