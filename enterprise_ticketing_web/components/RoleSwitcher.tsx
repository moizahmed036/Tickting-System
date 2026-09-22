'use client';

import React, { useState } from 'react';
import { Shield, ChevronDown, Check, Sparkles } from 'lucide-react';
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card/80 hover:bg-muted text-xs font-medium text-foreground transition-all cursor-pointer shadow-sm select-none"
      >
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="text-muted-foreground text-[11px] hidden sm:inline">Role:</span>
        {currentRoleBadge ? (
          <span className={cn('px-1.5 py-0.2 rounded text-[11px] font-semibold border', currentRoleBadge.bg, currentRoleBadge.text, currentRoleBadge.border)}>
            {currentRoleBadge.label}
          </span>
        ) : (
          <span className="text-foreground">Select Role</span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-150', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-popover/95 backdrop-blur-xl p-2 shadow-2xl z-50 animate-fade-in">
            <div className="px-3 py-2 border-b border-border/80 mb-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  RBAC Persona Switcher
                </p>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">Interactive</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                Instantly simulate permissions across organizational roles and department queues.
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 py-1 pr-1">
              {SEED_ACCOUNTS.map((acc) => {
                const isSelected = user?.email === acc.email;
                const badge = getRoleBadge(acc.role);

                return (
                  <button
                    key={acc.email}
                    onClick={() => handleSwitch(acc)}
                    className={cn(
                      'w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-start justify-between group cursor-pointer border',
                      isSelected
                        ? 'bg-muted border-border text-foreground font-semibold shadow-sm'
                        : 'border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {acc.label}
                        </span>
                        <span className={cn('px-1.5 py-0.2 rounded text-[10px] font-semibold border', badge.bg, badge.text, badge.border)}>
                          {acc.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{acc.description}</p>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />}
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
