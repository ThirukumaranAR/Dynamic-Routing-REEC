"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectWorkflowStep = exports.approveWorkflowStep = exports.routeRequestToBranch = exports.ensureRequestWorkflow = exports.initializeRequestWorkflow = exports.getDefaultGeneralWorkflow = exports.validateDepartmentWorkflowConfig = exports.getDefaultWorkflowById = exports.getDefaultDepartmentWorkflow = exports.getDepartmentRoleForRequestType = exports.resolveWorkflowIdForRequestType = exports.getDefaultStagesForDepartment = exports.WORKFLOW_CONFIG_LIST = exports.createRequestStageInstances = exports.isFinanceCategory = exports.validateWorkflowConfig = exports.determineDefaultBranchForCategory = exports.getRoleDisplayName = exports.captureActiveWorkflowSnapshots = exports.validateActiveWorkflows = exports.validateWorkflow = exports.createDefaultWorkflows = void 0;
const roleLabel = (role) => ({
    MANAGER: 'Manager', HR: 'HR Head', IT: 'IT Head', FINANCE: 'Finance Head',
    ACCOUNTANT: 'Accountant', GENERAL_MANAGER: 'General Manager', CEO: 'CEO', CHAIRMAN: 'Chairman'
}[role] || role);
const createDefaultWorkflows = () => [
    { id: 'workflow-hr', name: 'HR Approval', branch: 'HR', version: 1, steps: ['MANAGER', 'HR', 'GENERAL_MANAGER', 'CEO'].map((role, index) => ({ id: `hr-${index + 1}`, role })), active: true, updatedAt: new Date(0).toISOString() },
    { id: 'workflow-it', name: 'IT Approval', branch: 'IT', version: 1, steps: ['MANAGER', 'IT', 'GENERAL_MANAGER', 'CEO'].map((role, index) => ({ id: `it-${index + 1}`, role })), active: true, updatedAt: new Date(0).toISOString() },
    { id: 'workflow-finance', name: 'Finance Approval', branch: 'FINANCE', version: 1, steps: ['MANAGER', 'FINANCE', 'ACCOUNTANT', 'GENERAL_MANAGER', 'CEO'].map((role, index) => ({ id: `finance-${index + 1}`, role })), active: true, updatedAt: new Date(0).toISOString() }
];
exports.createDefaultWorkflows = createDefaultWorkflows;
const validateWorkflow = (workflow, roles) => {
    const errors = [];
    const normalizedRoles = new Set(roles.map(role => role.trim().toUpperCase()));
    const stepRoles = (workflow.steps || []).map(step => step.role.trim().toUpperCase());
    if (!workflow.name.trim())
        errors.push('Workflow name is required.');
    if (workflow.steps.length < 4)
        errors.push('At least four approval steps are required.');
    if (stepRoles[0] !== 'MANAGER')
        errors.push('Manager must be the first step.');
    if (stepRoles[stepRoles.length - 1] !== 'CEO')
        errors.push('CEO must be the final step.');
    if (!stepRoles.includes('GENERAL_MANAGER'))
        errors.push('General Manager must remain in the workflow.');
    stepRoles.forEach(role => {
        if (!normalizedRoles.has(role))
            errors.push(`Unknown approval role: ${role}.`);
        if (role === 'REQUESTER')
            errors.push('Requester cannot be an approval step.');
        if (role === 'CHAIRMAN')
            errors.push('Chairman cannot replace the CEO final workflow role.');
    });
    if (workflow.branch === 'HR' && !stepRoles.includes('HR'))
        errors.push('HR workflow must include HR Head.');
    if (workflow.branch === 'IT' && !stepRoles.includes('IT'))
        errors.push('IT workflow must include IT Head.');
    if (workflow.branch === 'FINANCE' && !stepRoles.includes('ACCOUNTANT'))
        errors.push('Finance workflow must include Accountant.');
    return [...new Set(errors)];
};
exports.validateWorkflow = validateWorkflow;
const validateActiveWorkflows = (workflows, roles) => {
    const active = workflows.filter(workflow => workflow.active);
    const errors = active.flatMap(workflow => (0, exports.validateWorkflow)(workflow, roles));
    for (const branch of ['HR', 'IT', 'FINANCE']) {
        if (active.filter(workflow => workflow.branch === branch).length > 1) {
            errors.push(`Only one active workflow may be configured for ${branch}.`);
        }
    }
    return [...new Set(errors)];
};
exports.validateActiveWorkflows = validateActiveWorkflows;
const captureActiveWorkflowSnapshots = (workflows) => Object.fromEntries((workflows || []).filter(workflow => workflow && workflow.active).map(workflow => [workflow.branch, {
        id: workflow.id,
        name: workflow.name,
        branch: workflow.branch,
        version: workflow.version,
        steps: (workflow.steps || []).map(step => ({ ...step }))
    }]));
