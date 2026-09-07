import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/authStore";
import { Globe, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

interface CountryData {
  country: string;
  local_amount: number;
  local_currency: string;
  sales_count: number;
  usd_amount: number;
  pct: number;
  avg_ticket_usd: number;
}

const COUNTRY_COLORS: Record<string, string> = {
  INDIA: "#3b82f6",
  UAE: "#10b981",
  OMAN: "#f59e0b",
  QATAR: "#a855f7",
  PAKISTAN: "#ef4444",
  MALAYSIA: "#06b6d4",
  UK: "#ec4899",
  BAHRAIN: "#f97316",
};

export default function CountryComparison() {
  const { token } = useAuthStore();
  const [data, setData] = useState<CountryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/mcp/sales/country-comparison?from_date=${fromDate}&to_date=${toDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [token, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalUsd = data.reduce((s, c) => s + c.usd_amount, 0);
  const totalSales = data.reduce((s, c) => s + c.sales_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe size={24} />
            Country Comparison
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Cross-country sales normalized to USD</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Date Filters */}
      <div className="flex gap-3">
        <div>
          <label className="text-xs text-[var(--text-muted)] mb-1 block">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] mb-1 block">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-white"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <p className="text-xs text-[var(--text-muted)]">Total (USD)</p>
          <p className="text-2xl font-bold text-white">${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <p className="text-xs text-[var(--text-muted)]">Total Sales</p>
          <p className="text-2xl font-bold text-white">{totalSales.toLocaleString()}</p>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] animate-pulse" />
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">No data available</div>
      ) : (
        <>
          {/* USD Comparison Chart */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-4">Sales by Country (USD)</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} stroke="#666" />
                <YAxis type="category" dataKey="country" width={100} stroke="#666" tick={{ fill: "#fff", fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "USD"]}
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                  labelStyle={{ color: "#fff" }}
                />
                <Bar dataKey="usd_amount" radius={[0, 6, 6, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.country} fill={COUNTRY_COLORS[entry.country.toUpperCase()] || "#666"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Country Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.map((c) => (
              <div key={c.country} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: COUNTRY_COLORS[c.country.toUpperCase()] || "#666" }} />
                  <span className="text-sm font-medium text-white">{c.country}</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Sales</p>
                    <p className="text-lg font-bold text-white">{c.sales_count.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Local</p>
                    <p className="text-sm font-medium text-white">{c.local_currency} {c.local_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">USD</p>
                    <p className="text-sm font-medium text-emerald-400">${c.usd_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Avg Ticket</p>
                    <p className="text-sm font-medium text-white">${c.avg_ticket_usd.toFixed(2)}</p>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${c.pct}%`, background: COUNTRY_COLORS[c.country.toUpperCase()] || "#666" }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] text-right">{c.pct.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
