export function CurrencyBadge({ currency = "INR", converted = false }: { currency?: string; converted?: boolean }) {
  if (!converted && currency === "INR") return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded px-2 py-0.5">
      {converted ? `Converted to \u20b9 (INR)` : currency}
    </span>
  );
}
