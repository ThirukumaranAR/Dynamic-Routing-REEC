import React from 'react';
import { NavigationTab, UserRole } from '../services/types';
import { Icon } from './Icons';

type SidebarIcon = 'dashboard' | 'requests' | 'create' | 'categories' | 'queries' | 'completion' | 'profile' | 'sops';

interface NavItem {
  key: NavigationTab;
  icon: SidebarIcon;
  label: string;
  roles?: UserRole[];
}

interface SidebarProps {
  activeTab: NavigationTab;
  userRole?: UserRole;
  onSelectTab: (tab: NavigationTab) => void;
}

const navItems: NavItem[] = [
  { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { key: 'all-requests', icon: 'requests', label: 'All Requests' },
  { key: 'create-request', icon: 'create', label: 'Create Requests', roles: ['REQUESTER'] },
  { key: 'flow-categories', icon: 'categories', label: 'Flow Categories' },
  { key: 'queries', icon: 'queries', label: 'Queries', roles: ['CEO'] },
  { key: 'flagged-requests', icon: 'sops', label: 'Flagged Requests', roles: ['CEO'] },
  { key: 'completion-status', icon: 'completion', label: 'Completion Status' },
  { key: 'my-profile', icon: 'profile', label: 'My Profile' }
  ,{ key: 'user-management', icon: 'sops', label: 'CEO Management', roles: ['CEO'] }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  userRole = 'REQUESTER',
  onSelectTab
}) => {
  const visibleNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  });

  return (
    <aside className="w-48 bg-white border-r border-slate-100 flex flex-col flex-shrink-0">
      <div className="px-3.5 pt-4 pb-3 border-b border-slate-100">
        <p className="text-xs font-bold text-blue-600 tracking-wider uppercase">
          Smart Approval
        </p>
      </div>

      <nav className="flex-1 px-2 py-2.5 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map(item => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelectTab(item.key)}
              className={`flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold border-r-[3px] border-blue-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                name={item.icon}
                className={`w-4 h-4 flex-shrink-0 ${
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
