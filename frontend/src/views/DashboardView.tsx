import React from 'react';
import { User, ApprovalRequest } from '../services/types';
import { formatCurrencyINR, getStageActorName } from '../services/api';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icons';

interface DashboardViewProps {
  user: User;
  requests: ApprovalRequest[];
  onNavigate?: (tab: any, filter?: any) => void;
  onNavigateTab?: (tab: any) => void;
  onSelectRequest: (request: ApprovalRequest) => void;
  onFilterChange?: (status: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  requests,
  onNavigate,
  onNavigateTab,
  onSelectRequest,
  onFilterChange
}) => {
  const handleNav = (tab: string, filter?: string) => {
    if (onNavigate) {
      onNavigate(tab, filter);
    } else {
      if (onNavigateTab) onNavigateTab(tab);
      if (filter && onFilterChange) onFilterChange(filter);
    }
  };

  const visibleRequests = user.role === 'REQUESTER' ? requests.filter(request => request.requester === user.name) : requests;
  const pendingAtMyStage = requests.filter(
    r => r.status === 'PENDING' && r.currentStage === user.role
  ).length;

  const total = visibleRequests.length;
  const approved = visibleRequests.filter(r => r.status === 'APPROVED').length;
  const rejected = visibleRequests.filter(r => r.status === 'REJECTED').length;

  return (
    <div className="px-6 py-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-0.5">
            Workflow
          </h1>
          <p className="text-xs text-slate-500">
            Track all requests across every stage · Welcome, <strong>{user.name}</strong> · {user.role}
          </p>
        </div>

        <button className="text-xs font-semibold text-blue-600 border border-blue-100 rounded-lg px-3 py-2">Refresh</button>
      </div>

      {/* Workflow summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
        <MetricCard
          icon="total"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Total"
          value={user.role === 'REQUESTER' ? total : pendingAtMyStage}
          desc="All tracked requests"
          onClick={() => handleNav('all-requests', 'PENDING')}
        />

        <MetricCard
          icon="clock"
          iconBg="bg-yellow-50"
          iconColor="text-yellow-600"
          label="Pending"
          value={requests.filter(r => r.status === 'PENDING').length}
          desc="Awaiting action"
          onClick={() => handleNav('all-requests', 'PENDING')}
        />

        <MetricCard
          icon="check"
          iconBg="bg-green-50"
          iconColor="text-green-600"
          label="Approved"
          value={approved}
          desc="Successfully completed"
          onClick={() => handleNav('all-requests', 'APPROVED')}
        />

        <MetricCard
          icon="warning"
          iconBg="bg-red-50"
          iconColor="text-red-500"
          label="Rejected"
          value={rejected}
          desc="Declined requests"
          onClick={() => handleNav('all-requests', 'REJECTED')}
        />

      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-3">
          <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Search by title, ID, department, company/team..." />
          <button className="text-xs font-semibold text-blue-600 px-3">Clear all</button>
          {['Status', 'Stage', 'Request Type', 'Business Unit / Company', 'Department', 'Time'].map(filter => <select key={filter} className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600"><option>{filter}</option><option>All</option></select>)}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4"><h2 className="text-base font-bold text-slate-800">Organization & Departments</h2><span className="text-xs text-slate-400">Dynamic request distribution</span></div>
        {[['Head Office', visibleRequests.length], ['Operations', visibleRequests.filter(request => request.department === 'Operations').length], ['Corporate Services', visibleRequests.filter(request => ['Finance', 'Technology', 'People & Culture'].includes(request.department)).length]].map(([label, count]) => <div key={label} className="flex items-center justify-between border-t border-slate-100 py-3 text-sm"><span className="font-semibold text-slate-700">⌄ {label}</span><span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{count} requests</span></div>)}
      </div>

      {/* Real-time Tracked Requests Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">
            Real-Time Request Stages &amp; Handlers
          </h2>
          <button
            onClick={() => handleNav('all-requests')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            View All Tracked Requests →
          </button>
        </div>

        <div>
          {visibleRequests.slice(0, 6).map((req, idx) => (
            <button
              key={req.id}
              onClick={() => {
                onSelectRequest(req);
                handleNav('all-requests');
              }}
              className={`w-full text-left flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition ${
                idx === 0 ? '' : 'border-t border-slate-100'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-blue-600 hover:underline">
                    {req.title}
                  </p>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                    📍 Stage: {req.currentStage.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {req.department} · {req.requester} · Handler: <strong>{getStageActorName(req.currentStage)}</strong>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatCurrencyINR(req.amount)} · {req.date}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {req.businessHoursIdle >= 6 && (
                  <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full animate-pulse border border-red-200">
                    🚨 &gt;6h SLA Exceeded
                  </span>
                )}
                <StatusBadge status={req.status} />
                <Icon name="chevron" className="w-4 h-4 text-slate-300" />
              </div>
            </button>
          ))}

          {visibleRequests.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              No requests in queue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
