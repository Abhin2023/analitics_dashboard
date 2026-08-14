import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useState, useEffect } from "react";
import { Sliders, Save, AlertCircle, Award } from "lucide-react";

export default function KPIWeights() {
  const [weights, setWeights] = useState<{ kpi_name: string; weight: number }[]>([]);
  const queryClient = useQueryClient();
  const { data: kpis } = useQuery({ queryKey: ["kpi-weights"], queryFn: () => api.get<any[]>("/settings/kpi-weights") });
  const { data: bands } = useQuery({ queryKey: ["bands"], queryFn: () => api.get<any[]>("/settings/incentive-bands") });

  useEffect(() => {
    if (kpis) setWeights(kpis.map((k: any) => ({ kpi_name: k.kpi_name, weight: k.weight })));
  }, [kpis]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put("/settings/kpi-weights", { weights: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kpi-weights"] }),
  });

  const updateWeight = (name: string, val: number) => {
    setWeights(prev => prev.map(w => w.kpi_name === name ? { ...w, weight: val } : w));
  };

  const total = weights.reduce((s, w) => s + w.weight, 0);

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sliders className="text-[var(--accent-blue)]" size={22} />
            KPI Weights & Incentive Bands
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Configure target weightings for performance formulas and bonus multiplier tiers
          </p>
        </div>

        {/* Weights Card */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight">KPI Weight Distribution</h3>

          <div className="space-y-3">
            {weights.map((w) => (
              <div key={w.kpi_name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                <span className="text-xs font-semibold text-white">{w.kpi_name}</span>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={w.weight}
                    onChange={(e) => updateWeight(w.kpi_name, parseFloat(e.target.value) || 0)}
                    className="w-28 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-semibold text-white focus:outline-none"
                  />
                  <span className="text-xs font-bold text-[var(--accent-blue)] min-w-[40px] text-right">
                    {(w.weight * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                Math.abs(total - 1) < 0.01
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}>
                Total Weight: {(total * 100).toFixed(0)}%
              </span>
              {Math.abs(total - 1) >= 0.01 && (
                <span className="text-xs text-rose-400 font-medium">Weights must equal 100%</span>
              )}
            </div>

            <button
              onClick={() => saveMutation.mutate(weights)}
              disabled={Math.abs(total - 1) > 0.01 || saveMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Save size={16} />
              <span>{saveMutation.isPending ? "Saving Weights..." : "Save KPI Weights"}</span>
            </button>
          </div>
        </div>

        {/* Incentive Bands Card */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Incentive Multiplier Bands</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                  <th className="py-3 px-4 font-semibold">Band Name</th>
                  <th className="py-3 px-4 font-semibold text-right">Min KPI Score</th>
                  <th className="py-3 px-4 font-semibold text-right">Multiplier</th>
                  <th className="py-3 px-4 font-semibold">Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {(bands || []).map((b: any) => (
                  <tr key={b.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">{b.band_name}</td>
                    <td className="py-3.5 px-4 text-right text-xs font-semibold text-[var(--text-secondary)]">{b.min_kpi_score}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-400">{b.multiplier}x</td>
                    <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{b.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
