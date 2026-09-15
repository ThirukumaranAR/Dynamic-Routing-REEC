import React, { useMemo, useState } from 'react';
import { ApprovalRequest, UserAccount } from '../services/types';

interface UserManagementViewProps {
  users: UserAccount[];
  roles: string[];
  requests: ApprovalRequest[];
  onCreateUser: (user: UserAccount) => void;
  onDeleteUser: (userId: string) => void;
  onCreateRole: (role: string) => void;
  onDeleteRole: (role: string, replacementRole: string) => void;
  onReassignRequest: (requestId: string, targetUserId: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  roles,
  requests,
  onCreateUser,
  onDeleteUser,
  onCreateRole,
  onDeleteRole,
  onReassignRequest
}) => {
  const [account, setAccount] = useState({ name: '', email: '', password: '', role: roles[0] || 'REQUESTER', dept: '', company: 'Northstar Group', businessUnit: 'Head Office' });
  const [newRole, setNewRole] = useState('');
  const [replacementRoles, setReplacementRoles] = useState<Record<string, string>>({});
  const escalatedRequests = requests.filter(request => request.status === 'ESCALATED');
  const nonCeoUsers = useMemo(() => users.filter(user => user.role !== 'CEO'), [users]);

  const submitAccount = (event: React.FormEvent) => {
    event.preventDefault();
    if (!account.name.trim() || !account.email.trim() || !account.password.trim()) return;
    onCreateUser({ ...account, name: account.name.trim(), email: account.email.trim(), dept: account.dept.trim() || 'General' });
    setAccount({ name: '', email: '', password: '', role: roles[0] || 'REQUESTER', dept: '', company: 'Northstar Group', businessUnit: 'Head Office' });
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">CEO Control Center</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Accounts, roles & flagged work</h1>
        <p className="text-sm text-slate-500 mt-1">Only the CEO can change access, remove roles, or redirect escalated requests.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Create an account</h2>
          <form onSubmit={submitAccount} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <input required value={account.name} onChange={event => setAccount({ ...account, name: event.target.value })} placeholder="Full name" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input required type="email" value={account.email} onChange={event => setAccount({ ...account, email: event.target.value })} placeholder="Email" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input required type="password" value={account.password} onChange={event => setAccount({ ...account, password: event.target.value })} placeholder="Temporary password" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <select value={account.role} onChange={event => setAccount({ ...account, role: event.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
              {roles.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
            <input value={account.dept} onChange={event => setAccount({ ...account, dept: event.target.value })} placeholder="Department" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input value={account.businessUnit} onChange={event => setAccount({ ...account, businessUnit: event.target.value })} placeholder="Business unit" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <button className="sm:col-span-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-semibold">Create account</button>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Manage roles</h2>
          <form onSubmit={event => { event.preventDefault(); if (newRole.trim()) { onCreateRole(newRole); setNewRole(''); } }} className="flex gap-2 mt-4">
            <input value={newRole} onChange={event => setNewRole(event.target.value)} placeholder="New role name" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <button className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-semibold">Add role</button>
          </form>
          <div className="mt-4 space-y-2">
            {roles.map(role => (
              <div key={role} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-sm font-semibold text-slate-700">{role}</span>
                {role === 'CEO' ? <span className="text-xs text-slate-400">Protected</span> : (
                  <div className="flex items-center gap-2">
                    <select value={replacementRoles[role] || roles.find(candidate => candidate !== role) || ''} onChange={event => setReplacementRoles({ ...replacementRoles, [role]: event.target.value })} className="border border-slate-200 rounded px-2 py-1 text-xs">
                      {roles.filter(candidate => candidate !== role).map(candidate => <option key={candidate} value={candidate}>{candidate}</option>)}
                    </select>
                    <button onClick={() => onDeleteRole(role, replacementRoles[role] || roles.find(candidate => candidate !== role) || '')} className="text-xs font-semibold text-red-600 hover:text-red-800">Remove</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Active accounts</h2>
        <div className="divide-y divide-slate-100 mt-3">
          {users.map(user => (
            <div key={user.id || user.email} className="py-3 flex items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-slate-800">{user.name}</p><p className="text-xs text-slate-500">{user.email} · {user.role} · {user.dept}</p></div>
              {user.role === 'CEO' ? <span className="text-xs text-slate-400">CEO account</span> : <button onClick={() => user.id && onDeleteUser(user.id)} className="text-xs font-semibold text-red-600 hover:text-red-800">Remove account</button>}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h2 className="text-sm font-bold text-amber-950">Flagged requests needing a new handler</h2>
        <p className="text-xs text-amber-800 mt-1">Choose the person who should receive each delayed or escalated request.</p>
        <div className="space-y-3 mt-4">
          {escalatedRequests.length === 0 && <p className="text-sm text-amber-800">No escalated requests.</p>}
          {escalatedRequests.map(request => (
            <div key={request.id} className="bg-white border border-amber-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-slate-800">{request.id} · {request.title}</p><p className="text-xs text-slate-500">Currently at {request.currentStage}</p></div>
              <div className="flex gap-2">
                <select defaultValue="" id={`target-${request.id}`} className="border border-slate-200 rounded-lg px-2 py-2 text-xs">
                  <option value="" disabled>Select new handler</option>
                  {nonCeoUsers.map(user => <option key={user.id || user.email} value={user.id}>{user.name} ({user.role})</option>)}
                </select>
                <button onClick={() => { const target = document.getElementById(`target-${request.id}`) as HTMLSelectElement | null; if (target?.value) onReassignRequest(request.id, target.value); }} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-2 text-xs font-semibold">Route request</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};