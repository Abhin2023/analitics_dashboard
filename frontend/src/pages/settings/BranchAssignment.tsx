import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { MapPin, AlertTriangle, GitMerge, CheckCircle2, Filter } from "lucide-react";

export default function BranchAssignment() {
  const [countryFilter, setCountryFilter] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [mergeTargets, setMergeTargets] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();

  const { data: stores, isLoading } = useQuery({ queryKey: ["stores"], queryFn: () => api.get<any[]>("/stores/") });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get<any[]>("/users/") });

  const teamLeaders = (users || []).filter((u: any) => u.role_name === "Team Leader");

  const assignMutation = useMutation({
    mutationFn: ({ storeId, teamLeaderId, clearReview }: { storeId: number; teamLeaderId: number; clearReview: boolean }) =>
      api.put(`/stores/${storeId}`, { team_leader_id: teamLeaderId, ...(clearReview ? { needs_review: false } : {}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stores"] }),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ storeId, targetId }: { storeId: number; targetId: number }) =>
      api.post(`/stores/${storeId}/merge-into/${targetId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stores"] }),
  });

  const uniqueCountries = Array.from(new Set((stores || []).map((s: any) => s.country || "India"))).sort();

  const filtered = (stores || []).filter((s: any) => {
    if (countryFilter && (s.country || "India") !== countryFilter) return false;
    if (reviewOnly && !s.needs_review) return false;
    return true;
  });

  const reviewCount = (stores || []).filter((s: any) => s.needs_review).length;

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <MapPin className="text-[var(--accent-blue)]" size={22} />
            Team Leaders & Branches
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Assign a team leader to any branch, regardless of country or data source. Branches auto-created by
            the MCP sync land here flagged for review until confirmed.
          </p>
        </div>

        {reviewCount > 0 && (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm">
            <AlertTriangle size={16} />
            {reviewCount} branch{reviewCount > 1 ? "es" : ""} need review after the last MCP sync.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-2xl">
          <Filter size={16} className="text-[var(--text-muted)] ml-1 shrink-0" />
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none max-w-[200px] w-full"
          >
            <option value="">All Countries</option>
            {uniqueCountries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
            Needs review only
          </label>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          {isLoading ? (
            <TableSkeleton rows={8} cols={5} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Branch</th>
                    <th className="py-3 px-4 font-semibold">Country</th>
                    <th className="py-3 px-4 font-semibold">Region</th>
                    <th className="py-3 px-4 font-semibold">Team Leader</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filtered.map((s: any) => (
                    <tr key={s.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          {s.name}
                          {s.needs_review && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              needs review
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">{s.country || "India"}</td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">{s.region || "—"}</td>
                      <td className="py-3 px-4">
                        <select
                          value={s.team_leader_id}
                          onChange={(e) =>
                            assignMutation.mutate({ storeId: s.id, teamLeaderId: Number(e.target.value), clearReview: false })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
                        >
                          {s.team_leader_id && !teamLeaders.some((tl: any) => tl.id === s.team_leader_id) && (
                            <option value={s.team_leader_id}>{s.team_leader_name || "Unassigned"}</option>
                          )}
                          {teamLeaders.map((tl: any) => (
                            <option key={tl.id} value={tl.id}>{tl.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {s.needs_review ? (
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={mergeTargets[s.id] || ""}
                              onChange={(e) => setMergeTargets((p) => ({ ...p, [s.id]: e.target.value }))}
                              className="px-2 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none max-w-[160px]"
                            >
                              <option value="">Merge into...</option>
                              {(stores || [])
                                .filter((t: any) => t.id !== s.id && !t.needs_review)
                                .map((t: any) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <button
                              onClick={() => mergeTargets[s.id] && mergeMutation.mutate({ storeId: s.id, targetId: Number(mergeTargets[s.id]) })}
                              disabled={!mergeTargets[s.id] || mergeMutation.isPending}
                              title="Merge as duplicate"
                              className="p-1.5 rounded-lg bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 disabled:opacity-40"
                            >
                              <GitMerge size={15} />
                            </button>
                            <button
                              onClick={() => assignMutation.mutate({ storeId: s.id, teamLeaderId: s.team_leader_id, clearReview: true })}
                              disabled={assignMutation.isPending}
                              title="Confirm as new branch"
                              className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
