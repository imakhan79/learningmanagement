import { useState } from 'react';
import { GraduationCap, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';



export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'professor' | 'admin'>('student');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password, fullName, role);
      if (error) setError(error);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>

      {/* Background blobs */}
      <div className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
      <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
      <div className="absolute top-1/2 left-1/4 w-40 h-40 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl mb-4 shadow-2xl shadow-blue-500/40"
            style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
            <GraduationCap size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Nexus AI</h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">Learning Management & Performance KPIs</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl p-6 shadow-2xl border border-white/10"
          style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)' }}>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  mode === m
                    ? 'bg-white text-slate-800 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10 transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10 transition-all"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-300">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10 transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-300">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10 transition-all"
                  style={{ background: 'rgba(30,30,50,0.9)' }}
                >
                  <option value="student">Student</option>
                  <option value="professor">Professor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-300 bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 rounded-xl text-base font-bold text-white transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 mt-2"
              style={{ background: busy ? 'rgba(37,99,235,0.6)' : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
            >
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        {mode === 'login' && (
          <div className="mt-4 rounded-3xl p-4 border border-white/10"
            style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-blue-400" />
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Demo Quick Login</p>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: '🛡️ Admin',     email: 'admin@demo.com',     badge: 'Admin',     color: 'from-violet-600 to-purple-700' },
                { label: '🎓 Professor', email: 'professor@demo.com', badge: 'Professor', color: 'from-blue-600 to-indigo-700' },
                { label: '📚 Student',   email: 'student@demo.com',   badge: 'Student',   color: 'from-emerald-600 to-teal-700' },
              ].map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => { setEmail(d.email); setPassword('demo1234'); }}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/10 hover:border-white/20 transition-all group"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${d.color} flex items-center justify-center text-xs shadow-sm`}>
                      {d.label.split(' ')[0]}
                    </div>
                    <span className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{d.badge}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono group-hover:text-slate-400 transition-colors">{d.email}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-center text-slate-500 mt-3">
              Password: <code className="text-slate-300 font-mono bg-white/10 px-1.5 py-0.5 rounded">demo1234</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
