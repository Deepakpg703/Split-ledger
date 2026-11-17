import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  Edit3,
  Mic,
  Search,
  Split,
  Trash2,
} from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_META,
  type CurrencyCode,
  type DateRangeFilter,
  type Expense,
  type ExpenseCategory,
  type PaymentFilter,
} from '../types/expense';
import {
  exportExpensesToCsv,
  filterExpenses,
  formatMoneyExact,
} from '../services/expenseService';

interface TransactionLedgerProps {
  expenses: Expense[];
  currency: CurrencyCode;
  onEdit: (expense: Expense) => void;
  onDelete: (expenseId: string) => void;
  onAddNew: () => void;
  onLoadDemoData: () => void;
  compact?: boolean;
  onViewAll?: () => void;
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  expenses,
  currency,
  onEdit,
  onDelete,
  onAddNew,
  onLoadDemoData,
  compact = false,
  onViewAll,
}) => {
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = compact
    ? expenses.slice(0, 6)
    : filterExpenses(expenses, {
        search,
        paymentFilter,
        categoryFilter,
        dateRange,
        customStart,
        customEnd,
      });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatTxDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTxTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const paymentFilterOptions: Array<{ key: PaymentFilter; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'CASH', label: 'Cash' },
    { key: 'UPI', label: 'UPI' },
    { key: 'CARD', label: 'Card' },
    { key: 'SPLIT', label: 'Split Only' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header & Controls */}
      <div className="p-5 sm:p-6 border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              {compact ? 'Recent Transactions' : 'Transaction Ledger'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {compact
                ? `Showing latest ${filtered.length} of ${expenses.length} logged expenses`
                : `${filtered.length} matching ${
                    filtered.length === 1 ? 'transaction' : 'transactions'
                  }`}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {!compact && (
              <>
                <button
                  type="button"
                  onClick={onLoadDemoData}
                  className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-slate-500" />
                  <span>Load Demo Data</span>
                </button>
                <button
                  type="button"
                  disabled={filtered.length === 0}
                  onClick={() => exportExpensesToCsv(filtered, currency)}
                  className="px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export CSV</span>
                </button>
              </>
            )}

            {compact && onViewAll && expenses.length > 0 && (
              <button
                type="button"
                onClick={onViewAll}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap cursor-pointer"
              >
                View all transactions &rarr;
              </button>
            )}
          </div>
        </div>

        {/* Full Filter Toolbar */}
        {!compact && (
          <div className="mt-5 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search merchant, UPI app, bank, notes, or voice transcript..."
                  className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                />
              </div>

              {/* Payment Mode Segmented Filter */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                {paymentFilterOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPaymentFilter(opt.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      paymentFilter === opt.key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as ExpenseCategory | 'ALL')
                }
                className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              >
                <option value="ALL">All Categories</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by date range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
                className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              >
                <option value="ALL">All Time</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_7_DAYS">Last 7 Days</option>
                <option value="LAST_30_DAYS">Last 30 Days</option>
                <option value="CUSTOM">Custom Range</option>
              </select>

              {dateRange === 'CUSTOM' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    aria-label="Start date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    aria-label="End date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                  />
                </div>
              )}

              {(search ||
                paymentFilter !== 'ALL' ||
                categoryFilter !== 'ALL' ||
                dateRange !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPaymentFilter('ALL');
                    setCategoryFilter('ALL');
                    setDateRange('ALL');
                    setCustomStart('');
                    setCustomEnd('');
                  }}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 px-2 py-1 cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table or Empty State */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            {expenses.length === 0
              ? 'No expenses recorded yet'
              : 'No transactions match your active filters'}
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {expenses.length === 0
              ? 'Log a manual or voice expense, or load sample Indian payment records to explore split-mode analytics.'
              : 'Try adjusting your search text, payment mode filter, or date range.'}
          </p>
          {expenses.length === 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onAddNew}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
              >
                Log First Expense
              </button>
              <button
                type="button"
                onClick={onLoadDemoData}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Load Demo Data
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3">Expense &amp; Category</th>
                <th className="py-3 px-3 whitespace-nowrap">Date</th>
                <th className="py-3 px-3 whitespace-nowrap">Payment Mode</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Amount</th>
                <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((exp) => {
                const isSplit = exp.is_split || exp.payments.length > 1;
                const hasTranscript = Boolean(exp.raw_voice_transcript);
                const expandable = isSplit || hasTranscript || Boolean(exp.notes);
                const isExpanded = Boolean(expandedIds[exp.id]);
                const primaryLeg = exp.payments[0];

                return (
                  <React.Fragment key={exp.id}>
                    <tr
                      className={`hover:bg-slate-50/80 transition-colors ${
                        expandable ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => expandable && toggleExpand(exp.id)}
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 w-4 shrink-0 text-slate-400">
                            {expandable ? (
                              isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 truncate">
                                {exp.title}
                              </span>
                              {hasTranscript && (
                                <span
                                  title="Logged via Voice"
                                  className="text-teal-700 shrink-0"
                                >
                                  <Mic className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                              <span>{exp.category}</span>
                              {exp.notes && (
                                <>
                                  <span aria-hidden="true">&middot;</span>
                                  <span className="truncate max-w-[240px]">{exp.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="text-xs text-slate-700 font-mono tabular-nums">
                          {formatTxDate(exp.transaction_date)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {formatTxTime(exp.transaction_date)}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isSplit ? (
                          <div className="flex items-center gap-2 text-xs">
                            <Split className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                            <span className="font-medium text-slate-800">
                              Split ({exp.payments.length} legs)
                            </span>
                            <span className="text-slate-400 hidden sm:inline">
                              &middot;{' '}
                              {exp.payments
                                .map((p) => PAYMENT_METHOD_META[p.payment_method].label)
                                .join(' + ')}
                            </span>
                          </div>
                        ) : primaryLeg ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                PAYMENT_METHOD_META[primaryLeg.payment_method].dotClass
                              }`}
                            />
                            <span className="font-medium text-slate-800">
                              {PAYMENT_METHOD_META[primaryLeg.payment_method].label}
                            </span>
                            {primaryLeg.method_details && (
                              <span className="text-slate-500">
                                &middot; {primaryLeg.method_details}
                              </span>
                            )}
                          </div>
                        ) : null}
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatMoneyExact(exp.total_amount, currency)}
                        </span>
                      </td>

                      <td
                        className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Edit ${exp.title}`}
                            onClick={() => onEdit(exp)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {confirmDeleteId === exp.id ? (
                            <div className="inline-flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDelete(exp.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-label={`Delete ${exp.title}`}
                              onClick={() => setConfirmDeleteId(exp.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && expandable && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={5} className="px-11 py-3.5 border-t border-slate-100">
                          <div className="space-y-2.5 text-xs">
                            {isSplit && (
                              <div>
                                <div className="font-medium text-slate-600 mb-1.5">
                                  Split Payment Breakdown
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  {exp.payments.map((leg) => {
                                    const meta = PAYMENT_METHOD_META[leg.payment_method];
                                    return (
                                      <div
                                        key={leg.id}
                                        className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span
                                            className={`w-2 h-2 rounded-full shrink-0 ${meta.dotClass}`}
                                          />
                                          <span className="font-medium text-slate-800">
                                            {meta.label}
                                          </span>
                                          {leg.method_details && (
                                            <span className="text-slate-500 truncate">
                                              &middot; {leg.method_details}
                                            </span>
                                          )}
                                        </div>
                                        <span className="font-mono font-semibold text-slate-900 tabular-nums ml-2">
                                          {formatMoneyExact(leg.amount, currency)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {exp.raw_voice_transcript && (
                              <div className="flex items-start gap-2 text-slate-600">
                                <Mic className="w-3.5 h-3.5 text-teal-700 mt-0.5 shrink-0" />
                                <span>
                                  <strong className="font-medium text-slate-700">
                                    Voice Transcript:
                                  </strong>{' '}
                                  &ldquo;{exp.raw_voice_transcript}&rdquo;
                                </span>
                              </div>
                            )}

                            {exp.notes && (
                              <div className="text-slate-600">
                                <strong className="font-medium text-slate-700">
                                  Notes:
                                </strong>{' '}
                                {exp.notes}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
