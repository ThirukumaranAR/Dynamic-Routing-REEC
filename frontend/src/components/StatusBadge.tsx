import React from 'react';
import { RequestStatus } from '../services/types';

export const statusConfig: Record<RequestStatus, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  APPROVED: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  QUERIED: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  ESCALATED: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

export const StatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
  const config = statusConfig[status] || statusConfig.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
};
