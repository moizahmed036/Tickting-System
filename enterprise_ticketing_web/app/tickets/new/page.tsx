'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  FilePlus,
  Tag,
  AlertCircle,
  Sparkles,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Department, TicketPriority } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input, Textarea, Select } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PRIORITIES: { value: TicketPriority; label: string; desc: string; color: string }[] = [
  { value: 'LOW', label: 'Low', desc: 'Standard non-urgent inquiry', color: 'text-zinc-400' },
  { value: 'MEDIUM', label: 'Medium', desc: 'Routine department task', color: 'text-blue-400' },
  { value: 'HIGH', label: 'High', desc: 'Business impact requiring review', color: 'text-amber-400' },
  { value: 'URGENT', label: 'Urgent', desc: 'Blocks operational workflow', color: 'text-orange-400' },
  { value: 'CRITICAL', label: 'Critical', desc: 'Severe outage or clearance', color: 'text-rose-400' },
];

export default function NewTicketPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');

  // IT Specific Technical Diagnostics
  const [itAssetType, setItAssetType] = useState<string>('Hardware');
  const [itSystemImpact, setItSystemImpact] = useState<string>('Single User');
  const [itStepsToReproduce, setItStepsToReproduce] = useState<string>('');

  // Custom Metadata Key-Values
  const [metaKey, setMetaKey] = useState('');
  const [metaValue, setMetaValue] = useState('');
  const [metadataList, setMetadataList] = useState<{ key: string; value: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDepartments() {
      try {
        const list = await api.getDepartments();
        setDepartments(list);
        if (list.length > 0) {
          setDepartmentId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load departments:', err);
      } finally {
        setLoadingDepts(false);
      }
    }
    loadDepartments();
  }, []);

  const selectedDept = departments.find((d) => d.id === Number(departmentId));
  const isItDepartment = selectedDept?.code === 'IT';

  const handleAddMetadata = () => {
    if (!metaKey.trim()) return;
    setMetadataList([...metadataList, { key: metaKey.trim(), value: metaValue.trim() }]);
    setMetaKey('');
    setMetaValue('');
  };

  const handleRemoveMetadata = (idx: number) => {
    setMetadataList(metadataList.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId) {
      setError('Please select a destination department');
      return;
    }

    if (isItDepartment && !itStepsToReproduce.trim()) {
      setError('Please provide Steps to Reproduce for IT technical support');
      return;
    }

    setLoading(true);
    setError(null);

    const metadata_payload: Record<string, any> = {};
    metadataList.forEach((item) => {
      if (!isNaN(Number(item.value)) && item.value !== '') {
        metadata_payload[item.key] = Number(item.value);
      } else if (item.value.toLowerCase() === 'true') {
        metadata_payload[item.key] = true;
      } else if (item.value.toLowerCase() === 'false') {
        metadata_payload[item.key] = false;
      } else {
        metadata_payload[item.key] = item.value;
      }
    });

    if (isItDepartment) {
      metadata_payload['asset_type'] = itAssetType;
      metadata_payload['system_impact'] = itSystemImpact;
      metadata_payload['steps_to_reproduce'] = itStepsToReproduce.trim();
      metadata_payload['tags'] = ['IT-Support'];
    }

    try {
      const ticket = await api.createTicket({
        title: title.trim(),
        description: description.trim(),
        priority,
        department_id: Number(departmentId),
        metadata_payload,
      });
      router.push(`/tickets/${ticket.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<any | null>(null);

  const handleAiTriage = async () => {
    if (!title.trim() && !description.trim()) {
      setError('Please provide a title or description first for AI Triage.');
      return;
    }
    setTriageLoading(true);
    setError(null);
    try {
      const res = await api.smartClassifyTicket({
        title: title.trim(),
        description: description.trim(),
      });
      setTriageResult(res);

      const matchingDept = departments.find((d) => d.code === res.suggested_department_code);
      if (matchingDept) {
        setDepartmentId(matchingDept.id);
      }

      if (res.suggested_priority) {
        setPriority(res.suggested_priority);
      }

      if (res.key_entities && Object.keys(res.key_entities).length > 0) {
        const newEntries = Object.entries(res.key_entities).map(([k, v]) => ({
          key: k,
          value: String(v),
        }));
        setMetadataList((prev) => [...prev, ...newEntries]);
      }
    } catch (err: any) {
      setError('AI Triage suggestion failed: ' + (err.message || ''));
    } finally {
      setTriageLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <Card className="bg-zinc-900/80 border-zinc-800/80 shadow-2xl backdrop-blur-xl">
        <CardHeader className="border-b border-zinc-800/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-indigo-400">
              <FilePlus className="h-4 w-4" />
              <CardTitle className="text-base">Create Enterprise Service Ticket</CardTitle>
            </div>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Initiate a service requisition, budget request, incident report, or recruitment requisition.
            </CardDescription>
          </div>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleAiTriage}
            isLoading={triageLoading}
            className="gap-1.5 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 text-xs shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>AI Auto-Triage</span>
          </Button>
        </CardHeader>

        {triageResult && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-200 space-y-1 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                AI Triage Suggestion ({Math.round(triageResult.confidence_score * 100)}% confidence)
              </span>
              <span className="text-[11px] text-indigo-300 font-mono">
                Queue: [{triageResult.suggested_department_code}] • Priority: {triageResult.suggested_priority}
              </span>
            </div>
            <p className="text-zinc-300 text-[11px] italic mt-1">&ldquo;{triageResult.suggested_first_response}&rdquo;</p>
          </div>
        )}

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Department Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-indigo-400" />
                Destination Department Queue
              </label>
              <Select
                value={departmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                required
                disabled={loadingDepts}
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    [{dept.code}] {dept.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* IT Specific Mandatory Diagnostics */}
            {isItDepartment && (
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-700/40 space-y-3.5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-cyan-800/40 pb-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>IT Technical Diagnostics (Mandatory)</span>
                  </div>
                  <span className="text-[10px] text-cyan-300 bg-cyan-900/60 border border-cyan-700/50 px-2 py-0.2 rounded font-mono">
                    IT-Support Policy
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-cyan-200">Asset Type *</label>
                    <Select
                      value={itAssetType}
                      onChange={(e) => setItAssetType(e.target.value)}
                      required
                    >
                      <option value="Hardware">Hardware (Laptops, Servers, Monitors)</option>
                      <option value="Software">Software (OS, SaaS, IDEs, VPN)</option>
                      <option value="Network">Network (WiFi, Gateway, Firewalls)</option>
                      <option value="Access Permission">Access Permission (GitHub, AWS, SSO)</option>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-cyan-200">Impact Scope *</label>
                    <Select
                      value={itSystemImpact}
                      onChange={(e) => setItSystemImpact(e.target.value)}
                      required
                    >
                      <option value="Single User">Single User (Isolated)</option>
                      <option value="Department-wide">Department-wide (Team blocked)</option>
                      <option value="Organization-wide">Organization-wide (Critical outage)</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-cyan-200">Steps to Reproduce Issue *</label>
                  <Textarea
                    placeholder="1. Connected to corporate VPN&#10;2. Opened internal staging cluster&#10;3. Encountered 504 Gateway Timeout..."
                    value={itStepsToReproduce}
                    onChange={(e) => setItStepsToReproduce(e.target.value)}
                    rows={3}
                    required
                    className="border-cyan-800/70 bg-zinc-950 text-white placeholder:text-zinc-600 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* Title */}
            <Input
              label="Request Title"
              placeholder="e.g. Q3 Vendor Disbursement Authorization or Cloud Cluster Outage"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
            />

            {/* Priority Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Priority Level</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRIORITIES.map((p) => {
                  const isSelected = priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={cn(
                        'p-2.5 rounded-xl border text-left transition-all cursor-pointer select-none',
                        isSelected
                          ? 'bg-zinc-800 border-zinc-600 ring-1 ring-indigo-500/50 shadow-sm'
                          : 'bg-zinc-950/60 border-zinc-850 hover:border-zinc-750'
                      )}
                    >
                      <div className={cn('text-xs font-bold', p.color)}>{p.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <Textarea
              label="Detailed Description & Justification"
              placeholder="Provide complete business context, itemized budget, or troubleshooting details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              minLength={5}
            />

            {/* Dynamic Metadata Attributes */}
            <div className="space-y-2.5 pt-3 border-t border-zinc-800/80">
              <div>
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Custom Metadata & Workflow Attributes (Optional)
                </label>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Attach structured data for FSM condition evaluation (e.g. `budget_amount`, `vendor_name`).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  placeholder="Key (e.g. budget_amount)"
                  value={metaKey}
                  onChange={(e) => setMetaKey(e.target.value)}
                  className="flex h-8 w-1/2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  placeholder="Value (e.g. 15000)"
                  value={metaValue}
                  onChange={(e) => setMetaValue(e.target.value)}
                  className="flex h-8 w-1/2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <Button type="button" size="sm" variant="secondary" onClick={handleAddMetadata}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {metadataList.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {metadataList.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-850 text-xs"
                    >
                      <span className="font-mono text-indigo-400 font-semibold">{item.key}:</span>
                      <span className="text-zinc-200 truncate max-w-[130px]">{item.value}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMetadata(idx)}
                        className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
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

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800/80">
              <Link href="/dashboard">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" size="md" isLoading={loading} className="gap-2 font-semibold">
                <FilePlus className="h-4 w-4" />
                <span>Submit Ticket</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
