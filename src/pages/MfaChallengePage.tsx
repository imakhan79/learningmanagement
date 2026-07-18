import { useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export default function MfaChallengePage() {
  const { refreshMfaStatus, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError('');

    const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === 'verified');
    if (listErr || !factor) {
      setBusy(false);
      setError(listErr?.message || 'No verified authenticator found.');
      return;
    }

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeErr) { setBusy(false); setError(challengeErr.message); return; }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: factor.id, challengeId: challenge.id, code,
    });
    setBusy(false);
    if (verifyErr) { setError(verifyErr.message); return; }

    await refreshMfaStatus();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
             style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
          <ShieldCheck size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Two-factor verification</h1>
        <p className="text-sm text-slate-500 mt-1.5 mb-6">Enter the 6-digit code from your authenticator app to continue.</p>

        <form onSubmit={verify} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="input-field font-mono tracking-widest text-center text-lg"
          />

          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 text-sm">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}

          <button type="submit" disabled={busy || code.length !== 6}
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        <button onClick={() => signOut()} className="mt-4 w-full text-center text-sm text-slate-500 hover:text-primary-600 transition-colors font-medium">
          Sign in as a different user
        </button>
      </div>
    </div>
  );
}
