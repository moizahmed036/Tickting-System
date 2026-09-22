'use client';

import React, { useState } from 'react';
import { Shield, ChevronDown, Check, UserCheck, Sparkles } from 'lucide-react';
import { SEED_ACCOUNTS, SeedAccount, useAuth } from '@/lib/auth';
import { getRoleBadge } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function RoleSwitcher() {
  const { user, switchUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleSwitch = async (account: SeedAccount) => {
    setSwitching(true);
    try {
      await switchUser(account);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to switch role:', err);
    } finally {
      setSwitching(false);
    }
  };

  const currentRoleBadge = user ? getRoleBadge(user.role) : null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-200 transition-all shadow-sm cursor-pointer"
      >
        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
        <span className="text-slate-400">Role:</span>
        {currentRoleBadge ? (
          <span className={cn('px-2 py-0.5 rounded font-semibold text-[11px]', currentRoleBadge.bg, currentRoleBadge.text)}>
            {currentRoleBadge.label}
          </span>
        ) : (
          <span className="text-slate-300">Select Role</span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-2 border-b border-slate-800 mb-1">
              <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-indigo-400" />
                Quick Role & Persona Switcher
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Simulate different RBAC permissions & queue authorizations.
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 py-1">
              {SEED_ACCOUNTS.map((acc) => {
                const isSelected = user?.email === acc.email;
                const badge = getRoleBadge(acc.role);

                return (
                  <button
                    key={acc.email}
                    onClick={() => handleSwitch(acc)}
                    className={cn(
                      'w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-start justify-between group cursor-pointer',
                      isSelected ? 'bg-indigo-950/70 border border-indigo-700/50 text-white' : 'hover:bg-slate-800 text-slate-300'
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {acc.label}
                        </span>
                        <span className={cn('px-1.5 py-0.2 rounded text-[10px]', badge.bg, badge.text)}>
                          {acc.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{acc.description}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
