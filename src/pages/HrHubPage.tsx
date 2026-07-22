import { useEffect, useState } from 'react';
import {
  Shield, Users, GraduationCap, BookOpen, DollarSign, Radio,
  LayoutDashboard, UserPlus, BookUser, Archive, Mail, Phone, Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StatCard, ChartCard } from '../components/charts';
import { Spinner, Badge, Avatar, formatCurrency, formatDate, EmptyState } from '../components/ui';

interface LiveCourse {
  id: string;
  title: string;
  category: string;
  professorName: string;
  created_at: string;
}

interface OverviewData {
  admins: number;
  students: number;
  professors: number;
  enrolledAdmins: number;
  enrolledStudents: number;
  enrolledProfessors: number;
  liveCourses: LiveCourse[];
  revenue: number;
}

interface PersonRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  detail?: string;
}

interface RoleBuckets {
  admins: PersonRow[];
  students: PersonRow[];
  professors: PersonRow[];
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
  { id: 'onboarding', label: 'Onboarding', icon: <UserPlus size={16} /> },
  { id: 'directory', label: 'Directory', icon: <BookUser size={16} /> },
  { id: 'offboarding', label: 'Off-Boarding', icon: <Archive size={16} /> },
] as const;

type TabId = typeof TABS[number]['id'];

const OFFBOARD_STUDENT_STATUSES = ['graduated', 'withdrawn', 'terminated'];

export default function HrHubPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);

  const [onboarding, setOnboarding] = useState<RoleBuckets | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const [directory, setDirectory] = useState<RoleBuckets | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  const [offboarding, setOffboarding] = useState<RoleBuckets | null>(null);
  const [offboardingLoading, setOffboardingLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setOverview(await loadOverview());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeTab === 'onboarding' && !onboarding) {
      setOnboardingLoading(true);
      loadOnboarding().then(setOnboarding).finally(() => setOnboardingLoading(false));
    }
    if (activeTab === 'directory' && !directory) {
      setDirectoryLoading(true);
      loadDirectory().then(setDirectory).finally(() => setDirectoryLoading(false));
    }
    if (activeTab === 'offboarding' && !offboarding) {
      setOffboardingLoading(true);
      loadOffboarding().then(setOffboarding).finally(() => setOffboardingLoading(false));
    }
  }, [activeTab, onboarding, directory, offboarding]);

  if (loading || !overview) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">HR Hub</h1>
        <p className="text-slate-500 font-medium">Headcount, lifecycle, and revenue at a glance</p>
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

      {activeTab === 'overview' && <OverviewTab data={overview} />}
      {activeTab === 'onboarding' && <RoleBucketsTab loading={onboardingLoading} data={onboarding} emptyLabel="No users currently onboarding" />}
      {activeTab === 'directory' && <RoleBucketsTab loading={directoryLoading} data={directory} emptyLabel="No users found" showDetail />}
      {activeTab === 'offboarding' && <RoleBucketsTab loading={offboardingLoading} data={offboarding} emptyLabel="No archived users" />}
    </div>
  );
}

async function loadOverview(): Promise<OverviewData> {
  const [admins, students, professors, enrolledAdmins, enrolledStudents, enrolledProfessors, courses, payments] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'professor'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('status', 'active'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'active'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'professor').eq('status', 'active'),
    supabase.from('courses').select('id, title, category, created_at, professor:profiles(full_name)').eq('status', 'published').order('created_at', { ascending: false }),
    supabase.from('fee_payments').select('amount').eq('status', 'completed'),
  ]);

  const liveCourses = (courses.data || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    professorName: c.professor?.full_name || 'Unassigned',
    created_at: c.created_at,
  }));

  const revenue = (payments.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  return {
    admins: admins.count || 0,
    students: students.count || 0,
    professors: professors.count || 0,
    enrolledAdmins: enrolledAdmins.count || 0,
    enrolledStudents: enrolledStudents.count || 0,
    enrolledProfessors: enrolledProfessors.count || 0,
    liveCourses,
    revenue,
  };
}

async function loadOnboarding(): Promise<RoleBuckets> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, status, created_at, role')
    .eq('status', 'pending_activation')
    .order('created_at', { ascending: false });

  const rows = data || [];
  return {
    admins: toPersonRows(rows.filter((r: any) => r.role === 'admin')),
    students: toPersonRows(rows.filter((r: any) => r.role === 'student')),
    professors: toPersonRows(rows.filter((r: any) => r.role === 'professor')),
  };
}

