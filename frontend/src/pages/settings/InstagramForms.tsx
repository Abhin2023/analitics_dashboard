import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useState } from "react";
import {
  FileText, Plus, Trash2, Power, PowerOff, X, Check, GripVertical, ChevronDown, ChevronUp,
} from "lucide-react";

interface FormField {
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  options: { value: string; label: string }[];
  placeholder: string;
  phase: number;
  sort_order: number;
  ai_extract_hint: string;
}

interface Form {
  id: number;
  name: string;
  display_name: string;
  description: string;
  form_type: string;
  ai_prompt_hint: string;
  success_message: string;
  is_active: boolean;
  fields: FormField[];
  submission_count: number;
  created_at: string | null;
}

const emptyField = (): FormField => ({
  field_key: "",
  label: "",
  field_type: "text",
  required: true,
  options: [],
  placeholder: "",
  phase: 1,
  sort_order: 0,
  ai_extract_hint: "",
});

const fieldTypeOptions = [
  { value: "text", label: "Text" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
];

export default function InstagramForms() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [expandedForm, setExpandedForm] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    display_name: "",
    description: "",
    form_type: "simple",
    ai_prompt_hint: "",
    success_message: "Thank you! Your submission has been received.",
  });
  const [fields, setFields] = useState<FormField[]>([emptyField()]);

  const { data: forms, isLoading } = useQuery({
    queryKey: ["ig-forms"],
    queryFn: () => api.get<Form[]>("/instagram/forms"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/instagram/forms", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ig-forms"] });
      setShowForm(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/instagram/forms/${editingForm?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ig-forms"] });
      setEditingForm(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/instagram/forms/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ig-forms"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.put(`/instagram/forms/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ig-forms"] }),
  });

  const resetForm = () => {
    setForm({
      name: "", display_name: "", description: "", form_type: "simple",
      ai_prompt_hint: "", success_message: "Thank you! Your submission has been received.",
    });
    setFields([emptyField()]);
  };

  const startEdit = (f: Form) => {
    setEditingForm(f);
    setForm({
      name: f.name,
      display_name: f.display_name,
      description: f.description,
      form_type: f.form_type,
      ai_prompt_hint: f.ai_prompt_hint,
      success_message: f.success_message,
    });
    setFields(f.fields.length > 0 ? [...f.fields] : [emptyField()]);
    setShowForm(true);
  };

  const addField = () => {
    setFields([...fields, { ...emptyField(), sort_order: fields.length }]);
  };

  const removeField = (index: number) => {
    if (fields.length === 1) return;
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: keyof FormField, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    if (key === "label" && !updated[index].field_key) {
      updated[index].field_key = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    }
    setFields(updated);
  };

  const handleSubmit = () => {
    const data = { ...form, fields: fields.filter((f) => f.field_key && f.label) };
    if (editingForm) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileText className="text-purple-400" size={22} />
              Instagram Forms
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Create and manage forms for lead capture via Instagram DMs
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setEditingForm(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-semibold hover:bg-purple-500/30 transition-colors"
          >
            <Plus size={14} />
            Add Form
          </button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-purple-500/30 bg-[var(--bg-card)] p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{editingForm ? "Edit Form" : "New Form"}</h3>
              <button onClick={() => { setShowForm(false); setEditingForm(null); }} className="p-1 rounded hover:bg-white/5">
                <X size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Internal Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                  placeholder="e.g. complaint"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Display Name</label>
                <input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                  placeholder="e.g. Complaint Form"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Form Type</label>
                <select
                  value={form.form_type}
                  onChange={(e) => setForm({ ...form, form_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                >
                  <option value="simple">Simple (Phase 1 only)</option>
                  <option value="two_phase">Two-Phase (DM + Web)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">AI Prompt Hint</label>
                <input
                  value={form.ai_prompt_hint}
                  onChange={(e) => setForm({ ...form, ai_prompt_hint: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                  placeholder="When should AI trigger this form?"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
                placeholder="Brief description of what this form is for"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Success Message</label>
              <input
                value={form.success_message}
                onChange={(e) => setForm({ ...form, success_message: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Form Fields</label>
                <button
                  onClick={addField}
                  className="text-[10px] font-semibold text-purple-400 hover:text-purple-300"
                >
                  + Add Field
                </button>
              </div>
              {fields.map((field, i) => (
                <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <GripVertical size={14} className="text-[var(--text-muted)] cursor-grab" />
                    <input
                      value={field.label}
                      onChange={(e) => updateField(i, "label", e.target.value)}
                      className="flex-1 px-2 py-1 rounded bg-transparent border-b border-[var(--border-subtle)] text-sm text-white focus:outline-none focus:border-purple-500"
                      placeholder="Field label"
                    />
                    <select
                      value={field.field_type}
                      onChange={(e) => updateField(i, "field_type", e.target.value)}
                      className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-white"
                    >
                      {fieldTypeOptions.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <select
                      value={field.phase}
                      onChange={(e) => updateField(i, "phase", parseInt(e.target.value))}
                      className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-white"
                    >
                      <option value={1}>Phase 1 (DM)</option>
                      <option value={2}>Phase 2 (Web)</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(i, "required", e.target.checked)}
                        className="accent-purple-500"
                      />
                      Req
                    </label>
                    <button onClick={() => removeField(i)} className="p-1 rounded hover:bg-white/5">
                      <Trash2 size={12} className="text-rose-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={field.placeholder}
                      onChange={(e) => updateField(i, "placeholder", e.target.value)}
                      className="px-2 py-1 rounded bg-transparent border border-[var(--border-subtle)] text-xs text-white"
                      placeholder="Placeholder"
                    />
                    <input
                      value={field.ai_extract_hint}
                      onChange={(e) => updateField(i, "ai_extract_hint", e.target.value)}
                      className="px-2 py-1 rounded bg-transparent border border-[var(--border-subtle)] text-xs text-white"
                      placeholder="AI extract hint"
                    />
                  </div>
                  {field.field_type === "select" && (
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Options (one per line: value|label)</label>
                      <textarea
                        rows={2}
                        value={field.options.map((o) => `${o.value}|${o.label}`).join("\n")}
                        onChange={(e) => {
                          const options = e.target.value.split("\n").filter(Boolean).map((line) => {
                            const [value, label] = line.split("|");
                            return { value: value?.trim() || "", label: label?.trim() || value?.trim() || "" };
                          });
                          updateField(i, "options", options);
                        }}
                        className="w-full px-2 py-1 rounded bg-transparent border border-[var(--border-subtle)] text-xs text-white resize-none font-mono"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!form.name || !form.display_name || createMutation.isPending || updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                <Check size={14} />
                {editingForm ? "Update Form" : "Create Form"}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingForm(null); }}
                className="px-4 py-2 rounded-lg bg-white/5 text-[var(--text-muted)] text-xs font-semibold hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-[var(--bg-card)] animate-pulse" />)}
          </div>
        ) : forms && forms.length > 0 ? (
          <div className="space-y-3">
            {forms.map((f) => (
              <div
                key={f.id}
                className={`rounded-xl border transition-all ${
                  f.is_active ? "bg-[var(--bg-card)] border-[var(--border-subtle)]" : "bg-[var(--bg-card)] border-[var(--border-subtle)] opacity-60"
                }`}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${f.is_active ? "bg-emerald-400" : "bg-[var(--text-muted)]"}`} />
                    <div>
                      <p className="text-sm font-semibold text-white">{f.display_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300">
                          {f.form_type === "two_phase" ? "Two-Phase" : "Simple"}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">
                          {f.fields.length} fields
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {f.submission_count} submissions
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedForm(expandedForm === f.id ? null : f.id)}
                      className="p-1.5 rounded-lg hover:bg-white/5"
                    >
                      {expandedForm === f.id ? (
                        <ChevronUp size={14} className="text-[var(--text-muted)]" />
                      ) : (
                        <ChevronDown size={14} className="text-[var(--text-muted)]" />
                      )}
                    </button>
                    <button
                      onClick={() => toggleMutation.mutate({ id: f.id, is_active: !f.is_active })}
                      className="p-1.5 rounded-lg hover:bg-white/5"
                    >
                      {f.is_active ? <Power size={14} className="text-emerald-400" /> : <PowerOff size={14} className="text-[var(--text-muted)]" />}
                    </button>
                    <button onClick={() => startEdit(f)} className="p-1.5 rounded-lg hover:bg-white/5">
                      <FileText size={14} className="text-blue-400" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(f.id)} className="p-1.5 rounded-lg hover:bg-white/5">
                      <Trash2 size={14} className="text-rose-400" />
                    </button>
                  </div>
                </div>
                {expandedForm === f.id && f.fields.length > 0 && (
                  <div className="px-4 pb-4 border-t border-[var(--border-subtle)] pt-3">
                    <div className="space-y-1.5">
                      {f.fields.map((field) => (
                        <div key={field.field_key} className="flex items-center gap-3 text-xs">
                          <span className="text-white font-medium w-32 truncate">{field.label}</span>
                          <span className="text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-white/5">{field.field_type}</span>
                          <span className={`px-1.5 py-0.5 rounded ${field.phase === 1 ? "bg-blue-500/10 text-blue-300" : "bg-amber-500/10 text-amber-300"}`}>
                            Phase {field.phase}
                          </span>
                          {field.required && <span className="text-red-400 text-[10px]">Required</span>}
                          {field.ai_extract_hint && (
                            <span className="text-[var(--text-muted)] italic truncate max-w-xs">Hint: {field.ai_extract_hint}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-2 italic">{f.ai_prompt_hint}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-10 text-center">
            <FileText size={40} className="mx-auto text-purple-400 mb-3 opacity-30" />
            <p className="text-sm font-semibold text-white">No Forms</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Create forms to capture leads via Instagram DMs</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
