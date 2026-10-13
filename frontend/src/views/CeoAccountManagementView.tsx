import React, { useState } from 'react';
import { UserAccount } from '../services/types';

interface CeoAccountManagementViewProps {
  users: UserAccount[];
  onCreate: (user: UserAccount) => Promise<void>;
  onSetActive: (id: string, active: boolean) => Promise<void>;
}

export const CeoAccountManagementView: React.FC<CeoAccountManagementViewProps> = ({ users, onCreate, onSetActive }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('Executive Office');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await onCreate({ name: name.trim(), email: email.trim().toLowerCase(), role: 'CEO', dept: dept.trim(), company: 'FlowNexus', businessUnit: 'Executive Office', password });
      setName('');
      setEmail('');
      setPassword('');
      setMessage('CEO account created.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create CEO account.');
    } finally {
      setBusy(false);
    }
  };

  const changeActive = async (user: UserAccount) => {
    if (!user.id) return;
    const nextActive = user.isActive === false;
    if (!nextActive && !window.confirm(`Deactivate CEO account for ${user.name}? Historical approvals will be retained.`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await onSetActive(user.id, nextActive);
      setMessage(nextActive ? `${user.name}'s account restored.` : `${user.name}'s account deactivated.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update CEO account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full px-6 py-6 space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900">CEO Account Management</h1>
        <p className="mt-1 text-sm text-slate-500">Create and deactivate CEO accounts. Existing approvals and audit history remain intact.</p>
      </header>

      {message && <p role="status" className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <form onSubmit={submit} className="max-w-3xl space-y-4 border-b border-slate-200 pb-6">
        <h2 className="text-base font-bold text-slate-900">Create CEO account</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold uppercase text-slate-600">Full name
            <input required value={name} onChange={event => setName(event.target.value)} className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-900" />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase text-slate-600">Email
            <input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-900" />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase text-slate-600">Department
            <input required value={dept} onChange={event => setDept(event.target.value)} className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-900" />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase text-slate-600">Temporary password (12+ characters)
            <input required minLength={12} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-900" />
          </label>
        </div>
        <button disabled={busy} className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Create CEO account'}</button>
      </form>

      <section>
        <h2 className="mb-3 text-base font-bold text-slate-900">CEO accounts</h2>
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {users.map(user => (
            <div key={user.id || user.email} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email} · {user.dept}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold ${user.isActive === false ? 'text-red-700' : 'text-emerald-700'}`}>{user.isActive === false ? 'DEACTIVATED' : 'ACTIVE'}</span>
                <button disabled={busy || !user.id} type="button" onClick={() => void changeActive(user)} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">
                  {user.isActive === false ? 'Restore' : 'Deactivate'}
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No CEO accounts yet.</p>}
        </div>
      </section>
    </div>
  );
};
