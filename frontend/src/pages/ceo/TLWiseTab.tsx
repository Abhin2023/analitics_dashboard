import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { processOpsData, pct, ragColor, formatINR, formatNum, shortStore } from "./types";
import { useSocketRefresh } from "../../hooks/useSocketRefresh";

export function TLWiseTab({ data }: { data: any }) {
  useSocketRefresh(["sheets-data"]);
  const ops = useMemo(() => processOpsData(data?.ops_data || []), [data]);

  if (!ops) {
    return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No operations data available</div>;
  }

  const kpis = [
    { label: "India Grand Total", value: formatINR(ops.totalRevenue), sub: `vs ${formatINR(ops.totalTarget)} · ${ops.overallAch}%`, color: "#3b82f6" },
    { label: "Total Walk-ins", value: formatNum(ops.totalWalkins), sub: `${formatNum(ops.totalConversions)} conversions`, color: "#10b981" },
    { label: "Overall Conv%", value: `${ops.overallConv}%`, sub: "India average", color: "#f59e0b" },
    { label: "Best TL", value: ops.tlList[0]?.name || "—", sub: `${ops.tlList[0]?.achPct || 0}% · ${ops.tlList[0]?.stores.length || 0} stores`, color: "#8b5cf6" },
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

      {/* TL Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 20 }}>
        {ops.tlList.map((tl, i) => {
          const p = tl.achPct;
          return (
            <div key={i} style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{tl.name}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: tl.color }}>{p}%</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
                <span>🎯 {formatINR(tl.target)} target</span>
                <span>✅ {formatINR(tl.achieved)} achieved</span>
                <span>👣 {tl.walkins} walkins</span>
                <span>🤝 {tl.conv} conv ({tl.convPct}%)</span>
              </div>
              <div style={{ width: "100%", background: "#1f2937", borderRadius: 4, height: 8, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ height: "100%", borderRadius: 4, width: `${Math.min(p, 100)}%`, background: tl.color }} />
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Stores: <span style={{ color: "#94a3b8" }}>{tl.stores.map((s) => s.s).join(", ")}</span></div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>TL Target vs Achieved (₹ Lakhs)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ops.tlList.map(t => ({ name: t.name, target: +(t.target / 100000).toFixed(1), achieved: +(t.achieved / 100000).toFixed(1) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `₹${v}L`} />
              <Tooltip contentStyle={{ background: "#1e2336", border: "1px solid #2d3748" }} formatter={(v: any) => `₹${v}L`} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar dataKey="target" fill="#374151" radius={[4, 4, 0, 0]} />
              <Bar dataKey="achieved" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>TL Conversion Rate (%)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ops.tlList.map(t => ({ name: t.name, convPct: t.convPct }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#1e2336", border: "1px solid #2d3748" }} formatter={(v: any) => `${v}%`} />
              <Bar dataKey="convPct" radius={[6, 6, 0, 0]}>
                {ops.tlList.map((t, i) => <Cell key={i} fill={ragColor(t.convPct)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Store Drill-down Table */}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 14, paddingBottom: 6, borderBottom: "1px solid #2d3748" }}>Store Drill-down by TL</div>
      <div style={{ overflowX: "auto", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["TL", "Store", "Target (₹)", "Achieved (₹)", "Ach%", "Walk-ins", "Conv", "Conv%", "Status"].map((h) => (
                <th key={h} style={{ background: "#1a2235", color: "#94a3b8", padding: "9px 10px", textAlign: "left", borderBottom: "1px solid #2d3748", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ops.tlList.map((tl) =>
              tl.stores.map((s, j) => {
                const p = pct(s.a, s.t);
                return (
                  <tr key={`${tl.name}-${j}`} style={{ borderBottom: "1px solid #1e2336" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1e2749")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#e2e8f0" }}>{j === 0 ? tl.name : ""}</td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{s.s}</td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "right" }}>{s.t.toLocaleString("en-IN")}</td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "right" }}>{s.a.toLocaleString("en-IN")}</td>
                    <td style={{ padding: "8px 10px", textAlign: "left" }}>
                      <div style={{ width: "100%", background: "#1f2937", borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 2 }}>
                        <div style={{ height: "100%", borderRadius: 4, width: `${Math.min(p, 100)}%`, background: ragColor(p) }} />
                      </div>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{p}%</span>
                    </td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "center" }}>{s.wi || "—"}</td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "center" }}>{s.cv || "—"}</td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "center" }}>{s.cp > 0 ? `${s.cp}%` : "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: p >= 65 ? "#065f46" : p >= 35 ? "#78350f" : p > 0 ? "#7f1d1d" : "#1f2937", color: p >= 65 ? "#6ee7b7" : p >= 35 ? "#fcd34d" : p > 0 ? "#fca5a5" : "#9ca3af" }}>
                        {p >= 65 ? "✅ Green" : p >= 35 ? "⚡ Amber" : p > 0 ? "🔴 Red" : "⚫ None"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
