import React from 'react';
import { User, ApprovalRequest } from '../services/types';
import { formatCurrencyINR } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

interface QueriesViewProps {
  user: User;
  requests: ApprovalRequest[];
  onOpenRequest: (request: ApprovalRequest) => void;
}

export const QueriesView: React.FC<QueriesViewProps> = ({
  user,
  requests,
  onOpenRequest
}) => {
  const allQueries = user.role === 'REQUESTER'
    ? requests.filter(r => r.requester === user.name && r.status === 'QUERIED')
    : requests.filter(r => r.status === 'QUERIED');
  const [mode, setMode] = React.useState<'all' | 'mine'>('all');
  const visibleQueries = mode === 'mine' ? allQueries.filter(request => request.currentStage === user.role || request.requester === user.name) : allQueries;

  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Queries</h1>
        <p className="text-sm text-slate-400">
          Requests requiring additional documentation, quote verification, or explanations.
        </p>
      </div>

      {user.role === 'CEO' && <div className="flex gap-2 mb-4"><button onClick={() => setMode('all')} className={`px-3 py-2 rounded-lg text-xs font-semibold ${mode === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>All Queries</button><button onClick={() => setMode('mine')} className={`px-3 py-2 rounded-lg text-xs font-semibold ${mode === 'mine' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>My Queries</button></div>}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {visibleQueries.map((req, idx) => (
          <button
            key={req.id}
            onClick={() => onOpenRequest(req)}
            className={`w-full text-left flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition cursor-pointer ${
              idx === 0 ? '' : 'border-t border-slate-100'
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-blue-600">{req.title}</p>
              <p className="text-xs text-slate-600 mt-1">
                💬 Query: <em>"{req.query}"</em>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {req.department} · {formatCurrencyINR(req.amount)} · {req.date} · Stage: {req.currentStage}
              </p>
            </div>
            <StatusBadge status={req.status} />
          </button>
        ))}

        {visibleQueries.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">
            No active queries pending in your queue.
          </div>
        )}
      </div>
    </div>
  );
};
