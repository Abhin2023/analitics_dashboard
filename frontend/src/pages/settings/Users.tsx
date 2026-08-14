import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { useState } from "react";
import { Users, Plus, Trash2, ShieldCheck, UserCheck } from "lucide-react";

export default function UserManagement() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role_id: "", store_ids: "" });
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => api.get<any[]>("/users/") });
  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: () => api.get<any[]>("/roles/") });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/users", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="text-[var(--accent-blue)]" size={22} />
              User Management
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Manage system access accounts, roles, and assigned store IDs
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>{showForm ? "Cancel Form" : "Create User"}</span>
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                ...form, role_id: Number(form.role_id),
                store_ids: form.store_ids ? form.store_ids.split(",").map(Number) : [],
              });
            }}
            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 shadow-xl animate-fade-in"
          >
            <input
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm(p => ({...p, name: e.target.value}))}
              required
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email *"
              value={form.email}
              onChange={(e) => setForm(p => ({...p, email: e.target.value}))}
              required
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password *"
              value={form.password}
              onChange={(e) => setForm(p => ({...p, password: e.target.value}))}
              required
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <select
              value={form.role_id}
              onChange={(e) => setForm(p => ({...p, role_id: e.target.value}))}
              required
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            >
              <option value="">Select Role *</option>
              {(roles || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input
              placeholder="Store IDs (e.g. 1, 2)"
              value={form.store_ids}
              onChange={(e) => setForm(p => ({...p, store_ids: e.target.value}))}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="sm:col-span-2 lg:col-span-5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? "Creating User..." : "Create User Account"}
            </button>
          </form>
        )}

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">User</th>
                    <th className="py-3 px-4 font-semibold">Email</th>
                    <th className="py-3 px-4 font-semibold">Role</th>
                    <th className="py-3 px-4 font-semibold text-right">Assigned Stores</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {(users || []).map((u: any) => (
                    <tr key={u.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center text-[var(--accent-blue)] font-bold text-xs shrink-0">
                          {u.name ? u.name.charAt(0).toUpperCase() : <UserCheck size={15} />}
                        </div>
                        <span>{u.name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 capitalize">
                          {u.role_name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs font-medium text-[var(--text-secondary)]">
                        {u.store_ids?.length || 0} Stores
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.is_active ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                        }`}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => deleteMutation.mutate(u.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
