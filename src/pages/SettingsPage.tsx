import { useEffect, useState } from 'react';
import { Shield, Database, Bell, Lock } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Card, Button, Badge, Spinner, Input } from '../components/ui';

export default function SettingsPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  
  // Notification Preferences State
  const defaultPrefs = { in_app: true, email: true, push: false };
  const [prefs, setPrefs] = useState<any>(profile?.notification_preferences || defaultPrefs);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Security State
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  const refreshMfaFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((f) => f.status === 'verified');
    setMfaEnabled(!!verified);
    setMfaFactorId(verified?.id || null);
  };

  useEffect(() => { refreshMfaFactors(); }, []);

  const startMfaEnroll = async () => {
    setMfaError('');
    setMfaBusy(true);
    // Clean up any stale unverified factor from a previous attempt before re-enrolling
    const { data: existing } = await supabase.auth.mfa.listFactors();
    const stale = existing?.totp?.find((f) => f.status === 'unverified');
    if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setMfaBusy(false);
    if (error) { setMfaError(error.message); return; }
    setMfaFactorId(data.id);
    setMfaQrCode(data.totp.qr_code);
    setMfaSecret(data.totp.secret);
    setShowMfaSetup(true);
  };

  const verifyMfaEnroll = async () => {
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setMfaBusy(true);
    setMfaError('');
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challengeErr) { setMfaBusy(false); setMfaError(challengeErr.message); return; }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode,
    });
    setMfaBusy(false);
    if (verifyErr) { setMfaError(verifyErr.message); return; }
    setMfaEnabled(true);
    setShowMfaSetup(false);
    setMfaCode('');
    setMfaQrCode(null);
    setMfaSecret(null);
  };

  const disableMfa = async () => {
    if (!mfaFactorId) return;
    setMfaBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    setMfaBusy(false);
    if (error) { setMfaError(error.message); return; }
    setMfaEnabled(false);
    setMfaFactorId(null);
  };

  const cancelMfaSetup = async () => {
    if (mfaFactorId && !mfaEnabled) await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    setShowMfaSetup(false);
    setMfaCode('');
    setMfaQrCode(null);
    setMfaSecret(null);
    setMfaFactorId(null);
    setMfaError('');
  };

  useEffect(() => {
    (async () => {
      const [users, courses, lectures, questions, exams, attempts, kpis, alerts, audit] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        supabase.from('lectures').select('id', { count: 'exact', head: true }),
        supabase.from('question_bank').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('id', { count: 'exact', head: true }),
        supabase.from('exam_attempts').select('id', { count: 'exact', head: true }),
        supabase.from('kpi_configs').select('id', { count: 'exact', head: true }),
        supabase.from('alerts').select('id', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        users: users.count, courses: courses.count, lectures: lectures.count, questions: questions.count,
        exams: exams.count, attempts: attempts.count, kpis: kpis.count, alerts: alerts.count, audit: audit.count,
      });
      setLoading(false);
    })();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ 
      full_name: fullName, 
      phone,
      notification_preferences: prefs
    }).eq('id', profile!.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const togglePref = (key: string) => {
    setPrefs((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">System Settings</h1>
        <p className="text-sm text-slate-500">Configuration and system overview</p>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Shield size={16} /> Profile Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        
        <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-3 flex items-center gap-2"><Bell size={16} /> Notification Channels</h3>
        <div className="space-y-2 max-w-xl">
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
            <span className="text-sm text-slate-700">In-App Notifications (Dashboard Alerts)</span>
            <input type="checkbox" checked={prefs.in_app !== false} onChange={() => togglePref('in_app')} className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
          </label>
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
            <span className="text-sm text-slate-700">Email Notifications</span>
            <input type="checkbox" checked={prefs.email !== false} onChange={() => togglePref('email')} className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
          </label>
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
            <span className="text-sm text-slate-700">Push Notifications (Mobile/Desktop)</span>
            <input type="checkbox" checked={prefs.push === true} onChange={() => togglePref('push')} className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
          </label>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
          {saved && <Badge color="green">Saved</Badge>}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Lock size={16} /> Security</h3>
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl max-w-xl">
          <div>
            <p className="font-semibold text-slate-800">Multi-Factor Authentication (MFA)</p>
            <p className="text-sm text-slate-500 mt-0.5">Protect your account with an additional security step.</p>
          </div>
          <button
            onClick={mfaEnabled ? disableMfa : startMfaEnroll}
            disabled={mfaBusy}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${mfaEnabled ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            {mfaBusy ? 'Please wait…' : mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
          </button>
        </div>

        {mfaError && <p className="mt-3 text-sm text-rose-600 max-w-xl">{mfaError}</p>}

        {showMfaSetup && !mfaEnabled && (
          <div className="mt-4 p-4 border border-emerald-200 bg-emerald-50 rounded-xl max-w-xl animate-fade-in">
            <h4 className="font-bold text-emerald-800 mb-2">Set up Authenticator App</h4>
            <p className="text-sm text-emerald-700 mb-4">Scan this QR code with Google Authenticator, Authy, or a similar TOTP app, then enter the 6-digit code it generates.</p>
            {mfaQrCode && (
              <div className="bg-white p-3 rounded-lg inline-block mb-3" dangerouslySetInnerHTML={{ __html: mfaQrCode }} />
            )}
            {mfaSecret && (
              <p className="text-xs text-emerald-700 mb-3">Can't scan? Enter this key manually: <span className="font-mono font-bold">{mfaSecret}</span></p>
            )}
            <div className="flex items-center gap-2 max-w-xs">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="input-field font-mono tracking-widest text-center"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={verifyMfaEnroll} disabled={mfaBusy || mfaCode.length !== 6} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
                {mfaBusy ? 'Verifying…' : 'Verify & Enable'}
              </button>
              <button onClick={cancelMfaSetup} className="px-4 py-2 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </div>
        )}
      </Card>

      {profile?.role === 'admin' && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Database size={16} /> System Statistics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-500 capitalize">{k}</p>
                <p className="text-xl font-bold text-slate-800">{v as number}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
