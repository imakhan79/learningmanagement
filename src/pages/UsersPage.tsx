import { useEffect, useState } from 'react';
import { Users, Search, Shield, UserCog } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, Profile } from '../lib/supabase';
import { Button, Card, Input, Select, Badge, Spinner, EmptyState, Modal, formatDate } from '../components/ui';

export default function UsersPage() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editing, setEditing] = useState<Profile | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search && !(`${u.full_name} ${u.email}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const roleColor = (r: string) => (r === 'admin' ? 'red' : r === 'professor' ? 'blue' : 'green');
  const statusColor = (s: string) => (s === 'active' ? 'green' : s === 'pending_activation' ? 'amber' : 'slate');

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">User Management</h1>
        <p className="text-sm text-slate-500">Manage accounts, roles, and status</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} options={[
            { value: 'all', label: 'All Roles' },
            { value: 'admin', label: 'Admins' },
            { value: 'professor', label: 'Professors' },
            { value: 'student', label: 'Students' },
          ]} />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Users size={32} />} title="No users found" /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Joined</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold">
                          {(u.full_name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700 truncate">{u.full_name || 'Unnamed'}</p>
                          <p className="text-xs text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge color={roleColor(u.role)}>{u.role}</Badge></td>
                    <td className="px-4 py-3"><Badge color={statusColor(u.status)}>{u.status}</Badge></td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)}><UserCog size={14} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <EditUserModal user={editing} me={me!} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function EditUserModal({ user, me, onClose, onSaved }: { user: Profile; me: Profile; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [fullName, setFullName] = useState(user.full_name);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ role, status, full_name: fullName }).eq('id', user.id);
    await supabase.from('audit_logs').insert({
      actor_id: me.id, action: 'update_user', entity_type: 'profile', entity_id: user.id,
      details: { role, status, fullName },
    });
    setSaving(false);
    onSaved();
  };

  const activate = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ status: 'active' }).eq('id', user.id);
    await supabase.from('audit_logs').insert({
      actor_id: me.id, action: 'activate_user', entity_type: 'profile', entity_id: user.id, details: {},
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={`Edit — ${user.email}`}>
      <div className="space-y-4 p-6 pt-2">
        <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as any)} options={[
          { value: 'student', label: 'Student' }, { value: 'professor', label: 'Professor' }, { value: 'admin', label: 'Admin' },
        ]} />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)} options={[
          { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
          { value: 'suspended', label: 'Suspended' }, { value: 'pending_activation', label: 'Pending Activation' },
        ]} />
        <div className="flex justify-between gap-2 pt-2">
          {status === 'pending_activation' && <Button variant="outline" onClick={activate} disabled={saving}><Shield size={14} /> Activate</Button>}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
