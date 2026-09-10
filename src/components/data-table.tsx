import { useMemo, useState } from "react";
import { Input } from "./ui/input";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

type BadgeVariant = "ok" | "warn" | "bad" | "default";
type Col = {
  key: string;
  label: string;
  numeric?: boolean;
  format?: "number" | "int" | "pct" | "days" | "raw";
  /** Nếu có, cột sẽ hiển thị dạng badge màu thay vì text thô — giúp quét mắt nhanh trên bảng nhiều dòng */
  badge?: (value: unknown) => BadgeVariant;
};

export function DataTable({
  rows,
  columns,
  searchKeys,
}: {
  rows: Record<string, unknown>[];
  columns: Col[];
  searchKeys?: string[];
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 40;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    const keys = searchKeys ?? columns.map((c) => c.key);
    return rows.filter((r) => keys.some((k) => String(r[k] ?? "").toLowerCase().includes(s)));
  }, [rows, q, columns, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const slice = filtered.slice(page * pageSize, page * pageSize + pageSize);

  function fmt(col: Col, v: unknown) {
    if (v == null || v === "") return "—";
    if (col.format === "pct" && typeof v === "number") return `${(v * 100).toFixed(1)}%`;
    if (col.format === "days" && typeof v === "number") return v >= 900 ? "∞" : formatNumber(v, 1);
    if ((col.numeric || col.format === "number" || col.format === "int") && typeof v === "number") {
      return formatNumber(v, col.format === "int" ? 0 : 1);
    }
    return String(v);
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Lọc SKU, tên, cửa hàng…"
          className="max-w-sm"
        />
        <p className="text-xs text-subtle tabular-nums">
          {filtered.length} dòng · trang {page + 1}/{pages}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-subtle">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cn("px-3 py-2.5 font-medium", c.numeric && "text-right")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr key={i} className="border-t border-border/80 hover:bg-surface-2/60">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-2 text-fg/90",
                      c.numeric && "text-right font-mono tabular-nums text-xs",
                    )}
                  >
                    {c.badge ? (
                      <Badge variant={c.badge(row[c.key])}>{fmt(c, row[c.key])}</Badge>
                    ) : (
                      fmt(c, row[c.key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {slice.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted">
                  Không có dòng phù hợp.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="h-11 rounded-md border border-border px-4 text-sm text-muted disabled:opacity-40"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Trước
        </button>
        <button
          type="button"
          className="h-11 rounded-md border border-border px-4 text-sm text-muted disabled:opacity-40"
          disabled={page >= pages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          Sau
        </button>
      </div>
    </div>
  );
}
