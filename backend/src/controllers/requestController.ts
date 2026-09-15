import { Response } from 'express';
import { db } from '../services/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { ApprovalRequest, RequestCategory } from '../models/types';

const formatTimestamp = () => {
  return new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDate = () => {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// GET /api/requests
export const getAllRequests = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let requests = [...db.requests];

  // Role-based visibility
  if (user.role === 'REQUESTER') {
    requests = requests.filter(r => r.requester === user.name);
  } else if (user.role === 'AUTHORITY') {
    // Authority primarily sees escalated requests or all
    const filterAll = req.query.all === 'true';
    if (!filterAll) {
      requests = requests.filter(r => r.status === 'ESCALATED');
    }
  }

  // Filter by status query param if provided
  const { status, category } = req.query;
  if (status && status !== 'ALL') {
    requests = requests.filter(r => r.status === status);
  }
  if (category && category !== 'ALL') {
    requests = requests.filter(r => r.category === category);
  }

  res.json({
    success: true,
    count: requests.length,
    requests
  });
};

// GET /api/requests/:id
export const getRequestById = (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const request = db.requests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  res.json({ success: true, request });
};

// POST /api/requests (Create request)
export const createRequest = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { title, category, requestType, amount, description, purpose, requestDetails } = req.body;

  if (!title || !amount) {
    return res.status(400).json({ success: false, message: 'Title and amount are required' });
  }

  const nextNum = db.requests.length + 1;
  const newId = `REQ-00${nextNum}`;
  const nowTs = formatTimestamp();

  const newRequest: ApprovalRequest = {
    id: newId,
    title: title.trim(),
    department: user.dept,
    amount: parseInt(amount, 10),
    date: formatDate(),
    status: 'PENDING',
    category: (category as RequestCategory) || 'Other',
    requestType: (requestType as RequestCategory) || (category as RequestCategory) || 'Other',
    requester: user.name,
    description: description ? description.trim() : '',
    hoursIdle: 0,
    company: user.company,
    businessUnit: user.businessUnit,
    purpose: purpose ? purpose.trim() : description ? description.trim() : '',
    requestDetails,
    auditTrail: [
      { ts: nowTs, actor: user.name, action: 'Request submitted' },
      { ts: nowTs, actor: 'System', action: 'Assigned to approver' }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.requests.unshift(newRequest);

  res.status(201).json({
    success: true,
    message: 'Request submitted successfully!',
    request: newRequest
  });
};

// POST /api/requests/:id/approve
export const approveRequest = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const request = db.requests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  const actionDesc = user.role === 'AUTHORITY'
    ? 'Approved by higher authority'
    : 'Request approved by approver';

  request.status = 'APPROVED';
  request.hoursIdle = 0;
  request.updatedAt = new Date().toISOString();
  request.auditTrail.push({
    ts: formatTimestamp(),
    actor: user.name,
    action: actionDesc
  });

  res.json({ success: true, message: 'Request approved', request });
};

// POST /api/requests/:id/reject
export const rejectRequest = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { reason } = req.body;
  const request = db.requests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  const actionDesc = user.role === 'AUTHORITY'
    ? 'Rejected by higher authority'
    : `Request rejected by approver${reason ? ` — ${reason}` : ''}`;

  request.status = 'REJECTED';
  request.hoursIdle = 0;
  request.updatedAt = new Date().toISOString();
  request.auditTrail.push({
    ts: formatTimestamp(),
    actor: user.name,
    action: actionDesc
  });

  res.json({ success: true, message: 'Request rejected', request });
};

// POST /api/requests/:id/query (Approver raises query)
export const raiseQuery = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { query } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ success: false, message: 'Query text is required' });
  }

  const request = db.requests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  request.status = 'QUERIED';
  request.query = query.trim();
  request.hoursIdle = 0;
  request.updatedAt = new Date().toISOString();
  request.auditTrail.push({
    ts: formatTimestamp(),
    actor: user.name,
    action: `Query raised: "${query.trim()}"`
  });

  res.json({ success: true, message: 'Query sent to requester', request });
};

// POST /api/requests/:id/respond (Requester responds to query)
export const respondToQuery = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { response } = req.body;

  if (!response || !response.trim()) {
    return res.status(400).json({ success: false, message: 'Response text is required' });
  }

  const request = db.requests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  request.status = 'PENDING';
  delete request.query;
  request.hoursIdle = 0;
  request.updatedAt = new Date().toISOString();
  request.auditTrail.push({
    ts: formatTimestamp(),
    actor: user.name,
    action: `Requester responded: "${response.trim()}"`
  });

  res.json({ success: true, message: 'Response submitted', request });
};

// POST /api/requests/:id/escalate
export const escalateRequest = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const request = db.requests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  request.status = 'ESCALATED';
  request.hoursIdle = 0;
  request.updatedAt = new Date().toISOString();
  request.auditTrail.push({
    ts: formatTimestamp(),
    actor: user.name,
    action: 'Escalated to higher authority'
  });

  res.json({ success: true, message: 'Request escalated', request });
};

// POST /api/requests/:id/reassign
export const reassignRequest = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { targetUserId } = req.body;
  const request = db.requests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  if (user.role !== 'CEO') {
    return res.status(403).json({ success: false, message: 'Only the CEO can reassign escalated requests' });
  }
  if (request.status !== 'ESCALATED') {
    return res.status(400).json({ success: false, message: 'Only escalated requests can be reassigned' });
  }

  const targetUser = db.users.find(candidate => candidate.id === targetUserId && candidate.id !== user.id);
  if (!targetUser) {
    return res.status(400).json({ success: false, message: 'Choose a valid user to receive this request' });
  }

  request.status = 'PENDING';
  request.hoursIdle = 0;
  request.assignedUserId = targetUser.id;
  request.assignedRole = targetUser.role;
  request.updatedAt = new Date().toISOString();
  request.auditTrail.push({
    ts: formatTimestamp(),
    actor: user.name,
    action: `Escalated request reassigned to ${targetUser.name} (${targetUser.role}) by CEO`
  });

  res.json({ success: true, message: 'Request reassigned', request });
};
