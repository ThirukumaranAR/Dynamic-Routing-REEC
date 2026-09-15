"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.Database = void 0;
// In-memory Database with initial mock seed matching the Figma application
class Database {
    static instance;
    roles = [
        'REQUESTER',
        'APPROVER',
        'AUTHORITY',
        'CEO'
    ];
    users = [
        {
            id: 'usr-1',
            email: 'requester@gmail.com',
            password: 'pass123',
            name: 'Arun',
            role: 'REQUESTER',
            dept: 'Computer Science and Engineering',
            company: 'Northstar Group', businessUnit: 'Head Office'
        },
        {
            id: 'usr-2',
            email: 'approver@gmail.com',
            password: 'pass123',
            name: 'Rajan Mehta',
            role: 'APPROVER',
            dept: 'IT Department',
            company: 'Northstar Group', businessUnit: 'Head Office'
        },
        {
            id: 'usr-3',
            email: 'authority@gmail.com',
            password: 'pass123',
            name: 'Dr. Suresh Kumar',
            role: 'AUTHORITY',
            dept: 'Administration',
            company: 'Northstar Group', businessUnit: 'Head Office'
        },
        {
            id: 'usr-4',
            email: 'ceo@gmail.com',
            password: 'pass123',
            name: 'Dr. Suresh Kumar',
            role: 'CEO',
            dept: 'Chief Executive Office',
            company: 'Northstar Group', businessUnit: 'Corporate Services'
        }
    ];
    requests = [
        {
            id: 'REQ-001',
            title: 'Industrial visit',
            department: 'Computer Science and Engineering',
            amount: 100000,
            date: '27/08/2026',
            status: 'APPROVED',
            category: 'Purchase', requestType: 'Purchase',
            requester: 'Arun',
            description: 'Regional client visit and team learning program for the technology team.',
            hoursIdle: 0,
            auditTrail: [
                { ts: '27/08/2026 10:00', actor: 'Arun', action: 'Request submitted' },
                { ts: '27/08/2026 11:30', actor: 'System', action: 'Assigned to Rajan Mehta (Approver)' },
                { ts: '27/08/2026 14:00', actor: 'Rajan Mehta', action: 'Request approved' }
            ],
            createdAt: '2026-08-27T10:00:00.000Z',
            updatedAt: '2026-08-27T14:00:00.000Z'
        },
        {
            id: 'REQ-002',
            title: 'Lab Equipment Purchase',
            department: 'Computer Science and Engineering',
            amount: 250000,
            date: '28/08/2026',
            status: 'PENDING',
            category: 'Equipment', requestType: 'Equipment',
            requester: 'Arun',
            description: 'Purchase of 10 high-performance workstations for the AI/ML lab.',
            hoursIdle: 6.5,
            auditTrail: [
                { ts: '28/08/2026 09:15', actor: 'Arun', action: 'Request submitted' },
                { ts: '28/08/2026 09:22', actor: 'System', action: 'Assigned to Rajan Mehta (Approver)' }
            ],
            createdAt: '2026-08-28T09:15:00.000Z',
            updatedAt: '2026-08-28T09:22:00.000Z'
        },
        {
            id: 'REQ-003',
            title: 'Conference Registration',
            department: 'IT Department',
            amount: 35000,
            date: '29/08/2026',
            status: 'QUERIED',
            category: 'Travel', requestType: 'Travel',
            requester: 'Priya Nair',
            description: 'Registration and travel support for an industry technology conference.',
            hoursIdle: 3.2,
            query: 'Please provide the conference brochure and list of attendees.',
            auditTrail: [
                { ts: '29/08/2026 11:00', actor: 'Priya Nair', action: 'Request submitted' },
                { ts: '29/08/2026 11:10', actor: 'System', action: 'Assigned to Rajan Mehta (Approver)' },
                { ts: '29/08/2026 14:30', actor: 'Rajan Mehta', action: 'Query raised — awaiting requester response' }
            ],
            createdAt: '2026-08-29T11:00:00.000Z',
            updatedAt: '2026-08-29T14:30:00.000Z'
        },
        {
            id: 'REQ-004',
            title: 'Technology Team Development Program',
            department: 'IT Department',
            amount: 80000,
            date: '29/08/2026',
            status: 'ESCALATED',
            category: 'Equipment', requestType: 'Equipment',
            requester: 'Daniel Osei',
            description: 'Three-day FDP on Deep Learning and Neural Networks — 15 participants.',
            hoursIdle: 14.8,
            auditTrail: [
                { ts: '29/08/2026 08:00', actor: 'Daniel Osei', action: 'Request submitted' },
                { ts: '29/08/2026 08:12', actor: 'System', action: 'Assigned to approver' },
                { ts: '29/08/2026 22:50', actor: 'System', action: 'SLA breached — escalated to higher authority' }
            ],
            createdAt: '2026-08-29T08:00:00.000Z',
            updatedAt: '2026-08-29T22:50:00.000Z'
        },
        {
            id: 'REQ-005',
            title: 'Sports Equipment',
            department: 'Physical Education',
            amount: 45000,
            date: '30/08/2026',
            status: 'REJECTED',
            category: 'Purchase', requestType: 'Purchase',
            requester: 'Marco Ferreira',
            description: 'Purchase of cricket and football equipment for inter-collegiate tournaments.',
            hoursIdle: 0,
            auditTrail: [
                { ts: '30/08/2026 10:00', actor: 'Marco Ferreira', action: 'Request submitted' },
                { ts: '30/08/2026 10:15', actor: 'System', action: 'Assigned to approver' },
                { ts: '30/08/2026 13:00', actor: 'Rajan Mehta', action: 'Request rejected — budget overrun' }
            ],
            createdAt: '2026-08-30T10:00:00.000Z',
            updatedAt: '2026-08-30T13:00:00.000Z'
        }
    ];
    sops = [
        {
            id: 'sop-1',
            title: 'Procurement Policy v2.1',
            desc: 'Guidelines for vendor selection and purchase orders above ₹50,000.',
            date: '15/08/2026'
        },
        {
            id: 'sop-2',
            title: 'Travel & Expense Policy',
            desc: 'Reimbursement limits and approval hierarchy for official travel.',
            date: '01/07/2026'
        },
        {
            id: 'sop-3',
            title: 'SLA Guidelines',
            desc: '10-hour SLA threshold for all approval requests with auto-escalation rules.',
            date: '10/06/2026'
        },
        {
            id: 'sop-4',
            title: 'Business Activity Approval SOP',
            desc: 'Procedure for industrial visits, conferences, and FDP approvals.',
            date: '20/05/2026'
        }
    ];
    static getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }
}
exports.Database = Database;
exports.db = Database.getInstance();
