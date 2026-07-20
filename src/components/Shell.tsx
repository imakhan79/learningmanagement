import { ReactNode, useState } from 'react';
import {
  LayoutDashboard, BookOpen, Users, ClipboardList, BarChart3,
  Bell, Settings, LogOut, GraduationCap, FileText, Target,
  ScrollText, Search, X, ChevronRight, Video, DollarSign,
  User, Sparkles, Menu, Radio, Shield, Award, ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Role } from '../lib/supabase';

export interface NavItem { id: string; label: string; icon: ReactNode; roles: Role[]; group: string; }

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',    label: 'Dashboard',      icon: <LayoutDashboard size={18}/>, roles: ['admin','professor','student'], group: 'main' },
  { id: 'courses',      label: 'Courses',         icon: <BookOpen size={18}/>,        roles: ['admin','professor','student'], group: 'main' },
  { id: 'lectures',     label: 'Lectures',        icon: <FileText size={18}/>,        roles: ['professor','student'],         group: 'main' },
  { id: 'assignments',  label: 'Assignments',     icon: <ClipboardCheck size={18}/>,  roles: ['professor','student'],         group: 'main' },
  { id: 'live',         label: 'Live Sessions',   icon: <Radio size={18}/>,           roles: ['admin','professor','student'], group: 'main' },
  { id: 'exams',        label: 'Exams',           icon: <ScrollText size={18}/>,      roles: ['admin','professor','student'], group: 'main' },
  { id: 'analytics',   label: 'Analytics',       icon: <BarChart3 size={18}/>,       roles: ['admin','professor','student'], group: 'insights' },
  { id: 'kpis',        label: 'KPI Monitor',     icon: <Target size={18}/>,          roles: ['admin','professor'],           group: 'insights' },
  { id: 'reports',     label: 'Reports',         icon: <FileText size={18}/>,        roles: ['admin','professor','student'], group: 'insights' },
  { id: 'alerts',      label: 'Alerts',          icon: <Bell size={18}/>,            roles: ['admin','professor','student'], group: 'insights' },
  { id: 'users',       label: 'Users',           icon: <Users size={18}/>,           roles: ['admin'],                       group: 'admin' },
  { id: 'questionbank',label: 'Question Bank',   icon: <ClipboardList size={18}/>,   roles: ['admin','professor'],           group: 'admin' },
  { id: 'finance',     label: 'Finance',         icon: <DollarSign size={18}/>,      roles: ['admin','student'],             group: 'admin' },
  { id: 'audit',       label: 'Audit Logs',      icon: <Shield size={18}/>,          roles: ['admin'],                       group: 'admin' },
  { id: 'settings',    label: 'Settings',        icon: <Settings size={18}/>,        roles: ['admin'],                       group: 'admin' },
  { id: 'certificates',label: 'Certificates',    icon: <Award size={18}/>,           roles: ['student'],                     group: 'personal' },
  { id: 'profile',     label: 'My Profile',      icon: <User size={18}/>,            roles: ['admin','professor','student'], group: 'personal' },
];

const GROUPS: { id: string; label: string }[] = [
  { id: 'main',     label: 'Main' },
  { id: 'insights', label: 'Insights' },
  { id: 'admin',    label: 'Administration' },
  { id: 'personal', label: 'My Account' },
];

const BOTTOM_NAV = [
  { id: 'dashboard', label: 'Home',    icon: <LayoutDashboard size={20}/> },
  { id: 'courses',   label: 'Courses', icon: <BookOpen size={20}/> },
  { id: 'live',      label: 'Live',    icon: <Radio size={20}/> },
  { id: 'alerts',    label: 'Alerts',  icon: <Bell size={20}/> },
  { id: 'profile',   label: 'Profile', icon: <User size={20}/> },
];

const ROLE_STYLE: Record<string, { grad: string; badge: string; label: string }> = {
  admin:     { grad: 'from-violet-500 to-purple-600',  badge: 'bg-violet-500', label: 'Administrator' },
  professor: { grad: 'from-blue-500 to-indigo-600',    badge: 'bg-blue-500',   label: 'Professor' },
  student:   { grad: 'from-emerald-500 to-teal-600',   badge: 'bg-emerald-500',label: 'Student' },
};

