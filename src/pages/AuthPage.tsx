// NOTE: Demo accounts (admin@demo.com, professor@demo.com, student@demo.com) with password 'demo1234' must exist in Supabase auth.
// Create them via Supabase dashboard or CLI before using demo login buttons.

import { GraduationCap, Eye, EyeOff, Mail, Lock, User, ArrowRight, Github, Chrome, AlertCircle, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

type Mode = 'login' | 'register' | 'forgot';

const DEMO_ACCOUNTS = [
  { role: 'Admin',     email: 'admin@demo.com',     password: 'demo1234', color: 'from-violet-500 to-purple-600', bg: 'hover:bg-violet-50 hover:border-violet-300', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700' },
  { role: 'Professor', email: 'professor@demo.com', password: 'demo1234', color: 'from-sky-500 to-blue-600',    bg: 'hover:bg-sky-50 hover:border-sky-300',       text: 'text-sky-700',    badge: 'bg-sky-100 text-sky-700' },
  { role: 'Student',   email: 'student@demo.com',   password: 'demo1234', color: 'from-emerald-500 to-teal-600', bg: 'hover:bg-emerald-50 hover:border-emerald-300', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
];

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = () => { setError(''); setSuccess(''); };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); reset(); setLoading(true);
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (e2) setError(e2.message);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); reset(); setLoading(true);
    const { error: e2 } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name, role: 'student' } },
    });
    setLoading(false);
    if (e2) setError(e2.message);
    else setSuccess('Account created! Check your email to verify.');
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); reset(); setLoading(true);
    const { error: e2 } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (e2) setError(e2.message);
    else setSuccess('Password reset email sent! Check your inbox.');
  }
const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
  setEmail(demoEmail);
  setPassword(demoPassword);
  const { error } = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
  if (error) setError(error.message);
  else setSuccess('Logged in!');
};
  const submit = mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgot;

  const PANELS = [
    { label: 'Sign In',      mode: 'login'    as Mode },
    { label: 'Create Account',mode: 'register' as Mode },
  ];

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel (brand) ── */}
      <div className="hidden lg:flex w-[55%] flex-col justify-between p-12 relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 60%,#24243e 100%)' }}>
        {/* Orbs */}
        <div className="absolute top-20 left-1/3 w-80 h-80 rounded-full opacity-20 animate-float"
             style={{ background: 'radial-gradient(circle,#6366f1,transparent 70%)' }} />
        <div className="absolute bottom-20 right-1/4 w-56 h-56 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle,#14b8a6,transparent 70%)', animation: 'float 8s ease-in-out infinite reverse' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 4px 14px rgba(99,102,241,0.5)' }}>
            <GraduationCap size={20} className="text-white" />
          </div>
          <span className="font-bold text-white text-xl tracking-tight">EduNexus</span>
        </div>

        {/* Middle content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-black text-white leading-tight tracking-tight mb-3">
              Your Learning<br />Journey Starts Here
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Access 8,500+ courses, live classes, AI tutoring and verified certificates — all in one place.
            </p>
          </div>
          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {['AI Tutoring', 'Live Classes', 'Certificates', 'Analytics', 'Mobile App'].map(f => (
              <span key={f} className="px-4 py-2 rounded-full text-sm font-semibold"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#a5b4fc' }}>
                {f}
              </span>
            ))}
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[['50K+','Active Learners'],['4.9★','Platform Rating'],['95%','Job Placement']].map(([v, l]) => (
              <div key={l} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-2xl font-black text-white">{v}</p>
                <p className="text-xs text-slate-400 mt-1">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="relative z-10 text-slate-500 text-sm">© 2026 EduNexus — Enterprise LMS Platform</p>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <GraduationCap size={15} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">EduNexus</span>
          </div>

          {/* Tab switcher */}
          {mode !== 'forgot' && (
            <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-8">
              {PANELS.map(p => (
                <button key={p.mode} onClick={() => { setMode(p.mode); reset(); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    mode === p.mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {mode === 'login' ? 'Welcome back 👋' : mode === 'register' ? 'Create your account' : 'Forgot password?'}
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
              {mode === 'login' ? 'Sign in to continue your learning journey' :
               mode === 'register' ? 'Join 50,000+ learners on EduNexus' :
               "Enter your email and we'll send a reset link"}
            </p>
          </div>

          {/* Social buttons (login/register only) */}
          {mode !== 'forgot' && (
            <div className="flex gap-3 mb-6">
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50 transition-all">
                <Chrome size={16}/> Google
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all">
                <Github size={16}/> GitHub
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 transition-all">
                <span className="font-bold text-blue-600">M</span> Microsoft
              </button>
            </div>
          )}

          {/* Demo Accounts (login only) */}
          {mode === 'login' && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={13} className="text-amber-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quick Demo Access</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map(acc => (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => handleDemoLogin(acc.email, acc.password)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 border-slate-200 transition-all text-center ${acc.bg}`}
                  >
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${acc.badge}`}>{acc.role}</span>
                    <span className="text-xs text-slate-400 font-medium leading-tight truncate w-full text-center">{acc.email.split('@')[0]}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 font-medium text-center mt-2">Password: <span className="font-mono font-bold text-slate-600">demo1234</span></p>
            </div>
          )}

          {/* Divider */}
          {mode !== 'forgot' && (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">or continue with email</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input-field pl-10" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
                </div>
              </div>
            )}
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input-field pl-10" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            {mode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="label mb-0">Password</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => setMode('forgot')} className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors">Forgot password?</button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input-field pl-10 pr-11" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>
            )}

            {/* Error / Success */}
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 text-sm animate-fade-up">
                <AlertCircle size={16} className="shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-success-50 border border-success-100 text-success-700 text-sm animate-fade-up">
                ✓ {success}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 mt-2"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}>
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>{mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'} <ArrowRight size={16}/></>
              )}
            </button>
          </form>

          {mode === 'forgot' && (
            <button onClick={() => { setMode('login'); reset(); }} className="mt-4 w-full text-center text-sm text-slate-500 hover:text-primary-600 transition-colors font-medium">
              ← Back to Sign In
            </button>
          )}

          {/* Terms */}
          {mode === 'register' && (
            <p className="text-xs text-slate-400 text-center mt-5 leading-relaxed">
              By creating an account you agree to our{' '}
              <a href="#" className="text-primary-600 hover:underline">Terms of Service</a> and{' '}
              <a href="#" className="text-primary-600 hover:underline">Privacy Policy</a>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
