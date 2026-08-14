import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { useState } from "react";
import { Coins, Plus, Trash2 } from "lucide-react";

export default function CurrencySettings() {
  const [rateForm, setRateForm] = useState({ currency_code: "USD", rate_to_base: "", effective_date: new Date().toISOString().split("T")[0] });
  const queryClient = useQueryClient();
  const { data: currencies } = useQuery({ queryKey: ["currencies"], queryFn: () => api.get<any[]>("/currencies/") });
  const { data: rates, isLoading: ratesLoading } = useQuery({ queryKey: ["exchange-rates"], queryFn: () => api.get<any[]>("/currencies/exchange-rates") });

  const createRate = useMutation({
    mutationFn: (data: any) => api.post("/currencies/exchange-rates", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["exchange-rates"] }); setRateForm({ currency_code: "USD", rate_to_base: "", effective_date: new Date().toISOString().split("T")[0] }); },
  });

  const deleteRate = useMutation({
    mutationFn: (id: number) => api.del(`/currencies/exchange-rates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exchange-rates"] }),
  });

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Coins className="text-[var(--accent-blue)]" size={22} />
            Currency & Exchange Rates
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Configure system base currency and historical exchange rates
          </p>
        </div>

        {/* Supported Currencies */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 space-y-3">
          <h3 className="text-base font-bold text-white tracking-tight">Active Currencies</h3>
          <div className="flex items-center gap-3 flex-wrap">
            {(currencies || []).map((c: any) => (
              <div key={c.code} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-xs flex items-center gap-2">
                <span className="font-bold text-white">{c.symbol} {c.code}</span>
                <span className="text-[var(--text-muted)]">{c.name}</span>
                {c.code === "INR" && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30">
                    Base Currency
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add Rate Form */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight">Add Exchange Rate Entry</h3>
          <form
            onSubmit={(e) => { e.preventDefault(); createRate.mutate({ ...rateForm, rate_to_base: parseFloat(rateForm.rate_to_base) }); }}
            className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 flex-wrap"
          >
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">Currency</label>
              <select
                value={rateForm.currency_code}
                onChange={(e) => setRateForm(p => ({...p, currency_code: e.target.value}))}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs font-semibold text-white focus:outline-none"
              >
                {(currencies || []).filter((c: any) => c.code !== "INR").map((c: any) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">Rate to INR (\u20b9)</label>
              <input
                type="number"
                step="0.000001"
                placeholder="Rate to INR"
                value={rateForm.rate_to_base}
                onChange={(e) => setRateForm(p => ({...p, rate_to_base: e.target.value}))}
                required
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">Effective Date</label>
              <input
                type="date"
                value={rateForm.effective_date}
                onChange={(e) => setRateForm(p => ({...p, effective_date: e.target.value}))}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={createRate.isPending}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Plus size={15} />
              <span>{createRate.isPending ? "Adding..." : "Add Rate"}</span>
            </button>
          </form>
        </div>

        {/* Rate History Table */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          <h3 className="text-base font-bold text-white tracking-tight mb-4">Exchange Rate History</h3>
          {ratesLoading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Currency</th>
                    <th className="py-3 px-4 font-semibold text-right">Rate to INR</th>
                    <th className="py-3 px-4 font-semibold">Effective Date</th>
                    <th className="py-3 px-4 font-semibold">Source</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {(rates || []).map((r: any) => (
                    <tr key={r.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">{r.currency_code}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-white">{r.rate_to_base}</td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{r.effective_date}</td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-muted)]">{r.source}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => deleteRate.mutate(r.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete Rate"
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
