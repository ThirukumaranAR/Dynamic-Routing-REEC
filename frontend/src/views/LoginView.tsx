import React, { useState } from 'react';
import { CompanyLogo } from '../components/CompanyLogo';
import { Icon } from '../components/Icons';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onLogin(loginEmail.trim(), loginPassword);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-[#dde8f8] px-4 py-8">
      <div className="mb-6 flex flex-col items-center text-center gap-2">
        <CompanyLogo size={52} />
        <div className="text-center">
          <p className="text-slate-900 text-2xl font-bold tracking-tight">FlowNexus</p>
          <p className="text-xs text-blue-600 font-semibold mt-1 text-center">
            Multi-Tier Institutional Approval &amp; Governance Platform
          </p>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-6">
          <h2 className="text-slate-800 text-base font-bold">Sign In with Your Credentials</h2>
          <p className="text-xs text-slate-400 mt-1">
            Enter your registered email and password to access dashboard
          </p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 text-left">
              Email Address
            </label>
            <input
              type="email"
              value={loginEmail}
              autoComplete="username"
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
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 text-left">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={loginPassword}
                autoComplete="current-password"
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
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eyeoff' : 'eye'} className="w-4 h-4" />
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-xs font-medium text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 rounded-lg transition text-sm shadow-sm cursor-pointer mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};