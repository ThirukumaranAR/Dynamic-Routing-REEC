import React from 'react';
import { User, ApprovalRequest } from '../services/types';
import { canViewActiveQuery, formatCurrencyINR } from '../services/api';

interface DashboardViewProps {
  user: User;
  requests: ApprovalRequest[];
  metrics?: { total: number; pending: number; approved: number; rejected: number; queries: number; escalated?: number; policies?: number };
  onNavigate: (tab: any, filter?: any) => void;
  onSelectRequest: (request: ApprovalRequest) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  requests,
  metrics,
  onNavigate,
  onSelectRequest
}) => {
  const visibleRequests = requests.filter(request =>
    canViewActiveQuery(request, user) &&
    (user.role !== 'REQUESTER' || (request.requesterId
      ? request.requesterId === user.id
      : request.requesterEmail
      ? request.requesterEmail.toLowerCase() === user.email.toLowerCase()
      : request.requester === user.name))
  );
  const total = metrics?.total ?? visibleRequests.length;
  const pending = metrics?.pending ?? visibleRequests.filter(r => r.status === 'PENDING').length;
  const approved = metrics?.approved ?? visibleRequests.filter(r => r.status === 'APPROVED').length;
  const rejected = metrics?.rejected ?? visibleRequests.filter(r => r.status === 'REJECTED').length;
  const queries = metrics?.queries ?? visibleRequests.filter(r => r.status === 'QUERIED').length;
  const policies = metrics?.policies ?? 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-7">
      {/* Page Title & Subtitle (MATCHING SCREENSHOT) */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-base text-slate-600 font-medium mt-1">
          Welcome, {user.name}
        </p>
      </div>

      {/* 6 KPI Cards Row (MATCHING SCREENSHOT WITH HIGH FIDELITY) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* 1. Total Requests */}
        <div
          onClick={() => onNavigate('all-requests', 'ALL')}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition p-5 text-center flex flex-col items-center justify-between cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-slate-700">Total Requests</p>
          <p className="text-3xl font-bold text-slate-900 my-1">{total}</p>
          <p className="text-[11px] text-slate-400 leading-tight">View all requests forwarded to you</p>
          <span className="text-[11px] text-slate-400 mt-2.5 group-hover:text-blue-600 font-medium transition">
            Click to view &gt;
          </span>
        </div>

        {/* 2. Pending */}
        <div
          onClick={() => onNavigate('all-requests', 'PENDING')}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition p-5 text-center flex flex-col items-center justify-between cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-slate-700">Pending</p>
          <p className="text-3xl font-bold text-slate-900 my-1">{pending}</p>
          <p className="text-[11px] text-slate-400 leading-tight">View pending approvals</p>
          <span className="text-[11px] text-slate-400 mt-2.5 group-hover:text-blue-600 font-medium transition">
            Click to view &gt;
          </span>
        </div>

        {/* 3. Approved */}
        <div
          onClick={() => onNavigate('all-requests', 'APPROVED')}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition p-5 text-center flex flex-col items-center justify-between cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-slate-700">Approved</p>
          <p className="text-3xl font-bold text-slate-900 my-1">{approved}</p>
          <p className="text-[11px] text-slate-400 leading-tight">View requests which were approved</p>
          <span className="text-[11px] text-slate-400 mt-2.5 group-hover:text-blue-600 font-medium transition">
            Click to view &gt;
          </span>
        </div>

        {/* 4. Rejected */}
        <div
          onClick={() => onNavigate('all-requests', 'REJECTED')}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition p-5 text-center flex flex-col items-center justify-between cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-slate-700">Rejected</p>
          <p className="text-3xl font-bold text-slate-900 my-1">{rejected}</p>
          <p className="text-[11px] text-slate-400 leading-tight">View requests which were rejected</p>
          <span className="text-[11px] text-slate-400 mt-2.5 group-hover:text-blue-600 font-medium transition">
            Click to view &gt;
          </span>
        </div>

        {/* 5. Queries */}
        <div
          onClick={() => onNavigate('queries')}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition p-5 text-center flex flex-col items-center justify-between cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-slate-700">Queries</p>
          <p className="text-3xl font-bold text-slate-900 my-1">{queries}</p>
          <p className="text-[11px] text-slate-400 leading-tight">View queries raised to you</p>
          <span className="text-[11px] text-slate-400 mt-2.5 group-hover:text-blue-600 font-medium transition">
            Click to view &gt;
          </span>
        </div>

        {/* 6. Policies */}
        <div
          onClick={() => onNavigate('all-requests')}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition p-5 text-center flex flex-col items-center justify-between cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-slate-700">Policies</p>
          <p className="text-3xl font-bold text-slate-900 my-1">{policies}</p>
          <p className="text-[11px] text-slate-400 leading-tight">View policies awaiting your approval</p>
          <span className="text-[11px] text-slate-400 mt-2.5 group-hover:text-blue-600 font-medium transition">
            Click to view &gt;
          </span>
        </div>
      </div>

      {/* Recent Requests Card (MATCHING SCREENSHOT) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-900">
            Recent Requests
          </h2>
          <span className="text-xs text-slate-400">
            Click on any request to view details
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {visibleRequests.slice(0, 5).map((req) => {
            const roleLabel = user.role;
            const campusLabel = req.campus || user.campus || 'EEC';
            return (
              <div
                key={req.id}
                onClick={() => {
                  onSelectRequest(req);
                  onNavigate('all-requests');
                }}
                className="py-4 flex items-center justify-between hover:bg-slate-50/70 -mx-3 px-3 rounded-xl transition cursor-pointer group"
              >
                <div>
                  <h3 className="text-base font-semibold text-blue-600 group-hover:underline">
                    {req.title}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium mt-1">
                    {req.department} - {roleLabel} - {campusLabel}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatCurrencyINR(req.amount)} • {req.date}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : req.status === 'REJECTED'
                        ? 'bg-red-100 text-red-700'
                        : req.status === 'QUERIED'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {req.status}
                  </span>
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}

          {visibleRequests.length === 0 && (
            <div className="py-10 text-center text-slate-400 text-sm">
              No recent requests found.
            </div>
          )}
        </div>

        <div className="text-center pt-5 border-t border-slate-100 mt-3">
          <button
            type="button"
            onClick={() => onNavigate('all-requests')}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            View All →
          </button>
        </div>
      </div>
    </div>
  );
};
