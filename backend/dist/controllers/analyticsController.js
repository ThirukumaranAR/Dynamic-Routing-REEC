"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSOPs = exports.getFlowCategories = exports.getDashboardStats = void 0;
const db_1 = require("../services/db");
const getDashboardStats = (req, res) => {
    const user = req.user;
    let requests = [...db_1.db.requests];
    if (user.role === 'REQUESTER') {
        requests = requests.filter(r => r.requester === user.name);
    }
    else if (user.role === 'AUTHORITY') {
        requests = requests.filter(r => r.status === 'ESCALATED');
    }
    const total = requests.length;
    const pending = requests.filter(r => r.status === 'PENDING').length;
    const approved = requests.filter(r => r.status === 'APPROVED').length;
    const rejected = requests.filter(r => r.status === 'REJECTED').length;
    const queries = requests.filter(r => r.status === 'QUERIED').length;
    const escalated = requests.filter(r => r.status === 'ESCALATED').length;
    const policies = db_1.db.sops.length;
    const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const rejectionRate = total > 0 ? Math.round((rejected / total) * 100) : 0;
    res.json({
        success: true,
        metrics: {
            total,
            pending,
            approved,
            rejected,
            queries,
            escalated,
            policies
        },
        completionAnalytics: {
            completionRate: `${completionRate}%`,
            approvedRatio: `${approved} of ${total} requests approved`,
            pendingResolution: pending + queries,
            rejectionRate: `${rejectionRate}%`,
            rejectedCount: `${rejected} requests rejected`,
            avgResolutionTime: '4.2h',
            slaThreshold: 'Below 10h SLA threshold'
        },
        statusBreakdown: [
            { status: 'APPROVED', count: approved, percentage: total ? Math.round((approved / total) * 100) : 0 },
            { status: 'PENDING', count: pending, percentage: total ? Math.round((pending / total) * 100) : 0 },
            { status: 'QUERIED', count: queries, percentage: total ? Math.round((queries / total) * 100) : 0 },
            { status: 'REJECTED', count: rejected, percentage: total ? Math.round((rejected / total) * 100) : 0 },
            { status: 'ESCALATED', count: escalated, percentage: total ? Math.round((escalated / total) * 100) : 0 }
        ],
        recentRequests: requests.slice(0, 5)
    });
};
exports.getDashboardStats = getDashboardStats;
const getFlowCategories = (req, res) => {
    const categories = ['Leave', 'Permission', 'Purchase', 'Travel', 'Equipment', 'Reimbursement', 'Work From Home', 'Other'];
    const categoryStats = categories.map((cat, idx) => {
        const count = db_1.db.requests.filter(r => r.category === cat).length;
        const colorSchemes = [
            'bg-blue-50 text-blue-700',
            'bg-purple-50 text-purple-700',
            'bg-green-50 text-green-700',
            'bg-orange-50 text-orange-700',
            'bg-yellow-50 text-yellow-700',
            'bg-pink-50 text-pink-700'
        ];
        return {
            category: cat,
            count,
            colorClass: colorSchemes[idx % colorSchemes.length],
            description: 'Requests in this category'
        };
    });
    res.json({
        success: true,
        categories: categoryStats
    });
};
exports.getFlowCategories = getFlowCategories;
const getSOPs = (req, res) => {
    res.json({
        success: true,
        sops: db_1.db.sops
    });
};
exports.getSOPs = getSOPs;
