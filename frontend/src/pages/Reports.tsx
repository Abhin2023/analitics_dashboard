import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/lib/authStore";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AISummary } from "@/components/dashboard/AISummary";
import { BarChart3, Download, FileText, Filter, Trophy } from "lucide-react";
import { TableSkeleton } from "@/components/shared/Skeleton";

import { useSocketRefresh } from "../hooks/useSocketRefresh";

function fmtINR(n: number) {
  if (n >= 10000000) return `\u20b9${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `\u20b9${(n / 1000).toFixed(1)}K`;
  return `\u20b9${n.toLocaleString("en-IN")}`;
}

export default function Reports() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "main";
  useSocketRefresh(["reports"]);
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
  const tlReport = sheetsData?.tl_report || [];
  const storeConfig = sheetsData?.store_config || [];

  const leaderboard = useMemo(() => {
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
      .map(([name, d]) => ({
        name, ...d,
        achPct: d.target > 0 ? (d.revenue / d.target * 100) : 0,
        convPct: d.walkins > 0 ? Math.round((d.conversions / d.walkins) * 100) : 0,
      }))
      .filter((s) => {
        if (tlFilter && s.tl !== tlFilter) return false;
        return true;
      })
      .sort((a, b) => b.achPct - a.achPct);
  }, [opsData, tlFilter]);

  const uniqueTLs = useMemo((): string[] => {
    const tls = new Set<string>(opsData.map((r: any) => r.tl).filter(Boolean));
    return Array.from(tls).sort();
  }, [opsData]);

  const totalRevenue = leaderboard.reduce((s, r) => s + r.revenue, 0);
  const totalTarget = leaderboard.reduce((s, r) => s + r.target, 0);

  return (
    <ErrorBoundary>
      {tab === "analytics" ? (
        <AISummary section="reports" title="Reports AI Summary" />
      ) : (
        <div className="space-y-6">

        

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Stores", value: String(leaderboard.length), color: "#3b82f6" },
            { label: "Total Revenue", value: fmtINR(totalRevenue), color: "#10b981" },
            { label: "Overall Achievement", value: `${totalTarget > 0 ? Math.round(totalRevenue / totalTarget * 100) : 0}%`, color: "#f59e0b" },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{k.label}</p>
              <p className="text-xl font-extrabold text-white">{k.value}</p>
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

        {/* Leaderboard */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Store Leaderboard</h3>
          </div>

          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Rank</th>
                    <th className="py-3 px-4 font-semibold">Store</th>
                    <th className="py-3 px-4 font-semibold">TL</th>
                    <th className="py-3 px-4 font-semibold text-right">Revenue</th>
                    <th className="py-3 px-4 font-semibold text-right">Target</th>
                    <th className="py-3 px-4 font-semibold text-right">Achievement</th>
                    <th className="py-3 px-4 font-semibold text-right">Walk-ins</th>
                    <th className="py-3 px-4 font-semibold text-right">Conv%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {leaderboard.map((s, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">
                        <span className={`h-6 w-6 rounded-full inline-flex items-center justify-center text-xs ${
                          i === 0 ? "bg-amber-400/20 text-amber-400 border border-amber-400/40" :
                          i === 1 ? "bg-zinc-300/20 text-zinc-300 border border-zinc-300/40" :
                          i === 2 ? "bg-amber-700/20 text-amber-600 border border-amber-700/40" :
                          "text-[var(--text-muted)]"
                        }`}>
                          #{i + 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">{s.name}</td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{s.tl}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-white">{fmtINR(s.revenue)}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{fmtINR(s.target)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`font-bold ${s.achPct >= 65 ? "text-emerald-400" : s.achPct >= 35 ? "text-amber-400" : "text-rose-400"}`}>
                          {s.achPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{s.walkins}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{s.convPct}%</td>
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
