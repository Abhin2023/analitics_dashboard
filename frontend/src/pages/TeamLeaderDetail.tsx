import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { formatMoney } from "@/lib/formatMoney";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ArrowLeft, Store, Mail, Target, Award } from "lucide-react";

export default function TeamLeaderDetail() {
  const { id } = useParams();
  const { data: stores, isLoading: storesLoading } = useQuery({ queryKey: ["stores"], queryFn: () => api.get<any[]>("/stores/") });
  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ["users"], queryFn: () => api.get<any[]>("/users/") });

  const tl = (users || []).find((u: any) => u.id === Number(id));
  const tlStores = (stores || []).filter((s: any) => s.team_leader_id === Number(id));

  if (usersLoading || storesLoading) return <div className="text-[var(--text-muted)] p-6">Loading team leader details...</div>;
  if (!tl) return <div className="text-[var(--text-muted)] p-6">Team leader record not found.</div>;

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            to="/team-leaders"
            className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{tl.name}</h2>
            <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
              <Mail size={12} className="text-[var(--accent-blue)]" />
              {tl.email}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Store className="text-[var(--accent-blue)]" size={18} />
            Managed Stores ({tlStores.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tlStores.map((s: any) => (
            <Link
              key={s.id}
              to={`/operations?store_id=${s.id}`}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 hover:border-white/15 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center text-[var(--accent-blue)]">
                  <Store size={20} />
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  {s.region || "Store"}
                </span>
              </div>

              <h4 className="font-bold text-white group-hover:text-[var(--accent-blue)] transition-colors">{s.name}</h4>

              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[var(--text-muted)] font-medium">Daily Target</p>
                  <p className="text-white font-semibold mt-0.5">{formatMoney(s.daily_target)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] font-medium">Monthly Target</p>
                  <p className="text-white font-semibold mt-0.5">{formatMoney(s.monthly_target)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
}
