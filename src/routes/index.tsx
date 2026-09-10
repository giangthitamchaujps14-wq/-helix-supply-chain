import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { TOOLS } from "@/lib/catalog";
import { DEMO_DATASET } from "@/lib/demo";
import { useWorkspace } from "@/lib/store";
import { formatNumber, formatVnd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kpi } from "@/components/kpi";
import { FileUpload } from "@/components/file-upload";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const dataset = useWorkspace((s) => s.dataset);
  const loadDemo = useWorkspace((s) => s.loadDemo);

  const skus = dataset?.skus ?? [];
  const value = skus.reduce((a, s) => a + s.qty * (s.unitCost || 0), 0);
  const live = skus.filter((s) => s.weeklySales > 0).length;
  const dead = skus.filter((s) => s.qty > 0 && s.weeklySales <= 0).length;

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Supply chain intelligence</p>
        <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">Helix</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Nền tảng phân tích chuỗi cung ứng: upload file, hệ thống map cột, cảnh báo thiếu data, chạy
          engine và xuất report. Snapshot ABC-MART đã sẵn sàng để xem demo.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="SKU trong workspace" value={formatNumber(skus.length, 0)} />
        <Kpi label="Giá trị tồn (ước)" value={formatVnd(value)} />
        <Kpi label="SKU có bán" value={formatNumber(live, 0)} tone="ok" />
        <Kpi label="Tồn không bán" value={formatNumber(dead, 0)} tone="warn" />
      </div>

      {dataset?.summary ? (
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Mạng lưới (snapshot gốc)</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {dataset.summary.locations.map((l) => (
              <div key={l.location} className="min-w-0">
                <p className="text-xs text-muted break-words">{l.location}</p>
                <p className="font-mono text-sm tabular-nums">{formatNumber(l.total_qty, 0)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <section>
        <h2 className="text-lg font-medium">Tools</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <Link
              key={t.id}
              to="/tools/$toolId"
              params={{ toolId: t.id }}
              className="group rounded-lg border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong"
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">{t.group}</p>
              <p className="mt-2 text-base font-medium">{t.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs text-accent">
                Mở workspace
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-medium">Data vào workspace</h2>
          <FileUpload />
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-medium">Hợp đồng dữ liệu</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Mỗi tool khai báo slot bắt buộc / tùy chọn. Thiếu file quan trọng sẽ hiện hộp thoại: upload
            thêm, bỏ qua, hoặc hủy. Cột được map tự động (SKU, tồn, bán, giá vốn, forecast).
          </p>
          <Button className="mt-5" variant="outline" onClick={() => loadDemo(DEMO_DATASET)}>
            Nạp lại snapshot ABC-MART
          </Button>
        </div>
      </section>
    </div>
  );
}
