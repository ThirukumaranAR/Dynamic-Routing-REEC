import React, { useState } from 'react';
import { User } from '../services/types';
import { getRoleDisplayName } from '../services/api';

interface ProfileViewProps {
  user: User;
  onUpdateUser?: (updated: User) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdateUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [dept, setDept] = useState(user.dept);
  const [businessUnit, setBusinessUnit] = useState(user.businessUnit || 'Head Office');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dept.trim()) return;

    const updatedUser: User = {
      ...user,
      name: name.trim(),
      dept: dept.trim(),
      businessUnit: businessUnit.trim() || 'Head Office',
      role: user.role // Role is locked and cannot be changed
    };

    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
    setIsEditing(false);
    setSuccessMsg('Profile updated successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCancel = () => {
    setName(user.name);
    setDept(user.dept);
    setBusinessUnit(user.businessUnit || 'Head Office');
    setIsEditing(false);
  };

  return (
    <div className="px-6 py-6 max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h1>
          <p className="text-xs text-slate-500 mt-0.5">Verified Company User Profile & System Credentials</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-700 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Profile
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-xs font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-7">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xl flex items-center justify-center flex-shrink-0">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
              <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200">
                ✓ Verified
              </span>
            </div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mt-0.5">
              {user.role} — {getRoleDisplayName(user.role)}
            </p>
          </div>
        </div>

        {!isEditing ? (
          /* View Mode */
          <div className="space-y-3">
            {[
              { label: 'Full Name', value: user.name, icon: '👤' },
              { label: 'Email Address', value: user.email, icon: '✉️' },
              { label: 'Department', value: user.dept, icon: '🏢' },
              { label: 'Business Unit', value: user.businessUnit || 'Head Office', icon: '📍' },
              { label: 'Enterprise Role', value: `${user.role} (${getRoleDisplayName(user.role)})`, icon: '🛡️' }
            ].map(item => (
              <div
                key={item.label}
                className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
              >
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <span>{item.icon}</span> {item.label}
                </span>
                <span className="text-sm text-slate-800 font-semibold">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Edit Mode (Role is strictly locked) */
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Email Address <span className="text-slate-400 font-normal">(Read-only)</span>
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Enterprise Role <span className="text-slate-400 font-normal">(Role is locked and cannot be edited)</span>
              </label>
              <div className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600 font-semibold flex items-center justify-between">
                <span>{user.role} — {getRoleDisplayName(user.role)}</span>
                <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">🔒 Locked</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={dept}
                  onChange={e => setDept(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Business Unit
                </label>
                <input
                  type="text"
                  value={businessUnit}
                  onChange={e => setBusinessUnit(e.target.value)}
                  placeholder="e.g. Head Office / Operations"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium px-4 py-2 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
