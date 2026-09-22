'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, Plus, LogOut, User as UserIcon, Bell } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { RoleSwitcher } from './RoleSwitcher';
import { Button } from './ui/button';

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                NexusFlow
                <span className="rounded bg-indigo-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-700/50">
                  Enterprise
                </span>
              </span>
              <p className="text-[10px] text-slate-400 leading-none">Workflow & Ticketing Automation</p>
            </div>
          </Link>
        </div>

        {/* Right: Actions, Role Switcher, New Ticket & Profile */}
        <div className="flex items-center gap-3">
          <RoleSwitcher />

          <Link href="/tickets/new">
            <Button size="sm" variant="primary" className="gap-1.5 shadow-indigo-600/30">
              <Plus className="h-4 w-4" />
              <span>New Ticket</span>
            </Button>
          </Link>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-slate-200 leading-none">{user?.full_name || 'User'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{user?.email || ''}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
