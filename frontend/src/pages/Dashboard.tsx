import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/lib/authStore";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/Skeleton";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
  DollarSign, Target, TrendingUp, Users, Phone, Briefcase, Award, AlertTriangle, PieChart as PieIcon, BarChart3,
  Globe, Video, MessageCircle, Star, Eye, LayoutDashboard, FileText
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";
import { useSocketRefresh } from "../hooks/useSocketRefresh";
import { AISummary } from "@/components/dashboard/AISummary";

const BranchGlobe = lazy(() => import("@/components/dashboard/BranchGlobe"));

const COLORS = ["#3b82f6", "#10b981", "#a855f7", "#f97316", "#ec4899", "#06b6d4"];
const TL_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#f97316"];

function shortStore(name: string) {
  return name.replace("Kerala ", "").replace("Chennai ", "").replace("Bangalore ", "")
    .replace("Hyderabad ", "").replace("TN ", "").replace("Mumbai ", "")
    .replace("Delhi ", "").replace(" Lajpat Nagar", "").replace(" Mall", "").trim();
}

function pct(a: number, t: number) { return t > 0 ? Math.round(a / t * 100) : 0; }
function ragColor(p: number) { return p >= 65 ? "#10b981" : p >= 35 ? "#f59e0b" : "#ef4444"; }
function fmtINR(n: number) {
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `\u20b9${(n / 1000).toFixed(1)}K`;
  return `\u20b9${n.toLocaleString("en-IN")}`;
}
function fmtNum(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function processOpsData(opsData: any[]) {
  if (!opsData || opsData.length === 0) return null;
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
    convPct: d.walkins > 0 ? Math.round(d.sales / d.walkins * 100) : 0,
  })).sort((a: any, b: any) => b.achPct - a.achPct);

  const tlMap: Record<string, { target: number; achieved: number; walkins: number; conv: number; stores: string[] }> = {};
  for (const sa of storeAchievements) {
    const tl = sa.tl;
    if (!tlMap[tl]) tlMap[tl] = { target: 0, achieved: 0, walkins: 0, conv: 0, stores: [] };
    tlMap[tl].target += sa.target;
    tlMap[tl].achieved += sa.mtd;
    tlMap[tl].walkins += sa.walkins;
    tlMap[tl].conv += sa.sales;
    tlMap[tl].stores.push(sa.store);
  }
  const tlList = Object.entries(tlMap).map(([name, d], i) => ({
    name, ...d, achPct: pct(d.achieved, d.target),
    convPct: d.walkins > 0 ? Math.round(d.conv / d.walkins * 100) : 0,
    color: TL_COLORS[i % TL_COLORS.length],
  })).sort((a: any, b: any) => b.achPct - a.achPct);

  const totalRevenue = storeAchievements.reduce((s, sa) => s + sa.mtd, 0);
  const totalTarget = storeAchievements.reduce((s, sa) => s + sa.target, 0);
  const totalWalkins = storeAchievements.reduce((s, sa) => s + sa.walkins, 0);
  const totalConversions = storeAchievements.reduce((s, sa) => s + sa.sales, 0);
  const rag = { green: 0, amber: 0, red: 0 };
  for (const sa of storeAchievements) { if (sa.achPct >= 65) rag.green++; else if (sa.achPct >= 35) rag.amber++; else rag.red++; }

  return { storeAchievements, tlList, totalRevenue, totalTarget, totalWalkins, totalConversions, overallAch: pct(totalRevenue, totalTarget), overallConv: totalWalkins > 0 ? Math.round(totalConversions / totalWalkins * 100) : 0, rag };
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "dashboard";
  useSocketRefresh(["sheets-data"]);
  const { token } = useAuthStore();
  const [sheetsData, setSheetsData] = useState<any>(null);
  const [sheetsLoading, setSheetsLoading] = useState(true);

  const fetchSheets = useCallback(async () => {
    setSheetsLoading(true);
    try {
      const res = await fetch("/api/v1/ceo-dashboard/sheets-data?tab=all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (!d.error) setSheetsData(d);
      }
    } catch {}
    setSheetsLoading(false);
  }, [token]);

  useEffect(() => { fetchSheets(); }, [fetchSheets]);

  const ops = processOpsData(sheetsData?.ops_data || []);

  // Derive KPI data from sheets
  const kpiData = useMemo(() => {
    if (!ops) return null;
    const totalRevenue = ops.totalRevenue;
    const totalTarget = ops.totalTarget;
    const achievementPct = ops.overallAch;
    return { totalRevenue, totalTarget, achievementPct };
  }, [ops]);

  // Revenue trend from ops_data grouped by date
  const revenueTrend = useMemo(() => {
    const opsData = sheetsData?.ops_data || [];
    if (!opsData.length) return [];
    const dateMap: Record<string, number> = {};
    for (const r of opsData) {
      if (r.date) {
        dateMap[r.date] = (dateMap[r.date] || 0) + (r.revenue || 0);
      }
    }
    return Object.entries(dateMap)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sheetsData]);

  // Revenue breakdown by TL from ops_data
  const revenueBreakdown = useMemo(() => {
    const opsData = sheetsData?.ops_data || [];
    if (!opsData.length) return [];
    const tlMap: Record<string, number> = {};
    for (const r of opsData) {
      if (r.tl) {
        tlMap[r.tl] = (tlMap[r.tl] || 0) + (r.revenue || 0);
      }
    }
    return Object.entries(tlMap)
      .map(([name, value]) => ({ name, value }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [sheetsData]);

  // Top team leaders from ops_data
  const topTeamLeaders = useMemo(() => {
    if (!ops) return [];
    return ops.tlList.map((tl) => ({
      name: tl.name,
      revenue: tl.achieved,
      target: tl.target,
      achievement: tl.achPct,
      active_leads: 0,
    }));
  }, [ops]);

  // Lead distribution from ops_data
  const leadDistribution = useMemo(() => {
    const opsData = sheetsData?.ops_data || [];
    if (!opsData.length) return [];
    const totalLeads = opsData.reduce((s: number, r: any) => s + (r.new_leads || 0), 0);
    const activeLeads = opsData.reduce((s: number, r: any) => s + (r.active_leads || 0), 0);
    const callsMade = opsData.reduce((s: number, r: any) => s + (r.calls_made || 0), 0);
    const callsConnected = opsData.reduce((s: number, r: any) => s + (r.calls_connected || 0), 0);
    return [
      { name: "Active Leads", value: activeLeads },
      { name: "New Leads", value: totalLeads },
      { name: "Calls Made", value: callsMade },
      { name: "Calls Connected", value: callsConnected },
    ];
  }, [sheetsData]);

  // Marketing data from daily_tracker (xlsx)
  const marketingData = useMemo(() => {
    const tracker = sheetsData?.daily_tracker || [];
    if (!tracker.length) return null;

    const storeMap: Record<string, any> = {};
    for (const r of tracker) {
      const s = r.store;
      if (!s) continue;
      if (!storeMap[s]) {
        storeMap[s] = {
          store: s, country: r.country, storeType: r.store_type,
          dailyRevenue: 0, mtdRevenue: 0, monthlyTarget: 0, unitsSold: 0, carePlus: 0, prebookings: 0,
          igVideos: 0, igViewsTarget: 0, igViewsAchieved: 0, igFollowers: 0, igNewFollowers: 0,
          igLikes: 0, igComments: 0, igSaves: 0, igShares: 0, igDms: 0, igPosts: 0,
          ytViews: 0, ytLikes: 0, ytComments: 0,
          ttViews: 0, ttLikes: 0, ttFollowers: 0,
          scViews: 0, scShares: 0,
          waChats: 0, waWalkins: 0,
          googleRating: null as number | null, googleReviews: 0,
        };
      }
      const m = storeMap[s];
      m.dailyRevenue += r.daily_revenue || 0;
      m.mtdRevenue += r.mtd_revenue || 0;
      m.monthlyTarget = r.monthly_target || m.monthlyTarget;
      m.unitsSold += r.units_sold || 0;
      m.carePlus += r.care_plus_attached || 0;
      m.prebookings += r.prebookings || 0;
      m.igVideos += r.ig_videos_posted || 0;
      m.igViewsTarget += r.ig_views_target || 0;
      m.igViewsAchieved += r.ig_views_achieved || 0;
      m.igFollowers = r.ig_followers || m.igFollowers;
      m.igNewFollowers += r.ig_new_followers || 0;
      m.igLikes += r.ig_likes || 0;
      m.igComments += r.ig_comments || 0;
      m.igSaves += r.ig_saves || 0;
      m.igShares += r.ig_shares || 0;
      m.igDms += r.ig_dms_received || 0;
      m.igPosts += r.ig_posts_published || 0;
      m.ytViews += r.yt_views || 0;
      m.ytLikes += r.yt_likes || 0;
      m.ytComments += r.yt_comments || 0;
      m.ttViews += r.tt_views || 0;
      m.ttLikes += r.tt_likes || 0;
      m.ttFollowers = r.tt_followers || m.ttFollowers;
      m.scViews += r.sc_views || 0;
      m.scShares += r.sc_shares || 0;
      m.waChats += r.wa_chats_received || 0;
      m.waWalkins += r.wa_walkins_booked || 0;
      if (r.google_rating) m.googleRating = r.google_rating;
      m.googleReviews += r.google_new_reviews || 0;
    }

    const stores = Object.values(storeMap);
    const totals = stores.reduce((acc, s) => ({
      mtdRevenue: acc.mtdRevenue + s.mtdRevenue,
      monthlyTarget: acc.monthlyTarget + s.monthlyTarget,
      totalViews: acc.totalViews + s.igViewsAchieved + s.ytViews + s.ttViews + s.scViews,
      totalEngagements: acc.totalEngagements + s.igLikes + s.igComments + s.igSaves + s.igShares + s.ytLikes + s.ttLikes,
      totalDms: acc.totalDms + s.igDms,
      totalWaChats: acc.totalWaChats + s.waChats,
      totalWaWalkins: acc.totalWaWalkins + s.waWalkins,
      totalPrebookings: acc.totalPrebookings + s.prebookings,
      totalGoogleReviews: acc.totalGoogleReviews + s.googleReviews,
    }), { mtdRevenue: 0, monthlyTarget: 0, totalViews: 0, totalEngagements: 0, totalDms: 0, totalWaChats: 0, totalWaWalkins: 0, totalPrebookings: 0, totalGoogleReviews: 0 });

    const socialByPlatform = [
      { name: "Instagram", views: stores.reduce((s, st) => s + st.igViewsAchieved, 0), engagements: stores.reduce((s, st) => s + st.igLikes + st.igComments + st.igSaves + st.igShares, 0), color: "#E1306C" },
      { name: "YouTube", views: stores.reduce((s, st) => s + st.ytViews, 0), engagements: stores.reduce((s, st) => s + st.ytLikes + st.ytComments, 0), color: "#FF0000" },
      { name: "TikTok", views: stores.reduce((s, st) => s + st.ttViews, 0), engagements: stores.reduce((s, st) => s + st.ttLikes, 0), color: "#00f2ea" },
      { name: "Snapchat", views: stores.reduce((s, st) => s + st.scViews, 0), engagements: stores.reduce((s, st) => s + st.scShares, 0), color: "#FFFC00" },
    ];

    return { stores, totals, socialByPlatform };
  }, [sheetsData]);

  if (!sheetsLoading && !sheetsData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl">
        <AlertTriangle size={36} className="text-rose-400 mb-3" />
        <h3 className="text-base font-semibold text-white mb-1">Failed to load dashboard data</h3>
        <p className="text-xs text-[var(--text-muted)]">Please check backend connection or refresh.</p>
      </div>
    );
  }

  const kpiCards = kpiData
    ? [
        { title: "Total Revenue", value: kpiData.totalRevenue, type: "money" as const, icon: <DollarSign size={20} />, color: "#3b82f6" },
        { title: "Total Target", value: kpiData.totalTarget, type: "money" as const, icon: <Target size={20} />, color: "#10b981" },
        { title: "Achievement %", value: kpiData.achievementPct, type: "percent" as const, icon: <TrendingUp size={20} />, color: "#a855f7" },
        { title: "Total Investment", value: 0, type: "money" as const, icon: <Briefcase size={20} />, color: "#f97316" },
        { title: "Active Team Leaders", value: ops?.tlList.length || 0, type: "number" as const, icon: <Users size={20} />, color: "#ec4899" },
        { title: "Active Leads", value: ops?.totalWalkins || 0, type: "number" as const, icon: <Phone size={20} />, color: "#06b6d4" },
      ]
    : [];

  const gaugeData = kpiData ? [{ name: "Achievement", value: kpiData.achievementPct, fill: "#a855f7" }] : [];
  const hasRevenueBreakdown = revenueBreakdown.length > 0;
  const hasLeadDistribution = leadDistribution.some((x) => x.value > 0);

  return (
    <ErrorBoundary>
      <div className="space-y-6 w-full min-w-0">


        {tab === "summary" && (
          <AISummary />
        )}

        {tab === "dashboard" && (
          <div className="space-y-6 w-full min-w-0">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 min-w-0">
              {sheetsLoading
            ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
            : kpiCards.map((card, i) => <StatCard key={i} {...card} />)}
        </div>

        {ops && (
          <ErrorBoundary>
            <Suspense fallback={<div className="h-[480px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] animate-pulse" />}>
              <BranchGlobe stores={ops.storeAchievements} />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Charts Grid: Revenue Trend & Gauge */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
          <div className="lg:col-span-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Revenue vs Target Trend</h3>
                <p className="text-xs text-[var(--text-muted)]">30-day breakdown of daily revenue logs</p>
              </div>
            </div>
            {sheetsLoading ? (
              <div className="h-64 sm:h-72 animate-pulse bg-[var(--border-subtle)]/30 rounded-xl" />
            ) : (
              <div className="h-64 sm:h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueTrend} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} width={45} />
                    <Tooltip contentStyle={{ backgroundColor: "#11131e", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px", color: "#fff" }} labelStyle={{ color: "#a1a1aa", fontWeight: 600 }} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 flex flex-col justify-between min-w-0">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Overall Achievement Rate</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">Monthly target fulfillment gauge</p>
            </div>
            {sheetsLoading ? (
              <div className="h-64 sm:h-72 animate-pulse bg-[var(--border-subtle)]/30 rounded-xl" />
            ) : (
              <div className="h-64 sm:h-72 w-full min-w-0 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="95%" barSize={18} data={gaugeData} startAngle={180} endAngle={0}>
                    <RadialBar dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center top-6">
                  <span className="text-3xl font-extrabold text-white tracking-tight">{(kpiData?.achievementPct || 0).toFixed(1)}%</span>
                  <span className="text-xs text-[var(--text-muted)] font-medium mt-1">Goal Completed</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════ CEO OVERVIEW: Store Achievement + TL Achievement ══════════ */}
        {ops && (
          <>
            {/* CEO KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 min-w-0">
              {[
                { label: "India MTD Revenue", value: fmtINR(ops.totalRevenue), sub: `vs ${fmtINR(ops.totalTarget)} target`, color: "#3b82f6" },
                { label: "India Achievement", value: `${ops.overallAch}%`, sub: `${ops.tlList.length} TLs \u00b7 ${ops.storeAchievements.length} stores`, color: ops.overallAch >= 50 ? "#10b981" : "#f59e0b" },
                { label: "Walk-ins (Month)", value: ops.totalWalkins.toLocaleString(), sub: `${ops.totalConversions} conversions \u00b7 ${ops.overallConv}%`, color: "#10b981" },
                { label: "Critical Stores", value: String(ops.rag.red), sub: `${ops.rag.red} below 35% target`, color: "#ef4444" },
              ].map((k, i) => (
                <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{k.label}</p>
                  <p className="text-xl font-extrabold text-white">{k.value}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Store Achievement + TL Achievement Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-w-0">
              <div className="lg:col-span-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
                <h3 className="text-sm font-bold text-white tracking-tight mb-1">India Store MTD Achievement %</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">All 24 India stores ranked by performance</p>
                <div className="h-[420px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ops.storeAchievements} layout="vertical" margin={{ left: 5, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" domain={[0, 120]} tick={{ fontSize: 10, fill: "#a1a1aa" }} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="store" tick={{ fontSize: 9, fill: "#a1a1aa" }} width={120} tickFormatter={shortStore} />
                      <Tooltip formatter={(v: any) => [`${v}%`, "Achievement"]} contentStyle={{ backgroundColor: "#11131e", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} />
                      <Bar dataKey="achPct" radius={[0, 4, 4, 0]}>
                        {ops.storeAchievements.map((s: any, i: number) => <Cell key={i} fill={ragColor(s.achPct)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
                <h3 className="text-sm font-bold text-white tracking-tight mb-1">TL Achievement %</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">Team leader performance ranking</p>
                <div className="h-[420px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ops.tlList.map((t: any) => ({ name: t.name, achPct: t.achPct, color: t.color }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#a1a1aa" }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: any) => [`${v}%`, "Achievement"]} contentStyle={{ backgroundColor: "#11131e", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} />
                      <Bar dataKey="achPct" radius={[6, 6, 0, 0]}>
                        {ops.tlList.map((t: any, i: number) => <Cell key={i} fill={ragColor(t.achPct)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* RAG Donut + TL Target vs Achieved + Walk-ins */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
                <h3 className="text-sm font-bold text-white tracking-tight mb-1">RAG Status Distribution</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">Store health overview</p>
                <div className="h-56 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ name: "Green \u226565%", value: ops.rag.green }, { name: "Amber 35\u201364%", value: ops.rag.amber }, { name: "Red <35%", value: ops.rag.red }]} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" stroke="#11131e" strokeWidth={2}>
                        <Cell fill="#10b981" /><Cell fill="#f59e0b" /><Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#11131e", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
                <h3 className="text-sm font-bold text-white tracking-tight mb-1">TL Target vs Achieved (\u20b9 Lakhs)</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">Monthly comparison</p>
                <div className="h-56 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ops.tlList.map((t: any) => ({ name: t.name, target: +(t.target / 100000).toFixed(1), achieved: +(t.achieved / 100000).toFixed(1) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickFormatter={(v) => `\u20b9${v}L`} />
                      <Tooltip contentStyle={{ backgroundColor: "#11131e", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} formatter={(v: any) => `\u20b9${v}L`} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                      <Bar dataKey="target" fill="#374151" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="achieved" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
                <h3 className="text-sm font-bold text-white tracking-tight mb-1">WhatsApp Walk-ins \u2014 Top Stores</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">Marketing channel performance</p>
                <div className="h-56 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...ops.storeAchievements].filter((s: any) => s.walkins > 0).sort((a: any, b: any) => b.walkins - a.walkins).slice(0, 12).map((s: any) => ({ name: shortStore(s.store), walkins: s.walkins }))} layout="vertical" margin={{ left: 5, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#a1a1aa" }} width={90} />
                      <Tooltip contentStyle={{ backgroundColor: "#11131e", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} />
                      <Bar dataKey="walkins" fill="#25d366" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* TL Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
              {ops.tlList.map((tl: any, i: number) => (
                <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: tl.color }} />
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white">{tl.name}</span>
                    <span className="text-xl font-extrabold" style={{ color: tl.color }}>{tl.achPct}%</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)] mb-3">
                    <span>{"\ud83c\udfaf"} {fmtINR(tl.target)}</span>
                    <span>{"\u2705"} {fmtINR(tl.achieved)}</span>
                    <span>{"\ud83d\udc63"} {tl.walkins} walkins</span>
                    <span>{"\ud83e\udd1d"} {tl.conv} conv ({tl.convPct}%)</span>
                  </div>
                  <div className="w-full bg-[var(--border-subtle)] rounded-full h-2 overflow-hidden mb-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(tl.achPct, 100)}%`, background: tl.color }} />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">Stores: <span className="text-[var(--text-secondary)]">{tl.stores.join(", ")}</span></p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══════════ MARKETING & SOCIAL MEDIA SECTION (from xlsx) ══════════ */}
        {marketingData && (
          <>
            {/* Marketing KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
              {[
                { label: "Total Social Reach", value: fmtNum(marketingData.totals.totalViews), icon: <Eye size={20} />, color: "#3b82f6", suffix: "views" },
                { label: "Total Engagements", value: fmtNum(marketingData.totals.totalEngagements), icon: <Video size={20} />, color: "#E1306C", suffix: "" },
                { label: "WhatsApp Leads", value: marketingData.totals.totalWaChats.toLocaleString(), icon: <MessageCircle size={20} />, color: "#25d366", suffix: `chats · ${marketingData.totals.totalWaWalkins} walk-ins` },
                { label: "Google Reviews", value: marketingData.totals.totalGoogleReviews.toLocaleString(), icon: <Star size={20} />, color: "#f59e0b", suffix: `across ${marketingData.stores.length} stores` },
              ].map((k, i) => (
                <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg" style={{ background: `${k.color}20` }}>
                      <div style={{ color: k.color }}>{k.icon}</div>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{k.label}</p>
                  </div>
                  <p className="text-xl font-extrabold text-white">{k.value}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{k.suffix}</p>
                </div>
              ))}
            </div>

            {/* Social Media Performance Chart */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
              <h3 className="text-base font-bold text-white tracking-tight mb-1">Social Media Performance by Platform</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">Views vs Engagements across Instagram, YouTube, TikTok, Snapchat</p>
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marketingData.socialByPlatform}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#11131e", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                    <Bar dataKey="views" fill="#3b82f6" name="Views" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="engagements" fill="#a855f7" name="Engagements" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Store Marketing Table */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="text-[#E1306C]" size={20} />
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Store Marketing Summary</h3>
                  <p className="text-xs text-[var(--text-muted)]">Social media + WhatsApp + Google Reviews by store</p>
                </div>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                      <th className="py-3 px-3 font-semibold">Store</th>
                      <th className="py-3 px-3 font-semibold text-right">IG Views</th>
                      <th className="py-3 px-3 font-semibold text-right">IG Followers</th>
                      <th className="py-3 px-3 font-semibold text-right">IG Engagements</th>
                      <th className="py-3 px-3 font-semibold text-right">YT Views</th>
                      <th className="py-3 px-3 font-semibold text-right">TT Views</th>
                      <th className="py-3 px-3 font-semibold text-right">WA Chats</th>
                      <th className="py-3 px-3 font-semibold text-right">Google Reviews</th>
                      <th className="py-3 px-3 font-semibold text-right">MTD Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {marketingData.stores.sort((a: any, b: any) => b.mtdRevenue - a.mtdRevenue).map((s: any, i: number) => (
                      <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                        <td className="py-3 px-3 font-medium text-white text-xs">{shortStore(s.store)}</td>
                        <td className="py-3 px-3 text-right text-xs">{(s.igViewsAchieved || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-xs">{(s.igFollowers || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-xs">{(s.igLikes + s.igComments + s.igSaves + s.igShares).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-xs">{(s.ytViews || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-xs">{(s.ttViews || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-xs">{(s.waChats || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-xs">{(s.googleReviews || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-xs font-semibold text-white">{"\u20b9"}{(s.mtdRevenue || 0).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Loading indicator for sheets */}
        {sheetsLoading && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center">
            <div className="text-sm text-[var(--text-muted)]">Loading store performance data from Google Sheets...</div>
          </div>
        )}

        {/* Breakdown Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
            <h3 className="text-base font-bold text-white tracking-tight mb-1">Revenue Breakdown</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">Distribution by team leader</p>
            {sheetsLoading ? (
              <div className="h-64 animate-pulse bg-[var(--border-subtle)]/30 rounded-xl" />
            ) : !hasRevenueBreakdown ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                <PieIcon size={32} className="text-[var(--text-muted)] mb-2 opacity-40" />
                <p className="text-xs font-semibold text-[var(--text-secondary)]">No revenue logged yet</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Submit daily operations logs to populate this breakdown</p>
              </div>
            ) : (
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revenueBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={50} paddingAngle={4}>
                      {revenueBreakdown.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="rgba(0,0,0,0.4)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#11131e", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
            <h3 className="text-base font-bold text-white tracking-tight mb-1">Lead Status Distribution</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">Current lead qualification funnel</p>
            {sheetsLoading ? (
              <div className="h-64 animate-pulse bg-[var(--border-subtle)]/30 rounded-xl" />
            ) : !hasLeadDistribution ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                <PieIcon size={32} className="text-[var(--text-muted)] mb-2 opacity-40" />
                <p className="text-xs font-semibold text-[var(--text-secondary)]">No leads registered yet</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Add leads in the Leads module to see status distribution</p>
              </div>
            ) : (
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={leadDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={50} paddingAngle={4}>
                      {leadDistribution.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="rgba(0,0,0,0.4)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#11131e", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Top Team Leaders Table Card */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <Award className="text-[var(--accent-blue)]" size={20} />
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Top Performing Team Leaders</h3>
              <p className="text-xs text-[var(--text-muted)]">Leading teams by revenue achievement</p>
            </div>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                  <th className="py-3 px-4 font-semibold">Team Leader</th>
                  <th className="py-3 px-4 font-semibold text-right">Revenue</th>
                  <th className="py-3 px-4 font-semibold text-right">Target</th>
                  <th className="py-3 px-4 font-semibold text-right">Achievement</th>
                  <th className="py-3 px-4 font-semibold text-right">Active Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {topTeamLeaders.map((tl: any, i: number) => (
                  <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center text-[var(--accent-blue)] font-bold text-xs shrink-0">
                        {tl.name ? tl.name.charAt(0) : "T"}
                      </div>
                      <span>{tl.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-white">{"\u20b9"}{(tl.revenue || 0).toLocaleString("en-IN")}</td>
                    <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{"\u20b9"}{(tl.target || 0).toLocaleString("en-IN")}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <div className="w-24 h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden shrink-0">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ width: `${Math.min(tl.achievement || 0, 100)}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-[var(--text-primary)] min-w-[42px] text-right">{(tl.achievement || 0).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-[var(--text-primary)]">{tl.active_leads || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
          {[
            { label: "Total Stores", value: ops?.storeAchievements.length || 0 },
            { label: "Green Stores (65%+)", value: ops?.rag.green || 0 },
            { label: "Red Stores (<35%)", value: ops?.rag.red || 0 },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-center hover:border-white/10 transition-colors">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1">{item.label}</p>
              <p className="text-2xl font-bold text-white">{item.value}</p>
            </div>
          ))}
        </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
