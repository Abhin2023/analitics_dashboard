import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/lib/authStore";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AISummary } from "@/components/dashboard/AISummary";
import { Filter, Store, RefreshCw } from "lucide-react";
import { TableSkeleton } from "@/components/shared/Skeleton";

import { useSocketRefresh } from "../hooks/useSocketRefresh";

const COUNTRY_COLORS: Record<string, string> = {
  India: "#3b82f6",
  UAE: "#10b981",
  Oman: "#f59e0b",
  Qatar: "#a855f7",
  Pakistan: "#ef4444",
  Malaysia: "#06b6d4",
  UK: "#ec4899",
  Bahrain: "#f97316",
};

function fmtCurrency(n: number, country: string) {
  switch (country) {
    case "India": {
      if (n >= 10000000) return `\u20b9${(n / 10000000).toFixed(2)} Cr`;
      if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`;
      if (n >= 1000) return `\u20b9${(n / 1000).toFixed(1)}K`;
      return `\u20b9${n.toLocaleString("en-IN")}`;
    }
    case "UAE": return `AED ${(n / 1000).toFixed(1)}K`;
    case "Oman": return `OMR ${(n / 1000).toFixed(1)}K`;
    case "Qatar": return `QAR ${(n / 1000).toFixed(1)}K`;
    case "Pakistan": return `PKR ${(n / 100000).toFixed(1)}L`;
    case "Malaysia": return `MYR ${(n / 1000).toFixed(1)}K`;
    case "UK": return `\u00a3${(n / 1000).toFixed(1)}K`;
    case "Bahrain": return `BHD ${(n / 1000).toFixed(1)}K`;
    default: return `$${(n / 1000).toFixed(1)}K`;
  }
}

function fmtShort(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

export default function SalesOverview() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "main";
  useSocketRefresh(["sales"]);
  const { token } = useAuthStore();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/mcp/branches", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBranches(await res.json());
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const stores = useMemo(() => {
    return branches
      .filter((b) => {
        if (storeFilter && !b.shop.toLowerCase().includes(storeFilter.toLowerCase())) return false;
        if (countryFilter && b.country !== countryFilter) return false;
        return true;
      })
      .sort((a, b) => b.achievement_pct - a.achievement_pct);
  }, [branches, storeFilter, countryFilter]);

  const uniqueCountries = useMemo(() => {
    const cs = new Set<string>(branches.map((b: any) => b.country).filter(Boolean));
    return Array.from(cs).sort();
  }, [branches]);

  const uniqueStores = useMemo(() => {
    const ss = new Set<string>(branches.map((b: any) => b.shop).filter(Boolean));
    return Array.from(ss).sort();
  }, [branches]);

  const totalRevenue = stores.reduce((s, st) => s + (st.actual || 0), 0);
  const totalTarget = stores.reduce((s, st) => s + (st.target || 0), 0);
  const overallAch = totalTarget > 0 ? (totalRevenue / totalTarget * 100) : 0;
  const countryCount = uniqueCountries.length;

  return (
    <ErrorBoundary>
      {tab === "analytics" ? (
        <AISummary section="sales" title="Sales Overview AI Summary" />
      ) : (
        <div className="space-y-6">

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Total Revenue", value: fmtShort(totalRevenue), color: "#3b82f6" },
            { label: "Total Target", value: fmtShort(totalTarget), color: "#10b981" },
            { label: "Achievement", value: `${overallAch.toFixed(1)}%`, color: overallAch >= 50 ? "#10b981" : "#f59e0b" },
            { label: "Total Branches", value: String(stores.length), color: "#a855f7" },
            { label: "Countries", value: String(countryCount), color: "#ec4899" },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{k.label}</p>
              <p className="text-xl font-extrabold text-white">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Country summary badges */}
        <div className="flex flex-wrap gap-2">
          {uniqueCountries.map((country) => {
            const count = branches.filter((b) => b.country === country).length;
            const rev = branches.filter((b) => b.country === country).reduce((s, b) => s + (b.actual || 0), 0);
            return (
              <button
                key={country}
                onClick={() => setCountryFilter(countryFilter === country ? "" : country)}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  countryFilter === country
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-white/5 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-white/8"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: COUNTRY_COLORS[country] || "#6b7280" }} />
                {country} ({count}) — {fmtShort(rev)}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-2xl">
          <Filter size={16} className="text-[var(--text-muted)] ml-1 shrink-0" />
          <input
            type="text"
            placeholder="Search stores..."
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none max-w-[200px] w-full"
          />
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none max-w-[200px] w-full"
          >
            <option value="">All Countries</option>
            {uniqueCountries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={fetchBranches}
            disabled={loading}
            className="ml-auto flex items-center gap-2 px-3 py-2 text-xs rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          {loading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : stores.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">No branch data available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">#</th>
                    <th className="py-3 px-4 font-semibold">Store</th>
                    <th className="py-3 px-4 font-semibold">Country</th>
                    <th className="py-3 px-4 font-semibold text-right">Revenue</th>
                    <th className="py-3 px-4 font-semibold text-right">Target</th>
                    <th className="py-3 px-4 font-semibold text-right">Achievement</th>
                    <th className="py-3 px-4 font-semibold text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {stores.map((s, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 text-xs text-[var(--text-muted)]">{i + 1}</td>
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                          <Store size={15} style={{ color: COUNTRY_COLORS[s.country] || "#6b7280" }} />
                        </div>
                        <span>{s.shop}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border" style={{
                          borderColor: `${COUNTRY_COLORS[s.country] || "#6b7280"}40`,
                          backgroundColor: `${COUNTRY_COLORS[s.country] || "#6b7280"}15`,
                          color: COUNTRY_COLORS[s.country] || "#6b7280",
                        }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: COUNTRY_COLORS[s.country] || "#6b7280" }} />
                          {s.country}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-white">{fmtCurrency(s.actual || 0, s.country)}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{fmtCurrency(s.target || 0, s.country)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="w-24 h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(s.achievement_pct || 0, 100)}%`,
                                backgroundColor: (s.achievement_pct || 0) >= 65 ? "#10b981" : (s.achievement_pct || 0) >= 35 ? "#f59e0b" : "#ef4444",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-primary)] min-w-[42px] text-right">
                            {(s.achievement_pct || 0).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className={`py-3.5 px-4 text-right font-medium ${(s.stock_units || 0) < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {(s.stock_units || 0).toLocaleString()}
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
