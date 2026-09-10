import { useRef, useState } from "react";
import { parseWorkbook } from "@/lib/parse";
import { useWorkspace } from "@/lib/store";
import type { ColumnRole, FileSlot } from "@/lib/types";
import { SLOT_LABEL } from "@/lib/catalog";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<ColumnRole, string> = {
  sku: "SKU / Mã hàng",
  name: "Tên sản phẩm",
  category: "Nhóm / Category",
  location: "Location / Kho",
  qty: "Số lượng tồn",
  salesQty: "Số lượng bán",
  revenue: "Doanh thu",
  unitCost: "Giá vốn",
  unitPrice: "Giá bán",
  forecast: "Forecast",
  actual: "Actual",
  period: "Kỳ / Tuần",
  size: "Size",
  store: "Cửa hàng",
};

const SLOT_REQUIRED: Record<FileSlot, ColumnRole[]> = {
  inventory: ["sku", "qty"],
  sales: ["sku", "salesQty"],
  cost: ["sku", "unitCost"],
  forecast: ["sku", "forecast"],
};

const SLOT_OPTIONAL: Record<FileSlot, ColumnRole[]> = {
  inventory: ["name", "location", "category", "size"],
  sales: ["name", "revenue", "category", "store", "unitPrice"],
  cost: ["name"],
  forecast: ["actual", "period", "name"],
};

export function FileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const addTable = useWorkspace((s) => s.addTable);
  const removeTable = useWorkspace((s) => s.removeTable);
  const tables = useWorkspace((s) => s.tables);
  const setSlot = useWorkspace((s) => s.setSlot);
  const setMapping = useWorkspace((s) => s.setMapping);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of [...files]) {
        const buf = await file.arrayBuffer();
        const table = parseWorkbook(buf, file.name);
        if (!table.rows.length) throw new Error(`${file.name}: không đọc được dòng dữ liệu.`);
        addTable(table);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        className={cn(
          "flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface p-5",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm text-fg">Upload Excel / CSV</p>
        <p className="text-xs leading-relaxed text-muted">
          Hệ thống tự nhận diện cột SKU, tồn, bán, giá vốn. Có thể gắn nhiều file cho từng slot.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Đang đọc…" : "Chọn file"}
        </Button>
        {error ? <p className="text-sm text-bad">{error}</p> : null}
      </div>
      {tables.length ? (
        <ul className="mt-3 space-y-2">
          {tables.map((t) => {
            const mappedKeys = Object.keys(t.table.mapping);
            const required = SLOT_REQUIRED[t.slot] ?? [];
            const missingRequired = required.filter((r) => !t.table.mapping[r]);
            const isEditing = editing === t.table.name;
            return (
              <li
                key={t.table.name}
                className="rounded-md border border-border bg-surface px-3 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{t.table.name}</p>
                    <p className="text-xs text-subtle">
                      {t.table.rows.length} dòng · map{" "}
                      {mappedKeys.length ? mappedKeys.join(", ") : "chưa map"}
                      {missingRequired.length ? (
                        <span className="text-bad"> · thiếu {missingRequired.join(", ")}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-11 rounded-md border border-border bg-bg px-3 text-sm"
                      value={t.slot}
                      onChange={(e) => setSlot(t.table.name, e.target.value as FileSlot)}
                    >
                      {(Object.keys(SLOT_LABEL) as FileSlot[]).map((s) => (
                        <option key={s} value={s}>
                          {SLOT_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 px-3 text-xs"
                      onClick={() => setEditing(isEditing ? null : t.table.name)}
                    >
                      {isEditing ? "Đóng map" : "Map cột"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 px-3 text-xs text-bad"
                      onClick={() => {
                        if (editing === t.table.name) setEditing(null);
                        removeTable(t.table.name);
                      }}
                    >
                      Xóa
                    </Button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-2 rounded-md border border-border bg-bg p-3">
                    <p className="text-xs text-muted">
                      Chọn cột trong file tương ứng với từng trường. Trường bắt buộc đánh dấu *.
                    </p>
                    {[...required, ...(SLOT_OPTIONAL[t.slot] ?? [])].map((role) => (
                      <div
                        key={role}
                        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <label className="text-xs text-fg">
                          {ROLE_LABEL[role]}
                          {required.includes(role) ? " *" : ""}
                        </label>
                        <select
                          className="h-10 w-full rounded-md border border-border bg-surface px-2 text-sm sm:w-56"
                          value={t.table.mapping[role] ?? ""}
                          onChange={(e) => {
                            const next = { ...t.table.mapping };
                            const val = e.target.value;
                            if (!val) delete next[role];
                            else next[role] = val;
                            setMapping(t.table.name, next);
                          }}
                        >
                          <option value="">— không map —</option>
                          {t.table.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
