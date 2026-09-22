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
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Department, Ticket, TicketPriority, TicketState } from '@/lib/types';
import { TicketCard } from '@/components/TicketCard';
import { EmailTaskWidget } from '@/components/EmailTaskWidget';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getRoleBadge } from '@/lib/utils';
import { cn } from '@/lib/utils';


export default function DashboardPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const deptFilter = searchParams.get('dept');
  const viewFilter = searchParams.get('view');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');

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
        t.description.toLowerCase().includes(q)
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">
              {user?.role === 'REQUESTER' && 'Employee Service Portal'}
              {user?.role === 'ASSIGNEE' && 'Department Execution Queue'}
              {user?.role === 'AUTHORIZER' && 'Director Authorization Console'}
              {user?.role === 'OBSERVER' && 'Compliance & Audit Oversight'}
              {user?.role === 'ADMIN' && 'Enterprise Operations Control'}
            </h1>
            {roleBadge && (
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold border', roleBadge.bg, roleBadge.text, roleBadge.border)}>
                {roleBadge.label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {user?.role === 'REQUESTER' && 'Track and manage your submitted requests, drafts, and confirmations.'}
            {user?.role === 'ASSIGNEE' && 'Execute assigned tasks, perform triage, and advance tickets across workflow steps.'}
            {user?.role === 'AUTHORIZER' && 'Review clearance requisitions, approve budgets, and enforce governance gates.'}
            {user?.role === 'OBSERVER' && 'Read-only visibility for corporate audit logs, SLA monitoring, and compliance.'}
            {user?.role === 'ADMIN' && 'Full system visibility, workflow configuration, and administrative overrides.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchDashboardData} isLoading={loading} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
          <Link href="/tickets/new">
            <Button size="sm" variant="primary" className="gap-1.5 shadow-indigo-600/30">
              <Plus className="h-4 w-4" />
              <span>Create Request</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* AI Email Ingestion & Actionable Tasks Widget */}
      <EmailTaskWidget onTicketCreated={fetchDashboardData} />

      {/* Role-Tailored Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Metric 1 */}
        <Card className="p-4 bg-slate-900/80 border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">
              {user?.role === 'REQUESTER' ? 'My Total Requests' : 'Active Queue Volume'}
            </p>
            <h3 className="text-2xl font-bold text-white mt-1">{totalCount}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950/80 border border-indigo-700/50 text-indigo-400">
            <Inbox className="h-5 w-5" />
          </div>
        </Card>

        {/* Metric 2: Approvals */}
        <Card className="p-4 bg-slate-900/80 border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">
              {user?.role === 'AUTHORIZER' ? 'Pending Your Sign-Off' : 'Pending Approvals'}
            </p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{pendingApprovalsCount}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-950/80 border border-amber-700/50 text-amber-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </Card>

        {/* Metric 3: In Progress */}
        <Card className="p-4 bg-slate-900/80 border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">In Active Execution</p>
            <h3 className="text-2xl font-bold text-indigo-400 mt-1">{inProgressCount}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950/80 border border-indigo-700/50 text-indigo-400">
            <Clock className="h-5 w-5" />
          </div>
        </Card>

        {/* Metric 4: Resolved / Critical */}
        <Card className="p-4 bg-slate-900/80 border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">
              {criticalCount > 0 ? 'Urgent / Critical Gates' : 'Resolved & Closed'}
            </p>
            <h3 className={cn('text-2xl font-bold mt-1', criticalCount > 0 ? 'text-rose-400' : 'text-emerald-400')}>
              {criticalCount > 0 ? criticalCount : resolvedCount}
            </h3>
          </div>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl border',
              criticalCount > 0
                ? 'bg-rose-950/80 border-rose-700/50 text-rose-400'
                : 'bg-emerald-950/80 border-emerald-700/50 text-emerald-400'
            )}
          >
            {criticalCount > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap',
              activeTab === 'all' && !viewFilter
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            All Tickets ({tickets.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap',
              activeTab === 'pending'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            Pending / Triage ({pendingApprovalsCount})
          </button>
          <button
            onClick={() => setActiveTab('in_progress')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap',
              activeTab === 'in_progress'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            In Progress ({inProgressCount})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap',
              activeTab === 'resolved'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search ticket number, title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-700 bg-slate-950 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Ticket List View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs text-slate-400">Loading department queue...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
          <Inbox className="h-10 w-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No tickets found in this queue</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search term or clearing filters.'
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
