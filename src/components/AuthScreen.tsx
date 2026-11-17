import React, { useState } from 'react';
import {
  ArrowRight,
  Lock,
  Mail,
  Mic,
  Split,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import {
  DEMO_ACCOUNT,
  loginOrCreateDemoUser,
  loginUser,
  signUpUser,
} from '../services/authService';
import { buildDemoSeedExpenses, getExpensesForUser } from '../services/expenseService';
import type { CurrencyCode, User } from '../types/expense';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user =
        mode === 'login'
          ? await loginUser({ email, password })
          : await signUpUser({ name, email, password, currency });
      onAuthSuccess(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await loginOrCreateDemoUser();
      const existing = getExpensesForUser(user.id);
      if (existing.length === 0) {
        buildDemoSeedExpenses(user.id);
      }
      onAuthSuccess(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start demo session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Narrative Panel */}
      <div className="lg:w-5/12 bg-slate-900 text-slate-100 p-8 lg:p-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-white">
              SplitLedger
            </span>
          </div>

          <div className="mt-14 max-w-md">
            <h1
              className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Track Cash, UPI, Card, and every split bill in one ledger.
            </h1>
            <p className="mt-4 text-slate-300 text-base leading-relaxed">
              Speak loose cash expenses aloud or break a restaurant bill across three payment methods without losing a rupee.
            </p>
          </div>

          <div className="mt-12 space-y-6 max-w-md border-t border-slate-800 pt-8">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-teal-400">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Voice-to-Expense Extraction
                </h2>
                <p className="mt-1 text-sm text-slate-400 leading-relaxed">
                  Say &ldquo;Paid 140 cash for auto&rdquo; or &ldquo;400 groceries, 150 cash and 250 GPay&rdquo; and verify structured fields instantly.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-teal-400">
                <Split className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Zero Double-Counting Split Engine
                </h2>
                <p className="mt-1 text-sm text-slate-400 leading-relaxed">
                  Multi-tender transactions credit each payment leg accurately across Cash, UPI, and Card totals.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-12 text-xs text-slate-500">
          Per-account isolated storage · Supports INR, USD, EUR, and GBP
        </p>
      </div>

      {/* Right Auth Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                {mode === 'login' ? 'Sign in to your ledger' : 'Create your account'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {mode === 'login'
                  ? 'Access your personal expense records.'
                  : 'Each account maintains an isolated expense ledger.'}
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="mt-6 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Priya Nair"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-currency"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Default Currency
                </label>
                <select
                  id="auth-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                >
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="USD">USD ($) — US Dollar</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {submitting
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Sign In'
                    : 'Create Account'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              Continue with Demo Account ({DEMO_ACCOUNT.name})
            </button>
            <p className="mt-2.5 text-xs text-center text-slate-500">
              Sign up with any email to start with a clean empty ledger.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
