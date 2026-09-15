import React from 'react';
import { Icon } from './Icons';

interface MetricCardProps {
  icon: 'total' | 'clock' | 'check' | 'warning' | 'chat' | 'doc';
  iconBg: string;
  iconColor: string;
  label: string;
  value: number | string;
  desc: string;
  onClick: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  desc,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-left hover:shadow-md hover:border-slate-200 transition group w-full"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${iconBg}`}>
        <Icon name={icon} className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mb-0.5">{value}</p>
      <p className="text-[11px] text-slate-400 mb-2 leading-tight line-clamp-1">{desc}</p>
      <span className="text-[11px] text-blue-600 font-medium group-hover:underline flex items-center gap-0.5">
        View <Icon name="chevron" className="w-2.5 h-2.5" />
      </span>
    </button>
  );
};
