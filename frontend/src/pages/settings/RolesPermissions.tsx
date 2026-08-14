import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { useState, useEffect } from "react";
import { Shield, Save, Check, Loader2 } from "lucide-react";

const RESOURCES = ["dashboard","operations","investments","team_leaders","leads","campaigns","tasks","performance","reports","users","roles","settings","sheet_sync","instagram"];
const ACTIONS = ["view","create","edit","delete","export"];

export default function RolesPermissions() {
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [permMap, setPermMap] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();

  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: () => api.get<any[]>("/roles/") });
  const { data: allPerms } = useQuery({ queryKey: ["all-permissions"], queryFn: () => api.get<any[]>("/roles/permissions/all") });
  const { data: rolePerms, isLoading } = useQuery({
    queryKey: ["role-perms", selectedRole],
    queryFn: () => api.get<any[]>(`/roles/${selectedRole}/permissions`),
    enabled: !!selectedRole,
  });

  useEffect(() => {
    if (roles && roles.length > 0 && selectedRole === null) {
      setSelectedRole(roles[0].id);
    }
  }, [roles]);

  useEffect(() => {
    if (rolePerms) {
      const map: Record<string, boolean> = {};
      rolePerms.forEach((p: any) => { map[`${p.resource}:${p.action}`] = true; });
      setPermMap(map);
    }
  }, [rolePerms]);

  const saveMutation = useMutation({
    mutationFn: (ids: number[]) => api.put(`/roles/${selectedRole}/permissions`, { permission_ids: ids }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["role-perms"] }),
  });

  const toggle = (resource: string, action: string) => {
    setPermMap(prev => ({ ...prev, [`${resource}:${action}`]: !prev[`${resource}:${action}`] }));
  };

  const save = () => {
    if (!selectedRole || !allPerms) return;
    const ids = allPerms.filter((p: any) => permMap[`${p.resource}:${p.action}`]).map((p: any) => p.id);
    saveMutation.mutate(ids);
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield className="text-[var(--accent-blue)]" size={22} />
            Roles & Permissions Matrix
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Configure granular resource access permissions for system roles
          </p>
        </div>

        {/* Role Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(roles || []).map((r: any) => (
            <button
              key={r.id}
              onClick={() => setSelectedRole(r.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedRole === r.id
                  ? "bg-[var(--accent-blue)] text-white shadow-md"
                  : "bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>

        {selectedRole && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-6 overflow-auto">
              {isLoading ? (
                <TableSkeleton rows={5} cols={6} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                        <th className="py-3 px-4 font-semibold">Resource</th>
                        {ACTIONS.map((a) => (
                          <th key={a} className="py-3 px-4 font-semibold text-center capitalize">
                            {a}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {RESOURCES.map((res) => (
                        <tr key={res} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                          <td className="py-3 px-4 text-white font-semibold capitalize text-xs">
                            {res.replace(/_/g, " ")}
                          </td>
                          {ACTIONS.map((act) => (
                            <td key={act} className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={!!permMap[`${res}:${act}`]}
                                onChange={() => toggle(res, act)}
                                className="h-4 w-4 rounded border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--accent-blue)] focus:ring-0 cursor-pointer"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button
              onClick={save}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saveMutation.isPending ? "Saving Permissions..." : "Save Permissions"}</span>
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
