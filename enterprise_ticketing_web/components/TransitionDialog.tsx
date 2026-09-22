'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight, Plus, Trash2, ShieldCheck, AlertCircle, Play } from 'lucide-react';
import { AvailableTransition, Ticket, TicketState } from '@/lib/types';
import { getStateBadge } from '@/lib/utils';
import { Button } from './ui/button';
import { Modal } from './ui/modal';
import { Textarea, Input } from './ui/input';

interface TransitionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket;
  transition: AvailableTransition;
  onSuccess: (updatedTicket: Ticket) => void;
  onExecute: (targetState: TicketState, comment: string, metadataPatch: Record<string, any>) => Promise<Ticket>;
}

export function TransitionDialog({
  isOpen,
  onClose,
  ticket,
  transition,
  onSuccess,
  onExecute,
}: TransitionDialogProps) {
  const [comment, setComment] = useState('');
  const [metaKey, setMetaKey] = useState('');
  const [metaValue, setMetaValue] = useState('');
  const [metadataEntries, setMetadataEntries] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetBadge = getStateBadge(transition.to_state);
  const currentBadge = getStateBadge(ticket.current_state);

  const isApproval = transition.to_state === 'APPROVED';
  const isRejection = transition.to_state === 'REJECTED';

  const handleAddMeta = () => {
    if (!metaKey.trim()) return;
    setMetadataEntries([...metadataEntries, { key: metaKey.trim(), value: metaValue.trim() }]);
    setMetaKey('');
    setMetaValue('');
  };

  const handleRemoveMeta = (index: number) => {
    setMetadataEntries(metadataEntries.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const patch: Record<string, any> = {};
    metadataEntries.forEach((entry) => {
      if (!isNaN(Number(entry.value)) && entry.value !== '') {
        patch[entry.key] = Number(entry.value);
      } else if (entry.value.toLowerCase() === 'true') {
        patch[entry.key] = true;
      } else if (entry.value.toLowerCase() === 'false') {
        patch[entry.key] = false;
      } else {
        patch[entry.key] = entry.value;
      }
    });

    try {
      const updated = await onExecute(transition.to_state, comment, patch);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to execute workflow transition');
    } finally {
      setLoading(false);
    }
  };

  let submitVariant: 'primary' | 'success' | 'destructive' = 'primary';
  if (isApproval) submitVariant = 'success';
  if (isRejection) submitVariant = 'destructive';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transition.name}
      description={`Executing workflow transition on ticket ${ticket.ticket_number}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transition State Flow Indicator */}
        <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800/80">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${currentBadge.bg} ${currentBadge.text} ${currentBadge.border}`}>
            {currentBadge.label}
          </span>
          <ArrowRight className="h-4 w-4 text-zinc-500" />
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${targetBadge.bg} ${targetBadge.text} ${targetBadge.border}`}>
            {targetBadge.label}
          </span>
        </div>

        {/* Required Role & Permission Check */}
        <div className="flex items-center justify-between text-xs px-1 text-zinc-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            Authorized Role: <strong className="text-zinc-200">{transition.required_role}</strong>
          </span>
          {transition.is_allowed ? (
            <span className="text-emerald-400 font-medium">✓ Clearance Verified</span>
          ) : (
            <span className="text-rose-400 font-medium">✗ {transition.reason || 'Unauthorized'}</span>
          )}
        </div>

        {/* Justification / Audit Comment */}
        <Textarea
          label="Audit Justification / Decision Comment"
          placeholder={
            isApproval
              ? 'e.g. Budget requisition approved within department Q1 allocation.'
              : isRejection
              ? 'e.g. Requisition rejected due to missing vendor quote documentation.'
              : 'Add required justification notes for the audit trail...'
          }
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />

        {/* Metadata Patch Builder */}
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          <label className="text-xs font-medium text-zinc-300">Decision Attributes & Metadata (Optional)</label>
          <div className="flex items-center gap-2">
            <input
              placeholder="Key (e.g. po_number, budget_code)"
              value={metaKey}
              onChange={(e) => setMetaKey(e.target.value)}
              className="flex h-8 w-1/2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Value (e.g. PO-84920, Approved)"
              value={metaValue}
              onChange={(e) => setMetaValue(e.target.value)}
              className="flex h-8 w-1/2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <Button type="button" size="sm" variant="secondary" onClick={handleAddMeta}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {metadataEntries.length > 0 && (
            <div className="space-y-1 mt-2">
              {metadataEntries.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
                  <span className="font-mono text-indigo-400 font-semibold">{entry.key}:</span>
                  <span className="text-zinc-200 truncate max-w-[200px]">{entry.value}</span>
                  <button type="button" onClick={() => handleRemoveMeta(idx)} className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant={submitVariant} isLoading={loading} disabled={!transition.is_allowed}>
            {isApproval ? 'Confirm Approval' : isRejection ? 'Confirm Rejection' : 'Execute Transition'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
