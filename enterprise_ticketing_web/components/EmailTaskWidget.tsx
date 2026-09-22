'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { EmailTaskItem, PendingEmailsResponse } from '@/lib/types';
import {
  Mail,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  ChevronDown,
  ChevronUp,
  Tag,
  Flame,
  Check,
  Building2,
  Inbox,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailTaskWidgetProps {
  onTicketCreated?: () => void;
}

export const EmailTaskWidget: React.FC<EmailTaskWidgetProps> = ({ onTicketCreated }) => {
  const [data, setData] = useState<PendingEmailsResponse>({
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    normal_count: 0,
    total_pending: 0,
    items: [],
  });

  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, string | null>>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchPendingEmails = useCallback(async (isManualSync = false) => {
    try {
      if (isManualSync) setSyncing(true);
      const res = await api.getEmailPendingActions();
      setData(res);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Failed to fetch pending email tasks:', err);
    } finally {
      setLoading(false);
      if (isManualSync) setSyncing(false);
    }
  }, []);

  // Polling every 60 seconds
  useEffect(() => {
    fetchPendingEmails();
    const interval = setInterval(() => {
      fetchPendingEmails();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchPendingEmails]);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleConvertToTicket = async (emailId: string) => {
    try {
      setActionLoading((prev) => ({ ...prev, [emailId]: 'convert' }));
      const res = await api.convertEmailToTicket(emailId);
      showToast(`Created Ticket ${res.ticket_number} (${res.department_code})`, 'success');

      // Optimistically remove from state
      setData((prev) => {
        const remaining = prev.items.filter((item) => item.id !== emailId);
        return {
          ...prev,
          total_pending: remaining.length,
          critical_count: remaining.filter((i) => i.priority === 'CRITICAL').length,
          high_count: remaining.filter((i) => i.priority === 'HIGH').length,
          medium_count: remaining.filter((i) => i.priority === 'MEDIUM').length,
          normal_count: remaining.filter((i) => i.priority === 'NORMAL').length,
          items: remaining,
        };
      });

      if (onTicketCreated) {
        onTicketCreated();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to convert email to ticket', 'info');
    } finally {
      setActionLoading((prev) => ({ ...prev, [emailId]: null }));
    }
  };

  const handleMarkResolved = async (emailId: string) => {
    try {
      setActionLoading((prev) => ({ ...prev, [emailId]: 'resolve' }));
      await api.markEmailResolved(emailId);
      showToast('Email task dismissed as completed', 'info');

      // Optimistically remove
      setData((prev) => {
        const remaining = prev.items.filter((item) => item.id !== emailId);
        return {
          ...prev,
          total_pending: remaining.length,
          critical_count: remaining.filter((i) => i.priority === 'CRITICAL').length,
          high_count: remaining.filter((i) => i.priority === 'HIGH').length,
          medium_count: remaining.filter((i) => i.priority === 'MEDIUM').length,
          normal_count: remaining.filter((i) => i.priority === 'NORMAL').length,
          items: remaining,
        };
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to mark email resolved', 'info');
    } finally {
      setActionLoading((prev) => ({ ...prev, [emailId]: null }));
    }
  };

  const filteredItems = data.items.filter((item) => {
    if (filterPriority === 'ALL') return true;
    return item.priority === filterPriority;
  });

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return {
          badge: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
          border: 'border-l-rose-500',
          dot: 'bg-rose-500',
        };
      case 'HIGH':
        return {
          badge: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
          border: 'border-l-amber-500',
          dot: 'bg-amber-500',
        };
      case 'MEDIUM':
        return {
          badge: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400',
          border: 'border-l-yellow-500',
          dot: 'bg-yellow-500',
        };
      default:
        return {
          badge: 'bg-blue-500/10 border-blue-500/25 text-blue-400',
          border: 'border-l-blue-500',
          dot: 'bg-blue-500',
        };
    }
  };

  const getDeptColor = (dept: string) => {
    switch (dept) {
      case 'IT':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'FIN':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'HR':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'SD':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'PROC':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const formatRelativeTime = (timestampStr: string) => {
    try {
      const dt = new Date(timestampStr);
      const diffMs = Date.now() - dt.getTime();
      const diffMins = Math.max(1, Math.floor(diffMs / 60000));
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return 'recent';
    }
  };

  return (
    <div className="relative bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 lg:p-5 shadow-xl backdrop-blur-xl mb-6 overflow-hidden transition-all">
      {/* Subtle ambient lighting */}
      <div className="absolute top-0 right-1/4 w-80 h-24 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-72 h-20 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Toast Alert */}
      {toastMessage && (
        <div className="mb-4 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500/30 text-emerald-300 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-[10px] uppercase font-bold tracking-wider cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-sm shadow-indigo-600/30 text-white shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">AI Email Ingestion & Smart Triage</h2>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                Live NLP
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Inbound messages triaged with entity extraction and 1-click ticket generation.
            </p>
          </div>
        </div>

        {/* Sync & Timestamp Controls */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-600" />
            Synced {formatRelativeTime(lastUpdated.toISOString())}
          </span>
          <button
            onClick={() => fetchPendingEmails(true)}
            disabled={syncing}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Scan inbox now"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin text-indigo-400' : 'text-zinc-400'}`} />
            <span>{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* Metric Pill Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 py-3">
        <button
          onClick={() => setFilterPriority('ALL')}
          className={cn(
            'flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer select-none',
            filterPriority === 'ALL'
              ? 'bg-zinc-800 border-zinc-700 text-white font-semibold shadow-sm'
              : 'bg-zinc-950/60 border-zinc-850 text-zinc-400 hover:bg-zinc-850/60'
          )}
        >
          <span className="flex items-center gap-1.5 text-[11px]">
            <Inbox className="w-3.5 h-3.5 text-zinc-500" />
            All Actions
          </span>
          <span className="px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-300 font-mono text-[10px] font-bold border border-zinc-800">
            {data.total_pending}
          </span>
        </button>

        <button
          onClick={() => setFilterPriority('CRITICAL')}
          className={cn(
            'flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer select-none',
            filterPriority === 'CRITICAL'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 font-semibold'
              : 'bg-zinc-950/60 border-zinc-850 text-zinc-400 hover:bg-zinc-850/60'
          )}
        >
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
            </span>
            Critical
          </span>
          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-mono text-[10px] font-bold">
            {data.critical_count}
          </span>
        </button>

        <button
          onClick={() => setFilterPriority('HIGH')}
          className={cn(
            'flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer select-none',
            filterPriority === 'HIGH'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
              : 'bg-zinc-950/60 border-zinc-850 text-zinc-400 hover:bg-zinc-850/60'
          )}
        >
          <span className="flex items-center gap-1.5 text-[11px]">
            <Flame className="w-3 h-3 text-amber-400" />
            High
          </span>
          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
            {data.high_count}
          </span>
        </button>

        <button
          onClick={() => setFilterPriority('MEDIUM')}
          className={cn(
            'flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer select-none',
            filterPriority === 'MEDIUM'
              ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300 font-semibold'
              : 'bg-zinc-950/60 border-zinc-850 text-zinc-400 hover:bg-zinc-850/60'
          )}
        >
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            Medium
          </span>
          <span className="px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-400 font-mono text-[10px] font-bold">
            {data.medium_count}
          </span>
        </button>

        <button
          onClick={() => setFilterPriority('NORMAL')}
          className={cn(
            'flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer select-none',
            filterPriority === 'NORMAL'
              ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 font-semibold'
              : 'bg-zinc-950/60 border-zinc-850 text-zinc-400 hover:bg-zinc-850/60'
          )}
        >
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Normal
          </span>
          <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-mono text-[10px] font-bold">
            {data.normal_count}
          </span>
        </button>
      </div>

      {/* Actionable Email Cards */}
      <div className="space-y-2 pt-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-500 mb-2" />
            <span className="text-xs">Analyzing incoming mailboxes with AI...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl border border-dashed border-zinc-800 text-center bg-zinc-950/40">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
              <Check className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-zinc-200">Inbox Zero Reached</h4>
            <p className="text-[11px] text-zinc-500 max-w-sm mt-0.5">
              {filterPriority !== 'ALL'
                ? `No pending ${filterPriority.toLowerCase()} priority email action items detected.`
                : 'All inbound messages have been converted into active tickets or resolved.'}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const style = getPriorityStyle(item.priority);
            const isExpanded = expandedId === item.id;
            const isConverting = actionLoading[item.id] === 'convert';
            const isResolving = actionLoading[item.id] === 'resolve';

            return (
              <div
                key={item.id}
                className={`bg-zinc-950/80 border border-zinc-850 rounded-xl p-3.5 transition-all hover:border-zinc-750 border-l-4 ${style.border} group`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  {/* Left Metadata & AI Summary */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border uppercase tracking-wider ${style.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {item.priority}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getDeptColor(
                          item.suggested_department
                        )}`}
                      >
                        <Building2 className="w-3 h-3" />
                        Queue: {item.suggested_department}
                      </span>

                      <span className="text-[11px] text-zinc-400">
                        From: <span className="text-zinc-200 font-medium">{item.sender_name}</span> ({item.sender})
                      </span>

                      <span className="text-[10px] font-mono text-zinc-500 ml-auto md:ml-0">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    {/* AI Summary */}
                    <div className="flex items-start gap-2 mt-1.5">
                      <div className="mt-0.5 shrink-0 text-indigo-400 bg-indigo-500/10 p-1 rounded border border-indigo-500/20">
                        <Sparkles className="w-3 h-3" />
                      </div>
                      <p className="text-xs font-semibold text-zinc-100 leading-snug">
                        {item.summary}
                      </p>
                    </div>

                    {/* Original Subject */}
                    <p className="text-[11px] text-zinc-400 mt-1 pl-6">
                      <span className="text-zinc-500 font-mono text-[10px]">RE:</span> {item.subject}
                    </p>

                    {/* Expandable Body Snippet */}
                    {isExpanded && (
                      <div className="mt-2.5 pl-6 pt-2 border-t border-zinc-850 text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80 animate-fade-in font-mono text-[11px]">
                        <p className="font-mono text-[10px] text-zinc-500 uppercase mb-1">Email Body Content:</p>
                        {item.body}
                      </div>
                    )}
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end md:self-center shrink-0 pt-1 md:pt-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded-lg text-xs transition cursor-pointer"
                      title={isExpanded ? 'Collapse' : 'Expand full body'}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => handleMarkResolved(item.id)}
                      disabled={isResolving || isConverting}
                      className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-[11px] font-medium transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      title="Dismiss from pending tasks"
                    >
                      {isResolving ? 'Resolving...' : 'Dismiss'}
                    </button>

                    <button
                      onClick={() => handleConvertToTicket(item.id)}
                      disabled={isConverting || isResolving}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold shadow-sm shadow-indigo-600/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      title="Convert directly to an official system Ticket"
                    >
                      {isConverting ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Converting...</span>
                        </>
                      ) : (
                        <>
                          <span>Convert to Ticket</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
