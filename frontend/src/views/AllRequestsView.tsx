import React, { useState, useEffect } from 'react';
import {
  User,
  ApprovalRequest,
  RequestStatus,
  RequestAttachment,
  WorkflowBranch,
  PostDeanBranch,
  POST_DEAN_BRANCHES,
  STANDARD_ROLES
} from '../services/types';
import { canViewActiveQuery, formatCurrencyINR, getRoleDisplayName, getStageActorName } from '../services/api';
import { getNextWorkflowRole } from '../services/workflowEngine';
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
    extra?: Partial<ApprovalRequest> & { queryResponse?: string }
  ) => Promise<void>;
  onApproveStep: (requestId: string, higherAuthorityOverride?: boolean) => Promise<void>;
  onRouteToBranch: (requestId: string, branch: WorkflowBranch) => Promise<void>;
  onMigrateWorkflow?: (requestId: string, reason: string, replacementRole?: string, targetVersionId?: string) => Promise<void>;
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
  onApproveStep,
  onRouteToBranch,
  onMigrateWorkflow
}) => {
  const [queryText, setQueryText] = useState('');
  const [revisedTitle, setRevisedTitle] = useState('');
  const [revisedAmount, setRevisedAmount] = useState('');
  const [revisedDescription, setRevisedDescription] = useState('');
  const [responseExplanation, setResponseExplanation] = useState('');
  const [viewingDocument, setViewingDocument] = useState<RequestAttachment | null>(null);

  // Post-Dean Branch selection state (IT, Audit, HR, MMI)
  const [selectedBranch, setSelectedBranch] = useState<PostDeanBranch>('HR');

  // CEO Workflow Migration Modal State
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);
  const [migrationReason, setMigrationReason] = useState('');
  const [migrationRole, setMigrationRole] = useState('GENERAL_MANAGER');
  const [migrationConfirmed, setMigrationConfirmed] = useState(false);

  // Success Feedback Message on Action
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');
  const [actionErrorMsg, setActionErrorMsg] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  const runAction = async (operation: () => Promise<void>, successMessage: string) => {
    setActionLoading(true);
    setActionErrorMsg('');
    setActionSuccessMsg('');
    try {
      await operation();
      setActionSuccessMsg(successMessage);
    } catch (error) {
      setActionErrorMsg(error instanceof Error ? error.message : 'The request action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRequest) {
      setRevisedTitle(selectedRequest.title);
      setRevisedAmount(selectedRequest.amount.toString());
      setRevisedDescription(selectedRequest.description);
      setResponseExplanation('');
      setActionSuccessMsg('');

      if (selectedRequest.selectedBranch && (POST_DEAN_BRANCHES as readonly string[]).includes(selectedRequest.selectedBranch)) {
        setSelectedBranch(selectedRequest.selectedBranch as PostDeanBranch);
      } else {
        setSelectedBranch('HR');
      }
    }
  }, [selectedRequest]);

  const visibleRequests = requests.filter(request =>
    canViewActiveQuery(request, user) &&
    (user.role !== 'REQUESTER' || (request.requesterId
      ? request.requesterId === user.id
      : request.requesterEmail
      ? request.requesterEmail.toLowerCase() === user.email.toLowerCase()
      : request.requester === user.name))
  );

  const filteredRequests = statusFilter === 'ALL'
    ? visibleRequests
    : visibleRequests.filter(r => r.status === statusFilter);

  const req = selectedRequest && canViewActiveQuery(selectedRequest, user) ? selectedRequest : null;

  const isHigherAuthority = user.role === 'CEO' || user.role === 'CHAIRMAN' || user.role === 'DEAN';
  const isMyTurnToApprove = req && req.status === 'PENDING' && req.currentStage === user.role;
  const canReviewEscalated = req?.status === 'ESCALATED' && (user.role === 'CEO' || user.role === 'CHAIRMAN');
  const canReviewDelayed = req?.status === 'PENDING' && req.businessHoursIdle >= 6 && isHigherAuthority;
  const canReviewCeoStep = req?.status === 'PENDING' && req.currentStage === 'CEO' && user.role === 'CHAIRMAN';
  const canRouteBranch = req && req.status === 'PENDING' && (user.role === 'DEAN' || user.role === 'INSTITUTION_MANAGER' || isHigherAuthority);

  const publicAuditTrail = req?.auditTrail.filter(entry => {
    const act = entry.action.toLowerCase();
    return !act.includes('query raised') && !act.includes('clarification response') && !act.includes('query:');
  }) || [];

  const handleMigrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!req || !onMigrateWorkflow) return;
    if (!migrationReason.trim()) {
      setActionErrorMsg('A reason is required to migrate the request workflow.');
      return;
    }
    if (!migrationConfirmed) {
      setActionErrorMsg('Please confirm the migration before proceeding.');
      return;
    }

    await runAction(async () => {
      await onMigrateWorkflow(req.id, migrationReason.trim(), migrationRole);
      setMigrationModalOpen(false);
      setMigrationReason('');
      setMigrationConfirmed(false);
    }, `Successfully migrated workflow: pending stage transitioned to ${getRoleDisplayName(migrationRole)}.`);
  };

  return (
    <div className="flex h-full">
      {/* Left List Column */}
      <div
        className={`${
          selectedRequest ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-96 border-r border-slate-100 flex-col bg-white flex-shrink-0 h-full overflow-hidden`}
      >
        {/* Filter Pills */}
        <div className="p-3 border-b border-slate-100 bg-white">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {statusFilters.map(filter => {
              const count = filter === 'ALL'
                ? visibleRequests.length
                : visibleRequests.filter(r => r.status === filter).length;
              const isActive = statusFilter === filter;

              return (
                <button
                  key={filter}
                  onClick={() => onFilterChange(filter)}
                  className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition cursor-pointer flex items-center gap-1 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{filter}</span>
                  <span
                    className={`text-[10px] rounded-full px-1.5 py-0.2 ${
                      isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Requests Feed */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredRequests.map(r => {
            const isSelected = selectedRequest?.id === r.id;
            const isActionNeededByMe = r.status === 'PENDING' && r.currentStage === user.role;
            const is6hSlaBreached = r.businessHoursIdle >= 6;

            return (
              <button
                key={r.id}
                onClick={() => onSelectRequest(r)}
                className={`w-full text-left p-4 transition cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70 border-l-4 border-blue-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-800 line-clamp-1">
                    {r.title}
                  </p>
                  <StatusBadge status={r.status} />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap my-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    r.status === 'APPROVED'
                      ? 'bg-green-100 text-green-800'
                      : r.status === 'REJECTED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  }`}>
                    📍 Stage: {getRoleDisplayName(r.currentStage)}
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

          {/* ACTIVE STAGE & HANDLER BANNER */}
          <div className="mb-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-lg flex-shrink-0">
                📍
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">
                  CURRENT APPROVAL STAGE · WORKFLOW v{req.workflowVersionNumber || 1}
                </p>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {getRoleDisplayName(req.currentStage)}
                </h3>
                <p className="text-xs text-blue-100">
                  Currently Handled by: <strong>{getStageActorName(req.currentStage)}</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {req.selectedBranch && (
                <span className="rounded bg-amber-500/20 border border-amber-300 text-amber-200 px-2.5 py-1 text-xs font-bold">
                  Branch: {req.selectedBranch}
                </span>
              )}
              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                req.status === 'APPROVED' ? 'bg-green-500 text-white' : req.status === 'REJECTED' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                STATUS: {req.status}
              </span>
            </div>
          </div>

          {/* CEO Governance & Request Workflow View (PART E) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏛️ Request Workflow History & Sequence</span>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                    Version v{req.workflowVersionNumber || 1}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Immutable captured sequence for this request. Historical decisions remain intact.
                </p>
              </div>

              {/* CEO Migration Trigger (PART E & F) */}
              {(user.role === 'CEO' || user.role === 'CHAIRMAN') && req.status === 'PENDING' && onMigrateWorkflow && (
                <button
                  type="button"
                  onClick={() => setMigrationModalOpen(true)}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <span>👑 Modify / Migrate Remaining Stages</span>
                </button>
              )}
            </div>

            {/* Stages Tracker */}
            <div className="flex flex-wrap items-center gap-2 py-1">
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <span>✓ Requester (Submitted)</span>
              </div>
              <span className="text-slate-300 font-bold">→</span>

              {req.stages && req.stages.length > 0 ? (
                req.stages.map((stg, sIdx) => {
                  let badgeClass = 'border-slate-200 bg-slate-50 text-slate-500';
                  let icon = '⏳';
                  let statusText = '';

                  if (stg.status === 'COMPLETED') {
                    badgeClass = 'border-emerald-200 bg-emerald-50 text-emerald-800 font-bold';
                    icon = '✓';
                    statusText = stg.decidedByName ? `(${stg.decidedByName})` : '';
                  } else if (stg.status === 'PENDING') {
                    badgeClass = 'border-blue-500 bg-blue-50 text-blue-800 font-bold ring-2 ring-blue-300';
                    icon = '📍 Active:';
                  } else if (stg.status === 'SUPERSEDED') {
                    badgeClass = 'border-purple-200 bg-purple-50 text-purple-700 line-through';
                    icon = '⚠️ Superseded:';
                  } else if (stg.status === 'SKIPPED') {
                    badgeClass = 'border-slate-200 bg-slate-100 text-slate-400 line-through';
                    icon = '⊘ Skipped:';
                  } else if (stg.status === 'REJECTED') {
                    badgeClass = 'border-red-200 bg-red-50 text-red-800 font-bold';
                    icon = '✕ Rejected:';
                  }

                  return (
                    <React.Fragment key={stg.id || sIdx}>
                      <div className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs ${badgeClass}`}>
                        <span>{icon} {stg.label}</span>
                        {statusText && <span className="text-[10px] text-emerald-700">{statusText}</span>}
                      </div>
                      {sIdx < req.stages!.length - 1 && (
                        <span className="text-slate-300 font-bold">→</span>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <span className="text-xs text-slate-500">Standard Sequential Progression</span>
              )}
            </div>

            {/* Past Migration Events Log */}
            {req.migrationEvents && req.migrationEvents.length > 0 && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 text-xs space-y-1">
                <p className="font-bold text-purple-900">Recorded Workflow Migration Events:</p>
                {req.migrationEvents.map(evt => (
                  <p key={evt.id} className="text-purple-800">
                    • <strong>{evt.actorName} ({evt.actorRole})</strong> migrated workflow from v{evt.previousWorkflowVersion} to v{evt.newWorkflowVersion} on {new Date(evt.ts).toLocaleString()} — Reason: "{evt.reason}"
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Action Center with Strict Role-Stage Lock & Post-Dean Branch Controls */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-6 py-5 mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Action Center ({getRoleDisplayName(user.role)})
            </p>

            {/* Success Message Banner */}
            {actionSuccessMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-center gap-3 text-green-800">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="check" className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-green-900 uppercase tracking-wide">
                    Action Completed Successfully!
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">{actionSuccessMsg}</p>
                </div>
              </div>
            )}
            {actionErrorMsg && (
              <div role="alert" className="mb-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-xs text-red-800">
                {actionErrorMsg}
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
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Revised Title</label>
                    <input
                      type="text"
                      value={revisedTitle}
                      onChange={e => setRevisedTitle(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Revised Amount (INR)</label>
                    <input
                      type="number"
                      value={revisedAmount}
                      onChange={e => setRevisedAmount(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Clarification Response Message <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={responseExplanation}
                    onChange={e => setResponseExplanation(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 resize-none"
                    placeholder="Provide your response or explanation regarding the query..."
                  />
                </div>

                <button
                  disabled={!responseExplanation.trim() || actionLoading}
                  onClick={() => void runAction(async () => {
                    await onUpdateStatus(req.id, 'PENDING', 'Requester revised request details', {
                      title: revisedTitle.trim() || req.title,
                      amount: parseInt(revisedAmount, 10) || req.amount,
                      description: revisedDescription.trim() || req.description,
                      queryResponse: responseExplanation.trim()
                    });
                    setResponseExplanation('');
                  }, 'Your revision and query response were saved to the approval queue.')}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition"
                >
                  Submit Revision & Resubmit to Queue
                </button>
              </div>
            )}

            {/* POST-DEAN BRANCH SELECTION / ROUTING (Dean, Manager, Authority) */}
            {canRouteBranch && (req.currentStage === 'DEAN' || req.currentStage === 'INSTITUTION_MANAGER' || req.currentStage === 'MANAGER') && (
              <div className="space-y-4 bg-blue-50/40 p-4 rounded-xl border border-blue-100 mb-4">
                <div>
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    👉 Post-Dean Branch Destination Selection:
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select which post-Dean branch destination will process this request before continuing to CEO and Chairman:
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {POST_DEAN_BRANCHES.map(br => {
                    const isSelected = selectedBranch === br;
                    return (
                      <button
                        key={br}
                        type="button"
                        onClick={() => setSelectedBranch(br)}
                        className={`p-3 rounded-lg border text-left transition ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-400/30 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-xs font-bold">{br} Branch</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Routes to {br} Head</p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => void runAction(async () => {
                      await onRouteToBranch(req.id, selectedBranch);
                    }, `Request routed to ${selectedBranch} Branch.`)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition shadow-xs"
                  >
                    <Icon name="check" className="w-4 h-4" />
                    Confirm & Route to {selectedBranch} Branch
                  </button>
                </div>
              </div>
            )}

            {/* REGULAR APPROVAL BUTTONS */}
            {(isMyTurnToApprove || canReviewEscalated || canReviewDelayed || canReviewCeoStep) && (
              <div className="space-y-4">
                <div className="flex gap-3 flex-wrap">
                  <button
                    disabled={actionLoading}
                    onClick={() => void runAction(async () => {
                      await onApproveStep(req.id, !isMyTurnToApprove);
                    }, canReviewEscalated || user.role === 'CHAIRMAN' || !getNextWorkflowRole(req)
                      ? 'Final approval granted. Request is completed.'
                      : `Request approved and forwarded to ${getRoleDisplayName(getNextWorkflowRole(req) || '')}.`)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-xs"
                  >
                    <Icon name="check" className="w-4 h-4" />
                    {user.role === 'CHAIRMAN' || canReviewEscalated || !getNextWorkflowRole(req)
                      ? 'Grant Final Approval'
                      : `Approve & Forward to ${getRoleDisplayName(getNextWorkflowRole(req) || '')}`}
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={() => void runAction(() => onUpdateStatus(
                      req.id,
                      'REJECTED',
                      `Request rejected by ${user.name} (${getRoleDisplayName(user.role)})`
                    ), 'Request was rejected.')}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-xs"
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
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 resize-none"
                    placeholder="Ask for clarification from requester..."
                  />
                  <button
                    disabled={!queryText.trim() || actionLoading}
                    onClick={() => void runAction(async () => {
                      await onUpdateStatus(req.id, 'QUERIED', 'Clarification query initiated', {
                        query: queryText.trim(),
                        queryRaisedByUserId: user.id || user.email,
                        queryRaisedByName: user.name
                      });
                      setQueryText('');
                    }, 'Query sent to the requester.')}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                  >
                    Send Query
                  </button>
                </div>
              </div>
            )}

            {!isMyTurnToApprove && !actionSuccessMsg && req.status === 'PENDING' && !canRouteBranch && (
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900 flex items-center gap-2">
                <span className="text-base">📍</span>
                <span>
                  This request is currently in the <strong>{getRoleDisplayName(req.currentStage)}</strong> stage, handled by <strong>{getStageActorName(req.currentStage)}</strong>.
                </span>
              </div>
            )}
          </div>

          {/* Request Details & Description Card */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Request Details</h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{req.description}</p>
            {req.purpose && req.purpose !== req.description && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Purpose / Objective</p>
                <p className="text-sm text-slate-700 mt-0.5">{req.purpose}</p>
              </div>
            )}
          </div>

          {/* Attachments */}
          {req.attachments && req.attachments.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Attachments ({req.attachments.length})</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {req.attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{att.name}</p>
                      <p className="text-slate-400">{att.size} · {att.type}</p>
                    </div>
                    {att.dataUrl && (
                      <button
                        type="button"
                        onClick={() => setViewingDocument(att)}
                        className="text-blue-600 hover:text-blue-800 font-bold"
                      >
                        Preview
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Audit Trail */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Audit Log & Event Trail</h3>
            <ol className="relative border-l border-slate-200 pl-4 space-y-3 text-xs">
              {publicAuditTrail.map((entry, idx) => (
                <li key={idx} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{entry.actor}</span>
                    <span className="text-slate-400">{new Date(entry.ts).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-600">{entry.action}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-slate-400 text-sm">
          Select a request from the list to view its complete workflow details.
        </div>
      )}

      {/* CEO Workflow Migration Modal (PART E & F) */}
      {migrationModalOpen && req && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Migrate Request Workflow</h3>
                <p className="text-xs text-slate-500">
                  Update remaining processing stages for Request <strong>{req.id}</strong> without altering historical approvals.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMigrationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMigrationSubmit} className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-200">
                <p className="font-semibold text-slate-800">Migration Safety Rules:</p>
                <p className="text-slate-600">• Completed stages up to current position remain permanently completed.</p>
                <p className="text-slate-600">• Current pending stage (<strong>{getRoleDisplayName(req.currentStage)}</strong>) will be marked as SUPERSEDED (not approved).</p>
                <p className="text-slate-600">• The selected replacement role will become the new active pending stage.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Replacement / Next Approval Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={migrationRole}
                  onChange={e => setMigrationRole(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="GENERAL_MANAGER">General Manager (GENERAL_MANAGER)</option>
                  {STANDARD_ROLES.filter(r => r.name !== 'REQUESTER' && r.name !== 'CHAIRMAN').map(r => (
                    <option key={r.name} value={r.name}>
                      {r.displayName} ({r.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Administrative Reason / Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={migrationReason}
                  onChange={e => setMigrationReason(e.target.value)}
                  placeholder="e.g. Accountant role superseded by new corporate workflow v2; transitioning pending stage to General Manager."
                  className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={migrationConfirmed}
                  onChange={e => setMigrationConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>
                  I confirm that I am authorized as CEO/Chairman to reassign this request's pending workflow and record this transition in the audit history.
                </span>
              </label>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMigrationModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!migrationReason.trim() || !migrationConfirmed || actionLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Migrating…' : 'Execute Workflow Migration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {viewingDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">{viewingDocument.name}</h3>
              <button
                type="button"
                onClick={() => setViewingDocument(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕ Close
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {viewingDocument.dataUrl?.startsWith('data:image/') ? (
                <img src={viewingDocument.dataUrl} alt={viewingDocument.name} className="max-w-full rounded" />
              ) : (
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{viewingDocument.dataUrl}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
