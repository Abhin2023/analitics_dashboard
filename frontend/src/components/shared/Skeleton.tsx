import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--border-subtle)]",
        className
      )}
    />
  );
}

export function StatCardSkeleton() {
  const heights = [45, 62, 38, 71, 55, 40, 68];
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-32" />
      <div className="mt-3 h-8 flex items-end gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 rounded-sm bg-[var(--border-subtle)] animate-pulse" style={{ height: `${heights[i]}%` }} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
