import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, AlertTriangle, Info, ShieldAlert, BellOff, Inbox } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, Alert } from '../lib/supabase';
import { Badge, Spinner, formatDateTime } from '../components/ui';

const SEV_CONFIG: Record<string, { icon: typeof Bell; bg: string; text: string; border: string; badgeColor: 'rose' | 'amber' | 'sky' | 'slate' }> = {
  critical: { icon: ShieldAlert, bg: 'bg-rose-100',  text: 'text-rose-600',  border: 'border-l-rose-500',  badgeColor: 'rose' },
  warning:  { icon: AlertTriangle, bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-l-amber-400', badgeColor: 'amber' },
  info:     { icon: Info,    bg: 'bg-sky-100',   text: 'text-sky-600',   border: 'border-l-sky-400',   badgeColor: 'sky' },
  general:  { icon: Bell,    bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-l-slate-300',  badgeColor: 'slate' },
};

export default function AlertsPage() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('alerts').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false });
    setAlerts(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const markAllRead = async () => {
    await supabase.from('alerts').update({ read_at: new Date().toISOString() }).eq('user_id', profile!.id).is('read_at', null);
    load();
  };

  const markRead = async (id: string) => {
    await supabase.from('alerts').update({ read_at: new Date().toISOString() }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read_at: new Date().toISOString() } : a));
  };

  const remove = async (id: string) => {
    await supabase.from('alerts').delete().eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  if (loading) return <div className="p-12 flex justify-center"><Spinner /></div>;

  const unread = alerts.filter((a) => !a.read_at).length;
  const displayed = filter === 'unread' ? alerts.filter(a => !a.read_at) : alerts;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <Bell size={28} className="text-primary-600 drop-shadow-sm" />
            Alerts & Notifications
          </h1>
          <p className="text-slate-500 font-medium">
            {unread > 0 ? (
              <><span className="font-black text-primary-600">{unread}</span> unread · {alerts.length} total</>
            ) : (
              'All caught up! No unread alerts.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl">
            {(['all', 'unread'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all capitalize ${
                  filter === f ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {f}
                {f === 'unread' && unread > 0 && (
                  <span className="ml-1.5 text-xs font-black bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">{unread}</span>
                )}
              </button>
            ))}
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50 transition-all shadow-sm"
            >
              <CheckCheck size={16} /> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Alerts List */}
      {displayed.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center justify-center gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
            <Inbox size={40} className="text-slate-300" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-600 tracking-tight">
              {filter === 'unread' ? 'No unread alerts' : 'No alerts yet'}
            </p>
            <p className="text-slate-400 font-medium mt-1">
              {filter === 'unread' ? "You've read everything!" : "Activity notifications will appear here."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((a) => {
            const sev = SEV_CONFIG[a.severity] ?? SEV_CONFIG.general;
            const Icon = sev.icon;
            const isUnread = !a.read_at;
            return (
              <div
                key={a.id}
                className={`relative bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4 transition-all group ${
                  isUnread ? `border-l-4 ${sev.border}` : 'opacity-80 hover:opacity-100'
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center ${sev.bg}`}>
                  <Icon size={18} className={sev.text} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className={`text-sm font-black tracking-tight ${isUnread ? 'text-slate-900' : 'text-slate-600'}`}>{a.title}</p>
                    <Badge color={sev.badgeColor} className="shadow-sm text-xs">{a.severity}</Badge>
                    {isUnread && <Badge color="blue" className="shadow-sm text-xs">New</Badge>}
                  </div>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">{a.message}</p>
                  <p className="text-xs text-slate-400 font-medium mt-2">{formatDateTime(a.created_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUnread && (
                    <button
                      onClick={() => markRead(a.id)}
                      className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                      title="Mark as read"
                    >
                      <CheckCheck size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => remove(a.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Unread dot */}
                {isUnread && (
                  <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-primary-500 rounded-full shadow-sm shadow-primary-500/50" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