export default function Shell({
  active, onNavigate, children, alertsCount,
}: {
  active: string; onNavigate: (id: string) => void; children: ReactNode; alertsCount: number;
}) {
  const { profile, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const role = profile?.role ?? 'student';
  const items = NAV_ITEMS.filter(i => i.roles.includes(role));
  const rs = ROLE_STYLE[role] || ROLE_STYLE.student;
  const initials = (profile?.full_name || profile?.email || '?').slice(0, 2).toUpperCase();

  const navGroups = GROUPS.map(g => ({
    ...g, items: items.filter(i => i.group === g.id),
  })).filter(g => g.items.length > 0);

  const NavContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 4px 12px rgba(99,102,241,0.5)' }}>
            <GraduationCap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-tight">EduNexus</p>
            <p className="text-slate-400 text-xs">{rs.label} Portal</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5 scrollbar-hide">
        {navGroups.map(g => (
          <div key={g.id}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1.5">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map(item => {
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); onClose?.(); }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 hover:bg-white/8 hover:text-white'
                    }`}
                    style={isActive ? {
                      background: 'linear-gradient(135deg,#4f46e5,#6366f1)',
                      boxShadow: '0 4px 14px rgba(79,70,229,0.40)',
                    } : undefined}
                  >
                    <span className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : ''}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.id === 'alerts' && alertsCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                        {alertsCount > 99 ? '99+' : alertsCount}
                      </span>
                    )}
                    {isActive && <ChevronRight size={13} className="opacity-60" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="px-3 pb-4 pt-3 border-t border-white/8">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${rs.grad} flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
          </div>
          <button onClick={signOut} aria-label="Sign out"
            className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-mesh flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 z-40"
             style={{ background: 'linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%)', boxShadow: 'var(--shadow-sidebar)' }}>
        <NavContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-72 flex flex-col animate-slide-right"
                 style={{ background: 'linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%)' }}>
            <NavContent onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/60 px-4 lg:px-6 py-3"
                style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <button onClick={() => setDrawerOpen(true)} className="lg:hidden btn-icon" aria-label="Open menu">
                <Menu size={18} />
              </button>
              <div className="lg:hidden flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                     style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  <Sparkles size={13} className="text-white" />
                </div>
                <span className="font-bold text-slate-800 text-sm">EduNexus</span>
              </div>
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-slate-400 text-sm">/</span>
                <h2 className="font-semibold text-slate-800 text-sm">
                  {NAV_ITEMS.find(i => i.id === active)?.label || 'Dashboard'}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSearchOpen(true)}
                className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-100 text-slate-400 text-sm hover:bg-slate-200 transition-colors border border-slate-200/60 w-40"
                aria-label="Search">
                <Search size={15} />
                <span className="text-xs text-slate-400">Search...</span>
                <span className="ml-auto text-[10px] text-slate-300 border border-slate-200 rounded px-1">⌘K</span>
              </button>
              <button className="sm:hidden btn-icon" onClick={() => setSearchOpen(true)} aria-label="Search">
                <Search size={17} />
              </button>
              <button onClick={() => onNavigate('alerts')}
                className="relative btn-icon" aria-label="Notifications">
                <Bell size={17} />
                {alertsCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
                )}
              </button>
              <button onClick={() => onNavigate('profile')}
                className={`w-9 h-9 rounded-full bg-gradient-to-br ${rs.grad} flex items-center justify-center text-white text-xs font-bold shadow-md hover:shadow-lg transition-shadow`}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        {/* Command palette */}
        {searchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
               style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
               onClick={() => setSearchOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in"
                 onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <Search size={18} className="text-slate-400 shrink-0" />
                <input autoFocus placeholder="Search pages, courses, users…" className="flex-1 outline-none text-sm text-slate-700 placeholder-slate-400 bg-transparent" />
                <button onClick={() => setSearchOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">Quick Navigation</p>
                <div className="space-y-0.5">
                  {items.slice(0, 6).map(item => (
                    <button key={item.id} onClick={() => { onNavigate(item.id); setSearchOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 hover:text-primary-700 transition-colors">
                      <span className="text-slate-400">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-5 lg:p-8 max-w-7xl mx-auto w-full page-enter">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/80"
           style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', boxShadow: '0 -4px 24px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center justify-around px-2 py-2 max-w-sm mx-auto">
          {BOTTOM_NAV.map(item => {
            const isActive = active === item.id;
            const visible = item.id === 'profile' || items.some(i => i.id === item.id);
            if (!visible) return null;
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[52px] ${
                  isActive ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {isActive && (
                  <span className="absolute inset-0 rounded-xl bg-primary-50 -z-10" />
                )}
                <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>
                <span className={`text-[10px] font-semibold ${isActive ? 'text-primary-600' : 'text-slate-400'}`}>{item.label}</span>
                {item.id === 'alerts' && alertsCount > 0 && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
