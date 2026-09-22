'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  User,
  Shield,
  Tag,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  Check,
  RefreshCw,
  History,
  FileCode,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { AuditLog, AvailableTransition, Ticket, TicketState } from '@/lib/types';
import { formatDate, getPriorityBadge, getRoleBadge, getStateBadge } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowStepper } from '@/components/ui/stepper';
import { TransitionDialog } from '@/components/TransitionDialog';
import { AuditTimeline } from '@/components/AuditTimeline';
import { cn } from '@/lib/utils';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = Number(params.id);
  const { user } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [transitions, setTransitions] = useState<AvailableTransition[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransition, setSelectedTransition] = useState<AvailableTransition | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchTicketData = async () => {
    if (!ticketId || isNaN(ticketId)) return;
    setLoading(true);
    try {
      const [ticketData, nextTransitions, auditData] = await Promise.all([
        api.getTicket(ticketId),
        api.getNextTransitions(ticketId),
        api.getAuditTrail(ticketId),
      ]);
      setTicket(ticketData);
      setTransitions(nextTransitions || []);
      setAuditLogs(auditData || []);
    } catch (err) {
      console.error('Failed to load ticket details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketData();
  }, [ticketId]);

  const handleOpenTransition = (trans: AvailableTransition) => {
    setSelectedTransition(trans);
    setIsDialogOpen(true);
  };

  const handleExecuteTransition = async (
    targetState: TicketState,
    comment: string,
    metadataPatch: Record<string, any>
  ): Promise<Ticket> => {
    const updated = await api.transitionTicket(ticketId, {
      target_state: targetState,
      comment: comment || undefined,
      metadata_patch: Object.keys(metadataPatch).length > 0 ? metadataPatch : undefined,
    });
    // Refresh all data
    await fetchTicketData();
    return updated;
  };

  if (loading && !ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-xs text-slate-400">Loading ticket workspace...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <h3 className="text-sm font-semibold text-white">Ticket Not Found</h3>
        <p className="text-xs text-slate-400">The requested ticket does not exist or you do not have permission to view it.</p>
        <Link href="/dashboard">
          <Button size="sm" variant="secondary" className="gap-2 mt-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Button>
        </Link>
      </div>
    );
  }

  const stateBadge = getStateBadge(ticket.current_state);
  const priorityBadge = getPriorityBadge(ticket.priority);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Queue</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchTicketData} isLoading={loading} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Ticket Header Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-sm font-bold text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-700/50">
                {ticket.ticket_number}
              </span>
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold border', stateBadge.bg, stateBadge.text, stateBadge.border)}>
                {stateBadge.label}
              </span>
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5', priorityBadge.bg, priorityBadge.text)}>
                <span className={cn('h-2 w-2 rounded-full', priorityBadge.dot)} />
                {priorityBadge.label} Priority
              </span>
              {ticket.department && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                  <Tag className="h-3 w-3 text-slate-400" />
                  {ticket.department.name}
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-white tracking-tight">{ticket.title}</h1>
          </div>

          {/* Dynamic Workflow Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {transitions.length === 0 ? (
              <div className="text-xs text-slate-500 italic px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                No active transitions available for current state
              </div>
            ) : (
              transitions.map((trans) => {
                const isApprove = trans.to_state === 'APPROVED';
                const isReject = trans.to_state === 'REJECTED';

                let variant: 'primary' | 'success' | 'destructive' | 'secondary' = 'primary';
                if (isApprove) variant = 'success';
                if (isReject) variant = 'destructive';

                return (
                  <Button
                    key={trans.step_id}
                    size="sm"
                    variant={variant}
                    disabled={!trans.is_allowed}
                    onClick={() => handleOpenTransition(trans)}
                    className="gap-1.5 text-xs font-semibold shadow-md"
                    title={trans.is_allowed ? `Advance to ${trans.to_state}` : trans.reason || 'Not Authorized'}
                  >
                    {isApprove ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isReject ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    <span>{trans.name}</span>
                  </Button>
                );
              })
            )}
          </div>
        </div>

        {/* FSM Status Stepper Bar */}
        <div className="pt-4 border-t border-slate-800/80">
          <WorkflowStepper currentState={ticket.current_state} />
        </div>
      </div>

      {/* Main Content Grid: Description & Metadata on Left, Timestamps & Audit on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Description & Metadata */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Description */}
          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm text-slate-200">Requisition & Issue Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          {/* Dynamic Metadata JSON Table */}
          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <FileCode className="h-4 w-4 text-indigo-400" />
                <span>Workflow Metadata & Custom Attributes</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(ticket.metadata_payload || {}).length === 0 ? (
                <p className="text-xs text-slate-500 italic">No custom metadata payload attached.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(ticket.metadata_payload).map(([k, v]) => (
                    <div key={k} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                      <span className="font-mono text-indigo-400 font-semibold">{k}</span>
                      <div className="text-slate-200 font-medium mt-1 truncate">
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Append-Only Visual Audit Trail */}
          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-400" />
                <span>Append-Only Immutable Audit Trail</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTimeline logs={auditLogs} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Routing, Stakeholders & Lifecycle Timestamps */}
        <div className="space-y-6">
          {/* Stakeholders & Routing Card */}
          <Card className="bg-slate-900/70 border-slate-800 space-y-4">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm text-slate-200">Stakeholder Routing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {/* Creator */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Initiated By</span>
                  <p className="text-xs font-semibold text-slate-200">{ticket.creator?.full_name || 'Employee'}</p>
                  <p className="text-[10px] text-slate-400">{ticket.creator?.email || ''}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-emerald-950/80 border border-emerald-700/50 flex items-center justify-center text-emerald-400 text-xs font-bold">
                  {ticket.creator?.full_name?.charAt(0) || 'C'}
                </div>
              </div>

              {/* Assignee */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Assigned Queue Specialist</span>
                  <p className="text-xs font-semibold text-slate-200">
                    {ticket.assignee?.full_name || 'Unassigned (Department Pool)'}
                  </p>
                  <p className="text-[10px] text-slate-400">{ticket.assignee?.email || 'Awaiting Triage'}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-400 text-xs font-bold">
                  {ticket.assignee?.full_name?.charAt(0) || '?'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lifecycle Timestamps */}
          <Card className="bg-slate-900/70 border-slate-800 space-y-3">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <span>Lifecycle Milestones</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Created:</span>
                <span className="text-slate-200 font-mono text-[11px]">{formatDate(ticket.created_at)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Last Modified:</span>
                <span className="text-slate-200 font-mono text-[11px]">{formatDate(ticket.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Resolved At:</span>
                <span className="text-slate-200 font-mono text-[11px]">{formatDate(ticket.resolved_at)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Closed At:</span>
                <span className="text-slate-200 font-mono text-[11px]">{formatDate(ticket.closed_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Interactive Transition Modal */}
      {selectedTransition && (
        <TransitionDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedTransition(null);
          }}
          ticket={ticket}
          transition={selectedTransition}
          onSuccess={(updated) => setTicket(updated)}
          onExecute={handleExecuteTransition}
        />
      )}
    </div>
  );
}
