import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { processOpsData, formatINR, ragColor } from "./types";
import { useSocketRefresh } from "../../hooks/useSocketRefresh";

function ActionTable({ items, color }: { items: any[]; color: string }) {
  if (items.length === 0) return null;
  const label = color === "#f87171" ? "CRITICAL - Act This Week" : color === "#fcd34d" ? "HIGH PRIORITY - Act This Month" : "STRATEGIC - Complete by Month End";
  return (
    <div style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 12 }}>{label}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Store / Area", "Issue", "Assign To", "Action Required"].map((h) => (
                <th key={h} style={{ background: "#1a2235", color: "#94a3b8", padding: "9px 10px", textAlign: "left", borderBottom: "1px solid #2d3748", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((r: any, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid #1e2336" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1e2749")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "8px 10px", fontWeight: 600, color: "#e2e8f0" }}>{r.area}</td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "#94a3b8" }}>{r.issue}</td>
                <td style={{ padding: "8px 10px" }}><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: "#1e3a5f", color: "#93c5fd" }}>{r.assign}</span></td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "#cbd5e1" }}>{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ActionCenterTab({ data }: { data: any }) {
  useSocketRefresh(["sheets-data"]);
  const opsData = data?.ops_data || [];
  const reviews = data?.reviews || [];
  const grPlan = data?.gr_action_plan || [];
  const staff = data?.staff || [];
  const intlStaff = data?.intl_staff || [];

  const ops = useMemo(() => processOpsData(opsData), [opsData]);

  const validReviews = useMemo(() => {
    return reviews.filter((r: any) => r.store && r.store !== "store" && typeof r.rating === "number");
  }, [reviews]);

  const validStaff = useMemo(() => {
    return staff.filter((r: any) => r.store && r.store !== "STORE NAME" && r.tl);
  }, [staff]);

  const validIntlStaff = useMemo(() => {
    return intlStaff.filter((r: any) => r.store && r.store !== "STORE NAME" && r.tl);
  }, [intlStaff]);

  const criticalItems = useMemo(() => {
    const items: any[] = [];
    if (ops) {
      const zeroStores = ops.storeAchievements.filter((s: any) => s.mtd === 0 && s.target > 0);
      for (const s of zeroStores.slice(0, 3)) {
        items.push({ area: s.store, issue: "Zero revenue - target is " + formatINR(s.target), assign: s.tl, action: "Immediate investigation: check if store is operational" });
      }
      const redStores = ops.storeAchievements.filter((s: any) => s.achPct > 0 && s.achPct < 20);
      for (const s of redStores.slice(0, 2)) {
        items.push({ area: s.store, issue: "Only " + s.achPct + "% achievement - " + formatINR(s.mtd) + " vs " + formatINR(s.target) + " target", assign: s.tl, action: "Performance review + recovery plan needed" });
      }
    }
    const riskStaff = validStaff.filter((r: any) => r.resource_required > 0);
    for (const s of riskStaff.slice(0, 2)) {
      items.push({ area: s.store, issue: s.resource_required + " staff needed - current: " + s.staff_count, assign: s.tl, action: "Hiring priority - fill position within 2 weeks" });
    }
    return items;
  }, [ops, validStaff]);

  const highItems = useMemo(() => {
    const items: any[] = [];
    if (ops) {
      const lowConv = ops.storeAchievements.filter((s: any) => s.walkins > 5 && s.convPct < 20);
      for (const s of lowConv.slice(0, 3)) {
        items.push({ area: s.store, issue: s.walkins + " walk-ins but only " + s.convPct + "% conversion", assign: s.tl, action: "In-store conversion training + demo quality review" });
      }
      const amberStores = ops.storeAchievements.filter((s: any) => s.achPct >= 20 && s.achPct < 35);
      for (const s of amberStores.slice(0, 3)) {
        items.push({ area: s.store, issue: s.achPct + "% achievement - on the edge of Red", assign: s.tl, action: "Weekly performance check + marketing push" });
      }
    }
    return items;
  }, [ops]);

  const strategicItems = useMemo(() => {
    const items: any[] = [];
    const lowReviewStores = validReviews.filter((r: any) => r.total_reviews < 30 && r.total_reviews > 0);
    for (const r of lowReviewStores.slice(0, 3)) {
      items.push({ area: r.store, issue: r.rating + " stars but only " + r.total_reviews + " reviews - vulnerable rating", assign: "Store TL", action: "WhatsApp review-request campaign to past customers" });
    }
    const trainingStores = validStaff.filter((r: any) => r.training);
    for (const s of trainingStores.slice(0, 2)) {
      items.push({ area: s.store, issue: "Staff in training - needs onboarding support", assign: s.tl, action: "Ensure training completion checklist is followed" });
    }
    return items;
  }, [validReviews, validStaff]);

  const allItems = [...criticalItems, ...highItems, ...strategicItems];

  const branchData = useMemo(() => {
    if (!ops) return [];
    const regionMap: Record<string, { total: number; achieved: number }> = {};
    for (const sa of ops.storeAchievements) {
      let region = "Other";
      if (sa.store.includes("Kerala")) region = "Kerala";
      else if (sa.store.includes("TN ") || sa.store.includes("Chennai") || sa.store.includes("Coimbatore") || sa.store.includes("Kodambakam") || sa.store.includes("Velachery")) region = "Tamil Nadu";
      else if (sa.store.includes("Bangalore") || sa.store.includes("Mysore") || sa.store.includes("Mangalore")) region = "Karnataka";
      else if (sa.store.includes("Hyderabad") || sa.store.includes("Kukatpally") || sa.store.includes("Hitech")) region = "Telangana";
      else if (sa.store.includes("Mumbai") || sa.store.includes("Bandra")) region = "Maharashtra";
      else if (sa.store.includes("Guwahati")) region = "North East";
      else if (sa.store.includes("Delhi")) region = "North India";
      if (!regionMap[region]) regionMap[region] = { total: 0, achieved: 0 };
      regionMap[region].total += sa.target;
      regionMap[region].achieved += sa.mtd;
    }
    return Object.entries(regionMap)
      .map(([name, d]) => ({ name, avgAch: d.total > 0 ? Math.round((d.achieved / d.total) * 100) : 0 }))
      .sort((a, b) => b.avgAch - a.avgAch);
  }, [ops]);

  const tlGapData = useMemo(() => {
    if (!ops) return [];
    return ops.tlList.map((tl: any) => ({
      name: tl.name,
      gap: +((tl.target - tl.achieved) / 100000).toFixed(1),
    })).sort((a: any, b: any) => b.gap - a.gap);
  }, [ops]);

  const mktEffData = useMemo(() => {
    const low = validReviews.filter((r: any) => r.rating < 4.3).length;
    const mid = validReviews.filter((r: any) => r.rating >= 4.3 && r.rating < 4.7).length;
    const high = validReviews.filter((r: any) => r.rating >= 4.7).length;
    return [
      { name: "High Rated (4.7+)", value: high },
      { name: "Mid Rated (4.3-4.6)", value: mid },
      { name: "Low Rated (<4.3)", value: low },
    ];
  }, [validReviews]);

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 14, paddingBottom: 6, borderBottom: "1px solid #2d3748" }}>
        Action Center - Derived from Live Sheet Data
      </div>

      {allItems.length === 0 ? (
        <div style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 40, textAlign: "center", color: "#94a3b8" }}>
          No action items - all stores performing well
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
            {[
              { label: "Critical Items", value: criticalItems.length, color: "#f87171" },
              { label: "High Priority", value: highItems.length, color: "#fcd34d" },
              { label: "Strategic", value: strategicItems.length, color: "#60a5fa" },
            ].map((k, i) => (
              <div key={i} style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: k.color }} />
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <ActionTable items={criticalItems} color="#f87171" />
          <ActionTable items={highItems} color="#fcd34d" />
          <ActionTable items={strategicItems} color="#60a5fa" />
        </>
      )}

      <div style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 14, paddingBottom: 6, borderBottom: "1px solid #2d3748", marginTop: 20 }}>Focus Areas Summary</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Branch Priority Matrix</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={branchData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => v + "%"} />
              <Tooltip contentStyle={{ background: "#1e2336", border: "1px solid #2d3748" }} formatter={(v: any) => v + "%"} />
              <Bar dataKey="avgAch" radius={[4, 4, 0, 0]}>
                {branchData.map((b, i) => <Cell key={i} fill={ragColor(b.avgAch)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>TL Performance Gap (Rs L)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={tlGapData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => "Rs" + v + "L"} />
              <Tooltip contentStyle={{ background: "#1e2336", border: "1px solid #2d3748" }} formatter={(v: any) => "Rs" + v + "L"} />
              <Bar dataKey="gap" radius={[4, 4, 0, 0]}>
                {tlGapData.map((t, i) => <Cell key={i} fill={t.gap > 10 ? "#ef4444" : t.gap > 5 ? "#f59e0b" : "#10b981"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#1e2336", border: "1px solid #2d3748", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Store Rating Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={mktEffData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" stroke="#1e2336" strokeWidth={2}>
                {mktEffData.map((_, i) => <Cell key={i} fill={["#10b981", "#f59e0b", "#ef4444"][i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1e2336", border: "1px solid #2d3748" }} />
              <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
