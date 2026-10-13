import React from 'react';
import { CompanyLogo } from '../components/CompanyLogo';

interface WelcomeViewProps {
  onContinue: () => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onContinue }) => (
  <main className="min-h-full relative overflow-hidden bg-slate-950 text-white">
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=2200&q=85')" }}
    />
    <div className="absolute inset-0 bg-slate-950/65" />
    <div className="relative z-10 min-h-full flex flex-col justify-between px-6 py-7 sm:px-12 sm:py-10">
      <div className="flex items-center gap-3">
        <CompanyLogo size={42} />
        <span className="text-sm font-semibold tracking-[0.18em] uppercase">FlowNexus</span>
      </div>

      <div className="max-w-2xl py-20 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">Approval intelligence</p>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-6xl">Move every decision forward.</h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
          A clear, accountable workspace for requests, reviews, escalations, and final approvals.
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-9 inline-flex items-center gap-3 rounded-lg bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-xl transition hover:bg-blue-50"
        >
          Open workspace
          <span aria-hidden="true">-&gt;</span>
        </button>
      </div>

      <p className="text-xs text-slate-300">Secure multi-tier approval operations</p>
    </div>
  </main>
);