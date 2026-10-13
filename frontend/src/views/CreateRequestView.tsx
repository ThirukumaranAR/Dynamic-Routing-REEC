import React, { useState } from 'react';
import { User, ApprovalRequest, RequestAttachment, OfficialRequestType, OFFICIAL_REQUEST_TYPES, RequestCategory, REQUEST_CATEGORIES } from '../services/types';
import { Icon } from '../components/Icons';

interface CreateRequestViewProps {
  user: User;
  onCreateRequest: (
    newReqData: Omit<ApprovalRequest, 'id' | 'date' | 'status' | 'businessHoursIdle' | 'auditTrail' | 'currentStage'>
  ) => Promise<ApprovalRequest>;
}

interface DetailFieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  fullWidth?: boolean;
  options?: string[];
}

const categoryDetailFields: Record<RequestCategory, DetailFieldConfig[]> = {
  'Leave': [
    { key: 'prevBalance', label: 'Previous Leave Balance (Days Remaining)', placeholder: 'e.g. 12 days remaining balance', type: 'number' },
    { key: 'leaveType', label: 'Leave Category / Type', options: ['Casual Leave (CL)', 'Sick / Medical Leave (ML)', 'Earned Leave (EL)', 'On Duty (OD)', 'Loss of Pay (LOP)', 'Compensatory Off (Comp-Off)'] },
    { key: 'startDate', label: 'Leave Start Date', type: 'date' },
    { key: 'endDate', label: 'Leave End Date', type: 'date' },
    { key: 'totalDays', label: 'Total Number of Days Requested', placeholder: 'e.g. 2', type: 'number' },
    { key: 'handoverPerson', label: 'Work Handover / Charge Delegated To', placeholder: 'Name & Designation of colleague covering responsibilities' },
    { key: 'reason', label: 'Reason for Leave & Handover Notes', placeholder: 'Detailed reason for leave and duties handover...', fullWidth: true }
  ],
  'Permission': [
    { key: 'prevBalance', label: 'Previous Permissions Availed this Month', placeholder: 'e.g. 1 permission availed (2 remaining this month)' },
    { key: 'permissionDate', label: 'Permission Date', type: 'date' },
    { key: 'startTime', label: 'Start Time', type: 'time' },
    { key: 'endTime', label: 'End Time', type: 'time' },
    { key: 'duration', label: 'Duration (Hours / Minutes)', placeholder: 'e.g. 2 Hours (10:00 AM - 12:00 PM)' },
    { key: 'permissionWindow', label: 'Permission Window Type', options: ['Late Arrival (Morning)', 'Early Departure (Evening)', 'Mid-day Official / Personal Permission'] },
    { key: 'reason', label: 'Reason for Permission', placeholder: 'State specific reason for arriving late / departing early...', fullWidth: true }
  ],
  'Purchase': [
    { key: 'itemSpecification', label: 'Software / Hardware / Item Specification', placeholder: 'e.g. High-performance workstation / Cloud resources' },
    { key: 'quantity', label: 'Quantity Required', placeholder: 'e.g. 5 units', type: 'number' },
    { key: 'preferredVendor', label: 'Preferred Vendor / Supplier', placeholder: 'e.g. Authorized OEM Distributor' },
    { key: 'urgency', label: 'Procurement Priority', options: ['Standard Priority', 'High Priority', 'Critical Urgency'] },
    { key: 'justification', label: 'Purchase Justification', placeholder: 'Operational or academic need and intended usage...', fullWidth: true }
  ],
  'Travel': [
    { key: 'destination', label: 'Travel Destination / Venue', placeholder: 'e.g. New Delhi / IIT Madras Research Conclave' },
    { key: 'startDate', label: 'Departure Date', type: 'date' },
    { key: 'endDate', label: 'Return Date', type: 'date' },
    { key: 'modeOfTravel', label: 'Mode of Travel', placeholder: 'e.g. Flight / Train / Institutional Vehicle' },
    { key: 'travelPurpose', label: 'Official Purpose of Travel', placeholder: 'Conference presentation, academic visit, or meeting...', fullWidth: true }
  ],
  'Equipment': [
    { key: 'equipmentName', label: 'Equipment Name & Model', placeholder: 'e.g. Spectrophotometer / GPU Compute Server' },
    { key: 'labLocation', label: 'Target Laboratory / Department', placeholder: 'e.g. High Performance Computing Lab' },
    { key: 'serviceType', label: 'Service / Procurement Type', options: ['New Installation', 'Annual Calibration / AMC', 'Repair / Replacement'] },
    { key: 'technicalSpecs', label: 'Equipment Specifications & Impact', placeholder: 'Technical specifications, warranty terms, and research impact...', fullWidth: true }
  ],
  'Reimbursement': [
    { key: 'invoiceNumber', label: 'Bill / Invoice Reference Number', placeholder: 'e.g. INV-2026-0442' },
    { key: 'expenseDate', label: 'Date of Expense Incurred', type: 'date' },
    { key: 'expenseCategory', label: 'Expense Category', placeholder: 'e.g. Travel Fare / Registration Fee / Consumables' },
    { key: 'prevBalance', label: 'Previous Claims This Quarter', placeholder: 'e.g. 1 claim submitted' },
    { key: 'claimNotes', label: 'Expense Justification & Summary', placeholder: 'Describe the authorized expense and attach receipts below...', fullWidth: true }
  ],
  'Work From Home': [
    { key: 'prevBalance', label: 'Previous WFH Days Availed This Month', placeholder: 'e.g. 2 days availed' },
    { key: 'startDate', label: 'WFH Start Date', type: 'date' },
    { key: 'endDate', label: 'WFH End Date', type: 'date' },
    { key: 'contactNumber', label: 'Emergency Contact Phone Number', placeholder: 'Active mobile phone number' },
    { key: 'deliverables', label: 'Remote Tasks & Daily Deliverables', placeholder: 'List specific tasks and milestones planned during WFH...', fullWidth: true }
  ],
  'Other': [
    { key: 'subject', label: 'Subject / Reference', placeholder: 'e.g. Infrastructure Maintenance / Special Permission' },
    { key: 'priority', label: 'Urgency Level', options: ['Routine', 'Standard', 'Urgent'] },
    { key: 'otherDetails', label: 'Detailed Description & Context', placeholder: 'Provide complete details and context for this request...', fullWidth: true }
  ]
};

