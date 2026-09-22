'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, User, ArrowRight, Tag, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Ticket } from '@/lib/types';
import { formatTimeAgo, getPriorityBadge, getStateBadge } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const stateBadge = getStateBadge(ticket.current_state);
  const priorityBadge = getPriorityBadge(ticket.priority);

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="group block rounded-xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-850/70 p-4 transition-all duration-150 hover:border-zinc-700 hover:shadow-lg hover:shadow-black/40 cursor-pointer relative overflow-hidden"
    >
      {/* Ambient Top Glow Line on Hover */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/0 to-transparent group-hover:via-indigo-500/40 transition-all duration-300" />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-indigo-400 group-hover:text-indigo-300">
              {ticket.ticket_number}
            </span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                stateBadge.bg,
                stateBadge.text,
                stateBadge.border
              )}
            >
              {stateBadge.label}
            </span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1.5 border',
                priorityBadge.bg,
                priorityBadge.text
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', priorityBadge.dot)} />
              {priorityBadge.label}
            </span>
          </div>

          <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-white truncate">
            {ticket.title}
          </h4>

          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
            {ticket.description}
          </p>
        </div>

        <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </div>

      <div className="mt-3.5 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
        <div className="flex items-center gap-3">
          {ticket.department && (
            <span className="flex items-center gap-1 text-zinc-300 font-medium">
              <Tag className="h-3 w-3 text-zinc-500" />
              {ticket.department.name}
            </span>
          )}
          {ticket.assignee && (
            <span className="flex items-center gap-1 text-zinc-400">
              <User className="h-3 w-3 text-zinc-500" />
              {ticket.assignee.full_name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-zinc-500 font-mono text-[10px]">
          <Clock className="h-3 w-3" />
          <span>{formatTimeAgo(ticket.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
