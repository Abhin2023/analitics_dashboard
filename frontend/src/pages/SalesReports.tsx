import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { BarChart3, Calendar, CalendarDays, CalendarRange, AlertTriangle, Users, Store, MapPin, Layers } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Granularity = "day" | "week" | "month";
type GroupBy = "none" | "team_leader" | "branch" | "region";

function fmtINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const GRANULARITY_OPTIONS: { key: Granularity; label: string; icon: any }[] = [
  { key: "day", label: "Daily", icon: Calendar },
  { key: "week", label: "Weekly", icon: CalendarDays },
  { key: "month", label: "Monthly", icon: CalendarRange },
];

const GROUP_BY_OPTIONS: { key: GroupBy; label: string; icon: any }[] = [
  { key: "none", label: "All Together", icon: Layers },
  { key: "team_leader", label: "Team Leader Wise", icon: Users },
  { key: "branch", label: "Branch Wise", icon: Store },
  { key: "region", label: "Region Wise", icon: MapPin },
];

export default function SalesReports() {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [country, setCountry] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ granularity, group_by: groupBy });
      if (country) params.set("country", country);
      const res = await api.fetchRaw(`/sales-reports?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setError("Failed to load sales report");
      }
    } catch {
      setError("Failed to load sales report");
    }
    setLoading(false);
  }, [granularity, groupBy, country]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const breakdown = data?.breakdown || [];
  const trend = data?.trend || [];
  const needsReview = data?.needs_review || [];

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 size={24} />
            Sales Reports
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {data ? `${data.start} to ${data.end}` : "Combined MCP + Sheets sales, day / week / month, by team leader, branch, or region"}
          </p>
        </div>

        {/* Granularity toggle */}
        <div className="flex flex-wrap gap-2">
          {GRANULARITY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = granularity === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setGranularity(opt.key)}
                className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl border transition-colors ${
                  active
                    ? "bg-[var(--accent-blue)] border-[var(--accent-blue)] text-white"
                    : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-white/5"
                }`}
              >
                <Icon size={14} /> {opt.label}
              </button>
            );
          })}
        </div>

        {/* Group-by toggle */}
        <div className="flex flex-wrap gap-2">
          {GROUP_BY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = groupBy === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setGroupBy(opt.key)}
                className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl border transition-colors ${
                  active
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                    : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-white/5"
                }`}
              >
                <Icon size={14} /> {opt.label}
              </button>
            );
          })}
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
          >
            <option value="">All Countries</option>
            {["India", "Oman", "Pakistan", "UAE", "Malaysia", "UK", "Bahrain", "Qatar"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
        )}

        {needsReview.length > 0 && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm">
            <span className="flex items-center gap-2">
              <AlertTriangle size={16} />
              {needsReview.length} branch{needsReview.length > 1 ? "es" : ""} synced from MCP need a team leader assignment (excluded from totals below).
            </span>
            <Link
              to="/settings/branch-assignment"
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold"
            >
              Review Branches
            </Link>
          </div>
        )}

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Total Revenue", value: data ? fmtINR(data.total_revenue) : "—", color: "#3b82f6" },
            { label: "Total Target", value: data ? fmtINR(data.total_target) : "—", color: "#10b981" },
            { label: "Achievement", value: data ? `${data.achievement_pct}%` : "—", color: (data?.achievement_pct || 0) >= 50 ? "#10b981" : "#f59e0b" },
            { label: "Walk-ins", value: data ? data.total_walkins.toLocaleString() : "—", color: "#a855f7" },
            { label: "Conversions", value: data ? data.total_conversions.toLocaleString() : "—", color: "#ec4899" },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{k.label}</p>
              <p className="text-xl font-extrabold text-white">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Trend chart */}
        {trend.length > 1 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-bold text-white tracking-tight mb-3">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickFormatter={(v) => fmtINR(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(v: any) => fmtINR(Number(v))}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: "#3b82f6" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Breakdown table */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          <h3 className="text-sm font-bold text-white tracking-tight mb-4">
            {groupBy === "none" ? "All Together" : GROUP_BY_OPTIONS.find((o) => o.key === groupBy)?.label}
          </h3>
          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : breakdown.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">No data for this filter</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">{groupBy === "none" ? "Total" : groupBy === "team_leader" ? "Team Leader" : groupBy === "region" ? "Region" : "Branch"}</th>
                    <th className="py-3 px-4 font-semibold text-right">Branches</th>
                    <th className="py-3 px-4 font-semibold text-right">Revenue</th>
                    <th className="py-3 px-4 font-semibold text-right">Target</th>
                    <th className="py-3 px-4 font-semibold text-right">Achievement</th>
                    <th className="py-3 px-4 font-semibold text-right">Walk-ins</th>
                    <th className="py-3 px-4 font-semibold text-right">Conversions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {breakdown.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">{row.key}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{row.store_count}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-white">{fmtINR(row.revenue)}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{fmtINR(row.target)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`font-bold ${row.achievement_pct >= 65 ? "text-emerald-400" : row.achievement_pct >= 35 ? "text-amber-400" : "text-rose-400"}`}>
                          {row.achievement_pct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{row.walkins}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{row.conversions}</td>
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
