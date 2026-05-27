'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { clearCache } from '@/hooks/use-fetch';
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
          // Cookie is valid — restore user display data from localStorage
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          } else {
            // Fallback: use the decoded payload from /api/auth/me
            const { user: payload } = await res.json();
            if (payload) setUser(payload as User);
          }
          // token is NOT restored — it's memory-only; API calls use the cookie
        } else {
          // Cookie is invalid/expired — purge stale state
          localStorage.removeItem('user');
        }
      } catch {
        // Network error: fall back to localStorage so the UI doesn't flash
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
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
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
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

    // Use setTimeout to ensure localStorage is written before redirect
    setTimeout(() => {
      if (data.user.role === 'superadmin') {
        router.push('/superadmin');
      } else if (data.user.role === 'leadpastor' || data.user.role === 'overseer') {
        // Leadpastors and overseers go to group selector
        router.push('/leadpastor');
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
