import { formatMoney, formatNumber, formatPct } from "@/lib/formatMoney";

export interface KpiCard {
  id: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
  delta?: { dir: "up" | "down"; text: string };
}

export type ChartKind = "line" | "bar" | "hbar" | "donut" | "radar" | "composed";

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  kind?: "bar" | "line";
  yAxisId?: string;
}

export interface ChartDef {
  id: string;
  title: string;
  subtitle?: string;
  type: ChartKind;
  data: any[];
  xKey?: string;
  series: ChartSeries[];
  unit?: "₹" | "%" | "n";
  stacked?: boolean;
  span?: 1 | 2;
  reference?: { y: number; label: string };
  /** Optional per-slice color overrides for donut/pie charts */
  colors?: string[];
}

const C = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

const n = (v: any): number => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
const has = (ctx: any, key: string) => ctx && ctx.kpis && ctx.kpis[key] !== undefined && ctx.kpis[key] !== null;

function opsKpis(ctx: any) {
  return ctx?.ops?.kpis || ctx?.kpis || {};
}

function opsCards(k: any): KpiCard[] {
  return [
    { id: "rev", label: "MTD Revenue", value: formatMoney(n(k.total_revenue)), sub: `vs ${formatMoney(n(k.total_target))} target`, color: "#3b82f6" },
    {
      id: "ach", label: "Achievement", value: formatPct(n(k.achievement_pct)), sub: `${n(k.days_elapsed)} days elapsed`,
      color: n(k.achievement_pct) >= 50 ? "#10b981" : "#f59e0b",
      delta: n(k.pace_vs_target_pct) ? { dir: n(k.pace_vs_target_pct) >= 100 ? "up" : "down", text: `${formatPct(n(k.pace_vs_target_pct))} of pace` } : undefined,
    },
    { id: "proj", label: "Projected MTD", value: formatMoney(n(k.projected_mtd)), sub: `${formatPct(n(k.pace_vs_target_pct))} of target pace`, color: "#a855f7" },
    { id: "walkins", label: "Walk-ins", value: formatNumber(n(k.total_walkins)), sub: `${formatNumber(n(k.total_conversions))} conv · ${formatPct(n(k.conv_pct))}`, color: "#10b981" },
    { id: "red", label: "Red Stores", value: String(n(k.rag?.red || 0)), sub: `${n(k.rag?.amber || 0)} amber · ${n(k.rag?.green || 0)} green`, color: "#ef4444" },
    { id: "size", label: "Stores / TLs", value: `${n(k.store_count)} / ${n(k.tl_count)}`, sub: "active stores / leaders", color: "#06b6d4" },
  ];
}

