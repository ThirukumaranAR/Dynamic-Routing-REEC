import React, { useState } from 'react';
import { User, UserAccount, ApprovalRequest, STANDARD_ROLES } from '../services/types';
import { getRoleDisplayName } from '../services/api';

interface UserManagementViewProps {
  users: UserAccount[];
  roles: string[];
  currentUser?: User;
  requests?: ApprovalRequest[];
  onCreateUser: (user: UserAccount) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onUpdateUser?: (user: UserAccount) => Promise<void>;
  onReassignRequest?: (requestId: string, targetUserId: string) => Promise<void>;
}

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

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUser,
  onCreateUser,
  onDeleteUser,
  onUpdateUser
}) => {
  const isChairman = currentUser?.role === 'CHAIRMAN';
  // Chairman manages all supported roles except Chairman (includes CEO). CEO manages all roles except CEO and Chairman.
  const assignableRoles = isChairman
    ? STANDARD_ROLES.filter(r => r.name !== 'CHAIRMAN').map(r => r.name)
    : STANDARD_ROLES.filter(r => r.name !== 'CEO' && r.name !== 'CHAIRMAN').map(r => r.name);

  // Main form selections
  const [selectedRole, setSelectedRole] = useState<string>('REQUESTER');
  const [selectedDepartment, setSelectedDepartment] = useState<string>(commonDepartments[0]);

  // Modals & Panels
  const [showAddSingleModal, setShowAddSingleModal] = useState<boolean>(false);
  const [showUserManager, setShowUserManager] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Single User Form State
  const [singleName, setSingleName] = useState<string>('');
  const [singleEmployeeId, setSingleEmployeeId] = useState<string>('');
  const [singleEmail, setSingleEmail] = useState<string>('');
  const [singlePhone, setSinglePhone] = useState<string>('');
  const [singleDepartment, setSingleDepartment] = useState<string>(commonDepartments[0]);
  const [singlePassword, setSinglePassword] = useState<string>('');
  const [bulkPassword, setBulkPassword] = useState<string>('');

  // Edit User Form State
  const [editName, setEditName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('REQUESTER');
  const [editDept, setEditDept] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editEmployeeId, setEditEmployeeId] = useState<string>('');

  // Search & Filter in Existing Users Manager
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Toast / Feedback Messages
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Download Sample Excel/CSV Template
  const handleDownloadTemplate = () => {
    const csvContent = 'name,employeeID,email,phone,department\n' +
      'Dr. Rajesh Sharma,EMP-1041,rajesh.sharma@srmist.edu.in,9876543210,Computer Science and Engineering\n' +
      'Prof. Anitha Krishnan,EMP-1042,anitha.k@srmist.edu.in,9876543211,Information Technology\n' +
      'Karthik Raman,EMP-1043,karthik.r@srmist.edu.in,9876543212,Finance and Accounts';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `user_creation_template_${selectedRole || 'REQUESTER'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Excel/CSV template downloaded successfully.');
  };

  // Handle Excel/CSV File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedRole === 'CHAIRMAN' || (!isChairman && selectedRole === 'CEO')) {
      showToast('error', isChairman ? 'Chairman accounts cannot be created here.' : 'CEO and Chairman accounts cannot be created from ordinary User Management.');
      if (e.target) e.target.value = '';
      return;
    }

    if (bulkPassword.length < 12) {
      showToast('error', 'Enter a bulk account password of at least 12 characters.');
      if (e.target) e.target.value = '';
      return;
    }

    if (!selectedDepartment) {
      showToast('error', 'Please select a department above before uploading.');
      if (e.target) e.target.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        if (lines.length <= 1) {
          showToast('error', 'The uploaded file is empty or has no data rows.');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const nameIdx = headers.indexOf('name');
        const empIdx = headers.indexOf('employeeid') !== -1 ? headers.indexOf('employeeid') : headers.indexOf('empid');
        const emailIdx = headers.indexOf('email');
        const phoneIdx = headers.indexOf('phone');
        const deptIdx = headers.indexOf('department') !== -1 ? headers.indexOf('department') : headers.indexOf('dept');

        let createdCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          const name = nameIdx !== -1 ? cols[nameIdx] : cols[0];
          const empId = empIdx !== -1 ? cols[empIdx] : '';
          const email = emailIdx !== -1 ? cols[emailIdx] : (name ? `${name.toLowerCase().replace(/\s+/g, '.')}@srmist.edu.in` : '');
          const phone = phoneIdx !== -1 ? cols[phoneIdx] : '';
          const department = deptIdx !== -1 ? cols[deptIdx] : cols[cols.length - 1];

          // Rows without a department are skipped according to specification
          if (!department || department.trim() === '' || !name || !email) {
            continue;
          }

          const newUser: UserAccount = {
            id: `usr-${Date.now()}-${i}`,
            name: name.trim(),
            employeeId: empId,
            email: email.trim(),
            phone: phone,
            password: bulkPassword,
            role: selectedRole,
            dept: department.trim(),
            company: 'Northstar Group',
            businessUnit: 'Head Office'
          };

          await onCreateUser(newUser);
          createdCount++;
        }

        if (createdCount > 0) {
          showToast('success', `Successfully created ${createdCount} user account(s) in ${selectedDepartment}!`);
          setShowUserManager(true);
        } else {
          showToast('error', 'No valid rows found. Note: rows without a department are skipped.');
        }
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to import accounts. Verify the file and remove duplicates.');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // Handle Single User Creation
  const handleSingleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === 'CHAIRMAN' || (!isChairman && selectedRole === 'CEO')) {
      showToast('error', isChairman ? 'Chairman accounts cannot be created here.' : 'CEO and Chairman accounts cannot be created from ordinary User Management.');
      return;
    }
    if (!singleName.trim() || !singleEmail.trim() || !singleDepartment.trim() || singlePassword.length < 12) {
      showToast('error', 'Please enter Name, Email, Department, and a password of at least 12 characters.');
      return;
    }

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      name: singleName.trim(),
      employeeId: singleEmployeeId.trim(),
      email: singleEmail.trim().toLowerCase(),
      phone: singlePhone.trim(),
      password: singlePassword,
      role: selectedRole,
      dept: singleDepartment.trim(),
      company: 'Northstar Group',
      businessUnit: 'Head Office'
    };

    try {
      await onCreateUser(newUser);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Account creation failed.');
      return;
    }
    setShowAddSingleModal(false);
    setSingleName('');
    setSingleEmployeeId('');
    setSingleEmail('');
    setSinglePhone('');
    setSingleDepartment('');
    setSinglePassword('');
    showToast('success', `User account created successfully for ${newUser.name}!`);
    setShowUserManager(true);
  };

  // Open Edit User Modal
  const handleOpenEdit = (u: UserAccount) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditDept(u.dept);
    setEditPhone(u.phone || '');
    setEditEmployeeId(u.employeeId || u.id || '');
  };

  // Save Edited User
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (editRole === 'CHAIRMAN' || (!isChairman && editRole === 'CEO')) {
      showToast('error', isChairman ? 'Chairman role cannot be assigned.' : 'CEO and Chairman roles are managed only through Chairman-authorized account controls.');
      return;
    }

    const updated: UserAccount = {
      ...editingUser,
      name: editName.trim(),
      email: editEmail.trim(),
      role: editRole,
      dept: editDept.trim(),
      phone: editPhone.trim(),
      employeeId: editEmployeeId.trim(),
      company: 'Northstar Group',
      businessUnit: 'Head Office'
    };

    try {
      if (onUpdateUser) await onUpdateUser(updated);
      else {
        await onDeleteUser(editingUser.id || editingUser.email);
        await onCreateUser(updated);
      }
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Account update failed.');
      return;
    }

    setEditingUser(null);
    showToast('success', `Account details for ${updated.name} updated successfully!`);
  };

  // Filtered list of users: Chairman sees all except CHAIRMAN; CEO sees all except CEO and CHAIRMAN.
  const visibleUsers = users.filter(u => {
    if (isChairman) return u.role !== 'CHAIRMAN';
    return u.role !== 'CEO' && u.role !== 'CHAIRMAN';
  });

  const filteredUsers = visibleUsers.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.dept.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.company && u.company.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-7">
      {/* Toast Notification */}
      {feedbackMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2.5 animate-in slide-in-from-top-3 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <span className="text-emerald-600 font-bold">✓</span>
          ) : (
            <span className="text-red-600 font-bold">⚠️</span>
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          User Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Create and manage user accounts.
        </p>
      </div>

      {/* CARD 1: Create users (MATCHING SCREENSHOT PERFECTLY) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">
            Create users
          </h2>
          <button
            type="button"
            onClick={() => setShowAddSingleModal(true)}
            className="border border-blue-200 text-blue-600 bg-blue-50/60 hover:bg-blue-100 text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
          >
            + Add single
          </button>
        </div>

        {/* Role & Institution Dropdowns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Role
            </label>
            <div className="relative">
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-9 cursor-pointer"
              >
                {assignableRoles.map(role => (
                  <option key={role} value={role}>{getRoleDisplayName(role)}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Department
            </label>
            <div className="relative">
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-9 cursor-pointer"
              >
                <option value="">Select department</option>
                {commonDepartments.map(department => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk create via Excel Box (MATCHING SCREENSHOT) */}
        <div className="border border-dashed border-slate-300 rounded-xl p-5 bg-slate-50/40">
          <h3 className="text-sm font-bold text-slate-800 mb-1.5">
            Bulk create via Excel
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Columns:{' '}
            <span className="bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[11px]">name</span>,{' '}
            <span className="bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[11px]">employeeID</span>,{' '}
            <span className="bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[11px]">email</span>,{' '}
            <span className="bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[11px]">phone</span>,{' '}
            <span className="bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[11px]">department</span>. Rows without a department are skipped. A strong password you set below is applied to imported accounts.
          </p>

          <label className="mt-4 block max-w-md text-xs font-semibold text-slate-700">
            Password for imported accounts (12+ characters)
            <input type="password" autoComplete="new-password" minLength={12} value={bulkPassword} onChange={event => setBulkPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>

          {/* Yellow/Amber Warning Bar */}
          {!selectedDepartment ? (
            <div className="bg-[#fffbeb] border border-[#fef3c7] text-[#92400e] text-xs px-4 py-2.5 rounded-lg my-4 flex items-center gap-2">
              <span>Select a department above before uploading.</span>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-lg my-4 flex items-center justify-between">
              <span>Target Department: <strong>{selectedDepartment}</strong></span>
              <span className="text-[11px] bg-emerald-100 text-emerald-900 font-semibold px-2 py-0.5 rounded">Ready</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <label className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer shadow-2xs inline-flex items-center gap-2 transition">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Choose .xlsx file
            </label>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-blue-600 hover:text-blue-700 text-xs font-semibold cursor-pointer underline-offset-2 hover:underline inline-flex items-center gap-1"
            >
              Download template
            </button>
          </div>
        </div>
      </div>

      {/* CARD 2: Existing users (MATCHING SCREENSHOT PERFECTLY) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-slate-900">
            Existing users
          </h2>
          <button
            type="button"
            onClick={() => setShowUserManager(!showUserManager)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
          >
            {showUserManager ? 'Hide user list' : 'View / edit / delete users'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Open the manager to browse every user you can manage, edit their details, or remove them.
        </p>

        {/* EXPANDED USER MANAGER TABLE & SEARCH */}
        {showUserManager && (
          <div className="mt-6 pt-5 border-t border-slate-100 animate-in fade-in duration-200">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, department..."
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-400 whitespace-nowrap">Filter Role:</span>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">All Roles</option>
                  {assignableRoles.map(role => (
                    <option key={role} value={role}>{getRoleDisplayName(role)}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-md font-semibold">
                  {filteredUsers.length} Users
                </span>
              </div>
            </div>

            {/* User List Table */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">User & Credentials</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredUsers.map((u) => (
                    <tr key={u.id || u.email} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-xs flex-shrink-0 border border-blue-100">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{u.name}</p>
                            <p className="text-slate-400 text-[11px]">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'CEO'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'FINANCE' || u.role === 'ACCOUNTANT'
                            ? 'bg-yellow-100 text-yellow-800'
                            : u.role === 'MANAGER'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {getRoleDisplayName(u.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {u.dept}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {u.role !== 'CHAIRMAN' && (isChairman || u.role !== 'CEO') && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(u)}
                              className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                          {u.role !== 'CHAIRMAN' && (isChairman || u.role !== 'CEO') && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to remove ${u.name} (${u.email})?`)) {
                                    try {
                                      await onDeleteUser(u.id || u.email);
                                      showToast('success', `User ${u.name} deactivated successfully.`);
                                    } catch (error) {
                                      showToast('error', error instanceof Error ? error.message : 'Account deactivation failed.');
                                    }
                                }
                              }}
                              className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        No users match the search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD SINGLE USER */}
      {showAddSingleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">+ Add Single User Account</h3>
                <p className="text-[10px] text-slate-400">Directly provision credentials for an institutional official</p>
              </div>
              <button
                onClick={() => setShowAddSingleModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSingleUserSubmit} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={singleName}
                    onChange={e => setSingleName(e.target.value)}
                    required
                    placeholder="e.g. Dr. Rajesh Sharma"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={singleEmployeeId}
                    onChange={e => setSingleEmployeeId(e.target.value)}
                    placeholder="e.g. EMP-1044"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={singleEmail}
                    onChange={e => setSingleEmail(e.target.value)}
                    required
                    placeholder="official@srmist.edu.in"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={singlePhone}
                    onChange={e => setSinglePhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Role *</label>
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {assignableRoles.map(role => (
                      <option key={role} value={role}>{getRoleDisplayName(role)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Department *</label>
                  <input
                    type="text"
                    value={singleDepartment}
                    onChange={e => setSingleDepartment(e.target.value)}
                    required
                    placeholder="e.g. Computer Science"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Department</label>
                  <select
                    value={singleDepartment}
                    onChange={e => setSingleDepartment(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select department</option>
                    {commonDepartments.map(department => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Password (12+ characters)</label>
                  <input
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    value={singlePassword}
                    onChange={e => setSinglePassword(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSingleModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER DETAILS */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Edit User Details</h3>
                <p className="text-[10px] text-slate-400">Updating credentials and role permissions for {editingUser.name}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Role *</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {assignableRoles.map(role => (
                      <option key={role} value={role}>{getRoleDisplayName(role)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Department *</label>
                  <input
                    type="text"
                    value={editDept}
                    onChange={e => setEditDept(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
