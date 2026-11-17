import type { CurrencyCode, User } from '../types/expense';

/**
 * Auth Provider Configuration
 * Reads from environment placeholders so localStorage auth can be swapped
 * cleanly for Firebase or Supabase when backend credentials are provided.
 */
export const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER || 'local';

interface StoredUser extends User {
  passwordHash: string;
}

const USERS_KEY = 'splitledger_users_v1';
const SESSION_KEY = 'splitledger_session_v1';

export const DEMO_ACCOUNT = {
  email: 'aarav@splitledger.in',
  password: 'demo-user-2026',
  name: 'Aarav Sharma',
};

async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(`splitledger_salt:${password}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Deterministic fallback if SubtleCrypto is unavailable in non-secure contexts
  let hash = 5381;
  for (let i = 0; i < password.length; i += 1) {
    hash = (hash * 33) ^ password.charCodeAt(i);
  }
  return `fb_${(hash >>> 0).toString(16)}`;
}

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function sanitizeUser(stored: StoredUser): User {
  return {
    id: stored.id,
    name: stored.name,
    email: stored.email,
    currency: stored.currency || 'INR',
    created_at: stored.created_at,
  };
}

export function getCurrentSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const sessionUser = JSON.parse(raw) as User;
    if (!sessionUser?.id || !sessionUser?.email) return null;
    // Sync with stored user record so updates persist cleanly
    const users = readUsers();
    const fresh = users.find((u) => u.id === sessionUser.id);
    return fresh ? sanitizeUser(fresh) : sessionUser;
  } catch {
    return null;
  }
}

function setSession(user: User | null): void {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export async function signUpUser(params: {
  name: string;
  email: string;
  password: string;
  currency?: CurrencyCode;
}): Promise<User> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const password = params.password;

  if (!name) {
    throw new Error('Please enter your full name.');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const users = readUsers();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    throw new Error('An account with this email already exists. Please log in instead.');
  }

  const passwordHash = await hashPassword(password);
  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    name,
    email,
    currency: params.currency || 'INR',
    created_at: new Date().toISOString(),
    passwordHash,
  };

  writeUsers([...users, newUser]);
  const publicUser = sanitizeUser(newUser);
  setSession(publicUser);
  return publicUser;
}

export async function loginUser(params: {
  email: string;
  password: string;
}): Promise<User> {
  const email = params.email.trim().toLowerCase();
  const password = params.password;

  if (!email || !password) {
    throw new Error('Please enter both email and password.');
  }

  const users = readUsers();
  const found = users.find((u) => u.email.toLowerCase() === email);
  if (!found) {
    throw new Error('Invalid email or password.');
  }

  const candidateHash = await hashPassword(password);
  if (found.passwordHash !== candidateHash) {
    throw new Error('Invalid email or password.');
  }

  const publicUser = sanitizeUser(found);
  setSession(publicUser);
  return publicUser;
}

export async function loginOrCreateDemoUser(): Promise<{ user: User; isNew: boolean }> {
  const users = readUsers();
  const existing = users.find(
    (u) => u.email.toLowerCase() === DEMO_ACCOUNT.email.toLowerCase()
  );

  if (existing) {
    const publicUser = sanitizeUser(existing);
    setSession(publicUser);
    return { user: publicUser, isNew: false };
  }

  const user = await signUpUser({
    name: DEMO_ACCOUNT.name,
    email: DEMO_ACCOUNT.email,
    password: DEMO_ACCOUNT.password,
    currency: 'INR',
  });
  return { user, isNew: true };
}

export function updateUserCurrency(userId: string, currency: CurrencyCode): User | null {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;

  users[idx] = { ...users[idx], currency };
  writeUsers(users);

  const updated = sanitizeUser(users[idx]);
  setSession(updated);
  return updated;
}

export function logoutUser(): void {
  setSession(null);
}
