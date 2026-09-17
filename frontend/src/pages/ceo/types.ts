/* Shared types and utility functions for CEO Dashboard tabs */

export interface OpsRecord {
  date: string; tl: string; store: string; country: string;
  revenue: number | null; monthly_target: number | null;
  units_sold: number | null; new_leads: number | null; active_leads: number | null;
  calls_made: number | null; calls_connected: number | null;
  walk_ins: number | null; walk_in_conversions: number | null;
}

export interface MktRecord {
  store: string; tl: string; videos: number | null; views: number | null;
  followers: number | null; newFol: number | null; likes: number | null;
  comments: number | null; dms: number | null; mc: number | null;
  posts: number | null; waWalkins: number;
  gRating: number | null; gNewRev: number | null; revResp: string;
}

export interface IntlRecord {
  store: string; country: string; region: string;
  target: number; actual: number; pct: number | null;
}

export interface TLData {
  name: string; target: number; achieved: number; walkins: number;
  conv: number; convPct: number; color: string;
  stores: { s: string; t: number; a: number; wi: number; cv: number; cp: number }[];
}

export interface PeopleRecord {
  store: string; tl: string; mgr: string; accom: string;
  staff: number; total: number; res: number; train: string;
  target: number; notes: string;
}

export function pct(a: number, t: number): number {
  return t > 0 ? Math.round((a / t) * 100) : 0;
}

export function ragColor(p: number): string {
  if (p >= 65) return "#10b981";
  if (p >= 35) return "#f59e0b";
  return "#ef4444";
}

export function ragBg(p: number): string {
  if (p >= 65) return "rgba(16,185,129,0.15)";
  if (p >= 35) return "rgba(245,158,11,0.15)";
  return "rgba(239,68,68,0.15)";
}

export function formatINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatNum(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-IN");
}

export function shortStore(name: string): string {
  return name
    .replace("Kerala ", "").replace("Chennai ", "").replace("Bangalore ", "")
    .replace("Hyderabad ", "").replace("TN ", "").replace("Mumbai ", "")
    .replace("Delhi ", "").replace(" Lajpat Nagar", "").replace(" Mall", "")
    .trim();
}

// Header/subtotal artifact rows that occasionally appear in the synced sheet.
// Every page that aggregates OpsRecord[] should filter these out the same way,
// otherwise different pages disagree on totals when a stray row slips in.
const SENTINEL_TLS = new Set(["TEAM LEADER", ""]);
const SENTINEL_STORES = new Set(["STORE NAME", ""]);
export function isSentinelRow(r: OpsRecord): boolean {
  return SENTINEL_TLS.has((r.tl || "").trim().toUpperCase()) ||
    SENTINEL_STORES.has((r.store || "").trim().toUpperCase());
}

// Process opsData into TL aggregation and store achievements. Revenue and
// target come from /sales-reports (MCP, kept fresh by the automatic
// 15-minute sync) rather than Google Sheets submissions — an earlier
// Sheets-only version of this silently missed any store's real revenue
// whenever it had no manual daily Sheets entry on file, which is
// increasingly common now that MCP drives most revenue. Walk-ins/
// conversions still ultimately come from Sheets under the hood (the
// /sales-reports endpoint already blends that in per store for India).
const TL_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#f97316"];

export function processMcpOpsData(branchBreakdown: any[], tlBreakdown: any[]) {
  if (!branchBreakdown || branchBreakdown.length === 0) return null;

  const storeToTl: Record<string, string> = {};
  for (const t of tlBreakdown || []) {
    for (const storeName of t.stores || []) storeToTl[storeName] = t.key;
  }

  const storeAchievements = branchBreakdown.map((b) => ({
    store: b.key, tl: storeToTl[b.key] || "Unassigned", mtd: b.revenue, target: b.target,
    achPct: b.achievement_pct, walkins: b.walkins, sales: b.conversions,
    convPct: b.walkins > 0 ? Math.round((b.conversions / b.walkins) * 100) : 0,
  })).sort((a, b) => b.achPct - a.achPct);

  const tlList = (tlBreakdown || []).map((t, i) => ({
    name: t.key, target: t.target, achieved: t.revenue, walkins: t.walkins, conv: t.conversions,
    achPct: t.achievement_pct,
    convPct: t.walkins > 0 ? Math.round((t.conversions / t.walkins) * 100) : 0,
    color: TL_COLORS[i % TL_COLORS.length],
    stores: (t.stores || []).map((s: string) => {
      const sa = storeAchievements.find((x) => x.store === s);
      return { s, t: sa?.target || 0, a: sa?.mtd || 0, wi: sa?.walkins || 0, cv: sa?.sales || 0, cp: sa?.convPct || 0 };
    }),
  })).sort((a, b) => b.achPct - a.achPct);

  const totalRevenue = branchBreakdown.reduce((s, b) => s + b.revenue, 0);
  const totalTarget = branchBreakdown.reduce((s, b) => s + b.target, 0);
  const totalWalkins = branchBreakdown.reduce((s, b) => s + b.walkins, 0);
  const totalConversions = branchBreakdown.reduce((s, b) => s + b.conversions, 0);

  const rag = { green: 0, amber: 0, red: 0 };
  for (const sa of storeAchievements) {
    if (sa.achPct >= 65) rag.green++;
    else if (sa.achPct >= 35) rag.amber++;
    else rag.red++;
  }

  return {
    storeAchievements, tlList, totalRevenue, totalTarget,
    totalWalkins, totalConversions,
    overallAch: pct(totalRevenue, totalTarget),
    overallConv: totalWalkins > 0 ? Math.round((totalConversions / totalWalkins) * 100) : 0,
    rag,
  };
}

// Process marketing data from sheet
export function processMktData(rawOpsData: OpsRecord[], rawConfig: any[]) {
  if (!rawOpsData) return [];

  // Build from ops data + store config for marketing metrics
  // Since marketing data comes from the sheet's MarketingMetrics table,
  // we process it from the existing DB data via the API.
  // For now, return empty - the tabs will fetch from DB endpoints.
  return [];
}
