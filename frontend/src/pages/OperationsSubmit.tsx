import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ArrowLeft, Save, Loader2, DollarSign, Users, Package, CreditCard, ShieldCheck } from "lucide-react";

export default function OperationsSubmit() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: stores } = useQuery({ queryKey: ["stores"], queryFn: () => api.get<any[]>("/stores/") });

  const [form, setForm] = useState({
    store_id: "", date: new Date().toISOString().split("T")[0],
    revenue: "", units_sold: "", care_plus_attached: "",
    new_leads: "", active_leads: "", calls_made: "", calls_connected: "",
    walk_ins: "", walk_in_conversions: "", staff_on_duty: "",
    training_done: false, training_topic: "",
    stock_opening: "", stock_received: "", stock_sold: "", stock_closing: "", stock_variance: "",
    cash_opening: "", cash_sales: "", bank_deposit: "", petty_cash_note: "", cash_closing: "",
    installations: "", service_calls: "", complaints_in: "", complaints_resolved: "",
    app_updated: false, notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/submissions", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["submissions"] }); navigate("/operations"); },
  });

  const handleChange = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form, store_id: Number(form.store_id) };
    ["revenue","cash_opening","cash_sales","bank_deposit","cash_closing"].forEach(k => { payload[k] = parseFloat(payload[k]) || 0; });
    ["units_sold","care_plus_attached","new_leads","active_leads","calls_made","calls_connected","walk_ins","walk_in_conversions","staff_on_duty","stock_opening","stock_received","stock_sold","stock_closing","stock_variance","installations","service_calls","complaints_in","complaints_resolved"].forEach(k => { payload[k] = parseInt(payload[k]) || 0; });
    mutation.mutate(payload);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/operations"
          className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">New Daily Operations Submission</h2>
          <p className="text-xs text-[var(--text-muted)]">Record daily sales, stock metrics, walk-ins, and cash reconciliations</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-8 space-y-6 shadow-xl">
        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Select Store *
            </label>
            <select
              value={form.store_id}
              onChange={(e) => handleChange("store_id", e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white focus:outline-none"
            >
              <option value="">Select Retail Store</option>
              {(stores || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Submission Date *
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => handleChange("date", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Revenue & Sales */}
        <fieldset className="border border-[var(--border-subtle)] rounded-xl p-4 sm:p-5 space-y-3 bg-[var(--bg-primary)]/40">
          <legend className="text-xs font-bold uppercase tracking-wider text-[var(--accent-blue)] px-2.5 flex items-center gap-1.5">
            <DollarSign size={14} /> Revenue & Core Sales
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[["revenue","Revenue (\u20b9)"], ["units_sold","Units Sold"], ["care_plus_attached","Care+ Attached"], ["new_leads","New Leads"]].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">{l}</label>
                <input
                  type="number"
                  step={k==="revenue"?"0.01":"1"}
                  value={form[k as keyof typeof form] as string}
                  onChange={(e) => handleChange(k, e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white focus:outline-none"
                />
              </div>
            ))}
          </div>
        </fieldset>

        {/* Calls & Walk-ins */}
        <fieldset className="border border-[var(--border-subtle)] rounded-xl p-4 sm:p-5 space-y-3 bg-[var(--bg-primary)]/40">
          <legend className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-2.5 flex items-center gap-1.5">
            <Users size={14} /> Calls & Walk-in Conversions
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[["calls_made","Calls Made"],["calls_connected","Connected Calls"],["walk_ins","Store Walk-ins"],["walk_in_conversions","Walk-in Conversions"]].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">{l}</label>
                <input
                  type="number"
                  value={form[k as keyof typeof form] as string}
                  onChange={(e) => handleChange(k, e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white focus:outline-none"
                />
              </div>
            ))}
          </div>
        </fieldset>

        {/* Stock */}
        <fieldset className="border border-[var(--border-subtle)] rounded-xl p-4 sm:p-5 space-y-3 bg-[var(--bg-primary)]/40">
          <legend className="text-xs font-bold uppercase tracking-wider text-purple-400 px-2.5 flex items-center gap-1.5">
            <Package size={14} /> Inventory & Stock Levels
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[["stock_opening","Opening"],["stock_received","Received"],["stock_sold","Sold"],["stock_closing","Closing"],["stock_variance","Variance"]].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">{l}</label>
                <input
                  type="number"
                  value={form[k as keyof typeof form] as string}
                  onChange={(e) => handleChange(k, e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white focus:outline-none"
                />
              </div>
            ))}
          </div>
        </fieldset>

        {/* Cash */}
        <fieldset className="border border-[var(--border-subtle)] rounded-xl p-4 sm:p-5 space-y-3 bg-[var(--bg-primary)]/40">
          <legend className="text-xs font-bold uppercase tracking-wider text-amber-400 px-2.5 flex items-center gap-1.5">
            <CreditCard size={14} /> Cash & Bank Deposits
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[["cash_opening","Opening Cash"],["cash_sales","Cash Sales"],["bank_deposit","Bank Deposit"],["cash_closing","Closing Cash"]].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">{l}</label>
                <input
                  type="number"
                  step="0.01"
                  value={form[k as keyof typeof form] as string}
                  onChange={(e) => handleChange(k, e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white focus:outline-none"
                />
              </div>
            ))}
          </div>
        </fieldset>

        {/* Staff & Compliance */}
        <fieldset className="border border-[var(--border-subtle)] rounded-xl p-4 sm:p-5 space-y-3 bg-[var(--bg-primary)]/40">
          <legend className="text-xs font-bold uppercase tracking-wider text-pink-400 px-2.5 flex items-center gap-1.5">
            <ShieldCheck size={14} /> Staffing & Compliance
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[["staff_on_duty","Staff On Duty"],["active_leads","Active Leads"],["installations","Installations"],["complaints_in","Complaints In"]].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">{l}</label>
                <input
                  type="number"
                  value={form[k as keyof typeof form] as string}
                  onChange={(e) => handleChange(k, e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.training_done}
                onChange={(e) => handleChange("training_done", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--accent-blue)] focus:ring-0"
              />
              Staff Training Completed Today
            </label>
            <label className="flex items-center gap-2.5 text-xs font-semibold text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.app_updated}
                onChange={(e) => handleChange("app_updated", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--accent-blue)] focus:ring-0"
              />
              System App Updated
            </label>
          </div>
        </fieldset>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Additional Operational Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            rows={3}
            placeholder="Record any stock variances, customer feedback, or operational issues..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-white focus:outline-none placeholder:text-zinc-600"
          />
        </div>

        {mutation.isError && (
          <p className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
            {(mutation.error as any)?.message || "Submission failed"}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{mutation.isPending ? "Submitting Log..." : "Submit Log"}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/operations")}
            className="px-6 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white text-xs font-medium hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
