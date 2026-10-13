import {
  ApprovalRequest,
  ApprovalWorkflow,
  GeneralWorkflowConfig,
  NavigationTab,
  RequestCategory,
  RequestStatus,
  User,
  UserAccount
} from './types';

export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retries = 2): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  } catch {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 600));
      return request<T>(path, options, retries - 1);
    }
    throw new ApiError(0, 'Cannot reach FlowNexus API. Check that the backend is running.');
  }

  if (response.status === 503 && retries > 0) {
    await new Promise(r => setTimeout(r, 600));
    return request<T>(path, options, retries - 1);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || payload.errors?.join?.(' ') || `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

const body = (value: unknown): string => JSON.stringify(value);
const unwrapRequest = (payload: { request: ApprovalRequest }) => payload.request;

export const api = {
  login: async (email: string, password: string) => request<{ user: User }>('/auth/login', { method: 'POST', body: body({ email, password }) }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST', body: '{}' }),
  me: async () => (await request<{ user: User }>('/auth/me')).user,
  updateProfile: async (user: Partial<User>) => (await request<{ user: User }>('/auth/profile', { method: 'PUT', body: body(user) })).user,
  listRequests: async (status?: RequestStatus | 'ALL', category?: RequestCategory | 'ALL') => {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.set('status', status);
    if (category && category !== 'ALL') params.set('category', category);
    const suffix = params.size ? `?${params.toString()}` : '';
    return (await request<{ requests: ApprovalRequest[] }>(`/requests${suffix}`)).requests;
  },
  getRequest: async (id: string) => (await request<{ request: ApprovalRequest }>(`/requests/${encodeURIComponent(id)}`)).request,
  createRequest: async (input: Partial<ApprovalRequest>) => unwrapRequest(await request<{ request: ApprovalRequest }>('/requests', { method: 'POST', body: body(input) })),
  routeRequest: async (id: string, branch: string) => unwrapRequest(await request<{ request: ApprovalRequest }>(`/requests/${encodeURIComponent(id)}/route`, { method: 'POST', body: body({ branch }) })),
  approveRequest: async (id: string, override?: 'advance' | 'direct') => unwrapRequest(await request<{ request: ApprovalRequest }>(`/requests/${encodeURIComponent(id)}/approve`, { method: 'POST', body: body({ override }) })),
  rejectRequest: async (id: string, reason?: string) => unwrapRequest(await request<{ request: ApprovalRequest }>(`/requests/${encodeURIComponent(id)}/reject`, { method: 'POST', body: body({ reason }) })),
  raiseQuery: async (id: string, query: string) => unwrapRequest(await request<{ request: ApprovalRequest }>(`/requests/${encodeURIComponent(id)}/query`, { method: 'POST', body: body({ query }) })),
  respondToQuery: async (id: string, response: string, revised?: Partial<ApprovalRequest>) => unwrapRequest(await request<{ request: ApprovalRequest }>(`/requests/${encodeURIComponent(id)}/respond`, { method: 'POST', body: body({ response, ...revised }) })),
  escalateRequest: async (id: string) => unwrapRequest(await request<{ request: ApprovalRequest }>(`/requests/${encodeURIComponent(id)}/escalate`, { method: 'POST', body: '{}' })),
  reassignRequest: async (id: string, targetUserId: string) => unwrapRequest(await request<{ request: ApprovalRequest }>(`/requests/${encodeURIComponent(id)}/reassign`, { method: 'POST', body: body({ targetUserId }) })),
  setFlag: async (id: string, flagged: boolean) => unwrapRequest(await request<{ request: ApprovalRequest }>(`/requests/${encodeURIComponent(id)}/flag`, { method: flagged ? 'POST' : 'DELETE', body: body({ flagged }) })),
  dashboard: () => request<any>('/analytics/dashboard'),
  categories: () => request<any>('/analytics/categories'),
  sops: () => request<any>('/analytics/sops'),
  management: () => request<{ roles: string[]; users: UserAccount[] }>('/admin'),
  createUser: async (user: UserAccount) => (await request<{ user: UserAccount }>('/admin/users', { method: 'POST', body: body(user) })).user,
  updateUser: async (user: UserAccount) => (await request<{ user: UserAccount }>(`/admin/users/${encodeURIComponent(user.id || '')}`, { method: 'PUT', body: body(user) })).user,
  deactivateUser: (id: string) => request(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createRole: (role: string) => request('/admin/roles', { method: 'POST', body: body({ role }) }),
  deleteRole: (role: string, replacementRole: string) => request(`/admin/roles/${encodeURIComponent(role)}`, { method: 'DELETE', body: body({ replacementRole }) }),
  workflows: async () => (await request<{ workflows: ApprovalWorkflow[] }>('/admin/workflows')).workflows,
  saveWorkflow: async (workflow: any) => (await request<{ workflow: any }>('/admin/workflows', { method: 'POST', body: body(workflow) })).workflow,
  getGeneralWorkflow: async () => (await request<{ success: boolean; generalWorkflow: GeneralWorkflowConfig }>('/admin/general-workflow')).generalWorkflow,
  activateGeneralWorkflow: async (payload: any) => (await request<{ success: boolean; generalWorkflow: GeneralWorkflowConfig }>('/admin/general-workflow/activate', { method: 'POST', body: body(payload) })).generalWorkflow,
  validateGeneralWorkflow: async (payload: any) => request<{ success: boolean; valid: boolean; errors: string[] }>('/admin/general-workflow/validate', { method: 'POST', body: body(payload) }),
  migrateRequestWorkflow: async (
    requestId: string,
    reasonOrPayload: string | {
      reason?: string;
      targetWorkflowVersion?: number;
      replacementRole?: string;
      oldStage?: string;
      newStage?: string;
      stages?: any[];
      selectedBranch?: string;
      targetWorkflowVersionId?: string;
    },
    replacementRole?: string,
    targetWorkflowVersionId?: string
  ) => {
    const payload = typeof reasonOrPayload === 'string'
      ? { reason: reasonOrPayload, replacementRole, targetWorkflowVersionId }
      : reasonOrPayload;
    return unwrapRequest(await request<{ request: ApprovalRequest }>(`/admin/requests/${encodeURIComponent(requestId)}/migrate`, { method: 'POST', body: body(payload) }));
  },
  customizeRequestWorkflow: async (
    requestId: string,
    payload: {
      reason?: string;
      expectedUpdatedAt?: string;
      selectedBranch?: string;
      stages: Array<{
        id?: string;
        stageKey?: string;
        role: string;
        label?: string;
        stageOrder?: number;
        isApplicable?: boolean;
      }>;
    }
  ) => unwrapRequest(
    await request<{ request: ApprovalRequest }>(
      `/admin/requests/${encodeURIComponent(requestId)}/custom-workflow`,
      { method: 'PUT', body: body(payload) }
    )
  ),
  validateCustomRequestWorkflow: async (
    requestId: string,
    payload: {
      stages: Array<{
        id?: string;
        stageKey?: string;
        role: string;
        label?: string;
        stageOrder?: number;
        isApplicable?: boolean;
      }>;
      selectedBranch?: string;
    }
  ) => request<{ success: boolean; valid: boolean; errors: string[] }>(
    `/admin/requests/${encodeURIComponent(requestId)}/validate-workflow`,
    { method: 'POST', body: body(payload) }
  ),
  audit: (targetId?: string) => request(`/admin/audit${targetId ? `?targetId=${encodeURIComponent(targetId)}` : ''}`),
  ceos: async () => (await request<{ users: UserAccount[] }>('/admin/ceos')).users,
  createCeo: async (user: UserAccount) => (await request<{ user: UserAccount }>('/admin/ceos', { method: 'POST', body: body(user) })).user,
  updateCeo: async (user: UserAccount) => (await request<{ user: UserAccount }>(`/admin/ceos/${encodeURIComponent(user.id || '')}`, { method: 'PUT', body: body(user) })).user,
  setCeoActive: (id: string, active: boolean) => request(`/admin/ceos/${encodeURIComponent(id)}/active`, { method: 'PATCH', body: body({ active }) }),
  demoUsers: async () => (await request<{ users: User[] }>('/auth/demo-users')).users
};

export type AppNavigation = NavigationTab;