'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, ShieldCheck, ArrowRight, AlertCircle, KeyRound, Sparkles } from 'lucide-react';
import { SEED_ACCOUNTS, useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getRoleBadge } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@enterprise.local');
  const [password, setPassword] = useState('AdminPassword123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f19] p-4 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 z-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-xl shadow-indigo-600/30">
            <Layers className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">NexusFlow Enterprise</h1>
          <p className="text-xs text-slate-400">Sign in to access your role-based ticketing workflow queue</p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl border border-slate-800 p-6 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Enterprise Email"
              type="text"
              placeholder="name@enterprise.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full gap-2 shadow-indigo-600/30" isLoading={loading}>
              <span>Authenticate & Sign In</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          {/* Quick-Fill Seed Personas */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-2.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              1-Click Demo Persona Credentials
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              {SEED_ACCOUNTS.slice(0, 6).map((acc) => {
                const badge = getRoleBadge(acc.role);
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleQuickFill(acc.email, acc.password)}
                    className="text-left px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-indigo-500/40 text-[11px] transition-all cursor-pointer group"
                  >
                    <div className="font-semibold text-slate-200 group-hover:text-indigo-300 truncate">
                      {acc.label}
                    </div>
                    <div className={cn('text-[9px] font-medium mt-0.5', badge.text)}>{acc.role}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>OAuth2 JWT Bearer Auth & Role Isolation Active</span>
        </div>
      </div>
    </div>
  );
}
