import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/lib/authStore";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AISummary } from "@/components/dashboard/AISummary";
import { BarChart3, Filter, Store, TrendingUp } from "lucide-react";
import { TableSkeleton } from "@/components/shared/Skeleton";

import { useSocketRefresh } from "../hooks/useSocketRefresh";

function fmtINR(n: number) {
  if (n >= 10000000) return `\u20b9${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `\u20b9${(n / 1000).toFixed(1)}K`;
  return `\u20b9${n.toLocaleString("en-IN")}`;
}

export default function SalesOverview() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "main";
  useSocketRefresh(["sales"]);
  const { token } = useAuthStore();
  const [sheetsData, setSheetsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("");
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

  const stores = useMemo(() => {
    const map: Record<string, { revenue: number; target: number; units: number; walkins: number; conversions: number; tl: string; country: string }> = {};
    for (const r of opsData) {
      const key = r.store;
      if (!key || key === "STORE NAME") continue;
      if (!map[key]) map[key] = { revenue: 0, target: 0, units: 0, walkins: 0, conversions: 0, tl: r.tl, country: r.country };
      map[key].revenue += r.revenue || 0;
      map[key].target += r.monthly_target || 0;
      map[key].units += r.units_sold || 0;
      map[key].walkins += r.walk_ins || 0;
      map[key].conversions += r.walk_in_conversions || 0;
      map[key].tl = r.tl;
    }
    return Object.entries(map)
      .map(([name, d]) => ({
        name, ...d,
        achievement: d.target > 0 ? (d.revenue / d.target * 100) : 0,
      }))
      .filter((s) => {
        if (storeFilter && !s.name.toLowerCase().includes(storeFilter.toLowerCase())) return false;
        if (tlFilter && s.tl !== tlFilter) return false;
        return true;
      })
      .sort((a, b) => b.achievement - a.achievement);
  }, [opsData, storeFilter, tlFilter]);

  const uniqueTLs = useMemo((): string[] => {
    const tls = new Set<string>(opsData.map((r: any) => r.tl).filter(Boolean));
    return Array.from(tls).sort();
  }, [opsData]);

  const uniqueStores = useMemo((): string[] => {
    const ss = new Set<string>(opsData.map((r: any) => r.store).filter(Boolean));
    return Array.from(ss).sort();
  }, [opsData]);

  const totalRevenue = stores.reduce((s, st) => s + st.revenue, 0);
  const totalTarget = stores.reduce((s, st) => s + st.target, 0);
  const totalUnits = stores.reduce((s, st) => s + st.units, 0);
  const overallAch = totalTarget > 0 ? (totalRevenue / totalTarget * 100) : 0;

  return (
    <ErrorBoundary>
      {tab === "analytics" ? (
        <AISummary section="sales" title="Sales Overview AI Summary" />
      ) : (
        <div className="space-y-6">

        

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: fmtINR(totalRevenue), color: "#3b82f6" },
            { label: "Total Target", value: fmtINR(totalTarget), color: "#10b981" },
            { label: "Achievement", value: `${overallAch.toFixed(1)}%`, color: overallAch >= 50 ? "#10b981" : "#f59e0b" },
            { label: "Total Units", value: totalUnits.toLocaleString(), color: "#a855f7" },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{k.label}</p>
              <p className="text-xl font-extrabold text-white">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-2xl">
          <Filter size={16} className="text-[var(--text-muted)] ml-1 shrink-0" />
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none max-w-[200px] w-full"
          >
            <option value="">All Stores</option>
            {[...uniqueStores].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
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
            <TableSkeleton rows={8} cols={6} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Store</th>
                    <th className="py-3 px-4 font-semibold">TL</th>
                    <th className="py-3 px-4 font-semibold text-right">Revenue</th>
                    <th className="py-3 px-4 font-semibold text-right">Units</th>
                    <th className="py-3 px-4 font-semibold text-right">Target</th>
                    <th className="py-3 px-4 font-semibold text-right">Achievement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {stores.map((s, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-blue)] shrink-0">
                          <Store size={15} />
                        </div>
                        <span>{s.name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{s.tl}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-white">{fmtINR(s.revenue)}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{s.units}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{fmtINR(s.target)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="w-24 h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(s.achievement, 100)}%`,
                                backgroundColor: s.achievement >= 65 ? "#10b981" : s.achievement >= 35 ? "#f59e0b" : "#ef4444",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-primary)] min-w-[42px] text-right">
                            {s.achievement.toFixed(1)}%
                          </span>
                        </div>
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
