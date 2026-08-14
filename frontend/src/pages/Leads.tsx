import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/lib/authStore";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AISummary } from "@/components/dashboard/AISummary";
import { BarChart3, Filter, Phone, Store, Users } from "lucide-react";
import { TableSkeleton } from "@/components/shared/Skeleton";

import { useSocketRefresh } from "../hooks/useSocketRefresh";

export default function Leads() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "main";
  useSocketRefresh(["leads"]);
  const { token } = useAuthStore();
  const [sheetsData, setSheetsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("");
  const [tlFilter, setTlFilter] = useState("");

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ceo-dashboard/sheets-data?tab=all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (!d.error) setSheetsData(d);
      }
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchSheets(); }, [fetchSheets]);

  const opsData = sheetsData?.ops_data || [];

  const storeLeads = useMemo(() => {
    const map: Record<string, { newLeads: number; activeLeads: number; callsMade: number; callsConnected: number; walkins: number; conversions: number; tl: string }> = {};
    for (const r of opsData) {
      if (!r.store || r.store === "STORE NAME") continue;
      if (!map[r.store]) map[r.store] = { newLeads: 0, activeLeads: 0, callsMade: 0, callsConnected: 0, walkins: 0, conversions: 0, tl: r.tl };
      map[r.store].newLeads += r.new_leads || 0;
      map[r.store].activeLeads += r.active_leads || 0;
      map[r.store].callsMade += r.calls_made || 0;
      map[r.store].callsConnected += r.calls_connected || 0;
      map[r.store].walkins += r.walk_ins || 0;
      map[r.store].conversions += r.walk_in_conversions || 0;
      map[r.store].tl = r.tl;
    }
    return Object.entries(map)
      .map(([store, d]) => ({
        store, ...d,
        convPct: d.walkins > 0 ? Math.round((d.conversions / d.walkins) * 100) : 0,
        callPct: d.callsMade > 0 ? Math.round((d.callsConnected / d.callsMade) * 100) : 0,
      }))
      .filter((s) => {
        if (storeFilter && s.store !== storeFilter) return false;
        if (tlFilter && s.tl !== tlFilter) return false;
        return true;
      })
      .sort((a, b) => b.activeLeads - a.activeLeads);
  }, [opsData, storeFilter, tlFilter]);

  const uniqueStores = useMemo((): string[] => {
    const ss = new Set<string>(opsData.map((r: any) => r.store).filter(Boolean));
    return Array.from(ss).sort();
  }, [opsData]);

  const uniqueTLs = useMemo((): string[] => {
    const tls = new Set<string>(opsData.map((r: any) => r.tl).filter(Boolean));
    return Array.from(tls).sort();
  }, [opsData]);

  const totalNewLeads = storeLeads.reduce((s, r) => s + r.newLeads, 0);
  const totalActiveLeads = storeLeads.reduce((s, r) => s + r.activeLeads, 0);
  const totalCalls = storeLeads.reduce((s, r) => s + r.callsMade, 0);
  const totalConnected = storeLeads.reduce((s, r) => s + r.callsConnected, 0);

  return (
    <ErrorBoundary>
      {tab === "analytics" ? (
        <AISummary section="leads" title="Leads AI Summary" />
      ) : (
        <div className="space-y-6">

        

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total New Leads", value: totalNewLeads.toLocaleString(), color: "#3b82f6" },
            { label: "Active Leads", value: totalActiveLeads.toLocaleString(), color: "#10b981" },
            { label: "Calls Made", value: totalCalls.toLocaleString(), color: "#a855f7" },
            { label: "Call Connect Rate", value: `${totalCalls > 0 ? Math.round(totalConnected / totalCalls * 100) : 0}%`, color: "#f59e0b" },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{k.label}</p>
              <p className="text-xl font-extrabold text-white">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-2xl">
          <Filter size={16} className="text-[var(--text-muted)] ml-1 shrink-0" />
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none max-w-[200px] w-full"
          >
            <option value="">All Stores</option>
            {[...uniqueStores].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={tlFilter}
            onChange={(e) => setTlFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none max-w-[200px] w-full"
          >
            <option value="">All TLs</option>
            {[...uniqueTLs].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          {loading ? (
            <TableSkeleton rows={5} cols={7} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Store</th>
                    <th className="py-3 px-4 font-semibold">TL</th>
                    <th className="py-3 px-4 font-semibold text-right">New Leads</th>
                    <th className="py-3 px-4 font-semibold text-right">Active Leads</th>
                    <th className="py-3 px-4 font-semibold text-right">Calls Made</th>
                    <th className="py-3 px-4 font-semibold text-right">Connected</th>
                    <th className="py-3 px-4 font-semibold text-right">Walk-ins</th>
                    <th className="py-3 px-4 font-semibold text-right">Conversions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {storeLeads.map((s, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2.5">
                        <Store size={15} className="text-[var(--accent-blue)] shrink-0" />
                        <span>{s.store}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{s.tl}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[var(--accent-blue)]">{s.newLeads}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-400">{s.activeLeads}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{s.callsMade}</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{s.callsConnected} ({s.callPct}%)</td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{s.walkins}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-emerald-400">{s.conversions} ({s.convPct}%)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    
      )}
    </ErrorBoundary>
  );
}
