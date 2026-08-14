import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/lib/authStore";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AISummary } from "@/components/dashboard/AISummary";
import { BarChart3, Calendar, Filter, ShoppingCart, Store } from "lucide-react";
import { TableSkeleton } from "@/components/shared/Skeleton";

import { useSocketRefresh } from "../hooks/useSocketRefresh";

function fmtINR(n: number) {
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `\u20b9${(n / 1000).toFixed(1)}K`;
  return `\u20b9${n.toLocaleString("en-IN")}`;
}

export default function Operations() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "main";
  useSocketRefresh(["operations"]);
  const { token } = useAuthStore();
  const [sheetsData, setSheetsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("");
  const [tlFilter, setTlFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

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

  const filteredData = useMemo(() => {
    return opsData.filter((r: any) => {
      if (!r.store || r.store === "STORE NAME") return false;
      if (storeFilter && r.store !== storeFilter) return false;
      if (tlFilter && r.tl !== tlFilter) return false;
      if (dateFilter && r.date !== dateFilter) return false;
      return true;
    });
  }, [opsData, storeFilter, tlFilter, dateFilter]);

  const uniqueStores = useMemo((): string[] => {
    const ss = new Set<string>(opsData.map((r: any) => r.store).filter(Boolean));
    return Array.from(ss).sort();
  }, [opsData]);

  const uniqueTLs = useMemo((): string[] => {
    const tls = new Set<string>(opsData.map((r: any) => r.tl).filter(Boolean));
    return Array.from(tls).sort();
  }, [opsData]);

  const uniqueDates = useMemo((): string[] => {
    const ds = new Set<string>(opsData.map((r: any) => r.date).filter(Boolean));
    return Array.from(ds).sort().reverse();
  }, [opsData]);

  const totalRevenue = filteredData.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
  const totalUnits = filteredData.reduce((s: number, r: any) => s + (r.units_sold || 0), 0);
  const totalWalkins = filteredData.reduce((s: number, r: any) => s + (r.walk_ins || 0), 0);
  const totalConversions = filteredData.reduce((s: number, r: any) => s + (r.walk_in_conversions || 0), 0);

  return (
    <ErrorBoundary>
      {tab === "analytics" ? (
        <AISummary section="operations" title="Operations AI Summary" />
      ) : (
        <div className="space-y-6">

        

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Revenue", value: fmtINR(totalRevenue), color: "#3b82f6" },
            { label: "Units Sold", value: totalUnits.toLocaleString(), color: "#10b981" },
            { label: "Walk-ins", value: totalWalkins.toLocaleString(), color: "#a855f7" },
            { label: "Conversions", value: totalConversions.toLocaleString(), color: "#f59e0b" },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{k.label}</p>
              <p className="text-xl font-extrabold text-white">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-2xl flex-wrap">
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
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none max-w-[200px] w-full"
          >
            <option value="">All Dates</option>
            {[...uniqueDates].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <span className="text-xs text-[var(--text-muted)]">{filteredData.length} records</span>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          {loading ? (
            <TableSkeleton rows={5} cols={7} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Store</th>
                    <th className="py-3 px-4 font-semibold">TL</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold text-right">Revenue</th>
                    <th className="py-3 px-4 font-semibold text-right">Units</th>
                    <th className="py-3 px-4 font-semibold text-right">Walk-ins</th>
                    <th className="py-3 px-4 font-semibold text-right">Conversions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredData.slice(0, 200).map((sub: any, i: number) => (
                    <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2.5">
                        <Store size={15} className="text-[var(--accent-blue)] shrink-0" />
                        <span>{sub.store}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{sub.tl}</td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)] font-medium">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                          <Calendar size={13} className="text-[var(--text-muted)]" />
                          {sub.date}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-white">{fmtINR(sub.revenue || 0)}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{sub.units_sold || 0}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{sub.walk_ins || 0}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-emerald-400">{sub.walk_in_conversions || 0}</td>
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
