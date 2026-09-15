import React, { useState, useEffect } from 'react';
import {
  User,
  ApprovalRequest,
  NavigationTab,
  RequestStatus,
  ApprovalStage
} from './services/types';
import { initialRequests, initialUsers } from './services/api';
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
import { UserAccount } from './services/types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [requests, setRequests] = useState<ApprovalRequest[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'ALL'>('ALL');
  const [managedUsers, setManagedUsers] = useState<UserAccount[]>(initialUsers);
  const [managedRoles, setManagedRoles] = useState<string[]>(Array.from(new Set(initialUsers.map(user => user.role))));

  // Load persisted user list & session from localStorage on startup
  useEffect(() => {
    try {
      const savedUsers = localStorage.getItem('smart_approval_all_users_v2');
      if (savedUsers) {
        const parsed = JSON.parse(savedUsers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialUsers.length = 0;
          parsed.forEach((u: any) => initialUsers.push(u));
          setManagedUsers(parsed);
        }
      }

      const savedRoles = localStorage.getItem('smart_approval_roles_v1');
      if (savedRoles) setManagedRoles(JSON.parse(savedRoles));

      const savedRequests = localStorage.getItem('smart_approval_requests_v2');
      if (savedRequests) {
        const parsedReqs = JSON.parse(savedRequests);
        if (Array.isArray(parsedReqs) && parsedReqs.length > 0) {
          setRequests(parsedReqs);
        }
      }
    } catch (e) {
      console.error('Failed to load local storage:', e);
    }
  }, []);

  const persistUsers = (users: UserAccount[]) => {
    setManagedUsers(users);
    initialUsers.length = 0;
    users.forEach(user => initialUsers.push(user as UserAccount & { password: string }));
    localStorage.setItem('smart_approval_all_users_v2', JSON.stringify(users));
  };

  const handleCreateManagedUser = (user: UserAccount) => {
    persistUsers([...managedUsers, { ...user, id: `usr-${Date.now()}` }]);
    if (!managedRoles.includes(user.role)) {
      const nextRoles = [...managedRoles, user.role];
      setManagedRoles(nextRoles);
      localStorage.setItem('smart_approval_roles_v1', JSON.stringify(nextRoles));
    }
  };

  const handleDeleteManagedUser = (userId: string) => {
    persistUsers(managedUsers.filter(user => user.id !== userId));
  };

  const handleCreateRole = (roleName: string) => {
    const role = roleName.trim().toUpperCase();
    if (!role || managedRoles.includes(role)) return;
    const nextRoles = [...managedRoles, role];
    setManagedRoles(nextRoles);
    localStorage.setItem('smart_approval_roles_v1', JSON.stringify(nextRoles));
  };

  const handleDeleteRole = (role: string, replacementRole: string) => {
    if (!replacementRole || role === 'CEO') return;
    persistUsers(managedUsers.map(user => user.role === role ? { ...user, role: replacementRole } : user));
    setManagedRoles(managedRoles.filter(existingRole => existingRole !== role));
    localStorage.setItem('smart_approval_roles_v1', JSON.stringify(managedRoles.filter(existingRole => existingRole !== role)));
    setRequests(prev => {
      const updated = prev.map(request => request.assignedRole === role || request.currentStage === role
        ? { ...request, assignedRole: replacementRole, currentStage: request.currentStage === role ? replacementRole : request.currentStage, auditTrail: [...request.auditTrail, { ts: formatTimestamp(), actor: 'CEO', action: `Role ${role} removed; responsibility transferred to ${replacementRole}` }] }
        : request);
      localStorage.setItem('smart_approval_requests_v2', JSON.stringify(updated));
      return updated;
    });
  };

  const handleReassignEscalatedRequest = (requestId: string, targetUserId: string) => {
    const target = managedUsers.find(user => user.id === targetUserId);
    if (!target || currentUser?.role !== 'CEO') return;
    setRequests(prev => {
      const updated = prev.map(request => request.id === requestId && request.status === 'ESCALATED'
        ? { ...request, status: 'PENDING' as RequestStatus, currentStage: target.role, assignedUserId: target.id, assignedRole: target.role, businessHoursIdle: 0, auditTrail: [...request.auditTrail, { ts: formatTimestamp(), actor: `${currentUser.name} (CEO)`, action: `Escalated request routed to ${target.name} (${target.role})` }] }
        : request);
      localStorage.setItem('smart_approval_requests_v2', JSON.stringify(updated));
      return updated;
    });
  };

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

  // Permanent User Profile Update
  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);

    const idx = initialUsers.findIndex(
      u => u.email.toLowerCase() === updatedUser.email.toLowerCase()
    );
    if (idx !== -1) {
      initialUsers[idx] = {
        ...initialUsers[idx],
        name: updatedUser.name,
        dept: updatedUser.dept,
        company: updatedUser.company,
        businessUnit: updatedUser.businessUnit,
        role: updatedUser.role
      };
    }

    try {
      localStorage.setItem('smart_approval_all_users_v2', JSON.stringify(initialUsers));
    } catch (e) {
      console.error('Failed to save user to localStorage:', e);
    }
  };

  // Advance Stage in the Multi-Tier Chain
  const handleAdvanceStage = (
    requestId: string,
    nextStage: ApprovalStage,
    actionDesc: string
  ) => {
    if (!currentUser) return;

    setRequests(prev => {
      const updated = prev.map(r => {
        if (r.id === requestId) {
          return {
            ...r,
            currentStage: nextStage,
            status: 'PENDING' as RequestStatus,
            businessHoursIdle: 0,
            auditTrail: [
              ...r.auditTrail,
              {
                ts: formatTimestamp(),
                actor: `${currentUser.name} (${currentUser.role})`,
                action: actionDesc
              }
            ]
          };
        }
        return r;
      });

      try {
        localStorage.setItem('smart_approval_requests_v2', JSON.stringify(updated));
      } catch (e) {}

      return updated;
    });

    if (selectedRequest?.id === requestId) {
      setSelectedRequest(prev =>
        prev
          ? {
              ...prev,
              currentStage: nextStage,
              status: 'PENDING',
              businessHoursIdle: 0,
              auditTrail: [
                ...prev.auditTrail,
                {
                  ts: formatTimestamp(),
                  actor: `${currentUser.name} (${currentUser.role})`,
                  action: actionDesc
                }
              ]
            }
          : null
      );
    }
  };

  // Update Status & Audit Trail
  const handleUpdateStatus = (
    requestId: string,
    newStatus: RequestStatus,
    actionDesc: string,
    extra?: Partial<ApprovalRequest>
  ) => {
    if (!currentUser) return;

    setRequests(prev => {
      const updated = prev.map(r => {
        if (r.id === requestId) {
          return {
            ...r,
            ...extra,
            status: newStatus,
            businessHoursIdle: 0,
            auditTrail: [
              ...r.auditTrail,
              {
                ts: formatTimestamp(),
                actor: `${currentUser.name} (${currentUser.role})`,
                action: actionDesc
              }
            ]
          };
        }
        return r;
      });

      try {
        localStorage.setItem('smart_approval_requests_v2', JSON.stringify(updated));
      } catch (e) {}

      return updated;
    });

    if (selectedRequest?.id === requestId) {
      setSelectedRequest(prev =>
        prev
          ? {
              ...prev,
              ...extra,
              status: newStatus,
              businessHoursIdle: 0,
              auditTrail: [
                ...prev.auditTrail,
                {
                  ts: formatTimestamp(),
                  actor: `${currentUser.name} (${currentUser.role})`,
                  action: actionDesc
                }
              ]
            }
          : null
      );
    }
  };

  // Create New Request
  const handleCreateRequest = (
    newReqData: Omit<ApprovalRequest, 'id' | 'date' | 'status' | 'businessHoursIdle' | 'auditTrail' | 'currentStage'>
  ) => {
    if (!currentUser) return;

    const newId = `REQ-00${requests.length + 1}`;
    const nowTs = formatTimestamp();

    const newReq: ApprovalRequest = {
      ...newReqData,
      id: newId,
      date: formatDate(),
      status: 'PENDING',
      currentStage: 'MANAGER', // Initial stage is Line Manager review
      businessHoursIdle: 0,
      auditTrail: [
        {
          ts: nowTs,
          actor: currentUser.name,
          action: `Request submitted to Approval Queue with ${newReqData.attachments?.length || 0} attachment(s)`
        },
        { ts: nowTs, actor: 'System', action: 'Assigned to Line Manager for initial review & routing' }
      ]
    };

    setRequests(prev => {
      const updated = [newReq, ...prev];
      try {
        localStorage.setItem('smart_approval_requests_v2', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    setTimeout(() => {
      setActiveTab('all-requests');
      setSelectedRequest(newReq);
    }, 1500);
  };

  if (!currentUser) {
    return (
      <LoginView
        onLogin={user => {
          const latest = initialUsers.find(
            u => u.email.toLowerCase() === user.email.toLowerCase()
          );
          if (latest) {
            const { password: _, ...userSafe } = latest;
            setCurrentUser(userSafe);
          } else {
            setCurrentUser(user);
          }
          setActiveTab('dashboard');
        }}
        onRegister={() => {
          try {
            localStorage.setItem('smart_approval_all_users_v2', JSON.stringify(initialUsers));
          } catch (e) {}
        }}
      />
    );
  }

  return (
    <div className="flex h-full bg-slate-50 font-sans">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        userRole={currentUser.role}
        onSelectTab={tab => {
          setActiveTab(tab);
          setSelectedRequest(null);
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <Header
          user={currentUser}
          onLogout={() => {
            setCurrentUser(null);
            setSelectedRequest(null);
          }}
        />

        {/* Dynamic Views */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              user={currentUser}
              requests={requests}
              onNavigate={(tab, filter) => {
                setActiveTab(tab);
                if (filter) setStatusFilter(filter);
              }}
              onSelectRequest={req => {
                setSelectedRequest(req);
              }}
            />
          )}

          {activeTab === 'all-requests' && (
            <AllRequestsView
              user={currentUser}
              requests={requests}
              selectedRequest={selectedRequest}
              statusFilter={statusFilter}
              onSelectRequest={setSelectedRequest}
              onFilterChange={setStatusFilter}
              onUpdateStatus={handleUpdateStatus}
              onAdvanceStage={handleAdvanceStage}
            />
          )}

          {activeTab === 'create-request' && currentUser.role === 'REQUESTER' && (
            <CreateRequestView
              user={currentUser}
              onCreateRequest={handleCreateRequest}
            />
          )}

          {activeTab === 'flow-categories' && (
            <FlowCategoriesView />
          )}

          {activeTab === 'queries' && (
            <QueriesView
              user={currentUser}
              requests={requests}
              onOpenRequest={req => {
                setSelectedRequest(req);
                setActiveTab('all-requests');
              }}
            />
          )}

          {activeTab === 'completion-status' && (
            <CompletionStatusView user={currentUser} requests={requests} />
          )}

          {activeTab === 'my-profile' && (
            <ProfileView
              user={currentUser}
              onUpdateUser={handleUpdateUser}
            />
          )}

          {activeTab === 'user-management' && currentUser.role === 'CEO' && (
            <UserManagementView
              users={managedUsers}
              roles={managedRoles}
              requests={requests}
              onCreateUser={handleCreateManagedUser}
              onDeleteUser={handleDeleteManagedUser}
              onCreateRole={handleCreateRole}
              onDeleteRole={handleDeleteRole}
              onReassignRequest={handleReassignEscalatedRequest}
            />
          )}
          {activeTab === 'flagged-requests' && currentUser.role === 'CEO' && (
            <FlaggedRequestsView
              requests={requests}
              onOpenRequest={request => { setSelectedRequest(request); setActiveTab('all-requests'); }}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
