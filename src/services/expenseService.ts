import {
  CURRENCY_CONFIG,
  EXPENSE_CATEGORIES,
  type CurrencyCode,
  type DateRangeFilter,
  type Expense,
  type ExpenseCategory,
  type PaymentFilter,
  type PaymentMethod,
} from '../types/expense';

function getExpensesKey(userId: string): string {
  return `splitledger_expenses_${userId}`;
}

export function formatMoney(amount: number, currency: CurrencyCode = 'INR'): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyExact(amount: number, currency: CurrencyCode = 'INR'): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getExpensesForUser(userId: string): Expense[] {
  try {
    const raw = localStorage.getItem(getExpensesKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as Expense[]).sort(
      (a, b) =>
        new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
    );
  } catch {
    return [];
  }
}

export function saveExpensesForUser(userId: string, expenses: Expense[]): Expense[] {
  const sorted = [...expenses].sort(
    (a, b) =>
      new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
  );
  localStorage.setItem(getExpensesKey(userId), JSON.stringify(sorted));
  return sorted;
}

export function upsertExpenseForUser(
  userId: string,
  expense: Omit<Expense, 'id' | 'user_id' | 'created_at'> & { id?: string; created_at?: string }
): Expense[] {
  const current = getExpensesForUser(userId);
  const nowIso = new Date().toISOString();

  if (expense.id) {
    const updated = current.map((item) =>
      item.id === expense.id
        ? {
            ...item,
            ...expense,
            user_id: userId,
            id: expense.id!,
            created_at: item.created_at,
          }
        : item
    );
    return saveExpensesForUser(userId, updated);
  }

  const created: Expense = {
    ...expense,
    id: crypto.randomUUID(),
    user_id: userId,
    created_at: nowIso,
  };
  return saveExpensesForUser(userId, [created, ...current]);
}

export function deleteExpenseForUser(userId: string, expenseId: string): Expense[] {
  const current = getExpensesForUser(userId);
  const filtered = current.filter((item) => item.id !== expenseId);
  return saveExpensesForUser(userId, filtered);
}

