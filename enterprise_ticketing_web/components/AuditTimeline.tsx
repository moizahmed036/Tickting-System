'use client';

import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  ArrowRight,
  UserPlus,
  Edit3,
  FilePlus,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AuditAction, AuditLog } from '@/lib/types';
import { formatDate, getRoleBadge, getStateBadge } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-xs">
        <History className="h-6 w-6 mx-auto mb-2 opacity-50" />
        No audit events recorded yet.
      </div>
    );
  }

  const getActionIcon = (action: AuditAction) => {
    switch (action) {
      case 'CREATED':
        return <FilePlus className="h-4 w-4 text-emerald-400" />;
      case 'APPROVED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-rose-400" />;
      case 'ASSIGNED':
        return <UserPlus className="h-4 w-4 text-sky-400" />;
      case 'FIELD_UPDATED':
        return <Edit3 className="h-4 w-4 text-amber-400" />;
      case 'STATE_TRANSITION':
        return <ArrowRight className="h-4 w-4 text-indigo-400" />;
      default:
        return <MessageSquare className="h-4 w-4 text-slate-400" />;
    }
  };

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'CREATED':
        return { label: 'Ticket Created', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' };
      case 'APPROVED':
        return { label: 'Authorization Approved', bg: 'bg-emerald-950 text-emerald-300 border-emerald-600' };
      case 'REJECTED':
        return { label: 'Authorization Rejected', bg: 'bg-rose-950 text-rose-300 border-rose-600' };
      case 'ASSIGNED':
        return { label: 'Assignee Updated', bg: 'bg-sky-950 text-sky-300 border-sky-700' };
      case 'FIELD_UPDATED':
        return { label: 'Attributes Modified', bg: 'bg-amber-950 text-amber-300 border-amber-700' };
      case 'STATE_TRANSITION':
        return { label: 'State Transition', bg: 'bg-indigo-950 text-indigo-300 border-indigo-700' };
      default:
        return { label: action, bg: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
      {logs.map((log) => {
        const actionBadge = getActionBadge(log.action);
        const roleBadge = log.actor ? getRoleBadge(log.actor.role) : null;
        const isExpanded = expandedId === log.id;
        const hasPayload = log.payload && Object.keys(log.payload).length > 0;

        return (
          <div key={log.id} className="relative group">
            {/* Timeline Dot Icon */}
            <div className="absolute -left-6 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 border border-slate-700 shadow-md">
              {getActionIcon(log.action)}
            </div>

            {/* Event Card */}
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 transition-all hover:border-slate-700">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', actionBadge.bg)}>
                      {actionBadge.label}
                    </span>

                    {log.from_state && log.to_state && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                          {log.from_state}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-500" />
                        <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[10px] font-bold">
                          {log.to_state}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actor Info */}
                  <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">{log.actor?.full_name || 'System Auto-Engine'}</span>
                    {roleBadge && (
                      <span className={cn('px-1.5 py-0.2 rounded text-[10px]', roleBadge.bg, roleBadge.text)}>
                        {roleBadge.label}
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 font-medium">
                  {formatDate(log.created_at)}
                </span>
              </div>

              {/* Justification Comment */}
              {log.comment && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 italic">
                  &ldquo;{log.comment}&rdquo;
                </div>
              )}

              {/* Expandable Payload / Diffs */}
              {hasPayload && (
                <div className="mt-3 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Payload Diff' : 'View Event Payload & Diffs'}</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                      <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
