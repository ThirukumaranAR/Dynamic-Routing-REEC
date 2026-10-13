"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRole = exports.POST_DEAN_BRANCHES = void 0;
exports.POST_DEAN_BRANCHES = ['IT', 'AUDIT', 'HR', 'MMI'];
const normalizeRole = (role) => {
    if (!role)
        return '';
    return role.trim().toUpperCase().replace(/[\s-]+/g, '_');
};
exports.normalizeRole = normalizeRole;
