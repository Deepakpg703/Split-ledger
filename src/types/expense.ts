export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export const CURRENCY_CONFIG: Record<
  CurrencyCode,
  { symbol: string; locale: string; label: string }
> = {
  INR: { symbol: '₹', locale: 'en-IN', label: 'INR (₹)' },
  USD: { symbol: '$', locale: 'en-US', label: 'USD ($)' },
  EUR: { symbol: '€', locale: 'de-DE', label: 'EUR (€)' },
  GBP: { symbol: '£', locale: 'en-GB', label: 'GBP (£)' },
};

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Utilities',
  'Shopping',
  'Entertainment',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  { label: string; color: string; dotClass: string; barClass: string }
> = {
  CASH: {
    label: 'Cash',
    color: '#059669',
    dotClass: 'bg-emerald-600',
    barClass: 'bg-emerald-600',
  },
  UPI: {
    label: 'UPI',
    color: '#4F46E5',
    dotClass: 'bg-indigo-600',
    barClass: 'bg-indigo-600',
  },
  CARD: {
    label: 'Card',
    color: '#D97706',
    dotClass: 'bg-amber-600',
    barClass: 'bg-amber-600',
  },
};

export const UPI_SUGGESTIONS = ['GPay', 'PhonePe', 'Paytm', 'Cred', 'BHIM'];
export const CARD_SUGGESTIONS = ['HDFC Credit', 'ICICI Debit', 'SBI Card', 'Axis Ace'];

export interface PaymentSplit {
  id: string;
  payment_method: PaymentMethod;
  amount: number;
  method_details?: string;
}

export interface Expense {
  id: string;
  user_id: string;
  title: string;
  total_amount: number;
  category: ExpenseCategory;
  transaction_date: string; // ISO string
  is_split: boolean;
  payments: PaymentSplit[];
  notes?: string;
  raw_voice_transcript?: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  currency: CurrencyCode;
  created_at: string;
}

export interface VoiceExtractionResult {
  transcript: string;
  title: string;
  total_amount: number;
  category: ExpenseCategory;
  is_split: boolean;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    details?: string;
  }>;
}

export type PaymentFilter = 'ALL' | 'CASH' | 'UPI' | 'CARD' | 'SPLIT';
export type DateRangeFilter = 'ALL' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'LAST_7_DAYS' | 'CUSTOM';
