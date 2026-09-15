import React from 'react';
import { User } from '../services/types';
import { CompanyLogo } from './CompanyLogo';
import { Icon } from './Icons';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-100 flex-shrink-0">
      <div className="flex items-center gap-2">
        <CompanyLogo size={28} />
        <span className="text-sm font-bold text-slate-800 tracking-tight">Northstar Workflow</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-800">
            Welcome, <span className="text-blue-600">{user.name}</span>
          </p>
          <p className="text-[11px] text-slate-400">{user.role} · {user.dept}</p>
        </div>
        <button
          onClick={onLogout}
          title="Logout"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
        >
          <Icon name="logout" className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
