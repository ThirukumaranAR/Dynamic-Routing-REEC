import React, { useState } from 'react';
import { User, ApprovalRequest, RequestCategory, RequestAttachment } from '../services/types';
import { Icon } from '../components/Icons';

interface CreateRequestViewProps {
  user: User;
  onCreateRequest: (
    newReqData: Omit<ApprovalRequest, 'id' | 'date' | 'status' | 'businessHoursIdle' | 'auditTrail' | 'currentStage'>
  ) => Promise<ApprovalRequest>;
}

const requestTypes: RequestCategory[] = [
  'Leave',
  'Permission',
  'Purchase',
  'Travel',
  'Equipment',
  'Reimbursement',
  'Work From Home',
  'Other'
];

const detailFields: Record<RequestCategory, { key: string; label: string; placeholder?: string; type?: string; fullWidth?: boolean }[]> = {
  Leave: [
    { key: 'leaveType', label: 'Leave type', placeholder: 'e.g. Casual / Medical / On-Duty Leave' },
    { key: 'fromDate', label: 'From date', type: 'date' },
    { key: 'toDate', label: 'To date', type: 'date' },
    { key: 'days', label: 'Number of days', type: 'number', placeholder: 'e.g. 3' },
    { key: 'reason', label: 'Reason for leave', placeholder: 'Brief explanation for leave request', fullWidth: true }
  ],
  Permission: [
    { key: 'date', label: 'Permission Date', type: 'date' },
    { key: 'time', label: 'Time window', placeholder: 'e.g. 2:00 PM - 4:00 PM' },
    { key: 'permissionType', label: 'Permission type', placeholder: 'e.g. Academic / Official Duty / Personal' },
    { key: 'reason', label: 'Reason for permission', placeholder: 'Specific purpose', fullWidth: true }
  ],
  Purchase: [
    { key: 'vendor', label: 'Vendor or supplier', placeholder: 'e.g. Dell India / Fisher Scientific' },
    { key: 'items', label: 'Items or services', placeholder: 'List of equipment / materials required' },
    { key: 'businessNeed', label: 'Business need / Department use', placeholder: 'Justification for purchase', fullWidth: true }
  ],
  Travel: [
    { key: 'destination', label: 'Destination', placeholder: 'e.g. Bangalore / IIT Madras' },
    { key: 'travelDates', label: 'Travel dates / Duration', placeholder: 'e.g. 15th - 17th Oct' },
    { key: 'purpose', label: 'Travel purpose', placeholder: 'e.g. Conference Paper Presentation / Workshop' },
    { key: 'estimatedExpenses', label: 'Estimated expenses breakdown', placeholder: 'e.g. Travel + Accommodation + Registration' }
  ],
  Equipment: [
    { key: 'equipment', label: 'Equipment required', placeholder: 'e.g. Digital Storage Oscilloscope' },
    { key: 'quantity', label: 'Quantity', type: 'number', placeholder: 'e.g. 5' },
    { key: 'businessNeed', label: 'Lab / Research purpose', placeholder: 'Intended lab and semester use', fullWidth: true }
  ],
  Reimbursement: [
    { key: 'expenseDate', label: 'Expense date', type: 'date' },
    { key: 'expenseType', label: 'Expense type', placeholder: 'e.g. Conference Fee / Lab Consumables / Travel' },
    { key: 'receiptReference', label: 'Receipt / Invoice Number', placeholder: 'e.g. INV-90421 / GST-8812', fullWidth: true }
  ],
  'Work From Home': [
    { key: 'date', label: 'WFH Date', type: 'date' },
    { key: 'reason', label: 'Reason for WFH', placeholder: 'e.g. Health condition / Personal emergency' },
    { key: 'availability', label: 'Availability & Connectivity plan', placeholder: 'Phone / Google Meet / Email access', fullWidth: true }
  ],
  Other: [
    { key: 'customCategory', label: 'Nature / Sub-Type of Request *', placeholder: 'e.g. Industrial Visit, Workshop, Honorarium, Sponsorship, Event' },
    { key: 'eventDate', label: 'Event / Requirement Date', type: 'date' },
    { key: 'beneficiary', label: 'Target Beneficiaries & Headcount', placeholder: 'e.g. 60 III-Year CSE Students & 2 Faculty In-charge' },
    { key: 'venue', label: 'Venue / Location / Lab', placeholder: 'e.g. Seminar Hall 3 / TCS Siruseri / AI Research Lab' },
    { key: 'expectedOutcome', label: 'Expected Outcome & Academic Objective', placeholder: 'Key objectives and institutional benefits', fullWidth: true },
    { key: 'additionalNotes', label: 'Additional Remarks & Arrangements', placeholder: 'e.g. Transport, guest accommodation, budget allocation notes', fullWidth: true }
  ]
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
  const [createdRequestId, setCreatedRequestId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const existingBytes = attachments.reduce((total, attachment) => total + Math.floor((attachment.dataUrl?.length || 0) * 0.75), 0);
      if (files.some(file => file.size > 10 * 1024 * 1024) || existingBytes + files.reduce((total, file) => total + file.size, 0) > 10 * 1024 * 1024) {
        setError('Attachments must total 10 MB or less.');
        e.target.value = '';
        return;
      }
      try {
      const newFiles: RequestAttachment[] = await Promise.all(files.map(async file => {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const sizeKb = (file.size / 1024).toFixed(0);
        const displaySize = file.size >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;
        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
          reader.readAsDataURL(file);
        });

        return {
          name: file.name,
          size: displaySize,
          type: ext,
          dataUrl
        };
      }));

      setAttachments(prev => [...prev, ...newFiles]);
      setError('');
      } catch (fileError) {
        setError(fileError instanceof Error ? fileError.message : 'Could not read attachment.');
      }
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || amount.trim() === '' || isNaN(parsedAmount) || parsedAmount < 0 || submitting) return;

    setSubmitting(true);
    setError('');
    try {
    const created = await onCreateRequest({
      title: title.trim(),
      department: user.dept,
      purpose: description.trim(),
      amount: parsedAmount,
      category,
      requester: user.name,
      description: description.trim(),
      company: user.company || 'FlowNexus',
      businessUnit: user.businessUnit || 'Main',
      campus: user.campus || 'Main',
      requestType: category,
      requestDetails: details,
      attachments
    });

    setCreatedRequestId(created.id);
    setIsCreated(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Request submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Create New Request</h1>
        <p className="text-sm text-slate-400">
          Submit an institutional expenditure or approval request tailored to its specific type.
        </p>
      </div>

      {isCreated ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-8 text-center animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Icon name="check" className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-green-800 font-bold text-base">Request Submitted Successfully!</p>
          <p className="text-green-600 text-xs mt-1">
            {createdRequestId} was saved and assigned to your Line Manager.
          </p>
        </div>
      ) : (
        <>
        {error && <div role="alert" className="mb-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
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
              placeholder="e.g. Industrial Visit to TCS Chennai / Purchase of Lab Workstations"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Request Type
              </label>
              <select
                value={category}
                onChange={e => {
                  setCategory(e.target.value as RequestCategory);
                  setDetails({});
                }}
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                Estimated Cost / Amount (INR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                min="0"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 100000"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Purpose &amp; Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Explain the operational or academic purpose and justification for this request..."
            />
          </div>

          {/* Dynamic Category Specific Details Section */}
          <div className="border-t border-slate-100 pt-4 bg-slate-50/50 -mx-6 px-6 py-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <span>📋</span> {category === 'Other' ? 'Custom / Special Request Specific Details' : `${category} Details`}
              </p>
              <span className="text-[10px] text-slate-400">Fill in specific parameters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {detailFields[category].map(field => (
                <div key={field.key} className={field.fullWidth ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {field.label}
                  </label>
                  <input
                    type={field.type || 'text'}
                    value={details[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={e => setDetails({ ...details, [field.key]: e.target.value })}
                    className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
              Department: <strong className="text-slate-600">{user.dept}</strong> ({user.campus || 'Main'})
            </p>
            <button
              type="submit"
              disabled={!title.trim() || !amount || submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs px-6 py-2.5 rounded-lg transition shadow-sm cursor-pointer"
            >
              {submitting ? 'Submitting…' : 'Submit Request to Line Manager'}
            </button>
          </div>
        </form>
        </>
      )}
    </div>
  );
};
