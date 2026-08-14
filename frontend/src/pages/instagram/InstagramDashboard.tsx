import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useState } from "react";
import {
  BarChart3, MessageSquare, Users, Bot, ArrowUpRight,
  Coins, TrendingUp, Phone, Camera,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import type { IGStats, IGAccount } from "./types";

const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

export default function InstagramDashboard() {
  const [selectedAccount, setSelectedAccount] = useState<number | undefined>();

  const { data: accounts } = useQuery({
    queryKey: ["ig-accounts"],
    queryFn: () => api.get<IGAccount[]>("/instagram/accounts"),
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["ig-stats", selectedAccount],
    queryFn: () => {
      const params = selectedAccount ? `?ig_account_id=${selectedAccount}` : "";
      return api.get<IGStats>(`/instagram/stats${params}`);
    },
  });

  const primaryAccount = accounts?.[0];
  const creditsData = stats?.credits_used
    ? Object.entries(stats.credits_used).map(([provider, data]) => ({
        name: provider === "claude" ? "Claude" : "ChatGPT",
        tokens: data.input_tokens + data.output_tokens,
        cost: data.cost,
        calls: data.calls,
      }))
    : [];

  const statusData = stats
    ? [
        { name: "Active", value: stats.active_conversations },
        { name: "Archived", value: stats.total_conversations - stats.active_conversations },
      ]
    : [];

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Camera className="text-pink-400" size={22} />
              Instagram Bot Dashboard
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              AI-powered DM automation, comment replies, and lead qualification
            </p>
          </div>
          {accounts && accounts.length > 1 && (
            <select
              value={selectedAccount || ""}
              onChange={(e) => setSelectedAccount(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-semibold text-white"
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.page_name || a.ig_user_id}</option>
              ))}
            </select>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard icon={<MessageSquare size={18} />} label="Total Conversations" value={stats?.total_conversations ?? 0} color="blue" />
          <KPICard icon={<Bot size={18} />} label="AI Responses" value={stats?.ai_responses ?? 0} color="purple" />
          <KPICard icon={<ArrowUpRight size={18} />} label="Messages Sent" value={stats?.messages_sent ?? 0} color="cyan" />
          <KPICard icon={<Phone size={18} />} label="Leads Generated" value={stats?.leads_generated ?? 0} color="green" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Credits Consumption */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Coins size={16} className="text-yellow-400" />
              AI Credit Consumption
            </h3>
            {creditsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={creditsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#1a1b2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Bar dataKey="tokens" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Tokens Used" />
                  <Bar dataKey="calls" fill="#06b6d4" radius={[4, 4, 0, 0]} name="API Calls" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-xs text-[var(--text-muted)]">
                No AI usage data yet. Activate a provider to start.
              </div>
            )}
          </div>

          {/* Conversation Status */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              Conversation Status
            </h3>
            {statusData.length > 0 && statusData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1a1b2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-xs text-[var(--text-muted)]">
                No conversations yet
              </div>
            )}
          </div>
        </div>

        {/* Account Status */}
        {primaryAccount && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-bold text-white mb-3">Connected Account</h3>
            <div className="flex items-center gap-4 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Camera size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{primaryAccount.page_name || primaryAccount.ig_user_id}</p>
                <p className="text-xs text-[var(--text-muted)]">ID: {primaryAccount.ig_user_id}</p>
              </div>
              <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full ${
                primaryAccount.is_active
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}>
                {primaryAccount.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        )}

        {!accounts || accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-10 text-center">
            <Camera size={40} className="mx-auto text-pink-400 mb-3 opacity-50" />
            <p className="text-sm font-semibold text-white">No Instagram Account Connected</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Connect an Instagram Business account to start the AI bot</p>
          </div>
        ) : null}
      </div>
    </ErrorBoundary>
  );
}

function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20",
    cyan: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/20",
    green: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20",
  };
  const textColor: Record<string, string> = {
    blue: "text-blue-400",
    purple: "text-purple-400",
    cyan: "text-cyan-400",
    green: "text-emerald-400",
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${colorMap[color] || colorMap.blue} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={textColor[color] || textColor.blue}>{icon}</span>
        <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );
}
