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
          // Server says cookie is valid — restore from localStorage if present
          const storedToken = localStorage.getItem('token');
          const storedUser = localStorage.getItem('user');
          if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          }
        } else {
          // Cookie is invalid/expired — purge stale localStorage state
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch {
        // Network error: fall back to localStorage so the UI doesn't flash
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
          setToken(storedToken);
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
    
    // Store in localStorage first before setting state
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // Then update state
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
