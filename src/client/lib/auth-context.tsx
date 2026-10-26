import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch } from './api.ts';
import type { UserRole } from '../../shared/constants.ts';

export interface AuthUser {
  id: number;
  phone: string;
  fullName: string;
  nationalCode: string | null;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  responderProfile?: {
    id: number;
    verification_status: string;
    equipment_type: string;
    availability_status: string;
    rating_avg: number;
  } | null;
}

export interface PublicSystemInfo {
  environment: string;
  isProduction: boolean;
  publicOperationsEnabled: boolean;
  devQuickLoginEnabled: boolean;
  supportHotline: string | null;
  integrations: {
    paymentGateway: { providerName: string; isSandbox: boolean; noticeFa: string };
    smsProvider: { providerName: string; isSandbox: boolean };
    mapProvider: string;
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  systemInfo: PublicSystemInfo | null;
  refreshUser: () => Promise<void>;
  login: (phone: string, password: string) => Promise<AuthUser>;
  register: (payload: {
    phone: string;
    fullName: string;
    password: string;
    role: 'customer' | 'responder';
    nationalCode?: string;
    equipmentType?: string;
    vehiclePlate?: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [systemInfo, setSystemInfo] = useState<PublicSystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const [meRes, sysRes] = await Promise.all([
        apiFetch<{ user: AuthUser | null }>('/api/auth/me'),
        apiFetch<PublicSystemInfo>('/api/system/public-info'),
      ]);
      setUser(meRes.user);
      setSystemInfo(sysRes);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (phone: string, password: string) => {
    const res = await apiFetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    setUser(res.user);
    return res.user;
  };

  const register: AuthContextValue['register'] = async (payload) => {
    const res = await apiFetch<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, systemInfo, refreshUser, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