export function curateKpis(section: string, ctx: any): KpiCard[] {
  if (!ctx) return [];
  if (section === "overview" || section === "sales") return opsCards(opsKpis(ctx));

  const k = ctx.kpis || {};
  switch (section) {
    case "operations":
      return [
        { id: "sub", label: "Submission Rate", value: formatPct(n(k.submission_rate_pct)), sub: `${n(k.store_count)} stores`, color: "#3b82f6" },
        { id: "walkins", label: "Walk-ins", value: formatNumber(n(k.total_walkins)), sub: `${formatNumber(n(k.total_conversions))} conversions`, color: "#10b981" },
        { id: "conv", label: "Conversion", value: formatPct(n(k.conv_pct)), sub: "walk-in to sale", color: "#a855f7" },
        { id: "care", label: "Care+ Attached", value: formatNumber(n(k.care_plus_attached)), color: "#06b6d4" },
        { id: "comp", label: "Complaints Resolved", value: formatPct(n(k.complaint_resolution_pct)), sub: `${n(k.complaints_resolved)}/${n(k.complaints_in)}`, color: n(k.complaint_resolution_pct) >= 80 ? "#10b981" : "#f59e0b" },
        { id: "train", label: "Training Compliance", value: formatPct(n(k.training_compliance_pct)), color: "#ec4899" },
      ];
    case "team_leaders":
      return [
        { id: "tl", label: "Team Leaders", value: formatNumber(n(k.tl_count)), color: "#3b82f6" },
        { id: "rev", label: "Total Revenue", value: formatMoney(n(k.total_revenue)), sub: `vs ${formatMoney(n(k.total_target))} target`, color: "#10b981" },
        { id: "ach", label: "Achievement", value: formatPct(n(k.achievement_pct)), color: n(k.achievement_pct) >= 65 ? "#10b981" : "#f59e0b" },
        { id: "top", label: "Top TL", value: k.top_tl ? String(k.top_tl) : "—", sub: k.top_tl_ach_pct != null ? `${formatPct(n(k.top_tl_ach_pct))} of target` : undefined, color: "#a855f7" },
        { id: "bot", label: "Bottom TL", value: k.bottom_tl ? String(k.bottom_tl) : "—", sub: k.bottom_tl_ach_pct != null ? `${formatPct(n(k.bottom_tl_ach_pct))} of target` : undefined, color: "#ef4444" },
      ];
    case "leads":
      return [
        { id: "total", label: "New Leads", value: formatNumber(n(k.total_leads)), color: "#3b82f6" },
        { id: "hot", label: "Hot", value: formatNumber(n(k.hot)), color: "#ef4444" },
        { id: "warm", label: "Warm", value: formatNumber(n(k.warm)), color: "#f59e0b" },
        { id: "cold", label: "Cold / Inactive", value: formatNumber(n(k.cold) + n(k.inactive)), color: "#a1a1aa" },
        { id: "conn", label: "Connect Rate", value: formatPct(n(k.connect_rate_pct)), sub: `${formatNumber(n(k.calls_connected))}/${formatNumber(n(k.calls_made))} calls`, color: "#06b6d4" },
        { id: "conv", label: "Conversion", value: formatPct(n(k.conv_pct)), sub: `${formatNumber(n(k.conversions))} of ${formatNumber(n(k.walk_ins))} walk-ins`, color: "#10b981" },
        { id: "lost", label: "Lost Leads", value: formatNumber(n(k.lost_total)), color: "#ef4444" },
      ];
    case "campaigns":
      return [
        { id: "total", label: "Campaigns", value: formatNumber(n(k.total_campaigns)), color: "#3b82f6" },
        { id: "run", label: "Running", value: formatNumber(n(k.running)), color: "#10b981" },
        { id: "up", label: "Upcoming", value: formatNumber(n(k.upcoming)), color: "#06b6d4" },
        { id: "exp", label: "Expired", value: formatNumber(n(k.expired)), color: "#ef4444" },
        { id: "budget", label: "Total Budget", value: formatMoney(n(k.total_budget)), color: "#a855f7" },
        { id: "sr", label: "Avg Success Rate", value: formatPct(n(k.avg_success_rate)), color: "#f59e0b" },
      ];
    case "tasks":
      return [
        { id: "total", label: "Total Tasks", value: formatNumber(n(k.total_tasks)), color: "#3b82f6" },
        { id: "done", label: "Completed", value: formatPct(n(k.completed_pct)), sub: `${formatNumber(n(k.completed))} tasks`, color: "#10b981" },
        { id: "pend", label: "Pending", value: formatNumber(n(k.pending)), color: "#f59e0b" },
        { id: "prog", label: "In Progress", value: formatNumber(n(k.in_progress)), color: "#06b6d4" },
        { id: "ovd", label: "Overdue", value: formatNumber(n(k.overdue)), color: "#ef4444" },
        { id: "hi", label: "High Priority", value: formatNumber(n(k.high_priority)), color: "#ec4899" },
      ];
    case "investments":
      return [
        { id: "tot", label: "Total Invested", value: formatMoney(n(k.total_invested)), sub: `${formatNumber(n(k.investment_count))} entries`, color: "#3b82f6" },
        { id: "tm", label: "This Month", value: formatMoney(n(k.this_month)), color: "#10b981" },
        { id: "pm", label: "Prev Month", value: formatMoney(n(k.prev_month)), color: "#a1a1aa" },
        {
          id: "mom", label: "MoM Change", value: formatPct(n(k.mo_delta_pct)),
          color: n(k.mo_delta_pct) > 0 ? "#10b981" : n(k.mo_delta_pct) < 0 ? "#ef4444" : "#a1a1aa",
          delta: n(k.mo_delta_pct) ? { dir: n(k.mo_delta_pct) >= 0 ? "up" : "down", text: "vs last month" } : undefined,
        },
        { id: "cat", label: "Categories", value: formatNumber(n(k.categories)), color: "#a855f7" },
        { id: "top", label: "Top Category", value: k.top_category ? String(k.top_category) : "—", color: "#f59e0b" },
      ];
    case "performance":
      return [
        { id: "n", label: "Stores Scored", value: formatNumber(n(k.store_count)), color: "#3b82f6" },
        { id: "avg", label: "Avg Score", value: n(k.avg_total_score).toFixed(1), color: "#10b981" },
        { id: "exc", label: "Exceeds Target", value: formatNumber(n(k.exceeds)), color: "#10b981" },
        { id: "met", label: "Meets Target", value: formatNumber(n(k.meets)), color: "#06b6d4" },
        { id: "app", label: "Approaching", value: formatNumber(n(k.approaching)), color: "#f59e0b" },
        { id: "blw", label: "Below Target", value: formatNumber(n(k.below)), color: "#ef4444" },
      ];
    case "reports":
      return [
        { id: "rev", label: "Total Revenue", value: formatMoney(n(k.total_revenue)), color: "#3b82f6" },
        { id: "tgt", label: "Target", value: formatMoney(n(k.total_target)), color: "#a1a1aa" },
        { id: "ach", label: "Achievement", value: formatPct(n(k.achievement_pct)), color: n(k.achievement_pct) >= 65 ? "#10b981" : "#f59e0b" },
        { id: "st", label: "Stores", value: formatNumber(n(k.total_stores)), color: "#06b6d4" },
        { id: "units", label: "Units Sold", value: formatNumber(n(k.units_sold)), color: "#a855f7" },
        { id: "lost", label: "Lost Leads", value: formatNumber(n(k.lost_reason_total)), color: "#ef4444" },
      ];
    default:
      return Object.entries(k)
        .filter(([key, v]) => v !== null && v !== undefined && typeof v !== "object")
        .map(([key, v]) => ({
          id: key, label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          value: typeof v === "number" ? formatNumber(v) : String(v), color: "#3b82f6",
        }));
  }
}

