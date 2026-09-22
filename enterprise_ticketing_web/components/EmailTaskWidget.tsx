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
} from 'lucide-react';

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
      showToast('Email task marked as resolved', 'info');

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
          badge: 'bg-red-500/15 border-red-500/40 text-red-400',
          border: 'border-l-red-500',
          dot: 'bg-red-500',
        };
      case 'HIGH':
        return {
          badge: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
          border: 'border-l-amber-500',
          dot: 'bg-amber-500',
        };
      case 'MEDIUM':
        return {
          badge: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400',
          border: 'border-l-yellow-500',
          dot: 'bg-yellow-500',
        };
      default:
        return {
          badge: 'bg-blue-500/15 border-blue-500/40 text-blue-400',
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
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
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
    <div className="relative bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 md:p-6 shadow-2xl backdrop-blur-xl mb-8 overflow-hidden transition-all">
      {/* Decorative ambient background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-80 h-28 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Toast Alert */}
      {toastMessage && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs uppercase tracking-wider font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Metric Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">AI Email Ingestion & Actionable Tasks</h2>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Live Triage
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Autonomous inbox ingestion with NLP priority detection and 1-click ticket generation.
            </p>
          </div>
        </div>

        {/* Sync & Timestamp Controls */}
        <div className="flex items-center gap-3 self-end lg:self-auto">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Synced {formatRelativeTime(lastUpdated.toISOString())}
          </span>
          <button
            onClick={() => fetchPendingEmails(true)}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
            title="Scan inbox now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Metric Pill Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 py-4">
        <button
          onClick={() => setFilterPriority('ALL')}
          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
            filterPriority === 'ALL'
              ? 'bg-slate-800 border-blue-500/50 shadow-md shadow-blue-500/10 text-white font-bold'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            All Actions
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono text-[11px] font-bold">
            {data.total_pending}
          </span>
        </button>

        <button
          onClick={() => setFilterPriority('CRITICAL')}
          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
            filterPriority === 'CRITICAL'
              ? 'bg-red-950/40 border-red-500 text-red-300 font-bold shadow-md shadow-red-500/10'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Critical
          </span>
          <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-mono text-[11px] font-bold">
            {data.critical_count}
          </span>
        </button>

        <button
          onClick={() => setFilterPriority('HIGH')}
          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
            filterPriority === 'HIGH'
              ? 'bg-amber-950/40 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            High
          </span>
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-mono text-[11px] font-bold">
            {data.high_count}
          </span>
        </button>

        <button
          onClick={() => setFilterPriority('MEDIUM')}
          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
            filterPriority === 'MEDIUM'
              ? 'bg-yellow-950/40 border-yellow-500 text-yellow-300 font-bold shadow-md shadow-yellow-500/10'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            Medium
          </span>
          <span className="px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 font-mono text-[11px] font-bold">
            {data.medium_count}
          </span>
        </button>

        <button
          onClick={() => setFilterPriority('NORMAL')}
          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
            filterPriority === 'NORMAL'
              ? 'bg-blue-950/40 border-blue-500 text-blue-300 font-bold shadow-md shadow-blue-500/10'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Normal
          </span>
          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 font-mono text-[11px] font-bold">
            {data.normal_count}
          </span>
        </button>
      </div>

      {/* Actionable Email Cards Stream */}
      <div className="space-y-3 pt-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
            <span className="text-xs">Analyzing incoming mailboxes with AI...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed border-slate-800 text-center bg-slate-900/40">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2.5">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">All Caught Up!</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              {filterPriority !== 'ALL'
                ? `No pending ${filterPriority.toLowerCase()} priority email action items detected.`
                : 'No pending email action items require your attention right now.'}
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
                className={`bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 transition-all hover:border-slate-700/90 border-l-4 ${style.border} group`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  {/* Left Metadata & AI Summary */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${style.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {item.priority}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getDeptColor(
                          item.suggested_department
                        )}`}
                      >
                        <Building2 className="w-3 h-3" />
                        Dept: {item.suggested_department}
                      </span>

                      <span className="text-[11px] text-slate-400">
                        From: <span className="text-slate-200 font-medium">{item.sender_name}</span> ({item.sender})
                      </span>

                      <span className="text-[11px] text-slate-500 ml-auto md:ml-0">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    {/* AI One-Line Summary */}
                    <div className="flex items-start gap-2 mt-2">
                      <div className="mt-0.5 flex-shrink-0 text-indigo-400 bg-indigo-500/10 p-1 rounded-md border border-indigo-500/20">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-100 leading-snug">
                        {item.summary}
                      </p>
                    </div>

                    {/* Original Subject */}
                    <p className="text-xs text-slate-400 mt-1 pl-7">
                      <span className="text-slate-500 font-mono text-[10px]">RE:</span> {item.subject}
                    </p>

                    {/* Expandable Body Snippet */}
                    {isExpanded && (
                      <div className="mt-3 pl-7 pt-2 border-t border-slate-800 text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-lg border border-slate-800/80 animate-in fade-in">
                        <p className="font-mono text-[10px] text-slate-500 uppercase mb-1">Email Body Content:</p>
                        {item.body}
                      </div>
                    )}
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0 pt-2 md:pt-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-xs transition"
                      title={isExpanded ? 'Collapse' : 'Expand full body'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => handleMarkResolved(item.id)}
                      disabled={isResolving || isConverting}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 text-xs font-medium transition active:scale-95 disabled:opacity-50"
                      title="Dismiss from pending tasks"
                    >
                      {isResolving ? 'Done...' : 'Mark as Done'}
                    </button>

                    <button
                      onClick={() => handleConvertToTicket(item.id)}
                      disabled={isConverting || isResolving}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition active:scale-95 disabled:opacity-50"
                      title="Convert directly to an official system Ticket"
                    >
                      {isConverting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Converting...</span>
                        </>
                      ) : (
                        <>
                          <span>Convert to Ticket</span>
                          <ArrowRight className="w-3.5 h-3.5" />
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
