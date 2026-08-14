import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AISummary } from "@/components/dashboard/AISummary";
import { BarChart3, CheckCircle2, CheckSquare, Plus } from "lucide-react";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export default function Tasks() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "main";
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", type: "task", priority: "medium", due_at: "" });
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", statusFilter],
    queryFn: () => api.get<any[]>(`/tasks/${statusFilter ? `?task_status=${statusFilter}` : ""}`),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/tasks", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tasks"] }); setShowForm(false); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/tasks/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <ErrorBoundary>
      {tab === "analytics" ? (
        <AISummary section="tasks" title="Tasks AI Summary" />
      ) : (
        <div className="space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
          

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>{showForm ? "Cancel Form" : "New Task"}</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {["", "pending", "in_progress", "completed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === s
                  ? "bg-[var(--accent-blue)] text-white shadow-md"
                  : "bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white"
              }`}
            >
              {s ? s.replace("_", " ") : "All Tasks"}
            </button>
          ))}
        </div>

        {showForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shadow-xl animate-fade-in"
          >
            <input
              placeholder="Task Title *"
              value={form.title}
              onChange={(e) => setForm(p => ({...p, title: e.target.value}))}
              required
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <select
              value={form.priority}
              onChange={(e) => setForm(p => ({...p, priority: e.target.value}))}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <input
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm(p => ({...p, due_at: e.target.value}))}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? "Saving..." : "Save Task"}
            </button>
          </form>
        )}

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-hidden">
          {isLoading ? (
            <TableSkeleton />
          ) : !tasks?.length ? (
            <EmptyState title="No tasks found" description="No task items match the selected status." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="py-3 px-4 font-semibold">Title</th>
                    <th className="py-3 px-4 font-semibold">Type</th>
                    <th className="py-3 px-4 font-semibold">Priority</th>
                    <th className="py-3 px-4 font-semibold">Due Date</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {tasks.map((t: any) => (
                    <tr key={t.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">{t.title}</td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)] capitalize">{t.type}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase border ${PRIORITY_COLORS[t.priority] || ""}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">
                        {t.due_at ? new Date(t.due_at).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase border ${STATUS_COLORS[t.status] || ""}`}>
                          {t.status?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {t.status !== "completed" && (
                          <button
                            onClick={() => updateStatus.mutate({ id: t.id, status: "completed" })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-all cursor-pointer"
                          >
                            <CheckCircle2 size={14} />
                            <span>Complete</span>
                          </button>
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
    
      )}
    </ErrorBoundary>
  );
}
