import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-xl sm:text-2xl tabular-nums tracking-tight break-all",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "bad" && "text-bad",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
