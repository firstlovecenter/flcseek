'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { clearCache } from '@/hooks/use-fetch';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  role: 'superadmin' | 'leadpastor' | 'overseer' | 'admin' | 'leader';
  group_name?: string;
  group_year?: number;
  group_id?: string;
  groups_assigned?: string[]; // optional: multiple group assignments
  phone_number: string;
  first_name?: string;
  last_name?: string;
  stream_id?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Validate the session against the server (reads the httpOnly cookie).
    // This clears stale localStorage tokens whose cookie counterpart has expired.
    const validateSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const body = await res.json();
          const payload = body.user as User | undefined;
          if (payload) {
            setUser(payload);
            localStorage.setItem('user', JSON.stringify(payload));
          } else {
            localStorage.removeItem('user');
            setUser(null);
          }
          // The real JWT stays in the httpOnly cookie (used for every API call).
          // Set a non-secret session marker so client code that gates work on a
          // truthy `token` (e.g. superadmin pages) still runs after a refresh,
          // where the in-memory JWT is gone. The marker is never sent as real auth.
          setToken('cookie-session');
        } else {
          // Cookie is invalid/expired — purge stale state
          localStorage.removeItem('user');
          setUser(null);
          setToken(null);
        }
      } catch {
        // Network error: do not fake a logged-in session without a verified cookie
        localStorage.removeItem('user');
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message =
        typeof error?.error === 'string'
          ? error.error
          : response.status === 429
            ? 'Too many login attempts. Please wait and try again.'
            : 'Login failed';
      throw new Error(message);
    }

    const data = await response.json();

    // Keep user display data in localStorage (non-sensitive) for page-refresh hydration.
    // The JWT token is intentionally NOT stored in localStorage to reduce XSS exposure —
    // auth is handled by the httpOnly cookie set by the server on this login response.
    localStorage.setItem('user', JSON.stringify(data.user));

    // Token is kept in memory only (lost on page refresh — cookie handles subsequent auth).
    setToken(data.token);
    setUser(data.user);

    // Clear any cached API responses to avoid stale year/group data
    clearCache();
    api.clearCache();

    // Use setTimeout to ensure localStorage is written before redirect
    setTimeout(() => {
      if (data.user.role === 'superadmin') {
        router.push('/superadmin');
      } else if (data.user.role === 'leadpastor' || data.user.role === 'overseer') {
        // Leadpastors and overseers go to group selector
        router.push('/');
      } else if (data.user.role === 'admin' || data.user.role === 'leader') {
        // Admin/leader with assigned group goes directly to group
        if (data.user.group_id) {
          router.push(`/${data.user.group_id}`);
        } else {
          // If no group_id, show group selector
          router.push('/');
        }
      } else {
        router.push('/auth');
      }
    }, 100);
  };

  const logout = async () => {
    // Clear server-side httpOnly cookie
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    setToken(null);
    localStorage.removeItem('user'); // token was never stored here
    // Clear all cached data on logout
    clearCache();
    api.clearCache();
    router.push('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
