import React, { useState, useEffect } from 'react';
import { User, ApprovalRequest, RequestStatus, RequestAttachment, ApprovalStage } from '../services/types';
import { formatCurrencyINR, getNextStage, getRoleDisplayName, getStageActorName, isCurrentlyBusinessHours } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icons';

interface AllRequestsViewProps {
  user: User;
  requests: ApprovalRequest[];
  selectedRequest: ApprovalRequest | null;
  statusFilter: RequestStatus | 'ALL';
  onSelectRequest: (request: ApprovalRequest | null) => void;
  onFilterChange: (status: RequestStatus | 'ALL') => void;
  onUpdateStatus: (
    requestId: string,
    newStatus: RequestStatus,
    actionDesc: string,
    extra?: Partial<ApprovalRequest>
  ) => void;
  onAdvanceStage: (
    requestId: string,
    nextStage: ApprovalStage,
    actionDesc: string
  ) => void;
}

const statusFilters: (RequestStatus | 'ALL')[] = [
  'ALL',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'QUERIED',
  'ESCALATED'
];

export const AllRequestsView: React.FC<AllRequestsViewProps> = ({
  user,
  requests,
  selectedRequest,
  statusFilter,
  onSelectRequest,
  onFilterChange,
  onUpdateStatus,
  onAdvanceStage
}) => {
  const [queryText, setQueryText] = useState('');
  const [revisedTitle, setRevisedTitle] = useState('');
  const [revisedAmount, setRevisedAmount] = useState('');
  const [revisedDescription, setRevisedDescription] = useState('');
  const [responseExplanation, setResponseExplanation] = useState('');
  const [viewingDocument, setViewingDocument] = useState<RequestAttachment | null>(null);

  // Manager's branch selection state
  const [selectedBranch, setSelectedBranch] = useState<'HR' | 'IT' | 'FINANCE'>('FINANCE');

  // Success Feedback Message on Action
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');

  const isBusinessTime = isCurrentlyBusinessHours();

  useEffect(() => {
    if (selectedRequest) {
      setRevisedTitle(selectedRequest.title);
      setRevisedAmount(selectedRequest.amount.toString());
      setRevisedDescription(selectedRequest.description);
      setResponseExplanation('');
      setActionSuccessMsg('');

      if (selectedRequest.category === 'Leave' || selectedRequest.category === 'Permission') setSelectedBranch('HR');
      else if (selectedRequest.category === 'Travel' || selectedRequest.category === 'Purchase' || selectedRequest.category === 'Reimbursement') setSelectedBranch('FINANCE');
      else setSelectedBranch('IT');
    }
  }, [selectedRequest]);

  const visibleRequests = user.role === 'REQUESTER' ? requests.filter(request => request.requester === user.name && request.status !== 'QUERIED' && request.status !== 'ESCALATED') : requests;

  const filteredRequests = statusFilter === 'ALL'
    ? visibleRequests
    : visibleRequests.filter(r => r.status === statusFilter);

  const req = selectedRequest;

  const getStageList = (request: ApprovalRequest) => {
    if (request.currentStage === 'FINANCE' || request.currentStage === 'ACCOUNTANT' || request.category === 'Travel' || request.category === 'Purchase' || request.category === 'Reimbursement') {
      return ['REQUESTER', 'MANAGER', 'FINANCE', 'ACCOUNTANT', 'GENERAL_MANAGER', 'CEO'];
    }
    if (request.currentStage === 'HR' || request.category === 'Leave' || request.category === 'Permission') {
      return ['REQUESTER', 'MANAGER', 'HR', 'GENERAL_MANAGER', 'CEO'];
    }
    return ['REQUESTER', 'MANAGER', 'IT', 'GENERAL_MANAGER', 'CEO'];
  };

  const isHigherAuthority = user.role === 'CEO' || user.role === 'GENERAL_MANAGER';

  // Strict role-stage lock:
  const isMyTurnToApprove = req && (
    (user.role === 'MANAGER' && req.currentStage === 'MANAGER' && req.status === 'PENDING') ||
    (user.role === 'FINANCE' && req.currentStage === 'FINANCE' && req.status === 'PENDING') ||
    (user.role === 'ACCOUNTANT' && req.currentStage === 'ACCOUNTANT' && req.status === 'PENDING') ||
    (user.role === 'HR' && req.currentStage === 'HR' && req.status === 'PENDING') ||
    (user.role === 'IT' && req.currentStage === 'IT' && req.status === 'PENDING') ||
    (user.role === 'GENERAL_MANAGER' && (req.currentStage === 'GENERAL_MANAGER' || (req.businessHoursIdle >= 6 && req.status === 'PENDING')) && req.status !== 'APPROVED' && req.status !== 'REJECTED') ||
    (user.role === 'CEO' && (req.currentStage === 'CEO' || req.status === 'ESCALATED' || (req.businessHoursIdle >= 6 && req.status === 'PENDING')) && req.status !== 'APPROVED' && req.status !== 'REJECTED')
  );

  // Filter out internal queries & replies from the public audit trail:
  const publicAuditTrail = req?.auditTrail.filter(entry => {
    const act = entry.action.toLowerCase();
    return !act.includes('query raised') && !act.includes('clarification response') && !act.includes('query:');
  }) || [];

  return (
    <div className="flex h-full">
      {/* Left List Column */}
      <div
        className={`${
          selectedRequest ? 'hidden md:flex' : 'flex'
        } flex-col w-full md:w-96 border-r border-slate-100 flex-shrink-0 overflow-hidden bg-white`}
      >
        <div className="px-5 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-800">All Tracked Requests</h2>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {filteredRequests.length} Requests
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {statusFilters.filter(sf => user.role !== 'REQUESTER' || (sf !== 'QUERIED' && sf !== 'ESCALATED')).map(sf => (
              <button
                key={sf}
                onClick={() => onFilterChange(sf)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  statusFilter === sf
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {sf}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          {filteredRequests.map((r, idx) => {
            const is6hSlaBreached = r.businessHoursIdle >= 6;
            const isActionNeededByMe = (
              (user.role === 'MANAGER' && r.currentStage === 'MANAGER' && r.status === 'PENDING') ||
              (user.role === 'FINANCE' && r.currentStage === 'FINANCE' && r.status === 'PENDING') ||
              (user.role === 'ACCOUNTANT' && r.currentStage === 'ACCOUNTANT' && r.status === 'PENDING') ||
              (user.role === 'HR' && r.currentStage === 'HR' && r.status === 'PENDING') ||
              (user.role === 'IT' && r.currentStage === 'IT' && r.status === 'PENDING') ||
              (user.role === 'GENERAL_MANAGER' && r.currentStage === 'GENERAL_MANAGER' && r.status === 'PENDING') ||
              (user.role === 'CEO' && (r.currentStage === 'CEO' || r.status === 'ESCALATED') && r.status !== 'APPROVED' && r.status !== 'REJECTED')
            );

            return (
              <button
                key={r.id}
                onClick={() => {
                  onSelectRequest(r);
                  setActionSuccessMsg('');
                }}
                className={`w-full text-left px-5 py-3.5 hover:bg-blue-50/50 transition ${
                  idx === 0 ? '' : 'border-t border-slate-100'
                } ${
                  selectedRequest?.id === r.id
                    ? 'bg-blue-50 border-l-4 border-l-blue-600'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-800 line-clamp-1">
                    {r.title}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
                
                {/* PROMINENT STAGE BADGE IN LIST */}
                <div className="flex items-center gap-1.5 flex-wrap my-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    r.status === 'APPROVED'
                      ? 'bg-green-100 text-green-800'
                      : r.status === 'REJECTED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  }`}>
                    📍 Stage: {r.currentStage.replace('_', ' ')}
                  </span>

                  {isActionNeededByMe && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                      ⚡ Action Required By You
                    </span>
                  )}

                  {is6hSlaBreached && r.status === 'PENDING' && (
                    <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-200 animate-pulse">
                      🚩 Flagged (&gt;6h SLA)
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                  <span>{r.department}</span>
                  <span className="text-slate-400 font-medium">{formatCurrencyINR(r.amount)}</span>
                </div>

                <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                  <span>Requester: <strong className="text-slate-600">{r.requester}</strong></span>
                  {r.status === 'PENDING' && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        is6hSlaBreached
                          ? 'bg-red-100 text-red-700 font-bold animate-pulse'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      ⏱️ {r.businessHoursIdle}h / 6h SLA
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {filteredRequests.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              No requests found in this queue.
            </div>
          )}
        </div>
      </div>

      {/* Right Detail Column */}
      {req ? (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <button
            onClick={() => onSelectRequest(null)}
            className="md:hidden flex items-center gap-1 text-sm text-blue-600 mb-4 font-medium"
          >
            ← Back to list
          </button>

          {/* HIGHER AUTHORITY FLAGGED BANNER */}
          {req.businessHoursIdle >= 6 && (
            <div className="mb-4 bg-gradient-to-r from-amber-50 to-red-50 border-2 border-amber-300 rounded-xl p-4 flex items-center justify-between gap-3 text-amber-900 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                  🚩
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black uppercase tracking-wider text-amber-900">
                      FLAGGED FOR HIGHER AUTHORITY REVIEW (&gt;6H IDLE AT {getRoleDisplayName(req.currentStage).toUpperCase()})
                    </p>
                    <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      {req.businessHoursIdle}h / 6h SLA
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1 font-medium">
                    This request is flagged to the Higher Authority ({getRoleDisplayName(user.role === 'CEO' ? 'CEO' : 'GENERAL_MANAGER')}). Higher Authority decides whether to manually flag it to the next official, send a query, or grant clearance.
                  </p>
                </div>
              </div>
              <span className="bg-amber-600 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg uppercase tracking-wider flex-shrink-0 shadow-2xs">
                FLAGGED
              </span>
            </div>
          )}

          {/* PROMINENT ACTIVE STAGE & HANDLER BANNER */}
          <div className="mb-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-lg flex-shrink-0">
                📍
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">CURRENT APPROVAL STAGE</p>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {getRoleDisplayName(req.currentStage)}
                </h3>
                <p className="text-xs text-blue-100">
                  Currently Handled by: <strong>{getStageActorName(req.currentStage)}</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                req.status === 'APPROVED' ? 'bg-green-500 text-white' : req.status === 'REJECTED' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                STATUS: {req.status}
              </span>
            </div>
          </div>

          {/* Multi-Tier Approval Chain Stepper */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              APPROVAL HIERARCHY PROGRESS: REQUESTER → MANAGER (HR / IT / FINANCE → ACCOUNTANT) → GM → CEO
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {getStageList(req).map((st, sIdx, arr) => {
                const isCurrent = req.currentStage === st && req.status !== 'APPROVED';
                const isPassed = req.status === 'APPROVED' || arr.indexOf(req.currentStage) > sIdx;

                return (
                  <React.Fragment key={st}>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/40 font-bold scale-105'
                          : isPassed
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      {isPassed && <span>✓</span>}
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping mr-0.5" />}
                      {st.replace('_', ' ')}
                    </span>
                    {sIdx < arr.length - 1 && (
                      <span className="text-slate-300 font-bold text-xs">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Request Header Card */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-4">
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {req.id}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                    {req.category}
                  </span>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded">
                    Active Handler: {getStageActorName(req.currentStage)}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">{req.title}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Submitted by <strong className="text-slate-700">{req.requester}</strong> ({req.department} · {req.company || user.company})
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrencyINR(req.amount)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{req.date}</p>
                <div className="mt-2">
                  <StatusBadge status={req.status} />
                </div>
              </div>
            </div>

            {/* 6-Hour Business SLA Monitor Bar */}
            <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  BUSINESS SLA POLICY (MON-FRI 9AM-5PM)
                </p>
                <p className="font-semibold text-slate-700 mt-0.5">
                  ⏱️ 6-Hour Review Flag System
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isBusinessTime ? '🟢 SLA Clock Running' : '🌙 SLA Paused (Outside 9AM-5PM / Weekend)'}
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    SLA PROGRESS AT CURRENT ROLE
                  </p>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      req.businessHoursIdle >= 6 ? 'text-amber-600 font-bold' : 'text-slate-600'
                    }`}
                  >
                    {req.businessHoursIdle}h / 6.0h SLA Limit
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      req.businessHoursIdle >= 6
                        ? 'bg-amber-500'
                        : req.businessHoursIdle >= 4.5
                        ? 'bg-amber-400'
                        : 'bg-blue-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (req.businessHoursIdle / 6) * 100)}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="px-6 py-4 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Description & Justification
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {req.description}
              </p>
            </div>

            {/* Attached Documents */}
            <div className="px-6 py-4 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📎</span> Relevant Documents & Quotations ({req.attachments?.length || 0})
                </p>
                <span className="text-[11px] text-slate-400">Click to preview document proof</span>
              </div>

              {req.attachments && req.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {req.attachments.map((doc, dIdx) => (
                    <div
                      key={dIdx}
                      className="bg-white border border-slate-200/80 rounded-lg p-3 flex items-center justify-between shadow-2xs hover:border-blue-400 transition"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 rounded bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {doc.type}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {doc.name}
                          </p>
                          <p className="text-[10px] text-slate-400">{doc.size} · Verified</p>
                        </div>
                      </div>

                      <button
                        onClick={() => setViewingDocument(doc)}
                        className="flex items-center gap-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-xs font-semibold px-2.5 py-1.5 rounded-md transition flex-shrink-0 cursor-pointer"
                      >
                        <Icon name="eye" className="w-3.5 h-3.5" />
                        View Document
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No external document files attached.</p>
              )}
            </div>
          </div>

          {/* Approver Query Callout */}
          {req.query && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                  CLARIFICATION QUERY
                </p>
              </div>
              <p className="text-sm text-orange-900 font-medium">{req.query}</p>
            </div>
          )}

          {/* Action Center with Strict Role-Stage Lock & Higher Authority Flag Decision Controls */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-6 py-5 mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Action Center ({getRoleDisplayName(user.role)})
            </p>

            {/* Success Message Banner */}
            {actionSuccessMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-center gap-3 text-green-800 animate-in fade-in">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="check" className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-green-900 uppercase tracking-wide">
                    Action Completed Successfully!
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {actionSuccessMsg}
                  </p>
                </div>
              </div>
            )}

            {/* HIGHER AUTHORITY FLAGGED DECISION CENTER (CEO / GM when request is flagged >6h) */}
            {isHigherAuthority && req.businessHoursIdle >= 6 && req.status === 'PENDING' && (
              <div className="space-y-4 bg-amber-50/50 p-4 rounded-xl border border-amber-200 mb-4">
                <div>
                  <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    👑 Higher Authority Flagged Request Decision:
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    This request was flagged due to delay at <strong>{getRoleDisplayName(req.currentStage)}</strong>. As Higher Authority, you can decide whether to flag & push it to the next official, send a query, or grant direct clearance:
                  </p>
                </div>

                <div className="flex gap-2.5 flex-wrap">
                  {/* Option 1: Higher Authority decides to flag & move to next official */}
                  <button
                    onClick={() => {
                      const next = getNextStage(req.category, req.currentStage);
                      if (next === 'COMPLETED' || user.role === 'CEO') {
                        onUpdateStatus(
                          req.id,
                          'APPROVED',
                          `Executive Clearance granted by Higher Authority (${user.name})`,
                          { currentStage: 'COMPLETED' }
                        );
                        setActionSuccessMsg('Executive clearance granted by Higher Authority.');
                      } else {
                        onAdvanceStage(
                          req.id,
                          next,
                          `Flagged & Forwarded to next official (${getRoleDisplayName(next)}) by Higher Authority decision`
                        );
                        setActionSuccessMsg(`✓ Higher Authority decision: Flagged and forwarded to ${getRoleDisplayName(next)}.`);
                      }
                    }}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    🚩 Flag & Forward to Next Official ({getRoleDisplayName(getNextStage(req.category, req.currentStage))})
                  </button>

                  {/* Option 2: Higher Authority direct clearance */}
                  <button
                    onClick={() => {
                      onUpdateStatus(
                        req.id,
                        'APPROVED',
                        `Direct Approval granted by Higher Authority (${user.name})`,
                        { currentStage: 'COMPLETED' }
                      );
                      setActionSuccessMsg('Direct executive approval granted.');
                    }}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <Icon name="check" className="w-4 h-4" />
                    Grant Direct Clearance
                  </button>
                </div>
              </div>
            )}

            {/* REQUESTER: Revise Request upon Query */}
            {user.role === 'REQUESTER' && req.status === 'QUERIED' && (
              <div className="space-y-4">
                <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                  💡 <strong>Revision Required:</strong> You can edit the request title, amount, and description below, then submit your clarification.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Revised Title
                    </label>
                    <input
                      type="text"
                      value={revisedTitle}
                      onChange={e => setRevisedTitle(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Revised Amount (INR)
                    </label>
                    <input
                      type="number"
                      value={revisedAmount}
                      onChange={e => setRevisedAmount(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Revised Description
                  </label>
                  <textarea
                    rows={2}
                    value={revisedDescription}
                    onChange={e => setRevisedDescription(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Clarification Response Message <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={responseExplanation}
                    onChange={e => setResponseExplanation(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Provide your response or explanation regarding the query..."
                  />
                </div>

                <button
                  onClick={() => {
                    if (responseExplanation.trim()) {
                      onUpdateStatus(
                        req.id,
                        'PENDING',
                        `Requester revised request details`,
                        {
                          title: revisedTitle.trim() || req.title,
                          amount: parseInt(revisedAmount, 10) || req.amount,
                          description: revisedDescription.trim() || req.description,
                          query: undefined
                        }
                      );
                      setActionSuccessMsg('Your revised request and clarification were resubmitted back to the queue.');
                      setResponseExplanation('');
                    }
                  }}
                  disabled={!responseExplanation.trim()}
                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition shadow-xs cursor-pointer"
                >
                  Submit Revision & Resubmit to Queue
                </button>
              </div>
            )}

            {/* MANAGER ACTION CENTER: Route to HR, IT, or Finance */}
            {user.role === 'MANAGER' && req.currentStage === 'MANAGER' && req.status === 'PENDING' && (
              <div className="space-y-4 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
                <div className="mb-2">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    👉 Manager Branch Routing Decision:
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select which department branch to route this request to (HR, IT, or Finance Head):
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedBranch('HR')}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                      selectedBranch === 'HR'
                        ? 'bg-pink-50 border-pink-500 text-pink-900 ring-2 ring-pink-400/30'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold">🏢 HR Department</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Routes to HR Head</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedBranch('IT')}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                      selectedBranch === 'IT'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-400/30'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold">💻 IT Department</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Routes to IT Head</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedBranch('FINANCE')}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                      selectedBranch === 'FINANCE'
                        ? 'bg-yellow-50 border-yellow-500 text-yellow-900 ring-2 ring-yellow-400/30'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold">💰 Finance Directorate</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Routes to Finance Head first</p>
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      const nextStage: ApprovalStage = selectedBranch === 'HR'
                        ? 'HR'
                        : selectedBranch === 'IT'
                        ? 'IT'
                        : 'FINANCE';

                      const targetName = selectedBranch === 'HR'
                        ? 'HR Head'
                        : selectedBranch === 'IT'
                        ? 'IT Head'
                        : 'Finance Head';

                      onAdvanceStage(
                        req.id,
                        nextStage,
                        `Manager verified request and routed to ${targetName}`
                      );
                      setActionSuccessMsg(`✓ Request successfully approved and routed to ${targetName}! It is now in their queue.`);
                    }}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <Icon name="check" className="w-4 h-4" />
                    Approve & Route to {selectedBranch === 'FINANCE' ? 'Finance Head' : selectedBranch}
                  </button>

                  <button
                    onClick={() => {
                      onUpdateStatus(
                        req.id,
                        'REJECTED',
                        `Request rejected by Line Manager`
                      );
                      setActionSuccessMsg('Request was rejected.');
                    }}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <Icon name="x" className="w-4 h-4" />
                    Reject
                  </button>
                </div>

                {/* Manager Query Form */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">
                    Request Clarification from Requester
                  </p>
                  <textarea
                    rows={2}
                    value={queryText}
                    onChange={e => setQueryText(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white"
                    placeholder="Ask requester for details before routing..."
                  />
                  <button
                    onClick={() => {
                      if (queryText.trim()) {
                        onUpdateStatus(
                          req.id,
                          'QUERIED',
                          `Clarification query initiated`,
                          { query: queryText.trim() }
                        );
                        setActionSuccessMsg('Query sent to requester.');
                        setQueryText('');
                      }
                    }}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                  >
                    Send Query
                  </button>
                </div>
              </div>
            )}

            {/* OTHER APPROVERS (FINANCE, ACCOUNTANT, HR, IT, GM, CEO) */}
            {isMyTurnToApprove && user.role !== 'MANAGER' && (
              <div className="space-y-4">
                <div className="flex gap-3 flex-wrap">
                  {/* Approve & Advance Button */}
                  <button
                    onClick={() => {
                      const next = getNextStage(req.category, req.currentStage);
                      if (next === 'COMPLETED' || user.role === 'CEO') {
                        onUpdateStatus(
                          req.id,
                          'APPROVED',
                          `Final approval granted by ${user.name} (${getRoleDisplayName(user.role)})`,
                          { currentStage: 'COMPLETED' }
                        );
                        setActionSuccessMsg(`✓ Final Approval granted by CEO! Request is completed.`);
                      } else {
                        onAdvanceStage(
                          req.id,
                          next,
                          `Approved by ${user.name} (${getRoleDisplayName(user.role)}) → Forwarded to ${getRoleDisplayName(next)}`
                        );
                        setActionSuccessMsg(`✓ Request approved and successfully forwarded to ${getRoleDisplayName(next)}!`);
                      }
                    }}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <Icon name="check" className="w-4 h-4" />
                    {user.role === 'CEO' || getNextStage(req.category, req.currentStage) === 'COMPLETED'
                      ? 'Grant Final Approval'
                      : `Approve & Forward to ${getRoleDisplayName(getNextStage(req.category, req.currentStage))}`}
                  </button>

                  <button
                    onClick={() => {
                      onUpdateStatus(
                        req.id,
                        'REJECTED',
                        `Request rejected by ${user.name} (${getRoleDisplayName(user.role)})`
                      );
                      setActionSuccessMsg(`Request was rejected.`);
                    }}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <Icon name="x" className="w-4 h-4" />
                    Reject
                  </button>
                </div>

                {/* Query Form */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">
                    Request Clarification or Additional Proof
                  </p>
                  <textarea
                    rows={2}
                    value={queryText}
                    onChange={e => setQueryText(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    placeholder="Ask for clarification..."
                  />
                  <button
                    onClick={() => {
                      if (queryText.trim()) {
                        onUpdateStatus(
                          req.id,
                          'QUERIED',
                          `Clarification query initiated`,
                          { query: queryText.trim() }
                        );
                        setActionSuccessMsg('Query sent.');
                        setQueryText('');
                      }
                    }}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                  >
                    Send Query
                  </button>
                </div>
              </div>
            )}

            {/* Informative message when viewing request currently at another role's stage */}
            {!isMyTurnToApprove && !actionSuccessMsg && req.status === 'PENDING' && (
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900 flex items-center gap-2">
                <span className="text-base">📍</span>
                <span>
                  This request is currently in the <strong>{getRoleDisplayName(req.currentStage)}</strong> stage, handled by <strong>{getStageActorName(req.currentStage)}</strong>.
                </span>
              </div>
            )}

            {(req.status === 'APPROVED' || req.status === 'REJECTED') && (
              <div
                className={`rounded-lg px-4 py-3 text-xs font-medium ${
                  req.status === 'APPROVED'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                ✓ This request is <strong>{req.status.toLowerCase()}</strong> and closed. No further action required.
              </div>
            )}
          </div>

          {/* Audit Trail (Clean Public Audit Trail with Higher Role Queries Hidden) */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-6 py-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Procedural Approval Audit Trail
            </p>
            <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
              {publicAuditTrail.map((entry, i) => (
                <div key={i} className="flex gap-4 pl-6 relative">
                  <span className="absolute left-0 top-1.5 w-[9px] h-[9px] rounded-full bg-blue-500 border-2 border-white ring-1 ring-blue-200" />
                  <div>
                    <p className="text-xs font-medium text-slate-800">{entry.action}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {entry.ts} · <span className="text-blue-600 font-semibold">{entry.actor}</span>
                    </p>
                  </div>
                </div>
              ))}
              {publicAuditTrail.length === 0 && (
                <p className="text-xs text-slate-400 italic pl-6">No procedural audit records yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center text-slate-400 flex-col gap-3">
          <Icon name="requests" className="w-12 h-12 text-slate-200" />
          <p className="text-sm">Select a request from the queue to review and track stages</p>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {viewingDocument && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-xs font-bold tracking-wider">
                  DOC
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-100">{viewingDocument.name}</p>
                  <p className="text-[10px] text-slate-400">{viewingDocument.size} · Official Company Attachment</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded-md flex items-center gap-1 transition cursor-pointer"
                >
                  Print / Download
                </button>
                <button
                  onClick={() => setViewingDocument(null)}
                  className="bg-slate-700 hover:bg-red-600 text-slate-200 hover:text-white p-1.5 rounded-md transition cursor-pointer"
                >
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-100 p-6 flex justify-center">
              <div className="bg-white border border-slate-200 shadow-md rounded-lg w-full p-8 text-slate-800 font-sans">
                <div className="border-b-2 border-blue-600 pb-4 mb-5 flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 uppercase">
                      SMART APPROVAL SYSTEM — SUPPORTING PROOF
                    </h3>
                    <p className="text-xs text-blue-600 font-semibold mt-0.5">
                      Verified Attachment for Multi-Tier Approval Review
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <span className="bg-green-50 text-green-700 border border-green-200 font-semibold px-2 py-0.5 rounded text-[11px]">
                      ✓ Security Scanned
                    </span>
                  </div>
                </div>

                <div className="space-y-4 text-xs leading-relaxed text-slate-700">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                    <p className="font-semibold text-slate-800 mb-1">Document Metadata:</p>
                    <p className="text-slate-600"><strong>File Name:</strong> {viewingDocument.name}</p>
                    <p className="text-slate-600"><strong>File Size:</strong> {viewingDocument.size}</p>
                    <p className="text-slate-600"><strong>Format:</strong> {viewingDocument.type} Document</p>
                  </div>

                  <div className="border border-slate-100 rounded-lg p-4 bg-white text-center py-10">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                      <Icon name="requests" className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-800 text-sm">{viewingDocument.name}</p>
                    <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                      Contains itemized vendor quotes, budgetary breakdown, and technical requisitions for review by Manager, Finance Head, Accountant, GM, and CEO.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-end">
              <button
                onClick={() => setViewingDocument(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
