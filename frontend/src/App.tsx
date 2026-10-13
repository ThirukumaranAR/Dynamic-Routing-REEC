import React, { useEffect, useState } from 'react';
import { User, ApprovalRequest, NavigationTab, RequestStatus, UserAccount, WorkflowBranch, canCreateRequests } from './services/types';
import { api, ApiError } from './services/apiClient';
import { LoginView } from './views/LoginView';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './views/DashboardView';
import { AllRequestsView } from './views/AllRequestsView';
import { CreateRequestView } from './views/CreateRequestView';
import { FlowCategoriesView } from './views/FlowCategoriesView';
import { QueriesView } from './views/QueriesView';
import { CompletionStatusView } from './views/CompletionStatusView';
import { ProfileView } from './views/ProfileView';
import { UserManagementView } from './views/UserManagementView';
import { FlaggedRequestsView } from './views/FlaggedRequestsView';
import { WorkflowManagementView } from './views/WorkflowManagementView';

type DashboardData = { metrics: { total: number; pending: number; approved: number; rejected: number; queries: number; escalated: number; policies: number } };
const isAdmin = (user: User) => user.role === 'CEO' || user.role === 'CHAIRMAN';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'ALL'>('ALL');
  const [managedUsers, setManagedUsers] = useState<UserAccount[]>([]);
  const [managedRoles, setManagedRoles] = useState<string[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appError, setAppError] = useState('');

  const updateRequest = (updated: ApprovalRequest) => {
    setRequests(previous => [updated, ...previous.filter(request => request.id !== updated.id)]);
    setSelectedRequest(previous => previous?.id === updated.id ? updated : previous);
  };

  const refreshDashboard = async () => {
    const data = await api.dashboard();
    setDashboardData(data);
  };

  const refreshAdminData = async (user: User) => {
    if (!isAdmin(user)) return;
    const management = await api.management();
    setManagedUsers(management.users);
    setManagedRoles(management.roles);
  };

  const loadAuthenticatedState = async (user: User) => {
    setRefreshing(true);
    setAppError('');
    try {
      const [freshRequests, metrics] = await Promise.all([api.listRequests(), api.dashboard()]);
      setRequests(freshRequests);
      setDashboardData(metrics);
      await refreshAdminData(user);
      setCurrentUser(user);
    } catch (error) {
      setCurrentUser(null);
      throw error;
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    api.me().then(async user => {
      if (mounted) await loadAuthenticatedState(user);
    }).catch(error => {
      if (mounted && !(error instanceof ApiError && error.status === 401)) {
        setAppError(error instanceof Error ? error.message : 'Unable to connect to FlowNexus API.');
      }
    }).finally(() => {
      if (mounted) setBooting(false);
    });
    return () => { mounted = false; };
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    await loadAuthenticatedState(user);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    try { await api.logout(); } finally {
      setCurrentUser(null);
      setRequests([]);
      setManagedUsers([]);
      setManagedRoles([]);
      setDashboardData(null);
      setSelectedRequest(null);
      setActiveTab('dashboard');
    }
  };

  const handleCreateRequest = async (data: Omit<ApprovalRequest, 'id' | 'date' | 'status' | 'businessHoursIdle' | 'auditTrail' | 'currentStage'>) => {
    const request = await api.createRequest(data);
    updateRequest(request);
    setActiveTab('all-requests');
    setSelectedRequest(request);
    await refreshDashboard();
    return request;
  };

  const handleRouteToBranch = async (id: string, branch: WorkflowBranch) => {
    updateRequest(await api.routeRequest(id, branch));
  };

  const handleApproveWorkflowStep = async (id: string, higherAuthorityOverride = false) => {
    updateRequest(await api.approveRequest(id, higherAuthorityOverride ? 'advance' : undefined));
    await refreshDashboard();
  };

  const handleUpdateStatus = async (id: string, status: RequestStatus, _action: string, extra?: Partial<ApprovalRequest> & { queryResponse?: string }) => {
    let updated: ApprovalRequest;
    if (status === 'REJECTED') updated = await api.rejectRequest(id, extra?.description);
    else if (status === 'QUERIED') updated = await api.raiseQuery(id, extra?.query || '');
    else if (status === 'APPROVED') updated = await api.approveRequest(id, 'direct');
    else if (status === 'ESCALATED') updated = await api.escalateRequest(id);
    else if (status === 'PENDING') {
      updated = await api.respondToQuery(id, extra?.queryResponse || '', {
        title: extra?.title,
        amount: extra?.amount,
        description: extra?.description
      });
    } else throw new Error('Unsupported request transition.');
    updateRequest(updated);
    await refreshDashboard();
  };

  const handleUpdateProfile = async (updated: User) => {
    const user = await api.updateProfile(updated);
    setCurrentUser(user);
  };

  const handleCreateManagedUser = async (user: UserAccount) => {
    await api.createUser(user);
    if (currentUser) await refreshAdminData(currentUser);
  };

  const handleUpdateManagedUser = async (user: UserAccount) => {
    await api.updateUser(user);
    if (currentUser) await refreshAdminData(currentUser);
  };

  const handleDeleteManagedUser = async (userId: string) => {
    await api.deactivateUser(userId);
    if (currentUser) await refreshAdminData(currentUser);
  };

  const handleReassignRequest = async (requestId: string, targetUserId: string) => {
    updateRequest(await api.reassignRequest(requestId, targetUserId));
  };

  const handleMigrateRequest = async (requestId: string, reason: string, replacementRole?: string, targetVersionId?: string) => {
    const updated = await api.migrateRequestWorkflow(requestId, reason, replacementRole, targetVersionId);
    updateRequest(updated);
    await refreshDashboard();
  };

  const handleFlag = async (id: string, flagged: boolean) => {
    updateRequest(await api.setFlag(id, flagged));
  };

  if (booting || refreshing && !currentUser) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Connecting securely to FlowNexus…</div>;
  }

  if (!currentUser) {
    return (
      <div className="min-h-full">
        {appError && <div role="alert" className="mx-auto mt-4 max-w-md border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{appError}</div>}
        <LoginView onLogin={handleLogin} />
      </div>
    );
  }

  const admin = isAdmin(currentUser);
  return (
    <div className="flex h-full bg-slate-50 font-sans">
      <Sidebar activeTab={activeTab} userRole={currentUser.role} onSelectTab={tab => { setActiveTab(tab); setSelectedRequest(null); }} />
      <div className="flex-1 flex min-w-0 flex-col overflow-hidden">
        <Header user={currentUser} onLogout={() => { void handleLogout(); }} />
        {appError && <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-800">{appError}</div>}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && <DashboardView user={currentUser} requests={requests} metrics={dashboardData?.metrics} onNavigate={(tab, filter) => { setActiveTab(tab); if (filter) setStatusFilter(filter); }} onSelectRequest={setSelectedRequest} />}
          {activeTab === 'all-requests' && <AllRequestsView user={currentUser} requests={requests} selectedRequest={selectedRequest} statusFilter={statusFilter} onSelectRequest={setSelectedRequest} onFilterChange={setStatusFilter} onUpdateStatus={handleUpdateStatus} onApproveStep={handleApproveWorkflowStep} onRouteToBranch={handleRouteToBranch} onMigrateWorkflow={handleMigrateRequest} />}
          {activeTab === 'create-request' && (canCreateRequests(currentUser.role) ? <CreateRequestView user={currentUser} onCreateRequest={handleCreateRequest} /> : <div className="p-8 text-center text-red-600 font-semibold bg-red-50 m-6 rounded-xl border border-red-200">Access Denied: Your role ({currentUser.role}) is not authorized to create new requests. Creation is reserved for Requester through Dean.</div>)}
          {activeTab === 'flow-categories' && admin && <FlowCategoriesView />}
          {activeTab === 'queries' && <QueriesView user={currentUser} requests={requests} onOpenRequest={request => { setSelectedRequest(request); setActiveTab('all-requests'); }} />}
          {activeTab === 'completion-status' && <CompletionStatusView user={currentUser} requests={requests} />}
          {activeTab === 'my-profile' && <ProfileView user={currentUser} onUpdateUser={handleUpdateProfile} />}
          {activeTab === 'user-management' && admin && <UserManagementView users={managedUsers} roles={managedRoles} currentUser={currentUser} requests={requests} onCreateUser={handleCreateManagedUser} onDeleteUser={handleDeleteManagedUser} onUpdateUser={handleUpdateManagedUser} onReassignRequest={handleReassignRequest} />}
          {activeTab === 'workflow-management' && admin && <WorkflowManagementView user={currentUser} requests={requests} users={managedUsers} onUpdateRequest={updateRequest} />}
          {activeTab === 'flagged-requests' && admin && <FlaggedRequestsView requests={requests} onOpenRequest={request => { setSelectedRequest(request); setActiveTab('all-requests'); }} onSetFlag={handleFlag} />}
        </main>
      </div>
    </div>
  );
};

export default App;