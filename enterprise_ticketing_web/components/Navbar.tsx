'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Plus,
  LogOut,
  Search,
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  Wifi,
  WifiOff,
  Clock,
  AlertTriangle,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useWebSocket } from '@/lib/useWebSocket';
import { RoleSwitcher } from './RoleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { QuickTicketModal } from './QuickTicketModal';
import { Button } from './ui/button';
import { getRoleBadge, getPriorityBadge } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const { isConnected, notifications, unreadCount, markAsRead, markAllAsRead, clearAll } =
    useWebSocket();

  // Listen for open-quick-ticket-modal custom event from anywhere
  useEffect(() => {
    const handleOpenModal = () => setQuickModalOpen(true);
    window.addEventListener('open-quick-ticket-modal', handleOpenModal);
    return () => window.removeEventListener('open-quick-ticket-modal', handleOpenModal);
  }, []);

  // Handle Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('navbar-quick-search');
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close notification popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      router.push(`/dashboard?search=${encodeURIComponent(quickSearch.trim())}`);
    }
  };

  const roleBadge = user ? getRoleBadge(user.role) : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30 group-hover:shadow-glow group-hover:scale-105 transition-all">
              <Layers className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground tracking-tight">NexusFlow</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 font-mono">
                ENTERPRISE
              </span>
            </div>
          </Link>

          {/* Quick Search Command Trigger */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative">
            <div
              className={cn(
                'flex items-center h-8 w-64 lg:w-80 rounded-lg border px-2.5 transition-all duration-150',
                searchFocused
                  ? 'border-primary bg-card ring-1 ring-primary/40'
                  : 'border-border bg-card/60 hover:border-zinc-500'
              )}
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
              <input
                id="navbar-quick-search"
                type="text"
                placeholder="Search tickets, IDs, or audit records..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono text-muted-foreground select-none">
                <span className="text-[9px]">⌘</span>K
              </kbd>
            </div>
          </form>
        </div>

        {/* Right: Notification Bell, Theme Toggle, Role Switcher, New Ticket & User Menu */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Real-time WebSocket Notification Bell */}
          <div className="relative" ref={notifDropdownRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              title={isConnected ? 'Live WebSocket Connected' : 'Connecting to Live Stream...'}
              className={cn(
                'relative p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center',
                notifOpen
                  ? 'bg-card border-primary/50 text-foreground ring-1 ring-primary/30'
                  : 'bg-card/60 border-border text-muted-foreground hover:text-foreground hover:bg-card'
              )}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-background animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">Live Activity Stream</span>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                        isConnected
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      )}
                    >
                      {isConnected ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Live
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Offline
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {notifications.length > 0 && (
                      <>
                        <button
                          onClick={markAllAsRead}
                          title="Mark all as read"
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={clearAll}
                          title="Clear all"
                          className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-muted text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Notification Items List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center px-4">
                      <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-xs font-medium text-foreground">No recent events</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Real-time ticket updates and SLA notifications will appear here.
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isBreach = n.type === 'SLA_BREACH';
                      const isInternal = n.is_internal;

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            markAsRead(n.id);
                            if (n.ticket_id) {
                              setNotifOpen(false);
                              router.push(`/tickets/${n.ticket_id}`);
                            }
                          }}
                          className={cn(
                            'p-3 hover:bg-muted/40 transition-colors cursor-pointer text-left relative',
                            !n.read && 'bg-primary/5',
                            isBreach && 'border-l-2 border-rose-500',
                            isInternal && 'border-l-2 border-amber-500'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              {isInternal ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <Lock className="h-2.5 w-2.5" /> Staff Only
                                </span>
                              ) : isBreach ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <AlertTriangle className="h-2.5 w-2.5" /> SLA Breach
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-muted text-foreground border border-border">
                                  {n.ticket_number}
                                </span>
                              )}
                              {n.department_code && (
                                <span className="text-[9px] font-bold text-muted-foreground">
                                  [{n.department_code}]
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {n.receivedAt
                                ? new Date(n.receivedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>

                          <p className="text-xs text-foreground font-medium line-clamp-2">
                            {n.message}
                          </p>

                          {n.actor_name && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              By <span className="font-semibold text-foreground">{n.actor_name}</span>
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme Mode & Palette Quick Toggle */}
          <ThemeToggle />

          {/* Persona / Role Simulator */}
          <RoleSwitcher />

          {/* Quick Ticket CTA */}
          <Button
            size="sm"
            variant="primary"
            onClick={() => setQuickModalOpen(true)}
            className="gap-1.5 font-semibold"
            title="Create quick ticket (Ctrl + N)"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quick Ticket</span>
            <kbd className="hidden lg:inline-flex items-center px-1 py-0.2 rounded bg-primary-foreground/20 text-[9px] font-mono select-none">
              ⌘N
            </kbd>
          </Button>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted border border-border text-foreground font-semibold text-xs">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                {/* Live Status Dot */}
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background',
                    isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                />
              </div>

              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold text-foreground leading-none truncate max-w-[120px]">
                  {user?.full_name || 'User'}
                </p>
                {roleBadge && (
                  <p className={cn('text-[10px] font-medium leading-tight mt-0.5', roleBadge.text)}>
                    {roleBadge.label}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-muted-foreground hover:text-rose-400 hover:bg-muted rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Universal Quick-Create Ticket Modal */}
      <QuickTicketModal
        isOpen={quickModalOpen}
        onClose={() => setQuickModalOpen(false)}
      />
    </header>
  );
}
