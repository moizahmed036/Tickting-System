'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { User, UserRole } from './types';

export interface SeedAccount {
  label: string;
  email: string;
  password: string;
  role: UserRole;
  deptCode?: string;
  description: string;
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  {
    label: 'Alice (Requester)',
    email: 'requester@enterprise.local',
    password: 'RequesterPass123!',
    role: 'REQUESTER',
    description: 'Submits tickets & tracks requests',
  },
  {
    label: 'Bob (Finance Agent)',
    email: 'fin.agent@enterprise.local',
    password: 'AgentPass123!',
    role: 'ASSIGNEE',
    deptCode: 'FIN',
    description: 'Finance queue specialist',
  },
  {
    label: 'Carol (Finance Director)',
    email: 'fin.director@enterprise.local',
    password: 'DirectorPass123!',
    role: 'AUTHORIZER',
    deptCode: 'FIN',
    description: 'Budget & disbursement approval',
  },
  {
    label: 'Dave (IT Specialist)',
    email: 'it.agent@enterprise.local',
    password: 'AgentPass123!',
    role: 'ASSIGNEE',
    deptCode: 'IT',
    description: 'Infrastructure & desktop support',
  },
  {
    label: 'Eve (IT Lead)',
    email: 'it.lead@enterprise.local',
    password: 'LeadPass123!',
    role: 'AUTHORIZER',
    deptCode: 'IT',
    description: 'Hardware budget authorization',
  },
  {
    label: 'Frank (HR Recruiter)',
    email: 'hr.agent@enterprise.local',
    password: 'AgentPass123!',
    role: 'ASSIGNEE',
    deptCode: 'HR',
    description: 'Recruitment & onboarding specialist',
  },
  {
    label: 'Grace (HR Manager)',
    email: 'hr.manager@enterprise.local',
    password: 'ManagerPass123!',
    role: 'AUTHORIZER',
    deptCode: 'HR',
    description: 'Headcount & offer approvals',
  },
  {
    label: 'Oliver (Compliance Auditor)',
    email: 'auditor@enterprise.local',
    password: 'AuditorPass123!',
    role: 'OBSERVER',
    description: 'Read-only audit & SLA inspector',
  },
  {
    label: 'SysAdmin (Global Admin)',
    email: 'admin@enterprise.local',
    password: 'AdminPassword123!',
    role: 'ADMIN',
    description: 'Full operational & workflow override',
  },
];

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  switchUser: (account: SeedAccount) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const profile = await api.getMe();
        setUser(profile);
      } catch (err) {
        console.warn('Could not restore auth profile:', err);
        api.setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.login(email, password);
      api.setToken(response.access_token);
      setUser(response.user);
    } finally {
      setLoading(false);
    }
  };

  const switchUser = async (account: SeedAccount) => {
    await login(account.email, account.password);
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        switchUser,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
