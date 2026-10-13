import React, { useState } from 'react';
import { ApprovalRequest } from '../services/types';
import { StatusBadge } from '../components/StatusBadge';

interface FlaggedRequestsViewProps {
  requests: ApprovalRequest[];
  onOpenRequest: (request: ApprovalRequest) => void;
  onSetFlag: (requestId: string, flagged: boolean) => Promise<void>;
}

export const FlaggedRequestsView: React.FC<FlaggedRequestsViewProps> = ({ requests, onOpenRequest, onSetFlag }) => {
  const [mode, setMode] = useState<'active' | 'all'>('active');
  const [error, setError] = useState('');
  const flags = requests.filter(request => request.flagged || request.status === 'ESCALATED' || request.businessHoursIdle >= 6);
  const visible = mode === 'active' ? flags.filter(request => request.flagged || request.status === 'ESCALATED' || request.businessHoursIdle >= 6) : flags;

  const toggleFlag = async (request: ApprovalRequest) => {
    setError('');
    try {
      await onSetFlag(request.id, !request.flagged);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Flag update failed.');
    }
  };

  return (
    <div className="w-full px-6 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Flagged Requests</h1>
        <p className="mt-1 text-sm text-slate-500">Review escalated, overdue, and manually flagged requests.</p>
      </header>
      {error && <p role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setMode('active')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === 'active' ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>Active Flags</button>
        <button onClick={() => setMode('all')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === 'all' ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>All Flags</button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-7 gap-2 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span>Request</span><span>Stage</span><span>Department</span><span>Idle hours</span><span>Flag date</span><span>Status</span><span>Actions</span>
        </div>
        {visible.map(request => (
          <div key={request.id} className="grid grid-cols-7 items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-700">
            <button type="button" onClick={() => onOpenRequest(request)} className="text-left font-semibold text-blue-700 hover:underline">{request.id} · {request.title}</button>
            <span>{request.currentStage}</span><span>{request.department}</span><span>{request.businessHoursIdle}h</span><span>{request.flaggedAt || request.date}</span><span><StatusBadge status={request.status} /></span>
            <button type="button" onClick={() => void toggleFlag(request)} className="justify-self-start rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              {request.flagged ? 'Clear flag' : 'Flag'}
            </button>
          </div>
        ))}
        {visible.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No flagged requests.</p>}
      </div>
    </div>
  );
};