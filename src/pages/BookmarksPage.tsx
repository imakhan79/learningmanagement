import { useEffect, useState } from 'react';
import { Bookmark, Play, FileText, BookMarked, Trash2, Download } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Spinner, Badge, EmptyState, Card, Button, formatDate } from '../components/ui';

interface BookmarkRow {
  id: string;
  type: 'lecture' | 'material';
  title: string;
  courseTitle: string;
  materialType?: string;
  url?: string;
  createdAt: string;
  lectureId?: string;
}

const TYPE_ICON: Record<string, any> = { video: Play, pdf: FileText, note: FileText, book: BookMarked, worksheet: FileText };

export default function BookmarksPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BookmarkRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'lecture' | 'material'>('all');

  useEffect(() => { if (profile) load(); }, [profile?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('bookmarks')
      .select('id, created_at, lecture:lectures(id, title, course:courses(title)), material:course_materials(id, title, type, url, course:courses(title))')
      .eq('student_id', profile!.id)
      .order('created_at', { ascending: false });

    const built: BookmarkRow[] = (data || []).map((b: any) => {
      if (b.lecture) {
        return {
          id: b.id, type: 'lecture' as const, title: b.lecture.title,
          courseTitle: b.lecture.course?.title || 'Course', createdAt: b.created_at, lectureId: b.lecture.id,
        };
      }
      return {
        id: b.id, type: 'material' as const, title: b.material?.title || 'Resource',
        courseTitle: b.material?.course?.title || 'Course', materialType: b.material?.type,
        url: b.material?.url, createdAt: b.created_at,
      };
    }).filter((b: any) => b.title);

    setRows(built);
    setLoading(false);
  }

  async function remove(id: string) {
    await supabase.from('bookmarks').delete().eq('id', id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) return <Spinner />;

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <Bookmark size={28} className="text-primary-600 drop-shadow-sm" />
            Bookmarks
          </h1>
          <p className="text-slate-500 font-medium">{rows.length} saved item{rows.length !== 1 ? 's' : ''} for quick access</p>
        </div>
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl w-fit">
          {(['all', 'lecture', 'material'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all capitalize ${filter === f ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {f === 'material' ? 'PDFs & Notes' : f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-4">
          <EmptyState icon={<Bookmark size={32} />} title="No bookmarks yet" description="Bookmark lectures, PDFs, and notes from your courses to find them here." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((b) => {
            const Icon = b.type === 'lecture' ? Play : TYPE_ICON[b.materialType || 'note'] || FileText;
            return (
              <div key={b.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-3 card-hover">
                <div className="flex items-start justify-between gap-2">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${b.type === 'lecture' ? 'bg-indigo-100 text-indigo-600' : 'bg-sky-100 text-sky-600'}`}>
                    <Icon size={18} />
                  </span>
                  <button onClick={() => remove(b.id)} className="p-1.5 text-slate-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors" aria-label="Remove bookmark">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm line-clamp-2">{b.title}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{b.courseTitle}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Badge color="slate">{b.type === 'lecture' ? 'Lecture' : (b.materialType || 'file').toUpperCase()}</Badge>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(b.createdAt)}</span>
                </div>
                {b.type === 'material' && b.url && (
                  <a href={b.url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="secondary" className="w-full"><Download size={13} /> Open</Button>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
