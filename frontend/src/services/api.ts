import { User, ApprovalRequest, ApprovalStage, RequestCategory } from './types';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const initialUsers: (User & { password: string })[] = [
  {
    email: 'requester@gmail.com',
    password: 'pass123',
    name: 'Arun',
    role: 'REQUESTER',
    dept: 'Operations', company: 'Northstar Group', businessUnit: 'Head Office'
  },
  {
    email: 'manager@gmail.com',
    password: 'pass123',
    name: 'Rajan Mehta',
    role: 'MANAGER',
    dept: 'Operations', company: 'Northstar Group', businessUnit: 'Head Office'
  },
  {
    email: 'hr@gmail.com',
    password: 'pass123',
    name: 'Sarah Jenkins',
    role: 'HR',
    dept: 'People & Culture', company: 'Northstar Group', businessUnit: 'Corporate Services'
  },
  {
    email: 'it@gmail.com',
    password: 'pass123',
    name: 'Vikram Seth',
    role: 'IT',
    dept: 'Technology', company: 'Northstar Group', businessUnit: 'Corporate Services'
  },
  {
    email: 'finance@gmail.com',
    password: 'pass123',
    name: 'Amitabh Verma',
    role: 'FINANCE',
    dept: 'Finance', company: 'Northstar Group', businessUnit: 'Corporate Services'
  },
  {
    email: 'accountant@gmail.com',
    password: 'pass123',
    name: 'Pooja Sharma',
    role: 'ACCOUNTANT',
    dept: 'Finance', company: 'Northstar Group', businessUnit: 'Corporate Services'
  },
  {
    email: 'gm@gmail.com',
    password: 'pass123',
    name: 'Kavitha Reddy',
    role: 'GENERAL_MANAGER',
    dept: 'Operations', company: 'Northstar Group', businessUnit: 'Head Office'
  },
  {
    email: 'ceo@gmail.com',
    password: 'pass123',
    name: 'Dr. Suresh Kumar',
    role: 'CEO',
    dept: 'Executive Office', company: 'Northstar Group', businessUnit: 'Head Office'
  }
];

export const initialRequests: ApprovalRequest[] = [
  {
    id: 'REQ-001',
    title: 'Industrial Visit to TCS Chennai',
    department: 'Computer Science and Engineering',
    amount: 100000,
    date: '27/08/2026',
    status: 'APPROVED',
    category: 'Purchase', requestType: 'Purchase',
    requester: 'Arun',
    description: 'Regional client visit and team learning program for the technology team.',
    currentStage: 'COMPLETED',
    businessHoursIdle: 0,
    attachments: [
      { name: 'TCS_Company_Confirmation_Letter.pdf', size: '1.2 MB', type: 'PDF' },
      { name: 'Client_Visit_Quote.pdf', size: '850 KB', type: 'PDF' }
    ],
    auditTrail: [
      { ts: '27/08/2026 09:30', actor: 'Arun (Requester)', action: 'Request submitted to Manager in Approval Queue' },
      { ts: '27/08/2026 11:00', actor: 'Rajan Mehta (Manager)', action: 'Manager verified and routed to IT Department' },
      { ts: '27/08/2026 13:00', actor: 'Vikram Seth (IT)', action: 'IT Head approved and forwarded to General Manager' },
      { ts: '27/08/2026 14:15', actor: 'Kavitha Reddy (General Manager)', action: 'Approved and forwarded to CEO' },
      { ts: '27/08/2026 16:30', actor: 'Dr. Suresh Kumar (CEO)', action: 'Final approval granted' }
    ]
  },
  {
    id: 'REQ-002',
    title: 'Lab Workstation Equipment Purchase',
    department: 'Computer Science and Engineering',
    amount: 250000,
    date: '28/08/2026',
    status: 'PENDING',
    category: 'Equipment', requestType: 'Equipment',
    requester: 'Arun',
    description: 'Purchase of 10 high-performance GPU workstations for the AI/ML laboratory.',
    currentStage: 'MANAGER',
    businessHoursIdle: 3.5,
    attachments: [
      { name: 'Workstation_Vendor_Quotation_Dell.pdf', size: '2.4 MB', type: 'PDF' },
      { name: 'Lab_Specification_Sheet.pdf', size: '1.1 MB', type: 'PDF' }
    ],
    auditTrail: [
      { ts: '28/08/2026 09:15', actor: 'Arun (Requester)', action: 'Request submitted to Approval Queue' },
      { ts: '28/08/2026 09:20', actor: 'System', action: 'Assigned to Manager for verification and department branch selection' }
    ]
  },
  {
    id: 'REQ-003',
    title: 'People Team Onboarding Packages',
    department: 'Human Resources',
    amount: 180000,
    date: '29/08/2026',
    status: 'PENDING',
    category: 'Leave', requestType: 'Leave',
    requester: 'Priya Nair',
    description: 'Relocation reimbursement and appointment clearances for 3 newly recruited Assistant Professors.',
    currentStage: 'HR',
    businessHoursIdle: 2.5,
    attachments: [
      { name: 'Hiring_Committee_Report.pdf', size: '1.5 MB', type: 'PDF' }
    ],
    auditTrail: [
      { ts: '29/08/2026 09:00', actor: 'Priya Nair (Requester)', action: 'Submitted request to Manager' },
      { ts: '29/08/2026 10:15', actor: 'Rajan Mehta (Manager)', action: 'Manager selected HR branch & routed to HR Head' }
    ]
  },
  {
    id: 'REQ-004',
    title: 'Office Fiber Network Switch Replacement',
    department: 'IT Department',
    amount: 140000,
    date: '29/08/2026',
    status: 'ESCALATED',
    category: 'Equipment', requestType: 'Equipment',
    requester: 'Daniel Osei',
    description: 'Core 10Gbps managed switch replacement for office connectivity.',
    currentStage: 'CEO',
    businessHoursIdle: 6.5,
    attachments: [
      { name: 'Cisco_Switch_Quote_Invoice.pdf', size: '1.8 MB', type: 'PDF' }
    ],
    auditTrail: [
      { ts: '28/08/2026 09:00', actor: 'Daniel Osei (Requester)', action: 'Request submitted to Approval Queue' },
      { ts: '29/08/2026 16:00', actor: 'System (Business SLA Engine)', action: '⚠️ Business SLA Breached (>6 business hours idle between 9AM-5PM Mon-Fri) — Auto-Escalated to CEO' }
    ]
  },
  {
    id: 'REQ-005',
    title: 'Conference Registration & Travel Grant',
    department: 'IT Department',
    amount: 35000,
    date: '30/08/2026',
    status: 'QUERIED',
    category: 'Travel', requestType: 'Travel',
    requester: 'Arun',
    description: 'Registration fee and airfare for IEEE International AI Conference.',
    currentStage: 'FINANCE',
    businessHoursIdle: 1.5,
    query: 'Please attach the official IEEE acceptance notification and revised travel breakdown.',
    attachments: [
      { name: 'Conference_Brochure.pdf', size: '640 KB', type: 'PDF' }
    ],
    auditTrail: [
      { ts: '30/08/2026 09:30', actor: 'Arun (Requester)', action: 'Request submitted to Approval Queue' },
      { ts: '30/08/2026 10:00', actor: 'Rajan Mehta (Manager)', action: 'Manager routed to Finance Head' },
      { ts: '30/08/2026 11:00', actor: 'Amitabh Verma (Finance)', action: 'Query raised: Requested acceptance letter' }
    ]
  }
];

