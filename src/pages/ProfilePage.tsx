import { useEffect, useRef, useState } from 'react';
import {
  User, Mail, Shield, Edit3, Save, X, KeyRound, Eye, EyeOff,
  CheckCircle2, BookOpen, Award, Clock, Activity, Camera, Bell, Loader2
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, NotificationPreferences } from '../lib/supabase';
import { Spinner, Badge } from '../components/ui';

const DEFAULT_PREFS: NotificationPreferences = { in_app: true, email: true, push: false };

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  admin:     { label: 'Administrator', color: 'text-violet-700', bg: 'bg-violet-100' },
  professor: { label: 'Professor',     color: 'text-sky-700',    bg: 'bg-sky-100' },
  student:   { label: 'Student',       color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

export default function ProfilePage() {
  const { profile, session, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ courses: 0, completed: 0, hours: 0, score: 0, certificates: 0 });

  // Edit profile
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Notification preferences
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Password change
  const [changingPw, setChangingPw] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || '');
    setPhone(profile.phone || '');
    setPrefs(profile.notification_preferences || DEFAULT_PREFS);
    loadStats();
  }, [profile?.id]);

  async function loadStats() {
    setLoading(true);
    if (profile?.role === 'student') {
      const [enr, prog] = await Promise.all([
        supabase.from('enrollments').select('progress_pct, status').eq('student_id', profile.id),
        supabase.from('lecture_progress').select('total_watch_seconds').eq('student_id', profile.id),
      ]);
      const enrollments = enr.data || [];
      const progData = prog.data || [];
      const totalSecs = progData.reduce((s, p) => s + (p.total_watch_seconds || 0), 0);
      const completed = enrollments.filter(e => e.status === 'completed' || e.progress_pct >= 100).length;
      setStats({
        courses: enrollments.length,
        completed,
        hours: Math.round(totalSecs / 3600),
        score: 0,
        certificates: completed,
      });
    } else if (profile?.role === 'professor') {
      const { data: courses } = await supabase.from('courses').select('id').eq('professor_id', profile.id);
      setStats({ courses: (courses || []).length, completed: 0, hours: 0, score: 0, certificates: 0 });
    }
    setLoading(false);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 3 * 1024 * 1024) { setSaveMsg('Failed to save: image must be under 3MB.'); return; }
    setUploadingAvatar(true);
    setSaveMsg('');
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: updErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
      if (updErr) throw updErr;
      await refreshProfile();
      setSaveMsg('Profile photo updated!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setSaveMsg('Failed to save: ' + (err.message || 'upload error'));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function savePrefs(next: NotificationPreferences) {
    if (!profile) return;
    setPrefs(next);
    setPrefsSaving(true);
    await supabase.from('profiles').update({ notification_preferences: next }).eq('id', profile.id);
    await refreshProfile();
    setPrefsSaving(false);
  }

  async function handleSaveProfile() {
    if (!profile) return;
    setSaving(true);
    setSaveMsg('');
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', profile.id);
    setSaving(false);
    if (error) { setSaveMsg('Failed to save: ' + error.message); return; }
    await refreshProfile();
    setSaveMsg('Profile updated successfully!');
    setEditing(false);
    setTimeout(() => setSaveMsg(''), 3000);
  }

  async function handleChangePassword() {
    if (pw.next !== pw.confirm) { setPwMsg("Passwords don't match."); return; }
    if (pw.next.length < 6) { setPwMsg('Password must be at least 6 characters.'); return; }
    setPwSaving(true);
    setPwMsg('');
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwSaving(false);
    if (error) { setPwMsg('Error: ' + error.message); return; }
    setPwMsg('Password changed successfully!');
    setChangingPw(false);
    setPw({ current: '', next: '', confirm: '' });
    setTimeout(() => setPwMsg(''), 3000);
  }

  if (!profile) return <div className="p-12 flex justify-center"><Spinner /></div>;

  const roleConf = ROLE_CONFIG[profile.role] ?? ROLE_CONFIG.student;
  const initials = (profile.full_name || profile.email || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
          <User size={28} className="text-primary-600 drop-shadow-sm" />
          My Profile
        </h1>
        <p className="text-slate-500 font-medium">Manage your personal information and account settings</p>
      </div>

      {/* Profile Hero Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-r from-primary-500 via-primary-600 to-violet-600 relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Avatar + Info */}
        <div className="px-8 pb-8 -mt-14 relative">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Avatar */}
            <div className="relative group w-24 h-24 shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-24 h-24 rounded-3xl object-cover ring-4 ring-white shadow-xl" />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-400 to-primary-700 text-white flex items-center justify-center text-3xl font-black ring-4 ring-white shadow-xl select-none">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-3xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                aria-label="Change profile photo"
              >
                {uploadingAvatar ? <Loader2 size={20} className="text-white animate-spin" /> : <Camera size={20} className="text-white" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* Info */}
            <div className="flex-1 mt-2 md:mt-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  {editing ? (
                    <input
                      className="text-2xl font-black text-slate-800 tracking-tight bg-transparent border-b-2 border-primary-400 outline-none w-full max-w-xs"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{profile.full_name || 'Unnamed User'}</h2>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${roleConf.bg} ${roleConf.color}`}>
                      <Shield size={12} /> {roleConf.label}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                      <Mail size={14} /> {profile.email}
                    </span>
                  </div>
                  {editing ? (
                    <input
                      className="mt-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-400 w-full max-w-xs"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Contact phone number"
                    />
                  ) : profile.phone ? (
                    <p className="text-sm text-slate-500 font-medium mt-2">{profile.phone}</p>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <button onClick={() => { setEditing(false); setFullName(profile.full_name || ''); }} className="p-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-colors">
                        <X size={18} />
                      </button>
                      <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50">
                        {saving ? <Spinner size="sm" /> : <Save size={16} />} Save
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50 transition-all shadow-sm">
                      <Edit3 size={16} /> Edit Profile
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {saveMsg && (
            <div className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${saveMsg.includes('Failed') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              <CheckCircle2 size={16} /> {saveMsg}
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {profile.role === 'student' ? (
            <>
              <StatBox icon={<BookOpen size={22} />} label="Enrolled Courses" value={stats.courses} color="primary" />
              <StatBox icon={<CheckCircle2 size={22} />} label="Completed" value={stats.completed} color="success" />
              <StatBox icon={<Clock size={22} />} label="Learning Hours" value={`${stats.hours}h`} color="sky" />
              <StatBox icon={<Award size={22} />} label="Certificates" value={stats.certificates} color="amber" />
            </>
          ) : profile.role === 'professor' ? (
            <>
              <StatBox icon={<BookOpen size={22} />} label="Courses Created" value={stats.courses} color="primary" />
              <StatBox icon={<Activity size={22} />} label="Role" value="Professor" color="sky" />
              <StatBox icon={<Award size={22} />} label="Status" value="Active" color="success" />
              <StatBox icon={<Shield size={22} />} label="Permissions" value="Full Course" color="amber" />
            </>
          ) : (
            <>
              <StatBox icon={<Shield size={22} />} label="Role" value="Admin" color="primary" />
              <StatBox icon={<Activity size={22} />} label="Access Level" value="Full" color="success" />
              <StatBox icon={<BookOpen size={22} />} label="Manages" value="All Resources" color="sky" />
              <StatBox icon={<Award size={22} />} label="Status" value="Active" color="amber" />
            </>
          )}
        </div>
      )}

      {/* Account Security */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h3 className="text-lg font-black text-slate-800 tracking-tight mb-6 flex items-center gap-2">
          <KeyRound size={20} className="text-primary-500" /> Account Security
        </h3>

        {!changingPw ? (
          <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <p className="font-bold text-slate-800">Password</p>
              <p className="text-sm text-slate-400 font-medium mt-0.5">Keep your account safe with a strong password</p>
            </div>
            <button
              onClick={() => setChangingPw(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50 transition-all shadow-sm"
            >
              <Edit3 size={16} /> Change Password
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {(['current', 'next', 'confirm'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  {field === 'current' ? 'Current Password' : field === 'next' ? 'New Password' : 'Confirm New Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPw[field] ? 'text' : 'password'}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-primary-400 outline-none pr-12 transition-shadow"
                    value={pw[field]}
                    onChange={e => setPw(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(prev => ({ ...prev, [field]: !prev[field] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    {showPw[field] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}

            {pwMsg && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${pwMsg.includes('Error') || pwMsg.includes("don't") || pwMsg.includes("must") ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                <CheckCircle2 size={16} /> {pwMsg}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setChangingPw(false); setPw({ current: '', next: '', confirm: '' }); setPwMsg(''); }} className="flex-1 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors border border-slate-200">
                Cancel
              </button>
              <button onClick={handleChangePassword} disabled={pwSaving} className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {pwSaving ? <Spinner size="sm" /> : <Save size={16} />} Update Password
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <p className="font-bold text-slate-800">Email Address</p>
              <p className="text-sm text-slate-500 font-medium mt-0.5">{session?.user?.email}</p>
            </div>
            <Badge color="slate">Verified</Badge>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h3 className="text-lg font-black text-slate-800 tracking-tight mb-6 flex items-center gap-2">
          <Bell size={20} className="text-primary-500" /> Notification Preferences
          {prefsSaving && <Loader2 size={14} className="animate-spin text-slate-400" />}
        </h3>
        <div className="space-y-3">
          {([
            { key: 'in_app' as const, label: 'In-App Notifications', desc: 'Alerts shown inside the portal (grades, assignments, announcements)' },
            { key: 'email' as const, label: 'Email Notifications', desc: 'Receive important updates via email' },
            { key: 'push' as const, label: 'Push Notifications', desc: 'Browser push alerts for time-sensitive events' },
          ]).map((row) => (
            <div key={row.key} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="font-bold text-slate-800">{row.label}</p>
                <p className="text-sm text-slate-400 font-medium mt-0.5">{row.desc}</p>
              </div>
              <button
                onClick={() => savePrefs({ ...prefs, [row.key]: !prefs[row.key] })}
                className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${prefs[row.key] ? 'bg-primary-600' : 'bg-slate-300'}`}
                aria-label={`Toggle ${row.label}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${prefs[row.key] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'from-primary-50 to-primary-100 text-primary-600 border-primary-100',
    success: 'from-emerald-50 to-emerald-100 text-emerald-600 border-emerald-100',
    sky: 'from-sky-50 to-sky-100 text-sky-600 border-sky-100',
    amber: 'from-amber-50 to-amber-100 text-amber-600 border-amber-100',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} rounded-2xl border p-5 flex flex-col gap-3`}>
      <div className="opacity-70">{icon}</div>
      <div>
        <p className="text-2xl font-black tracking-tight">{value}</p>
        <p className="text-xs font-bold opacity-70 uppercase tracking-widest mt-0.5">{label}</p>
      </div>
    </div>
  );
}
