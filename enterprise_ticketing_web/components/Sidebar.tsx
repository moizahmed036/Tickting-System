'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Server,
  DollarSign,
  Users,
  Briefcase,
  ShoppingCart,
  CheckCircle,
  Inbox,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  ListTodo,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Department } from '@/lib/types';
import { cn } from '@/lib/utils';

export const ALL_DEPARTMENT_NAV_ITEMS = [
  { id: 'all', name: 'All Organization Queues', icon: Inbox, code: null },
  { id: 'IT', name: 'IT Infrastructure', icon: Server, code: 'IT' },
  { id: 'FIN', name: 'Finance & Budget', icon: DollarSign, code: 'FIN' },
  { id: 'HR', name: 'Recruitment & HR', icon: Users, code: 'HR' },
  { id: 'SD', name: 'ESU / Service Delivery', icon: Briefcase, code: 'SD' },
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
  const userDeptCode = userDept?.code || (user?.department_id === 1 ? 'SD' : user?.department_id === 2 ? 'HR' : user?.department_id === 3 ? 'FIN' : user?.department_id === 4 ? 'FIN' : user?.department_id === 5 ? 'PROC' : user?.department_id === 6 ? 'IT' : null);

  // Compute allowed department items
  const visibleDeptItems = isAdmin
    ? ALL_DEPARTMENT_NAV_ITEMS
    : ALL_DEPARTMENT_NAV_ITEMS.filter((item) => item.code && item.code === userDeptCode);

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950/60 p-4 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="space-y-6">
        {/* Main Navigation */}
        <div>
          <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Navigation</p>
          <div className="space-y-1">
            <Link
              href="/dashboard"
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                pathname === '/dashboard' && !currentDept && !currentView
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-600/30 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>{isAdmin ? 'Overview Dashboard' : 'My Dashboard'}</span>
            </Link>

            {/* My Tasks View for operational roles */}
            {(isAssignee || isRequester) && (
              <Link
                href="/dashboard?view=my_tasks"
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  currentView === 'my_tasks'
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-600/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                )}
              >
                <ListTodo className="h-4 w-4 text-cyan-400" />
                <span>{isRequester ? 'My Requests' : 'My Assigned Tasks'}</span>
              </Link>
            )}

            {/* Director Approvals Gate */}
            {isAuthorizer && (
              <Link
                href="/dashboard?view=approvals"
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  currentView === 'approvals'
                    ? 'bg-amber-600/15 text-amber-400 border border-amber-600/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="h-4 w-4 text-amber-400" />
                  <span>Director Approvals</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/80 border border-amber-700/50 text-amber-300 font-bold">
                  Gate
                </span>
              </Link>
            )}

            {/* Super Admin User Management */}
            {isAdmin && (
              <Link
                href="/admin/users"
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  pathname.startsWith('/admin')
                    ? 'bg-purple-600/15 text-purple-300 border border-purple-600/40 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-purple-400" />
                  <span>Admin User Manager</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/80 border border-purple-700/50 text-purple-300 font-bold">
                  Admin
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Department Queues (Strictly isolated for non-admins) */}
        {visibleDeptItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {isAdmin ? 'Department Queues' : 'Assigned Department'}
              </p>
              {!isAdmin && (
                <span className="text-[9px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.2 rounded">
                  Isolated
                </span>
              )}
            </div>
            <div className="space-y-1">
              {visibleDeptItems.map((dept) => {
                const Icon = dept.icon;
                const isActive = dept.code ? currentDept === dept.code : !currentDept && !currentView && pathname === '/dashboard';

                return (
                  <Link
                    key={dept.id}
                    href={dept.code ? `/dashboard?dept=${dept.code}` : '/dashboard'}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all',
                      isActive
                        ? 'bg-slate-800/90 text-white border border-slate-700 font-semibold shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-indigo-400' : 'text-slate-400')} />
                      <span className="truncate">{dept.name}</span>
                    </div>
                    {dept.code && (
                      <span className="text-[10px] text-slate-400 px-1 py-0.5 rounded bg-slate-900 border border-slate-800">
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

      {/* Role Notice & Security Footer */}
      <div className="pt-4 border-t border-slate-800/80">
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-slate-200">
              {isAdmin ? 'Super Admin Mode' : 'Department Isolation Active'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
              {isAdmin
                ? 'Full cross-department visibility and role governance active.'
                : 'Access is restricted to your assigned department boundary.'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
