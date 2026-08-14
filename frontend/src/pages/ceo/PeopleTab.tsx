import { useMemo } from "react";
import { useSocketRefresh } from "../../hooks/useSocketRefresh";

export function PeopleTab({ data }: { data: any }) {
  useSocketRefresh(["sheets-data"]);
  const staff = data?.staff || [];
  const intlStaff = data?.intl_staff || [];

  const indiaStaff = useMemo(() => {
    return staff.filter((r: any) => r.store && r.store !== "STORE NAME" && r.tl);
  }, [staff]);

  const intlStaffFiltered = useMemo(() => {
    return intlStaff.filter((r: any) => r.store && r.store !== "STORE NAME" && r.tl);
  }, [intlStaff]);

  const allPeople = useMemo(() => [...indiaStaff, ...intlStaffFiltered], [indiaStaff, intlStaffFiltered]);

  const totalStaff = allPeople.reduce((s: number, r: any) => s + (r.staff_count || r.total || 0), 0);
  const riskCount = allPeople.filter((r: any) => r.resource_required > 0).length;
  const trainingCount = allPeople.filter((r: any) => r.training).length;
  const singleStaffCount = allPeople.filter((r: any) => (r.staff_count || r.total || 0) < 2).length;

  const kpis = [
    { label: "Total Staff", value: String(totalStaff), sub: `across ${allPeople.length} stores`, color: "#3b82f6" },
    { label: "Resource Risk", value: String(riskCount), sub: "stores needing resources", color: "#ef4444" },
    { label: "In Training", value: String(trainingCount), sub: "stores with trainees", color: "#f59e0b" },
    { label: "Single-Staff Stores", value: String(singleStaffCount), sub: "stores with <2 staff", color: "#f59e0b" },
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

      <div style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 14, paddingBottom: 6, borderBottom: "1px solid #2d3748" }}>
        India Stores ({indiaStaff.length})
      </div>
      <div style={{ overflowX: "auto", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Store", "Manager", "TL", "Accom", "Staff", "Res Risk", "Training", "Notes"].map((h) => (
                <th key={h} style={{ background: "#1a2235", color: "#94a3b8", padding: "9px 10px", textAlign: "left", borderBottom: "1px solid #2d3748", fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indiaStaff.map((r: any, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid #1e2336" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1e2749")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 500 }}>{r.store}</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{r.manager}</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{r.tl}</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{r.has_accommodation ? "✅" : "❌"}</td>
                <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 700, textAlign: "center" }}>{r.staff_count ?? "—"}</td>
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
                <td style={{ padding: "8px 10px", fontSize: 11, color: "#94a3b8" }}>{r.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {intlStaffFiltered.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 14, paddingBottom: 6, borderBottom: "1px solid #2d3748" }}>
            International Stores ({intlStaffFiltered.length})
          </div>
          <div style={{ overflowX: "auto", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Store", "Sales Person", "TL", "Total", "Res Risk", "Training", "Target", "Notes"].map((h) => (
                    <th key={h} style={{ background: "#1a2235", color: "#94a3b8", padding: "9px 10px", textAlign: "left", borderBottom: "1px solid #2d3748", fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intlStaffFiltered.map((r: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1e2336" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1e2749")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 500 }}>{r.store}</td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{r.sales}</td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{r.tl}</td>
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
        </>
      )}
    </div>
  );
}
