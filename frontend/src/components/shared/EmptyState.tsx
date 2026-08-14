import { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-14 w-14 rounded-2xl bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] mb-4 shadow-inner">
        <Inbox size={28} />
      </div>
      <h3 className="text-base font-semibold text-white mb-1 tracking-tight">{title}</h3>
      {description && <p className="text-xs text-[var(--text-muted)] max-w-sm mb-5 leading-relaxed">{description}</p>}
      {action}
    </div>
  );
}
