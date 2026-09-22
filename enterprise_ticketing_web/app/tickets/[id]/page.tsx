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
  Layers,
  Copy,
  CheckCheck,
  Building2,
  Server,
  FileText,
  Paperclip,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { AuditLog, AvailableTransition, Ticket, TicketState } from '@/lib/types';
import { formatDate, formatTimeAgo, getPriorityBadge, getRoleBadge, getStateBadge } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowStepper } from '@/components/ui/stepper';
import { TransitionDialog } from '@/components/TransitionDialog';
import { AuditTimeline } from '@/components/AuditTimeline';
import { TicketAttachments } from '@/components/TicketAttachments';
import { cn } from '@/lib/utils';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = Number(params.id);
  const { user } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [transitions, setTransitions] = useState<AvailableTransition[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [attachmentCount, setAttachmentCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedTransition, setSelectedTransition] = useState<AvailableTransition | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'attributes' | 'attachments' | 'audit'>('overview');
  const [copied, setCopied] = useState(false);

  const fetchTicketData = async () => {
    if (!ticketId || isNaN(ticketId)) return;
    setLoading(true);
    try {
      const [ticketData, nextTransitions, auditData, attachData] = await Promise.all([
        api.getTicket(ticketId),
        api.getNextTransitions(ticketId),
        api.getAuditTrail(ticketId),
        api.getAttachments(ticketId).catch(() => ({ items: [], total: 0 })),
      ]);
      setTicket(ticketData);
      setTransitions(nextTransitions || []);
      setAuditLogs(auditData || []);
      setAttachmentCount(attachData.total || attachData.items?.length || 0);
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
    await fetchTicketData();
    return updated;
  };

  const handleCopyTicketNumber = () => {
    if (ticket?.ticket_number) {
      navigator.clipboard.writeText(ticket.ticket_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading && !ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground font-medium">Loading ticket workspace...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-12 text-center space-y-3">
        <AlertCircle className="h-9 w-9 text-rose-500 mx-auto" />
        <h3 className="text-sm font-semibold text-foreground">Ticket Not Found</h3>
        <p className="text-xs text-muted-foreground">
          The requested ticket does not exist or you do not have permission to view it.
        </p>
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
    <div className="space-y-5">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Queue</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={fetchTicketData} isLoading={loading} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Ticket Header & FSM Action Banner */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Ticket Key Badge */}
              <button
                onClick={handleCopyTicketNumber}
                className="group flex items-center gap-1 font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 hover:bg-primary/20 transition cursor-pointer"
                title="Click to copy ticket ID"
              >
                <span>{ticket.ticket_number}</span>
                {copied ? (
                  <CheckCheck className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3 text-primary opacity-60 group-hover:opacity-100" />
                )}
              </button>

              {/* State Badge */}
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-flex items-center gap-1.5',
                  stateBadge.bg,
                  stateBadge.text,
                  stateBadge.border
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', stateBadge.dot)} />
                {stateBadge.label}
              </span>

              {/* Priority Badge */}
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1.5 border',
                  priorityBadge.bg,
                  priorityBadge.text
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', priorityBadge.dot)} />
                {priorityBadge.label} Priority
              </span>

              {/* Department Tag */}
              {ticket.department && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-foreground border border-border flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  {ticket.department.name}
                </span>
              )}
            </div>

            <h1 className="text-lg font-bold text-foreground tracking-tight">{ticket.title}</h1>
          </div>

          {/* Dynamic Workflow Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {transitions.length === 0 ? (
              <div className="text-xs text-muted-foreground italic px-3 py-1.5 rounded-lg bg-muted/40 border border-border">
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
                    className="gap-1.5 text-xs font-semibold"
                    title={trans.is_allowed ? `Advance to ${trans.to_state}` : trans.reason || 'Unauthorized'}
                  >
                    {isApprove ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : isReject ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>{trans.name}</span>
                  </Button>
                );
              })
            )}
          </div>
        </div>

        {/* FSM Status Stepper Bar */}
        <div className="pt-3 border-t border-border">
          <WorkflowStepper currentState={ticket.current_state} />
        </div>
      </div>

      {/* Main Tabbed Layout & Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Columns: Tabbed Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs Control */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-card border border-border overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none whitespace-nowrap',
                activeTab === 'overview'
                  ? 'bg-muted text-foreground font-semibold border border-border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span>Overview & Context</span>
            </button>

            <button
              onClick={() => setActiveTab('attachments')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none whitespace-nowrap',
                activeTab === 'attachments'
                  ? 'bg-muted text-foreground font-semibold border border-border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Paperclip className="h-3.5 w-3.5 text-primary" />
              <span>Attachments & Evidence ({attachmentCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('attributes')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none whitespace-nowrap',
                activeTab === 'attributes'
                  ? 'bg-muted text-foreground font-semibold border border-border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <FileCode className="h-3.5 w-3.5 text-primary" />
              <span>JSON Attributes ({Object.keys(ticket.metadata_payload || {}).length})</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none whitespace-nowrap',
                activeTab === 'audit'
                  ? 'bg-muted text-foreground font-semibold border border-border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <History className="h-3.5 w-3.5 text-primary" />
              <span>Activity & Comments ({auditLogs.length})</span>
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-fade-in">
              {/* Description Card */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-xs text-foreground font-mono uppercase tracking-wider">
                    Requisition Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
                    {ticket.description}
                  </p>
                </CardContent>
              </Card>

              {/* Technical Attributes Preview */}
              {ticket.metadata_payload && Object.keys(ticket.metadata_payload).length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs text-foreground font-mono uppercase tracking-wider">
                      Core Attributes & Payload
                    </CardTitle>
                    <button
                      onClick={() => setActiveTab('attributes')}
                      className="text-[11px] text-primary hover:underline"
                    >
                      View All
                    </button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(ticket.metadata_payload).slice(0, 4).map(([k, v]) => (
                        <div key={k} className="p-2.5 rounded-lg bg-muted/50 border border-border text-xs">
                          <span className="font-mono text-primary font-semibold">{k}</span>
                          <div className="text-foreground font-medium mt-0.5 truncate">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Tab 2: Attachments & Evidence */}
          {activeTab === 'attachments' && (
            <Card className="bg-card border-border animate-fade-in">
              <CardContent className="pt-6">
                <TicketAttachments ticketId={ticketId} />
              </CardContent>
            </Card>
          )}

          {/* Tab 3: Custom JSON Attributes */}
          {activeTab === 'attributes' && (
            <Card className="bg-card border-border animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs text-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-primary" />
                  <span>Structured Decision Payload</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.keys(ticket.metadata_payload || {}).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4">No custom metadata payload attached.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(ticket.metadata_payload).map(([k, v]) => (
                        <div key={k} className="p-3 rounded-lg bg-muted/50 border border-border text-xs">
                          <span className="font-mono text-primary font-semibold">{k}</span>
                          <div className="text-foreground font-medium mt-1 truncate">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">Raw JSON Object:</p>
                      <pre className="p-3 rounded-lg bg-muted border border-border font-mono text-[11px] text-foreground overflow-x-auto">
                        {JSON.stringify(ticket.metadata_payload, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tab 4: Append-Only Immutable Audit Trail & Comments */}
          {activeTab === 'audit' && (
            <Card className="bg-card border-border animate-fade-in">
              <CardHeader>
                <CardTitle className="text-xs text-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-primary" />
                  <span>Activity Timeline & Private Notes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AuditTimeline ticketId={ticketId} logs={auditLogs} onCommentAdded={fetchTicketData} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar: Routing, Stakeholders & Lifecycle */}
        <div className="space-y-4">
          {/* Stakeholder Routing Card */}
          <Card className="bg-card border-border space-y-3">
            <CardHeader className="pb-0">
              <CardTitle className="text-xs text-foreground font-mono uppercase tracking-wider">
                Stakeholder Routing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-2">
              {/* Creator */}
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground font-mono">Requester</span>
                  <p className="text-xs font-semibold text-foreground">
                    {ticket.creator?.full_name || 'Enterprise Employee'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{ticket.creator?.email || ''}</p>
                </div>
                <div className="h-7 w-7 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 text-xs font-bold">
                  {ticket.creator?.full_name?.charAt(0) || 'R'}
                </div>
              </div>

              {/* Assignee */}
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground font-mono">
                    Queue Specialist
                  </span>
                  <p className="text-xs font-semibold text-foreground">
                    {ticket.assignee?.full_name || 'Unassigned (Department Pool)'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{ticket.assignee?.email || 'Awaiting Allocation'}</p>
                </div>
                <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-primary text-xs font-bold">
                  {ticket.assignee?.full_name?.charAt(0) || '?'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lifecycle Milestones */}
          <Card className="bg-card border-border space-y-2">
            <CardHeader className="pb-0">
              <CardTitle className="text-xs text-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Lifecycle Milestones</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border">
                <span className="text-muted-foreground text-[11px]">Created:</span>
                <span className="text-foreground font-mono text-[10px]">{formatDate(ticket.created_at)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border">
                <span className="text-muted-foreground text-[11px]">Last Updated:</span>
                <span className="text-foreground font-mono text-[10px]">{formatDate(ticket.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border">
                <span className="text-muted-foreground text-[11px]">Resolved At:</span>
                <span className="text-foreground font-mono text-[10px]">{formatDate(ticket.resolved_at)}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground text-[11px]">Closed At:</span>
                <span className="text-foreground font-mono text-[10px]">{formatDate(ticket.closed_at)}</span>
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
