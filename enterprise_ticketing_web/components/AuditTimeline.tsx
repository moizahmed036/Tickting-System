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
  Clock,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Send,
  Loader2,
  Paperclip,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuditAction, AuditLog } from '@/lib/types';
import { formatDate, formatTimeAgo, getRoleBadge } from '@/lib/utils';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface AuditTimelineProps {
  ticketId: number;
  logs: AuditLog[];
  onCommentAdded?: () => void;
  readOnly?: boolean;
}

export function AuditTimeline({
  ticketId,
  logs,
  onCommentAdded,
  readOnly = false,
}: AuditTimelineProps) {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const isStaff = user && ['ASSIGNEE', 'AUTHORIZER', 'ADMIN'].includes(user.role);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      setSubmitting(true);
      await api.addComment(ticketId, {
        comment: commentText.trim(),
        is_internal: isStaff ? isInternal : false,
      });
      setCommentText('');
      toast.success(
        isInternal ? 'Internal staff note recorded.' : 'Public comment posted successfully.'
      );
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const getActionIcon = (action: AuditAction, internal?: boolean) => {
    if (internal) {
      return <Lock className="h-3.5 w-3.5 text-amber-400" />;
    }
    switch (action) {
      case 'CREATED':
        return <FilePlus className="h-3.5 w-3.5 text-emerald-400" />;
      case 'APPROVED':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case 'REJECTED':
        return <XCircle className="h-3.5 w-3.5 text-rose-400" />;
      case 'ASSIGNED':
        return <UserPlus className="h-3.5 w-3.5 text-sky-400" />;
      case 'FIELD_UPDATED':
        return <Edit3 className="h-3.5 w-3.5 text-amber-400" />;
      case 'STATE_TRANSITION':
        return <ArrowRight className="h-3.5 w-3.5 text-primary" />;
      case 'ATTACHMENT_ADDED':
        return <Paperclip className="h-3.5 w-3.5 text-indigo-400" />;
      case 'ATTACHMENT_DELETED':
        return <XCircle className="h-3.5 w-3.5 text-rose-400" />;
      default:
        return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: AuditAction, internal?: boolean) => {
    if (internal) {
      return {
        label: 'Internal Staff Note',
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold',
      };
    }
    switch (action) {
      case 'CREATED':
        return { label: 'Ticket Ingested', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' };
      case 'APPROVED':
        return { label: 'Executive Approved', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'REJECTED':
        return { label: 'Requisition Rejected', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
      case 'ASSIGNED':
        return { label: 'Assignee Allocated', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/25' };
      case 'FIELD_UPDATED':
        return { label: 'Attributes Modified', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/25' };
      case 'STATE_TRANSITION':
        return { label: 'State Transition', bg: 'bg-primary/15 text-primary border-primary/30' };
      case 'ATTACHMENT_ADDED':
        return { label: 'Document Attached', bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' };
      case 'ATTACHMENT_DELETED':
        return { label: 'Attachment Removed', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/25' };
      case 'COMMENT_ADDED':
        return { label: 'Communication Comment', bg: 'bg-muted text-foreground border-border' };
      default:
        return { label: action, bg: 'bg-muted text-muted-foreground border-border' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Comment Composer */}
      {!readOnly && (
        <form
          onSubmit={handlePostComment}
          className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              Add Activity Comment
            </h4>

            {/* Visibility Mode Switcher (Staff Only) */}
            {isStaff ? (
              <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => setIsInternal(false)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer',
                    !isInternal
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Eye className="h-3 w-3 text-primary" />
                  Public Reply
                </button>
                <button
                  type="button"
                  onClick={() => setIsInternal(true)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer',
                    isInternal
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                      : 'text-muted-foreground hover:text-amber-400'
                  )}
                >
                  <Lock className="h-3 w-3" />
                  Internal Note (Staff Only)
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3 text-primary" /> Public requester comment
              </span>
            )}
          </div>

          {/* Confidential Notice for Internal Notes */}
          {isInternal && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>
                Staff-Only Privacy: This note is strictly confidential and filtered out from the ticket requester.
              </span>
            </div>
          )}

          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={
              isInternal
                ? 'Type confidential internal note or agent handover diagnostics...'
                : 'Type a message to update the ticket history or communicate with the requester...'
            }
            rows={3}
            className={cn(
              'w-full rounded-lg border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none transition-all resize-none',
              isInternal
                ? 'border-amber-500/40 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40'
                : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/40'
            )}
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Supports markdown formatting & bullet points
            </span>
            <Button
              type="submit"
              size="sm"
              variant={isInternal ? 'outline' : 'primary'}
              disabled={submitting || !commentText.trim()}
              className={cn(
                'gap-1.5 text-xs font-semibold',
                isInternal && 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
              )}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>{isInternal ? 'Save Internal Note' : 'Post Comment'}</span>
            </Button>
          </div>
        </form>
      )}

      {/* Chronological Timeline */}
      {!logs || logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">
          <History className="h-6 w-6 mx-auto mb-2 opacity-40" />
          No audit events recorded yet for this ticket.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2.5 before:bottom-2.5 before:w-[2px] before:bg-border">
          {logs.map((log) => {
            const isInternalLog = log.is_internal === true;
            const actionBadge = getActionBadge(log.action, isInternalLog);
            const roleBadge = log.actor ? getRoleBadge(log.actor.role) : null;
            const isExpanded = expandedId === log.id;
            const hasPayload = log.payload && Object.keys(log.payload).length > 0;

            return (
              <div key={log.id} className="relative group">
                {/* Timeline Dot Icon */}
                <div
                  className={cn(
                    'absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border shadow-md ring-2 ring-background',
                    isInternalLog ? 'border-amber-500/50 bg-amber-500/10' : 'border-border'
                  )}
                >
                  {getActionIcon(log.action, isInternalLog)}
                </div>

                {/* Event Content Card */}
                <div
                  className={cn(
                    'rounded-xl border p-3.5 transition-all shadow-sm',
                    isInternalLog
                      ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60'
                      : 'border-border bg-card/60 hover:bg-card hover:border-border/80'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1',
                            actionBadge.bg
                          )}
                        >
                          {isInternalLog && <Lock className="h-2.5 w-2.5" />}
                          {actionBadge.label}
                        </span>

                        {log.from_state && log.to_state && (
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-mono">
                            <span className="px-1.5 py-0.2 rounded bg-muted text-muted-foreground text-[10px] border border-border">
                              {log.from_state}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                              {log.to_state}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actor Info */}
                      <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground text-[11px]">
                          {log.actor?.full_name || 'System Auto-Engine'}
                        </span>
                        {roleBadge && (
                          <span
                            className={cn(
                              'px-1.5 py-0.2 rounded text-[10px] font-semibold border',
                              roleBadge.bg,
                              roleBadge.text,
                              roleBadge.border
                            )}
                          >
                            {roleBadge.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {formatTimeAgo(log.created_at)}
                      </span>
                      <p className="text-[9px] font-mono text-muted-foreground/70">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Comment Text */}
                  {log.comment && (
                    <div
                      className={cn(
                        'mt-2.5 p-2.5 rounded-lg border text-xs leading-relaxed whitespace-pre-wrap',
                        isInternalLog
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          : 'bg-muted/40 border-border text-foreground'
                      )}
                    >
                      {log.comment}
                    </div>
                  )}

                  {/* Expandable JSON Payload & Diffs */}
                  {hasPayload && (
                    <div className="mt-2.5 pt-2 border-t border-border/60">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium transition-colors cursor-pointer"
                      >
                        <span>
                          {isExpanded
                            ? 'Hide Payload Diffs'
                            : 'View Recorded Payload & State Changes'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-2.5 rounded-lg bg-muted border border-border font-mono text-[11px] text-foreground overflow-x-auto">
                          <pre className="text-foreground">{JSON.stringify(log.payload, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
