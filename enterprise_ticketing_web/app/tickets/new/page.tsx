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

const PRIORITIES: { value: TicketPriority; label: string; desc: string; color: string }[] = [
  { value: 'LOW', label: 'Low', desc: 'Standard non-urgent inquiry', color: 'text-slate-400' },
  { value: 'MEDIUM', label: 'Medium', desc: 'Routine department task', color: 'text-blue-400' },
  { value: 'HIGH', label: 'High', desc: 'Business impact requiring prompt review', color: 'text-amber-400' },
  { value: 'URGENT', label: 'Urgent', desc: 'Blocks operational workflow', color: 'text-orange-400' },
  { value: 'CRITICAL', label: 'Critical', desc: 'Severe outage or director clearance', color: 'text-rose-400' },
];

export default function NewTicketPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');

  // IT Specific Technical Fields (Mandatory when IT department is selected)
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

  // Determine if currently selected department is IT
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

      // Auto-select department
      const matchingDept = departments.find((d) => d.code === res.suggested_department_code);
      if (matchingDept) {
        setDepartmentId(matchingDept.id);
      }

      // Auto-select priority
      if (res.suggested_priority) {
        setPriority(res.suggested_priority);
      }

      // Pre-fill entities / tags into metadata if found
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <Card className="bg-slate-900/80 border-slate-800 shadow-2xl">
        <CardHeader className="border-b border-slate-800 pb-4 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-400">
              <FilePlus className="h-5 w-5" />
              <CardTitle className="text-lg">Create Enterprise Service Ticket</CardTitle>
            </div>
            <CardDescription>
              Initiate a new request, budget requisition, bug report, or recruitment requisition across department queues.
            </CardDescription>
          </div>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleAiTriage}
            isLoading={triageLoading}
            className="gap-1.5 border-indigo-600/50 bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/60 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>AI Auto-Triage & Suggest</span>
          </Button>
        </CardHeader>

        {triageResult && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-indigo-950/70 border border-indigo-700/50 text-xs text-indigo-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                AI Triage Suggestion ({Math.round(triageResult.confidence_score * 100)}% confidence)
              </span>
              <span className="text-[11px] text-indigo-300 font-mono">
                Target Queue: [{triageResult.suggested_department_code}] • Priority: {triageResult.suggested_priority}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] italic mt-1">&ldquo;{triageResult.suggested_first_response}&rdquo;</p>
          </div>
        )}

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Department Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-indigo-400" />
                Target Department Queue
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

            {/* IT Specific Mandatory Technical Fields */}
            {isItDepartment && (
              <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-700/50 space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-cyan-800/40 pb-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                    <Sparkles className="h-4 w-4" />
                    <span>IT Support Technical Diagnostics (Mandatory)</span>
                  </div>
                  <span className="text-[10px] text-cyan-300 bg-cyan-900/60 border border-cyan-700/50 px-2 py-0.5 rounded font-mono">
                    IT-Support Policy Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-cyan-200">Asset / Infrastructure Type *</label>
                    <Select
                      value={itAssetType}
                      onChange={(e) => setItAssetType(e.target.value)}
                      required
                    >
                      <option value="Hardware">Hardware (Laptops, Desktops, Servers, Monitors)</option>
                      <option value="Software">Software (OS, SaaS Tools, IDEs, VPN Client)</option>
                      <option value="Network">Network (Office WiFi, Gateway, DNS, Firewalls)</option>
                      <option value="Access Permission">Access Permission (GitHub, AWS, SSO, Vault)</option>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-cyan-200">System Impact Scope *</label>
                    <Select
                      value={itSystemImpact}
                      onChange={(e) => setItSystemImpact(e.target.value)}
                      required
                    >
                      <option value="Single User">Single User (Isolated to one workstation)</option>
                      <option value="Department-wide">Department-wide (Affecting multiple team members)</option>
                      <option value="Organization-wide">Organization-wide (Critical business downtime)</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-cyan-200">Steps to Reproduce Issue *</label>
                  <Textarea
                    placeholder="1. Connected to corporate VPN&#10;2. Opened internal staging server URL&#10;3. Received Error 504 Gateway Timeout..."
                    value={itStepsToReproduce}
                    onChange={(e) => setItStepsToReproduce(e.target.value)}
                    rows={3}
                    required
                    className="border-cyan-800/70 bg-slate-950/90 text-white placeholder:text-slate-500 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* Title */}
            <Input
              label="Request Title / Summary"
              placeholder="e.g. Q3 Vendor Disbursement Authorization or Cloud Cluster Outage"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
            />

            {/* Priority Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Priority Level</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRIORITIES.map((p) => {
                  const isSelected = priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/80 border-indigo-500 ring-1 ring-indigo-500'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className={`text-xs font-bold ${p.color}`}>{p.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <Textarea
              label="Detailed Description & Justification"
              placeholder="Provide complete context, business impact, itemized budget, or troubleshooting steps..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
              minLength={5}
            />

            {/* Dynamic Metadata Attributes */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div>
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Custom Metadata & Workflow Attributes (Optional)
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Attach structured data for FSM condition evaluation (e.g. `budget_amount`, `vendor_name`, `server_count`).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  placeholder="Field Key (e.g. budget_amount)"
                  value={metaKey}
                  onChange={(e) => setMetaKey(e.target.value)}
                  className="flex h-9 w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-white"
                />
                <input
                  placeholder="Field Value (e.g. 15000)"
                  value={metaValue}
                  onChange={(e) => setMetaValue(e.target.value)}
                  className="flex h-9 w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-white"
                />
                <Button type="button" size="sm" variant="secondary" onClick={handleAddMetadata}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {metadataList.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {metadataList.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                    >
                      <span className="font-mono text-indigo-400 font-semibold">{item.key}:</span>
                      <span className="text-slate-200 truncate max-w-[140px]">{item.value}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMetadata(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Link href="/dashboard">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" size="lg" isLoading={loading} className="gap-2 shadow-indigo-600/30">
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
