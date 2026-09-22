'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Sparkles,
  ArrowRight,
  LayoutGrid,
  Table as TableIcon,
  Tag,
  User,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Flame,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Department, Ticket, TicketPriority, TicketState } from '@/lib/types';
import { TicketCard } from '@/components/TicketCard';
import { EmailTaskWidget } from '@/components/EmailTaskWidget';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate, formatTimeAgo, getPriorityBadge, getRoleBadge, getStateBadge } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const deptFilter = searchParams.get('dept');
  const viewFilter = searchParams.get('view');
  const urlSearch = searchParams.get('search');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(urlSearch || '');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  
  // UI Preferences: View mode & Row density
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const deptsRes = await api.getDepartments();
      setDepartments(deptsRes || []);

      const selectedDeptObj = deptFilter ? deptsRes.find((d) => d.code === deptFilter) : undefined;

      const ticketsRes = await api.getTickets({
        search: searchQuery || undefined,
        department_id: selectedDeptObj?.id,
        my_queue: viewFilter === 'my_tasks',
        limit: 50,
      });
      setTickets(ticketsRes.items || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [deptFilter, viewFilter]);

  // Sync search input if URL search changes
  useEffect(() => {
    if (urlSearch !== null) {
      setSearchQuery(urlSearch);
    }
  }, [urlSearch]);

  // Scoped filtering based on Department URL parameter
  let filteredTickets = tickets;
  if (deptFilter) {
    const selectedDept = departments.find((d) => d.code === deptFilter);
    if (selectedDept) {
      filteredTickets = filteredTickets.filter((t) => t.department_id === selectedDept.id);
    }
  }

  // Handle My Tasks view
  if (viewFilter === 'my_tasks' && user) {
    filteredTickets = filteredTickets.filter(
      (t) => t.assignee_id === user.id || t.creator_id === user.id
    );
  }

  // Quick Tab Filtering
  if (viewFilter === 'approvals') {
    filteredTickets = filteredTickets.filter((t) => t.current_state === 'PENDING_APPROVAL');
  } else if (activeTab === 'pending') {
    filteredTickets = filteredTickets.filter((t) =>
      ['SUBMITTED', 'PENDING_APPROVAL'].includes(t.current_state)
    );
  } else if (activeTab === 'in_progress') {
    filteredTickets = filteredTickets.filter((t) => t.current_state === 'IN_PROGRESS');
  } else if (activeTab === 'resolved') {
    filteredTickets = filteredTickets.filter((t) =>
      ['RESOLVED', 'CLOSED'].includes(t.current_state)
    );
  }

  // Search Filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filteredTickets = filteredTickets.filter(
      (t) =>
        t.ticket_number.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.department?.name && t.department.name.toLowerCase().includes(q))
    );
  }

  // Role Specific Metric Counters
  const totalCount = tickets.length;
  const pendingApprovalsCount = tickets.filter((t) => t.current_state === 'PENDING_APPROVAL').length;
  const inProgressCount = tickets.filter((t) => t.current_state === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.current_state)).length;
  const criticalCount = tickets.filter((t) => t.priority === 'CRITICAL' || t.priority === 'URGENT').length;

  const roleBadge = user ? getRoleBadge(user.role) : null;

  return (
    <div className="space-y-5">
      {/* Top Banner & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-white tracking-tight">
              {user?.role === 'REQUESTER' && 'Personnel Service Hub'}
              {user?.role === 'ASSIGNEE' && 'Operational Execution Queue'}
              {user?.role === 'AUTHORIZER' && 'Executive Decision Console'}
              {user?.role === 'OBSERVER' && 'Compliance & Risk Oversight'}
              {user?.role === 'ADMIN' && 'Enterprise System Orchestration'}
            </h1>
            {roleBadge && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                  roleBadge.bg,
                  roleBadge.text,
                  roleBadge.border
                )}
              >
                {roleBadge.label}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {user?.role === 'REQUESTER' && 'Submit, monitor, and track service requisitions across organization queues.'}
            {user?.role === 'ASSIGNEE' && 'Execute assigned tasks, conduct diagnostic triage, and advance state transitions.'}
            {user?.role === 'AUTHORIZER' && 'Authorizations gate: approve department disbursements and requisition clearances.'}
            {user?.role === 'OBSERVER' && 'Read-only access for compliance audit trails, SLAs, and performance metrics.'}
            {user?.role === 'ADMIN' && 'Full system visibility, SLA auto-escalation scanner, and workflow overrides.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button size="sm" variant="secondary" onClick={fetchDashboardData} isLoading={loading} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
            <span>Refresh</span>
          </Button>
          <Link href="/tickets/new">
            <Button size="sm" variant="primary" className="gap-1.5 font-semibold">
              <Plus className="h-3.5 w-3.5" />
              <span>Create Ticket</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* AI Email Ingestion & Actionable Tasks Widget */}
      <EmailTaskWidget onTicketCreated={fetchDashboardData} />

      {/* Metric KPI Cards with Linear-style gradient borders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Queue Volume */}
        <div className="group relative rounded-xl border border-zinc-800/90 bg-zinc-900/60 p-4 transition-all duration-150 hover:border-zinc-750 hover:bg-zinc-850/60">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-400">
              {user?.role === 'REQUESTER' ? 'My Active Requests' : 'Total Queue Volume'}
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Inbox className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-2xl font-bold text-white tracking-tight font-mono">{totalCount}</h3>
            <span className="text-[11px] text-zinc-500 flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3 text-emerald-400" /> Live
            </span>
          </div>
        </div>

        {/* Metric 2: Pending Approvals / Triage */}
        <div className="group relative rounded-xl border border-zinc-800/90 bg-zinc-900/60 p-4 transition-all duration-150 hover:border-zinc-750 hover:bg-zinc-850/60">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-400">
              {user?.role === 'AUTHORIZER' ? 'Requires Your Sign-Off' : 'Pending Approvals'}
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-2xl font-bold text-amber-400 tracking-tight font-mono">{pendingApprovalsCount}</h3>
            <span className="text-[10px] text-amber-400/80 font-mono">Governance Gate</span>
          </div>
        </div>

        {/* Metric 3: In Progress */}
        <div className="group relative rounded-xl border border-zinc-800/90 bg-zinc-900/60 p-4 transition-all duration-150 hover:border-zinc-750 hover:bg-zinc-850/60">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-400">In Active Execution</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-2xl font-bold text-indigo-400 tracking-tight font-mono">{inProgressCount}</h3>
            <span className="text-[10px] text-indigo-400/80 font-mono">Specialists Active</span>
          </div>
        </div>

        {/* Metric 4: Critical / Resolved */}
        <div className="group relative rounded-xl border border-zinc-800/90 bg-zinc-900/60 p-4 transition-all duration-150 hover:border-zinc-750 hover:bg-zinc-850/60">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-400">
              {criticalCount > 0 ? 'Urgent / SLA Breaches' : 'Resolved & Closed'}
            </p>
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg border',
                criticalCount > 0
                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-400 shadow-glow-rose'
                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              )}
            >
              {criticalCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3
              className={cn(
                'text-2xl font-bold tracking-tight font-mono',
                criticalCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              )}
            >
              {criticalCount > 0 ? criticalCount : resolvedCount}
            </h3>
            <span
              className={cn(
                'text-[10px] font-mono',
                criticalCount > 0 ? 'text-rose-400/80 font-bold' : 'text-emerald-400/80'
              )}
            >
              {criticalCount > 0 ? 'Action Required' : 'Completed'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar with View Mode & Density Toggles */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap select-none',
              activeTab === 'all' && !viewFilter
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            )}
          >
            All Tickets ({tickets.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap select-none',
              activeTab === 'pending'
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            )}
          >
            Triage & Approvals ({pendingApprovalsCount})
          </button>
          <button
            onClick={() => setActiveTab('in_progress')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap select-none',
              activeTab === 'in_progress'
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            )}
          >
            In Execution ({inProgressCount})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap select-none',
              activeTab === 'resolved'
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            )}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        {/* Right: Search, View Mode & Density Toggle */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative w-full md:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter current view..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/80"
            />
          </div>

          {/* Density Toggle */}
          <button
            onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
            className="hidden sm:flex items-center gap-1 h-8 px-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-xs transition cursor-pointer"
            title={`Toggle density mode (Currently: ${density})`}
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span className="capitalize">{density}</span>
          </button>

          {/* View Mode Toggle: Table vs Grid */}
          <div className="flex items-center p-0.5 rounded-lg border border-zinc-800 bg-zinc-950 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-1.5 rounded-md transition-colors cursor-pointer',
                viewMode === 'table' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              )}
              title="Table View (Linear Data Grid)"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-md transition-colors cursor-pointer',
                viewMode === 'grid' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              )}
              title="Card Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Ticket Content: Linear Data Table vs Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs text-zinc-400">Loading queue items...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center space-y-3">
          <Inbox className="h-9 w-9 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-200">No tickets found in this queue</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {searchQuery
              ? 'No tickets match your search query. Try clearing filters or searching for another term.'
              : 'There are currently no active tickets matching the selected department and state filters.'}
          </p>
          <div className="pt-2">
            <Link href="/tickets/new">
              <Button size="sm" variant="primary">
                Create First Ticket
              </Button>
            </Link>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* ========================================================= */
        /* Linear-Style Modern Data Table                             */
        /* ========================================================= */
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-semibold text-zinc-400 font-mono uppercase tracking-wider select-none">
                  <th className="py-2.5 px-4">Ticket</th>
                  <th className="py-2.5 px-3">Title & Summary</th>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Assignee</th>
                  <th className="py-2.5 px-3 text-right">Age</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-xs">
                {filteredTickets.map((ticket) => {
                  const stateBadge = getStateBadge(ticket.current_state);
                  const priorityBadge = getPriorityBadge(ticket.priority);

                  return (
                    <tr
                      key={ticket.id}
                      className={cn(
                        'group transition-colors hover:bg-zinc-850/60',
                        density === 'compact' ? 'py-1.5' : 'py-3'
                      )}
                    >
                      {/* Ticket Number */}
                      <td className={cn('px-4 whitespace-nowrap font-mono font-bold text-indigo-400', density === 'compact' ? 'py-2' : 'py-3')}>
                        <Link href={`/tickets/${ticket.id}`} className="hover:underline">
                          {ticket.ticket_number}
                        </Link>
                      </td>

                      {/* Title & Description preview */}
                      <td className={cn('px-3 max-w-xs sm:max-w-md', density === 'compact' ? 'py-2' : 'py-3')}>
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          <p className="font-semibold text-zinc-100 group-hover:text-white truncate">
                            {ticket.title}
                          </p>
                          {density === 'comfortable' && (
                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {ticket.description}
                            </p>
                          )}
                        </Link>
                      </td>

                      {/* State Badge */}
                      <td className={cn('px-3 whitespace-nowrap', density === 'compact' ? 'py-2' : 'py-3')}>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                            stateBadge.bg,
                            stateBadge.text,
                            stateBadge.border
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', stateBadge.dot)} />
                          {stateBadge.label}
                        </span>
                      </td>

                      {/* Priority Badge */}
                      <td className={cn('px-3 whitespace-nowrap', density === 'compact' ? 'py-2' : 'py-3')}>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                            priorityBadge.bg,
                            priorityBadge.text
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', priorityBadge.dot)} />
                          {priorityBadge.label}
                        </span>
                      </td>

                      {/* Department */}
                      <td className={cn('px-3 whitespace-nowrap text-zinc-300 font-medium text-[11px]', density === 'compact' ? 'py-2' : 'py-3')}>
                        {ticket.department ? (
                          <span className="inline-flex items-center gap-1">
                            <Tag className="h-3 w-3 text-zinc-500" />
                            {ticket.department.name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Assignee Avatar */}
                      <td className={cn('px-3 whitespace-nowrap', density === 'compact' ? 'py-2' : 'py-3')}>
                        {ticket.assignee ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-zinc-300">
                              {ticket.assignee.full_name.charAt(0)}
                            </div>
                            <span className="text-zinc-300 text-[11px] truncate max-w-[100px]">
                              {ticket.assignee.full_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-500 italic">Unassigned Pool</span>
                        )}
                      </td>

                      {/* Relative Time */}
                      <td className={cn('px-3 text-right whitespace-nowrap font-mono text-[10px] text-zinc-500', density === 'compact' ? 'py-2' : 'py-3')}>
                        {formatTimeAgo(ticket.created_at)}
                      </td>

                      {/* Action Chevron */}
                      <td className={cn('px-3 text-right whitespace-nowrap', density === 'compact' ? 'py-2' : 'py-3')}>
                        <Link href={`/tickets/${ticket.id}`}>
                          <button className="p-1 rounded-md text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 transition cursor-pointer">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* Card Grid View                                            */
        /* ========================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
