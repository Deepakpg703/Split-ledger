import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CreditCard,
  Database,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  Mic,
  Plus,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import {
  getCurrentSession,
  logoutUser,
  updateUserCurrency,
} from './services/authService';
import {
  buildDemoSeedExpenses,
  calculateMetrics,
  deleteExpenseForUser,
  formatMoney,
  getExpensesForUser,
  upsertExpenseForUser,
} from './services/expenseService';
import type { CurrencyCode, Expense, User } from './types/expense';
import { AuthScreen } from './components/AuthScreen';
import { CategoryBarChart, PaymentDonutChart } from './components/Charts';
import { TransactionLedger } from './components/TransactionLedger';
import { AnalyticsView } from './components/AnalyticsView';
import { ExpenseModal } from './components/ExpenseModal';

type ActiveTab = 'overview' | 'transactions' | 'analytics';

export default function App() {
  const [user, setUser] = useState<User | null>(() => getCurrentSession());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [autoStartVoice, setAutoStartVoice] = useState(false);

  // Load user-scoped expenses whenever authenticated user changes
  useEffect(() => {
    if (user) {
      setExpenses(getExpensesForUser(user.id));
    } else {
      setExpenses([]);
    }
  }, [user]);

  const metrics = useMemo(() => calculateMetrics(expenses), [expenses]);

  const handleOpenAddModal = (startVoice = false) => {
    setEditingExpense(null);
    setAutoStartVoice(startVoice);
    setModalOpen(true);
  };

  const handleOpenEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setAutoStartVoice(false);
    setModalOpen(true);
  };

  const handleSaveExpense = (
    payload: Omit<Expense, 'id' | 'user_id' | 'created_at'> & { id?: string }
  ) => {
    if (!user) return;
    const updated = upsertExpenseForUser(user.id, payload);
    setExpenses(updated);
    setModalOpen(false);
    setEditingExpense(null);
    setAutoStartVoice(false);
  };

  const handleDeleteExpense = (expenseId: string) => {
    if (!user) return;
    const updated = deleteExpenseForUser(user.id, expenseId);
    setExpenses(updated);
  };

  const handleLoadDemoData = () => {
    if (!user) return;
    const seeded = buildDemoSeedExpenses(user.id);
    setExpenses(seeded);
  };

  const handleCurrencyChange = (currency: CurrencyCode) => {
    if (!user) return;
    const updated = updateUserCurrency(user.id, currency);
    if (updated) {
      setUser(updated);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setActiveTab('overview');
    setModalOpen(false);
  };

  if (!user) {
    return <AuthScreen onAuthSuccess={(authedUser) => setUser(authedUser)} />;
  }

  const navItems: Array<{
    key: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'transactions', label: 'Transactions', icon: ListOrdered },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const activeTitle =
    activeTab === 'overview'
      ? 'Overview'
      : activeTab === 'transactions'
        ? 'Transactions'
        : 'Analytics';

  const cashShare =
    metrics.totalSpend > 0
      ? ((metrics.cashSpend / metrics.totalSpend) * 100).toFixed(1)
      : '0.0';
  const upiShare =
    metrics.totalSpend > 0
      ? ((metrics.upiSpend / metrics.totalSpend) * 100).toFixed(1)
      : '0.0';
  const cardShare =
    metrics.totalSpend > 0
      ? ((metrics.cardSpend / metrics.totalSpend) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Mobile Sidebar Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Left Navigation Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand */}
          <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center text-white shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
                SplitLedger
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Nav */}
          <nav className="p-4 space-y-1" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.key);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-teal-700' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Currency & Demo Utility */}
          <div className="px-4 pt-4 mt-2 border-t border-slate-100 space-y-3">
            <div>
              <label
                htmlFor="sidebar-currency"
                className="block text-xs font-medium text-slate-500 mb-1.5"
              >
                Display Currency
              </label>
              <select
                id="sidebar-currency"
                value={user.currency}
                onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              >
                <option value="INR">INR (₹) — Rupee</option>
                <option value="USD">USD ($) — Dollar</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GBP">GBP (£) — Pound</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                handleLoadDemoData();
                setMobileNavOpen(false);
              }}
              className="w-full py-2 px-3 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>Load Demo Data</span>
            </button>
          </div>
        </div>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {user.name}
              </div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">Workspace</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-slate-900 truncate">
                {activeTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenAddModal(true)}
              className="px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-teal-700" />
              <span>Voice Log</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal(false)}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1240px] w-full mx-auto space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* 4-Column KPI Strip */}
              <section
                aria-label="Expense summary metrics"
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
              >
                {/* Total Spend */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Total Spend (This Month)</span>
                    <Wallet className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="mt-2.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatMoney(metrics.thisMonthSpend, user.currency)}
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                    All-time: {formatMoney(metrics.totalSpend, user.currency)} &middot;{' '}
                    {metrics.transactionCount} txns
                  </div>
                </div>

                {/* Cash Spend */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Cash Spend
                    </span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {cashShare}%
                    </span>
                  </div>
                  <div className="mt-2.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatMoney(metrics.cashSpend, user.currency)}
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500">
                    Includes cash legs from split bills
                  </div>
                </div>

                {/* UPI Spend */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      UPI Spend
                    </span>
                    <Smartphone className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="mt-2.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatMoney(metrics.upiSpend, user.currency)}
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                    {upiShare}% of total spend
                  </div>
                </div>

                {/* Card Spend */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      Card Spend
                    </span>
                    <CreditCard className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="mt-2.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatMoney(metrics.cardSpend, user.currency)}
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                    {cardShare}% of total &middot; {metrics.splitCount} split txns
                  </div>
                </div>
              </section>

              {/* Empty state onboarding banner for newly registered users */}
              {expenses.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="max-w-xl">
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Welcome to your personal ledger, {user.name}
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                      Start by recording a quick voice expense for loose cash, adding a split payment manually, or loading sample records to explore charts and filters immediately.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(true)}
                      className="px-4 py-2.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Voice Log</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(false)}
                      className="px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log First Expense</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadDemoData}
                      className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Load Demo Data</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* 2-Column Charts Grid */
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                  <PaymentDonutChart
                    cashSpend={metrics.cashSpend}
                    upiSpend={metrics.upiSpend}
                    cardSpend={metrics.cardSpend}
                    currency={user.currency}
                  />
                  <CategoryBarChart
                    categoryTotals={metrics.categoryTotals}
                    totalSpend={metrics.totalSpend}
                    currency={user.currency}
                  />
                </section>
              )}

              {/* Recent Transactions */}
              <TransactionLedger
                expenses={expenses}
                currency={user.currency}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteExpense}
                onAddNew={() => handleOpenAddModal(false)}
                onLoadDemoData={handleLoadDemoData}
                compact
                onViewAll={() => setActiveTab('transactions')}
              />
            </>
          )}

          {activeTab === 'transactions' && (
            <TransactionLedger
              expenses={expenses}
              currency={user.currency}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteExpense}
              onAddNew={() => handleOpenAddModal(false)}
              onLoadDemoData={handleLoadDemoData}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              expenses={expenses}
              currency={user.currency}
              onAddNew={() => handleOpenAddModal(false)}
              onLoadDemoData={handleLoadDemoData}
            />
          )}
        </main>
      </div>

      {/* Unified Add / Edit / Voice Expense Modal */}
      <ExpenseModal
        isOpen={modalOpen}
        currency={user.currency}
        editingExpense={editingExpense}
        autoStartVoice={autoStartVoice}
        onClose={() => {
          setModalOpen(false);
          setEditingExpense(null);
          setAutoStartVoice(false);
        }}
        onSave={handleSaveExpense}
      />
    </div>
  );
}
