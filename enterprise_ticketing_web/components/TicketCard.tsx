'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, User, ArrowRight, Tag, AlertTriangle } from 'lucide-react';
import { Ticket } from '@/lib/types';
import { formatDate, getPriorityBadge, getStateBadge } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const stateBadge = getStateBadge(ticket.current_state);
  const priorityBadge = getPriorityBadge(ticket.priority);

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="group block rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/40 p-4 transition-all duration-200 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-indigo-400 group-hover:text-indigo-300">
              {ticket.ticket_number}
            </span>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', stateBadge.bg, stateBadge.text, stateBadge.border)}>
              {stateBadge.label}
            </span>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1.5', priorityBadge.bg, priorityBadge.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', priorityBadge.dot)} />
              {priorityBadge.label}
            </span>
          </div>

          <h4 className="text-sm font-semibold text-slate-100 group-hover:text-white truncate">
            {ticket.title}
          </h4>

          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {ticket.description}
          </p>
        </div>

        <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          {ticket.department && (
            <span className="flex items-center gap-1 text-slate-300">
              <Tag className="h-3 w-3 text-slate-500" />
              {ticket.department.name}
            </span>
          )}
          {ticket.assignee && (
            <span className="flex items-center gap-1 text-slate-300">
              <User className="h-3 w-3 text-slate-500" />
              {ticket.assignee.full_name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-slate-500">
          <Clock className="h-3 w-3" />
          <span>{formatDate(ticket.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
