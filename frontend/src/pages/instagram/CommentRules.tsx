import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useState } from "react";
import {
  Shield, Plus, Trash2, Power, PowerOff, Edit, X, Check,
} from "lucide-react";
import type { IGCommentRule, IGAccount } from "./types";

export default function CommentRules() {
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<IGCommentRule | null>(null);
  const [form, setForm] = useState({
    name: "",
    rule_type: "keyword_match",
    trigger_words: "",
    action: "reply_dm",
    reply_template: "",
    ai_prompt: "",
    priority: 0,
  });
  const queryClient = useQueryClient();

  const { data: accounts } = useQuery({
    queryKey: ["ig-accounts"],
    queryFn: () => api.get<IGAccount[]>("/instagram/accounts"),
  });

  const accountId = accounts?.[0]?.id;

  const { data: rules, isLoading } = useQuery({
    queryKey: ["ig-comment-rules", accountId],
    queryFn: () => api.get<IGCommentRule[]>(`/instagram/comments/rules?ig_account_id=${accountId}`),
    enabled: !!accountId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/instagram/comments/rules?ig_account_id=${accountId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ig-comment-rules"] });
      setShowForm(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/instagram/comments/rules/${editingRule?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ig-comment-rules"] });
      setEditingRule(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/instagram/comments/rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ig-comment-rules"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.put(`/instagram/comments/rules/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ig-comment-rules"] }),
  });

  const resetForm = () => {
    setForm({ name: "", rule_type: "keyword_match", trigger_words: "", action: "reply_dm", reply_template: "", ai_prompt: "", priority: 0 });
  };

  const startEdit = (rule: IGCommentRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      rule_type: rule.rule_type,
      trigger_words: rule.trigger_words.join(", "),
      action: rule.action,
      reply_template: rule.reply_template || "",
      ai_prompt: rule.ai_prompt || "",
      priority: rule.priority,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const data = {
      ...form,
      trigger_words: form.trigger_words.split(",").map((w) => w.trim()).filter(Boolean),
    };
    if (editingRule) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const actionLabels: Record<string, string> = {
    reply_dm: "Reply via DM",
    reply_comment: "Reply to Comment",
    moderation: "Hide / Moderate",
  };

  const typeLabels: Record<string, string> = {
    keyword_match: "Keyword Match",
    ai_reply: "AI Reply",
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Shield className="text-pink-400" size={22} />
              Comment Rules
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Manage auto-reply and moderation rules for Instagram comments
            </p>
          </div>
          {accountId && (
            <button
              onClick={() => { resetForm(); setEditingRule(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-500/20 text-pink-400 border border-pink-500/30 text-xs font-semibold hover:bg-pink-500/30 transition-colors"
            >
              <Plus size={14} />
              Add Rule
            </button>
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="rounded-2xl border border-pink-500/30 bg-[var(--bg-card)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{editingRule ? "Edit Rule" : "New Rule"}</h3>
              <button onClick={() => { setShowForm(false); setEditingRule(null); }} className="p-1 rounded hover:bg-white/5">
                <X size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Rule Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                  placeholder="e.g. Price inquiry auto-reply"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Rule Type</label>
                <select
                  value={form.rule_type}
                  onChange={(e) => setForm({ ...form, rule_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                >
                  <option value="keyword_match">Keyword Match</option>
                  <option value="ai_reply">AI Reply</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Action</label>
                <select
                  value={form.action}
                  onChange={(e) => setForm({ ...form, action: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                >
                  <option value="reply_dm">Reply via DM</option>
                  <option value="reply_comment">Reply to Comment</option>
                  <option value="moderation">Hide / Moderate</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Priority</label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                />
              </div>
            </div>

            {form.rule_type === "keyword_match" && (
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Trigger Words (comma-separated)</label>
                <input
                  value={form.trigger_words}
                  onChange={(e) => setForm({ ...form, trigger_words: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                  placeholder="price, cost, buy, interested"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">
                {form.action === "moderation" ? "Moderation Template (optional)" : "Reply Template"}
              </label>
              <textarea
                value={form.reply_template}
                onChange={(e) => setForm({ ...form, reply_template: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white resize-none"
                placeholder={form.action === "moderation" ? "Keywords to trigger moderation" : "Thanks for your interest! Check your DMs for details."}
              />
            </div>

            {(form.action === "reply_dm" || form.rule_type === "ai_reply") && (
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">AI Prompt (optional)</label>
                <textarea
                  value={form.ai_prompt}
                  onChange={(e) => setForm({ ...form, ai_prompt: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white resize-none"
                  placeholder="Custom AI instruction for this rule..."
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!form.name || createMutation.isPending || updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-500 text-white text-xs font-semibold hover:bg-pink-600 transition-colors disabled:opacity-50"
              >
                <Check size={14} />
                {editingRule ? "Update Rule" : "Create Rule"}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingRule(null); }}
                className="px-4 py-2 rounded-lg bg-white/5 text-[var(--text-muted)] text-xs font-semibold hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rules List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-[var(--bg-card)] animate-pulse" />
            ))}
          </div>
        ) : rules && rules.length > 0 ? (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-4 rounded-xl border transition-all ${
                  rule.is_active
                    ? "bg-[var(--bg-card)] border-[var(--border-subtle)]"
                    : "bg-[var(--bg-card)] border-[var(--border-subtle)] opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${rule.is_active ? "bg-emerald-400" : "bg-[var(--text-muted)]"}`} />
                    <div>
                      <p className="text-sm font-semibold text-white">{rule.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300">
                          {typeLabels[rule.rule_type] || rule.rule_type}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">
                          {actionLabels[rule.action] || rule.action}
                        </span>
                        {rule.trigger_words.length > 0 && (
                          <span className="text-[10px] text-[var(--text-muted)]">
                            Keywords: {rule.trigger_words.slice(0, 3).join(", ")}{rule.trigger_words.length > 3 ? "..." : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })}
                      className="p-1.5 rounded-lg hover:bg-white/5"
                      title={rule.is_active ? "Deactivate" : "Activate"}
                    >
                      {rule.is_active ? (
                        <Power size={14} className="text-emerald-400" />
                      ) : (
                        <PowerOff size={14} className="text-[var(--text-muted)]" />
                      )}
                    </button>
                    <button
                      onClick={() => startEdit(rule)}
                      className="p-1.5 rounded-lg hover:bg-white/5"
                    >
                      <Edit size={14} className="text-blue-400" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(rule.id)}
                      className="p-1.5 rounded-lg hover:bg-white/5"
                    >
                      <Trash2 size={14} className="text-rose-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-10 text-center">
            <Shield size={40} className="mx-auto text-pink-400 mb-3 opacity-30" />
            <p className="text-sm font-semibold text-white">No Comment Rules</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Create rules to auto-reply or moderate Instagram comments</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
