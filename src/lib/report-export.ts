import type ExcelJS from "exceljs";
import type { ToolId } from "./types";
import type { ToolResult } from "./engine";
import { schemaFor, STATUS_COLOR_TEXT, type CellFormat } from "./report-schema";

const BRAND = "FF1F2A24";
const BRAND_TEXT = "FFEFEBE3";
const SUBTLE = "FF6D6A64";
const GREEN = "FF2E6B3A";
const GREEN_BG = "FFDCEBD9";
const ORANGE_BG = "FFFCE7C2";
const RED_BG = "FFF4C7C3";
const CARD_BG = "FFF7F5F0";
const BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFDDD8CE" } };
const THICK: Partial<ExcelJS.Borders> = {
  top: { style: "medium", color: { argb: BRAND } },
  left: { style: "medium", color: { argb: BRAND } },
  bottom: { style: "medium", color: { argb: BRAND } },
  right: { style: "medium", color: { argb: BRAND } },
};

function numFmt(format: CellFormat): string | undefined {
  switch (format) {
    case "int":
      return "#,##0";
    case "number":
      return "#,##0.00";
    case "pct":
      return "0.0%";
    case "days":
      return '#,##0" ngày"';
    case "vnd":
      return '#,##0" ₫"';
    default:
      return undefined;
  }
}

function cellValue(format: CellFormat, raw: unknown) {
  if (raw == null) return null;
  if (format === "pct" && typeof raw === "number") return raw;
  return raw as string | number;
}

