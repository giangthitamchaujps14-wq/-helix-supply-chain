import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ToolResult } from "@/lib/engine";
import { formatNumber, formatPct, formatVnd } from "@/lib/utils";
import { DataTable } from "./data-table";
import { Kpi } from "./kpi";
import { Button } from "./ui/button";
import { exportProfessionalReport } from "@/lib/report-export";
import { useWorkspace } from "@/lib/store";
import { Badge } from "./ui/badge";
import { useState } from "react";

const CHART = ["#c9d0cb", "#7d9a86", "#c4a574", "#c47a6a", "#8a9aa8", "#6d6a64", "#ece8e1", "#3a4048"];

export function ResultsView({ result }: { result: ToolResult }) {
  const dataset = useWorkspace((s) => s.dataset);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportProfessionalReport(result.tool, result, {
        datasetSource: dataset?.source,
        skuCount: dataset?.skus.length,
        files: dataset?.files.map((f) => f.name),
        generatedAt: new Date(),
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Kết quả</h2>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? "Đang tạo báo cáo…" : "Tải báo cáo Excel"}
        </Button>
      </div>
      {result.tool === "inventory" ? <InventoryResult r={result} /> : null}
      {result.tool === "abc-xyz" ? <AbcResult r={result} /> : null}
      {result.tool === "turnover" ? <TurnResult r={result} /> : null}
      {result.tool === "financial" ? <FinResult r={result} /> : null}
      {result.tool === "forecast" ? <FcResult r={result} /> : null}
      {result.tool === "replenishment" ? <RepResult r={result} /> : null}
    </section>
  );
}

function InventoryResult({ r }: { r: Extract<ToolResult, { tool: "inventory" }> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="SKU" value={formatNumber(r.kpis.skus, 0)} />
        <Kpi label="Tồn (đơn vị)" value={formatNumber(r.kpis.qty, 0)} />
        <Kpi label="Hết hàng đang bán" value={formatNumber(r.kpis.zero, 0)} tone="bad" />
        <Kpi label="Cover thấp" value={formatNumber(r.kpis.low, 0)} tone="warn" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Theo trạng thái">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={r.byStatus}>
              <CartesianGrid stroke="#2a2e33" vertical={false} />
              <XAxis dataKey="name" stroke="#6d6a64" fontSize={11} />
              <YAxis stroke="#6d6a64" fontSize={11} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="count" fill="#c9d0cb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Giá trị theo nhóm (top)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={r.byCategory} layout="vertical" margin={{ left: 48 }}>
              <CartesianGrid stroke="#2a2e33" horizontal={false} />
              <XAxis type="number" stroke="#6d6a64" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="#6d6a64" fontSize={10} width={80} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="value" fill="#7d9a86" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <DataTable
        rows={r.rows as unknown as Record<string, unknown>[]}
        searchKeys={["sku", "name", "category", "status"]}
        columns={[
          { key: "sku", label: "SKU" },
          { key: "name", label: "Tên" },
          { key: "category", label: "Nhóm" },
          { key: "qty", label: "Tồn", numeric: true, format: "int" },
          { key: "weeklySales", label: "Bán/tuần", numeric: true, format: "number" },
          { key: "coverDays", label: "Cover", numeric: true, format: "days" },
          {
            key: "status",
            label: "Status",
            badge: (v) =>
              v === "ZERO" ? "bad" : v === "LOW" ? "warn" : v === "DEAD" ? "default" : "ok",
          },
        ]}
      />
    </>
  );
}

