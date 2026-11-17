import React, { useState } from 'react';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_META,
  PAYMENT_METHODS,
  type CurrencyCode,
  type Expense,
  type ExpenseCategory,
  type PaymentMethod,
} from '../types/expense';
import { formatMoney } from '../services/expenseService';

interface PaymentDonutChartProps {
  cashSpend: number;
  upiSpend: number;
  cardSpend: number;
  currency: CurrencyCode;
}

export const PaymentDonutChart: React.FC<PaymentDonutChartProps> = ({
  cashSpend,
  upiSpend,
  cardSpend,
  currency,
}) => {
  const [hovered, setHovered] = useState<PaymentMethod | null>(null);
  const total = cashSpend + upiSpend + cardSpend;

  const segments: Array<{ method: PaymentMethod; value: number }> = [
    { method: 'UPI', value: upiSpend },
    { method: 'CASH', value: cashSpend },
    { method: 'CARD', value: cardSpend },
  ];

  const radius = 64;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dashLength = pct * circumference;
    const dashOffset = -cumulativePercent * circumference;
    cumulativePercent += pct;
    return {
      ...seg,
      pct,
      dashLength,
      dashOffset,
    };
  });

  const activeSegment = hovered
    ? arcs.find((a) => a.method === hovered)
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            Breakdown by Payment Mode
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Aggregated across single and split payment legs
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-8">
        {/* SVG Donut */}
        <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
          <svg
            viewBox="0 0 168 168"
            className="w-full h-full -rotate-90"
            role="img"
            aria-label="Payment mode breakdown donut chart"
          >
            <circle
              cx="84"
              cy="84"
              r={radius}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />
            {total > 0 &&
              arcs.map((arc) => {
                if (arc.value <= 0) return null;
                const meta = PAYMENT_METHOD_META[arc.method];
                const isDimmed = hovered !== null && hovered !== arc.method;
                return (
                  <circle
                    key={arc.method}
                    cx="84"
                    cy="84"
                    r={radius}
                    fill="none"
                    stroke={meta.color}
                    strokeWidth={hovered === arc.method ? strokeWidth + 3 : strokeWidth}
                    strokeDasharray={`${arc.dashLength} ${circumference}`}
                    strokeDashoffset={arc.dashOffset}
                    className="transition-all duration-150 cursor-pointer"
                    style={{ opacity: isDimmed ? 0.35 : 1 }}
                    onMouseEnter={() => setHovered(arc.method)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
            <span className="text-xs font-medium text-slate-500">
              {activeSegment
                ? PAYMENT_METHOD_META[activeSegment.method].label
                : 'Total'}
            </span>
            <span className="mt-0.5 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {formatMoney(activeSegment ? activeSegment.value : total, currency)}
            </span>
            {activeSegment && (
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {(activeSegment.pct * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Legend Rows */}
        <div className="flex-1 w-full space-y-3">
          {PAYMENT_METHODS.map((method) => {
            const value =
              method === 'CASH'
                ? cashSpend
                : method === 'UPI'
                  ? upiSpend
                  : cardSpend;
            const pct = total > 0 ? (value / total) * 100 : 0;
            const meta = PAYMENT_METHOD_META[method];

            return (
              <div
                key={method}
                onMouseEnter={() => setHovered(method)}
                onMouseLeave={() => setHovered(null)}
                className={`p-2.5 rounded-lg border transition-colors cursor-default ${
                  hovered === method
                    ? 'border-slate-300 bg-slate-50'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${meta.dotClass}`}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-slate-800">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span className="text-xs text-slate-500">{pct.toFixed(1)}%</span>
                    <span className="font-semibold text-slate-900">
                      {formatMoney(value, currency)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${meta.barClass} transition-all duration-300`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface CategoryBarChartProps {
  categoryTotals: Record<ExpenseCategory, number>;
  totalSpend: number;
  currency: CurrencyCode;
}

export const CategoryBarChart: React.FC<CategoryBarChartProps> = ({
  categoryTotals,
  totalSpend,
  currency,
}) => {
  const sorted = [...EXPENSE_CATEGORIES]
    .map((cat) => ({
      category: cat,
      amount: categoryTotals[cat] || 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const maxAmount = sorted[0]?.amount || 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between h-full">
      <div>
        <h3 className="font-display text-base font-semibold text-slate-900">
          Spend by Category
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Ranked expense distribution across categories
        </p>
      </div>

      <div className="mt-6 space-y-3.5">
        {sorted.map((item) => {
          const sharePct = totalSpend > 0 ? (item.amount / totalSpend) * 100 : 0;
          const barWidth = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
          return (
            <div key={item.category}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium text-slate-700 truncate pr-3">
                  {item.category}
                </span>
                <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                  <span className="text-xs text-slate-400">
                    {sharePct.toFixed(0)}%
                  </span>
                  <span className="font-semibold text-slate-900 w-24 text-right">
                    {formatMoney(item.amount, currency)}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-700 rounded-full transition-all duration-300"
                  style={{ width: `${item.amount > 0 ? Math.max(barWidth, 2) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface DailyVelocityChartProps {
  expenses: Expense[];
  currency: CurrencyCode;
}

export const DailyVelocityChart: React.FC<DailyVelocityChartProps> = ({
  expenses,
  currency,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Build last 14 days buckets
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return { key, label, cash: 0, upi: 0, card: 0, total: 0 };
  });

  const bucketMap = new Map(days.map((d) => [d.key, d]));

  for (const exp of expenses) {
    const dt = new Date(exp.transaction_date);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(dt.getDate()).padStart(2, '0')}`;
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    bucket.total += exp.total_amount;
    for (const leg of exp.payments) {
      if (leg.payment_method === 'CASH') bucket.cash += leg.amount;
      if (leg.payment_method === 'UPI') bucket.upi += leg.amount;
      if (leg.payment_method === 'CARD') bucket.card += leg.amount;
    }
  }

  const maxDay = Math.max(...days.map((d) => d.total), 100);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            14-Day Spend Velocity by Payment Mode
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Daily stacked volume showing Cash, UPI, and Card payment legs
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600">
          {PAYMENT_METHODS.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${PAYMENT_METHOD_META[m].dotClass}`} />
              {PAYMENT_METHOD_META[m].label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 h-48 flex items-end gap-2">
        {days.map((day, idx) => {
          const totalHeightPct = (day.total / maxDay) * 100;
          const cashPct = day.total > 0 ? (day.cash / day.total) * 100 : 0;
          const upiPct = day.total > 0 ? (day.upi / day.total) * 100 : 0;
          const cardPct = day.total > 0 ? (day.card / day.total) * 100 : 0;

          return (
            <div
              key={day.key}
              className="flex-1 flex flex-col items-center h-full justify-end relative group"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {hoveredIdx === idx && (
                <div className="absolute -top-14 z-10 bg-slate-900 text-white text-xs rounded-md px-2.5 py-1.5 whitespace-nowrap pointer-events-none shadow-sm">
                  <div className="font-medium">{day.label}</div>
                  <div className="font-mono tabular-nums text-slate-200">
                    {formatMoney(day.total, currency)}
                  </div>
                </div>
              )}

              <div className="w-full max-w-[28px] h-36 flex flex-col justify-end bg-slate-50 rounded-t-sm overflow-hidden">
                {day.total > 0 && (
                  <div
                    className="w-full flex flex-col justify-end rounded-t-sm overflow-hidden transition-all duration-200"
                    style={{ height: `${Math.max(totalHeightPct, 4)}%` }}
                  >
                    {cardPct > 0 && (
                      <div
                        className="w-full bg-amber-600"
                        style={{ height: `${cardPct}%` }}
                      />
                    )}
                    {upiPct > 0 && (
                      <div
                        className="w-full bg-indigo-600"
                        style={{ height: `${upiPct}%` }}
                      />
                    )}
                    {cashPct > 0 && (
                      <div
                        className="w-full bg-emerald-600"
                        style={{ height: `${cashPct}%` }}
                      />
                    )}
                  </div>
                )}
              </div>

              <span className="mt-2 text-[10px] text-slate-400 font-mono tabular-nums truncate w-full text-center">
                {idx % 2 === 0 ? day.label.split(' ')[0] : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
