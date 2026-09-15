import React from 'react';
import { User, ApprovalRequest, RequestStatus } from '../services/types';

interface CompletionStatusViewProps {
  user: User;
  requests: ApprovalRequest[];
}

export const CompletionStatusView: React.FC<CompletionStatusViewProps> = ({
  user,
  requests
}) => {
  const visibleRequests = user.role === 'REQUESTER'
    ? requests.filter(r => r.requester === user.name)
    : user.role === 'CEO'
    ? requests
    : requests.filter(r => r.currentStage === user.role || r.status === 'APPROVED');

  const total = visibleRequests.length;
  const approved = visibleRequests.filter(r => r.status === 'APPROVED').length;
  const pending = visibleRequests.filter(r => r.status === 'PENDING').length;
  const rejected = visibleRequests.filter(r => r.status === 'REJECTED').length;
  const queries = visibleRequests.filter(r => r.status === 'QUERIED').length;
  
  const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;
  const rejectionRate = total > 0 ? Math.round((rejected / total) * 100) : 0;

  const statusList: RequestStatus[] = ['APPROVED', 'PENDING', 'QUERIED', 'REJECTED', 'ESCALATED'];

  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Completion Status</h1>
        <p className="text-sm text-slate-400">
          Overview of approval completion rates and business resolution metrics across all 8 tiers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Finalized Approval Rate
          </p>
          <p className="text-3xl font-bold text-green-600 mb-1">{completionRate}%</p>
          <p className="text-xs text-slate-400">
            {approved} of {total} requests finalized through CEO stage
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Pending Resolution
          </p>
          <p className="text-3xl font-bold text-yellow-600 mb-1">{pending + queries}</p>
          <p className="text-xs text-slate-400">
            {pending} in review, {queries} awaiting clarification
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Rejection Rate
          </p>
          <p className="text-3xl font-bold text-red-500 mb-1">{rejectionRate}%</p>
          <p className="text-xs text-slate-400">{rejected} requests rejected</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Average Business Turnaround
          </p>
          <p className="text-3xl font-bold text-blue-600 mb-1">3.6h</p>
          <p className="text-xs text-slate-400">Within 8-hour Mon-Fri Business SLA</p>
        </div>
      </div>

      {/* Breakdown Bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
        <p className="text-sm font-semibold text-slate-700 mb-4">Status Distribution</p>
        {statusList.map(st => {
          const count = visibleRequests.filter(r => r.status === st).length;
          const percentage = total ? Math.round((count / total) * 100) : 0;
          const colorMap: Record<RequestStatus, string> = {
            APPROVED: 'bg-green-500',
            PENDING: 'bg-yellow-400',
            QUERIED: 'bg-orange-400',
            REJECTED: 'bg-red-500',
            ESCALATED: 'bg-purple-500'
          };

          return (
            <div key={st} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-600">{st}</span>
                <span className="text-slate-400">
                  {count} · {percentage}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${colorMap[st]} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
