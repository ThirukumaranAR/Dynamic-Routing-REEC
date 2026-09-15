import React, { useState } from 'react';
import { User, ApprovalRequest, RequestCategory, RequestAttachment } from '../services/types';
import { Icon } from '../components/Icons';

interface CreateRequestViewProps {
  user: User;
  onCreateRequest: (
    newReqData: Omit<ApprovalRequest, 'id' | 'date' | 'status' | 'businessHoursIdle' | 'auditTrail' | 'currentStage'>
  ) => void;
}

  const requestTypes: RequestCategory[] = ['Leave', 'Permission', 'Purchase', 'Travel', 'Equipment', 'Reimbursement', 'Work From Home', 'Other'];
  const detailFields: Record<RequestCategory, { key: string; label: string; type?: string }[]> = {
    Leave: [{ key: 'leaveType', label: 'Leave type' }, { key: 'fromDate', label: 'From date', type: 'date' }, { key: 'toDate', label: 'To date', type: 'date' }, { key: 'days', label: 'Number of days', type: 'number' }, { key: 'reason', label: 'Reason' }],
    Permission: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'time', label: 'Time window' }, { key: 'permissionType', label: 'Permission type' }, { key: 'reason', label: 'Reason' }],
    Purchase: [{ key: 'vendor', label: 'Vendor or supplier' }, { key: 'items', label: 'Items or services' }, { key: 'businessNeed', label: 'Business need' }],
    Travel: [{ key: 'destination', label: 'Destination' }, { key: 'travelDates', label: 'Travel dates' }, { key: 'purpose', label: 'Travel purpose' }, { key: 'estimatedExpenses', label: 'Estimated expenses' }],
    Equipment: [{ key: 'equipment', label: 'Equipment required' }, { key: 'quantity', label: 'Quantity', type: 'number' }, { key: 'businessNeed', label: 'Business need' }],
    Reimbursement: [{ key: 'expenseDate', label: 'Expense date', type: 'date' }, { key: 'expenseType', label: 'Expense type' }, { key: 'receiptReference', label: 'Receipt reference' }],
    'Work From Home': [{ key: 'date', label: 'Date', type: 'date' }, { key: 'reason', label: 'Reason' }, { key: 'availability', label: 'Availability plan' }],
    Other: [{ key: 'details', label: 'Request details' }]
  };

export const CreateRequestView: React.FC<CreateRequestViewProps> = ({
  user,
  onCreateRequest
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RequestCategory>('Leave');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);
  const [isCreated, setIsCreated] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: RequestAttachment[] = Array.from(e.target.files).map(file => {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const sizeKb = (file.size / 1024).toFixed(0);
        const displaySize = file.size >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;
        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';

        return {
          name: file.name,
          size: displaySize,
          type: ext
        };
      });

      setAttachments(prev => [...prev, ...newFiles]);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

    onCreateRequest({
      title: title.trim(),
      department: user.dept,
      purpose: description.trim(),
      amount: parseInt(amount, 10),
      category,
      requester: user.name,
      description: description.trim(),
      company: user.company,
      businessUnit: user.businessUnit,
      requestType: category,
      requestDetails: details,
      attachments: attachments.length > 0 ? attachments : [
        { name: `${title.trim().replace(/\s+/g, '_')}_Document.pdf`, size: '1.2 MB', type: 'PDF' }
      ]
    });

    setIsCreated(true);
  };

  return (
    <div className="px-6 py-6 max-w-2xl">
      <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Add Request</h1>
        <p className="text-sm text-slate-400">
            Submit a company request with details tailored to its request type.
        </p>
      </div>

      {isCreated ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-8 text-center animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Icon name="check" className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-green-800 font-bold text-base">Request Submitted Successfully!</p>
          <p className="text-green-600 text-xs mt-1">
            Assigned to your Line Manager in the queue. Redirecting to All Requests…
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-100 shadow-sm px-6 py-6 space-y-5"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Request Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Purchase of Lab Workstations"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                  Request Type
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as RequestCategory)}
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {requestTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Cost <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                min="1"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 1500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Purpose <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Explain the business purpose of this request..."
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">{category} Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {detailFields[category].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{field.label}</label>
                  <input type={field.type || 'text'} value={details[field.key] || ''} onChange={e => setDetails({ ...details, [field.key]: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Attach Relevant Documents / Quotations / Approvals
            </label>
            
            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-4 text-center bg-slate-50/60 transition group cursor-pointer relative">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  Click or drag files here to attach
                </p>
                <p className="text-[10px] text-slate-400">
                  Supports PDF, Word, Invoices, Vendor Quotes, Images (up to 10MB)
                </p>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Attached Files ({attachments.length})
                </p>
                <div className="space-y-1.5">
                  {attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="bg-red-50 text-red-700 font-bold text-[10px] px-1.5 py-0.5 rounded border border-red-200 flex-shrink-0">
                          {file.type}
                        </span>
                        <span className="font-medium text-slate-800 truncate">
                          {file.name}
                        </span>
                        <span className="text-[11px] text-slate-400 flex-shrink-0">
                          ({file.size})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                        title="Remove file"
                      >
                        <Icon name="x" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[11px] text-slate-400">
              Business Unit: <strong className="text-slate-600">{user.businessUnit}</strong>
            </p>
            <button
              type="submit"
              disabled={!title.trim() || !amount}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs px-6 py-2.5 rounded-lg transition shadow-sm cursor-pointer"
            >
              Submit Request to Line Manager
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
