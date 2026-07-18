import { useEffect, useState, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { evaluateUserKPIs } from './lib/kpiEngine';
import { evaluateTimeBasedAlerts } from './lib/notificationEngine';
import AuthPage from './pages/AuthPage';
import Shell from './components/Shell';
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const LecturesPage = lazy(() => import('./pages/LecturesPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const QuestionBankPage = lazy(() => import('./pages/QuestionBankPage'));
const ExamsPage = lazy(() => import('./pages/ExamsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const KpiPage = lazy(() => import('./pages/KpiPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LivePage = lazy(() => import('./pages/LivePage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CertificatePage = lazy(() => import('./pages/CertificatePage'));
import { Spinner } from './components/ui';

function AppInner() {
  const { session, profile, loading } = useAuth();
  const [active, setActive] = useState('dashboard');
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      // Background continuous KPI evaluation
      await evaluateUserKPIs(profile.id, profile.role);
      
      // Evaluate time-based alerts (Due dates, Behind Schedule, etc.)
      await evaluateTimeBasedAlerts(profile.id, profile.role);
      
      // Fetch unread alerts
      const { count } = await supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).is('read_at', null);
      setUnreadAlerts(count || 0);
    })();
  }, [profile?.id, active]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthPage />;
  }

  const role = profile.role;
  const render = () => {
    switch (active) {
      case 'dashboard': return <DashboardPage />;
      case 'courses': return <CoursesPage />;
      case 'lectures': return role === 'student' || role === 'professor' ? <LecturesPage /> : <DashboardPage />;
      case 'users': return role === 'admin' ? <UsersPage /> : <DashboardPage />;
      case 'questionbank': return role === 'admin' || role === 'professor' ? <QuestionBankPage /> : <DashboardPage />;
      case 'exams': return <ExamsPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'kpis': return role === 'admin' || role === 'professor' ? <KpiPage /> : <DashboardPage />;
      case 'reports': return <ReportsPage />;
      case 'alerts': return <AlertsPage />;
      case 'audit': return role === 'admin' ? <AuditPage /> : <DashboardPage />;
      case 'live': return <LivePage />;
      case 'finance': return role === 'admin' || role === 'student' ? <FinancePage /> : <DashboardPage />;
      case 'profile': return <ProfilePage />;
      case 'certificates': return role === 'student' ? <CertificatePage /> : <DashboardPage />;
      case 'settings': return role === 'admin' ? <SettingsPage /> : <DashboardPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <Shell active={active} onNavigate={setActive} alertsCount={unreadAlerts}>
      <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner /></div>}>
        {render()}
      </Suspense>
    </Shell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
