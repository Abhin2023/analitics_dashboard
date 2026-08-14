import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { processOpsData, pct, ragColor, ragBg, formatINR, formatNum, shortStore } from "./types";
import { useSocketRefresh } from "../../hooks/useSocketRefresh";

export function DailyOpsTab({ data }: { data: any }) {
  useSocketRefresh(["sheets-data"]);
  const ops = useMemo(() => processOpsData(data?.ops_data || []), [data]);

  if (!ops) {
    return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No operations data available</div>;
  }

  const zeroRevStores = ops.storeAchievements.filter((s) => s.mtd === 0).length;

  const kpis = [
    { label: "India MTD Revenue", value: formatINR(ops.totalRevenue), sub: `vs ${formatINR(ops.totalTarget)} target`, color: "#3b82f6" },
    { label: "Walk-ins (Month)", value: formatNum(ops.totalWalkins), sub: `${formatNum(ops.totalConversions)} converted · ${ops.overallConv}%`, color: "#10b981" },
    { label: "Overall Achievement", value: `${ops.overallAch}%`, sub: `${ops.tlList.length} TLs · ${ops.storeAchievements.length} stores`, color: "#f59e0b" },
    { label: "Zero Revenue Stores", value: String(zeroRevStores), sub: "stores with ₹0 revenue", color: "#ef4444" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 14, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: "linear-gradient(135deg, #1e2336, #252d45)", border: "1px solid #2d3748", borderRadius: 10, padding: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: k.color }} />
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Store Table */}
      <div style={{ overflowX: "auto", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Store", "TL", "MTD Rev (₹)", "Walk-ins", "Sales", "Conv%", "Target (₹)", "Ach%", "Status"].map((h) => (
                <th key={h} style={{ background: "#1a2235", color: "#94a3b8", padding: "9px 10px", textAlign: "left", borderBottom: "1px solid #2d3748", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ops.storeAchievements.map((sa, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #1e2336", transition: "background 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1e2749")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 500 }}>{sa.store}</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{sa.tl}</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "right" }}>{sa.mtd.toLocaleString("en-IN")}</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "center" }}>{sa.walkins}</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "center" }}>{sa.sales}</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "center" }}>{sa.convPct}%</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "right" }}>{sa.target.toLocaleString("en-IN")}</td>
                <td style={{ padding: "8px 10px", textAlign: "left" }}>
                  <div style={{ width: "100%", background: "#1f2937", borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 2 }}>
                    <div style={{ height: "100%", borderRadius: 4, width: `${Math.min(sa.achPct, 100)}%`, background: ragColor(sa.achPct) }} />
                  </div>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{sa.achPct}%</span>
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{
                    display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700,
                    background: sa.achPct >= 65 ? "#065f46" : sa.achPct >= 35 ? "#78350f" : "#7f1d1d",
                    color: sa.achPct >= 65 ? "#6ee7b7" : sa.achPct >= 35 ? "#fcd34d" : "#fca5a5",
                  }}>
                    {sa.achPct >= 65 ? "✅ Green" : sa.achPct >= 35 ? "⚡ Amber" : sa.achPct > 0 ? "🔴 Red" : "⚫ None"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>MTD Achievement % — All Stores</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={ops.storeAchievements} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis type="number" domain={[0, 120]} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="store" tick={{ fill: "#94a3b8", fontSize: 9 }} width={130} tickFormatter={shortStore} />
              <Tooltip formatter={(v: any) => [`${v}%`, "Achievement"]} contentStyle={{ background: "#1e2336", border: "1px solid #2d3748" }} />
              <Bar dataKey="achPct" radius={[0, 4, 4, 0]}>
                {ops.storeAchievements.map((s, i) => <Cell key={i} fill={ragColor(s.achPct)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Walk-in vs Conversion</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={ops.storeAchievements.filter((s) => s.walkins > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="store" tick={{ fill: "#94a3b8", fontSize: 9 }} tickFormatter={shortStore} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#1e2336", border: "1px solid #2d3748" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar dataKey="walkins" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
