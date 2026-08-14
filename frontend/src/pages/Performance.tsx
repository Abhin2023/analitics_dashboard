import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/lib/authStore";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AISummary } from "@/components/dashboard/AISummary";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { BarChart3, Award, Filter } from "lucide-react";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

function fmtINR(n: number) {
  if (n >= 10000000) return `\u20b9${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `\u20b9${(n / 1000).toFixed(1)}K`;
  return `\u20b9${n.toLocaleString("en-IN")}`;
}

export default function Performance() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "main";
  useSocketRefresh(["performance"]);
  const { token } = useAuthStore();
  const [sheetsData, setSheetsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tlFilter, setTlFilter] = useState("");

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ceo-dashboard/sheets-data?tab=all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (!d.error) setSheetsData(d);
      }
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchSheets(); }, [fetchSheets]);

  const opsData = sheetsData?.ops_data || [];
  const storeConfig = sheetsData?.store_config || [];

  const storeScores = useMemo(() => {
    const map: Record<string, { revenue: number; target: number; walkins: number; conversions: number; leads: number; callsMade: number; callsConnected: number; tl: string }> = {};
    for (const r of opsData) {
      if (!r.store || r.store === "STORE NAME") continue;
      if (!map[r.store]) map[r.store] = { revenue: 0, target: 0, walkins: 0, conversions: 0, leads: 0, callsMade: 0, callsConnected: 0, tl: r.tl };
      map[r.store].revenue += r.revenue || 0;
      map[r.store].target += r.monthly_target || 0;
      map[r.store].walkins += r.walk_ins || 0;
      map[r.store].conversions += r.walk_in_conversions || 0;
      map[r.store].leads += r.new_leads || 0;
      map[r.store].callsMade += r.calls_made || 0;
      map[r.store].callsConnected += r.calls_connected || 0;
      map[r.store].tl = r.tl;
    }
    return Object.entries(map)
      .map(([name, d]) => {
        const revAch = d.target > 0 ? d.revenue / d.target : 0;
        const convRate = d.walkins > 0 ? d.conversions / d.walkins : 0;
        const callRate = d.callsMade > 0 ? d.callsConnected / d.callsMade : 0;
        const totalScore = (revAch * 0.5 + convRate * 0.3 + callRate * 0.2);
        let band = "Below Target";
        let multiplier = 0.8;
        if (totalScore >= 1.0) { band = "Exceeds"; multiplier = 1.2; }
        else if (totalScore >= 0.8) { band = "Meets"; multiplier = 1.0; }
        else if (totalScore >= 0.6) { band = "Approaching"; multiplier = 0.9; }
        return { name, ...d, revAch: revAch * 100, convRate: convRate * 100, callRate: callRate * 100, totalScore, band, multiplier };
      })
      .filter((s) => {
        if (tlFilter && s.tl !== tlFilter) return false;
        return true;
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [opsData, tlFilter]);

  const uniqueTLs = useMemo((): string[] => {
    const tls = new Set<string>(opsData.map((r: any) => r.tl).filter(Boolean));
    return Array.from(tls).sort();
  }, [opsData]);

  return (
    <ErrorBoundary>
      {tab === "analytics" ? (
        <AISummary section="performance" title="Performance AI Summary" />
      ) : (
        <div className="space-y-6">

        

        {/* Incentive Bands */}
        <div className="flex items-center gap-3 flex-wrap bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 rounded-2xl">
          <Award size={18} className="text-[var(--accent-blue)] shrink-0" />
          {[
            { name: "Exceeds", label: "100%+ score", color: "#10b981" },
            { name: "Meets", label: "80-99%", color: "#3b82f6" },
            { name: "Approaching", label: "60-79%", color: "#f59e0b" },
            { name: "Below Target", label: "<60%", color: "#ef4444" },
          ].map((b) => (
            <div key={b.name} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3.5 py-1.5 text-xs flex items-center gap-2">
              <span className="font-semibold text-white">{b.name}:</span>
              <span className="text-[var(--text-secondary)]">{b.label}</span>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-2xl">
          <Filter size={16} className="text-[var(--text-muted)] ml-1 shrink-0" />
          <select
            value={tlFilter}
            onChange={(e) => setTlFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none max-w-[200px] w-full"
          >
            <option value="">All TLs</option>
            {[...uniqueTLs].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Store</th>
                    <th className="py-3 px-4 font-semibold">TL</th>
                    <th className="py-3 px-4 font-semibold text-right">Total Score</th>
                    <th className="py-3 px-4 font-semibold">Band</th>
                    <th className="py-3 px-4 font-semibold text-right">Revenue vs Target</th>
                    <th className="py-3 px-4 font-semibold text-right">Conv Rate</th>
                    <th className="py-3 px-4 font-semibold text-right">Call Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {storeScores.map((s, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">{s.name}</td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{s.tl}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-white">
                        {(s.totalScore * 100).toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          s.band === "Exceeds" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          s.band === "Meets" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          s.band === "Approaching" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>{s.band}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[var(--text-secondary)]">
                        {s.revAch.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[var(--text-secondary)]">
                        {s.convRate.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[var(--text-secondary)]">
                        {s.callRate.toFixed(1)}%
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
