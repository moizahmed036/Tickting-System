import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TicketPriority, TicketState, UserRole } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatTimeAgo(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const dt = new Date(dateString);
    const diffMs = Date.now() - dt.getTime();
    const diffMins = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  } catch {
    return 'recent';
  }
}

export function getStateBadge(state: TicketState) {
  switch (state) {
    case 'DRAFT':
      return {
        label: 'Draft',
        bg: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
        dot: 'bg-zinc-400',
        text: 'text-zinc-300',
        border: 'border-zinc-700/60',
      };
    case 'SUBMITTED':
      return {
        label: 'Submitted',
        bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        dot: 'bg-sky-400',
        text: 'text-sky-400',
        border: 'border-sky-500/20',
      };
    case 'PENDING_APPROVAL':
      return {
        label: 'Pending Approval',
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        dot: 'bg-amber-400 animate-pulse',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
      };
    case 'APPROVED':
      return {
        label: 'Approved',
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-400',
        text: 'text-emerald-400',
        border: 'border-emerald-500/20',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        dot: 'bg-rose-400',
        text: 'text-rose-400',
        border: 'border-rose-500/20',
      };
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        dot: 'bg-indigo-400 animate-pulse',
        text: 'text-indigo-400',
        border: 'border-indigo-500/20',
      };
    case 'RESOLVED':
      return {
        label: 'Resolved',
        bg: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        dot: 'bg-teal-400',
        text: 'text-teal-400',
        border: 'border-teal-500/20',
      };
    case 'CLOSED':
      return {
        label: 'Closed',
        bg: 'bg-zinc-850 text-zinc-400 border-zinc-800',
        dot: 'bg-zinc-500',
        text: 'text-zinc-400',
        border: 'border-zinc-800',
      };
    default:
      return {
        label: state,
        bg: 'bg-zinc-850 text-zinc-300 border-zinc-800',
        dot: 'bg-zinc-400',
        text: 'text-zinc-300',
        border: 'border-zinc-800',
      };
  }
}

export function getPriorityBadge(priority: TicketPriority) {
  switch (priority) {
    case 'LOW':
      return {
        label: 'Low',
        bg: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
        dot: 'bg-zinc-400',
        text: 'text-zinc-300',
      };
    case 'MEDIUM':
      return {
        label: 'Medium',
        bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        dot: 'bg-blue-400',
        text: 'text-blue-400',
      };
    case 'HIGH':
      return {
        label: 'High',
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        dot: 'bg-amber-400',
        text: 'text-amber-400',
      };
    case 'URGENT':
      return {
        label: 'Urgent',
        bg: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
        dot: 'bg-orange-500 shadow-sm shadow-orange-500',
        text: 'text-orange-400',
      };
    case 'CRITICAL':
      return {
        label: 'Critical',
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-glow-rose',
        dot: 'bg-rose-500 animate-ping',
        text: 'text-rose-400',
      };
    default:
      return {
        label: priority,
        bg: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
        dot: 'bg-zinc-400',
        text: 'text-zinc-300',
      };
  }
}

export function getRoleBadge(role: UserRole) {
  switch (role) {
    case 'ADMIN':
      return {
        label: 'Super Admin',
        bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        text: 'text-purple-400',
        border: 'border-purple-500/20',
      };
    case 'AUTHORIZER':
      return {
        label: 'Director / Authorizer',
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
      };
    case 'ASSIGNEE':
      return {
        label: 'Queue Specialist',
        bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        text: 'text-indigo-400',
        border: 'border-indigo-500/20',
      };
    case 'REQUESTER':
      return {
        label: 'Employee / Requester',
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/20',
      };
    case 'OBSERVER':
      return {
        label: 'Compliance Auditor',
        bg: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
        text: 'text-zinc-400',
        border: 'border-zinc-500/20',
      };
    default:
      return {
        label: role,
        bg: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
        text: 'text-zinc-300',
        border: 'border-zinc-700/60',
      };
  }
}
