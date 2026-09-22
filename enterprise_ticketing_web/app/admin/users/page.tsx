'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Building2,
  UserCheck,
  Mail,
  Key,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Department, User, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';

const ROLES: UserRole[] = ['REQUESTER', 'ASSIGNEE', 'AUTHORIZER', 'OBSERVER', 'ADMIN'];

export default function SuperAdminUsersPage() {
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New User Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFullName, setCreateFullName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('ASSIGNEE');
  const [createDeptId, setCreateDeptId] = useState<string>('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadDepartments = useCallback(async () => {
    try {
      const depts = await api.getDepartments();
      setDepartments(depts);
      if (depts.length > 0 && !createDeptId) {
        setCreateDeptId(depts[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  }, [createDeptId]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetUsers({
        page,
        limit,
        search: search.trim() || undefined,
        department_id: selectedDeptFilter ? Number(selectedDeptFilter) : undefined,
        role: (selectedRoleFilter as UserRole) || undefined,
        is_active: selectedActiveFilter !== '' ? selectedActiveFilter === 'true' : undefined,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Failed to fetch users', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedDeptFilter, selectedRoleFilter, selectedActiveFilter]);

  useEffect(() => {
    setMounted(true);
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (currentUser?.role === 'ADMIN') {
      loadUsers();
    }
  }, [currentUser, loadUsers]);

  // Handle Role Change
  const handleRoleChange = async (targetUser: User, newRole: UserRole) => {
    if (targetUser.role === newRole) return;
    setActionLoadingId(targetUser.id);
    try {
      await api.adminUpdateUser(targetUser.id, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)));
      setFeedbackMessage({
        text: `Successfully updated ${targetUser.full_name}'s role to ${newRole}`,
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Role update failed', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Department Change
  const handleDepartmentChange = async (targetUser: User, newDeptIdStr: string) => {
    const newDeptId = newDeptIdStr ? Number(newDeptIdStr) : null;
    if (targetUser.department_id === newDeptId) return;
    setActionLoadingId(targetUser.id);
    try {
      await api.adminUpdateUser(targetUser.id, { department_id: newDeptId });
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, department_id: newDeptId } : u)));
      const deptName = departments.find((d) => d.id === newDeptId)?.name || 'None';
      setFeedbackMessage({
        text: `Assigned ${targetUser.full_name} to ${deptName}`,
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Department update failed', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Active Status Toggle
  const handleToggleActive = async (targetUser: User) => {
    const newStatus = !targetUser.is_active;
    setActionLoadingId(targetUser.id);
    try {
      await api.adminUpdateUser(targetUser.id, { is_active: newStatus });
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: newStatus } : u)));
      setFeedbackMessage({
        text: `User ${targetUser.full_name} is now ${newStatus ? 'Active' : 'Deactivated'}`,
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Status toggle failed', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFullName.trim() || !createEmail.trim() || !createPassword.trim()) {
      setCreateError('Please complete all required fields');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const created = await api.adminCreateUser({
        full_name: createFullName.trim(),
        email: createEmail.trim().toLowerCase(),
        password: createPassword.trim(),
        role: createRole,
        department_id: createDeptId ? Number(createDeptId) : null,
        is_active: true,
      });
      setIsCreateModalOpen(false);
      setCreateFullName('');
      setCreateEmail('');
      setCreatePassword('');
      setFeedbackMessage({
        text: `Successfully provisioned user ${created.full_name} (${created.email})`,
        type: 'success',
      });
      loadUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  // Non-admin guard
  if (!authLoading && currentUser && currentUser.role !== 'ADMIN') {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-6 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-center space-y-4 shadow-2xl">
        <ShieldAlert className="h-12 w-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">403 Forbidden: Administrator Clearance Required</h2>
        <p className="text-sm text-slate-300">
          Super Admin User Management is restricted to system administrators with strict RBAC credentials.
        </p>
        <div className="pt-2">
          <Link href="/dashboard">
            <Button variant="secondary" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              <span>Return to Role Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-purple-400">
            <ShieldCheck className="h-6 w-6" />
            <h1 className="text-xl font-bold text-white tracking-tight">Super Admin User Management</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise RBAC governance, department queue assignments, credentials management, and account lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="secondary" size="sm" className="gap-1.5 border-slate-700 bg-slate-900/90 text-slate-200 hover:text-white">
              <Eye className="h-3.5 w-3.5 text-indigo-400" />
              <span>View Universal Org Queue</span>
            </Button>
          </Link>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-1.5 bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 font-semibold"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Provision New User</span>
          </Button>
        </div>
      </div>

      {/* Toast / Feedback Notice */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between animate-in fade-in duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
              : 'bg-rose-950/80 border-rose-700 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-white font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search user name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Department Filter */}
            <div>
              <select
                value={selectedDeptFilter}
                onChange={(e) => {
                  setSelectedDeptFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    [{dept.code}] {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={selectedRoleFilter}
                onChange={(e) => {
                  setSelectedRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">All Roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    Role: {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Active Filter */}
            <div>
              <select
                value={selectedActiveFilter}
                onChange={(e) => {
                  setSelectedActiveFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">All Statuses</option>
                <option value="true">Active Only</option>
                <option value="false">Deactivated Only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Management Table */}
      <Card className="bg-slate-900/90 border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="p-3 pl-4">User</th>
                <th className="p-3">Assigned Department</th>
                <th className="p-3">RBAC Role</th>
                <th className="p-3">Status</th>
                <th className="p-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-purple-400" />
                    <span>Loading directory accounts...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No enterprise users found matching current filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isActing = actionLoadingId === u.id;
                  const isSelf = currentUser?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Name & Email */}
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-300 shrink-0">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              {isSelf && (
                                <span className="text-[9px] bg-purple-950 border border-purple-700/60 text-purple-300 px-1 py-0.2 rounded font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                              <Mail className="h-2.5 w-2.5 text-slate-500" />
                              <span>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department Assignment Dropdown */}
                      <td className="p-3">
                        <select
                          value={u.department_id || ''}
                          onChange={(e) => handleDepartmentChange(u, e.target.value)}
                          disabled={isActing}
                          className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                        >
                          <option value="">No Department (Global / Requester)</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              [{dept.code}] {dept.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Role Changer Dropdown */}
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                          disabled={isActing || (isSelf && u.role === 'ADMIN')}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border bg-slate-950 focus:outline-none disabled:opacity-50 ${
                            u.role === 'ADMIN'
                              ? 'text-purple-300 border-purple-700/60 bg-purple-950/40'
                              : u.role === 'AUTHORIZER'
                              ? 'text-amber-300 border-amber-700/60 bg-amber-950/40'
                              : u.role === 'ASSIGNEE'
                              ? 'text-cyan-300 border-cyan-700/60 bg-cyan-950/40'
                              : 'text-slate-300 border-slate-700'
                          }`}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Status Badge */}
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            u.is_active
                              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                              : 'bg-rose-950/80 border-rose-800 text-rose-400'
                          }`}
                        >
                          {u.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      {/* Actions: Toggle Active/Deactivate */}
                      <td className="p-3 pr-4 text-right">
                        <Button
                          variant={u.is_active ? 'ghost' : 'secondary'}
                          size="sm"
                          onClick={() => handleToggleActive(u)}
                          disabled={isActing || (isSelf && u.is_active)}
                          isLoading={isActing}
                          className={`text-xs h-7 px-2.5 ${
                            u.is_active
                              ? 'text-rose-400 hover:bg-rose-950/50 hover:text-rose-300'
                              : 'text-emerald-400 hover:bg-emerald-950/50 hover:text-emerald-300'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-white">{users.length}</span> of{' '}
            <span className="font-semibold text-white">{total}</span> accounts
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-slate-300">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Provision User Modal */}
      {isCreateModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-y-auto p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="fixed inset-0" onClick={() => setIsCreateModalOpen(false)} aria-hidden="true" />
          <div className="relative z-10 my-auto w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/40 shrink-0">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-base">
                <UserPlus className="h-5 w-5" />
                <span>Provision Enterprise Account</span>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4 overflow-y-auto flex-1">
              <Input
                label="Full Name *"
                placeholder="e.g. Jordan Miller"
                value={createFullName}
                onChange={(e) => setCreateFullName(e.target.value)}
                required
              />

              <Input
                label="Corporate Email *"
                type="email"
                placeholder="jordan.miller@enterprise.local"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
              />

              <Input
                label="Initial Password *"
                type="password"
                placeholder="••••••••••••"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                minLength={6}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Role Designation *</label>
                  <Select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as UserRole)}
                    required
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Department Queue Assignment</label>
                  <Select
                    value={createDeptId}
                    onChange={(e) => setCreateDeptId(e.target.value)}
                  >
                    <option value="">None (Requester / General)</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        [{dept.code}] {dept.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {createError && (
                <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800 mt-auto shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={createLoading}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                >
                  Create & Assign
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
