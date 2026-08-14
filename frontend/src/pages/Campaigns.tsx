import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { formatMoney } from "@/lib/formatMoney";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AISummary } from "@/components/dashboard/AISummary";
import { BarChart3, Megaphone, Plus, Trash2 } from "lucide-react";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useState } from "react";

export default function Campaigns() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "main";
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "", budget: "", start_date: "", end_date: "", status: "draft" });
  const queryClient = useQueryClient();
  const { data: campaigns, isLoading } = useQuery({ queryKey: ["campaigns"], queryFn: () => api.get<any[]>("/campaigns/") });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/campaigns", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["campaigns"] }); setShowForm(false); setForm({ name: "", channel: "", budget: "", start_date: "", end_date: "", status: "draft" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/campaigns/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  return (
    <ErrorBoundary>
      {tab === "analytics" ? (
        <AISummary section="campaigns" title="Campaigns AI Summary" />
      ) : (
        <div className="space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
          

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>{showForm ? "Cancel Form" : "New Campaign"}</span>
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, budget: parseFloat(form.budget) || 0 }); }}
            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 shadow-xl animate-fade-in"
          >
            <input
              placeholder="Campaign Name *"
              value={form.name}
              onChange={(e) => setForm(p => ({...p, name: e.target.value}))}
              required
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <input
              placeholder="Channel (Meta, Google)"
              value={form.channel}
              onChange={(e) => setForm(p => ({...p, channel: e.target.value}))}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Budget (\u20b9)"
              value={form.budget}
              onChange={(e) => setForm(p => ({...p, budget: e.target.value}))}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm(p => ({...p, start_date: e.target.value}))}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm(p => ({...p, end_date: e.target.value}))}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? "Saving..." : "Save Campaign"}
            </button>
          </form>
        )}

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          {isLoading ? (
            <TableSkeleton />
          ) : !campaigns?.length ? (
            <EmptyState title="No campaigns recorded" description="Start by launching a new marketing campaign." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Campaign Name</th>
                    <th className="py-3 px-4 font-semibold">Channel</th>
                    <th className="py-3 px-4 font-semibold text-right">Budget</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Success Rate</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {campaigns.map((c: any) => (
                    <tr key={c.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">{c.name}</td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">
                        <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                          {c.channel || "General"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-white">{formatMoney(c.budget)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase border ${
                          c.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-400">
                        {((c.success_rate || 0) * 100).toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => deleteMutation.mutate(c.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete Campaign"
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
    
      )}
    </ErrorBoundary>
  );
}
