import React, { useState } from 'react';
import { User, UserRole } from '../services/types';
import { initialUsers, getRoleDisplayName } from '../services/api';
import { CompanyLogo } from '../components/CompanyLogo';
import { Icon } from '../components/Icons';

interface LoginViewProps {
  onLogin: (user: User) => void;
  onRegister: (newUser: User & { password?: string }) => void;
}

const allRoles: { role: UserRole; title: string; desc: string; icon: string }[] = [
  { role: 'REQUESTER', title: 'Requester', desc: 'Employee request submission', icon: '📝' },
  { role: 'MANAGER', title: 'Line Manager', desc: 'First-Line Verification & Branch Routing', icon: '👔' },
  { role: 'HR', title: 'HR Head', desc: 'HR, Recruitment & Staffing Approvals', icon: '🏢' },
  { role: 'IT', title: 'IT Head', desc: 'Software, Hardware & Infra Clearance', icon: '💻' },
  { role: 'FINANCE', title: 'Finance Head', desc: 'Budget & Expenditure Clearance', icon: '💰' },
  { role: 'ACCOUNTANT', title: 'Accountant', desc: 'Ledger Audit & Accounts Verification', icon: '📊' },
  { role: 'GENERAL_MANAGER', title: 'General Manager', desc: 'Operational clearance', icon: '🏢' },
  { role: 'CEO', title: 'CEO / Chairman', desc: 'Executive Sanction & Final Authority', icon: '👑' }
];

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister }) => {
  const [isSignUp] = useState(false);

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Sign Up State
  const [name, setName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [role, setRole] = useState<UserRole>('REQUESTER');
  const [dept, setDept] = useState('Computer Science and Engineering');
  const [company] = useState('Northstar Group');
  const [businessUnit, setBusinessUnit] = useState('Head Office');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    const found = initialUsers.find(
      u => u.email.toLowerCase() === loginEmail.trim().toLowerCase() && u.password === loginPassword
    );

    if (found) {
      const { password: _, ...userSafe } = found;
      onLogin(userSafe);
    } else {
      setError('Invalid email or password. Please check your credentials.');
    }
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    const existing = initialUsers.find(
      u => u.email.toLowerCase() === signupEmail.trim().toLowerCase()
    );

    if (existing) {
      setError('An account with this email already exists.');
      return;
    }

    const newUser = {
      name: name.trim(),
      email: signupEmail.trim(),
      password: signupPassword,
      role,
      dept: dept.trim() || 'General Department',
      company: company.trim() || 'Northstar Group',
      businessUnit: businessUnit.trim() || 'Head Office'
    };

    initialUsers.push(newUser);
    onRegister(newUser);

    onLogin({
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      dept: newUser.dept,
      company: newUser.company,
      businessUnit: newUser.businessUnit
    });
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-[#dde8f8] px-4 py-8">
      <div className="mb-5 flex flex-col items-center gap-2">
        <CompanyLogo size={46} />
        <div className="text-center">
          <p className="text-slate-900 text-xl font-bold tracking-tight">Northstar Workflow</p>
          <p className="text-xs text-blue-600 font-semibold mt-0.5">Multi-Tier Approval & Business SLA Engine</p>
        </div>
      </div>

      <div className={`w-full ${isSignUp ? 'max-w-xl' : 'max-w-md'} bg-white rounded-2xl shadow-xl p-7 border border-slate-100 transition-all`}>
        <p className="text-center text-slate-600 text-sm mb-5 font-semibold">
          {isSignUp ? 'Create an Account & Select Role' : 'Sign In with Your Credentials'}
        </p>

        {!isSignUp ? (
          /* Sign In Form */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => {
                  setLoginEmail(e.target.value);
                  setError('');
                }}
                required
                className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={e => {
                    setLoginPassword(e.target.value);
                    setError('');
                  }}
                  required
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <Icon name={showPassword ? 'eyeoff' : 'eye'} className="w-4 h-4" />
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 rounded-lg transition text-sm shadow-sm cursor-pointer mt-2"
            >
              Sign In
            </button>
          </form>
        ) : (
          /* Sign Up Form with 8-Role Selection Tabs */
          <form onSubmit={handleSignUpSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  required
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Dr. Rajesh Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={e => { setSignupEmail(e.target.value); setError(''); }}
                  required
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="name@organization.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={e => { setSignupPassword(e.target.value); setError(''); }}
                  required
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Create password"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Department</label>
                <input
                  type="text"
                  value={dept}
                  onChange={e => setDept(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Computer Science"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Business Unit</label>
                <input
                  type="text"
                  value={businessUnit}
                  onChange={e => setBusinessUnit(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Head Office / Operations"
                />
              </div>
            </div>

            {/* SELECTION TABS: 8 ROLES */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Select Your Enterprise System Role <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {allRoles.map(item => {
                  const isSelected = role === item.role;
                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => setRole(item.role)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/90 border-blue-600 text-blue-900 ring-2 ring-blue-400/40 shadow-xs font-semibold'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-base">{item.icon}</span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-tight">{item.title}</p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition text-sm shadow-sm cursor-pointer mt-2"
            >
              Create Account as {getRoleDisplayName(role)}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-500 mt-4">
          Accounts are created and removed by the CEO from CEO Management.
        </p>
      </div>
    </div>
  );
};
