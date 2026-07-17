import { useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { supabase, AuditLog, Profile } from '../lib/supabase';
import { Card, Badge, Spinner, EmptyState, formatDateTime } from '../components/ui';

export default function AuditPage() {
  const [logs, setLogs] = useState<(AuditLog & { actor?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('audit_logs').select('*, actor:profiles!audit_logs_actor_id_fkey(id, email, full_name)').order('created_at', { ascending: false }).limit(200);
      setLogs(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = logs.filter((l) => !search || `${l.action} ${l.entity_type} ${l.actor?.email || ''}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Audit Logs</h1>
        <p className="text-sm text-slate-500">System action history</p>
      </div>
      <Card className="p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by action, entity, or user…" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
      </Card>
      {filtered.length === 0 ? (
        <Card><EmptyState icon={<ScrollText size={32} />} title="No audit logs" /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">When</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Actor</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Entity</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                    <td className="px-4 py-3 text-slate-700">{l.actor?.email || 'System'}</td>
                    <td className="px-4 py-3"><Badge color="blue">{l.action}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{l.entity_type}{l.entity_id ? ` (${l.entity_id.slice(0, 8)}…)` : ''}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell"><code className="text-xs">{JSON.stringify(l.details)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