async function loadDirectory(): Promise<RoleBuckets> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, status, created_at, role')
    .order('full_name', { ascending: true });

  const rows = data || [];
  const studentIds = rows.filter((r: any) => r.role === 'student').map((r: any) => r.id);
  const professorIds = rows.filter((r: any) => r.role === 'professor').map((r: any) => r.id);
  const noRows = ['00000000-0000-0000-0000-000000000000'];

  const [enrollments, courses] = await Promise.all([
    supabase.from('enrollments').select('student_id').in('student_id', studentIds.length ? studentIds : noRows),
    supabase.from('courses').select('professor_id').in('professor_id', professorIds.length ? professorIds : noRows),
  ]);

  const enrollCounts: Record<string, number> = {};
  (enrollments.data || []).forEach((e: any) => { enrollCounts[e.student_id] = (enrollCounts[e.student_id] || 0) + 1; });
  const courseCounts: Record<string, number> = {};
  (courses.data || []).forEach((c: any) => { courseCounts[c.professor_id] = (courseCounts[c.professor_id] || 0) + 1; });

  return {
    admins: toPersonRows(rows.filter((r: any) => r.role === 'admin')),
    students: toPersonRows(rows.filter((r: any) => r.role === 'student'), (r) => `${enrollCounts[r.id] || 0} enrolled course${(enrollCounts[r.id] || 0) === 1 ? '' : 's'}`),
    professors: toPersonRows(rows.filter((r: any) => r.role === 'professor'), (r) => `${courseCounts[r.id] || 0} course${(courseCounts[r.id] || 0) === 1 ? '' : 's'} taught`),
  };
}

async function loadOffboarding(): Promise<RoleBuckets> {
  const [admins, students, professors] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone, status, created_at').eq('role', 'admin').eq('status', 'inactive'),
    supabase.from('profiles').select('id, full_name, email, phone, status, created_at').eq('role', 'student').in('status', OFFBOARD_STUDENT_STATUSES),
    supabase.from('profiles').select('id, full_name, email, phone, status, created_at').eq('role', 'professor').eq('status', 'inactive'),
  ]);

  return {
    admins: toPersonRows(admins.data || []),
    students: toPersonRows(students.data || []),
    professors: toPersonRows(professors.data || []),
  };
}

function toPersonRows(rows: any[], detailFn?: (r: any) => string): PersonRow[] {
  return rows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    phone: r.phone,
    status: r.status,
    created_at: r.created_at,
    detail: detailFn?.(r),
  }));
}

function OverviewTab({ data }: { data: OverviewData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <StatCard label="Admin Users" value={data.admins} icon={<Shield size={20} />} color="violet" />
        <StatCard label="Students" value={data.students} icon={<Users size={20} />} color="sky" />
        <StatCard label="Professors" value={data.professors} icon={<GraduationCap size={20} />} color="emerald" />
        <StatCard label="Total Revenue" value={formatCurrency(data.revenue)} icon={<DollarSign size={20} />} color="amber" />
      </div>

      <ChartCard title="Enrolled Software Users">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <StatCard label="Enrolled Admin Users" value={data.enrolledAdmins} icon={<Shield size={20} />} color="violet" />
          <StatCard label="Enrolled Students" value={data.enrolledStudents} icon={<Users size={20} />} color="sky" />
          <StatCard label="Enrolled Professors" value={data.enrolledProfessors} icon={<GraduationCap size={20} />} color="emerald" />
        </div>
      </ChartCard>

      <ChartCard
        title="Live Courses"
        action={<Badge color="success" dot>{data.liveCourses.length} live</Badge>}
      >
        <div className="space-y-2.5 pt-2">
          {data.liveCourses.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
              <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Radio size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">{c.title}</p>
                <p className="text-xs text-slate-500 truncate">{c.category} &middot; {c.professorName}</p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">{formatDate(c.created_at)}</span>
            </div>
          ))}
          {data.liveCourses.length === 0 && (
            <EmptyState icon={<BookOpen size={24} />} title="No live courses" description="Published courses will appear here." />
          )}
        </div>
      </ChartCard>
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  active: 'success', pending_activation: 'amber', inactive: 'slate', suspended: 'danger',
  graduated: 'blue', withdrawn: 'amber', terminated: 'danger',
};

function PersonList({ title, rows, showDetail }: { title: string; rows: PersonRow[]; showDetail?: boolean }) {
  return (
    <ChartCard title={title} action={<Badge color="slate">{rows.length}</Badge>}>
      <div className="space-y-2.5 pt-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
            <Avatar name={r.full_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-700 truncate">{r.full_name}</p>
              <div className="flex items-center gap-3 text-xs text-slate-500 min-w-0">
                <span className="flex items-center gap-1 min-w-0"><Mail size={11} className="shrink-0" /> <span className="truncate">{r.email}</span></span>
                {r.phone && <span className="hidden sm:flex items-center gap-1 shrink-0"><Phone size={11} /> {r.phone}</span>}
              </div>
              {showDetail && r.detail && <p className="text-[11px] font-semibold text-primary-600 mt-0.5">{r.detail}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge color={STATUS_BADGE[r.status] || 'slate'}>{r.status.replace('_', ' ')}</Badge>
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Calendar size={10} /> {formatDate(r.created_at)}</span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm font-medium text-slate-400 text-center py-6">No records</p>}
      </div>
    </ChartCard>
  );
}

function RoleBucketsTab({ loading, data, emptyLabel, showDetail }: {
  loading: boolean; data: RoleBuckets | null; emptyLabel: string; showDetail?: boolean;
}) {
  if (loading || !data) return <Spinner />;
  const total = data.admins.length + data.students.length + data.professors.length;
  if (total === 0) return <EmptyState icon={<Users size={24} />} title={emptyLabel} />;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <PersonList title="Admin Users" rows={data.admins} showDetail={showDetail} />
      <PersonList title="Students" rows={data.students} showDetail={showDetail} />
      <PersonList title="Professors" rows={data.professors} showDetail={showDetail} />
    </div>
  );
}
