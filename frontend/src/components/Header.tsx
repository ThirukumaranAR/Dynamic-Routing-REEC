import React from 'react';
import { User } from '../services/types';
import { CompanyLogo } from './CompanyLogo';
import { Icon } from './Icons';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const displayRole = user.role;

  return (
    <header className="flex items-center justify-between px-7 py-3.5 bg-white border-b border-slate-100 flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <CompanyLogo size={30} />
        <span className="text-base font-bold text-slate-800 tracking-tight">
          FlowNexus
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-800">
            Welcome, <span className="font-bold">{user.name}</span>
          </p>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {displayRole}
          </p>
        </div>
        <button
          onClick={onLogout}
          title="Logout"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition cursor-pointer"
        >
          <Icon name="logout" className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
