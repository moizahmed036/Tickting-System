'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Filter,
  Calendar,
  Building2,
  RefreshCw,
  Zap,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AnalyticsOverviewResponse, Department } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#f43f5e', // Rose
  URGENT: '#f97316',   // Orange
  HIGH: '#eab308',     // Yellow
  MEDIUM: '#3b82f6',   // Blue
  LOW: '#10b981',      // Emerald
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#71717a',
  SUBMITTED: '#38bdf8',
  PENDING_APPROVAL: '#fbbf24',
  APPROVED: '#a855f7',
  IN_PROGRESS: '#6366f1',
  RESOLVED: '#10b981',
  CLOSED: '#52525b',
  REJECTED: '#f43f5e',
};

export default function AnalyticsDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsOverviewResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [analyticsRes, deptsRes] = await Promise.all([
        api.getAnalyticsOverview(selectedDays, selectedDeptId),
        api.getDepartments().catch(() => []),
      ]);
      setData(analyticsRes);
      setDepartments(deptsRes);
    } catch (err: any) {
      console.warn('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedDays, selectedDeptId]);

  const priorityPieData = data
    ? Object.entries(data.priority_distribution)
        .map(([key, count]) => ({
          name: key,
          value: count,
          color: PRIORITY_COLORS[key] || '#8884d8',
        }))
        .filter((item) => item.value > 0)
    : [];

  const statusPieData = data
    ? Object.entries(data.status_distribution)
        .map(([key, count]) => ({
          name: key.replace('_', ' '),
          value: count,
          color: STATUS_COLORS[key] || '#8884d8',
        }))
        .filter((item) => item.value > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <BarChart3 className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Executive Analytics & SLA Performance Hub
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time telemetry on SLA compliance velocity, mean time to resolution (MTTR), and department queues.
          </p>
        </div>

        {/* Date & Department Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Department Filter */}
          <select
            value={selectedDeptId || ''}
            onChange={(e) =>
              setSelectedDeptId(e.target.value ? Number(e.target.value) : undefined)
            }
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          {/* Timeframe Pill Selector */}
          <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border">
            {[
              { label: '7 Days', value: 7 },
              { label: '30 Days', value: 30 },
              { label: '90 Days', value: 90 },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setSelectedDays(t.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer',
                  selectedDays === t.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={fetchAnalytics}
            isLoading={loading}
            className="h-8 px-2.5"
            title="Refresh Metrics"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Top Level Metric KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SLA Compliance */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">SLA Compliance Rate</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground font-mono">
                {data ? `${data.sla_compliance_rate}%` : '—'}
              </span>
              <span className="text-[10px] font-semibold text-emerald-400 flex items-center">
                <ArrowUpRight className="h-3 w-3" /> Target: 95%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(data?.sla_compliance_rate || 0, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* MTTR */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Mean Time to Resolution</span>
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground font-mono">
                {data ? `${data.overall_mttr_hours} hrs` : '—'}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground">Avg turnaround</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Calculated across {data?.resolved_tickets || 0} resolved requisitions
            </p>
          </CardContent>
        </Card>

        {/* Active Backlog */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Active Operational Queue</span>
            <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground font-mono">
                {data?.active_backlog ?? '—'}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                of {data?.total_tickets ?? 0} total tickets
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {data?.resolved_tickets || 0} resolved ({data?.total_tickets ? Math.round(((data.resolved_tickets)/data.total_tickets)*100) : 0}% clearance)
            </p>
          </CardContent>
        </Card>

        {/* Escalation Rate */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Escalation & Breach Rate</span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground font-mono">
                {data ? `${data.escalation_rate}%` : '—'}
              </span>
              <span className="text-[10px] font-semibold text-amber-400">
                {data && data.escalation_rate > 10 ? 'Action Required' : 'Optimal'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Executive escalation triggered by SLA threshold delays
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Primary Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Time-Series Inbound vs Resolved Area Chart (2 Cols) */}
        <Card className="lg:col-span-2 bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                Ticket Throughput & Resolution Velocity
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Daily volume of inbound vs completed requisitions over the last {selectedDays} days
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full pt-4">
              {data?.time_series && data.time_series.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.time_series}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.15)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => val.slice(5)}
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey="created_count"
                      name="Inbound Created"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCreated)"
                    />
                    <Area
                      type="monotone"
                      dataKey="resolved_count"
                      name="Completed / Resolved"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorResolved)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  No time-series data available for current selection.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Priority Breakdown Donut Chart (1 Col) */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground">
              Priority Distribution
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Breakdown by enterprise urgency tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full flex flex-col items-center justify-center">
              {priorityPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {priorityPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-muted-foreground text-center">
                  No priority data recorded.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Row: Department MTTR Bar Chart & Performance Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Turnaround Comparison Bar Chart */}
        <Card className="lg:col-span-1 bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground">
              MTTR by Department
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Mean resolution time in hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full pt-2">
              {data?.department_breakdown && data.department_breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.department_breakdown}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.15)" />
                    <XAxis dataKey="department_code" stroke="#888888" fontSize={11} tickLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Bar dataKey="mttr_hours" name="MTTR (Hours)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  No department metrics.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Department Operational Table */}
        <Card className="lg:col-span-2 bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground">
              Departmental Operational Matrix
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Comparative overview of throughput, active queue backlogs, and SLA compliance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Total Volume</th>
                    <th className="py-2.5 px-3">Active Backlog</th>
                    <th className="py-2.5 px-3">Resolved</th>
                    <th className="py-2.5 px-3">MTTR</th>
                    <th className="py-2.5 px-3 text-right">SLA Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data?.department_breakdown && data.department_breakdown.length > 0 ? (
                    data.department_breakdown.map((dept) => (
                      <tr key={dept.department_id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-muted border border-border">
                            {dept.department_code}
                          </span>
                          <span className="truncate max-w-[140px]">{dept.department_name}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-foreground font-medium">
                          {dept.total_tickets}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-400 font-medium">
                          {dept.active_tickets}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-400 font-medium">
                          {dept.resolved_tickets}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">
                          {dept.mttr_hours} hrs
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] border',
                              dept.sla_compliance_rate >= 90
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : dept.sla_compliance_rate >= 75
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            )}
                          >
                            {dept.sla_compliance_rate}%
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        No department metrics recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
