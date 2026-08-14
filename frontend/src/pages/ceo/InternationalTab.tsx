import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { pct, ragColor, formatINR } from "./types";
import { useSocketRefresh } from "../../hooks/useSocketRefresh";

export function InternationalTab({ data }: { data: any }) {
  useSocketRefresh(["sheets-data"]);
  const intlStaff = data?.intl_staff || [];
  const validStaff = useMemo(() => {
    return intlStaff.filter((r: any) => r.store && r.store !== "STORE NAME" && r.tl);
  }, [intlStaff]);

  const totalTarget = validStaff.reduce((s: number, r: any) => s + (r.target || 0), 0);
  const totalStaff = validStaff.reduce((s: number, r: any) => s + (r.total || 0), 0);
  const resRisk = validStaff.filter((r: any) => r.resource_required > 0).length;

  const kpis = [
    { label: "International Stores", value: String(validStaff.length), sub: "across UAE & Oman", color: "#f59e0b" },
    { label: "Total Intl Target", value: formatINR(totalTarget), sub: "monthly target", color: "#3b82f6" },
    { label: "Total Intl Staff", value: String(totalStaff), sub: "sales people", color: "#10b981" },
    { label: "Resource Needed", value: String(resRisk), sub: "stores with gaps", color: "#ef4444" },
  ];

  const barData = validStaff.map((r: any) => ({
    name: r.store,
    target: r.target || 0,
  }));

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 14 }}>International Markets</div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: "linear-gradient(135deg, #1e2336, #252d45)", borderRadius: 10, padding: 16, border: "1px solid #2d3748", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: k.color }} />
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {barData.length > 0 && (
        <div style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>International Store Targets</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => formatINR(v)} />
              <Tooltip contentStyle={{ background: "#1e2336", border: "1px solid #2d3748" }} formatter={(v: any) => formatINR(v)} />
              <Bar dataKey="target" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Store", "TL", "Sales Person", "Total Staff", "Res Risk", "Training", "Target (₹)", "Notes"].map((h) => (
                <th key={h} style={{ background: "#1a2235", color: "#94a3b8", padding: "9px 10px", textAlign: "left", borderBottom: "1px solid #2d3748", fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {validStaff.map((r: any, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid #1e2336" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1e2749")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 500 }}>{r.store}</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{r.tl}</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{r.sales}</td>
                <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 700, textAlign: "center" }}>{r.total ?? "—"}</td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>
                  {r.resource_required > 0 ? (
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5" }}>⚠️ {r.resource_required}</span>
                  ) : (
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: "#065f46", color: "#6ee7b7" }}>✅ 0</span>
                  )}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  {r.training ? (
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: "#78350f", color: "#fcd34d" }}>📚 Yes</span>
                  ) : "—"}
                </td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1", textAlign: "right" }}>{r.target ? r.target.toLocaleString("en-IN") : "—"}</td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "#94a3b8" }}>{r.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