export const CreateRequestView: React.FC<CreateRequestViewProps> = ({
  user,
  onCreateRequest
}) => {
  const [title, setTitle] = useState('');
  const [workflowType, setWorkflowType] = useState<OfficialRequestType>('IT Request');
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
    if (!title.trim() || submitting) return;

    let parsedAmount: number | null = null;
    if (amount.trim() !== '') {
      const num = Number(amount);
      if (isNaN(num) || num < 0) {
        setError('Cost must be a valid non-negative number if entered.');
        return;
      }
      parsedAmount = num;
    }

    setSubmitting(true);
    setError('');
    try {
      const created = await onCreateRequest({
        title: title.trim(),
        department: user.dept,
        purpose: description.trim(),
        amount: parsedAmount,
        category: category,
        requestType: workflowType,
        requester: user.name,
        description: description.trim(),
        company: user.company || 'FlowNexus',
        businessUnit: user.businessUnit || 'Main',
        campus: user.campus || 'Main',
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
          Submit an institutional request routed through multi-tier approval to the dedicated department and executive authorities.
        </p>
      </div>

      {isCreated ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-8 text-center animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Icon name="check" className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-green-800 font-bold text-base">Request Submitted Successfully!</p>
          <p className="text-green-600 text-xs mt-1">
            {createdRequestId} ({category} · {workflowType}) was saved and routed into the institutional approval pipeline.
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
                placeholder="e.g. Leave Application for Family Event / Permission for Doctor Appointment"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Workflow Type Selection */}
              <div>
                <label htmlFor="workflow-type-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                  Workflow Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="workflow-type-select"
                  value={workflowType}
                  onChange={e => {
                    setWorkflowType(e.target.value as OfficialRequestType);
                  }}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                >
                  {OFFICIAL_REQUEST_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type === 'IT Request' ? 'IT Workflow (IT Request)' :
                       type === 'Audit Request' ? 'Audit Workflow (Audit Request)' :
                       type === 'HR Request' ? 'HR Workflow (HR Request)' :
                       type === 'MMI Request' ? 'MMI Workflow (MMI Request)' : type}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Routes through IM → Finance → Accountant → VP → HOI → Dean → {workflowType.replace(' Request', '')} Branch → CEO → Chairman
                </p>
              </div>

              {/* Request Type Selection (e.g. Leave, Permission) */}
              <div>
                <label htmlFor="request-category-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                  Request Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="request-category-select"
                  value={category}
                  onChange={e => {
                    setCategory(e.target.value as RequestCategory);
                    setDetails({});
                  }}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                >
                  {REQUEST_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Select institutional request category (Leave, Permission, Purchase, etc.)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Estimated Cost / Amount (INR) <span className="text-slate-400 font-normal text-[11px] lowercase">(optional)</span>
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="0"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave blank if no cost is required (e.g. Leave, Permission)"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Optional. Financial authorities remain in review sequence even without expenditure.
              </p>
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
                placeholder="Explain the operational, academic, or personal purpose and justification for this request..."
              />
            </div>

            {/* Request Type Specific Details (e.g. Leave Details with Prev Balance, Permission, etc.) */}
            <div className="border-t border-slate-100 pt-4 bg-slate-50/50 -mx-6 px-6 py-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span>📋</span> {category} Specific Details
                </p>
                <span className="text-[10px] text-slate-400">
                  {category === 'Leave' ? 'Specify previous leave balance, leave dates, and handover details' :
                   category === 'Permission' ? 'Specify previous permissions availed, date, time window, and reason' :
                   'Fill in specific parameters'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categoryDetailFields[category]?.map(field => (
                  <div key={field.key} className={field.fullWidth ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {field.label} {field.key === 'prevBalance' && <span className="text-blue-600 font-bold">*</span>}
                    </label>
                    {field.options ? (
                      <select
                        value={details[field.key] || ''}
                        onChange={e => setDetails({ ...details, [field.key]: e.target.value })}
                        className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="">-- Select {field.label} --</option>
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={details[field.key] || ''}
                        placeholder={field.placeholder}
                        onChange={e => setDetails({ ...details, [field.key]: e.target.value })}
                        className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
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
                  <p className="text-xs font-semibold text-slate-700">Click or drag documents to attach</p>
                  <p className="text-[11px] text-slate-400">PDF, Word, Excel, PNG or JPG up to 10 MB total</p>
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
                disabled={!title.trim() || submitting}
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