function AbcResult({ r }: { r: Extract<ToolResult, { tool: "abc-xyz" }> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Class A" value={formatNumber(r.kpis.a, 0)} hint="~80% doanh thu" />
        <Kpi label="Class B" value={formatNumber(r.kpis.b, 0)} />
        <Kpi label="Class C" value={formatNumber(r.kpis.c, 0)} />
        <Kpi label="Doanh thu" value={formatVnd(r.kpis.revenue)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Ma trận ABC-XYZ">
          <div className="grid grid-cols-3 gap-2">
            {r.matrix.map((c) => (
              <div key={c.key} className="rounded-md border border-border bg-bg p-3">
                <p className="font-mono text-sm">{c.key}</p>
                <p className="mt-1 font-mono text-lg tabular-nums">{c.count}</p>
                <p className="text-[11px] text-subtle">{formatVnd(c.revenue)}</p>
              </div>
            ))}
          </div>
        </ChartCard>
        <ChartCard title="Phân bố doanh thu">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={r.matrix.filter((m) => m.revenue > 0)} dataKey="revenue" nameKey="key" innerRadius={50} outerRadius={80}>
                {r.matrix.map((_, i) => (
                  <Cell key={i} fill={CHART[i % CHART.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tip} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <DataTable
        rows={r.rows as unknown as Record<string, unknown>[]}
        searchKeys={["sku", "name", "abc", "xyz"]}
        columns={[
          { key: "sku", label: "SKU" },
          { key: "name", label: "Tên" },
          { key: "abc", label: "ABC", badge: (v) => (v === "A" ? "ok" : v === "B" ? "warn" : "default") },
          { key: "xyz", label: "XYZ", badge: (v) => (v === "X" ? "ok" : v === "Y" ? "warn" : "bad") },
          { key: "revenue", label: "Doanh thu", numeric: true, format: "int" },
          { key: "cv", label: "CV", numeric: true, format: "number" },
          { key: "coverDays", label: "Cover", numeric: true, format: "days" },
        ]}
      />
    </>
  );
}

function TurnResult({ r }: { r: Extract<ToolResult, { tool: "turnover" }> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Turns TB" value={formatNumber(r.kpis.avgTurns, 1)} />
        <Kpi label="DOS TB" value={`${formatNumber(r.kpis.avgDos, 1)} ngày`} />
        <Kpi label="Cover ngắn" value={formatNumber(r.kpis.short, 0)} tone="warn" />
        <Kpi label="Tồn không bán" value={formatNumber(r.kpis.idle, 0)} tone="bad" />
      </div>
      <DataTable
        rows={r.rows as unknown as Record<string, unknown>[]}
        searchKeys={["sku", "name", "flag"]}
        columns={[
          { key: "sku", label: "SKU" },
          { key: "name", label: "Tên" },
          { key: "qty", label: "Tồn", numeric: true, format: "int" },
          { key: "weeklySales", label: "Bán/tuần", numeric: true },
          { key: "turns", label: "Turns", numeric: true, format: "number" },
          { key: "dos", label: "DOS", numeric: true, format: "days" },
          {
            key: "flag",
            label: "Flag",
            badge: (v) => (v === "SHORT" ? "bad" : v === "IDLE" ? "default" : v === "LONG" ? "warn" : "ok"),
          },
        ]}
      />
    </>
  );
}

function FinResult({ r }: { r: Extract<ToolResult, { tool: "financial" }> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Giá trị tồn" value={formatVnd(r.kpis.value)} />
        <Kpi label="Carrying cost / năm" value={formatVnd(r.kpis.carrying)} hint="25% mặc định" />
        <Kpi label="GMROI" value={formatNumber(r.kpis.gmroi, 2)} />
        <Kpi label="SKU định giá" value={formatNumber(r.kpis.skus, 0)} />
      </div>
      <ChartCard title="Vốn tồn theo nhóm">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={r.byCategory}>
            <CartesianGrid stroke="#2a2e33" vertical={false} />
            <XAxis dataKey="name" stroke="#6d6a64" fontSize={10} interval={0} angle={-20} height={60} />
            <YAxis stroke="#6d6a64" fontSize={11} />
            <Tooltip contentStyle={tip} />
            <Bar dataKey="value" fill="#c9d0cb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <DataTable
        rows={r.rows as unknown as Record<string, unknown>[]}
        searchKeys={["sku", "name"]}
        columns={[
          { key: "sku", label: "SKU" },
          { key: "name", label: "Tên" },
          { key: "qty", label: "Tồn", numeric: true, format: "int" },
          { key: "inventoryValue", label: "Giá trị", numeric: true, format: "int" },
          { key: "carryingCost", label: "Carry", numeric: true, format: "int" },
          { key: "gmroi", label: "GMROI", numeric: true, format: "number" },
        ]}
      />
    </>
  );
}

function FcResult({ r }: { r: Extract<ToolResult, { tool: "forecast" }> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="MAPE TB" value={formatPct(r.kpis.mape)} />
        <Kpi label="Bias dương" value={formatNumber(r.kpis.over, 0)} hint="actual > forecast" />
        <Kpi label="Bias âm" value={formatNumber(r.kpis.under, 0)} />
        <Kpi label="Baseline MA3" value={formatNumber(r.kpis.baseline, 0)} />
      </div>
      <DataTable
        rows={r.rows as unknown as Record<string, unknown>[]}
        searchKeys={["sku", "name", "method"]}
        columns={[
          { key: "sku", label: "SKU" },
          { key: "name", label: "Tên" },
          { key: "mape", label: "MAPE", numeric: true, format: "pct" },
          { key: "bias", label: "Bias", numeric: true, format: "number" },
          { key: "trackingSignal", label: "TS", numeric: true, format: "number" },
          { key: "method", label: "Method" },
        ]}
      />
    </>
  );
}

function RepResult({ r }: { r: Extract<ToolResult, { tool: "replenishment" }> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Dòng cần xử lý" value={formatNumber(r.kpis.need, 0)} tone="warn" />
        <Kpi label="Gợi ý chuyển (SL)" value={formatNumber(r.kpis.suggestQty, 0)} />
        <Kpi label="Thiếu / hết" value={formatNumber(r.kpis.stockout, 0)} tone="bad" />
        <Kpi label="Tổng dòng" value={formatNumber(r.kpis.lines, 0)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="bad">THIẾU HÀNG</Badge>
        <Badge variant="warn">CẦN BỔ SUNG</Badge>
        <Badge>Các dòng OK được ẩn khi tính mới</Badge>
      </div>
      <DataTable
        rows={r.rows as unknown as Record<string, unknown>[]}
        searchKeys={["sku", "name", "store", "status"]}
        columns={[
          { key: "sku", label: "SKU" },
          { key: "name", label: "Tên" },
          { key: "store", label: "Store" },
          { key: "stock", label: "Tồn CH", numeric: true, format: "int" },
          { key: "weeklySales", label: "Bán tuần", numeric: true, format: "int" },
          { key: "coverDays", label: "Cover", numeric: true, format: "days" },
          { key: "suggest", label: "Gợi ý", numeric: true, format: "int" },
          { key: "whAvailable", label: "WH", numeric: true, format: "int" },
          {
            key: "status",
            label: "Trạng thái",
            badge: (v) =>
              String(v).includes("THIẾU") || String(v).includes("HẾT")
                ? "bad"
                : String(v).includes("CẦN") || String(v).includes("NÊN")
                  ? "warn"
                  : "ok",
          },
        ]}
      />
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-subtle">{title}</p>
      {children}
    </div>
  );
}

const tip = {
  background: "#14171a",
  border: "1px solid #2a2e33",
  borderRadius: 8,
  color: "#ece8e1",
  fontSize: 12,
};