function paintHeader(row: ExcelJS.Row, cols: number) {
  for (let i = 1; i <= cols; i++) {
    const c = row.getCell(i);
    c.font = { bold: true, color: { argb: BRAND_TEXT }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.border = { bottom: BORDER };
  }
}

function kpiCard(
  ws: ExcelJS.Worksheet,
  startCol: number,
  row: number,
  label: string,
  value: string | number,
  numFmtStr?: string,
) {
  const labelCell = ws.getCell(row, startCol);
  const valueCell = ws.getCell(row + 1, startCol);
  labelCell.value = label;
  labelCell.font = { size: 9, color: { argb: SUBTLE }, bold: true };
  labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
  labelCell.alignment = { horizontal: "center", vertical: "middle" };
  labelCell.border = THICK as ExcelJS.Borders;

  valueCell.value = value;
  valueCell.font = { size: 14, bold: true, color: { argb: BRAND } };
  valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
  valueCell.alignment = { horizontal: "center", vertical: "middle" };
  valueCell.border = THICK as ExcelJS.Borders;
  if (numFmtStr) valueCell.numFmt = numFmtStr;

  ws.getRow(row).height = 18;
  ws.getRow(row + 1).height = 28;
}

export interface ReportMeta {
  datasetSource?: string;
  skuCount?: number;
  files?: string[];
  generatedAt?: Date;
}

export async function exportProfessionalReport(
  tool: ToolId,
  result: ToolResult,
  meta: ReportMeta = {},
) {
  const schema = schemaFor(tool);
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Helix Supply Chain Analytics";
  wb.created = meta.generatedAt ?? new Date();

  if (tool === "abc-xyz" && result.tool === "abc-xyz") {
    await buildAbcPoster(wb, result, schema, meta, ExcelJS);
  } else {
    await buildGeneric(wb, tool, result, schema, meta);
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `helix-${tool}-report-${stamp}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** ========== ABC-XYZ poster-style workbook ========== */
async function buildAbcPoster(
  wb: ExcelJS.Workbook,
  result: Extract<ToolResult, { tool: "abc-xyz" }>,
  schema: ReturnType<typeof schemaFor>,
  meta: ReportMeta,
  _ExcelJS: typeof import("exceljs"),
) {
  const rows = result.rows;
  const k = result.kpis;
  const stamp = (meta.generatedAt ?? new Date()).toLocaleString("vi-VN");

  // ----- 00 Dashboard -----
  const dash = wb.addWorksheet("Dashboard", { properties: { tabColor: { argb: GREEN } } });
  dash.columns = [
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
  ];

  // Title banner
  dash.mergeCells("A1:L1");
  dash.getCell("A1").value = "SUPPLY CHAIN · ABC-XYZ EXECUTIVE DASHBOARD";
  dash.getCell("A1").font = { bold: true, size: 18, color: { argb: BRAND_TEXT } };
  dash.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  dash.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  dash.getRow(1).height = 32;

  dash.mergeCells("A2:L2");
  dash.getCell("A2").value =
    schema.subtitle +
    `  ·  Tạo: ${stamp}` +
    (meta.datasetSource ? `  ·  Nguồn: ${meta.datasetSource}` : "") +
    (meta.skuCount ? `  ·  ${meta.skuCount} SKU workspace` : "");
  dash.getCell("A2").font = { size: 9, color: { argb: SUBTLE }, italic: true };
  dash.getRow(2).height = 20;

  // KPI cards row (poster style)
  dash.getCell("A4").value = "CHỈ SỐ CHÍNH";
  dash.getCell("A4").font = { bold: true, size: 11, color: { argb: BRAND } };

  kpiCard(dash, 1, 5, "DOANH THU", k.revenue ?? 0, '#,##0" ₫"');
  kpiCard(dash, 3, 5, "PROFIT (ước)", k.profit ?? 0, '#,##0" ₫"');
  kpiCard(dash, 5, 5, "SKU AAA", k.aaa ?? 0, "#,##0");
  kpiCard(dash, 7, 5, "CLASS A (DT)", k.a ?? 0, "#,##0");
  kpiCard(dash, 9, 5, "CLASS B (DT)", k.b ?? 0, "#,##0");
  kpiCard(dash, 11, 5, "CLASS C (DT)", k.c ?? 0, "#,##0");

  // merge visual width for cards (label+value occupy 2 cols each already via spacing)
  for (const col of [1, 3, 5, 7, 9, 11]) {
    dash.mergeCells(5, col, 5, col + 1);
    dash.mergeCells(6, col, 6, col + 1);
  }

  // Matrix 3x3
  dash.getCell("A8").value = "MA TRẬN ABC × XYZ";
  dash.getCell("A8").font = { bold: true, size: 11, color: { argb: BRAND } };

  const matrixKeys = ["AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ"];
  const matrixMap = new Map(result.matrix.map((m) => [m.key, m]));
  const xyzH = ["", "X", "Y", "Z"];
  xyzH.forEach((h, i) => {
    const c = dash.getCell(9, i + 1);
    c.value = h || "ABC\\XYZ";
    c.font = { bold: true, color: { argb: BRAND_TEXT }, size: 9 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.alignment = { horizontal: "center" };
  });
  ["A", "B", "C"].forEach((abc, ri) => {
    const label = dash.getCell(10 + ri, 1);
    label.value = abc;
    label.font = { bold: true, color: { argb: BRAND_TEXT } };
    label.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    label.alignment = { horizontal: "center" };
    ["X", "Y", "Z"].forEach((xyz, ci) => {
      const key = `${abc}${xyz}`;
      const cell = dash.getCell(10 + ri, ci + 2);
      const m = matrixMap.get(key);
      const count = m?.count ?? 0;
      const rev = m?.revenue ?? 0;
      cell.value = count === 0 ? "—" : `${count}\n${Math.round(rev).toLocaleString("vi-VN")} ₫`;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: BORDER,
        left: BORDER,
        bottom: BORDER,
        right: BORDER,
      };
      if (abc === "A" && xyz === "X") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
      } else if (xyz === "Z") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } };
      } else if (count > 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
      }
    });
    dash.getRow(10 + ri).height = 36;
  });

  // Rank 3D distribution (top triples)
  dash.getCell("F8").value = "PHÂN BỐ RANK 3D (top)";
  dash.getCell("F8").font = { bold: true, size: 11, color: { argb: BRAND } };
  const tripleCount = new Map<string, number>();
  for (const r of rows) {
    const t = String((r as { triple?: string }).triple ?? "");
    if (!t) continue;
    tripleCount.set(t, (tripleCount.get(t) ?? 0) + 1);
  }
  const topTriples = [...tripleCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  dash.getCell("F9").value = "Rank";
  dash.getCell("G9").value = "Số SKU";
  paintHeader(dash.getRow(9), 2);
  // only F-G
  dash.getCell("F9").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  dash.getCell("G9").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  dash.getCell("F9").font = { bold: true, color: { argb: BRAND_TEXT } };
  dash.getCell("G9").font = { bold: true, color: { argb: BRAND_TEXT } };
  topTriples.forEach(([t, c], i) => {
    dash.getCell(10 + i, 6).value = t;
    dash.getCell(10 + i, 7).value = c;
    if (t === "AAA") {
      dash.getCell(10 + i, 6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
      dash.getCell(10 + i, 7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
    }
  });

  // Pareto data (top 15 by revenue) — for chart / reading
  dash.getCell("A14").value = "TOP 15 SKU THEO DOANH THU (Pareto data)";
  dash.getCell("A14").font = { bold: true, size: 11, color: { argb: BRAND } };
  const headers = ["#", "SKU", "Tên", "Rank 3D", "SL bán", "Doanh thu", "Profit", "% DT", "% Lũy kế"];
  headers.forEach((h, i) => {
    const c = dash.getCell(15, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: BRAND_TEXT }, size: 9 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  const totalRev = sorted.reduce((s, r) => s + r.revenue, 0) || 1;
  let cum = 0;
  sorted.slice(0, 15).forEach((r, i) => {
    cum += r.revenue;
    const line = dash.getRow(16 + i);
    line.getCell(1).value = i + 1;
    line.getCell(2).value = r.sku;
    line.getCell(3).value = r.name;
    line.getCell(4).value = r.triple;
    line.getCell(5).value = r.weeklySales;
    line.getCell(6).value = r.revenue;
    line.getCell(6).numFmt = '#,##0" ₫"';
    line.getCell(7).value = r.profit;
    line.getCell(7).numFmt = '#,##0" ₫"';
    line.getCell(8).value = r.revenue / totalRev;
    line.getCell(8).numFmt = "0.0%";
    line.getCell(9).value = cum / totalRev;
    line.getCell(9).numFmt = "0.0%";
    if (r.triple === "AAA") {
      for (let c = 1; c <= 9; c++) {
        line.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
      }
    }
  });

  // Insights
  let insightRow = 33;
  dash.getCell(`A${insightRow}`).value = "NHẬN ĐỊNH & KHUYẾN NGHỊ";
  dash.getCell(`A${insightRow}`).font = { bold: true, size: 11, color: { argb: BRAND } };
  insightRow += 1;
  for (const line of schema.insights(k)) {
    dash.mergeCells(`A${insightRow}:L${insightRow}`);
    dash.getCell(`A${insightRow}`).value = `•  ${line}`;
    dash.getCell(`A${insightRow}`).alignment = { wrapText: true, vertical: "top" };
    dash.getRow(insightRow).height = 28;
    insightRow += 1;
  }

  dash.getCell(`A${insightRow + 1}`).value =
    "Ghi chú: Rank 3D = ABC(SL) + ABC(DT) + ABC(LN). Profit có thể ước nếu thiếu giá vốn. XYZ cần ≥2 kỳ để tin cậy.";
  dash.getCell(`A${insightRow + 1}`).font = { size: 8, italic: true, color: { argb: SUBTLE } };

  // ----- 01 Action -----
  const act = wb.addWorksheet("Action", { properties: { tabColor: { argb: "FFC47A6A" } } });
  act.columns = [
    { width: 12 },
    { width: 18 },
    { width: 28 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 8 },
    { width: 10 },
    { width: 10 },
    { width: 36 },
  ];
  act.getCell("A1").value = "ACTION LIST — Ưu tiên xử lý";
  act.getCell("A1").font = { bold: true, size: 14, color: { argb: BRAND } };
  act.mergeCells("A1:L1");

  const actHeaders = [
    "Ưu tiên",
    "SKU",
    "Tên",
    "Rank 3D",
    "ABC SL",
    "ABC DT",
    "ABC LN",
    "XYZ",
    "SL bán",
    "Doanh thu",
    "Cover",
    "Gợi ý",
  ];
  actHeaders.forEach((h, i) => {
    const c = act.getCell(3, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: BRAND_TEXT }, size: 9 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });

  const actionRows = [...rows]
    .map((r) => {
      let priority = 3;
      let tip = "Theo dõi định kỳ";
      if (r.triple === "AAA") {
        priority = 1;
        tip = "AAA: đảm bảo fill rate, forecast sát, review tồn hàng ngày";
      } else if (String(r.triple).startsWith("A")) {
        priority = 2;
        tip = "Nhóm A: ưu tiên độ chính xác tồn & dịch vụ";
      }
      if (r.coverDays != null && r.coverDays < 7 && r.weeklySales > 0) {
        priority = Math.min(priority, 1);
        tip = "Cover < 7 ngày — nguy cơ đứt hàng, cần bổ sung";
      }
      if (r.xyz === "Z" && String(r.triple).startsWith("A")) {
        tip += " · Nhu cầu biến động cao (Z) — cân safety stock";
      }
      return { r, priority, tip };
    })
    .sort((a, b) => a.priority - b.priority || b.r.revenue - a.r.revenue)
    .slice(0, 50);

  actionRows.forEach((item, i) => {
    const r = item.r;
    const line = act.getRow(4 + i);
    line.getCell(1).value = item.priority;
    line.getCell(2).value = r.sku;
    line.getCell(3).value = r.name;
    line.getCell(4).value = r.triple;
    line.getCell(5).value = r.abcQty;
    line.getCell(6).value = r.abcRev;
    line.getCell(7).value = r.abcProfit;
    line.getCell(8).value = r.xyz;
    line.getCell(9).value = r.weeklySales;
    line.getCell(10).value = r.revenue;
    line.getCell(10).numFmt = '#,##0';
    line.getCell(11).value = r.coverDays;
    line.getCell(12).value = item.tip;
    if (item.priority === 1) {
      line.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } };
    } else if (item.priority === 2) {
      line.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_BG } };
    }
  });
  act.views = [{ state: "frozen", ySplit: 3 }];
  act.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 12 } };

  // ----- 02 Data Quality -----
  const dq = wb.addWorksheet("Data Quality", { properties: { tabColor: { argb: "FF8A9AA8" } } });
  dq.columns = [{ width: 48 }, { width: 24 }, { width: 56 }];
  dq.getCell("A1").value = "DATA QUALITY — ABC-XYZ";
  dq.getCell("A1").font = { bold: true, size: 14, color: { argb: BRAND } };

  const withSale = rows.length;
  const aaa = rows.filter((r) => r.triple === "AAA").length;
  const estimatedProfit = rows.filter((r) => r.profit > 0).length;
  const onePeriod = rows.every((r) => r.cv === 0 || r.cv < 0.01);
  const zeroCover = rows.filter((r) => r.coverDays === 0 || r.coverDays == null).length;

  const dqLines: [string, string, string][] = [
    ["Số SKU trong rank (có phát sinh kỳ)", String(withSale), "Universe rank = master ∩ có sale kỳ"],
    ["SKU AAA", String(aaa), "Top cả 3 chiều SL + DT + LN"],
    [
      "XYZ / số kỳ",
      onePeriod ? "WARN — có vẻ 1 kỳ (CV~0)" : "OK — có biến động giữa kỳ",
      "Cần ≥2 kỳ sale để XYZ tin cậy",
    ],
    [
      "Cover / tồn join",
      zeroCover > withSale * 0.5 ? "WARN — nhiều dòng cover 0/trống" : "OK",
      "Cover trống nếu sale–tồn chưa join SKU",
    ],
    [
      "Profit",
      "WARN nếu thiếu giá vốn master",
      "Không cost → profit ước margin (xem engine)",
    ],
    [
      "Orphan sale / no-sale 90d",
      "Đánh giá khi có MASTER tách + span ≥90 ngày",
      "Theo spec chốt: neo MASTER, không phạt coverage kỳ ngắn",
    ],
  ];

  dq.getCell("A3").value = "Chỉ số";
  dq.getCell("B3").value = "Kết quả";
  dq.getCell("C3").value = "Giải thích";
  paintHeader(dq.getRow(3), 3);
  dqLines.forEach((line, i) => {
    dq.getCell(4 + i, 1).value = line[0];
    dq.getCell(4 + i, 2).value = line[1];
    dq.getCell(4 + i, 3).value = line[2];
    if (String(line[1]).startsWith("WARN")) {
      dq.getCell(4 + i, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_BG } };
    }
  });

  dq.getCell("A12").value =
    "Kỳ sale 1–2 ngày: coverage % master có bán thấp là bình thường (INFO), không BLOCK.";
  dq.getCell("A12").font = { italic: true, size: 9, color: { argb: SUBTLE } };
  void estimatedProfit;

  // ----- 03 Chi tiết SKU (full) -----
  addDetailSheet(wb, schema, rows as unknown as Record<string, unknown>[]);

  // ----- 04 Matrix raw -----
  const mx = wb.addWorksheet("Matrix", { properties: { tabColor: { argb: BRAND } } });
  mx.addRow(["key", "count", "revenue"]);
  paintHeader(mx.getRow(1), 3);
  result.matrix.forEach((m) => {
    const r = mx.addRow([m.key, m.count, m.revenue]);
    r.getCell(3).numFmt = '#,##0';
  });
}

function addDetailSheet(
  wb: ExcelJS.Workbook,
  schema: ReturnType<typeof schemaFor>,
  rows: Record<string, unknown>[],
) {
  const det = wb.addWorksheet("Chi tiết SKU", { properties: { tabColor: { argb: BRAND } } });
  det.columns = schema.columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.max(12, c.label.length + 4),
  }));
  const headerRow = det.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: BRAND_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.border = { bottom: BORDER };
  });
  det.views = [{ state: "frozen", ySplit: 1 }];

  for (const rec of rows) {
    const values: Record<string, unknown> = {};
    for (const c of schema.columns) {
      values[c.key] = cellValue(c.format, rec[c.key]);
    }
    const r = det.addRow(values);
    schema.columns.forEach((c, i) => {
      const fmt = numFmt(c.format);
      if (fmt) r.getCell(i + 1).numFmt = fmt;
    });
  }
  det.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: schema.columns.length },
  };

  for (const rule of schema.statusRules) {
    const colIndex = schema.columns.findIndex((c) => c.key === rule.column);
    if (colIndex < 0 || rows.length === 0) continue;
    const colLetter = det.getColumn(colIndex + 1).letter;
    const rangeRef = `${colLetter}2:${colLetter}${rows.length + 1}`;
    let priority = 1;
    for (const [value, bg] of Object.entries(rule.colors)) {
      const fontColor = STATUS_COLOR_TEXT[bg] ?? "FF1F2A24";
      det.addConditionalFormatting({
        ref: rangeRef,
        rules: [
          {
            type: "cellIs",
            operator: "equal",
            formulae: [`"${value}"`],
            style: {
              fill: { type: "pattern", pattern: "solid", fgColor: { argb: bg } },
              font: { color: { argb: fontColor }, bold: true },
            },
            priority: priority++,
          } as unknown as ExcelJS.ConditionalFormattingRule,
        ],
      });
    }
  }
}

/** ========== Generic tools (giữ hành vi cũ, gọn) ========== */
async function buildGeneric(
  wb: ExcelJS.Workbook,
  tool: ToolId,
  result: ToolResult,
  schema: ReturnType<typeof schemaFor>,
  meta: ReportMeta,
) {
  const sum = wb.addWorksheet("Tổng quan", { properties: { tabColor: { argb: BRAND } } });
  sum.columns = [{ width: 42 }, { width: 26 }, { width: 60 }];
  sum.getCell("A1").value = schema.title;
  sum.getCell("A1").font = { bold: true, size: 16, color: { argb: BRAND } };
  sum.getCell("A2").value = schema.subtitle;
  sum.getCell("A2").font = { italic: true, size: 10, color: { argb: SUBTLE } };
  sum.getCell("A3").value = `Tạo lúc: ${(meta.generatedAt ?? new Date()).toLocaleString("vi-VN")}`;
  sum.getCell("A3").font = { size: 9, color: { argb: SUBTLE } };
  if (meta.datasetSource) {
    sum.getCell("A4").value = `Nguồn: ${meta.datasetSource}${meta.skuCount ? ` · ${meta.skuCount} SKU` : ""}`;
    sum.getCell("A4").font = { size: 9, color: { argb: SUBTLE } };
  }

  let row = 6;
  sum.getCell(`A${row}`).value = "CHỈ SỐ CHÍNH (KPI)";
  sum.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: BRAND } };
  row += 1;
  ["Chỉ số", "Giá trị"].forEach((h, i) => {
    const c = sum.getRow(row).getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: BRAND_TEXT } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });
  row += 1;
  for (const kpi of schema.kpis) {
    const val = result.kpis[kpi.key];
    const r = sum.getRow(row);
    r.getCell(1).value = kpi.label;
    r.getCell(2).value = cellValue(kpi.format, val);
    r.getCell(2).numFmt = numFmt(kpi.format) ?? "General";
    r.getCell(2).font = { bold: true };
    row += 1;
  }
  row += 1;
  sum.getCell(`A${row}`).value = "NHẬN ĐỊNH & KHUYẾN NGHỊ";
  sum.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: BRAND } };
  row += 1;
  for (const line of schema.insights(result.kpis)) {
    sum.getCell(`A${row}`).value = `•  ${line}`;
    sum.mergeCells(`A${row}:C${row}`);
    sum.getRow(row).height = 28;
    row += 1;
  }

  addDetailSheet(wb, schema, result.rows as unknown as Record<string, unknown>[]);
}
