import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { formatMoney } from "@/lib/formatMoney";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AISummary } from "@/components/dashboard/AISummary";
import { BarChart3, DollarSign, Plus } from "lucide-react";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useState } from "react";

export default function Investments() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "main";
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "marketing", description: "", amount: "", date: new Date().toISOString().split("T")[0], store_id: "" });
  const queryClient = useQueryClient();
  const { data: investments, isLoading } = useQuery({ queryKey: ["investments"], queryFn: () => api.get<any[]>("/investments/") });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/investments", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["investments"] }); setShowForm(false); },
  });

  return (
    <ErrorBoundary>
      {tab === "analytics" ? (
        <AISummary section="investments" title="Investments AI Summary" />
      ) : (
        <div className="space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
          

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>{showForm ? "Cancel Form" : "Log Investment"}</span>
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, amount: parseFloat(form.amount) || 0, store_id: form.store_id ? Number(form.store_id) : null }); }}
            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 shadow-xl animate-fade-in"
          >
            <select
              value={form.category}
              onChange={(e) => setForm(p => ({...p, category: e.target.value}))}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            >
              <option value="marketing">Marketing</option>
              <option value="capex">CapEx</option>
              <option value="inventory">Inventory</option>
              <option value="rent">Rent</option>
              <option value="other">Other</option>
            </select>
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm(p => ({...p, description: e.target.value}))}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount (\u20b9) *"
              value={form.amount}
              onChange={(e) => setForm(p => ({...p, amount: e.target.value}))}
              required
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm(p => ({...p, date: e.target.value}))}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? "Saving..." : "Save Investment"}
            </button>
          </form>
        )}

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          {isLoading ? (
            <TableSkeleton />
          ) : !investments?.length ? (
            <EmptyState title="No investments logged" description="Start by logging a marketing or capital expenditure." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Description</th>
                    <th className="py-3 px-4 font-semibold">Store</th>
                    <th className="py-3 px-4 font-semibold text-right">Amount</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {investments.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase bg-[var(--accent-purple)]/10 text-[var(--accent-purple)] border border-[var(--accent-purple)]/20">
                          {inv.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{inv.description || "-"}</td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{inv.store_name}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-white">{formatMoney(inv.amount)}</td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{inv.date}</td>
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
