import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useState, useEffect } from "react";
import {
  Bot, Key, Save, AlertCircle, CheckCircle, XCircle, Brain,
} from "lucide-react";
import type { AIProvider } from "../instagram/types";

export default function AIProviders() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<number, string>>({});
  const [showKey, setShowKey] = useState<Record<number, boolean>>({});
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api.get<AIProvider[]>("/instagram/ai-providers"),
  });

  useEffect(() => {
    if (data) setProviders(data);
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: ({ id, api_key, model_name }: { id: number; api_key?: string; model_name?: string }) =>
      api.put(`/instagram/ai-providers/${id}`, { api_key, model_name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.post(`/instagram/ai-providers/${id}/toggle`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
    },
  });

  const handleSaveKey = (id: number) => {
    const key = apiKeys[id];
    if (key) {
      updateMutation.mutate({ id, api_key: key });
      setApiKeys((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const handleToggle = (id: number, currentActive: boolean) => {
    toggleMutation.mutate({ id, is_active: !currentActive });
  };

  const providerInfo: Record<string, { name: string; color: string; icon: string; models: string[] }> = {
    claude: {
      name: "Claude (Anthropic)",
      color: "orange",
      icon: "\u{1F9E0}",
      models: ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5-20251001"],
    },
    openai: {
      name: "ChatGPT (OpenAI)",
      color: "green",
      icon: "\u{1F916}",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    },
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Brain className="text-purple-400" size={22} />
            AI Provider Configuration
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Configure Claude and ChatGPT for the Instagram AI bot. Only one provider can be active at a time.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-[var(--bg-card)] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {providers.map((provider) => {
              const info = providerInfo[provider.provider] || { name: provider.provider, color: "blue", icon: "\u{2699}\u{FE0F}", models: [] };

              return (
                <div
                  key={provider.id}
                  className={`rounded-2xl border p-5 space-y-4 transition-all ${
                    provider.is_active
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                        provider.is_active
                          ? "bg-emerald-500/20 border border-emerald-500/30"
                          : "bg-white/5 border border-[var(--border-subtle)]"
                      }`}>
                        {info.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{info.name}</h3>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {provider.is_active ? "Active" : "Inactive"}
                        </p>
                      </div>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(provider.id, provider.is_active)}
                      disabled={toggleMutation.isPending}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        provider.is_active ? "bg-emerald-500" : "bg-white/10"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          provider.is_active ? "left-[26px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Model Selector */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Model</label>
                    <select
                      value={provider.model_name}
                      onChange={(e) => updateMutation.mutate({ id: provider.id, model_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                    >
                      {info.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type={showKey[provider.id] ? "text" : "password"}
                        value={apiKeys[provider.id] || ""}
                        onChange={(e) => setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white font-mono"
                        placeholder={provider.api_key_encrypted !== "NOT_CONFIGURED" ? "••••••••••••" : "Enter API key..."}
                      />
                      <button
                        onClick={() => setShowKey((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                        className="px-3 py-2 rounded-lg bg-white/5 text-[var(--text-muted)] hover:text-white"
                      >
                        <Key size={14} />
                      </button>
                      {apiKeys[provider.id] && (
                        <button
                          onClick={() => handleSaveKey(provider.id)}
                          disabled={updateMutation.isPending}
                          className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                        >
                          <Save size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  {provider.is_active && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle size={14} className="text-emerald-400" />
                      <span className="text-xs text-emerald-300 font-medium">
                        Active - Instagram bot will use this provider
                      </span>
                    </div>
                  )}

                  {provider.api_key_encrypted === "NOT_CONFIGURED" && !provider.is_active && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertCircle size={14} className="text-amber-400" />
                      <span className="text-xs text-amber-300 font-medium">
                        Not configured - Add an API key to activate
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info Box */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <AlertCircle size={14} className="text-blue-400" />
            How AI Provider Works
          </h3>
          <ul className="text-xs text-[var(--text-muted)] space-y-1.5 ml-5 list-disc">
            <li>Only <strong className="text-white">one provider</strong> can be active at a time</li>
            <li>Activating one will <strong className="text-white">automatically deactivate</strong> the other</li>
            <li>Both can be deactivated (bot will use fallback messages)</li>
            <li>API keys are encrypted at rest in the database</li>
            <li>Credits/tokens are tracked per conversation in the analytics dashboard</li>
          </ul>
        </div>
      </div>
    </ErrorBoundary>
  );
}
