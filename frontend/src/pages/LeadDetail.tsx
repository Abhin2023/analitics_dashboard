import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ArrowLeft, Phone, Store, Globe, Tag, Clock, UserCheck } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  hot: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  warm: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  cold: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  inactive: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export default function LeadDetail() {
  const { id } = useParams();
  const { data: leads, isLoading: leadsLoading } = useQuery({ queryKey: ["leads"], queryFn: () => api.get<any[]>("/leads/") });
  const { data: activities } = useQuery({
    queryKey: ["lead-activities", id],
    queryFn: () => api.get<any[]>(`/leads/${id}/activities`),
  });

  const lead = (leads || []).find((l: any) => l.id === Number(id));
  if (leadsLoading) return <div className="text-[var(--text-muted)] p-6">Loading lead details...</div>;
  if (!lead) return <div className="text-[var(--text-muted)] p-6">Lead record not found.</div>;

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            to="/leads"
            className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight">{lead.name}</h2>
              <span className={`px-3 py-0.5 rounded-full text-xs font-semibold uppercase border ${STATUS_COLORS[lead.status] || ""}`}>
                {lead.status}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Lead Details & Activity History</p>
          </div>
        </div>

        {/* Lead Info Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center text-[var(--accent-blue)] shrink-0">
              <Phone size={18} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Phone</p>
              <p className="text-sm font-semibold text-white mt-0.5">{lead.phone}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Store size={18} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Store</p>
              <p className="text-sm font-semibold text-white mt-0.5">{lead.store_name}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Globe size={18} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Source</p>
              <p className="text-sm font-semibold text-white mt-0.5">{lead.source}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Tag size={18} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Stage</p>
              <p className="text-sm font-semibold text-white mt-0.5">{lead.stage}</p>
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Clock size={18} className="text-[var(--accent-blue)]" />
            Activity Timeline
          </h3>

          {(!activities || activities.length === 0) ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">No activities logged yet for this lead.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a: any) => (
                <div key={a.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]/50 p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-blue)]">
                      {a.type}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                  {a.outcome && <p className="text-xs text-[var(--text-secondary)]">Outcome: <span className="text-white font-medium">{a.outcome}</span></p>}
                  {a.notes && <p className="text-sm text-white pt-1">{a.notes}</p>}
                  <p className="text-xs text-[var(--text-muted)] pt-1 flex items-center gap-1">
                    <UserCheck size={13} />
                    by {a.creator_name || "Unknown Agent"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
