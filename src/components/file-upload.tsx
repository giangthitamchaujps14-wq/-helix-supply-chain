import { useRef, useState } from "react";
import { parseWorkbook } from "@/lib/parse";
import { useWorkspace } from "@/lib/store";
import type { FileSlot } from "@/lib/types";
import { SLOT_LABEL } from "@/lib/catalog";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function FileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const addTable = useWorkspace((s) => s.addTable);
  const tables = useWorkspace((s) => s.tables);
  const setSlot = useWorkspace((s) => s.setSlot);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          {tables.map((t) => (
            <li
              key={t.table.name}
              className="flex flex-col gap-2 rounded-md border border-border bg-surface px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm">{t.table.name}</p>
                <p className="text-xs text-subtle">
                  {t.table.rows.length} dòng · map {Object.keys(t.table.mapping).join(", ") || "chưa map"}
                </p>
              </div>
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
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
