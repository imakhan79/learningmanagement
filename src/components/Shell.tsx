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
  GraduationCap,
  FileText,
  Target,
  ScrollText,
  Search,
  X,
  ChevronRight,
  Sparkles,
  Video,
  DollarSign,
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
  { id: 'dashboard',    label: 'Dashboard',       icon: <LayoutDashboard size={20} />, roles: ['admin', 'professor', 'student'] },
  { id: 'courses',      label: 'Courses',          icon: <BookOpen size={20} />,        roles: ['admin', 'professor', 'student'] },
  { id: 'lectures',     label: 'Lectures',         icon: <FileText size={20} />,        roles: ['professor', 'student'] },
  { id: 'live',         label: 'Live Sessions',    icon: <Video size={20} />,           roles: ['admin', 'professor', 'student'] },
  { id: 'users',        label: 'Users',            icon: <Users size={20} />,           roles: ['admin'] },
  { id: 'questionbank', label: 'Question Bank',    icon: <ClipboardList size={20} />,   roles: ['admin', 'professor'] },
  { id: 'exams',        label: 'Exams',            icon: <ScrollText size={20} />,      roles: ['admin', 'professor', 'student'] },
  { id: 'analytics',   label: 'Analytics',        icon: <BarChart3 size={20} />,       roles: ['admin', 'professor', 'student'] },
  { id: 'kpis',         label: 'KPI Monitoring',   icon: <Target size={20} />,          roles: ['admin', 'professor'] },
  { id: 'reports',      label: 'Reports',          icon: <FileText size={20} />,        roles: ['admin', 'professor', 'student'] },
  { id: 'alerts',       label: 'Alerts',           icon: <Bell size={20} />,            roles: ['admin', 'professor', 'student'] },
  { id: 'finance',      label: 'Finance',          icon: <DollarSign size={20} />,      roles: ['admin', 'student'] },
  { id: 'audit',        label: 'Audit Logs',       icon: <ScrollText size={20} />,      roles: ['admin'] },
  { id: 'settings',     label: 'System Settings',  icon: <Settings size={20} />,        roles: ['admin'] },
];

// Bottom nav items (mobile) — pinned 5
const BOTTOM_NAV = [
  { id: 'dashboard', label: 'Home',     icon: <LayoutDashboard size={22} /> },
  { id: 'courses',   label: 'Learn',    icon: <BookOpen size={22} /> },
  { id: 'analytics', label: 'Stats',    icon: <BarChart3 size={22} /> },
  { id: 'alerts',    label: 'Alerts',   icon: <Bell size={22} /> },
  { id: 'settings',  label: 'More',     icon: <Settings size={22} /> },
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const role = profile?.role ?? 'student';
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));
  const initials = (profile?.full_name || profile?.email || '?').charAt(0).toUpperCase();

  const roleColors: Record<string, string> = {
    admin: 'from-violet-500 to-purple-600',
    professor: 'from-blue-500 to-indigo-600',
    student: 'from-emerald-500 to-teal-600',
  };
  const gradColor = roleColors[role] || roleColors.student;

  /* ── Desktop Sidebar ── */
  const Sidebar = (
    <aside className="hidden lg:flex w-64 flex-col bg-gradient-to-b from-slate-900 to-slate-800 fixed inset-y-0 z-40 shadow-2xl">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/40">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base tracking-tight">LMS Analytics</p>
            <p className="text-slate-400 text-xs capitalize font-medium">{role} portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Desktop Navigation" className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : ''}`}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'alerts' && alertsCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center font-bold animate-pulse">
                  {alertsCount}
                </span>
              )}
              {isActive && <ChevronRight size={14} className="opacity-60" />}
            </button>
          );
        })}
      </nav>

      {/* User card */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradColor} flex items-center justify-center text-white text-sm font-bold shadow-md`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );

  /* ── Mobile Drawer ── */
  const Drawer = drawerOpen && (
    <div className="lg:hidden fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
      <aside className="relative w-72 bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col shadow-2xl">
        {/* Drawer header */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/40">
              <GraduationCap size={18} className="text-white" />
            </div>
            <p className="text-white font-bold text-sm">LMS Analytics</p>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* All nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {items.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setDrawerOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                {item.id === 'alerts' && alertsCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {alertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Drawer user card */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradColor} flex items-center justify-center text-white text-sm font-bold`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate capitalize">{role}</p>
            </div>
            <button onClick={signOut} className="text-slate-400 hover:text-red-400 p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex">
      {Sidebar}
      {Drawer}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 pb-20 lg:pb-0">

        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/70 px-4 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Left: Brand / Hamburger on mobile */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                aria-label="Open menu"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
              <div className="lg:hidden flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="font-bold text-slate-800 text-sm">Nexus AI</span>
              </div>
              <div className="hidden lg:block">
                <h2 className="font-semibold text-slate-800 text-base capitalize">
                  {NAV_ITEMS.find(i => i.id === active)?.label || 'Dashboard'}
                </h2>
              </div>
            </div>

            {/* Right: Search + Avatar */}
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                <Search size={17} />
              </button>
              {alertsCount > 0 && (
                <button
                  onClick={() => onNavigate('alerts')}
                  className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <Bell size={17} />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </button>
              )}
              <button
                onClick={() => setDrawerOpen(true)}
                className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradColor} flex items-center justify-center text-white text-sm font-bold shadow-md lg:cursor-default`}
              >
                {initials}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-5 lg:p-8 max-w-7xl mx-auto w-full page-enter">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/80 shadow-xl shadow-slate-900/10">
        <div className="flex items-center justify-around px-2 py-2">
          {BOTTOM_NAV.map((item) => {
            const isActive = active === item.id;
            const visible = items.some(i => i.id === item.id);
            if (!visible) return null;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px] ${
                  isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full -mt-2" />
                )}
                <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                  {item.icon}
                </span>
                <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                  {item.label}
                </span>
                {item.id === 'alerts' && alertsCount > 0 && (
                  <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
