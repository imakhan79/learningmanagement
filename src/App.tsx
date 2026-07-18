import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { evaluateUserKPIs } from './lib/kpiEngine';
import AuthPage from './pages/AuthPage';
import Shell from './components/Shell';
import DashboardPage from './pages/DashboardPage';
import CoursesPage from './pages/CoursesPage';
import LecturesPage from './pages/LecturesPage';
import UsersPage from './pages/UsersPage';
import QuestionBankPage from './pages/QuestionBankPage';
import ExamsPage from './pages/ExamsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import KpiPage from './pages/KpiPage';
import ReportsPage from './pages/ReportsPage';
import AlertsPage from './pages/AlertsPage';
import AuditPage from './pages/AuditPage';
import SettingsPage from './pages/SettingsPage';
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
      case 'settings': return role === 'admin' ? <SettingsPage /> : <DashboardPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <Shell active={active} onNavigate={setActive} alertsCount={unreadAlerts}>
      {render()}
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
