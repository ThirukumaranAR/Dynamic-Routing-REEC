import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ApprovalRequest,
  GeneralWorkflowConfig,
  PostDeanBranch,
  POST_DEAN_BRANCHES,
  RequestStageInstance,
  STANDARD_ROLES,
  User,
  UserAccount
} from '../services/types';
import { api, ApiError } from '../services/apiClient';
import { getRoleDisplayName, formatCurrencyINR } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import {
  loadGeneralWorkflow,
  saveGeneralWorkflow,
  applyGeneralWorkflowToRequest
} from '../services/workflowEngine';

const commonDepartments = [
  'Administration',
  'Finance and Accounts',
  'Human Resources',
  'Information Technology',
  'Operations',
  'Procurement',
  'Sales and Marketing',
  'Computer Science and Engineering',
  'Research and Development'
];

interface BuilderRoleItem {
  name: string;
  displayName: string;
  category: 'Governance' | 'Leadership' | 'Finance' | 'Branches';
  badge: string;
  description: string;
}

const AVAILABLE_BUILDER_ROLES: BuilderRoleItem[] = [
  // Institutional Hierarchy (Pre-Dean)
  { name: 'INSTITUTION_MANAGER', displayName: 'Institution Manager', category: 'Leadership', badge: 'Step 1', description: 'Initial campus & operational clearance' },
  { name: 'FINANCE', displayName: 'Finance Head', category: 'Finance', badge: 'Step 2', description: 'Fiscal compliance & budget verification' },
  { name: 'ACCOUNTANT', displayName: 'Accountant', category: 'Finance', badge: 'Step 3', description: 'Account ledger & invoice audit' },
  { name: 'VP', displayName: 'Vice President (VP)', category: 'Leadership', badge: 'Step 4', description: 'Vice Presidential executive review' },
  { name: 'HOI', displayName: 'Head of Institution (HOI)', category: 'Leadership', badge: 'Step 5', description: 'Head of Institution clearance' },

  // Governance Checkpoint
  { name: 'DEAN', displayName: 'Dean Checkpoint', category: 'Governance', badge: 'Step 6', description: 'Mandatory checkpoint prior to branch routing' },

  // Specialized Branches (Post-Dean Alternatives)
  { name: 'IT', displayName: 'IT Branch Head', category: 'Branches', badge: 'Branch Alt', description: 'Technology & systems review branch' },
  { name: 'AUDIT', displayName: 'Audit Branch Head', category: 'Branches', badge: 'Branch Alt', description: 'Internal audit & risk review branch' },
  { name: 'HR', displayName: 'HR Branch Head', category: 'Branches', badge: 'Branch Alt', description: 'Human resources review branch' },
  { name: 'MMI', displayName: 'MMI Branch Head', category: 'Branches', badge: 'Branch Alt', description: 'Maintenance & infrastructure review branch' },

  // Executive Authority
  { name: 'CEO', displayName: 'Chief Executive Officer (CEO)', category: 'Governance', badge: 'Step 8', description: 'Executive authority checkpoint following branch review' },
  { name: 'CHAIRMAN', displayName: 'Chairman', category: 'Governance', badge: 'Final Step', description: 'Terminal final approval authority' },

  // Optional Administrative Roles
  { name: 'GENERAL_MANAGER', displayName: 'General Manager', category: 'Leadership', badge: 'Optional', description: 'General Manager operational review' }
];

type WorkflowViewMode = 'LIST' | 'CREATE_BUILDER' | 'EDIT_CLASSIC' | 'INSPECT' | 'GENERAL_BUILDER';

const APP_ROLE_USERS: Record<string, string> = {
  INSTITUTION_MANAGER: 'Kavitha',
  MANAGER: 'Kavitha',
  FINANCE: 'Amitabh Verma',
  ACCOUNTANT: 'Pooja Sharma',
  HR: 'Sarah Jenkins',
  IT: 'Vikram Seth',
  DEAN: 'Rajan Mehta',
  GENERAL_MANAGER: 'Kavitha Reddy',
  GM: 'Kavitha Reddy',
  CEO: 'Dr. Suresh Kumar',
  REQUESTER: 'Arun'
};

const cleanPersonName = (rawName?: string, roleName?: string): string => {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  const stripped = trimmed
    .replace(/\s*\([A-Za-z\s]+\)$/i, '')
    .replace(new RegExp(`\\s+${(roleName || '').replace(/_/g, '\\s+')}$`, 'i'), '')
    .replace(/\s+(Institution\s+Manager|Manager|Requester|Head|Officer|Controller|Senior|Lead|Operations|Directorate)$/i, '')
    .trim();

  const lower = (stripped || trimmed).toLowerCase();
  const genericTitles = [
    'institution manager',
    'manager',
    'finance',
    'finance head',
    'finance controller',
    'accountant',
    'accountant lead',
    'accountant senior',
    'vice president',
    'vice president operations',
    'head of institution',
    'dean',
    'dean academics',
    'dean of faculty',
    'it',
    'it administrator',
    'it systems head',
    'audit',
    'audit officer',
    'internal audit head',
    'hr',
    'hr lead',
    'hr department head',
    'mmi',
    'mmi head',
    'mmi operations lead',
    'general manager',
    'general manager authority',
    'chief executive officer',
    'chairman',
    'chairman executive',
    'board chairman',
    'requester'
  ];

  if (genericTitles.includes(lower)) {
    return '';
  }

  return stripped || trimmed;
};

interface WorkflowManagementViewProps {
  user: User;
  requests?: ApprovalRequest[];
  users?: UserAccount[];
  onUpdateRequest?: (updated: ApprovalRequest) => void;
}