export function buildDemoSeedExpenses(userId: string): Expense[] {
  const now = new Date();
  const daysAgo = (days: number, hour = 13, minute = 20): string => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const seeds: Array<Omit<Expense, 'id' | 'user_id' | 'created_at'>> = [
    {
      title: 'Reliance Fresh Supermarket',
      total_amount: 1450,
      category: 'Groceries',
      transaction_date: daysAgo(0, 18, 40),
      is_split: true,
      payments: [
        { id: crypto.randomUUID(), payment_method: 'CASH', amount: 450, method_details: 'Wallet Cash' },
        { id: crypto.randomUUID(), payment_method: 'UPI', amount: 1000, method_details: 'GPay' },
      ],
      notes: 'Weekly vegetables, dairy, and pantry staples',
      raw_voice_transcript: 'Paid 1450 rupees at Reliance Fresh, 450 cash and 1000 via GPay.',
    },
    {
      title: 'Auto Rickshaw to Indiranagar',
      total_amount: 140,
      category: 'Transport',
      transaction_date: daysAgo(0, 10, 15),
      is_split: false,
      payments: [{ id: crypto.randomUUID(), payment_method: 'CASH', amount: 140, method_details: 'Loose cash' }],
      raw_voice_transcript: 'Paid 140 rupees cash for auto rickshaw to Indiranagar.',
    },
    {
      title: 'Truffles Dinner & Dessert',
      total_amount: 2100,
      category: 'Food & Dining',
      transaction_date: daysAgo(1, 21, 10),
      is_split: true,
      payments: [
        { id: crypto.randomUUID(), payment_method: 'CARD', amount: 1200, method_details: 'HDFC Credit' },
        { id: crypto.randomUUID(), payment_method: 'UPI', amount: 600, method_details: 'PhonePe' },
        { id: crypto.randomUUID(), payment_method: 'CASH', amount: 300, method_details: 'Tip & Cash' },
      ],
      notes: 'Team dinner bill split across card, UPI, and cash',
    },
    {
      title: 'BESCOM Electricity Bill',
      total_amount: 1840,
      category: 'Utilities',
      transaction_date: daysAgo(2, 11, 5),
      is_split: false,
      payments: [{ id: crypto.randomUUID(), payment_method: 'UPI', amount: 1840, method_details: 'Cred' }],
      notes: 'Monthly apartment electricity',
    },
    {
      title: 'Decathlon Running Gear',
      total_amount: 3200,
      category: 'Shopping',
      transaction_date: daysAgo(4, 16, 30),
      is_split: true,
      payments: [
        { id: crypto.randomUUID(), payment_method: 'CARD', amount: 2200, method_details: 'ICICI Debit' },
        { id: crypto.randomUUID(), payment_method: 'CASH', amount: 1000, method_details: 'Wallet Cash' },
      ],
      notes: 'Running shoes and socks',
    },
    {
      title: 'Third Wave Coffee',
      total_amount: 360,
      category: 'Food & Dining',
      transaction_date: daysAgo(5, 9, 45),
      is_split: false,
      payments: [{ id: crypto.randomUUID(), payment_method: 'UPI', amount: 360, method_details: 'GPay' }],
      raw_voice_transcript: 'Spent 360 at Third Wave Coffee using GPay.',
    },
    {
      title: 'PVR IMAX Weekend Tickets',
      total_amount: 980,
      category: 'Entertainment',
      transaction_date: daysAgo(7, 19, 0),
      is_split: false,
      payments: [{ id: crypto.randomUUID(), payment_method: 'CARD', amount: 980, method_details: 'HDFC Credit' }],
      notes: '2 IMAX tickets + popcorn',
    },
    {
      title: 'Local Kirana & Milk',
      total_amount: 280,
      category: 'Groceries',
      transaction_date: daysAgo(9, 8, 20),
      is_split: false,
      payments: [{ id: crypto.randomUUID(), payment_method: 'CASH', amount: 280 }],
      raw_voice_transcript: 'Paid 280 cash at the kirana store for milk and bread.',
    },
    {
      title: 'Airtel Fiber Broadband',
      total_amount: 1179,
      category: 'Utilities',
      transaction_date: daysAgo(12, 14, 15),
      is_split: false,
      payments: [{ id: crypto.randomUUID(), payment_method: 'UPI', amount: 1179, method_details: 'Paytm' }],
    },
    {
      title: 'Metro Smart Card Recharge',
      total_amount: 500,
      category: 'Transport',
      transaction_date: daysAgo(15, 9, 10),
      is_split: false,
      payments: [{ id: crypto.randomUUID(), payment_method: 'UPI', amount: 500, method_details: 'PhonePe' }],
    },
    {
      title: 'Pharmacy & Wellness',
      total_amount: 750,
      category: 'Other',
      transaction_date: daysAgo(19, 17, 50),
      is_split: true,
      payments: [
        { id: crypto.randomUUID(), payment_method: 'CASH', amount: 250 },
        { id: crypto.randomUUID(), payment_method: 'UPI', amount: 500, method_details: 'GPay' },
      ],
    },
  ];

  const created = seeds.map((s) => ({
    ...s,
    id: crypto.randomUUID(),
    user_id: userId,
    created_at: new Date().toISOString(),
  }));

  return saveExpensesForUser(userId, created);
}

export interface DashboardMetrics {
  totalSpend: number;
  thisMonthSpend: number;
  cashSpend: number;
  upiSpend: number;
  cardSpend: number;
  splitCount: number;
  splitTotalVolume: number;
  transactionCount: number;
  categoryTotals: Record<ExpenseCategory, number>;
  categoryByMethod: Record<ExpenseCategory, Record<PaymentMethod, number>>;
}

/**
 * Computes all KPI totals and breakdowns directly from payment legs so
 * split transactions never double-count the total or misallocate payment modes.
 */