function ragData(ctx: any, section: string): any[] {
  const rag = section === "overview" ? opsKpis(ctx).rag : ctx?.kpis?.rag;
  if (!rag) return [];
  return [
    { name: "Green ≥65%", value: n(rag.green) },
    { name: "Amber 35–64%", value: n(rag.amber) },
    { name: "Red <35%", value: n(rag.red) },
  ].filter((d) => d.value > 0);
}

function trendData(ctx: any): any[] {
  const rows = ctx?.revenue_trend || ctx?.ops?.revenue_trend || [];
  // Sort by full date first, then format as MM-DD for display
  return [...rows]
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
    .map((r: any) => {
      const d = String(r.date);
      // Format: "2026-08-07" -> "Aug 7"
      try {
        const dt = new Date(d);
        const label = dt.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
        return { date: label, revenue: n(r.revenue) };
      } catch { return { date: d.slice(5), revenue: n(r.revenue) }; }
    });
}

function tlData(ctx: any): any[] {
  const rows = ctx?.tl_list || ctx?.ops?.tl_list || [];
  return rows.map((t: any) => ({ name: t.name, target: n(t.target), achieved: n(t.achieved) }));
}

function topBottom(ctx: any): any[] {
  const all = [...(ctx?.top || []), ...(ctx?.bottom || [])];
  const seen = new Set<string>();
  return all.filter((x) => {
    if (seen.has(x.name)) return false;
    seen.add(x.name);
    return true;
  });
}

const funnel = (stages: Array<[string, any]>) => stages.map(([name, value]) => ({ name, value: n(value) }));

const METRIC_LABELS: Record<string, string> = {
  revenue_vs_target: "Revenue vs Target",
  dsr_submission_rate: "DSR Submission",
  walk_in_conversion: "Walk-in Conversion",
  calls_vs_target: "Calls vs Target",
  stock_control: "Stock Control",
  training_compliance: "Training Compliance",
  bp_app_update_rate: "App Update Rate",
  complaint_resolution: "Complaint Resolution",
};

