import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/lib/authStore";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AISummary } from "@/components/dashboard/AISummary";
import { BarChart3, Store, TrendingUp, Users } from "lucide-react";
import { TableSkeleton } from "@/components/shared/Skeleton";

import { useSocketRefresh } from "../hooks/useSocketRefresh";

function fmtINR(n: number) {
  if (n >= 10000000) return `\u20b9${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `\u20b9${(n / 1000).toFixed(1)}K`;
  return `\u20b9${n.toLocaleString("en-IN")}`;
}

export default function TeamLeaders() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "main";
  useSocketRefresh(["team-leaders"]);
  const { token } = useAuthStore();
  const [sheetsData, setSheetsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const tls = useMemo(() => {
    const tlMap: Record<string, { revenue: number; target: number; walkins: number; conv: number; stores: string[]; leads: number; convPct: number }> = {};
    for (const r of opsData) {
      if (!r.tl || r.tl === "TEAM LEADER") continue;
      if (!tlMap[r.tl]) tlMap[r.tl] = { revenue: 0, target: 0, walkins: 0, conv: 0, stores: [], leads: 0, convPct: 0 };
      tlMap[r.tl].revenue += r.revenue || 0;
      tlMap[r.tl].target += r.monthly_target || 0;
      tlMap[r.tl].walkins += r.walk_ins || 0;
      tlMap[r.tl].conv += r.walk_in_conversions || 0;
      tlMap[r.tl].leads += r.new_leads || 0;
      if (!tlMap[r.tl].stores.includes(r.store)) tlMap[r.tl].stores.push(r.store);
    }
    return Object.entries(tlMap)
      .map(([name, d]) => ({
        name, ...d,
        achPct: d.target > 0 ? (d.revenue / d.target * 100) : 0,
        convPct: d.walkins > 0 ? Math.round((d.conv / d.walkins) * 100) : 0,
      }))
      .sort((a, b) => b.achPct - a.achPct);
  }, [opsData]);

  const totalRevenue = tls.reduce((s, t) => s + t.revenue, 0);
  const totalTarget = tls.reduce((s, t) => s + t.target, 0);

  return (
    <ErrorBoundary>
      {tab === "analytics" ? (
        <AISummary section="team_leaders" title="Team Leaders AI Summary" />
      ) : (
        <div className="space-y-6">

        

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total TLs", value: String(tls.length), color: "#3b82f6" },
            { label: "Total Revenue", value: fmtINR(totalRevenue), color: "#10b981" },
            { label: "Total Target", value: fmtINR(totalTarget), color: "#a855f7" },
            { label: "Overall Achievement", value: `${totalTarget > 0 ? Math.round(totalRevenue / totalTarget * 100) : 0}%`, color: "#f59e0b" },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{k.label}</p>
              <p className="text-xl font-extrabold text-white">{k.value}</p>
            </div>
          ))}
        </div>

        {/* TL Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tls.map((tl, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: tl.achPct >= 65 ? "#10b981" : tl.achPct >= 35 ? "#f59e0b" : "#ef4444" }} />
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-white">{tl.name}</span>
                <span className="text-xl font-extrabold" style={{ color: tl.achPct >= 65 ? "#10b981" : tl.achPct >= 35 ? "#f59e0b" : "#ef4444" }}>{tl.achPct.toFixed(0)}%</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)] mb-3">
                <span className="flex items-center gap-1"><TrendingUp size={12} /> {fmtINR(tl.revenue)} / {fmtINR(tl.target)}</span>
                <span className="flex items-center gap-1"><Store size={12} /> {tl.stores.length} stores</span>
                <span>{tl.walkins} walkins</span>
                <span>{tl.conv} conv ({tl.convPct}%)</span>
              </div>
              <div className="w-full bg-[var(--border-subtle)] rounded-full h-2 overflow-hidden mb-2">
                <div className="h-full rounded-full" style={{ width: `${Math.min(tl.achPct, 100)}%`, background: tl.achPct >= 65 ? "#10b981" : tl.achPct >= 35 ? "#f59e0b" : "#ef4444" }} />
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">Stores: <span className="text-[var(--text-secondary)]">{tl.stores.map((s) => s).join(", ")}</span></p>
            </div>
          ))}
        </div>

        {/* TL Table */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Team Leader</th>
                    <th className="py-3 px-4 font-semibold text-right">Revenue</th>
                    <th className="py-3 px-4 font-semibold text-right">Target</th>
                    <th className="py-3 px-4 font-semibold text-right">Achievement</th>
                    <th className="py-3 px-4 font-semibold text-right">Walk-ins</th>
                    <th className="py-3 px-4 font-semibold text-right">Stores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {tls.map((tl, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center text-[var(--accent-blue)] font-bold text-xs shrink-0">
                          {tl.name.charAt(0)}
                        </div>
                        <span className="font-semibold">{tl.name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-white">{fmtINR(tl.revenue)}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{fmtINR(tl.target)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="w-24 h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden shrink-0">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(tl.achPct, 100)}%`, background: tl.achPct >= 65 ? "#10b981" : tl.achPct >= 35 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-primary)] min-w-[42px] text-right">{tl.achPct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{tl.walkins}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-white">
                          {tl.stores.length}
                        </span>
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