export const WorkflowManagementView: React.FC<WorkflowManagementViewProps> = ({
  user,
  requests: initialRequests = [],
  users: initialUsers = [],
  onUpdateRequest
}) => {
  // Requests data & loading
  const [requestsList, setRequestsList] = useState<ApprovalRequest[]>(initialRequests);
  const [usersList, setUsersList] = useState<UserAccount[]>(initialUsers);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [requestsFetchError, setRequestsFetchError] = useState<string>('');

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Selected Request & Active View Mode
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [viewMode, setViewMode] = useState<WorkflowViewMode>('LIST');

  // Workflow Editor State
  const [draftStages, setDraftStages] = useState<RequestStageInstance[]>([]);
  const [draftBranch, setDraftBranch] = useState<PostDeanBranch>('HR');
  const [insertRole, setInsertRole] = useState<string>('');
  const [insertPosition, setInsertPosition] = useState<number>(0);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(commonDepartments[0]);
  const [roleValidationError, setRoleValidationError] = useState<string>('');

  // Workflow Editor Modal & Swap & Confirmation State
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState<boolean>(false);
  const [modifyConfirmRequest, setModifyConfirmRequest] = useState<ApprovalRequest | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [rolePaletteDesignationFilter, setRolePaletteDesignationFilter] = useState<string>('All');

  // Drag-and-drop & Palette filtering state (for Create New Flow builder)
  const [draggedRole, setDraggedRole] = useState<{ role: string; label: string } | null>(null);
  const [draggedStageIndex, setDraggedStageIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [rolePaletteSearch, setRolePaletteSearch] = useState<string>('');

  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setUsersList(initialUsers);
      return;
    }
    let isMounted = true;
    Promise.all([
      api.management().catch(() => ({ users: [] })),
      api.ceos().catch(() => [])
    ]).then(([mgmtRes, ceoUsers]) => {
      if (isMounted) {
        const combined = [...(mgmtRes.users || [])];
        if (Array.isArray(ceoUsers)) {
          ceoUsers.forEach(c => {
            if (!combined.some(u => u.id === c.id || u.email === c.email)) {
              combined.push(c);
            }
          });
        }
        setUsersList(combined);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [initialUsers]);

  const getPersonForRole = useCallback((roleName: string): string | null => {
    if (!roleName) return null;
    const normRole = roleName.trim().toUpperCase();

    // 1. Check currently authenticated user
    if (user && user.role && user.role.trim().toUpperCase() === normRole && user.name) {
      const cleaned = cleanPersonName(user.name, normRole);
      if (cleaned) return cleaned;
    }

    // 2. Check usersList (prioritizing department of selected request if available)
    if (usersList && usersList.length > 0) {
      const isRoleMatch = (r?: string) => {
        if (!r) return false;
        const uRole = r.trim().toUpperCase();
        return uRole === normRole ||
          (normRole === 'INSTITUTION_MANAGER' && uRole === 'MANAGER') ||
          (normRole === 'GENERAL_MANAGER' && uRole === 'GM');
      };

      const reqDept = selectedRequest?.department?.trim().toLowerCase();
      if (reqDept) {
        const deptMatch = usersList.find(u => isRoleMatch(u.role) && u.dept?.trim().toLowerCase() === reqDept && cleanPersonName(u.name, normRole));
        if (deptMatch?.name) {
          const cleaned = cleanPersonName(deptMatch.name, normRole);
          if (cleaned) return cleaned;
        }
      }

      const roleMatch = usersList.find(u => isRoleMatch(u.role) && cleanPersonName(u.name, normRole));
      if (roleMatch?.name) {
        const cleaned = cleanPersonName(roleMatch.name, normRole);
        if (cleaned) return cleaned;
      }
    }

    // 3. Check selected request stages, approval history, or requester
    if (selectedRequest) {
      if (normRole === 'REQUESTER' && selectedRequest.requester) {
        const cleaned = cleanPersonName(selectedRequest.requester, normRole);
        if (cleaned) return cleaned;
      }
      if (selectedRequest.stages) {
        const stageMatch = selectedRequest.stages.find(
          s => s.role?.trim().toUpperCase() === normRole && s.decidedByName && cleanPersonName(s.decidedByName, normRole)
        );
        if (stageMatch?.decidedByName) {
          const cleaned = cleanPersonName(stageMatch.decidedByName, normRole);
          if (cleaned) return cleaned;
        }
      }
      if (selectedRequest.approvalHistory) {
        const histMatch = selectedRequest.approvalHistory.find(
          h => h.role?.trim().toUpperCase() === normRole && h.actorName && cleanPersonName(h.actorName, normRole)
        );
        if (histMatch?.actorName) {
          const cleaned = cleanPersonName(histMatch.actorName, normRole);
          if (cleaned) return cleaned;
        }
      }
    }

    // 4. Check all live requests
    if (requestsList && requestsList.length > 0) {
      for (const req of requestsList) {
        if (normRole === 'REQUESTER' && req.requester) {
          const cleaned = cleanPersonName(req.requester, normRole);
          if (cleaned) return cleaned;
        }
        if (req.stages) {
          const stageMatch = req.stages.find(
            s => s.role?.trim().toUpperCase() === normRole && s.decidedByName && cleanPersonName(s.decidedByName, normRole)
          );
          if (stageMatch?.decidedByName) {
            const cleaned = cleanPersonName(stageMatch.decidedByName, normRole);
            if (cleaned) return cleaned;
          }
        }
        if (req.approvalHistory) {
          const histMatch = req.approvalHistory.find(
            h => h.role?.trim().toUpperCase() === normRole && h.actorName && cleanPersonName(h.actorName, normRole)
          );
          if (histMatch?.actorName) {
            const cleaned = cleanPersonName(histMatch.actorName, normRole);
            if (cleaned) return cleaned;
          }
        }
        if (req.auditTrail) {
          for (const entry of req.auditTrail) {
            const match = entry.actor?.match(/^([^(]+)\s*\(([^)]+)\)$/);
            if (match) {
              const actorName = match[1].trim();
              const actorRole = match[2].trim().toUpperCase();
              if (actorRole === normRole && actorName && actorName !== 'System') {
                const cleaned = cleanPersonName(actorName, normRole);
                if (cleaned) return cleaned;
              }
            }
          }
        }
      }
    }

    // 5. Existing application role users directory
    if (APP_ROLE_USERS[normRole]) {
      return APP_ROLE_USERS[normRole];
    }

    return null;
  }, [user, usersList, selectedRequest, requestsList]);

  const departmentOptions = useMemo(() => {
    if (selectedRequest?.department && !commonDepartments.includes(selectedRequest.department)) {
      return [selectedRequest.department, ...commonDepartments];
    }
    return commonDepartments;
  }, [selectedRequest]);

  const ROLE_DESIGNATION_FILTERS = [
    'All',
    'Requester',
    'Institution Manager',
    'Finance Head',
    'Accountant',
    'VP',
    'HOI',
    'Dean',
    'IT Branch',
    'Audit Branch',
    'HR Branch',
    'MMI Branch',
    'CEO',
    'Chairman'
  ] as const;

  interface PaletteRoleEntry {
    key: string;
    roleKey: string;
    displayName: string;
    category: 'Governance' | 'Leadership' | 'Finance' | 'Branches';
    designationFilter: string;
    personName?: string | null;
    displayLabel: string;
  }

  const computedPaletteRoles = useMemo<PaletteRoleEntry[]>(() => {
    const items: PaletteRoleEntry[] = [];
    const norm = (s?: string) => (s || '').trim().toUpperCase();

    const definitions: Array<{
      filter: string;
      roleCode: string;
      displayName: string;
      category: 'Governance' | 'Leadership' | 'Finance' | 'Branches';
      aliases: string[];
    }> = [
      { filter: 'Requester', roleCode: 'REQUESTER', displayName: 'Requester', category: 'Leadership', aliases: ['REQUESTER'] },
      { filter: 'Institution Manager', roleCode: 'INSTITUTION_MANAGER', displayName: 'Institution Manager', category: 'Leadership', aliases: ['INSTITUTION_MANAGER', 'MANAGER'] },
      { filter: 'Finance Head', roleCode: 'FINANCE', displayName: 'Finance Head', category: 'Finance', aliases: ['FINANCE'] },
      { filter: 'Accountant', roleCode: 'ACCOUNTANT', displayName: 'Accountant', category: 'Finance', aliases: ['ACCOUNTANT'] },
      { filter: 'VP', roleCode: 'VP', displayName: 'Vice President (VP)', category: 'Leadership', aliases: ['VP'] },
      { filter: 'HOI', roleCode: 'HOI', displayName: 'Head of Institution (HOI)', category: 'Leadership', aliases: ['HOI'] },
      { filter: 'Dean', roleCode: 'DEAN', displayName: 'Dean', category: 'Governance', aliases: ['DEAN'] },
      { filter: 'IT Branch', roleCode: 'IT', displayName: 'IT Branch Head', category: 'Branches', aliases: ['IT'] },
      { filter: 'Audit Branch', roleCode: 'AUDIT', displayName: 'Audit Branch Head', category: 'Branches', aliases: ['AUDIT'] },
      { filter: 'HR Branch', roleCode: 'HR', displayName: 'HR Branch Head', category: 'Branches', aliases: ['HR'] },
      { filter: 'MMI Branch', roleCode: 'MMI', displayName: 'MMI Branch Head', category: 'Branches', aliases: ['MMI'] },
      { filter: 'CEO', roleCode: 'CEO', displayName: 'Chief Executive Officer (CEO)', category: 'Governance', aliases: ['CEO'] },
      { filter: 'Chairman', roleCode: 'CHAIRMAN', displayName: 'Chairman', category: 'Governance', aliases: ['CHAIRMAN'] }
    ];

    definitions.forEach(def => {
      const matchingUsers = (usersList || []).filter(u => {
        if (!u.role) return false;
        const uRole = norm(u.role);
        return def.aliases.some(a => norm(a) === uRole);
      });

      if (matchingUsers.length > 0) {
        matchingUsers.forEach(u => {
          const cleanedName = cleanPersonName(u.name, def.roleCode) || u.name;
          items.push({
            key: `${def.roleCode}-${u.id || u.email || cleanedName}`,
            roleKey: def.roleCode,
            displayName: def.displayName,
            category: def.category,
            designationFilter: def.filter,
            personName: cleanedName,
            displayLabel: `${cleanedName} — ${def.displayName}`
          });
        });
      } else {
        let foundPerson: string | null = null;
        if (user && def.aliases.some(a => norm(a) === norm(user.role)) && user.name) {
          foundPerson = cleanPersonName(user.name, def.roleCode) || user.name;
        } else if (APP_ROLE_USERS[def.roleCode]) {
          foundPerson = APP_ROLE_USERS[def.roleCode];
        } else {
          foundPerson = getPersonForRole(def.roleCode);
        }

        items.push({
          key: `${def.roleCode}-default`,
          roleKey: def.roleCode,
          displayName: def.displayName,
          category: def.category,
          designationFilter: def.filter,
          personName: foundPerson,
          displayLabel: foundPerson ? `${foundPerson} — ${def.displayName}` : def.displayName
        });
      }
    });

    return items;
  }, [usersList, user, getPersonForRole]);

  const filteredPaletteRoles = useMemo(() => {
    const q = rolePaletteSearch.trim().toLowerCase();
    return computedPaletteRoles.filter(item => {
      const matchesFilter = rolePaletteDesignationFilter === 'All' || item.designationFilter === rolePaletteDesignationFilter;
      const matchesQ = !q ||
        item.roleKey.toLowerCase().includes(q) ||
        item.displayName.toLowerCase().includes(q) ||
        item.designationFilter.toLowerCase().includes(q) ||
        (item.personName ? item.personName.toLowerCase().includes(q) : false) ||
        item.displayLabel.toLowerCase().includes(q);
      return matchesFilter && matchesQ;
    });
  }, [computedPaletteRoles, rolePaletteSearch, rolePaletteDesignationFilter]);

  // Preview & Approval Modal State
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [stageToCancel, setStageToCancel] = useState<{ index: number; stage: RequestStageInstance } | null>(null);
  const [justificationReason, setJustificationReason] = useState<string>('');
  const [activating, setActivating] = useState<boolean>(false);
  const [activationError, setActivationError] = useState<string>('');
  const [activationSuccess, setActivationSuccess] = useState<string>('');

  // General Workflow Configuration State
  const [generalWorkflow, setGeneralWorkflow] = useState<GeneralWorkflowConfig>(() => loadGeneralWorkflow());
  const [showGeneralPreviewModal, setShowGeneralPreviewModal] = useState<boolean>(false);
  const [generalActivationReason, setGeneralActivationReason] = useState<string>('');
  const [generalSaveSuccess, setGeneralSaveSuccess] = useState<string>('');

  // Controlled Migration State (for in-progress requests)
  const [requestToMigrate, setRequestToMigrate] = useState<ApprovalRequest | null>(null);
  const [migrationReason, setMigrationReason] = useState<string>('');
  const [migrating, setMigrating] = useState<boolean>(false);
  const [migrationError, setMigrationError] = useState<string>('');

  const isAuthorized = user.role === 'CEO' || user.role === 'CHAIRMAN';

  // Fetch live requests on mount
  useEffect(() => {
    let isMounted = true;
    const fetchRequests = async () => {
      setLoadingRequests(true);
      setRequestsFetchError('');
      try {
        const fetched = await api.listRequests();
        if (isMounted) {
          setRequestsList(fetched);
        }
      } catch (err) {
        if (isMounted) {
          setRequestsFetchError(err instanceof Error ? err.message : 'Failed to load requests from database.');
        }
      } finally {
        if (isMounted) {
          setLoadingRequests(false);
        }
      }
    };
    void fetchRequests();
    return () => { isMounted = false; };
  }, []);

  // Fetch active general workflow on mount
  useEffect(() => {
    let isMounted = true;
    const fetchGeneralWorkflow = async () => {
      try {
        const gw = await api.getGeneralWorkflow();
        if (isMounted && gw) {
          setGeneralWorkflow(gw);
          saveGeneralWorkflow(gw);
        }
      } catch {
        // Fallback to local storage
      }
    };
    void fetchGeneralWorkflow();
    return () => { isMounted = false; };
  }, []);

  // Update selected request when selectedRequestId or requestsList changes
  useEffect(() => {
    if (!selectedRequestId) {
      setSelectedRequest(null);
      if (viewMode !== 'GENERAL_BUILDER') {
        setDraftStages([]);
        setViewMode('LIST');
      }
      return;
    }
    const match = requestsList.find(r => r.id === selectedRequestId);
    if (match) {
      setSelectedRequest(match);
    }
  }, [selectedRequestId, requestsList, viewMode]);

  const loadRequestIntoDraft = (req: ApprovalRequest) => {
    const rawStages = req.stages && req.stages.length > 0
      ? req.stages.map(s => ({ ...s }))
      : createDefaultStagesForRequest(req);
    setDraftStages(rawStages);
    if (req.selectedBranch && POST_DEAN_BRANCHES.includes(req.selectedBranch as PostDeanBranch)) {
      setDraftBranch(req.selectedBranch as PostDeanBranch);
    } else {
      setDraftBranch('HR');
    }
    setInsertPosition(rawStages.length);
    setSelectedDepartment(req.department || commonDepartments[0]);
    setInsertRole('');
    setRoleValidationError('');
    setActivationError('');
    setActivationSuccess('');
    setGeneralSaveSuccess('');
  };

  const createDefaultStagesForRequest = (_req: ApprovalRequest): RequestStageInstance[] => {
    const defRoles = ['INSTITUTION_MANAGER', 'FINANCE', 'ACCOUNTANT', 'VP', 'HOI', 'DEAN', 'CEO', 'CHAIRMAN'];
    return defRoles.map((role, idx) => ({
      id: `stg-${idx + 1}`,
      stageIndex: idx,
      stageKey: `STAGE_${role}`,
      role: role as any,
      label: getRoleDisplayName(role),
      status: idx === 0 ? 'PENDING' : 'FUTURE',
      isApplicable: true,
      notes: null
    }));
  };

  // Dedicated View Navigation Handlers
  const handleStartEdit = (req: ApprovalRequest) => {
    setSelectedRequestId(req.id);
    setSelectedRequest(req);
    loadRequestIntoDraft(req); // Preserves existing workflow stages!
    setViewMode('EDIT_CLASSIC');
  };

  const handleStartCreateBuilder = (req: ApprovalRequest) => {
    setSelectedRequestId(req.id);
    setSelectedRequest(req);
    setDraftStages([]); // Empty canvas for Create New Flow!
    if (req.selectedBranch && POST_DEAN_BRANCHES.includes(req.selectedBranch as PostDeanBranch)) {
      setDraftBranch(req.selectedBranch as PostDeanBranch);
    } else {
      setDraftBranch('HR');
    }
    setInsertPosition(0);
    setSelectedDepartment(req.department || commonDepartments[0]);
    setInsertRole('');
    setRoleValidationError('');
    setActivationError('');
    setActivationSuccess('');
    setGeneralSaveSuccess('');
    setViewMode('CREATE_BUILDER');
  };

  const handleStartInspect = (req: ApprovalRequest) => {
    setSelectedRequestId(req.id);
    setSelectedRequest(req);
    loadRequestIntoDraft(req);
    setViewMode('INSPECT');
  };

  const handleStartCreateGeneralBuilder = () => {
    setSelectedRequestId('');
    setSelectedRequest(null);
    setDraftStages([]); // Empty canvas for Create New Flow!
    setDraftBranch('HR');
    setInsertPosition(0);
    setInsertRole('');
    setRoleValidationError('');
    setActivationError('');
    setActivationSuccess('');
    setGeneralSaveSuccess('');
    setViewMode('GENERAL_BUILDER');
  };

  const handleOpenGeneralWorkflowEditor = () => {
    setSelectedRequestId('');
    setSelectedRequest(null);
    const stages: RequestStageInstance[] = (generalWorkflow.stages || []).map((s, idx) => ({
      id: s.id || `gw-${idx + 1}`,
      stageIndex: idx,
      stageKey: s.stageKey || `STAGE_${s.role}`,
      role: s.role as any,
      label: s.label || getRoleDisplayName(s.role),
      status: 'FUTURE',
      isApplicable: s.isApplicable !== false,
      notes: null
    }));
    setDraftStages(stages);
    setDraftBranch('HR');
    setInsertPosition(stages.length);
    setInsertRole('');
    setRoleValidationError('');
    setActivationError('');
    setActivationSuccess('');
    setGeneralSaveSuccess('');
    setViewMode('GENERAL_BUILDER');
  };

  const handleSaveGeneralDraft = () => {
    const draftConfig: GeneralWorkflowConfig = {
      ...generalWorkflow,
      stages: draftStages.map((s, idx) => ({
        id: s.id,
        stageKey: s.stageKey,
        role: s.role,
        label: s.label,
        stageOrder: idx + 1,
        stageType: s.role === 'DEAN' ? 'DEAN' : (s.role === 'CEO' || s.role === 'CHAIRMAN') ? 'POST_BRANCH' : 'PRE_DEAN',
        isApplicable: s.isApplicable !== false
      }))
    };
    saveGeneralWorkflow(draftConfig);
    setGeneralSaveSuccess('Draft workflow saved.');
    setTimeout(() => setGeneralSaveSuccess(''), 3000);
  };

  const validateWorkflowSequence = (stages: RequestStageInstance[]): string | null => {
    if (stages.length === 0) {
      return 'Please add at least one approval stage to the workflow.';
    }

    const roles = stages.map(s => String(s.role || '').toUpperCase());

    // Prevent duplicate role assignments
    const seen = new Set<string>();
    for (const r of roles) {
      if (seen.has(r)) {
        return `Duplicate role assignment ${getRoleDisplayName(r)} is not permitted.`;
      }
      seen.add(r);
    }

    const chairIdx = roles.indexOf('CHAIRMAN');
    if (chairIdx !== -1 && chairIdx !== roles.length - 1) {
      return 'Chairman must remain the final approval authority stage when included in workflow.';
    }

    return null;
  };

  const handleOpenGeneralPreview = () => {
    setActivationError('');
    setGeneralActivationReason('');

    const validationError = validateWorkflowSequence(draftStages);
    if (validationError) {
      alert(validationError);
      return;
    }

    setShowGeneralPreviewModal(true);
  };

  const handleActivateGeneralWorkflow = async () => {
    setActivating(true);
    setActivationError('');

    try {
      const payload = {
        name: generalWorkflow.name || 'General Approval Workflow',
        reason: generalActivationReason.trim() || undefined,
        stages: draftStages.map((s, idx) => ({
          id: s.id,
          stageKey: s.stageKey,
          role: s.role,
          label: s.label,
          stageOrder: idx + 1,
          stageType: s.role === 'DEAN' ? 'DEAN' : (s.role === 'CEO' || s.role === 'CHAIRMAN') ? 'POST_BRANCH' : 'PRE_DEAN',
          isApplicable: s.isApplicable !== false
        })),
        branchConfigs: generalWorkflow.branchConfigs || [
          { branchKey: 'IT', displayName: 'IT Branch', role: 'IT', isActive: true },
          { branchKey: 'AUDIT', displayName: 'Audit Branch', role: 'AUDIT', isActive: true },
          { branchKey: 'HR', displayName: 'HR Branch', role: 'HR', isActive: true },
          { branchKey: 'MMI', displayName: 'MMI Branch', role: 'MMI', isActive: true }
        ]
      };

      let updatedConfig: GeneralWorkflowConfig;
      try {
        updatedConfig = await api.activateGeneralWorkflow(payload);
      } catch {
        const nextVersion = (generalWorkflow.version || 1) + 1;
        const now = new Date().toISOString();
        updatedConfig = {
          ...generalWorkflow,
          version: nextVersion,
          activatedAt: now,
          activatedBy: user.name,
          stages: payload.stages,
          history: [
            ...(generalWorkflow.history || []),
            { version: nextVersion, activatedAt: now, activatedBy: user.name, reason: generalActivationReason }
          ]
        };
      }

      setGeneralWorkflow(updatedConfig);
      saveGeneralWorkflow(updatedConfig);
      setShowGeneralPreviewModal(false);
      setActivationSuccess(`General Workflow v${updatedConfig.version} activated successfully! New requests will use this default flow.`);
      setTimeout(() => setActivationSuccess(''), 5000);
      setViewMode('LIST');
    } catch (err: any) {
      setActivationError(err?.message || 'Failed to activate general workflow.');
    } finally {
      setActivating(false);
    }
  };

  const handleOpenMigrationModal = (req: ApprovalRequest) => {
    setRequestToMigrate(req);
    setMigrationReason(`Apply General Workflow v${generalWorkflow.version}`);
    setMigrationError('');
  };

  const handleConfirmMigration = async () => {
    if (!requestToMigrate) return;
    setMigrating(true);
    setMigrationError('');
    try {
      const existingStages = (requestToMigrate.stages || []) as RequestStageInstance[];
      const completedStagesMap = new Map<string, RequestStageInstance>();
      existingStages.forEach(s => {
        if (s.status === 'COMPLETED') completedStagesMap.set(s.role, s);
      });

      let pendingSet = false;
      const targetStages = generalWorkflow.stages.map((gwStage, idx) => {
        const completed = completedStagesMap.get(gwStage.role);
        if (completed) {
          return {
            ...completed,
            stageIndex: idx,
            completedUnderVersion: completed.completedUnderVersion || requestToMigrate.workflowVersionNumber || 1
          };
        }
        const isApplicable = gwStage.isApplicable !== false;
        let status: RequestStageInstance['status'] = 'FUTURE';
        if (!isApplicable) {
          status = 'SKIPPED';
        } else if (!pendingSet) {
          status = 'PENDING';
          pendingSet = true;
        }
        return {
          id: `stg-migrated-${gwStage.role.toLowerCase()}-${Date.now()}-${idx}`,
          stageIndex: idx,
          stageKey: gwStage.stageKey || `STAGE_${gwStage.role}`,
          role: gwStage.role as any,
          label: gwStage.label,
          status,
          isApplicable,
          notes: null
        };
      });

      let updated: ApprovalRequest;
      try {
        updated = await api.migrateRequestWorkflow(requestToMigrate.id, {
          targetWorkflowVersion: generalWorkflow.version,
          reason: migrationReason.trim() || undefined,
          stages: targetStages
        });
      } catch {
        updated = applyGeneralWorkflowToRequest(requestToMigrate, generalWorkflow, user, migrationReason);
      }

      setRequestsList(prev => prev.map(r => r.id === updated.id ? updated : r));
      if (selectedRequest && selectedRequest.id === updated.id) {
        setSelectedRequest(updated);
        loadRequestIntoDraft(updated);
      }
      if (onUpdateRequest) {
        onUpdateRequest(updated);
      }
      setRequestToMigrate(null);
      setActivationSuccess(`Request #${updated.id} successfully migrated to General Workflow v${updated.workflowVersionNumber}!`);
      setTimeout(() => setActivationSuccess(''), 5000);
    } catch (err: any) {
      setMigrationError(err?.message || 'Failed to apply updated workflow.');
    } finally {
      setMigrating(false);
    }
  };

  // Filtered requests list for search
  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requestsList.filter(req => {
      const matchesQuery = !query ||
        req.id.toLowerCase().includes(query) ||
        req.title.toLowerCase().includes(query) ||
        (req.description && req.description.toLowerCase().includes(query)) ||
        (req.purpose && req.purpose.toLowerCase().includes(query)) ||
        req.requester.toLowerCase().includes(query) ||
        req.department.toLowerCase().includes(query) ||
        req.category.toLowerCase().includes(query) ||
        req.status.toLowerCase().includes(query) ||
        req.currentStage.toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || req.category === categoryFilter;

      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [requestsList, searchQuery, statusFilter, categoryFilter]);

  // Stage Manipulation Functions: Swap controls with constraint validation
  const handleSwapStages = (indexA: number, indexB: number) => {
    if (isFinalized) {
      setSwapError('Finalized workflows cannot be modified.');
      return;
    }
    if (indexA < 0 || indexB < 0 || indexA >= draftStages.length || indexB >= draftStages.length) return;

    const stageA = draftStages[indexA];
    const stageB = draftStages[indexB];

    if (stageA.status === 'COMPLETED' || stageB.status === 'COMPLETED') {
      setSwapError('Completed approval stages cannot be swapped or reordered.');
      return;
    }

    const updated = [...draftStages];
    updated[indexA] = { ...stageB, stageIndex: indexA };
    updated[indexB] = { ...stageA, stageIndex: indexB };

    const constraintErr = validateWorkflowSequence(updated);
    if (constraintErr) {
      setSwapError(`Cannot swap stages: ${constraintErr}`);
      return;
    }

    updated.forEach((s, idx) => { s.stageIndex = idx; });
    setDraftStages(updated);
    setSwapError(null);
  };

  const handleRemoveStage = (index: number) => {
    const stage = draftStages[index];
    if (!stage) return;
    if (stage.status === 'COMPLETED') {
      alert('Completed stages cannot be removed from a request.');
      return;
    }
    if (stage.role === 'CHAIRMAN') {
      alert('Chairman is the final approval authority and cannot be removed.');
      return;
    }

    setStageToCancel({ index, stage });
  };

  const handleConfirmRemoveStage = (index: number) => {
    const updated = draftStages.filter((_, idx) => idx !== index);
    updated.forEach((s, idx) => { s.stageIndex = idx; });
    setDraftStages(updated);
    setInsertPosition(Math.min(insertPosition, updated.length));
  };

  const handleToggleApplicable = (index: number) => {
    const stage = draftStages[index];
    if (stage.status === 'COMPLETED') {
      alert('Completed stages cannot be altered.');
      return;
    }
    if (stage.role === 'CHAIRMAN') {
      alert('Chairman is the final approval authority and must remain applicable.');
      return;
    }

    const updated = [...draftStages];
    updated[index] = {
      ...stage,
      isApplicable: !stage.isApplicable,
      status: !stage.isApplicable ? (stage.status === 'SKIPPED' ? 'FUTURE' : stage.status) : 'SKIPPED'
    };
    setDraftStages(updated);
  };

  const handleDirectAddPaletteEntry = (entry: PaletteRoleEntry) => {
    if (draftStages.some(s => s.role === entry.roleKey)) {
      alert(`${entry.displayLabel} is already present in this workflow sequence.`);
      return;
    }

    const newStage: RequestStageInstance = {
      id: `stg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stageIndex: insertPosition,
      stageKey: `STAGE_${entry.roleKey}`,
      role: entry.roleKey as any,
      label: entry.displayLabel,
      status: 'FUTURE',
      isApplicable: true,
      notes: `Added for ${selectedDepartment}`
    };

    const updated = [...draftStages];
    let safePos = Math.max(0, Math.min(insertPosition, updated.length));
    updated.splice(safePos, 0, newStage);
    updated.forEach((s, idx) => { s.stageIndex = idx; });
    setDraftStages(updated);
    setInsertPosition(Math.min(safePos + 1, updated.length));
    setRoleValidationError('');
  };

  // Drag-and-drop Handlers for Palette & Canvas
  const handleDragStartRole = (e: React.DragEvent, role: PaletteRoleEntry | BuilderRoleItem) => {
    const roleCode = 'roleKey' in role ? role.roleKey : role.name;
    const label = 'displayLabel' in role ? role.displayLabel : role.displayName;
    e.dataTransfer.setData('text/plain', roleCode);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggedRole({ role: roleCode, label });
  };

  const handleDragStartStage = (e: React.DragEvent, index: number) => {
    if (draftStages[index].status === 'COMPLETED') {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.setData('text/stageIndex', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedStageIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedRole(null);
    setDraggedStageIndex(null);
    setDropTargetIndex(null);
  };

  const handleDropAt = (targetIndex: number, e?: React.DragEvent) => {
    setDropTargetIndex(null);

    // Case 1: Dropping a role from the left Available Roles Palette
    let rolePayload = draggedRole;
    if (!rolePayload && e) {
      try {
        const rawRole = e.dataTransfer.getData('text/plain');
        const found = AVAILABLE_BUILDER_ROLES.find(r => r.name === rawRole);
        if (found) {
          rolePayload = { role: found.name, label: found.displayName };
        }
      } catch {}
    }

    if (rolePayload) {
      const { role: roleName, label: roleLabel } = rolePayload;
      setDraggedRole(null);

      if (roleName === 'CHAIRMAN' && draftStages.some(s => s.role === 'CHAIRMAN')) {
        alert('Chairman is already present as the final approval authority.');
        return;
      }

      const newStage: RequestStageInstance = {
        id: `stg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        stageIndex: targetIndex,
        stageKey: `STAGE_${roleName}`,
        role: roleName as any,
        label: roleLabel,
        status: 'FUTURE',
        isApplicable: true,
        notes: `Added for ${selectedDepartment}`
      };

      const updated = [...draftStages];
      const chairmanIndex = updated.findIndex(s => s.role === 'CHAIRMAN');
      let safePos = Math.max(0, Math.min(targetIndex, updated.length));
      if (roleName !== 'CHAIRMAN' && chairmanIndex !== -1 && safePos > chairmanIndex) {
        safePos = chairmanIndex;
      }

      updated.splice(safePos, 0, newStage);
      updated.forEach((s, idx) => { s.stageIndex = idx; });
      setDraftStages(updated);
      setInsertPosition(Math.min(safePos + 1, updated.length));
      setRoleValidationError('');
      return;
    }

    // Case 2: Reordering an existing stage via drag
    let fromIndex = draggedStageIndex;
    if (fromIndex === null && e) {
      try {
        const rawIdx = e.dataTransfer.getData('text/stageIndex') || e.dataTransfer.getData('text/plain');
        if (rawIdx !== '') {
          const parsedIdx = parseInt(rawIdx, 10);
          if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < draftStages.length) {
            fromIndex = parsedIdx;
          }
        }
      } catch {}
    }

    if (fromIndex !== null && fromIndex !== undefined) {
      setDraggedStageIndex(null);
      if (fromIndex === targetIndex || fromIndex === targetIndex - 1) return;

      if (draftStages[fromIndex]?.status === 'COMPLETED') {
        alert('Completed stages cannot be moved.');
        return;
      }

      const updated = [...draftStages];
      const [movedStage] = updated.splice(fromIndex, 1);
      if (!movedStage) return;
      const destination = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
      let safePos = Math.max(0, Math.min(destination, updated.length));

      if (movedStage.role === 'CHAIRMAN') {
        safePos = updated.length;
      } else {
        const chairIdx = updated.findIndex(s => s.role === 'CHAIRMAN');
        if (chairIdx !== -1 && safePos > chairIdx) {
          safePos = chairIdx;
        }
      }

      updated.splice(safePos, 0, movedStage);
      updated.forEach((s, idx) => { s.stageIndex = idx; });
      setDraftStages(updated);
    }
  };

  const handleDirectAddPaletteRole = (role: BuilderRoleItem) => {
    if (role.name === 'CHAIRMAN' && draftStages.some(s => s.role === 'CHAIRMAN')) {
      alert('Chairman is already present as the final approval authority.');
      return;
    }
    if (draftStages.some(s => s.role === role.name)) {
      alert(`${role.displayName} is already present in this workflow sequence.`);
      return;
    }

    const newStage: RequestStageInstance = {
      id: `stg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stageIndex: insertPosition,
      stageKey: `STAGE_${role.name}`,
      role: role.name as any,
      label: role.displayName,
      status: 'FUTURE',
      isApplicable: true,
      notes: `Added for ${selectedDepartment}`
    };

    const updated = [...draftStages];
    const chairmanIndex = updated.findIndex(s => s.role === 'CHAIRMAN');
    let safePos = Math.max(0, Math.min(insertPosition, updated.length));
    if (role.name !== 'CHAIRMAN' && chairmanIndex !== -1 && safePos > chairmanIndex) {
      safePos = chairmanIndex;
    }

    updated.splice(safePos, 0, newStage);
    updated.forEach((s, idx) => { s.stageIndex = idx; });
    setDraftStages(updated);
    setInsertPosition(Math.min(safePos + 1, updated.length));
  };

  // Manual Role Entry & Addition Handler
  const handleAddRoleFromInput = () => {
    const trimmedRole = insertRole.trim();
    if (!trimmedRole) {
      setRoleValidationError('Please enter a role name to add.');
      return;
    }

    const matchedStandard = STANDARD_ROLES.find(
      r => r.name.toLowerCase() === trimmedRole.toLowerCase() ||
           r.displayName.toLowerCase() === trimmedRole.toLowerCase() ||
           r.name.replace(/_/g, ' ').toLowerCase() === trimmedRole.toLowerCase()
    );

    const roleCode = matchedStandard ? matchedStandard.name : trimmedRole.toUpperCase().replace(/\s+/g, '_');
    const roleLabel = matchedStandard ? matchedStandard.displayName : getRoleDisplayName(roleCode);

    if (roleCode === 'CHAIRMAN' && draftStages.some(s => s.role === 'CHAIRMAN')) {
      setRoleValidationError('Chairman is already present as the final approval authority.');
      return;
    }
    if (draftStages.some(s => s.role === roleCode)) {
      setRoleValidationError(`${roleLabel} is already present in this workflow sequence.`);
      return;
    }

    setRoleValidationError('');

    const newStage: RequestStageInstance = {
      id: `stg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stageIndex: insertPosition,
      stageKey: `STAGE_${roleCode}`,
      role: roleCode as any,
      label: roleLabel,
      status: 'FUTURE',
      isApplicable: true,
      notes: `Added for ${selectedDepartment}`
    };

    const updated = [...draftStages];
    const chairmanIndex = updated.findIndex(s => s.role === 'CHAIRMAN');
    let safePos = Math.max(0, Math.min(insertPosition, updated.length));
    if (roleCode !== 'CHAIRMAN' && chairmanIndex !== -1 && safePos > chairmanIndex) {
      safePos = chairmanIndex;
    }

    updated.splice(safePos, 0, newStage);
    updated.forEach((s, idx) => { s.stageIndex = idx; });
    setDraftStages(updated);
    setInsertRole('');
    setInsertPosition(Math.min(safePos + 1, updated.length));
    setIsAddRoleDialogOpen(false);
  };

  // Differences summary for preview modal
  const diffSummary = useMemo(() => {
    if (!selectedRequest) return null;
    const oldStages = selectedRequest.stages || [];
    const oldRoles = oldStages.map(s => s.role);
    const newRoles = draftStages.map(s => s.role);

    const added = draftStages.filter(s => !oldRoles.includes(s.role));
    const removed = oldStages.filter(s => !newRoles.includes(s.role));
    const isBranchChanged = selectedRequest.selectedBranch !== draftBranch;

    const currentPending = oldStages.find(s => s.status === 'PENDING');
    const firstApplicableNew = draftStages.find(s => s.isApplicable && s.status !== 'COMPLETED');
    const isPendingReplaced = currentPending && firstApplicableNew && currentPending.role !== firstApplicableNew.role;

    return {
      added,
      removed,
      isBranchChanged,
      isPendingReplaced,
      oldPendingRole: currentPending?.role,
      newPendingRole: firstApplicableNew?.role
    };
  }, [selectedRequest, draftStages, draftBranch]);

  // Open Preview Modal
  const handleOpenPreview = () => {
    setActivationError('');
    setJustificationReason('');

    const validationError = validateWorkflowSequence(draftStages);
    if (validationError) {
      alert(validationError);
      return;
    }

    setShowPreviewModal(true);
  };

  const handleApproveAndActivate = async () => {
    if (!selectedRequest) return;

    setActivating(true);
    setActivationError('');

    try {
      const payload = {
        reason: justificationReason.trim() || undefined,
        expectedUpdatedAt: selectedRequest.updatedAt,
        selectedBranch: draftBranch,
        stages: draftStages.map(s => ({
          id: s.id,
          stageKey: s.stageKey,
          role: s.role,
          label: s.label,
          stageOrder: s.stageIndex + 1,
          isApplicable: s.isApplicable
        }))
      };

      const updated = await api.customizeRequestWorkflow(selectedRequest.id, payload);
      setActivationSuccess(`Workflow successfully customized and activated for request #${updated.id}!`);
      setShowPreviewModal(false);
      setSelectedRequest(updated);
      loadRequestIntoDraft(updated);
      setViewMode('INSPECT');

      // Update parent & local requests list
      setRequestsList(prev => [updated, ...prev.filter(r => r.id !== updated.id)]);
      if (onUpdateRequest) {
        onUpdateRequest(updated);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setActivationError(err.message);
      } else {
        setActivationError(err instanceof Error ? err.message : 'Failed to activate workflow changes.');
      }
    } finally {
      setActivating(false);
    }
  };

  const isFinalized = selectedRequest?.status === 'APPROVED' || selectedRequest?.status === 'REJECTED';

  // Uniform, perfectly aligned stage row renderer
  const renderStageRow = (stage: RequestStageInstance, idx: number, mode: 'CLASSIC' | 'BUILDER' | 'INSPECT') => {
    const isCompleted = stage.status === 'COMPLETED';
    const isSkipped = stage.status === 'SKIPPED' || !stage.isApplicable;
    const isDraggable = (mode === 'CLASSIC' || mode === 'BUILDER') && !isFinalized && !isCompleted;
    const label = stage.label || getRoleDisplayName(stage.role);

    return (
      <div
        key={stage.id || idx}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleDragStartStage(e, idx) : undefined}
        onDragEnd={isDraggable ? handleDragEnd : undefined}
        className={`rounded-xl border px-3.5 py-2.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-h-[48px] ${
          draggedStageIndex === idx
            ? 'opacity-40 border-dashed border-blue-400 bg-blue-50/50'
            : isSkipped
            ? 'bg-slate-50 border-slate-200 opacity-60'
            : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
        } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {/* LEFT GROUP: Drag Handle, Order Pill, Role Name */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
          {/* Drag Handle */}
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {isDraggable ? (
              <span className="text-slate-400 hover:text-blue-600 font-bold select-none text-xs cursor-grab" title="Drag to reorder stage position">
                ⋮⋮
              </span>
            ) : (
              <span className="w-4 h-4" />
            )}
          </div>

          {/* Order Pill */}
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-slate-100 text-slate-700 border border-slate-200">
            {idx + 1}
          </div>

          {/* Role Name */}
          <div className="min-w-0 flex-shrink-0">
            <span className="font-bold text-slate-900 text-xs truncate block max-w-[200px]" title={label}>
              {label}
            </span>
          </div>

          {/* Completed decider label if approved */}
          {isCompleted && stage.decidedByName && (
            <span className="text-[10px] text-slate-500 truncate max-w-[160px]" title={`Approved by ${stage.decidedByName} (${stage.decidedByRole})`}>
              · {stage.decidedByName}
            </span>
          )}
        </div>

        {/* RIGHT GROUP: Position Number, Applicability Button, Delete Icon, Plus (+) Icon */}
        {mode !== 'INSPECT' && !isFinalized && (
          <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto ml-auto">
            {/* Position Number Button */}
            <button
              type="button"
              disabled={isCompleted}
              onClick={() => setInsertPosition(idx)}
              className={`px-2 h-7 rounded-lg border text-[10px] font-bold flex items-center justify-center flex-shrink-0 transition cursor-pointer ${
                insertPosition === idx
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
              } disabled:opacity-30 disabled:pointer-events-none`}
              title={`Select Position ${idx + 1}`}
            >
              Pos {idx + 1}
            </button>

            {/* Applicability Button */}
            {!isCompleted && stage.role !== 'CHAIRMAN' ? (
              <button
                type="button"
                onClick={() => handleToggleApplicable(idx)}
                className={`px-2.5 h-7 rounded-lg border text-[11px] font-semibold flex items-center justify-center flex-shrink-0 transition cursor-pointer whitespace-nowrap ${
                  stage.isApplicable
                    ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    : 'bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                {stage.isApplicable ? 'Not Applicable' : 'Applicable'}
              </button>
            ) : null}

            {/* Delete Icon Button */}
            {!isCompleted && stage.role !== 'CHAIRMAN' ? (
              <button
                type="button"
                onClick={() => handleRemoveStage(idx)}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200 text-xs font-bold transition cursor-pointer"
                title="Remove stage"
              >
                ✕
              </button>
            ) : (
              <span className="w-7 h-7 flex-shrink-0" />
            )}

            {/* Plus (+) Button to insert new role after this stage */}
            {!isFinalized && (
              <button
                type="button"
                onClick={() => {
                  setInsertPosition(idx + 1);
                  setIsAddRoleDialogOpen(true);
                  setRoleValidationError('');
                }}
                className="w-7 h-7 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 transition flex items-center justify-center text-xs font-bold shadow-2xs cursor-pointer"
                title={`Insert new role after ${label} (Position ${idx + 2})`}
                aria-label={`Insert new role after ${label}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Add Role & Configure Stage Parameters Modal Dialogue (Opened ONLY via + icon)
  const renderAddRoleModal = () => {
    if (!isAddRoleDialogOpen || isFinalized || !isAuthorized) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                +
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Role & Configure Stage Parameters</h3>
                <p className="text-[11px] text-slate-500">Insert new role at Position {insertPosition + 1}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAddRoleDialogOpen(false);
                setRoleValidationError('');
              }}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* 1. Department dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Department:
              </label>
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              >
                {departmentOptions.map(dept => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Add Role (text input) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Role:
              </label>
              <input
                type="text"
                value={insertRole}
                onChange={e => {
                  setInsertRole(e.target.value);
                  if (roleValidationError) setRoleValidationError('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRoleFromInput();
                  }
                }}
                placeholder="e.g. ACCOUNTANT, FINANCE, VP, HOI..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                autoFocus
              />
              {roleValidationError && (
                <p className="mt-1 text-[11px] text-red-600 font-semibold flex items-start gap-1">
                  <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{roleValidationError}</span>
                </p>
              )}
            </div>

            {/* 3. Exact Position dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Exact Position:
              </label>
              <select
                value={insertPosition}
                onChange={e => setInsertPosition(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              >
                {draftStages.map((stg, i) => (
                  <option key={i} value={i}>
                    Position {i + 1} ({stg.label || getRoleDisplayName(stg.role)})
                  </option>
                ))}
                <option value={draftStages.length}>
                  Position {draftStages.length + 1} (At End)
                </option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsAddRoleDialogOpen(false);
                setRoleValidationError('');
              }}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddRoleFromInput}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Role to Workflow</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-7">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workflow Management</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Modify request workflows or create a new flow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'LIST' && isAuthorized && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartCreateGeneralBuilder}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-2xs transition cursor-pointer"
                title="Create a new approval workflow from scratch with drag-and-drop canvas"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create New Flow</span>
              </button>

              <button
                type="button"
                onClick={handleOpenGeneralWorkflowEditor}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-2xs transition cursor-pointer"
                title="Configure the default workflow for future requests"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Manage General Flow</span>
              </button>
            </div>
          )}

          {(viewMode !== 'LIST' || selectedRequest) && (
            <button
              type="button"
              onClick={() => {
                setSelectedRequestId('');
                setSelectedRequest(null);
                setViewMode('LIST');
              }}
              className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2 shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              ← Back to Requests
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. REQUEST SELECTION TABLE (viewMode === 'LIST')                           */}
      {/* ========================================================================= */}
      {viewMode === 'LIST' && !selectedRequest && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Customize Workflow for a Request
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Search by Request ID, title, description, requester name, department, category, or current status.
              </p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by ID, title, requester, department, category, status..."
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="QUERIED">Queried</option>
                  <option value="ESCALATED">Escalated</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Purchase">Purchase</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Leave">Leave</option>
                  <option value="Permission">Permission</option>
                  <option value="Travel">Travel</option>
                  <option value="Reimbursement">Reimbursement</option>
                  <option value="Work From Home">Work From Home</option>
                </select>

                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1.5 rounded-md font-semibold whitespace-nowrap">
                  {filteredRequests.length} Found
                </span>
              </div>
            </div>

            {/* Loading / Error States */}
            {loadingRequests && (
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Loading requests from database…
              </div>
            )}

            {requestsFetchError && (
              <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                {requestsFetchError}
              </div>
            )}

            {/* Results Table */}
            {!loadingRequests && (
              <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Request ID & Title</th>
                      <th className="px-4 py-3">Requester & Dept</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Current Stage</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900">#{req.id}</span>
                            <span className="text-[10px] font-mono text-slate-500">v{req.workflowVersionNumber || 1}</span>
                          </div>
                          <div className="text-slate-600 font-medium truncate max-w-xs">{req.title}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{req.requester}</div>
                          <div className="text-slate-400 text-[11px]">{req.department}</div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            {getRoleDisplayName(req.currentStage)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {/* 1. View (Eye icon only) */}
                            <button
                              type="button"
                              onClick={() => handleStartInspect(req)}
                              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-blue-600 border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-2xs"
                              title={`View workflow for Request #${req.id}${req.title ? ` - ${req.title}` : ''}`}
                              aria-label={`View workflow for Request #${req.id}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>

                            {/* 2. Modify (Edit / pencil icon only) -> Shows confirmation dialogue */}
                            <button
                              type="button"
                              onClick={() => setModifyConfirmRequest(req)}
                              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-amber-600 border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-2xs"
                              title={`Modify workflow for Request #${req.id}${req.title ? ` - ${req.title}` : ''}`}
                              aria-label={`Modify workflow for Request #${req.id}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            {/* 3. Create New Flow (Plus icon only) */}
                            <button
                              type="button"
                              onClick={() => handleStartCreateBuilder(req)}
                              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition cursor-pointer shadow-2xs"
                              title={`Create new flow based on Request #${req.id}`}
                              aria-label={`Create new flow based on Request #${req.id}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRequests.length === 0 && !loadingRequests && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                          <p className="font-semibold text-slate-600 mb-1">No matching requests found</p>
                          <p className="text-[11px]">Try adjusting your search criteria or clear the filters to view available requests.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EDIT WORKFLOW INTERFACE (viewMode === 'EDIT_CLASSIC')                   */}
      {/* ========================================================================= */}
      {viewMode === 'EDIT_CLASSIC' && selectedRequest && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6 animate-in fade-in duration-150">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  Request #{selectedRequest.id}
                </span>
                <span className="text-xs text-slate-500 font-medium truncate max-w-md">
                  {selectedRequest.title}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                Edit Workflow Sequence
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedRequest) loadRequestIntoDraft(selectedRequest);
                  setViewMode('INSPECT');
                }}
                className="text-xs text-slate-600 hover:text-slate-800 font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel / Discard
              </button>
              <button
                type="button"
                onClick={handleOpenPreview}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                Review & Activate Changes →
              </button>
            </div>
          </div>

          {/* Overview Banner */}
          <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-500">#{selectedRequest.id}</span>
                <h4 className="text-sm font-bold text-slate-900">{selectedRequest.title}</h4>
                <StatusBadge status={selectedRequest.status} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Requester: <strong className="text-slate-700">{selectedRequest.requester}</strong> ({selectedRequest.department}) ·{' '}
                Category: <strong className="text-slate-700">{selectedRequest.category}</strong> ·{' '}
                Amount: <strong className="text-slate-700">{formatCurrencyINR(selectedRequest.amount)}</strong> ·{' '}
                Current Stage: <strong className="text-blue-700">{getRoleDisplayName(selectedRequest.currentStage)}</strong>
              </p>
            </div>

            {isFinalized && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 font-medium">
                ⚠️ This request is {selectedRequest.status}. Completed requests cannot be altered.
              </div>
            )}
          </div>

          {((selectedRequest.workflowVersionNumber || 1) < (generalWorkflow.version || 1)) && !isFinalized && isAuthorized && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-indigo-900">General Workflow Update Available:</span>{' '}
                <span className="text-indigo-700">
                  This request is running on v{selectedRequest.workflowVersionNumber || 1}. General Workflow v{generalWorkflow.version} is now active.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenMigrationModal(selectedRequest)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap"
              >
                Apply Updated Workflow
              </button>
            </div>
          )}

          {/* Sequence Stage Cards (Preserves all existing stages in Edit Workflow) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Workflow Approval Sequence ({draftStages.length} Stages)
              </h4>
            </div>

            <div className="space-y-1">
              {swapError && (
                <div role="alert" className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2 shadow-2xs mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{swapError}</span>
                  </div>
                  <button type="button" onClick={() => setSwapError(null)} className="text-amber-600 hover:text-amber-800 text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer">✕</button>
                </div>
              )}
              {draftStages.map((stage, idx) => (
                <React.Fragment key={stage.id || idx}>
                  {idx > 0 && (
                    <div className="flex items-center justify-center gap-2 py-1">
                      <div className="h-px bg-slate-200 flex-1 max-w-[80px]" />
                      <button
                        type="button"
                        disabled={draftStages[idx - 1].status === 'COMPLETED' || stage.status === 'COMPLETED' || isFinalized}
                        onClick={() => handleSwapStages(idx - 1, idx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 shadow-2xs transition font-semibold text-[11px] disabled:opacity-30 disabled:pointer-events-none cursor-pointer group"
                        title={`Swap Stage ${idx} (${draftStages[idx - 1].label || draftStages[idx - 1].role}) and Stage ${idx + 1} (${stage.label || stage.role})`}
                        aria-label={`Swap Stage ${idx} and Stage ${idx + 1}`}
                      >
                        <svg className="w-3.5 h-3.5 text-blue-600 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        <span>Swap</span>
                      </button>
                      <div className="h-px bg-slate-200 flex-1 max-w-[80px]" />
                    </div>
                  )}
                  {renderStageRow(stage, idx, 'CLASSIC')}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Bottom Actions Bar (Clean, no duplicate role panel) */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (selectedRequest) loadRequestIntoDraft(selectedRequest);
                setViewMode('INSPECT');
              }}
              className="text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
            >
              Cancel / Discard Draft
            </button>

            <button
              type="button"
              onClick={handleOpenPreview}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm transition cursor-pointer"
            >
              Review & Activate Changes →
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CREATE NEW FLOW — DRAG-AND-DROP BUILDER (viewMode === 'CREATE_BUILDER') */}
      {/* ========================================================================= */}
      {viewMode === 'CREATE_BUILDER' && selectedRequest && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6 animate-in fade-in duration-150">
          {/* Success message banner */}
          {activationSuccess && (
            <div role="status" className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 rounded">
              {activationSuccess}
            </div>
          )}

          {/* Notice when workflow replacement is not permitted */}
          {isFinalized && (
            <div role="alert" className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-xs text-amber-800 rounded">
              <strong>Workflow Modification Restricted:</strong> Request #{selectedRequest.id} is already {selectedRequest.status.toLowerCase()}. Finalized requests cannot have their workflow sequence altered.
            </div>
          )}

          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  Request #{selectedRequest.id}
                </span>
                <span className="text-xs text-slate-500 font-medium truncate max-w-md">
                  {selectedRequest.title}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                Create New Flow
                <span className="text-xs font-normal text-slate-500">
                  (Requester: {selectedRequest.requester} · {selectedRequest.department})
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftStages([]);
                  setInsertPosition(0);
                  setInsertRole('');
                  setRoleValidationError('');
                }}
                className="text-xs text-slate-600 hover:text-slate-800 font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Clear Canvas
              </button>
              <button
                type="button"
                onClick={handleOpenPreview}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                Review & Activate Flow →
              </button>
            </div>
          </div>

          {/* Overview Banner */}
          <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-500">#{selectedRequest.id}</span>
                <h4 className="text-sm font-bold text-slate-900">{selectedRequest.title}</h4>
                <StatusBadge status={selectedRequest.status} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Requester: <strong className="text-slate-700">{selectedRequest.requester}</strong> ({selectedRequest.department}) ·{' '}
                Category: <strong className="text-slate-700">{selectedRequest.category}</strong> ·{' '}
                Amount: <strong className="text-slate-700">{formatCurrencyINR(selectedRequest.amount)}</strong> ·{' '}
                Current Stage: <strong className="text-blue-700">{getRoleDisplayName(selectedRequest.currentStage)}</strong>
              </p>
            </div>
          </div>

          {/* TWO-COLUMN DRAG-AND-DROP WORKBENCH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ============================================================== */}
            {/* LEFT SIDE — AVAILABLE ROLES PALETTE (4 Cols)                  */}
            {/* ============================================================== */}
            <div className="lg:col-span-4 bg-slate-50/90 rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>Available Roles</span>
                  </h4>
                </div>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {filteredPaletteRoles.length} Roles
                </span>
              </div>

              {/* Search & Designation Filters */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={rolePaletteSearch}
                  onChange={e => setRolePaletteSearch(e.target.value)}
                  placeholder="Search designation or person's name..."
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />

                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {ROLE_DESIGNATION_FILTERS.map(filter => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setRolePaletteDesignationFilter(filter)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        rolePaletteDesignationFilter === filter
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Draggable Role Cards Palette */}
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredPaletteRoles.map(entry => (
                  <div
                    key={entry.key}
                    draggable={!isFinalized}
                    onDragStart={(e) => handleDragStartRole(e, entry)}
                    onDragEnd={handleDragEnd}
                    className={`group p-2.5 rounded-xl border bg-white transition shadow-2xs hover:shadow-xs hover:border-blue-400 ${
                      draggedRole?.role === entry.roleKey
                        ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50/60'
                        : 'border-slate-200'
                    } ${isFinalized ? 'cursor-not-allowed opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 group-hover:text-blue-600 font-bold select-none text-xs cursor-grab" title="Drag to workflow canvas">
                          ⋮⋮
                        </span>
                        <div>
                          <div className="flex items-center">
                            <span className="font-bold text-slate-900 text-xs">
                              {entry.displayLabel}
                            </span>
                          </div>
                          {entry.personName && (
                            <span className="text-[10px] text-slate-500 block">
                              {entry.displayName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!isFinalized && isAuthorized && (
                          <button
                            type="button"
                            onClick={() => handleDirectAddPaletteEntry(entry)}
                            className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 text-[10px] font-bold transition shadow-2xs cursor-pointer"
                            title={`Add ${entry.displayLabel} to workflow sequence`}
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredPaletteRoles.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No roles matching filter.
                  </div>
                )}
              </div>
            </div>

            {/* ============================================================== */}
            {/* RIGHT SIDE — WORKFLOW CANVAS & PARAMETERS (8 Cols)             */}
            {/* ============================================================== */}
            <div className="lg:col-span-8 space-y-4">

              {/* WORKFLOW CANVAS CONTAINER */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <span>Workflow Canvas</span>
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {draftStages.length} Stages Added
                      </span>
                    </h4>
                  </div>
                </div>

                {/* EMPTY CANVAS DROP ZONE */}
                {draftStages.length === 0 && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(0); }}
                    onDragLeave={() => setDropTargetIndex(null)}
                    onDrop={(e) => { e.preventDefault(); handleDropAt(0, e); }}
                    className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
                      dropTargetIndex === 0 || draggedRole
                        ? 'border-blue-500 bg-blue-50/80 ring-4 ring-blue-100'
                        : 'border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 text-2xl font-bold shadow-2xs">
                      📥
                    </div>
                    <p className="font-bold text-slate-800 text-sm mb-3">
                      Drag roles here to build your workflow
                    </p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {['INSTITUTION_MANAGER', 'FINANCE', 'ACCOUNTANT', 'VP', 'HOI', 'DEAN', 'CEO', 'CHAIRMAN'].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            const match = AVAILABLE_BUILDER_ROLES.find(x => x.name === r);
                            if (match) handleDirectAddPaletteRole(match);
                          }}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-[10px] font-semibold transition cursor-pointer shadow-2xs"
                        >
                          + {getRoleDisplayName(r)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* CANVAS SEQUENCE & INTER-STAGE DROP ZONES */}
                {draftStages.length > 0 && (
                  <div className="space-y-1">
                    {swapError && (
                      <div role="alert" className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2 shadow-2xs mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>{swapError}</span>
                        </div>
                        <button type="button" onClick={() => setSwapError(null)} className="text-amber-600 hover:text-amber-800 text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer">✕</button>
                      </div>
                    )}

                    {/* Top Drop Target Zone (Position 0) */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(0); }}
                      onDragLeave={() => setDropTargetIndex(null)}
                      onDrop={(e) => { e.preventDefault(); handleDropAt(0, e); }}
                      className={`transition-all rounded-lg flex items-center justify-center ${
                        dropTargetIndex === 0
                          ? 'h-10 bg-blue-100 border-2 border-dashed border-blue-500 text-blue-700 text-xs font-bold'
                          : (draggedRole || draggedStageIndex !== null)
                          ? 'h-6 bg-blue-50/50 border border-dashed border-blue-300 text-[10px] text-blue-600'
                          : 'h-1.5'
                      }`}
                    >
                      {(dropTargetIndex === 0 || draggedRole || draggedStageIndex !== null) && (
                        <span>+ Drop here to insert at Position 1</span>
                      )}
                    </div>

                    {/* Stage Cards Loop */}
                    {draftStages.map((stage, idx) => (
                      <React.Fragment key={stage.id || idx}>
                        {/* Inter-stage Drop Zone & Flow Indicator & Swap Button */}
                        {idx > 0 && (
                          <div className="my-1 space-y-1">
                            <div className="flex items-center justify-center gap-2 py-0.5">
                              <div className="h-px bg-slate-200 flex-1 max-w-[80px]" />
                              <button
                                type="button"
                                disabled={draftStages[idx - 1].status === 'COMPLETED' || stage.status === 'COMPLETED' || isFinalized}
                                onClick={() => handleSwapStages(idx - 1, idx)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 shadow-2xs transition font-semibold text-[11px] disabled:opacity-30 disabled:pointer-events-none cursor-pointer group"
                                title={`Swap Stage ${idx} (${draftStages[idx - 1].label || draftStages[idx - 1].role}) and Stage ${idx + 1} (${stage.label || stage.role})`}
                                aria-label={`Swap Stage ${idx} and Stage ${idx + 1}`}
                              >
                                <svg className="w-3.5 h-3.5 text-blue-600 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                                <span>Swap</span>
                              </button>
                              <div className="h-px bg-slate-200 flex-1 max-w-[80px]" />
                            </div>
                            <div
                              onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(idx); }}
                              onDragLeave={() => setDropTargetIndex(null)}
                              onDrop={(e) => { e.preventDefault(); handleDropAt(idx, e); }}
                              className={`transition-all rounded-lg flex items-center justify-center ${
                                dropTargetIndex === idx
                                  ? 'h-10 bg-blue-100 border-2 border-dashed border-blue-500 text-blue-700 text-xs font-bold'
                                  : (draggedRole || draggedStageIndex !== null)
                                  ? 'h-6 bg-blue-50/50 border border-dashed border-blue-300 text-[10px] text-blue-600'
                                  : 'py-0.5'
                              }`}
                            >
                              {dropTargetIndex === idx && (
                                <span>+ Drop here to insert at Position {idx + 1}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Stage Card */}
                        {renderStageRow(stage, idx, 'BUILDER')}
                      </React.Fragment>
                    ))}

                    {/* Bottom Drop Target Zone (At End) */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(draftStages.length); }}
                      onDragLeave={() => setDropTargetIndex(null)}
                      onDrop={(e) => { e.preventDefault(); handleDropAt(draftStages.length, e); }}
                      className={`transition-all rounded-lg flex items-center justify-center my-1 ${
                        dropTargetIndex === draftStages.length
                          ? 'h-10 bg-blue-100 border-2 border-dashed border-blue-500 text-blue-700 text-xs font-bold'
                          : (draggedRole || draggedStageIndex !== null)
                          ? 'h-6 bg-blue-50/50 border border-dashed border-blue-300 text-[10px] text-blue-600'
                          : 'h-1.5'
                      }`}
                    >
                      {(dropTargetIndex === draftStages.length || draggedRole || draggedStageIndex !== null) && (
                        <span>+ Drop here to insert at End (Position {draftStages.length + 1})</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRequestId('');
                    setViewMode('LIST');
                  }}
                  className="text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  ← Back to Requests
                </button>

                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm transition cursor-pointer"
                >
                  Review & Activate Flow →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. INSPECT VIEW (viewMode === 'INSPECT')                                   */}
      {/* ========================================================================= */}
      {viewMode === 'INSPECT' && selectedRequest && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6 animate-in fade-in duration-150">
          {/* Success message banner */}
          {activationSuccess && (
            <div role="status" className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 rounded">
              {activationSuccess}
            </div>
          )}

          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  Request #{selectedRequest.id}
                </span>
                <span className="text-xs text-slate-500 font-medium truncate max-w-md">
                  {selectedRequest.title}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                Workflow Inspection
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {!isFinalized && isAuthorized && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(selectedRequest)}
                    className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit Workflow</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartCreateBuilder(selectedRequest)}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create New Flow</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Overview Banner */}
          <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-500">#{selectedRequest.id}</span>
                <h4 className="text-sm font-bold text-slate-900">{selectedRequest.title}</h4>
                <StatusBadge status={selectedRequest.status} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Requester: <strong className="text-slate-700">{selectedRequest.requester}</strong> ({selectedRequest.department}) ·{' '}
                Category: <strong className="text-slate-700">{selectedRequest.category}</strong> ·{' '}
                Amount: <strong className="text-slate-700">{formatCurrencyINR(selectedRequest.amount)}</strong> ·{' '}
                Current Stage: <strong className="text-blue-700">{getRoleDisplayName(selectedRequest.currentStage)}</strong> ·{' '}
                Branch: <strong className="text-slate-700">{selectedRequest.selectedBranch || 'HR'}</strong>
              </p>
            </div>
          </div>

          {((selectedRequest.workflowVersionNumber || 1) < (generalWorkflow.version || 1)) && !isFinalized && isAuthorized && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-indigo-900">General Workflow Update Available:</span>{' '}
                <span className="text-indigo-700">
                  This request is running on v{selectedRequest.workflowVersionNumber || 1}. General Workflow v{generalWorkflow.version} is now active.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenMigrationModal(selectedRequest)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap"
              >
                Apply Updated Workflow
              </button>
            </div>
          )}

          {/* Sequence Stage Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Current Active Stages ({draftStages.length} Stages)
            </h4>
            <div className="space-y-2">
              {draftStages.map((stage, idx) => renderStageRow(stage, idx, 'INSPECT'))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. GENERAL WORKFLOW BUILDER (viewMode === 'GENERAL_BUILDER')               */}
      {/* ========================================================================= */}
      {viewMode === 'GENERAL_BUILDER' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6 animate-in fade-in duration-150">
          {generalSaveSuccess && (
            <div role="status" className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 rounded">
              ✓ {generalSaveSuccess}
            </div>
          )}

          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {draftStages.length === 0 ? 'Create New General Flow' : 'Manage General Flow'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {draftStages.length === 0
                  ? 'Drag and drop roles from the left palette down to build a brand new approval flow from scratch.'
                  : `Configure default approval sequence for future requests. Active: v${generalWorkflow.version}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftStages([])}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition cursor-pointer flex items-center gap-1.5"
                title="Clear canvas to create a brand new approval flow from scratch with drag-and-drop"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>+ Create New Flow (Empty Canvas)</span>
              </button>
              <button
                type="button"
                onClick={handleOpenGeneralWorkflowEditor}
                className="text-xs text-slate-700 hover:text-slate-900 font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                title="Reset stages to default sequence"
              >
                Reset to Default
              </button>
              <button
                type="button"
                onClick={handleSaveGeneralDraft}
                className="text-xs text-slate-700 hover:text-slate-900 font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={handleOpenGeneralPreview}
                className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
              >
                Preview Changes
              </button>
              <button
                type="button"
                onClick={handleOpenGeneralPreview}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                Activate Workflow →
              </button>
            </div>
          </div>


          {/* TWO-COLUMN WORKBENCH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT SIDE — AVAILABLE ROLES PALETTE (4 Cols) */}
            <div className="lg:col-span-4 bg-slate-50/90 rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span>Available Roles</span>
                </h4>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {filteredPaletteRoles.length} Roles
                </span>
              </div>

              {/* Filters */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={rolePaletteSearch}
                  onChange={e => setRolePaletteSearch(e.target.value)}
                  placeholder="Search designation or person's name..."
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />

                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {ROLE_DESIGNATION_FILTERS.map(filter => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setRolePaletteDesignationFilter(filter)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        rolePaletteDesignationFilter === filter
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Draggable Role Cards */}
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredPaletteRoles.map(entry => (
                  <div
                    key={entry.key}
                    draggable
                    onDragStart={(e) => handleDragStartRole(e, entry)}
                    onDragEnd={handleDragEnd}
                    className={`group p-2.5 rounded-xl border bg-white transition shadow-2xs hover:shadow-xs hover:border-blue-400 cursor-grab active:cursor-grabbing ${
                      draggedRole?.role === entry.roleKey ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50/60' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 group-hover:text-blue-600 font-bold select-none text-xs cursor-grab" title="Drag to workflow canvas">
                          ⋮⋮
                        </span>
                        <div>
                          <div className="flex items-center">
                            <span className="font-bold text-slate-900 text-xs">
                              {entry.displayLabel}
                            </span>
                          </div>
                          {entry.personName && (
                            <span className="text-[10px] text-slate-500 block">
                              {entry.displayName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDirectAddPaletteEntry(entry)}
                          className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 text-[10px] font-bold transition shadow-2xs cursor-pointer"
                          title={`Add ${entry.displayLabel} to workflow sequence`}
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredPaletteRoles.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No roles matching filter.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDE — WORKFLOW CANVAS (8 Cols) */}
            <div className="lg:col-span-8 space-y-4">


              {/* WORKFLOW CANVAS CONTAINER */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <span>Workflow Canvas</span>
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {draftStages.length} Stages
                      </span>
                    </h4>
                  </div>
                </div>

                {/* EMPTY CANVAS DROP ZONE */}
                {draftStages.length === 0 && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(0); }}
                    onDragLeave={() => setDropTargetIndex(null)}
                    onDrop={(e) => { e.preventDefault(); handleDropAt(0, e); }}
                    className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
                      dropTargetIndex === 0 || draggedRole
                        ? 'border-blue-500 bg-blue-50/80 ring-4 ring-blue-100'
                        : 'border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 text-2xl font-bold shadow-2xs">
                      📥
                    </div>
                    <p className="font-bold text-slate-800 text-sm mb-1">
                      Drag roles here to build your new general approval flow
                    </p>
                    <p className="text-xs text-slate-500 mb-4">
                      Drag any role from the left palette down or click a chip below to start adding approval stages
                    </p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {['INSTITUTION_MANAGER', 'FINANCE', 'ACCOUNTANT', 'VP', 'HOI', 'DEAN', 'CEO', 'CHAIRMAN'].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            const match = AVAILABLE_BUILDER_ROLES.find(x => x.name === r);
                            if (match) handleDirectAddPaletteRole(match);
                          }}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-[10px] font-semibold transition cursor-pointer shadow-2xs"
                        >
                          + {getRoleDisplayName(r)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* CANVAS SEQUENCE & INTER-STAGE DROP ZONES */}
                {draftStages.length > 0 && (
                  <div className="space-y-1">
                    {swapError && (
                      <div role="alert" className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2 shadow-2xs mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>{swapError}</span>
                        </div>
                        <button type="button" onClick={() => setSwapError(null)} className="text-amber-600 hover:text-amber-800 text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer">✕</button>
                      </div>
                    )}

                    {/* Top Drop Target Zone (Position 0) */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(0); }}
                      onDragLeave={() => setDropTargetIndex(null)}
                      onDrop={(e) => { e.preventDefault(); handleDropAt(0, e); }}
                      className={`transition-all rounded-lg flex items-center justify-center ${
                        dropTargetIndex === 0
                          ? 'h-10 bg-blue-100 border-2 border-dashed border-blue-500 text-blue-700 text-xs font-bold'
                          : (draggedRole || draggedStageIndex !== null)
                          ? 'h-6 bg-blue-50/50 border border-dashed border-blue-300 text-[10px] text-blue-600'
                          : 'h-1.5'
                      }`}
                    >
                      {(dropTargetIndex === 0 || draggedRole || draggedStageIndex !== null) && (
                        <span>+ Drop here to insert at Position 1</span>
                      )}
                    </div>

                    {/* Stage Cards Loop */}
                    {draftStages.map((stage, idx) => (
                      <React.Fragment key={stage.id || idx}>
                        {/* Inter-stage Drop Zone & Flow Indicator & Swap Controls */}
                        {idx > 0 && (
                          <div className="my-1 space-y-1">
                            <div className="flex items-center justify-center gap-2 py-0.5">
                              <div className="h-px bg-slate-200 flex-1 max-w-[80px]" />
                              <button
                                type="button"
                                disabled={draftStages[idx - 1].status === 'COMPLETED' || stage.status === 'COMPLETED' || isFinalized}
                                onClick={() => handleSwapStages(idx - 1, idx)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 shadow-2xs transition font-semibold text-[11px] disabled:opacity-30 disabled:pointer-events-none cursor-pointer group"
                                title={`Swap Stage ${idx} (${draftStages[idx - 1].label || draftStages[idx - 1].role}) and Stage ${idx + 1} (${stage.label || stage.role})`}
                                aria-label={`Swap Stage ${idx} and Stage ${idx + 1}`}
                              >
                                <svg className="w-3.5 h-3.5 text-blue-600 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                                <span>Swap</span>
                              </button>
                              <div className="h-px bg-slate-200 flex-1 max-w-[80px]" />
                            </div>
                            <div
                              onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(idx); }}
                              onDragLeave={() => setDropTargetIndex(null)}
                              onDrop={(e) => { e.preventDefault(); handleDropAt(idx, e); }}
                              className={`transition-all rounded-lg flex items-center justify-center ${
                                dropTargetIndex === idx
                                  ? 'h-10 bg-blue-100 border-2 border-dashed border-blue-500 text-blue-700 text-xs font-bold'
                                  : (draggedRole || draggedStageIndex !== null)
                                  ? 'h-6 bg-blue-50/50 border border-dashed border-blue-300 text-[10px] text-blue-600'
                                  : 'py-0.5'
                              }`}
                            >
                              {dropTargetIndex === idx && (
                                <span>+ Drop here to insert at Position {idx + 1}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Stage Card */}
                        {renderStageRow(stage, idx, 'BUILDER')}
                      </React.Fragment>
                    ))}

                    {/* Bottom Drop Target Zone (At End) */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(draftStages.length); }}
                      onDragLeave={() => setDropTargetIndex(null)}
                      onDrop={(e) => { e.preventDefault(); handleDropAt(draftStages.length, e); }}
                      className={`transition-all rounded-lg flex items-center justify-center my-1 ${
                        dropTargetIndex === draftStages.length
                          ? 'h-10 bg-blue-100 border-2 border-dashed border-blue-500 text-blue-700 text-xs font-bold'
                          : (draggedRole || draggedStageIndex !== null)
                          ? 'h-6 bg-blue-50/50 border border-dashed border-blue-300 text-[10px] text-blue-600'
                          : 'h-1.5'
                      }`}
                    >
                      {(dropTargetIndex === draftStages.length || draggedRole || draggedStageIndex !== null) && (
                        <span>+ Drop here to insert at End (Position {draftStages.length + 1})</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewMode('LIST')}
                  className="text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  ← Back to Requests
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveGeneralDraft}
                    className="text-xs text-slate-700 hover:text-slate-900 font-medium px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenGeneralPreview}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm transition cursor-pointer"
                  >
                    Preview & Activate Workflow →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FINAL PREVIEW & EXPLICIT APPROVAL MODAL                                    */}
      {/* ========================================================================= */}
      {showPreviewModal && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Review & Activate Workflow Changes</h3>
                <p className="text-xs text-slate-400">Request #{selectedRequest.id}: {selectedRequest.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {activationError && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium">
                  {activationError}
                </div>
              )}

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <h5 className="font-bold text-slate-500 uppercase tracking-wide text-[10px] mb-2">Previous Workflow</h5>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-600 font-medium">
                    {(selectedRequest.stages || []).map((s, idx) => (
                      <li key={idx} className={s.status === 'COMPLETED' ? 'text-emerald-700 font-bold' : ''}>
                        {getRoleDisplayName(s.role)} {s.status === 'COMPLETED' ? '(✓ Completed)' : ''}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-[11px] text-slate-500">Branch: <strong>{selectedRequest.selectedBranch || 'HR'}</strong></p>
                </div>

                <div>
                  <h5 className="font-bold text-blue-700 uppercase tracking-wide text-[10px] mb-2">Proposed Workflow</h5>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-800 font-bold">
                    {draftStages.map((s, idx) => (
                      <li key={idx} className={s.status === 'COMPLETED' ? 'text-emerald-700' : (!s.isApplicable ? 'text-slate-400 line-through' : 'text-blue-900')}>
                        {getRoleDisplayName(s.role)} {!s.isApplicable ? '(Not Applicable)' : ''}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-[11px] text-blue-800 font-semibold">Branch: <strong>{draftBranch}</strong></p>
                </div>
              </div>

              {/* Summary of Impact */}
              {diffSummary && (
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <h5 className="font-bold text-blue-900">Summary of Pipeline Updates:</h5>
                  <ul className="list-disc pl-5 space-y-1 text-blue-800 text-[11px]">
                    <li>Completed stages and historical timestamps are <strong>preserved permanently</strong>.</li>
                    {diffSummary.added.length > 0 && (
                      <li>Added stages: <strong>{diffSummary.added.map(s => getRoleDisplayName(s.role)).join(', ')}</strong></li>
                    )}
                    {diffSummary.removed.length > 0 && (
                      <li>Removed stages: <strong>{diffSummary.removed.map(s => getRoleDisplayName(s.role)).join(', ')}</strong></li>
                    )}
                    {diffSummary.isPendingReplaced && (
                      <li className="text-amber-800 font-bold">
                        Pending stage {diffSummary.oldPendingRole} will be marked <strong>SUPERSEDED</strong> and review will transfer to <strong>{diffSummary.newPendingRole}</strong>.
                      </li>
                    )}
                    {diffSummary.isBranchChanged && (
                      <li>Branch changed from {selectedRequest.selectedBranch || 'None'} to <strong>{draftBranch}</strong>.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Justification field */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Official Justification / Reason (Optional)
                </label>
                <textarea
                  rows={2}
                  value={justificationReason}
                  onChange={e => setJustificationReason(e.target.value)}
                  placeholder="Enter reason for modifying approval sequence..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Warning Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs leading-relaxed">
                <strong>Warning:</strong> Activating this workflow directly updates request #{selectedRequest.id}. Completed decisions remain intact, and this action is recorded in the permanent audit and migration log.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                disabled={activating}
                onClick={() => setShowPreviewModal(false)}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
              >
                Back to Edit
              </button>

              <button
                type="button"
                disabled={activating}
                onClick={handleApproveAndActivate}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm cursor-pointer inline-flex items-center gap-1.5"
              >
                {activating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Activating in Database…
                  </>
                ) : (
                  'Confirm and Activate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERAL WORKFLOW PREVIEW & ACTIVATION MODAL */}
      {showGeneralPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Activate General Workflow v{(generalWorkflow.version || 1) + 1}</h3>
                <p className="text-xs text-slate-400">Default workflow for future submitted requests</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGeneralPreviewModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {activationError && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium">
                  {activationError}
                </div>
              )}

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <h5 className="font-bold text-slate-500 uppercase tracking-wide text-[10px] mb-2">
                    Current Active (v{generalWorkflow.version})
                  </h5>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-600 font-medium">
                    {(generalWorkflow.stages || []).map((s, idx) => (
                      <li key={idx}>
                        {s.label || getRoleDisplayName(s.role)}
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h5 className="font-bold text-indigo-700 uppercase tracking-wide text-[10px] mb-2">
                    Proposed Default (v{(generalWorkflow.version || 1) + 1})
                  </h5>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-800 font-bold">
                    {draftStages.map((s, idx) => (
                      <li key={idx} className={!s.isApplicable ? 'text-slate-400 line-through' : 'text-indigo-900'}>
                        {s.label || getRoleDisplayName(s.role)} {!s.isApplicable ? '(Not Applicable)' : ''}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Justification */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Activation Reason / Version Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={generalActivationReason}
                  onChange={e => setGeneralActivationReason(e.target.value)}
                  placeholder="e.g. Added GM operational review checkpoint for future organizational requests..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Impact Notice */}
              <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-xs leading-relaxed">
                <strong>Scope of Activation:</strong> This workflow will be used for all <strong>new requests submitted from this point onward</strong>. In-progress requests retain their captured workflow and approval history.
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                disabled={activating}
                onClick={() => setShowGeneralPreviewModal(false)}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
              >
                Back to Editor
              </button>

              <button
                type="button"
                disabled={activating}
                onClick={handleActivateGeneralWorkflow}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm cursor-pointer inline-flex items-center gap-1.5"
              >
                {activating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Activating Workflow…
                  </>
                ) : (
                  'Confirm and Activate v' + ((generalWorkflow.version || 1) + 1)
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLLED WORKFLOW MIGRATION MODAL (For In-Progress Requests) */}
      {requestToMigrate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Apply Updated Workflow to Request #{requestToMigrate.id}</h3>
                <p className="text-xs text-slate-400">{requestToMigrate.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setRequestToMigrate(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {migrationError && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium">
                  {migrationError}
                </div>
              )}

              {/* Version pill */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600">Workflow Migration:</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
                  v{requestToMigrate.workflowVersionNumber || 1}
                </span>
                <span className="text-slate-400">→</span>
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                  v{generalWorkflow.version} (Active General Workflow)
                </span>
              </div>

              {/* Pipeline Comparison */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <h5 className="font-bold text-slate-500 uppercase tracking-wide text-[10px] mb-2">
                    Current Completed Stages (Preserved)
                  </h5>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-700">
                    {(requestToMigrate.stages || []).filter(s => s.status === 'COMPLETED').map((s, idx) => (
                      <li key={idx} className="text-emerald-700 font-semibold">
                        ✓ {s.label || getRoleDisplayName(s.role)}
                        {s.decidedByName && (
                          <span className="block text-[10px] text-slate-500 font-normal">
                            Approved by {s.decidedByName} ({new Date(s.decisionTs || Date.now()).toLocaleDateString()})
                          </span>
                        )}
                      </li>
                    ))}
                    {(requestToMigrate.stages || []).filter(s => s.status === 'COMPLETED').length === 0 && (
                      <li className="text-slate-400 italic list-none">No stages completed yet.</li>
                    )}
                  </ol>
                </div>

                <div>
                  <h5 className="font-bold text-indigo-700 uppercase tracking-wide text-[10px] mb-2">
                    Updated Pipeline Stages
                  </h5>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-800">
                    {generalWorkflow.stages.map((s, idx) => {
                      const wasCompleted = (requestToMigrate.stages || []).some(os => os.role === s.role && os.status === 'COMPLETED');
                      const isNewRole = !(requestToMigrate.stages || []).some(os => os.role === s.role);
                      return (
                        <li key={idx} className={wasCompleted ? 'text-emerald-700 font-medium' : isNewRole ? 'text-indigo-700 font-bold' : 'text-slate-700'}>
                          {s.label || getRoleDisplayName(s.role)}
                          {wasCompleted && ' (✓ Completed)'}
                          {isNewRole && ' (+ New Stage)'}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Migration Reason / Authority Justification
                </label>
                <textarea
                  rows={2}
                  value={migrationReason}
                  onChange={e => setMigrationReason(e.target.value)}
                  placeholder="Enter reason for applying updated general workflow to this in-progress request..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs leading-relaxed">
                <strong>Historical Integrity Guarantee:</strong> Completed approval stages, decisions, and timestamps will NOT be altered or re-executed. The old workflow sequence is recorded in the permanent migration history.
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                disabled={migrating}
                onClick={() => setRequestToMigrate(null)}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
              >
                Keep Current Workflow
              </button>

              <button
                type="button"
                disabled={migrating}
                onClick={handleConfirmMigration}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm cursor-pointer inline-flex items-center gap-1.5"
              >
                {migrating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Migrating Request…
                  </>
                ) : (
                  'Confirm & Apply Update'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION BEFORE CANCELLING A ROLE                                     */}
      {/* ========================================================================= */}
      {stageToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center font-bold text-lg flex-shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Role Cancellation</h3>
                <p className="text-xs text-slate-500">Remove role from workflow sequence</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to cancel and remove the stage for{' '}
              <strong className="text-slate-900">
                {stageToCancel.stage.label || getRoleDisplayName(stageToCancel.stage.role)}
              </strong>{' '}
              (Position {stageToCancel.index + 1}) from this workflow?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStageToCancel(null)}
                className="rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                Keep Role
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = stageToCancel.index;
                  setStageToCancel(null);
                  handleConfirmRemoveStage(idx);
                }}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Role & Configure Stage Parameters Modal */}
      {renderAddRoleModal()}

      {/* Confirmation Dialogue Before Modifying an Individual Request */}
      {modifyConfirmRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center font-bold text-lg flex-shrink-0">
                ✏️
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Workflow Modification</h3>
                <p className="text-xs text-slate-500">Modify individual request workflow</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to modify the workflow for Request #{modifyConfirmRequest.id}
              {modifyConfirmRequest.title ? ` (${modifyConfirmRequest.title})` : ''}?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModifyConfirmRequest(null)}
                className="rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const req = modifyConfirmRequest;
                  setModifyConfirmRequest(null);
                  handleStartEdit(req);
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};