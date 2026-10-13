import React from 'react';

export const FlowCategoriesView: React.FC = () => {
  const institutionalSequence = [
    { role: 'REQUESTER', label: 'Requester', tag: 'Origin', color: 'bg-slate-100 text-slate-700 border-slate-300' },
    { role: 'INSTITUTION_MANAGER', label: 'Institution Manager', tag: 'Step 1', color: 'bg-blue-50 text-blue-800 border-blue-200' },
    { role: 'FINANCE', label: 'Finance Head', tag: 'Step 2', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { role: 'ACCOUNTANT', label: 'Accountant', tag: 'Step 3', color: 'bg-teal-50 text-teal-800 border-teal-200' },
    { role: 'VP', label: 'Vice President', tag: 'Step 4', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    { role: 'HOI', label: 'Head of Institution', tag: 'Step 5', color: 'bg-sky-50 text-sky-800 border-sky-200' },
    { role: 'DEAN', label: 'Dean Checkpoint', tag: 'Step 6', color: 'bg-violet-50 text-violet-800 border-violet-200' },
    { role: 'BRANCH', label: 'IT | Audit | HR | MMI', tag: 'Branch Alt', color: 'bg-amber-50 text-amber-900 border-amber-300 font-bold ring-1 ring-amber-200' },
    { role: 'CEO', label: 'CEO', tag: 'Step 8', color: 'bg-purple-50 text-purple-800 border-purple-200' },
    { role: 'CHAIRMAN', label: 'Chairman (Final Authority)', tag: 'Final Step', color: 'bg-rose-50 text-rose-800 border-rose-300 font-bold' }
  ];

  const categoryWorkflows = [
    {
      tag: 'HR BRANCH',
      categoryTitle: 'People & Personnel',
      selectedBranch: 'HR Branch Head',
      badgeColor: 'bg-pink-100 text-pink-800 border-pink-200',
      branchPillColor: 'bg-pink-50 text-pink-800 border-pink-300 font-bold',
      includes: ['Leave', 'Permission', 'Onboarding', 'Personnel Requests'],
      flow: [
        'Requester',
        'Institution Manager',
        'Finance',
        'Accountant',
        'VP',
        'HOI',
        'Dean',
        'HR Branch Head',
        'CEO',
        'Chairman'
      ]
    },
    {
      tag: 'AUDIT BRANCH',
      categoryTitle: 'Purchases & Fiscal Audit',
      selectedBranch: 'Audit Branch Head',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-200',
      branchPillColor: 'bg-amber-50 text-amber-900 border-amber-300 font-bold',
      includes: ['Purchase', 'Reimbursement', 'Vendor Payment', 'Fiscal Audit'],
      flow: [
        'Requester',
        'Institution Manager',
        'Finance',
        'Accountant',
        'VP',
        'HOI',
        'Dean',
        'Audit Branch Head',
        'CEO',
        'Chairman'
      ]
    },
    {
      tag: 'IT BRANCH',
      categoryTitle: 'Technology & Equipment',
      selectedBranch: 'IT Branch Head',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      branchPillColor: 'bg-blue-50 text-blue-800 border-blue-300 font-bold',
      includes: ['Equipment', 'Work From Home', 'Software & Licenses', 'IT Access & Systems'],
      flow: [
        'Requester',
        'Institution Manager',
        'Finance',
        'Accountant',
        'VP',
        'HOI',
        'Dean',
        'IT Branch Head',
        'CEO',
        'Chairman'
      ]
    },
    {
      tag: 'MMI BRANCH',
      categoryTitle: 'Infrastructure & Operations',
      selectedBranch: 'MMI Branch Head',
      badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-200',
      branchPillColor: 'bg-cyan-50 text-cyan-900 border-cyan-300 font-bold',
      includes: ['Maintenance', 'Facilities', 'Infrastructure', 'Travel', 'General / Other'],
      flow: [
        'Requester',
        'Institution Manager',
        'Finance',
        'Accountant',
        'VP',
        'HOI',
        'Dean',
        'MMI Branch Head',
        'CEO',
        'Chairman'
      ]
    }
  ];

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
            Institutional Workflow Matrix
          </span>
          <span className="text-xs text-slate-400">Strict Single-Branch Routing</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Flow Categories & Approval Order</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl">
          All requests follow the unified institutional hierarchy. After Dean clearance, exactly <strong>ONE</strong> alternative branch (IT, Audit, HR, or MMI) is selected. The CEO conducts executive review followed by final approval from the Chairman.
        </p>
      </div>

      {/* Primary Global Institutional Workflow Sequence Banner */}
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <p className="text-[11px] font-extrabold text-blue-700 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              MANDATORY INSTITUTIONAL APPROVAL SEQUENCE
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Dean routes to exactly one specialized branch alternative. Chairman holds terminal final authority.
            </p>
          </div>
          <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs">
            10-Stage Hierarchy (9 Approval Stages)
          </span>
        </div>

        {/* Workflow Pills Chain */}
        <div className="flex flex-wrap items-center gap-2">
          {institutionalSequence.map((stage, idx, list) => (
            <React.Fragment key={stage.role}>
              <div className={`px-3 py-1.5 rounded-xl text-xs border shadow-2xs flex items-center gap-1.5 ${stage.color}`}>
                <span className="text-[9px] font-bold opacity-70 tracking-wider uppercase">{stage.tag}:</span>
                <span className="font-bold">{stage.label}</span>
              </div>
              {idx < list.length - 1 && (
                <span className="text-blue-400 font-bold text-xs select-none">→</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Rule Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 pt-4 border-t border-blue-200/60 text-xs">
          <div className="flex items-start gap-2 text-slate-700">
            <span className="text-blue-600 font-bold text-sm">✓</span>
            <div>
              <strong className="text-slate-900 block text-[11px]">Strict Finance & Accountant Order</strong>
              <span className="text-[11px] text-slate-500">Finance verified first at Step 2, followed immediately by Accountant ledger check at Step 3.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-slate-700">
            <span className="text-amber-600 font-bold text-sm">✓</span>
            <div>
              <strong className="text-slate-900 block text-[11px]">Alternative Branch Selection</strong>
              <span className="text-[11px] text-slate-500">IT, Audit, HR, and MMI are mutually exclusive alternative branches, never consecutive stages.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-slate-700">
            <span className="text-purple-600 font-bold text-sm">✓</span>
            <div>
              <strong className="text-slate-900 block text-[11px]">Terminal Chairman Authority</strong>
              <span className="text-[11px] text-slate-500">CEO provides executive clearance post-branch; Chairman executes terminal approval for all requests.</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categoryWorkflows.map(workflow => (
          <div
            key={workflow.tag}
            className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-sm transition space-y-4"
          >
            {/* Header: Tag & Branch */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${workflow.badgeColor}`}>
                  {workflow.tag}
                </span>
                <h3 className="font-bold text-slate-900 text-sm">{workflow.categoryTitle}</h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-500">
                Post-Dean: <strong className="text-slate-800">{workflow.selectedBranch}</strong>
              </span>
            </div>

            {/* Request Types Included */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">CATEGORY REQUEST TYPES</p>
              <div className="flex flex-wrap gap-1.5">
                {workflow.includes.map(item => (
                  <span
                    key={item}
                    className="bg-slate-50 text-slate-700 text-xs px-2.5 py-1 rounded-md border border-slate-200 font-medium shadow-2xs"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Sequential Approval Chain */}
            <div className="pt-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                EXACT APPROVAL SEQUENCE
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {workflow.flow.map((stage, index) => {
                  const isBranchStage = stage.includes('Branch Head');
                  const isFinal = stage === 'Chairman';
                  const isIM = stage === 'Institution Manager';
                  return (
                    <React.Fragment key={stage}>
                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-lg border shadow-2xs ${
                          isBranchStage
                            ? workflow.branchPillColor
                            : isFinal
                            ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold'
                            : isIM
                            ? 'bg-blue-50 text-blue-800 border-blue-200 font-semibold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 font-medium'
                        }`}
                      >
                        {stage}
                      </span>
                      {index < workflow.flow.length - 1 && (
                        <span className="text-slate-300 font-bold text-xs">→</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
