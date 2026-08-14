import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useState } from "react";
import { Table, ExternalLink, Filter } from "lucide-react";

interface FormSubmission {
  id: number;
  form_id: number;
  form_name: string;
  conversation_id: number | null;
  ig_user_id: string;
  phase1_data: Record<string, string>;
  phase2_data: Record<string, string>;
  status: string;
  lead_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

const statusColors: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-300",
  partial: "bg-amber-500/10 text-amber-300",
};

export default function FormSubmissions() {
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["ig-submissions", statusFilter],
    queryFn: () =>
      api.get<FormSubmission[]>(
        `/instagram/submissions${statusFilter ? `?status=${statusFilter}` : ""}`
      ),
  });

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Table className="text-blue-400" size={22} />
              Form Submissions
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              View all submissions from Instagram lead capture forms
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[var(--text-muted)]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-white"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="partial">Partial</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[var(--bg-card)] animate-pulse" />
            ))}
          </div>
        ) : submissions && submissions.length > 0 ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Form</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Instagram User</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Data</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="border-b border-[var(--border-subtle)] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-white font-medium">{sub.form_name}</td>
                      <td className="px-4 py-3 text-gray-400">@{sub.ig_user_id}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(sub.phase1_data).slice(0, 3).map(([key, val]) => (
                            <span key={key} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300">
                              <span className="text-gray-500 capitalize">{key}:</span> {String(val).slice(0, 20)}
                            </span>
                          ))}
                          {Object.keys(sub.phase2_data).length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300">
                              +{Object.keys(sub.phase2_data).length} phase 2 fields
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColors[sub.status] || "bg-gray-500/10 text-gray-300"}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-10 text-center">
            <Table size={40} className="mx-auto text-blue-400 mb-3 opacity-30" />
            <p className="text-sm font-semibold text-white">No Submissions</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Submissions will appear here as users interact with your forms</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
