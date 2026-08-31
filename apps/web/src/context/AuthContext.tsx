import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { AuthResponse, PublicUser } from '@streamarena/shared';

interface AuthState {
  user: PublicUser | null;
  token: string | null;
  balance: number;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string, email?: string) => Promise<void>;
  logout: () => void;
  refreshWallet: () => Promise<void>;
  setBalance: (balance: number) => void;
  setFullAccess: (granted: boolean) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = 'streamarena.auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [balance, setBalanceState] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AuthResponse;
        setUser(parsed.user);
        setToken(parsed.token);
        setBalanceState(parsed.wallet.balance);
      } catch {
        /* ignore corrupt storage */
      }
    }
    setLoading(false);
  }, []);

  const persist = useCallback((res: AuthResponse) => {
    setUser(res.user);
    setToken(res.token);
    setBalanceState(res.wallet.balance);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(res));
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.post<AuthResponse>('/api/auth/login', { username, password });
      persist(res);
    },
    [persist],
  );

  const register = useCallback(
    async (username: string, password: string, displayName?: string, email?: string) => {
      const res = await api.post<AuthResponse>('/api/auth/register', { username, password, displayName, email });
      persist(res);
    },
    [persist],
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setBalanceState(0);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const setBalance = useCallback(
    (b: number) => {
      setBalanceState(b);
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthResponse;
        parsed.wallet.balance = b;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    },
    [],
  );

  const refreshWallet = useCallback(async () => {
    if (!token) return;
    const res = await api.get<{ balance: number }>('/api/wallet/me', token);
    setBalance(res.balance);
  }, [token, setBalance]);

  const setFullAccess = useCallback((granted: boolean) => {
    setUser((prev) => (prev ? { ...prev, fullAccessGranted: granted } : prev));
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthResponse;
      parsed.user.fullAccessGranted = granted;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
  }, []);

  const value = useMemo(
    () => ({ user, token, balance, loading, login, register, logout, refreshWallet, setBalance, setFullAccess }),
    [user, token, balance, loading, login, register, logout, refreshWallet, setBalance, setFullAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