exports.captureActiveWorkflowSnapshots = captureActiveWorkflowSnapshots;
const getRoleDisplayName = (role) => {
    switch (role) {
        case 'REQUESTER': return 'Requester';
        case 'INSTITUTION_MANAGER': return 'Institution Manager';
        case 'FINANCE': return 'Finance';
        case 'ACCOUNTANT': return 'Accountant';
        case 'VP': return 'VP';
        case 'HOI': return 'HOI';
        case 'DEAN': return 'Dean';
        case 'IT': return 'IT Branch';
        case 'AUDIT': return 'Audit Branch';
        case 'HR': return 'HR Branch';
        case 'MMI': return 'MMI Branch';
        case 'GENERAL_MANAGER':
        case 'GM': return 'General Manager';
        case 'CEO': return 'CEO';
        case 'CHAIRMAN': return 'Chairman';
        case 'MANAGER': return 'Manager';
        default: return role.replace(/_/g, ' ');
    }
};
exports.getRoleDisplayName = getRoleDisplayName;
const determineDefaultBranchForCategory = (category) => {
    switch (category) {
        case 'Leave':
        case 'Permission':
            return 'HR';
        case 'Equipment':
        case 'Work From Home':
            return 'IT';
        case 'Purchase':
        case 'Reimbursement':
            return 'AUDIT';
        case 'Other':
        case 'Travel':
        default:
            return 'MMI';
    }
};
exports.determineDefaultBranchForCategory = determineDefaultBranchForCategory;
const validateWorkflowConfig = (payload, roles) => {
    const errors = [];
    const normalizedRoles = new Set(roles.map(r => r.trim().toUpperCase()));
    if (!payload || !payload.name?.trim()) {
        errors.push('Workflow name is required.');
    }
    const stages = payload?.stages || payload?.preDeanStages || [];
    const branchConfigs = payload?.branchConfigs || [];
    const stageRoles = stages.map((s) => String(s.role || '').trim().toUpperCase());
    // Check for duplicates
    const seenRoles = new Set();
    for (const r of stageRoles) {
        if (seenRoles.has(r)) {
            errors.push(`Duplicate approval stage: ${r}`);
        }
        seenRoles.add(r);
    }
    // Must include Dean stage as the branch checkpoint
    if (!stageRoles.includes('DEAN')) {
        errors.push('Workflow must include the Dean stage as the branch checkpoint.');
    }
    // Check valid roles
    for (const r of stageRoles) {
        if (!normalizedRoles.has(r)) {
            errors.push(`Unknown approval role: ${r}.`);
        }
    }
    const chairIdx = stageRoles.lastIndexOf('CHAIRMAN');
    if (chairIdx !== -1 && chairIdx !== stageRoles.length - 1) {
        errors.push('Chairman must remain the final authority stage.');
    }
    // Required branches in branchConfigs
    const branchKeysSet = new Set(branchConfigs.filter((b) => b.isActive !== false).map((b) => String(b.branchKey || '').toUpperCase()));
    if (!branchKeysSet.has('IT'))
        errors.push('Workflow must include IT branch.');
    if (!branchKeysSet.has('AUDIT'))
        errors.push('Workflow must include AUDIT branch.');
    if (!branchKeysSet.has('HR'))
        errors.push('Workflow must include HR branch.');
    if (!branchKeysSet.has('MMI'))
        errors.push('Workflow must include MMI branch.');
    return [...new Set(errors)];
};
exports.validateWorkflowConfig = validateWorkflowConfig;
const isFinanceCategory = (category, requestType) => {
    const c = String(category || '').trim().toLowerCase();
    const rt = String(requestType || '').trim().toLowerCase();
    return c === 'purchase' || c === 'reimbursement' || c === 'finance' ||
        rt === 'purchase' || rt === 'reimbursement' || rt === 'finance';
};
exports.isFinanceCategory = isFinanceCategory;
const createRequestStageInstances = (workflowVersion, branch, category) => {
    const stages = [];
    const rawStages = workflowVersion?.stages || [];
    let foundPending = false;
    let initialStage = 'PENDING';
    const validBranches = ['IT', 'AUDIT', 'HR', 'MMI'];
    const chosenBranch = validBranches.includes(String(branch || '').toUpperCase()) ? String(branch).toUpperCase() : 'HR';
    // Filter rawStages so any branch roles are removed; the single chosen alternative branch is placed after Dean
    const nonBranchStages = rawStages.filter((s) => !validBranches.includes(String(s.role || '').toUpperCase()) && s.stageType !== 'BRANCH');
    nonBranchStages.forEach((s, idx) => {
        const isApplicable = s.isApplicable !== false;
        let status = 'FUTURE';
        if (!isApplicable) {
            status = 'SKIPPED';
        }
        else if (!foundPending) {
            status = 'PENDING';
            initialStage = s.role;
            foundPending = true;
        }
        stages.push({
            id: s.id || `stg-${idx + 1}`,
            stageIndex: idx,
            stageKey: s.stageKey || `STAGE_${s.role}`,
            role: s.role,
            label: s.label || (0, exports.getRoleDisplayName)(s.role),
            stageType: s.stageType || (s.role === 'DEAN' ? 'DEAN' : (s.role === 'CEO' || s.role === 'CHAIRMAN') ? 'POST_BRANCH' : 'PRE_DEAN'),
            status,
            isApplicable
        });
    });
    // Insert the single chosen branch stage right after Dean
    const deanIdx = stages.findIndex(s => s.role === 'DEAN');
    const insertIdx = deanIdx >= 0 ? deanIdx + 1 : stages.length;
    stages.splice(insertIdx, 0, {
        id: `stg-branch-${chosenBranch}`,
        stageIndex: insertIdx,
        stageKey: 'STAGE_BRANCH',
        role: chosenBranch,
        label: `${chosenBranch} Branch Head`,
        stageType: 'BRANCH',
        status: 'FUTURE',
        isApplicable: true
    });
    // Re-index
    stages.forEach((s, i) => { s.stageIndex = i; });
    return { stages, initialStage };
};
exports.createRequestStageInstances = createRequestStageInstances;
exports.WORKFLOW_CONFIG_LIST = [
    { id: 'workflow-general', name: 'General Workflow', department: null, description: 'Default general multi-tier institutional approval workflow' },
    { id: 'workflow-hr', name: 'HR Department Workflow', department: 'HR', description: 'Institutional approval route for HR Requests' },
    { id: 'workflow-it', name: 'IT Department Workflow', department: 'IT', description: 'Institutional approval route for IT Requests' },
    { id: 'workflow-audit', name: 'Audit Department Workflow', department: 'AUDIT', description: 'Institutional approval route for Audit Requests' },
    { id: 'workflow-mmi', name: 'MMI Department Workflow', department: 'MMI', description: 'Institutional approval route for MMI Requests' }
];
const getDefaultStagesForDepartment = (deptRole) => [
    { id: `stg-${deptRole}-1`, stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'Institution Manager', stageOrder: 1, stageType: 'PRE_DEAN', isApplicable: true },
    { id: `stg-${deptRole}-2`, stageKey: 'STAGE_FINANCE', role: 'FINANCE', label: 'Finance Head', stageOrder: 2, stageType: 'PRE_DEAN', isApplicable: true },
    { id: `stg-${deptRole}-3`, stageKey: 'STAGE_ACCOUNTANT', role: 'ACCOUNTANT', label: 'Accountant', stageOrder: 3, stageType: 'PRE_DEAN', isApplicable: true },
    { id: `stg-${deptRole}-4`, stageKey: 'STAGE_VP', role: 'VP', label: 'Vice President', stageOrder: 4, stageType: 'PRE_DEAN', isApplicable: true },
    { id: `stg-${deptRole}-5`, stageKey: 'STAGE_HOI', role: 'HOI', label: 'Head of Institution', stageOrder: 5, stageType: 'PRE_DEAN', isApplicable: true },
    { id: `stg-${deptRole}-6`, stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean Checkpoint', stageOrder: 6, stageType: 'DEAN', isApplicable: true },
    { id: `stg-${deptRole}-7`, stageKey: `STAGE_${deptRole}`, role: deptRole, label: `${deptRole} Branch Head`, stageOrder: 7, stageType: 'BRANCH', isApplicable: true },
    { id: `stg-${deptRole}-8`, stageKey: 'STAGE_CEO', role: 'CEO', label: 'Chief Executive Officer', stageOrder: 8, stageType: 'POST_BRANCH', isApplicable: true },
    { id: `stg-${deptRole}-9`, stageKey: 'STAGE_CHAIRMAN', role: 'CHAIRMAN', label: 'Chairman', stageOrder: 9, stageType: 'POST_BRANCH', isApplicable: true }
];
exports.getDefaultStagesForDepartment = getDefaultStagesForDepartment;
const resolveWorkflowIdForRequestType = (requestType) => {
    const norm = String(requestType || '').trim();
    if (/^it(\s+request)?$/i.test(norm))
        return 'workflow-it';
    if (/^audit(\s+request)?$/i.test(norm))
        return 'workflow-audit';
    if (/^hr(\s+request)?$/i.test(norm))
        return 'workflow-hr';
    if (/^mmi(\s+request)?$/i.test(norm))
        return 'workflow-mmi';
    return 'workflow-general';
};
exports.resolveWorkflowIdForRequestType = resolveWorkflowIdForRequestType;
const getDepartmentRoleForRequestType = (requestType) => {
    const norm = String(requestType || '').trim();
    if (/^it(\s+request)?$/i.test(norm))
        return 'IT';
    if (/^audit(\s+request)?$/i.test(norm))
        return 'AUDIT';
    if (/^hr(\s+request)?$/i.test(norm))
        return 'HR';
    if (/^mmi(\s+request)?$/i.test(norm))
        return 'MMI';
    return null;
};
exports.getDepartmentRoleForRequestType = getDepartmentRoleForRequestType;
const getDefaultDepartmentWorkflow = (deptRole) => {
    const meta = exports.WORKFLOW_CONFIG_LIST.find(w => w.department === deptRole);
    const id = meta?.id || `workflow-${deptRole.toLowerCase()}`;
    const name = meta?.name || `${deptRole} Department Workflow`;
    return {
        id,
        name,
        version: 1,
        active: true,
        activatedAt: new Date(0).toISOString(),
        activatedBy: 'System',
        stages: (0, exports.getDefaultStagesForDepartment)(deptRole),
        branchConfigs: [],
        history: [
            { version: 1, activatedAt: new Date(0).toISOString(), activatedBy: 'System', reason: `Initial default configuration for ${name}` }
        ]
    };
};
exports.getDefaultDepartmentWorkflow = getDefaultDepartmentWorkflow;
const getDefaultWorkflowById = (id) => {
    if (id === 'workflow-hr')
        return (0, exports.getDefaultDepartmentWorkflow)('HR');
    if (id === 'workflow-it')
        return (0, exports.getDefaultDepartmentWorkflow)('IT');
    if (id === 'workflow-audit')
        return (0, exports.getDefaultDepartmentWorkflow)('AUDIT');
    if (id === 'workflow-mmi')
        return (0, exports.getDefaultDepartmentWorkflow)('MMI');
    return (0, exports.getDefaultGeneralWorkflow)();
};
exports.getDefaultWorkflowById = getDefaultWorkflowById;
const validateDepartmentWorkflowConfig = (payload, roles, deptRole) => {
    const errors = [];
    const normalizedRoles = new Set(roles.map(r => r.trim().toUpperCase()));
    if (!payload || !payload.name?.trim()) {
        errors.push('Workflow name is required.');
    }
    const stages = payload?.stages || [];
    if (!Array.isArray(stages) || stages.length < 9) {
        errors.push('Workflow must contain all required stages (at least 9 stages).');
    }
    const stageRoles = stages.map((s) => String(s.role || '').trim().toUpperCase());
    // Check duplicate roles
    const seenRoles = new Set();
    for (const r of stageRoles) {
        if (seenRoles.has(r)) {
            errors.push(`Duplicate approval stage: ${r}`);
        }
        seenRoles.add(r);
    }
    // Check valid roles
    for (const r of stageRoles) {
        if (!normalizedRoles.has(r)) {
            errors.push(`Unknown approval role: ${r}.`);
        }
    }
    // Mandatory role presence
    const requiredRoles = ['INSTITUTION_MANAGER', 'FINANCE', 'ACCOUNTANT', 'VP', 'HOI', 'DEAN', 'CEO', 'CHAIRMAN'];
    if (deptRole)
        requiredRoles.splice(6, 0, deptRole.toUpperCase());
    for (const reqRole of requiredRoles) {
        if (!stageRoles.includes(reqRole)) {
            errors.push(`Workflow must include mandatory role: ${(0, exports.getRoleDisplayName)(reqRole)}.`);
        }
    }
    // Mandatory relative ordering:
    // 1. Institution Manager precedes Finance.
    // 2. Finance precedes Accountant.
    // 3. Accountant precedes VP.
    // 4. VP precedes HOI.
    // 5. HOI precedes Dean.
    // 6. Dean precedes the selected department.
    // 7. The selected department precedes CEO.
    // 8. CEO precedes Chairman.
    // 9. Chairman is the final stage.
    const imIdx = stageRoles.indexOf('INSTITUTION_MANAGER');
    const finIdx = stageRoles.indexOf('FINANCE');
    const accIdx = stageRoles.indexOf('ACCOUNTANT');
    const vpIdx = stageRoles.indexOf('VP');
    const hoiIdx = stageRoles.indexOf('HOI');
    const deanIdx = stageRoles.indexOf('DEAN');
    const targetDeptIdx = deptRole ? stageRoles.indexOf(deptRole.toUpperCase()) : -1;
    const ceoIdx = stageRoles.indexOf('CEO');
    const chairIdx = stageRoles.lastIndexOf('CHAIRMAN');
    if (imIdx !== -1 && finIdx !== -1 && imIdx >= finIdx)
        errors.push('Institution Manager must precede Finance.');
    if (finIdx !== -1 && accIdx !== -1 && finIdx >= accIdx)
        errors.push('Finance must precede Accountant.');
    if (accIdx !== -1 && vpIdx !== -1 && accIdx >= vpIdx)
        errors.push('Accountant must precede VP.');
    if (vpIdx !== -1 && hoiIdx !== -1 && vpIdx >= hoiIdx)
        errors.push('VP must precede HOI.');
    if (hoiIdx !== -1 && deanIdx !== -1 && hoiIdx >= deanIdx)
        errors.push('HOI must precede Dean.');
    if (deptRole && deanIdx !== -1 && targetDeptIdx !== -1 && deanIdx >= targetDeptIdx) {
        errors.push(`Dean must precede ${deptRole} Branch.`);
    }
    if (deptRole && targetDeptIdx !== -1 && ceoIdx !== -1 && targetDeptIdx >= ceoIdx) {
        errors.push(`${deptRole} Branch must precede CEO.`);
    }
    if (ceoIdx !== -1 && chairIdx !== -1 && ceoIdx >= chairIdx)
        errors.push('CEO must precede Chairman.');
    if (chairIdx !== -1 && chairIdx !== stageRoles.length - 1) {
        errors.push('Chairman must remain the final approval authority stage.');
    }
    return [...new Set(errors)];
};
exports.validateDepartmentWorkflowConfig = validateDepartmentWorkflowConfig;
const getDefaultGeneralWorkflow = () => ({
    id: 'workflow-general',
    name: 'General Workflow',
    version: 1,
    active: true,
    activatedAt: new Date(0).toISOString(),
    activatedBy: 'System',
    stages: [
        { id: 'gw-1', stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'Institution Manager', stageOrder: 1, stageType: 'PRE_DEAN', isApplicable: true },
        { id: 'gw-2', stageKey: 'STAGE_FINANCE', role: 'FINANCE', label: 'Finance Head', stageOrder: 2, stageType: 'PRE_DEAN', isApplicable: true },
        { id: 'gw-3', stageKey: 'STAGE_ACCOUNTANT', role: 'ACCOUNTANT', label: 'Accountant', stageOrder: 3, stageType: 'PRE_DEAN', isApplicable: true },
        { id: 'gw-4', stageKey: 'STAGE_VP', role: 'VP', label: 'Vice President', stageOrder: 4, stageType: 'PRE_DEAN', isApplicable: true },
        { id: 'gw-5', stageKey: 'STAGE_HOI', role: 'HOI', label: 'Head of Institution', stageOrder: 5, stageType: 'PRE_DEAN', isApplicable: true },
        { id: 'gw-6', stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean Checkpoint', stageOrder: 6, stageType: 'DEAN', isApplicable: true },
        { id: 'gw-7', stageKey: 'STAGE_CEO', role: 'CEO', label: 'Chief Executive Officer', stageOrder: 7, stageType: 'POST_BRANCH', isApplicable: true },
        { id: 'gw-8', stageKey: 'STAGE_CHAIRMAN', role: 'CHAIRMAN', label: 'Chairman', stageOrder: 8, stageType: 'POST_BRANCH', isApplicable: true }
    ],
    branchConfigs: [
        { branchKey: 'IT', displayName: 'IT Branch', role: 'IT', isActive: true },
        { branchKey: 'AUDIT', displayName: 'Audit Branch', role: 'AUDIT', isActive: true },
        { branchKey: 'HR', displayName: 'HR Branch', role: 'HR', isActive: true },
        { branchKey: 'MMI', displayName: 'MMI Branch', role: 'MMI', isActive: true }
    ],
    history: [
        { version: 1, activatedAt: new Date(0).toISOString(), activatedBy: 'System', reason: 'Initial baseline workflow configuration' }
    ]
});
exports.getDefaultGeneralWorkflow = getDefaultGeneralWorkflow;
const initializeRequestWorkflow = (request, workflows, generalWorkflow, resolvedWorkflow) => {
    // 1. Departmental / Specific Workflow
    if (resolvedWorkflow && Array.isArray(resolvedWorkflow.stages) && resolvedWorkflow.stages.length > 0) {
        const rawStages = resolvedWorkflow.stages;
        let foundPending = false;
        let initialStage = 'PENDING';
        const deptRole = (0, exports.getDepartmentRoleForRequestType)(request.requestType) || request.selectedBranch || 'HR';
        const stages = rawStages.map((s, idx) => {
            const isApplicable = s.isApplicable !== false;
            let status = 'FUTURE';
            if (!isApplicable) {
                status = 'SKIPPED';
            }
            else if (!foundPending) {
                status = 'PENDING';
                initialStage = s.role;
                foundPending = true;
            }
            return {
                id: s.id || `stg-${idx + 1}`,
                stageIndex: idx,
                stageKey: s.stageKey || `STAGE_${s.role}`,
                role: s.role,
                label: s.label || (0, exports.getRoleDisplayName)(s.role),
                stageType: s.stageType || (s.role === 'DEAN' ? 'DEAN' : (s.role === 'CEO' || s.role === 'CHAIRMAN') ? 'POST_BRANCH' : (s.role === deptRole ? 'BRANCH' : 'PRE_DEAN')),
                status,
                isApplicable
            };
        });
        const activeSteps = stages.filter(s => s.isApplicable !== false).map(s => ({ id: s.id, role: s.role }));
        return {
            ...request,
            status: request.status || 'PENDING',
            workflowVersionNumber: resolvedWorkflow.version || 1,
            workflowVersionId: resolvedWorkflow.id,
            stages,
            workflowSnapshot: {
                id: resolvedWorkflow.id,
                name: resolvedWorkflow.name,
                branch: deptRole,
                version: resolvedWorkflow.version || 1,
                steps: activeSteps
            },
            currentStage: initialStage || 'INSTITUTION_MANAGER',
            currentStepIndex: 0,
            assignedRole: initialStage || 'INSTITUTION_MANAGER',
            selectedBranch: deptRole,
            workflowSnapshotsByBranch: (0, exports.captureActiveWorkflowSnapshots)(workflows),
            approvalHistory: [],
            migrationEvents: []
        };
    }
    // 2. Fallback to General Workflow
    if (!generalWorkflow) {
        return {
            ...request,
            currentStage: request.currentStage || 'INSTITUTION_MANAGER',
            currentStepIndex: 0,
            assignedRole: request.assignedRole || 'INSTITUTION_MANAGER',
            workflowSnapshotsByBranch: (0, exports.captureActiveWorkflowSnapshots)(workflows),
            approvalHistory: request.approvalHistory || []
        };
    }
    const gw = generalWorkflow;
    const branch = (request.category ? (0, exports.determineDefaultBranchForCategory)(request.category) : 'HR');
    const { stages, initialStage } = (0, exports.createRequestStageInstances)(gw, branch, request.category);
    const activeSteps = stages.filter(s => s.isApplicable !== false).map(s => ({ id: s.id, role: s.role }));
    return {
        ...request,
        status: request.status || 'PENDING',
        workflowVersionNumber: gw.version || 1,
        workflowVersionId: gw.id || 'workflow-general',
        stages,
        workflowSnapshot: {
            id: gw.id || 'workflow-general',
            name: gw.name || 'General Workflow',
            branch: branch,
            version: gw.version || 1,
            steps: activeSteps
        },
        currentStage: initialStage || 'INSTITUTION_MANAGER',
        currentStepIndex: 0,
        assignedRole: initialStage || 'INSTITUTION_MANAGER',
        selectedBranch: branch,
        workflowSnapshotsByBranch: (0, exports.captureActiveWorkflowSnapshots)(workflows),
        approvalHistory: [],
        migrationEvents: []
    };
};
exports.initializeRequestWorkflow = initializeRequestWorkflow;
const branchForCategory = (category) => {
    if (category === 'Leave' || category === 'Permission')
        return 'HR';
    if (category === 'Equipment' || category === 'Work From Home')
        return 'IT';
    return 'FINANCE';
};
const ensureRequestWorkflow = (request, workflows) => {
    if (request.workflowSnapshot || request.workflowSnapshotsByBranch)
        return request;
    const snapshots = (0, exports.captureActiveWorkflowSnapshots)(workflows);
    const routed = request.auditTrail.find(entry => /routed to (HR|IT|Finance)/i.test(entry.action))?.action.match(/routed to (HR|IT|Finance)/i)?.[1]?.toUpperCase();
    const branch = routed === 'HR' || request.currentStage === 'HR' ? 'HR'
        : routed === 'IT' || request.currentStage === 'IT' ? 'IT'
            : branchForCategory(request.category);
    const snapshot = snapshots[branch];
    if (request.status === 'APPROVED' || request.status === 'REJECTED' || request.currentStage === 'MANAGER') {
        return { ...request, workflowSnapshotsByBranch: snapshots, currentStepIndex: 0, approvalHistory: [] };
    }
    const currentStepIndex = snapshot?.steps.findIndex(step => step.role === request.currentStage) ?? -1;
    return {
        ...request,
        workflowSnapshotsByBranch: snapshots,
        workflowSnapshot: snapshot,
        currentStepIndex: currentStepIndex >= 0 ? currentStepIndex : 0,
        approvalHistory: []
    };
};
exports.ensureRequestWorkflow = ensureRequestWorkflow;
const addHistory = (request, user, action, ts, stepIndex) => [
    ...(request.approvalHistory || []),
    { stepIndex, role: user.role, actorId: user.id, actorName: user.name, action, ts }
];
const routeRequestToBranch = (request, user, branch, ts) => {
    const isDeanRouting = (user.role === 'DEAN' || user.role === 'CEO' || user.role === 'CHAIRMAN') && request.currentStage === 'DEAN' && request.status === 'PENDING';
    const isManagerRouting = (user.role === 'MANAGER' || user.role === 'INSTITUTION_MANAGER') && (request.currentStage === 'MANAGER' || request.currentStage === 'INSTITUTION_MANAGER') && request.status === 'PENDING';
    if (!isDeanRouting && !isManagerRouting) {
        throw new Error('Only the current assigned approver (Manager or Dean) can route this pending request.');
    }
    if (isDeanRouting) {
        const postDeanBranches = ['IT', 'AUDIT', 'HR', 'MMI'];
        if (!postDeanBranches.includes(branch)) {
            throw new Error(`Dean must select one of the authorized branches: ${postDeanBranches.join(', ')}.`);
        }
        let stages = request.stages ? [...request.stages] : [];
        const deanIdx = stages.findIndex(s => s.role === 'DEAN');
        if (deanIdx >= 0) {
            stages[deanIdx] = {
                ...stages[deanIdx],
                status: 'COMPLETED',
                decidedByName: user.name,
                decidedByRole: user.role,
                decidedByUserId: user.id,
                decisionAction: 'ROUTED',
                decisionTs: ts
            };
        }
        let branchStageIdx = stages.findIndex((s, idx) => idx > deanIdx && (s.stageType === 'BRANCH' || postDeanBranches.includes(s.role)));
        if (branchStageIdx >= 0) {
            stages[branchStageIdx] = {
                ...stages[branchStageIdx],
                role: branch,
                label: `${branch} Branch Head`,
                stageType: 'BRANCH',
                status: 'PENDING',
                isApplicable: true
            };
        }
        else {
            const insertAt = deanIdx >= 0 ? deanIdx + 1 : stages.length;
            stages.splice(insertAt, 0, {
                id: `stg-branch-${branch}`,
                stageIndex: insertAt,
                stageKey: 'STAGE_BRANCH',
                role: branch,
                label: `${branch} Branch Head`,
                stageType: 'BRANCH',
                status: 'PENDING',
                isApplicable: true
            });
            branchStageIdx = insertAt;
        }
        stages = stages.map((s, idx) => {
            if (idx !== branchStageIdx && postDeanBranches.includes(s.role) && s.stageType === 'BRANCH') {
                return { ...s, isApplicable: false, status: 'SKIPPED' };
            }
            return { ...s, stageIndex: idx };
        });
        const activeSteps = stages.filter(s => s.isApplicable !== false).map(s => ({ id: s.id, role: s.role }));
        const branchStepIndex = activeSteps.findIndex(s => s.role === branch);
        const action = `Dean routed request to ${branch} Branch Head`;
        return {
            ...request,
            stages,
            workflowSnapshot: request.workflowSnapshot ? { ...request.workflowSnapshot, steps: activeSteps, branch: branch } : undefined,
            selectedBranch: branch,
            currentStepIndex: branchStepIndex >= 0 ? branchStepIndex : 1,
            currentStage: branch,
            assignedRole: branch,
            assignedUserId: undefined,
            status: 'PENDING',
            hoursIdle: 0,
            approvalHistory: addHistory(request, user, 'ROUTED', ts, deanIdx >= 0 ? deanIdx : 0),
            updatedAt: new Date().toISOString(),
            auditTrail: [...request.auditTrail, { ts, actor: `${user.name} (${user.role})`, action }]
        };
    }
    const snapshot = request.workflowSnapshotsByBranch?.[branch];
    const firstApprover = snapshot?.steps[1];
    if (!snapshot || snapshot.steps[0]?.role !== 'MANAGER' || !firstApprover) {
        throw new Error(`No valid active ${branch} workflow is available for this request.`);
    }
    const action = `Manager routed request to ${roleLabel(firstApprover.role)} (${branch})`;
    return {
        ...request,
        workflowSnapshot: snapshot,
        selectedBranch: branch,
        currentStepIndex: 1,
        currentStage: firstApprover.role,
        assignedRole: firstApprover.role,
        assignedUserId: undefined,
        status: 'PENDING',
        hoursIdle: 0,
        approvalHistory: addHistory(request, user, 'ROUTED', ts, 0),
        updatedAt: new Date().toISOString(),
        auditTrail: [...request.auditTrail, { ts, actor: `${user.name} (${user.role})`, action }]
    };
};
exports.routeRequestToBranch = routeRequestToBranch;
const approveWorkflowStep = (request, user, ts, allowHigherAuthorityOverride = false, selectedBranchOverride) => {
    let snapshot = request.workflowSnapshot;
    let stepIndex = request.currentStepIndex;
    const higherAuthority = user.role === 'CEO' || user.role === 'CHAIRMAN' || user.role === 'GENERAL_MANAGER';
    const overrideAllowed = allowHigherAuthorityOverride && higherAuthority && request.status === 'PENDING' && request.hoursIdle >= 6;
    if (request.currentStage === 'MANAGER' && overrideAllowed && !snapshot) {
        const branch = branchForCategory(request.category);
        snapshot = request.workflowSnapshotsByBranch?.[branch];
        stepIndex = 0;
    }
    const isRoleMatching = request.currentStage === user.role ||
        (request.currentStage === 'MANAGER' && user.role === 'INSTITUTION_MANAGER') ||
        (request.currentStage === 'INSTITUTION_MANAGER' && user.role === 'MANAGER');
    const chairmanAtCeoStep = user.role === 'CHAIRMAN' && request.currentStage === 'CEO';
    const escalatedToCeo = request.status === 'ESCALATED' && (user.role === 'CEO' || chairmanAtCeoStep);
    const delegatedApprover = request.assignedUserId === user.id && request.assignedRole === user.role;
    if ((request.status !== 'PENDING' && !escalatedToCeo) ||
        (!isRoleMatching && !chairmanAtCeoStep && !delegatedApprover && !overrideAllowed)) {
        throw new Error('This approval is not assigned to your role or is no longer pending.');
    }
    // Advance based on request.stages sequence if present
    if (request.stages && request.stages.length > 0) {
        const currentPendingIndex = request.stages.findIndex(s => s.status === 'PENDING');
        const stageIdxToComplete = currentPendingIndex >= 0 ? currentPendingIndex : request.stages.findIndex(s => s.role === request.currentStage);
        if (stageIdxToComplete < 0) {
            throw new Error('No pending stage found for this approval.');
        }
        const currentStageInstance = request.stages[stageIdxToComplete];
        // Check if current stage is DEAN: If followed by a specialized branch stage, route to chosen branch
        const postDeanBranches = ['IT', 'AUDIT', 'HR', 'MMI'];
        const branchIdx = request.stages.findIndex((s, idx) => idx > stageIdxToComplete && (s.stageType === 'BRANCH' || postDeanBranches.includes(s.role)));
        if (currentStageInstance.role === 'DEAN' && branchIdx >= 0) {
            const stageBranchRole = request.stages[branchIdx]?.role;
            const effectiveBranch = (stageBranchRole && postDeanBranches.includes(stageBranchRole))
                ? stageBranchRole
                : (request.selectedBranch || (0, exports.determineDefaultBranchForCategory)(request.category) || 'HR');
            const selectedBranch = String(selectedBranchOverride || effectiveBranch).toUpperCase();
            const chosenBranch = postDeanBranches.includes(selectedBranch) ? selectedBranch : (stageBranchRole || 'HR');
            let stages = request.stages.map((s, idx) => {
                if (idx === stageIdxToComplete) {
                    return {
                        ...s,
                        status: 'COMPLETED',
                        decidedByName: user.name,
                        decidedByRole: user.role,
                        decidedByUserId: user.id,
                        decisionAction: 'APPROVED',
                        decisionTs: ts
                    };
                }
                return s;
            });
            stages[branchIdx] = {
                ...stages[branchIdx],
                role: chosenBranch,
                label: `${chosenBranch} Branch Head`,
                stageType: 'BRANCH',
                status: 'PENDING',
                isApplicable: true
            };
            stages = stages.map((s, i) => ({ ...s, stageIndex: i }));
            const activeSteps = stages.filter(s => s.isApplicable !== false).map(s => ({ id: s.id, role: s.role }));
            const currentActiveIndex = activeSteps.findIndex(s => s.role === chosenBranch);
            const action = `Approved by ${user.name} (${user.role}) and routed to ${chosenBranch} Branch Head`;
            return {
                ...request,
                stages,
                workflowSnapshot: request.workflowSnapshot ? { ...request.workflowSnapshot, steps: activeSteps, branch: chosenBranch } : undefined,
                selectedBranch: chosenBranch,
                currentStepIndex: currentActiveIndex >= 0 ? currentActiveIndex : stageIdxToComplete + 1,
                currentStage: chosenBranch,
                assignedRole: chosenBranch,
                assignedUserId: undefined,
                status: 'PENDING',
                hoursIdle: 0,
                updatedAt: new Date().toISOString(),
                approvalHistory: addHistory(request, user, escalatedToCeo || chairmanAtCeoStep || overrideAllowed ? 'OVERRIDDEN' : 'APPROVED', ts, stageIdxToComplete),
                auditTrail: [...request.auditTrail, { ts, actor: `${user.name} (${user.role})`, action }]
            };
        }
        // For other stages: find next applicable stage
        let nextStageIndex = -1;
        for (let i = stageIdxToComplete + 1; i < request.stages.length; i++) {
            if (request.stages[i].isApplicable && request.stages[i].status === 'FUTURE') {
                nextStageIndex = i;
                break;
            }
        }
        const complete = nextStageIndex === -1;
        const nextStage = !complete ? request.stages[nextStageIndex] : null;
        if (complete && currentStageInstance.role === 'CEO') {
            const hasChairman = request.stages.some(s => s.role === 'CHAIRMAN' && s.isApplicable !== false);
            if (hasChairman) {
                throw new Error('Chairman is the final approval authority and cannot be bypassed.');
            }
        }
        const updatedStages = request.stages.map((s, idx) => {
            if (idx === stageIdxToComplete) {
                return {
                    ...s,
                    status: 'COMPLETED',
                    decidedByName: user.name,
                    decidedByRole: user.role,
                    decidedByUserId: user.id,
                    decisionAction: 'APPROVED',
                    decisionTs: ts
                };
            }
            if (nextStage && idx === nextStageIndex) {
                return { ...s, status: 'PENDING' };
            }
            return s;
        });
        const activeSteps = updatedStages.filter(s => s.isApplicable !== false).map(s => ({ id: s.id, role: s.role }));
        const nextActiveIndex = nextStage ? activeSteps.findIndex(s => s.role === nextStage.role) : activeSteps.length - 1;
        const action = complete
            ? `Final approval granted by ${user.name} (${user.role})`
            : `Approved by ${user.name} (${user.role}) and forwarded to ${roleLabel(nextStage.role)}`;
        return {
            ...request,
            stages: updatedStages,
            workflowSnapshot: request.workflowSnapshot ? { ...request.workflowSnapshot, steps: activeSteps } : undefined,
            currentStepIndex: complete ? nextActiveIndex : (nextActiveIndex >= 0 ? nextActiveIndex : stageIdxToComplete + 1),
            currentStage: complete ? 'COMPLETED' : nextStage.role,
            assignedRole: complete ? undefined : nextStage.role,
            assignedUserId: undefined,
            status: complete ? 'APPROVED' : 'PENDING',
            hoursIdle: 0,
            updatedAt: new Date().toISOString(),
            approvalHistory: addHistory(request, user, escalatedToCeo || chairmanAtCeoStep || overrideAllowed ? 'OVERRIDDEN' : 'APPROVED', ts, stageIdxToComplete),
            auditTrail: [...request.auditTrail, { ts, actor: `${user.name} (${user.role})`, action }]
        };
    }
    // Legacy snapshot-only mode
    if (!snapshot || stepIndex === undefined) {
        throw new Error('This approval is not assigned to your role or is no longer pending.');
    }
    if (escalatedToCeo)
        stepIndex = snapshot.steps.findIndex(step => step.role === 'CEO');
    const nextIndex = stepIndex + 1;
    const nextStep = snapshot.steps[nextIndex];
    const complete = !nextStep;
    const action = complete
        ? `Final approval granted by ${user.name} (${user.role})`
        : `Approved by ${user.name} (${user.role}) and forwarded to ${roleLabel(nextStep.role)}`;
    return {
        ...request,
        currentStepIndex: complete ? stepIndex : nextIndex,
        currentStage: complete ? 'COMPLETED' : nextStep.role,
        assignedRole: complete ? undefined : nextStep.role,
        assignedUserId: undefined,
        status: complete ? 'APPROVED' : 'PENDING',
        hoursIdle: 0,
        updatedAt: new Date().toISOString(),
        approvalHistory: addHistory(request, user, escalatedToCeo || chairmanAtCeoStep || overrideAllowed ? 'OVERRIDDEN' : 'APPROVED', ts, stepIndex),
        auditTrail: [...request.auditTrail, { ts, actor: `${user.name} (${user.role})`, action }]
    };
};
exports.approveWorkflowStep = approveWorkflowStep;
const rejectWorkflowStep = (request, user, ts, reason) => {
    const stepIndex = request.currentStepIndex ?? 0;
    const managerBeforeBranch = request.currentStage === 'MANAGER' && user.role === 'MANAGER';
    const assigned = request.assignedUserId === user.id && request.assignedRole === user.role;
    if (request.status !== 'PENDING' || request.currentStage !== user.role ||
        (!managerBeforeBranch && !assigned && request.workflowSnapshot?.steps[stepIndex]?.role !== user.role)) {
        throw new Error('Only the assigned approver can reject this pending request.');
    }
    const action = `Request rejected by ${user.name} (${user.role})${reason ? ` — ${reason}` : ''}`;
    const updatedStages = request.stages?.map(s => {
        if (s.role === user.role && s.status === 'PENDING') {
            return {
                ...s,
                status: 'REJECTED',
                decidedByName: user.name,
                decidedByRole: user.role,
                decidedByUserId: user.id,
                decisionAction: 'REJECTED',
                decisionTs: ts,
                notes: reason || null
            };
        }
        return s;
    });
    return {
        ...request,
        stages: updatedStages || request.stages,
        status: 'REJECTED',
        hoursIdle: 0,
        updatedAt: new Date().toISOString(),
        approvalHistory: addHistory(request, user, 'REJECTED', ts, stepIndex),
        auditTrail: [...request.auditTrail, { ts, actor: `${user.name} (${user.role})`, action }]
    };
};
exports.rejectWorkflowStep = rejectWorkflowStep;
