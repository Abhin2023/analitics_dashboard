import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { StatCard } from "@/components/shared/StatCard";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TableSkeleton } from "@/components/shared/Skeleton";
import {
  Phone, PhoneCall, PhoneOff, CalendarCheck, DollarSign,
  Clock, AlertCircle, CheckCircle2, TrendingUp, Brain,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  "Sale Conversion": "#10b981",
  "Appointment": "#3b82f6",
  "Will Visit": "#a855f7",
  "Call back later": "#f59e0b",
  "Not Interested": "#ef4444",
  "Call Not Connected": "#64748b",
  "Wrong number": "#6b7280",
  "Unattended": "#374151",
};
const COLORS = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#64748b", "#6b7280", "#374151"];

export default function TelecallerDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "telecaller"],
    queryFn: () => api.get<any>("/dashboard/telecaller"),
    refetchInterval: 300000,
  });

  if (isLoading) return <div className="p-6"><TableSkeleton /></div>;
  if (!data) return null;

  const { kpi, status_breakdown, recent_leads, daily_calls, ai_summary } = data;

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">My Performance</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Your calling stats, lead conversions, and analytics
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Leads"
            value={kpi.total_leads}
            icon={<Phone size={20} />}
            color="#3b82f6"
            type="number"
          />
          <StatCard
            title="Converted"
            value={kpi.converted}
            icon={<CheckCircle2 size={20} />}
            color="#10b981"
            type="number"
          />
          <StatCard
            title="Appointments"
            value={kpi.appointments}
            icon={<CalendarCheck size={20} />}
            color="#a855f7"
            type="number"
          />
          <StatCard
            title="Conversion Rate"
            value={kpi.conversion_pct}
            icon={<TrendingUp size={20} />}
            color={kpi.conversion_pct >= 15 ? "#10b981" : "#f59e0b"}
            type="percent"
          />
          <StatCard
            title="Sale Amount"
            value={kpi.total_sale_amount}
            icon={<DollarSign size={20} />}
            color="#06b6d4"
            type="money"
          />
        </div>

        {/* Call Activity + Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Call Activity */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <PhoneCall size={16} className="text-[var(--accent-blue)]" />
              Call Activity
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <PhoneCall size={16} className="text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">Connected</span>
                </div>
                <span className="text-lg font-bold text-emerald-400">{kpi.calls_connected}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2">
                  <PhoneOff size={16} className="text-red-400" />
                  <span className="text-xs font-medium text-red-400">Not Connected</span>
                </div>
                <span className="text-lg font-bold text-red-400">{kpi.calls_not_connected}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Callback Pending</span>
                </div>
                <span className="text-lg font-bold text-amber-400">{kpi.call_back_later}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-2">
                  <CalendarCheck size={16} className="text-purple-400" />
                  <span className="text-xs font-medium text-purple-400">Will Visit</span>
                </div>
                <span className="text-lg font-bold text-purple-400">{kpi.will_visit}</span>
              </div>
            </div>
          </div>

          {/* Status Breakdown Donut */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Status Breakdown</h3>
            {status_breakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={status_breakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {status_breakdown.map((s: any, i: number) => (
                        <Cell key={i} fill={STATUS_COLORS[s.status] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {status_breakdown.slice(0, 5).map((s: any, i: number) => (
                    <div key={s.status} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[s.status] || COLORS[i % COLORS.length] }}
                        />
                        <span className="text-[var(--text-secondary)]">{s.status}</span>
                      </div>
                      <span className="font-semibold text-white">{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--text-muted)] text-center py-8">No data yet</p>
            )}
          </div>

          {/* AI Summary */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Brain size={16} className="text-purple-400" />
              AI Insights
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-2">Strengths</p>
                {ai_summary.strengths.map((s: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 mb-1.5">
                    <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-xs text-[var(--text-secondary)]">{s}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-2">Improve</p>
                {ai_summary.improvements.map((s: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 mb-1.5">
                    <AlertCircle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                    <span className="text-xs text-[var(--text-secondary)]">{s}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <p className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold mb-1">Tip</p>
                <p className="text-xs text-purple-300">{ai_summary.tip}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Calls Chart */}
        {daily_calls.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Daily Call Activity</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily_calls.slice(0, 14).reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(d) => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth()+1}`; }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }} />
                <Bar dataKey="connected" fill="#10b981" radius={[4, 4, 0, 0]} name="Connected" />
                <Bar dataKey="not_connected" fill="#ef4444" radius={[4, 4, 0, 0]} name="Not Connected" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Leads Table */}
        {recent_leads.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Recent Leads</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="pb-2 text-left font-semibold">Name</th>
                    <th className="pb-2 text-left font-semibold">Phone</th>
                    <th className="pb-2 text-left font-semibold">Source</th>
                    <th className="pb-2 text-left font-semibold">City</th>
                    <th className="pb-2 text-left font-semibold">Status</th>
                    <th className="pb-2 text-left font-semibold">Call Date</th>
                    <th className="pb-2 text-left font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {recent_leads.map((l: any) => (
                    <tr key={l.id} className="hover:bg-[var(--bg-card-hover)]">
                      <td className="py-2.5 font-medium text-white">{l.full_name}</td>
                      <td className="py-2.5 text-[var(--text-secondary)]">{l.phone}</td>
                      <td className="py-2.5 text-[var(--text-secondary)]">{l.lead_source}</td>
                      <td className="py-2.5 text-[var(--text-secondary)]">{l.sheet_tl_name}</td>
                      <td className="py-2.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${STATUS_COLORS[l.status] || "#64748b"}15`,
                            color: STATUS_COLORS[l.status] || "#64748b",
                            border: `1px solid ${STATUS_COLORS[l.status] || "#64748b"}30`,
                          }}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-[var(--text-secondary)]">{l.call_date}</td>
                      <td className="py-2.5 text-[var(--text-secondary)] max-w-[200px] truncate">{l.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
