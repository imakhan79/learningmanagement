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
          <Input label="Full Name" value={fullName} onChange={setFullName} />
          <Input label="Phone" value={phone} onChange={setPhone} />
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
            onClick={() => {
              if (mfaEnabled) {
                setMfaEnabled(false);
              } else {
                setShowMfaSetup(true);
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mfaEnabled ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            {mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
          </button>
        </div>

        {showMfaSetup && !mfaEnabled && (
          <div className="mt-4 p-4 border border-emerald-200 bg-emerald-50 rounded-xl max-w-xl animate-fade-in">
            <h4 className="font-bold text-emerald-800 mb-2">Simulated MFA Setup</h4>
            <p className="text-sm text-emerald-700 mb-4">In a production environment, you would scan a QR code with your authenticator app here.</p>
            <div className="flex gap-2">
              <button onClick={() => { setMfaEnabled(true); setShowMfaSetup(false); }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Simulate Verification Success</button>
              <button onClick={() => setShowMfaSetup(false)} className="px-4 py-2 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-medium">Cancel</button>
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