export function calculateMetrics(expenses: Expense[]): DashboardMetrics {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const categoryTotals = EXPENSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = 0;
    return acc;
  }, {} as Record<ExpenseCategory, number>);

  const categoryByMethod = EXPENSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = { CASH: 0, UPI: 0, CARD: 0 };
    return acc;
  }, {} as Record<ExpenseCategory, Record<PaymentMethod, number>>);

  let totalSpend = 0;
  let thisMonthSpend = 0;
  let cashSpend = 0;
  let upiSpend = 0;
  let cardSpend = 0;
  let splitCount = 0;
  let splitTotalVolume = 0;

  for (const exp of expenses) {
    totalSpend += exp.total_amount;

    const txDate = new Date(exp.transaction_date);
    if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
      thisMonthSpend += exp.total_amount;
    }

    if (exp.is_split || exp.payments.length > 1) {
      splitCount += 1;
      splitTotalVolume += exp.total_amount;
    }

    const cat = EXPENSE_CATEGORIES.includes(exp.category) ? exp.category : 'Other';
    categoryTotals[cat] += exp.total_amount;

    // Aggregate each payment leg strictly by its method
    for (const leg of exp.payments) {
      if (leg.payment_method === 'CASH') cashSpend += leg.amount;
      if (leg.payment_method === 'UPI') upiSpend += leg.amount;
      if (leg.payment_method === 'CARD') cardSpend += leg.amount;
      categoryByMethod[cat][leg.payment_method] += leg.amount;
    }
  }

  return {
    totalSpend: round2(totalSpend),
    thisMonthSpend: round2(thisMonthSpend),
    cashSpend: round2(cashSpend),
    upiSpend: round2(upiSpend),
    cardSpend: round2(cardSpend),
    splitCount,
    splitTotalVolume: round2(splitTotalVolume),
    transactionCount: expenses.length,
    categoryTotals,
    categoryByMethod,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function filterExpenses(
  expenses: Expense[],
  filters: {
    search: string;
    paymentFilter: PaymentFilter;
    categoryFilter: ExpenseCategory | 'ALL';
    dateRange: DateRangeFilter;
    customStart?: string;
    customEnd?: string;
  }
): Expense[] {
  const q = filters.search.trim().toLowerCase();
  const now = new Date();

  return expenses.filter((exp) => {
    if (filters.categoryFilter !== 'ALL' && exp.category !== filters.categoryFilter) {
      return false;
    }

    if (filters.paymentFilter === 'SPLIT') {
      if (!exp.is_split && exp.payments.length <= 1) return false;
    } else if (filters.paymentFilter !== 'ALL') {
      const hasMethod = exp.payments.some(
        (p) => p.payment_method === filters.paymentFilter
      );
      if (!hasMethod) return false;
    }

    const txTime = new Date(exp.transaction_date).getTime();
    if (filters.dateRange === 'THIS_MONTH') {
      const d = new Date(txTime);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) {
        return false;
      }
    } else if (filters.dateRange === 'LAST_7_DAYS') {
      const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      if (txTime < cutoff) return false;
    } else if (filters.dateRange === 'LAST_30_DAYS') {
      const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      if (txTime < cutoff) return false;
    } else if (filters.dateRange === 'CUSTOM') {
      if (filters.customStart) {
        const start = new Date(filters.customStart).getTime();
        if (txTime < start) return false;
      }
      if (filters.customEnd) {
        const end = new Date(filters.customEnd);
        end.setHours(23, 59, 59, 999);
        if (txTime > end.getTime()) return false;
      }
    }

    if (q) {
      const haystack = [
        exp.title,
        exp.category,
        exp.notes || '',
        exp.raw_voice_transcript || '',
        ...exp.payments.map((p) => `${p.payment_method} ${p.method_details || ''}`),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function exportExpensesToCsv(expenses: Expense[], currency: CurrencyCode): void {
  const headers = [
    'Date',
    'Title',
    'Category',
    'Currency',
    'Total Amount',
    'Is Split',
    'Payment Breakdown',
    'Notes',
    'Voice Transcript',
  ];

  const escapeCsv = (val: string): string => {
    const clean = val.replace(/"/g, '""');
    return `"${clean}"`;
  };

  const rows = expenses.map((exp) => {
    const breakdown = exp.payments
      .map(
        (p) =>
          `${p.payment_method}${p.method_details ? ` (${p.method_details})` : ''}: ${p.amount}`
      )
      .join(' | ');
    return [
      escapeCsv(new Date(exp.transaction_date).toLocaleString()),
      escapeCsv(exp.title),
      escapeCsv(exp.category),
      escapeCsv(currency),
      exp.total_amount.toFixed(2),
      exp.is_split ? 'Yes' : 'No',
      escapeCsv(breakdown),
      escapeCsv(exp.notes || ''),
      escapeCsv(exp.raw_voice_transcript || ''),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `splitledger-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
