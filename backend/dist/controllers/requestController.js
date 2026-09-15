"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reassignRequest = exports.escalateRequest = exports.respondToQuery = exports.raiseQuery = exports.rejectRequest = exports.approveRequest = exports.createRequest = exports.getRequestById = exports.getAllRequests = void 0;
const db_1 = require("../services/db");
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
const getAllRequests = (req, res) => {
    const user = req.user;
    let requests = [...db_1.db.requests];
    // Role-based visibility
    if (user.role === 'REQUESTER') {
        requests = requests.filter(r => r.requester === user.name);
    }
    else if (user.role === 'AUTHORITY') {
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
exports.getAllRequests = getAllRequests;
// GET /api/requests/:id
const getRequestById = (req, res) => {
    const { id } = req.params;
    const request = db_1.db.requests.find(r => r.id === id);
    if (!request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
    }
    res.json({ success: true, request });
};
exports.getRequestById = getRequestById;
// POST /api/requests (Create request)
const createRequest = (req, res) => {
    const user = req.user;
    const { title, category, requestType, amount, description, purpose, requestDetails } = req.body;
    if (!title || !amount) {
        return res.status(400).json({ success: false, message: 'Title and amount are required' });
    }
    const nextNum = db_1.db.requests.length + 1;
    const newId = `REQ-00${nextNum}`;
    const nowTs = formatTimestamp();
    const newRequest = {
        id: newId,
        title: title.trim(),
        department: user.dept,
        amount: parseInt(amount, 10),
        date: formatDate(),
        status: 'PENDING',
        category: category || 'Other',
        requestType: requestType || category || 'Other',
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
    db_1.db.requests.unshift(newRequest);
    res.status(201).json({
        success: true,
        message: 'Request submitted successfully!',
        request: newRequest
    });
};
exports.createRequest = createRequest;
// POST /api/requests/:id/approve
const approveRequest = (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const request = db_1.db.requests.find(r => r.id === id);
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
exports.approveRequest = approveRequest;
// POST /api/requests/:id/reject
const rejectRequest = (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { reason } = req.body;
    const request = db_1.db.requests.find(r => r.id === id);
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
exports.rejectRequest = rejectRequest;
// POST /api/requests/:id/query (Approver raises query)
const raiseQuery = (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { query } = req.body;
    if (!query || !query.trim()) {
        return res.status(400).json({ success: false, message: 'Query text is required' });
    }
    const request = db_1.db.requests.find(r => r.id === id);
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
exports.raiseQuery = raiseQuery;
// POST /api/requests/:id/respond (Requester responds to query)
const respondToQuery = (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { response } = req.body;
    if (!response || !response.trim()) {
        return res.status(400).json({ success: false, message: 'Response text is required' });
    }
    const request = db_1.db.requests.find(r => r.id === id);
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
exports.respondToQuery = respondToQuery;
// POST /api/requests/:id/escalate
const escalateRequest = (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const request = db_1.db.requests.find(r => r.id === id);
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
exports.escalateRequest = escalateRequest;
// POST /api/requests/:id/reassign
const reassignRequest = (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { targetUserId } = req.body;
    const request = db_1.db.requests.find(r => r.id === id);
    if (!request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (user.role !== 'CEO') {
        return res.status(403).json({ success: false, message: 'Only the CEO can reassign escalated requests' });
    }
    if (request.status !== 'ESCALATED') {
        return res.status(400).json({ success: false, message: 'Only escalated requests can be reassigned' });
    }
    const targetUser = db_1.db.users.find(candidate => candidate.id === targetUserId && candidate.id !== user.id);
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
exports.reassignRequest = reassignRequest;
