import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { MissingModal } from "@/components/missing-modal";
import { ResultsView } from "@/components/results-view";
import { Button } from "@/components/ui/button";
import { SLOT_HINT, SLOT_LABEL, TOOL_BY_ID, isToolId } from "@/lib/catalog";
import { detectGaps } from "@/lib/engine";
import { downloadCsvTemplate } from "@/lib/export";
import { useWorkspace } from "@/lib/store";
import type { ToolId } from "@/lib/types";

export const Route = createFileRoute("/tools/$toolId")({ component: ToolPage });

function ToolPage() {
  const { toolId } = Route.useParams();
  const valid = isToolId(toolId);
  const id: ToolId = valid ? toolId : "inventory";
  const tool = TOOL_BY_ID[id];
  const dataset = useWorkspace((s) => s.dataset);
  const run = useWorkspace((s) => s.run);
  const lastResult = useWorkspace((s) => s.lastResult);
  const lastTool = useWorkspace((s) => s.lastTool);
  const [modal, setModal] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!valid || !dataset) return;
    const g = detectGaps(id, dataset);
    if (g.some((x) => x.severity === "required")) return;
    run(id, true);
  }, [id, dataset, valid, run]);

  const gaps = useMemo(() => detectGaps(id, dataset), [id, dataset]);
  const result = lastTool === id ? lastResult : null;

  function attempt(ignoreOptional = false) {
    const g = detectGaps(id, dataset);
    const hard = g.filter((x) => x.severity === "required");
    const soft = g.filter((x) => x.severity === "optional");
    if (hard.length || (soft.length && !ignoreOptional)) {
      setModal(true);
      return;
    }
    run(id, true);
  }

  if (!valid) {
    return (
      <div>
        <p className="text-muted">Tool không tồn tại.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-accent">
          Về command center
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{tool.group}</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">{tool.name}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{tool.detail}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Bắt buộc</p>
          <ul className="mt-2 space-y-2 text-sm">
            {tool.requiredSlots.map((s) => (
              <li key={s}>
                <span className="text-fg">{SLOT_LABEL[s]}</span>
                <span className="mt-0.5 block text-xs text-subtle">{SLOT_HINT[s]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Tùy chọn</p>
          {tool.optionalSlots.length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {tool.optionalSlots.map((s) => (
                <li key={s}>
                  <span className="text-fg">{SLOT_LABEL[s]}</span>
                  <span className="mt-0.5 block text-xs text-subtle">{SLOT_HINT[s]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Không bắt buộc file phụ.</p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Report template</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {tool.reports.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-bg p-3">
              <p className="text-sm">{r.name}</p>
              <p className="text-xs text-muted">{r.description}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => attempt(false)}>Chạy phân tích</Button>
        <Button variant="outline" onClick={() => setShowUpload((v) => !v)}>
          Upload file
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            downloadCsvTemplate(`helix-${tool.id}-template.csv`, [
              "sku",
              "name",
              "category",
              "location",
              "qty",
              "salesQty",
              "revenue",
              "unitCost",
            ])
          }
        >
          Tải CSV mẫu
        </Button>
      </div>

      {dataset ? (
        <p className="mt-3 text-xs text-subtle">
          Workspace: {dataset.source} · {dataset.skus.length} SKU · {dataset.files.map((f) => f.name).join(", ")}
        </p>
      ) : (
        <p className="mt-3 text-xs text-subtle">Chưa có data — đang nạp demo hoặc hãy upload.</p>
      )}

      {showUpload ? (
        <div className="mt-4">
          <FileUpload />
        </div>
      ) : null}

      {result ? <ResultsView result={result} /> : null}

      <MissingModal
        open={modal}
        message={tool.missingMessage}
        gaps={gaps}
        onCancel={() => setModal(false)}
        onUpload={() => {
          setModal(false);
          setShowUpload(true);
        }}
        onSkip={() => {
          setModal(false);
          run(id, true);
        }}
      />
    </div>
  );
}
