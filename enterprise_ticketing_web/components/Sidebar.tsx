'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Server,
  DollarSign,
  Users,
  Briefcase,
  ShoppingCart,
  CheckCircle,
  Inbox,
  ShieldAlert,
  ShieldCheck,
  ListTodo,
  Sparkles,
  ChevronRight,
  Lock,
  Key,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Department } from '@/lib/types';
import { cn } from '@/lib/utils';

export const ALL_DEPARTMENT_NAV_ITEMS = [
  { id: 'all', name: 'All Department Queues', icon: Inbox, code: null },
  { id: 'IT', name: 'IT Infrastructure', icon: Server, code: 'IT' },
  { id: 'FIN', name: 'Finance & Budget', icon: DollarSign, code: 'FIN' },
  { id: 'HR', name: 'Recruitment & HR', icon: Users, code: 'HR' },
  { id: 'SD', name: 'Service Delivery', icon: Briefcase, code: 'SD' },
  { id: 'PROC', name: 'Procurement', icon: ShoppingCart, code: 'PROC' },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentDept = searchParams.get('dept');
  const currentView = searchParams.get('view');
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    api.getDepartments()
      .then((data) => setDepartments(data))
      .catch((err) => console.error('Failed to load departments in sidebar:', err));
  }, []);

  const isAdmin = user?.role === 'ADMIN';
  const isAuthorizer = user?.role === 'AUTHORIZER' || isAdmin;
  const isAssignee = user?.role === 'ASSIGNEE';
  const isRequester = user?.role === 'REQUESTER';

  // Resolve user's assigned department
  const userDept = departments.find((d) => d.id === user?.department_id);
  const userDeptCode =
    userDept?.code ||
    (user?.department_id === 1
      ? 'SD'
      : user?.department_id === 2
      ? 'HR'
      : user?.department_id === 3
      ? 'FIN'
      : user?.department_id === 4
      ? 'FIN'
      : user?.department_id === 5
      ? 'PROC'
      : user?.department_id === 6
      ? 'IT'
      : null);

  // Compute allowed department items
  const visibleDeptItems = isAdmin
    ? ALL_DEPARTMENT_NAV_ITEMS
    : ALL_DEPARTMENT_NAV_ITEMS.filter((item) => item.code && item.code === userDeptCode);

  return (
    <aside className="w-60 border-r border-border bg-card/40 p-3 flex flex-col justify-between shrink-0 min-h-[calc(100vh-3.5rem)] select-none">
      <div className="space-y-5">
        {/* Section 1: Main Views */}
        <div>
          <p className="px-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 font-mono">
            Workspace
          </p>
          <div className="space-y-0.5">
            {/* Overview / Dashboard */}
            <Link
              href="/dashboard"
              className={cn(
                'group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                pathname === '/dashboard' && !currentDept && !currentView
                  ? 'bg-primary/10 text-primary font-semibold shadow-sm border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    pathname === '/dashboard' && !currentDept && !currentView
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                <span>{isAdmin ? 'System Overview' : 'My Dashboard'}</span>
              </div>
              {pathname === '/dashboard' && !currentDept && !currentView && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
              )}
            </Link>

            {/* Executive Analytics Hub */}
            <Link
              href="/analytics"
              className={cn(
                'group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                pathname === '/analytics'
                  ? 'bg-primary/10 text-primary font-semibold shadow-sm border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <div className="flex items-center gap-2.5">
                <BarChart3
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    pathname === '/analytics'
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                <span>Executive Analytics</span>
              </div>
              {pathname === '/analytics' && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
              )}
            </Link>

            {/* My Tasks / Requests View */}
            {(isAssignee || isRequester) && (
              <Link
                href="/dashboard?view=my_tasks"
                className={cn(
                  'group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                  currentView === 'my_tasks'
                    ? 'bg-primary/10 text-primary font-semibold shadow-sm border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <ListTodo
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      currentView === 'my_tasks' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <span>{isRequester ? 'My Requests' : 'My Assigned Queue'}</span>
                </div>
                {currentView === 'my_tasks' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
                )}
              </Link>
            )}

            {/* Director Approvals Gate */}
            {isAuthorizer && (
              <Link
                href="/dashboard?view=approvals"
                className={cn(
                  'group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                  currentView === 'approvals'
                    ? 'bg-amber-500/10 text-amber-500 dark:text-amber-300 font-semibold border border-amber-500/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      currentView === 'approvals' ? 'text-amber-500' : 'text-muted-foreground group-hover:text-amber-500'
                    )}
                  />
                  <span>Executive Authorizations</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold">
                  Gate
                </span>
              </Link>
            )}

            {/* Admin Management */}
            {isAdmin && (
              <>
                <Link
                  href="/admin/users"
                  className={cn(
                    'group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                    pathname === '/admin/users'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300 font-semibold border border-purple-500/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        pathname === '/admin/users' ? 'text-purple-500' : 'text-muted-foreground group-hover:text-purple-500'
                      )}
                    />
                    <span>User Governance</span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400 font-semibold">
                    Admin
                  </span>
                </Link>

                <Link
                  href="/admin/api-keys"
                  className={cn(
                    'group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                    pathname === '/admin/api-keys'
                      ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 font-semibold border border-cyan-500/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Key
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        pathname === '/admin/api-keys' ? 'text-cyan-500' : 'text-muted-foreground group-hover:text-cyan-500'
                      )}
                    />
                    <span>API & Integrations</span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-semibold">
                    Gateway
                  </span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Section 2: Department Queues */}
        {visibleDeptItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2.5 mb-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                {isAdmin ? 'Department Queues' : 'Assigned Department'}
              </p>
              {!isAdmin && (
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded font-mono">
                  Isolated
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              {visibleDeptItems.map((dept) => {
                const Icon = dept.icon;
                const isActive = dept.code
                  ? currentDept === dept.code
                  : !currentDept && !currentView && pathname === '/dashboard';

                return (
                  <Link
                    key={dept.id}
                    href={dept.code ? `/dashboard?dept=${dept.code}` : '/dashboard'}
                    className={cn(
                      'group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                        )}
                      />
                      <span className="truncate">{dept.name}</span>
                    </div>
                    {dept.code && (
                      <span className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground px-1 py-0.2 rounded bg-muted border border-border">
                        {dept.code}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Security & Role Policy Footer */}
      <div className="pt-3 border-t border-border">
        <div className="p-2.5 rounded-xl bg-muted/50 border border-border flex items-start gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-foreground">
              {isAdmin ? 'Super Admin Mode' : 'Department Scope Active'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              {isAdmin
                ? 'Full cross-department oversight and overrides enabled.'
                : 'Role isolation enforces queue boundary permissions.'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
