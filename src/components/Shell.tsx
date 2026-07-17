import { ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ClipboardList,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  GraduationCap,
  FileText,
  Target,
  ScrollText,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Role } from '../lib/supabase';

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['admin', 'professor', 'student'] },
  { id: 'courses', label: 'Courses', icon: <BookOpen size={18} />, roles: ['admin', 'professor', 'student'] },
  { id: 'lectures', label: 'Lectures', icon: <FileText size={18} />, roles: ['professor', 'student'] },
  { id: 'users', label: 'User Management', icon: <Users size={18} />, roles: ['admin'] },
  { id: 'questionbank', label: 'Question Bank', icon: <ClipboardList size={18} />, roles: ['admin', 'professor'] },
  { id: 'exams', label: 'Exams', icon: <ScrollText size={18} />, roles: ['admin', 'professor', 'student'] },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, roles: ['admin', 'professor', 'student'] },
  { id: 'kpis', label: 'KPI Monitoring', icon: <Target size={18} />, roles: ['admin', 'professor'] },
  { id: 'reports', label: 'Reports', icon: <FileText size={18} />, roles: ['admin', 'professor', 'student'] },
  { id: 'alerts', label: 'Alerts', icon: <Bell size={18} />, roles: ['admin', 'professor', 'student'] },
  { id: 'audit', label: 'Audit Logs', icon: <ScrollText size={18} />, roles: ['admin'] },
  { id: 'settings', label: 'System Settings', icon: <Settings size={18} />, roles: ['admin'] },
];

export default function Shell({
  active,
  onNavigate,
  children,
  alertsCount,
}: {
  active: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
  alertsCount: number;
}) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = profile?.role ?? 'student';
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  const Nav = (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              onNavigate(item.id);
              setMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-sky-50 text-sky-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.icon}
            <span className="flex-1 text-left">{item.label}</span>
            {item.id === 'alerts' && alertsCount > 0 && (
              <span className="bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {alertsCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const Header = (
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 lg:border-b-0">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center">
          <GraduationCap size={20} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800 leading-tight">LMS Analytics</p>
          <p className="text-xs text-slate-400 leading-tight capitalize">{role}</p>
        </div>
      </div>
      <button className="lg:hidden text-slate-500" onClick={() => setMobileOpen(false)}>
        <X size={20} />
      </button>
    </div>
  );

  const UserCard = (
    <div className="px-3 py-3 border-t border-slate-200">
      <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-semibold">
          {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{profile?.full_name || 'User'}</p>
          <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="text-slate-400 hover:text-rose-500 p-1.5 rounded-md hover:bg-slate-100"
          aria-label="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-slate-200 fixed inset-y-0">
        {Header}
        {Nav}
        {UserCard}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white flex flex-col">
            {Header}
            {Nav}
            {UserCard}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} className="text-slate-600" aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-sky-600" />
            <span className="font-semibold text-slate-800 text-sm">LMS</span>
          </div>
          <button onClick={signOut} className="text-slate-400" aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
