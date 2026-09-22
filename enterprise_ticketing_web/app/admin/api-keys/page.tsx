'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  Code2,
  Terminal,
  ExternalLink,
  Lock,
  Building2,
  Clock,
  AlertTriangle,
  Layers,
  Sparkles,
  Loader2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ApiKeyCreatedResponse, ApiKeyRead, Department } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate, formatTimeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function ApiKeysManagementPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [keys, setKeys] = useState<ApiKeyRead[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Key Generation Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('');
  const [generating, setGenerating] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<ApiKeyCreatedResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Interactive Code Snippet Tab State
  const [activeSnippetTab, setActiveSnippetTab] = useState<'curl' | 'python' | 'javascript'>('curl');
  const [activeEndpointTab, setActiveEndpointTab] = useState<'tickets' | 'emails'>('tickets');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const [keysRes, deptsRes] = await Promise.all([
        api.adminGetApiKeys(),
        api.getDepartments().catch(() => []),
      ]);
      setKeys(keysRes.items);
      setDepartments(deptsRes);
    } catch (err: any) {
      console.warn('Failed to load API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchKeys();
  }, []);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error('Please enter an API key name.');
      return;
    }

    try {
      setGenerating(true);
      const res = await api.adminCreateApiKey({
        name: keyName.trim(),
        department_id: selectedDeptId !== '' ? Number(selectedDeptId) : null,
      });
      setNewKeyResult(res);
      setKeys((prev) => [res.api_key, ...prev]);
      toast.success('API Key generated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeKey = async (keyItem: ApiKeyRead) => {
    if (!confirm(`Are you sure you want to permanently revoke API Key "${keyItem.name}"? Any external bots using this key will immediately lose access.`)) {
      return;
    }

    try {
      await api.adminDeleteApiKey(keyItem.id);
      setKeys((prev) => prev.filter((k) => k.id !== keyItem.id));
      toast.success(`Revoked API Key "${keyItem.name}".`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke API key');
    }
  };

  const handleCopyRawKey = () => {
    if (newKeyResult?.raw_secret_key) {
      navigator.clipboard.writeText(newKeyResult.raw_secret_key);
      setCopiedKey(true);
      toast.success('API Key copied to clipboard.');
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  // Construct dynamic snippet code based on selected tab and endpoint
  const activeKeyPrefix = keys[0]?.key_prefix || 'nxf_live_sample';
  const sampleKey = newKeyResult?.raw_secret_key || `${activeKeyPrefix}_secret_token_xxxxxxxx`;

  const getCurlSnippet = () => {
    if (activeEndpointTab === 'tickets') {
      return `curl -X POST http://localhost:8000/api/v1/integrations/tickets \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${sampleKey}" \\
  -d '{
    "sender_email": "customer@acme-corp.com",
    "sender_name": "DevOps Engineer",
    "title": "PostgreSQL Replica Node Memory Saturation",
    "description": "High memory consumption detected on cluster db-replica-02.",
    "department_code": "IT",
    "priority": "HIGH",
    "metadata": { "cluster_id": "us-east-db", "utilization": "94%" }
  }'`;
    } else {
      return `curl -X POST http://localhost:8000/api/v1/integrations/email-ingest \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${sampleKey}" \\
  -d '{
    "from_email": "client@enterprise.com",
    "from_name": "Client Representative",
    "to_email": "support@enterprise.local",
    "subject": "Urgent Invoice Dispute for Q3 Order PO-8842",
    "body_text": "Please see attached payment verification. The billing total requires immediate adjustment.",
    "message_id": "<rfc2822-msg-99482@external.com>"
  }'`;
    }
  };

  const getPythonSnippet = () => {
    if (activeEndpointTab === 'tickets') {
      return `import requests

url = "http://localhost:8000/api/v1/integrations/tickets"
headers = {
    "X-API-Key": "${sampleKey}",
    "Content-Type": "application/json"
}
payload = {
    "sender_email": "customer@acme-corp.com",
    "sender_name": "DevOps Engineer",
    "title": "PostgreSQL Replica Node Memory Saturation",
    "description": "High memory consumption detected on cluster db-replica-02.",
    "department_code": "IT",
    "priority": "HIGH",
    "metadata": {"cluster_id": "us-east-db", "utilization": "94%"}
}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.json())`;
    } else {
      return `import requests

url = "http://localhost:8000/api/v1/integrations/email-ingest"
headers = {
    "X-API-Key": "${sampleKey}",
    "Content-Type": "application/json"
}
payload = {
    "from_email": "client@enterprise.com",
    "from_name": "Client Representative",
    "to_email": "support@enterprise.local",
    "subject": "Urgent Invoice Dispute for Q3 Order PO-8842",
    "body_text": "Please see attached payment verification.",
    "message_id": "<rfc2822-msg-99482@external.com>"
}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.json())`;
    }
  };

  const getJsSnippet = () => {
    if (activeEndpointTab === 'tickets') {
      return `const response = await fetch("http://localhost:8000/api/v1/integrations/tickets", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${sampleKey}"
  },
  body: JSON.stringify({
    sender_email: "customer@acme-corp.com",
    sender_name: "DevOps Engineer",
    title: "PostgreSQL Replica Node Memory Saturation",
    description: "High memory consumption detected on cluster db-replica-02.",
    department_code: "IT",
    priority: "HIGH",
    metadata: { cluster_id: "us-east-db", utilization: "94%" }
  })
});

const data = await response.json();
console.log("Ticket Created:", data);`;
    } else {
      return `const response = await fetch("http://localhost:8000/api/v1/integrations/email-ingest", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${sampleKey}"
  },
  body: JSON.stringify({
    from_email: "client@enterprise.com",
    from_name: "Client Representative",
    to_email: "support@enterprise.local",
    subject: "Urgent Invoice Dispute for Q3 Order PO-8842",
    body_text: "Please see attached payment verification.",
    message_id: "<rfc2822-msg-99482@external.com>"
  })
});

const data = await response.json();
console.log("Email Ingested:", data);`;
    }
  };

  const currentSnippet =
    activeSnippetTab === 'curl'
      ? getCurlSnippet()
      : activeSnippetTab === 'python'
      ? getPythonSnippet()
      : getJsSnippet();

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(currentSnippet);
    setCopiedSnippet(true);
    toast.success('Code snippet copied to clipboard.');
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Key className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Developer API Keys & Webhook Gateway
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Issue cryptographically hashed API keys (`X-API-Key`) for Zapier, Make, ERPs, and automated email scrapers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={fetchKeys}
            isLoading={loading}
            className="h-8 px-2.5"
            title="Refresh API Keys"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setNewKeyResult(null);
              setKeyName('');
              setSelectedDeptId('');
              setIsCreateOpen(true);
            }}
            className="gap-1.5 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Generate New API Key</span>
          </Button>
        </div>
      </div>

      {/* API Key Management Table */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                Active Programmatic Credentials
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Keys are hashed with SHA-256 and authenticated with constant-time verification.
              </CardDescription>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {keys.length} Active Keys
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Key Name</th>
                  <th className="py-2.5 px-3">Secret Prefix</th>
                  <th className="py-2.5 px-3">Queue Boundary</th>
                  <th className="py-2.5 px-3">Issued By</th>
                  <th className="py-2.5 px-3">Last Used</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary mb-2" />
                      Loading credentials...
                    </td>
                  </tr>
                ) : keys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No API keys generated yet. Click &lsquo;Generate New API Key&rsquo; to start integrating external systems.
                    </td>
                  </tr>
                ) : (
                  keys.map((k) => (
                    <tr key={k.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-semibold text-foreground flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{k.name}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">
                          {k.key_prefix}...
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {k.department_code ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            <Building2 className="h-3 w-3" />
                            {k.department_code} Queue Only
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="h-3 w-3" />
                            Universal Access
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {k.created_by_name || 'Admin'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                        {k.last_used_at ? formatTimeAgo(k.last_used_at) : 'Never used'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevokeKey(k)}
                          className="h-7 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1 text-xs"
                          title="Revoke and delete key"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Revoke</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Code Snippets & Developer Integration Hub */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Code2 className="h-4 w-4 text-primary" />
                Integration Code Snippets & Playground
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Copy and paste ready-to-run code samples pre-populated with your endpoint formats.
              </CardDescription>
            </div>

            {/* Endpoint Selector Tabs */}
            <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border">
              <button
                onClick={() => setActiveEndpointTab('tickets')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer',
                  activeEndpointTab === 'tickets'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                POST /integrations/tickets
              </button>
              <button
                onClick={() => setActiveEndpointTab('emails')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer',
                  activeEndpointTab === 'emails'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                POST /integrations/email-ingest
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Language Switcher Tabs & Copy Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'curl', label: 'cURL' },
                { id: 'python', label: 'Python (requests)' },
                { id: 'javascript', label: 'JavaScript (fetch)' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setActiveSnippetTab(lang.id as any)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer',
                    activeSnippetTab === lang.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopySnippet}
              className="gap-1.5 text-xs h-7 px-2.5"
            >
              {copiedSnippet ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
              <span>{copiedSnippet ? 'Copied' : 'Copy Code'}</span>
            </Button>
          </div>

          {/* Code Block Container */}
          <div className="relative rounded-xl border border-border bg-muted/40 p-4 font-mono text-xs text-foreground overflow-x-auto">
            <pre className="whitespace-pre text-[11px] leading-relaxed">{currentSnippet}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Generate API Key Modal Dialog */}
      {isCreateOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-y-auto p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsCreateOpen(false)} aria-hidden="true" />
          <div className="relative z-10 my-auto w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {newKeyResult ? (
              // Success Screen Showing Secret Key ONCE
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                  <h3 className="text-sm font-bold text-foreground">API Key Generated Successfully</h3>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-medium space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Important Security Notice</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    Copy and store this secret key in a password manager or environment secret. For security reasons, it will <span className="font-bold underline">never be shown again</span>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Secret Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={newKeyResult.raw_secret_key}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-xs font-mono text-foreground select-all focus:outline-none"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleCopyRawKey}
                      className="shrink-0 gap-1.5"
                    >
                      {copiedKey ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setNewKeyResult(null);
                    }}
                  >
                    Done & Close
                  </Button>
                </div>
              </div>
            ) : (
              // Form to Generate New Key
              <form onSubmit={handleGenerateKey} className="p-6 space-y-4 overflow-y-auto">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Generate Integration API Key</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Key Friendly Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g., Salesforce CRM Sync Bot"
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Department Queue Scope
                  </label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) =>
                      setSelectedDeptId(e.target.value !== '' ? Number(e.target.value) : '')
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">Universal Access (All Department Queues)</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.code} - {dept.name} (Restricted)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Restricting a key ensures third-party bots can only create tickets in their designated queue.
                  </p>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={generating || !keyName.trim()}
                    className="gap-1.5 font-semibold"
                  >
                    {generating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>Generate Key</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