export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Stage Progression Chain:
// 1. Requester -> Manager
// 2. Manager routes to: HR, IT, or FINANCE
// 3. FINANCE -> ACCOUNTANT -> GENERAL_MANAGER -> CEO -> COMPLETED
// 4. HR / IT -> GENERAL_MANAGER -> CEO -> COMPLETED
export function getNextStage(category: RequestCategory, currentStage: ApprovalStage): ApprovalStage {
  switch (currentStage) {
    case 'MANAGER':
      if (category === 'Leave' || category === 'Permission') return 'HR';
      if (category === 'Equipment' || category === 'Work From Home') return 'IT';
      if (category === 'Travel' || category === 'Purchase' || category === 'Reimbursement') return 'FINANCE';
      return 'FINANCE';

    case 'FINANCE':
      return 'ACCOUNTANT';

    case 'ACCOUNTANT':
    case 'HR':
    case 'IT':
      return 'GENERAL_MANAGER';

    case 'GENERAL_MANAGER':
      return 'CEO';

    case 'CEO':
      return 'COMPLETED';

    default:
      return 'COMPLETED';
  }
}

export function isCurrentlyBusinessHours(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 6 = Sat
  const isWeekday = day >= 1 && day <= 5;
  const hours = now.getHours() + now.getMinutes() / 60;
  return isWeekday && hours >= 9 && hours < 17;
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'REQUESTER': return 'Requester (Employee)';
    case 'MANAGER': return 'Operations Manager';
    case 'HR': return 'HR Head';
    case 'IT': return 'IT Head';
    case 'FINANCE': return 'Finance Head';
    case 'ACCOUNTANT': return 'Accountant';
    case 'GENERAL_MANAGER': return 'Head of Operations / GM';
    case 'CEO': return 'Chairman / CEO';
    case 'COMPLETED': return 'Completed & Approved';
    default: return role;
  }
}

export function getStageActorName(stage: ApprovalStage): string {
  switch (stage) {
    case 'MANAGER': return 'Rajan Mehta (Operations Manager)';
    case 'HR': return 'Sarah Jenkins (HR Head)';
    case 'IT': return 'Vikram Seth (IT Head)';
    case 'FINANCE': return 'Amitabh Verma (Finance Head)';
    case 'ACCOUNTANT': return 'Pooja Sharma (Accountant)';
    case 'GENERAL_MANAGER': return 'Kavitha Reddy (Head of Operations / GM)';
    case 'CEO': return 'Dr. Suresh Kumar (Chairman / CEO)';
    case 'COMPLETED': return 'Approved & Finalized';
    default: return stage;
  }
}
