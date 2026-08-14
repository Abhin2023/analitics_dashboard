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
  if (n >= 10000000) return `₹${(n / 100000).toFixed(1)}L`;
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

// Process opsData into TL aggregation and store achievements
export function processOpsData(opsData: OpsRecord[]) {
  if (!opsData || opsData.length === 0) return null;

  // Group by store
  const storeMap: Record<string, { revenue: number; target: number; walkins: number; sales: number; tl: string }> = {};
  for (const r of opsData) {
    const key = r.store;
    if (!storeMap[key]) storeMap[key] = { revenue: 0, target: 0, walkins: 0, sales: 0, tl: r.tl };
    storeMap[key].revenue += r.revenue || 0;
    storeMap[key].target += r.monthly_target || 0;
    storeMap[key].walkins += r.walk_ins || 0;
    storeMap[key].sales += r.walk_in_conversions || 0;
    storeMap[key].tl = r.tl;
  }

  const storeAchievements = Object.entries(storeMap).map(([store, d]) => ({
    store, tl: d.tl, mtd: d.revenue, target: d.target,
    achPct: pct(d.revenue, d.target), walkins: d.walkins, sales: d.sales,
    convPct: d.walkins > 0 ? Math.round((d.sales / d.walkins) * 100) : 0,
  })).sort((a, b) => b.achPct - a.achPct);

  // TL aggregation
  const tlMap: Record<string, { target: number; achieved: number; walkins: number; conv: number; stores: { s: string; t: number; a: number; wi: number; cv: number; cp: number }[] }> = {};
  for (const sa of storeAchievements) {
    const tl = sa.tl;
    if (!tlMap[tl]) tlMap[tl] = { target: 0, achieved: 0, walkins: 0, conv: 0, stores: [] };
    tlMap[tl].target += sa.target;
    tlMap[tl].achieved += sa.mtd;
    tlMap[tl].walkins += sa.walkins;
    tlMap[tl].conv += sa.sales;
    tlMap[tl].stores.push({ s: sa.store, t: sa.target, a: sa.mtd, wi: sa.walkins, cv: sa.sales, cp: sa.convPct });
  }

  const TL_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#f97316"];
  const tlList = Object.entries(tlMap).map(([name, d], i) => ({
    name, ...d,
    achPct: pct(d.achieved, d.target),
    convPct: d.walkins > 0 ? Math.round((d.conv / d.walkins) * 100) : 0,
    color: TL_COLORS[i % TL_COLORS.length],
  })).sort((a, b) => b.achPct - a.achPct);

  const totalRevenue = storeAchievements.reduce((s, sa) => s + sa.mtd, 0);
  const totalTarget = storeAchievements.reduce((s, sa) => s + sa.target, 0);
  const totalWalkins = storeAchievements.reduce((s, sa) => s + sa.walkins, 0);
  const totalConversions = storeAchievements.reduce((s, sa) => s + sa.sales, 0);

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
