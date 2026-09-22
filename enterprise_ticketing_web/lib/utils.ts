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

export function getStateBadge(state: TicketState) {
  switch (state) {
    case 'DRAFT':
      return { label: 'Draft', bg: 'bg-slate-800/80', text: 'text-slate-300', border: 'border-slate-600' };
    case 'SUBMITTED':
      return { label: 'Submitted', bg: 'bg-sky-950/70', text: 'text-sky-300', border: 'border-sky-700' };
    case 'PENDING_APPROVAL':
      return { label: 'Pending Approval', bg: 'bg-amber-950/70', text: 'text-amber-300', border: 'border-amber-700' };
    case 'APPROVED':
      return { label: 'Approved', bg: 'bg-emerald-950/70', text: 'text-emerald-300', border: 'border-emerald-700' };
    case 'REJECTED':
      return { label: 'Rejected', bg: 'bg-rose-950/70', text: 'text-rose-300', border: 'border-rose-700' };
    case 'IN_PROGRESS':
      return { label: 'In Progress', bg: 'bg-indigo-950/70', text: 'text-indigo-300', border: 'border-indigo-700' };
    case 'RESOLVED':
      return { label: 'Resolved', bg: 'bg-teal-950/70', text: 'text-teal-300', border: 'border-teal-700' };
    case 'CLOSED':
      return { label: 'Closed', bg: 'bg-gray-800/60', text: 'text-gray-400', border: 'border-gray-700' };
    default:
      return { label: state, bg: 'bg-slate-800', text: 'text-slate-200', border: 'border-slate-700' };
  }
}

export function getPriorityBadge(priority: TicketPriority) {
  switch (priority) {
    case 'LOW':
      return { label: 'Low', bg: 'bg-slate-800', text: 'text-slate-300', dot: 'bg-slate-400' };
    case 'MEDIUM':
      return { label: 'Medium', bg: 'bg-blue-950/80', text: 'text-blue-300', dot: 'bg-blue-400' };
    case 'HIGH':
      return { label: 'High', bg: 'bg-amber-950/80', text: 'text-amber-300', dot: 'bg-amber-400' };
    case 'URGENT':
      return { label: 'Urgent', bg: 'bg-orange-950/80', text: 'text-orange-300', dot: 'bg-orange-500' };
    case 'CRITICAL':
      return { label: 'Critical', bg: 'bg-rose-950/90', text: 'text-rose-300', dot: 'bg-rose-500 animate-pulse' };
    default:
      return { label: priority, bg: 'bg-slate-800', text: 'text-slate-300', dot: 'bg-slate-400' };
  }
}

export function getRoleBadge(role: UserRole) {
  switch (role) {
    case 'ADMIN':
      return { label: 'Administrator', bg: 'bg-purple-950/80', text: 'text-purple-300', border: 'border-purple-600' };
    case 'AUTHORIZER':
      return { label: 'Authorizer / Director', bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-600' };
    case 'ASSIGNEE':
      return { label: 'Department Specialist', bg: 'bg-indigo-950/80', text: 'text-indigo-300', border: 'border-indigo-600' };
    case 'REQUESTER':
      return { label: 'Employee / Requester', bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-600' };
    case 'OBSERVER':
      return { label: 'Compliance Auditor', bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-600' };
    default:
      return { label: role, bg: 'bg-slate-800', text: 'text-slate-200', border: 'border-slate-700' };
  }
}
