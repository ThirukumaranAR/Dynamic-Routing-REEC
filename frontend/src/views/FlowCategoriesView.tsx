import React from 'react';

export const FlowCategoriesView: React.FC = () => {
  const workflows = [
    { tag: 'PEOPLE', includes: ['Leave', 'Permission', 'Onboarding', 'Employee changes'], flow: ['Employee', 'Manager', 'HR', 'Operations', 'CEO'] },
    { tag: 'FINANCE', includes: ['Purchase', 'Travel', 'Reimbursement', 'Vendor payment'], flow: ['Employee', 'Manager', 'Finance', 'Operations', 'CEO'] },
    { tag: 'TECHNOLOGY', includes: ['Equipment', 'Software', 'Access', 'Security'], flow: ['Employee', 'Manager', 'IT', 'Operations', 'CEO'] },
    { tag: 'GENERAL', includes: ['Work From Home', 'Other', 'Business requests'], flow: ['Employee', 'Manager', 'Operations', 'CEO'] }
  ];

  return (
    <div className="px-8 py-7 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Approval Workflows</h1>
        <p className="text-xs text-slate-500 mt-1">Company routing rules for each request type.</p>
      </div>
      <div className="bg-[#f0f6ff] border border-[#d6e6fe] rounded-2xl p-5 mb-8 shadow-sm">
        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3">STANDARD COMPANY FLOW</p>
        <div className="flex flex-wrap items-center gap-2">
          {['Employee', 'Manager', 'Business Unit', 'Operations', 'CEO'].map((stage, index, list) => (
            <React.Fragment key={stage}>
              <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold border bg-white text-blue-800 border-blue-200">{stage}</span>
              {index < list.length - 1 && <span className="text-blue-300 font-bold">-&gt;</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {workflows.map(workflow => (
          <div key={workflow.tag} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <span className="inline-block bg-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-0.5 rounded-md mb-3">{workflow.tag}</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">REQUEST TYPES</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {workflow.includes.map(item => <span key={item} className="bg-slate-50 text-slate-600 text-xs px-2.5 py-1 rounded-md border border-slate-200/60">{item}</span>)}
            </div>
            <div className="pt-3.5 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">APPROVAL FLOW</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {workflow.flow.map((stage, index) => <React.Fragment key={stage}><span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">{stage}</span>{index < workflow.flow.length - 1 && <span className="text-slate-300">-&gt;</span>}</React.Fragment>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
