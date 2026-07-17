import { useState } from 'react';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button, Input, Select } from '../components/ui';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-slate-50 to-emerald-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-600 text-white mb-3 shadow-lg shadow-sky-600/20">
            <GraduationCap size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">LMS Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Learning Management & Performance KPIs</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
          <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <Input label="Full Name" value={fullName} onChange={setFullName} placeholder="Jane Doe" required />
            )}
            <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@school.edu" required />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {mode === 'signup' && (
              <Select
                label="Role"
                value={role}
                onChange={(v) => setRole(v as any)}
                options={[
                  { value: 'student', label: 'Student' },
                  { value: 'professor', label: 'Professor' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            )}

            {error && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-4 text-xs text-center text-slate-400">
            By continuing you agree to the institution's acceptable use policy.
          </p>
        </div>
      </div>
    </div>
  );
}
