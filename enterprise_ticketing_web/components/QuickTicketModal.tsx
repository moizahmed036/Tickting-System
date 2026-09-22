'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Plus,
  Trash2,
  X,
  Layers,
  Send,
  Loader2,
  Building2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Department, TicketPriority } from '@/lib/types';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface QuickTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticketId: number) => void;
}

export function QuickTicketModal({ isOpen, onClose, onSuccess }: QuickTicketModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [metadataList, setMetadataList] = useState<{ key: string; value: string }[]>([]);
  
  // AI Auto-Fill Drawer State
  const [showAiBox, setShowAiBox] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiClassifying, setAiClassifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      api.getDepartments()
        .then((data) => {
          setDepartments(data);
          if (data.length > 0 && departmentId === '') {
            setDepartmentId(data[0].id);
          }
        })
        .catch((err) => console.warn('Failed to load departments:', err));
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Global keyboard shortcut listener (Ctrl+N / Cmd+N)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          window.dispatchEvent(new CustomEvent('open-quick-ticket-modal'));
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleAiAutoFill = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a brief request or text dump for AI to analyze.');
      return;
    }

    try {
      setAiClassifying(true);
      const triage = await api.smartClassifyTicket({
        title: aiPrompt.slice(0, 80),
        description: aiPrompt,
      });

      if (triage) {
        setTitle(aiPrompt.length > 60 ? `${aiPrompt.slice(0, 60)}...` : aiPrompt);
        setDescription(aiPrompt);

        if (triage.suggested_priority) {
          setPriority(triage.suggested_priority);
        }

        if (triage.suggested_department_code && departments.length > 0) {
          const matchedDept = departments.find(
            (d) => d.code.toUpperCase() === triage.suggested_department_code.toUpperCase()
          );
          if (matchedDept) {
            setDepartmentId(matchedDept.id);
          }
        }

        if (triage.key_entities && Object.keys(triage.key_entities).length > 0) {
          const newEntries = Object.entries(triage.key_entities).map(([k, v]) => ({
            key: k,
            value: typeof v === 'object' ? JSON.stringify(v) : String(v),
          }));
          setMetadataList(newEntries);
        }

        setShowAiBox(false);
        setAiPrompt('');
        toast.success(`AI Auto-filled fields with ${Math.round(triage.confidence_score * 100)}% confidence.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'AI smart triage failed');
    } finally {
      setAiClassifying(false);
    }
  };

  const handleAddMetaRow = () => {
    setMetadataList((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveMetaRow = (index: number) => {
    setMetadataList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMetaChange = (index: number, field: 'key' | 'value', val: string) => {
    setMetadataList((prev) => {
      const updated = [...prev];
      updated[index][field] = val;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please provide a ticket title.');
      return;
    }
    if (!description.trim()) {
      toast.error('Please provide a description.');
      return;
    }
    if (!departmentId) {
      toast.error('Please select a target department.');
      return;
    }

    const payloadMeta: Record<string, any> = {};
    metadataList.forEach((row) => {
      if (row.key.trim()) {
        payloadMeta[row.key.trim()] = row.value.trim();
      }
    });

    try {
      setSubmitting(true);
      const newTicket = await api.createTicket({
        title: title.trim(),
        description: description.trim(),
        priority,
        department_id: Number(departmentId),
        metadata_payload: payloadMeta,
      });

      toast.success(`Ticket ${newTicket.ticket_number} created successfully!`);
      onClose();

      // Reset form
      setTitle('');
      setDescription('');
      setMetadataList([]);

      if (onSuccess) {
        onSuccess(newTicket.id);
      } else {
        router.push(`/tickets/${newTicket.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-y-auto p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog Card */}
      <div className="relative z-10 my-auto w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Quick Manual Ticket Creator</h3>
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded border border-border bg-muted text-[10px] font-mono text-muted-foreground">
                  Esc to close
                </kbd>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Rapid requisition intake & department queue routing
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* AI Quick Fill Accordion Box */}
        {showAiBox ? (
          <div className="border-b border-border bg-primary/5 p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Wand2 className="h-3.5 w-3.5" />
                AI Smart Triage Auto-Fill
              </span>
              <button
                type="button"
                onClick={() => setShowAiBox(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paste rough notes, email text, or chat snippet. AI will parse title, department, priority, and metadata entities.
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Production PostgreSQL database is throwing connection timeouts in US-East region. Affecting checkout checkout payments."
              rows={3}
              className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={handleAiAutoFill}
              disabled={aiClassifying || !aiPrompt.trim()}
              className="w-full gap-1.5 text-xs font-semibold"
            >
              {aiClassifying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>Analyze & Populate Fields</span>
            </Button>
          </div>
        ) : (
          <div className="border-b border-border px-5 py-2.5 bg-muted/20 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-muted-foreground">
              Have unstructured notes or an email snippet?
            </span>
            <button
              type="button"
              onClick={() => setShowAiBox(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              Auto-Fill with AI
            </button>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 flex flex-col">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., VPN Access Gateway Renewal"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Department & Priority Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Target Department Queue <span className="text-rose-500">*</span>
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.code} - {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Priority Tier</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="LOW">Low (Standard Backlog)</option>
                <option value="MEDIUM">Medium (Normal SLA)</option>
                <option value="HIGH">High (Priority Queue)</option>
                <option value="URGENT">Urgent (4hr SLA)</option>
                <option value="CRITICAL">Critical (1hr SLA Pager)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Requisition Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide specific details, justification, or technical diagnostics..."
              rows={3}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Custom Metadata Key-Value Builder */}
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Custom Metadata & Workflow Attributes
              </span>
              <button
                type="button"
                onClick={handleAddMetaRow}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add Attribute
              </button>
            </div>

            {metadataList.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">
                No custom metadata attached. Click 'Add Attribute' for budget codes, server IDs, or invoice references.
              </p>
            ) : (
              <div className="space-y-2">
                {metadataList.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Key (e.g. budget_code)"
                      value={row.key}
                      onChange={(e) => handleMetaChange(idx, 'key', e.target.value)}
                      className="w-1/2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. 5000)"
                      value={row.value}
                      onChange={(e) => handleMetaChange(idx, 'value', e.target.value)}
                      className="w-1/2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveMetaRow(idx)}
                      className="p-1 text-muted-foreground hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border mt-auto shrink-0">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={submitting || !title.trim() || !description.trim()}
              className="gap-1.5 font-semibold"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Create Ticket</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