export function buildSectionCharts(section: string, ctx: any): ChartDef[] {
  if (!ctx) return [];

  const k = section === "overview" ? opsKpis(ctx) : ctx.kpis || {};

  if (section === "overview") {
    const mkt = ctx?.marketing?.totals || {};
    return [
      { id: "trend", title: "Daily Revenue vs Projection", subtitle: "Actual daily revenue with month-end projection reference", type: "line", data: trendData(ctx), xKey: "date", series: [{ key: "revenue", name: "Revenue", color: "#3b82f6" }], unit: "₹", span: 2, reference: { y: n(k.projected_mtd), label: "Projected" } },
      { id: "rag", title: "RAG Status Distribution", subtitle: "Store health overview", type: "donut", data: ragData(ctx, section), xKey: "name", series: [{ key: "value", name: "Stores", color: "#10b981" }], unit: "n", colors: ["#10b981", "#f59e0b", "#ef4444"] },
      { id: "tl", title: "TL Target vs Achieved", subtitle: "Monthly comparison by team leader", type: "bar", data: tlData(ctx), xKey: "name", series: [{ key: "target", name: "Target", color: "#64748b" }, { key: "achieved", name: "Achieved", color: "#3b82f6" }], unit: "₹" },
      { id: "plat", title: "Social Platform Performance", subtitle: "Views vs engagements by platform", type: "bar", data: [{ name: "Instagram", views: n(mkt.ig_views), engagements: n(mkt.ig_engagements) }, { name: "YouTube", views: n(mkt.yt_views), engagements: n(mkt.yt_engagements) }, { name: "TikTok", views: n(mkt.tt_views), engagements: n(mkt.tt_engagements) }, { name: "Snapchat", views: n(mkt.sc_views), engagements: 0 }], xKey: "name", series: [{ key: "views", name: "Views", color: "#3b82f6" }, { key: "engagements", name: "Engagements", color: "#a855f7" }], unit: "n" },
    ];
  }

  switch (section) {
    case "sales":
      return [
        { id: "trend", title: "Daily Revenue vs Projection", subtitle: "Sales momentum over the month", type: "line", data: trendData(ctx), xKey: "date", series: [{ key: "revenue", name: "Revenue", color: "#3b82f6" }], unit: "₹", span: 2, reference: { y: n(k.projected_mtd), label: "Projected" } },
        { id: "rag", title: "RAG Status Distribution", subtitle: "Store health by target achievement", type: "donut", data: ragData(ctx, section), xKey: "name", series: [{ key: "value", name: "Stores", color: "#10b981" }], unit: "n", colors: ["#10b981", "#f59e0b", "#ef4444"] },
        { id: "tl", title: "TL Target vs Achieved", subtitle: "By team leader", type: "bar", data: tlData(ctx), xKey: "name", series: [{ key: "target", name: "Target", color: "#64748b" }, { key: "achieved", name: "Achieved", color: "#3b82f6" }], unit: "₹" },
        { id: "stores", title: "Top Stores — MTD & Achievement", subtitle: "Revenue vs target achievement", type: "composed", data: topBottom(ctx).map((s) => ({ name: s.name, mtd: n(s.value), ach_pct: n(s.ach_pct) })), xKey: "name", series: [{ key: "mtd", name: "MTD (₹)", color: "#3b82f6", kind: "bar", yAxisId: "main" }, { key: "ach_pct", name: "Ach %", color: "#a855f7", kind: "line", yAxisId: "pct" }], unit: "₹" },
      ];

    case "operations":
      return [
        { id: "stores", title: "Store Revenue", subtitle: "Top vs bottom performers", type: "bar", data: topBottom(ctx).map((s) => ({ name: s.name, value: n(s.value) })), xKey: "name", series: [{ key: "value", name: "Revenue", color: "#3b82f6" }], unit: "₹" },
        { id: "rates", title: "Operational Compliance Rates", subtitle: "Execution quality across stores", type: "hbar", data: [
          { name: "Submission rate", value: n(k.submission_rate_pct) }, { name: "Conversion", value: n(k.conv_pct) },
          { name: "Connect rate", value: n(k.connect_rate_pct) }, { name: "Complaints resolved", value: n(k.complaint_resolution_pct) },
          { name: "Training compliance", value: n(k.training_compliance_pct) },
        ], xKey: "name", series: [{ key: "value", name: "%", color: "#06b6d4" }], unit: "%" },
        { id: "funnel", title: "Funnel: Calls to Sale", subtitle: "Progression across stages", type: "bar", data: funnel([["Calls", n(k.calls_made)], ["Connected", n(k.calls_connected)], ["Walk-ins", n(k.total_walkins)], ["Sales", n(k.total_conversions)]]), xKey: "name", series: [{ key: "value", name: "Count", color: "#a855f7" }], unit: "n" },
        { id: "care", title: "Care+ & Complaints", subtitle: "Attachments vs complaint flow", type: "bar", data: [{ name: "Care+ attached", value: n(k.care_plus_attached) }, { name: "Complaints in", value: n(k.complaints_in) }, { name: "Complaints resolved", value: n(k.complaints_resolved) }], xKey: "name", series: [{ key: "value", name: "Count", color: "#10b981" }], unit: "n" },
      ];

    case "team_leaders":
      return [
        { id: "rev", title: "TL Revenue", subtitle: "Top leaders by revenue", type: "bar", data: (ctx?.top || []).map((t: any) => ({ name: t.name, value: n(t.value) })), xKey: "name", series: [{ key: "value", name: "Revenue", color: "#3b82f6" }], unit: "₹" },
        { id: "ach", title: "TL Achievement %", subtitle: "Target attainment by leader", type: "hbar", data: topBottom(ctx).map((t) => ({ name: t.name, value: n(t.ach_pct) })), xKey: "name", series: [{ key: "value", name: "Ach %", color: "#10b981" }], unit: "%" },
        { id: "share", title: "Revenue Share", subtitle: "Contribution by team leader", type: "donut", data: (ctx?.top || []).map((t: any) => ({ name: t.name, value: n(t.value) })), xKey: "name", series: [{ key: "value", name: "Revenue", color: "#3b82f6" }], unit: "₹" },
      ];

    case "leads":
      return [
        { id: "pipeline", title: "Lead Pipeline", subtitle: "By current status", type: "donut", data: [{ name: "Hot", value: n(k.hot) }, { name: "Warm", value: n(k.warm) }, { name: "Cold", value: n(k.cold) }, { name: "Inactive", value: n(k.inactive) }].filter((d) => d.value > 0), xKey: "name", series: [{ key: "value", name: "Leads", color: "#3b82f6" }], unit: "n" },
        { id: "source", title: "Leads by Source", subtitle: "Where leads are coming from", type: "bar", data: (ctx?.top || []).map((s: any) => ({ name: s.name, value: n(s.value) })), xKey: "name", series: [{ key: "value", name: "Leads", color: "#f59e0b" }], unit: "n" },
        { id: "lost", title: "Lost Lead Reasons", subtitle: "Why leads were lost", type: "bar", data: (ctx?.lost_reasons || []).map((r: any) => ({ name: r.reason, value: n(r.count) })), xKey: "name", series: [{ key: "value", name: "Count", color: "#ef4444" }], unit: "n" },
        { id: "funnel", title: "Funnel: Calls to Conversion", subtitle: "Progression across stages", type: "bar", data: funnel([["Calls made", n(k.calls_made)], ["Connected", n(k.calls_connected)], ["Walk-ins", n(k.walk_ins)], ["Conversions", n(k.conversions)]]), xKey: "name", series: [{ key: "value", name: "Count", color: "#a855f7" }], unit: "n" },
      ];

    case "campaigns": {
      const byChannel = ctx?.by_channel || [];
      return [
        { id: "status", title: "Campaign Status", subtitle: "Running vs upcoming vs expired", type: "donut", data: [{ name: "Running", value: n(k.running) }, { name: "Upcoming", value: n(k.upcoming) }, { name: "Expired", value: n(k.expired) }, { name: "Draft/Other", value: Math.max(0, n(k.total_campaigns) - n(k.running) - n(k.upcoming) - n(k.expired)) }].filter((d) => d.value > 0), xKey: "name", series: [{ key: "value", name: "Campaigns", color: "#3b82f6" }], unit: "n" },
        { id: "budget", title: "Budget by Campaign", subtitle: "Top campaigns by budget", type: "bar", data: (ctx?.top || []).map((c: any) => ({ name: c.name, value: n(c.value) })), xKey: "name", series: [{ key: "value", name: "Budget", color: "#a855f7" }], unit: "₹" },
        { id: "channel", title: "Channel Mix", subtitle: "Campaigns per channel", type: "donut", data: byChannel.map((c: any) => ({ name: c.name, value: n(c.count) })), xKey: "name", series: [{ key: "value", name: "Campaigns", color: "#10b981" }], unit: "n" },
      ];
    }

    case "tasks":
      return [
        { id: "status", title: "Task Status", subtitle: "Distribution of open vs done", type: "donut", data: [{ name: "Pending", value: n(k.pending) }, { name: "In progress", value: n(k.in_progress) }, { name: "Completed", value: n(k.completed) }].filter((d) => d.value > 0), xKey: "name", series: [{ key: "value", name: "Tasks", color: "#3b82f6" }], unit: "n" },
        { id: "prio", title: "Tasks by Priority", subtitle: "Workload by priority level", type: "bar", data: [{ name: "High", value: n(k.high_priority) }, { name: "Medium", value: n(k.medium_priority) }, { name: "Low", value: n(k.low_priority) }], xKey: "name", series: [{ key: "value", name: "Tasks", color: "#f59e0b" }], unit: "n" },
        { id: "flow", title: "Completion vs Overdue", subtitle: "Follow-through health", type: "bar", data: [{ name: "Completed", value: n(k.completed) }, { name: "Overdue", value: n(k.overdue) }, { name: "Pending", value: n(k.pending) }], xKey: "name", series: [{ key: "value", name: "Tasks", color: "#10b981" }], unit: "n" },
      ];

    case "investments":
      return [
        { id: "cat", title: "Spend by Category", subtitle: "Where money is going", type: "bar", data: (ctx?.top || []).map((c: any) => ({ name: c.name, value: n(c.value) })), xKey: "name", series: [{ key: "value", name: "Amount", color: "#3b82f6" }], unit: "₹" },
        { id: "mom", title: "Month-over-Month", subtitle: "Current vs previous month", type: "bar", data: [{ name: "Previous", value: n(k.prev_month) }, { name: "This month", value: n(k.this_month) }], xKey: "name", series: [{ key: "value", name: "Amount", color: "#a855f7" }], unit: "₹" },
        { id: "share", title: "Category Share", subtitle: "Allocation by category", type: "donut", data: (ctx?.top || []).map((c: any) => ({ name: c.name, value: n(c.value) })), xKey: "name", series: [{ key: "value", name: "Amount", color: "#10b981" }], unit: "₹" },
      ];

    case "performance": {
      const metricData = Object.entries(ctx?.metric_averages || {}).map(([mk, v]) => ({ metric: METRIC_LABELS[mk] || mk.replace(/_/g, " "), value: +(n(v) * 100).toFixed(1) }));
      // Convert 0-1 scores to 0-100% for display
      const scoreData = topBottom(ctx).map((s) => ({ name: s.name, value: +(n(s.value) > 1 ? n(s.value) : n(s.value) * 100).toFixed(1) }));
      const bandData = [
        { name: "Exceeds (≥100%)", value: n(k.exceeds) },
        { name: "Meets (80-99%)", value: n(k.meets) },
        { name: "Approaching (60-79%)", value: n(k.approaching) },
        { name: "Below Target (<60%)", value: n(k.below) },
      ].filter((d) => d.value > 0);
      return [
        { id: "bands", title: "Band Distribution", subtitle: "Stores by incentive band", type: "donut", data: bandData, xKey: "name", series: [{ key: "value", name: "Stores", color: "#3b82f6" }], unit: "n", colors: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"] },
        { id: "scores", title: "Store KPI Scores (%)", subtitle: "Top vs bottom stores by composite KPI score", type: "bar", data: scoreData, xKey: "name", series: [{ key: "value", name: "Score %", color: "#10b981" }], unit: "%" },
        { id: "metrics", title: "Metric Averages", subtitle: "KPI profile across stores (lower = weakest)", type: "radar", data: metricData, xKey: "metric", series: [{ key: "value", name: "Avg %", color: "#a855f7" }], unit: "%" },
      ];
    }

    case "reports":
      return [
        { id: "stores", title: "Store Achievement", subtitle: "Revenue vs target achievement", type: "composed", data: topBottom(ctx).map((s) => ({ name: s.name, revenue: n(s.value), ach_pct: n(s.ach_pct) })), xKey: "name", series: [{ key: "revenue", name: "Revenue (₹)", color: "#3b82f6", kind: "bar", yAxisId: "main" }, { key: "ach_pct", name: "Ach %", color: "#a855f7", kind: "line", yAxisId: "pct" }], unit: "₹" },
        { id: "lost", title: "Lost Lead Reasons", subtitle: "Recurring reasons this month", type: "bar", data: (ctx?.lost_reasons || []).map((r: any) => ({ name: r.reason, value: n(r.count) })), xKey: "name", series: [{ key: "value", name: "Count", color: "#ef4444" }], unit: "n" },
        { id: "vt", title: "Revenue vs Target", subtitle: "Overall position", type: "bar", data: [{ name: "Target", value: n(k.total_target) }, { name: "Revenue", value: n(k.total_revenue) }], xKey: "name", series: [{ key: "value", name: "Amount", color: "#a855f7" }], unit: "₹" },
      ];

    default:
      return [];
  }
}

export { C };
