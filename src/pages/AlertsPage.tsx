import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, Alert } from '../lib/supabase';
import { Card, Button, Badge, Spinner, EmptyState, formatDateTime } from '../components/ui';

export default function AlertsPage() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

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
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('alerts').delete().eq('id', id);
    load();
  };

  if (loading) return <Spinner />;

  const unread = alerts.filter((a) => !a.read_at).length;
  const sevColor = (s: string) => (s === 'critical' ? 'red' : s === 'warning' ? 'amber' : 'slate');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Alerts & Notifications</h1>
          <p className="text-sm text-slate-500">{unread} unread of {alerts.length} total</p>
        </div>
        {unread > 0 && <Button variant="outline" onClick={markAllRead}><CheckCheck size={16} /> Mark all read</Button>}
      </div>

      {alerts.length === 0 ? (
        <Card><EmptyState icon={<Bell size={32} />} title="No alerts" subtitle="You're all caught up" /></Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <Card key={a.id} className={`p-4 ${!a.read_at ? 'border-l-4 border-l-sky-500' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${a.severity === 'critical' ? 'bg-rose-100 text-rose-600' : a.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Bell size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800">{a.title}</p>
                    <Badge color={sevColor(a.severity)}>{a.severity}</Badge>
                    {!a.read_at && <Badge color="blue">New</Badge>}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{a.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDateTime(a.created_at)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {!a.read_at && <Button size="sm" variant="ghost" onClick={() => markRead(a.id)}>Mark read</Button>}
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
