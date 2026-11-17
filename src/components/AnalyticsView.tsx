import React from 'react';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_META,
  type CurrencyCode,
  type Expense,
} from '../types/expense';
import {
  calculateMetrics,
  formatMoney,
  formatMoneyExact,
} from '../services/expenseService';
import { DailyVelocityChart } from './Charts';

interface AnalyticsViewProps {
  expenses: Expense[];
  currency: CurrencyCode;
  onAddNew: () => void;
  onLoadDemoData: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  expenses,
  currency,
  onAddNew,
  onLoadDemoData,
}) => {
  const metrics = calculateMetrics(expenses);

  if (expenses.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <h3 className="font-display text-lg font-semibold text-slate-900">
          Analytics will appear once expenses are logged
        </h3>
        <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
          Track how your spending splits across Cash, UPI, and Card for every category.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onAddNew}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
          >
            Log First Expense
          </button>
          <button
            type="button"
            onClick={onLoadDemoData}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            Load Demo Data
          </button>
        </div>
      </div>
    );
  }

  const splitExpenses = expenses.filter(
    (e) => e.is_split || e.payments.length > 1
  );
  const avgExpense = metrics.totalSpend / expenses.length;
  const splitSharePct =
    metrics.totalSpend > 0
      ? (metrics.splitTotalVolume / metrics.totalSpend) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Insights Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Average Transaction Size
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatMoney(avgExpense, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across {metrics.transactionCount} total entries
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Split-Mode Transactions
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {splitExpenses.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {formatMoney(metrics.splitTotalVolume, currency)} ({splitSharePct.toFixed(1)}% of spend)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Dominant Payment Channel
          </div>
          <div className="mt-2 font-display text-2xl font-semibold text-slate-900">
            {metrics.upiSpend >= metrics.cashSpend && metrics.upiSpend >= metrics.cardSpend
              ? 'UPI'
              : metrics.cashSpend >= metrics.cardSpend
                ? 'Cash'
                : 'Card'}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {formatMoney(
              Math.max(metrics.upiSpend, metrics.cashSpend, metrics.cardSpend),
              currency
            )}{' '}
            allocated
          </div>
        </div>
      </div>

      {/* 14-Day Stacked Bar Chart */}
      <DailyVelocityChart expenses={expenses} currency={currency} />

      {/* Category x Payment Mode Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Category &times; Payment Mode Matrix
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Exact leg-level attribution per category with zero double-counting
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 pl-6 pr-3">Category</th>
                <th className="py-3 px-3 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${PAYMENT_METHOD_META.CASH.dotClass}`} />
                    Cash
                  </span>
                </th>
                <th className="py-3 px-3 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${PAYMENT_METHOD_META.UPI.dotClass}`} />
                    UPI
                  </span>
                </th>
                <th className="py-3 px-3 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${PAYMENT_METHOD_META.CARD.dotClass}`} />
                    Card
                  </span>
                </th>
                <th className="py-3 pl-3 pr-6 text-right">Category Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {EXPENSE_CATEGORIES.map((cat) => {
                const row = metrics.categoryByMethod[cat];
                const total = metrics.categoryTotals[cat];
                return (
                  <tr key={cat} className="hover:bg-slate-50/60">
                    <td className="py-3 pl-6 pr-3 font-medium text-slate-800">{cat}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                      {formatMoneyExact(row.CASH, currency)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                      {formatMoneyExact(row.UPI, currency)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                      {formatMoneyExact(row.CARD, currency)}
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {formatMoneyExact(total, currency)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-900">
                <td className="py-3.5 pl-6 pr-3">All Categories</td>
                <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                  {formatMoneyExact(metrics.cashSpend, currency)}
                </td>
                <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                  {formatMoneyExact(metrics.upiSpend, currency)}
                </td>
                <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                  {formatMoneyExact(metrics.cardSpend, currency)}
                </td>
                <td className="py-3.5 pl-3 pr-6 text-right font-mono tabular-nums text-teal-800">
                  {formatMoneyExact(metrics.totalSpend, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
