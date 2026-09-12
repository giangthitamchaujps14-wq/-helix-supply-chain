import type ExcelJS from "exceljs";
import type { ToolId } from "./types";
import type { ToolResult } from "./engine";
import { schemaFor, STATUS_COLOR_TEXT, type CellFormat } from "./report-schema";

const BRAND = "FF1F2A24";
const BRAND_TEXT = "FFEFEBE3";
const SUBTLE = "FF6D6A64";
const GREEN_BG = "FFDCEBD9";
const ORANGE_BG = "FFFCE7C2";
const RED_BG = "FFF4C7C3";
const CARD_BG = "FFF7F5F0";
const BLUE_BG = "FFD9E4EC";
const BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFDDD8CE" } };
const BOX: Partial<ExcelJS.Borders> = {
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

function paintHeaderRow(row: ExcelJS.Row, from: number, to: number) {
  for (let i = from; i <= to; i++) {
    const c = row.getCell(i);
    c.font = { bold: true, color: { argb: BRAND_TEXT }, size: 9 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.border = { bottom: BORDER };
  }
}

function kpiCard(
  ws: ExcelJS.Worksheet,
  col: number,
  row: number,
  label: string,
  value: string | number,
  fmt?: string,
) {
  const a = ws.getCell(row, col);
  const b = ws.getCell(row + 1, col);
  a.value = label;
  a.font = { size: 9, color: { argb: SUBTLE }, bold: true };
  a.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
  a.alignment = { horizontal: "center", vertical: "middle" };
  a.border = BOX as ExcelJS.Borders;
  b.value = value;
  b.font = { size: 13, bold: true, color: { argb: BRAND } };
  b.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
  b.alignment = { horizontal: "center", vertical: "middle" };
  b.border = BOX as ExcelJS.Borders;
  if (fmt) b.numFmt = fmt;
  ws.getRow(row).height = 18;
  ws.getRow(row + 1).height = 26;
}

export interface ReportMeta {
  datasetSource?: string;
  skuCount?: number;
  files?: string[];
  generatedAt?: Date;
  /** Top N SKU trên Dashboard / chart — mặc định 15 */
  topN?: number;
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
    buildAbcPoster(wb, result, schema, meta);
  } else {
    buildGeneric(wb, result, schema, meta);
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `helix-${tool}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildAbcPoster(
  wb: ExcelJS.Workbook,
  result: Extract<ToolResult, { tool: "abc-xyz" }>,
  schema: ReturnType<typeof schemaFor>,
  meta: ReportMeta,
) {
  const rows = result.rows;
  const k = result.kpis;
  const topN = Math.min(50, Math.max(5, meta.topN ?? 15));
  const stamp = (meta.generatedAt ?? new Date()).toLocaleString("vi-VN");
  const totalRev = k.revenue ?? 0;
  const totalProfit = k.profit ?? 0;
  const totalCost = Math.max(0, totalRev - totalProfit);

  // ========== Dashboard ==========
  const dash = wb.addWorksheet("Dashboard", { properties: { tabColor: { argb: "FF2E6B3A" } } });
  for (let c = 1; c <= 12; c++) dash.getColumn(c).width = c <= 3 ? 16 : 13;

  dash.mergeCells("A1:L1");
  dash.getCell("A1").value = "SUPPLY CHAIN · ABC-XYZ EXECUTIVE DASHBOARD";
  dash.getCell("A1").font = { bold: true, size: 18, color: { argb: BRAND_TEXT } };
  dash.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  dash.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  dash.getRow(1).height = 30;

  dash.mergeCells("A2:L2");
  dash.getCell("A2").value =
    `${schema.subtitle}  ·  Tạo: ${stamp}` +
    (meta.datasetSource ? `  ·  ${meta.datasetSource}` : "") +
    `  ·  Top N = ${topN}`;
  dash.getCell("A2").font = { size: 9, italic: true, color: { argb: SUBTLE } };

  // --- KPI pipeline: Revenue / Cost / Profit ---
  dash.getCell("A4").value = "TỔNG HỢP (kỳ phân tích)";
  dash.getCell("A4").font = { bold: true, size: 11, color: { argb: BRAND } };

  kpiCard(dash, 1, 5, "DOANH THU", totalRev, '#,##0" ₫"');
  kpiCard(dash, 3, 5, "GIÁ VỐN (COST)", totalCost, '#,##0" ₫"');
  kpiCard(dash, 5, 5, "PROFIT", totalProfit, '#,##0" ₫"');
  kpiCard(dash, 7, 5, "SKU AAA", k.aaa ?? 0, "#,##0");
  kpiCard(dash, 9, 5, "CLASS A (DT)", k.a ?? 0, "#,##0");
  kpiCard(dash, 11, 5, "CLASS C (DT)", k.c ?? 0, "#,##0");
  for (const col of [1, 3, 5, 7, 9, 11]) {
    dash.mergeCells(5, col, 5, col + 1);
    dash.mergeCells(6, col, 6, col + 1);
  }

  // --- Matrix ---
  dash.getCell("A8").value = "MA TRẬN ABC × XYZ";
  dash.getCell("A8").font = { bold: true, size: 11, color: { argb: BRAND } };
  const matrixMap = new Map(result.matrix.map((m) => [m.key, m]));
  ["", "X", "Y", "Z"].forEach((h, i) => {
    const c = dash.getCell(9, i + 1);
    c.value = h || "ABC\\XYZ";
    c.font = { bold: true, color: { argb: BRAND_TEXT }, size: 9 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.alignment = { horizontal: "center" };
  });
  ["A", "B", "C"].forEach((abc, ri) => {
    const lab = dash.getCell(10 + ri, 1);
    lab.value = abc;
    lab.font = { bold: true, color: { argb: BRAND_TEXT } };
    lab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    lab.alignment = { horizontal: "center" };
    ["X", "Y", "Z"].forEach((xyz, ci) => {
      const key = `${abc}${xyz}`;
      const m = matrixMap.get(key);
      const cell = dash.getCell(10 + ri, ci + 2);
      const count = m?.count ?? 0;
      const rev = m?.revenue ?? 0;
      cell.value = count === 0 ? "—" : `${count} SKU\n${Math.round(rev).toLocaleString("vi-VN")}₫`;
      cell.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      if (key === "AX") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
      else if (xyz === "Z" && count) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } };
      else if (count) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
    });
    dash.getRow(10 + ri).height = 34;
  });

  // Rank 3D top
  dash.getCell("F8").value = "PHÂN BỐ RANK 3D";
  dash.getCell("F8").font = { bold: true, size: 11, color: { argb: BRAND } };
  const tripleCount = new Map<string, number>();
  for (const r of rows) {
    const t = String(r.triple ?? "");
    if (t) tripleCount.set(t, (tripleCount.get(t) ?? 0) + 1);
  }
  dash.getCell("F9").value = "Rank";
  dash.getCell("G9").value = "Số SKU";
  paintHeaderRow(dash.getRow(9), 6, 7);
  [...tripleCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([t, c], i) => {
      dash.getCell(10 + i, 6).value = t;
      dash.getCell(10 + i, 7).value = c;
      if (t === "AAA") {
        dash.getCell(10 + i, 6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
        dash.getCell(10 + i, 7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
      }
    });

  // --- Top N by QTY (bán chạy) ---
  const topByQty = [...rows].sort((a, b) => b.weeklySales - a.weeklySales).slice(0, topN);
  const tableStart = 14;
  dash.getCell(`A${tableStart}`).value = `TOP ${topN} SKU BÁN CHẠY NHẤT (theo số lượng / QTY)`;
  dash.getCell(`A${tableStart}`).font = { bold: true, size: 11, color: { argb: BRAND } };

  const th = ["#", "SKU", "Tên", "Rank 3D", "QTY bán", "Doanh thu", "Cost (ước)", "Profit", "% DT", "% Cost/DT"];
  th.forEach((h, i) => {
    const c = dash.getCell(tableStart + 1, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: BRAND_TEXT }, size: 9 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });

  // Chart data lives starting column A rows — also copy block for chart sheet
  topByQty.forEach((r, i) => {
    const cost = Math.max(0, r.revenue - r.profit);
    const line = dash.getRow(tableStart + 2 + i);
    line.getCell(1).value = i + 1;
    line.getCell(2).value = r.sku;
    line.getCell(3).value = r.name;
    line.getCell(4).value = r.triple;
    line.getCell(5).value = r.weeklySales;
    line.getCell(6).value = r.revenue;
    line.getCell(6).numFmt = '#,##0" ₫"';
    line.getCell(7).value = cost;
    line.getCell(7).numFmt = '#,##0" ₫"';
    line.getCell(8).value = r.profit;
    line.getCell(8).numFmt = '#,##0" ₫"';
    line.getCell(9).value = totalRev ? r.revenue / totalRev : 0;
    line.getCell(9).numFmt = "0.0%";
    line.getCell(10).value = r.revenue ? cost / r.revenue : 0;
    line.getCell(10).numFmt = "0.0%";
    if (r.triple === "AAA") {
      for (let c = 1; c <= 10; c++) {
        line.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
      }
    }
  });

  const chartDataRow0 = tableStart + 2; // first data row
  const chartDataRow1 = tableStart + 1 + topByQty.length;

  // --- Insights ---
  let ir = tableStart + 4 + topN;
  dash.getCell(`A${ir}`).value = "NHẬN ĐỊNH & KHUYẾN NGHỊ";
  dash.getCell(`A${ir}`).font = { bold: true, size: 11, color: { argb: BRAND } };
  ir += 1;
  for (const line of schema.insights(k)) {
    dash.mergeCells(`A${ir}:L${ir}`);
    dash.getCell(`A${ir}`).value = `•  ${line}`;
    dash.getCell(`A${ir}`).alignment = { wrapText: true };
    dash.getRow(ir).height = 26;
    ir += 1;
  }
  dash.getCell(`A${ir}`).value =
    "Ghi chú: Cost = Revenue − Profit (profit có thể ước nếu thiếu giá vốn). Cover chỉ cảnh báo khi đã join tồn. Top N cấu hình lúc export. Map cột Cửa hàng (hoặc tên file = 1 store) để có breakdown theo CH ở phiên bản engine tiếp theo.";
  dash.getCell(`A${ir}`).font = { size: 8, italic: true, color: { argb: SUBTLE } };

  // ========== ChartData + try native charts ==========
  const cd = wb.addWorksheet("ChartData", { properties: { tabColor: { argb: "FF8A9AA8" } } });
  cd.getCell("A1").value = "SKU";
  cd.getCell("B1").value = "QTY";
  cd.getCell("C1").value = "DoanhThu";
  cd.getCell("D1").value = "Cost";
  cd.getCell("E1").value = "Profit";
  paintHeaderRow(cd.getRow(1), 1, 5);
  topByQty.forEach((r, i) => {
    const cost = Math.max(0, r.revenue - r.profit);
    cd.getCell(2 + i, 1).value = r.sku;
    cd.getCell(2 + i, 2).value = r.weeklySales;
    cd.getCell(2 + i, 3).value = r.revenue;
    cd.getCell(2 + i, 4).value = cost;
    cd.getCell(2 + i, 5).value = r.profit;
  });
  cd.getColumn(1).width = 18;
  for (let c = 2; c <= 5; c++) cd.getColumn(c).width = 14;

  // ExcelJS chart (supported in exceljs 4+)
  try {
    // QTY bar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyDash = dash as any;
    if (typeof anyDash.addChart === "function") {
      anyDash.addChart({
        type: "bar",
        name: "TopN_QTY",
        title: { name: `Top ${topN} SKU theo QTY` },
        series: [
          {
            name: "QTY",
            categories: `ChartData!$A$2:$A$${1 + topByQty.length}`,
            values: `ChartData!$B$2:$B$${1 + topByQty.length}`,
          },
        ],
      });
    }
  } catch {
    // ignore — data still on ChartData for manual Insert Chart
  }

  void chartDataRow0;
  void chartDataRow1;

  // ========== Action (cover logic fixed) ==========
  const act = wb.addWorksheet("Action", { properties: { tabColor: { argb: "FFC47A6A" } } });
  [
    10, 16, 28, 10, 8, 8, 8, 6, 10, 12, 10, 10, 40,
  ].forEach((w, i) => {
    act.getColumn(i + 1).width = w;
  });
  act.getCell("A1").value = "ACTION LIST — Ưu tiên xử lý";
  act.getCell("A1").font = { bold: true, size: 14, color: { argb: BRAND } };
  act.mergeCells("A1:M1");
  act.getCell("A2").value =
    "Cover chỉ cảnh báo khi có tồn đã join (qty>0 hoặc cover tính được). Cover trống/0 do chưa map tồn → không kết luận đứt hàng.";
  act.getCell("A2").font = { size: 9, italic: true, color: { argb: SUBTLE } };

  const actH = [
    "Ưu tiên",
    "SKU",
    "Tên",
    "Rank 3D",
    "ABC SL",
    "ABC DT",
    "ABC LN",
    "XYZ",
    "QTY",
    "Doanh thu",
    "Tồn",
    "Cover",
    "Gợi ý",
  ];
  actH.forEach((h, i) => {
    const c = act.getCell(4, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: BRAND_TEXT }, size: 9 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });

  const actionRows = [...rows]
    .map((r) => {
      let priority = 3;
      let tip = "Theo dõi định kỳ";
      const hasStockSignal = r.qty > 0 || (r.coverDays != null && r.coverDays > 0);
      const coverMissing = r.coverDays == null || (r.coverDays === 0 && r.qty === 0 && !hasStockSignal);
      // chưa join tồn chắc chắn
      const noInventoryJoin = r.qty === 0 && (r.coverDays === 0 || r.coverDays == null);

      if (r.triple === "AAA") {
        priority = 1;
        tip = "AAA: ưu tiên fill rate & forecast sát";
      } else if (String(r.triple).startsWith("A")) {
        priority = 2;
        tip = "Nhóm A: ưu tiên độ chính xác tồn";
      }

      if (noInventoryJoin) {
        tip += " · Chưa join tồn — không kết luận đứt hàng";
      } else if (r.coverDays != null && r.coverDays > 0 && r.coverDays < 7 && r.weeklySales > 0) {
        priority = Math.min(priority, 1);
        tip = "Cover < 7 ngày (đã có tồn) — nguy cơ đứt hàng, cần bổ sung";
      } else if (r.qty === 0 && r.weeklySales > 0 && hasStockSignal === false && r.coverDays === 0) {
        // chỉ khi chắc hết tồn
        priority = Math.min(priority, 1);
        tip = "Tồn = 0 đang bán — kiểm tra bổ sung";
      }

      if (r.xyz === "Z" && String(r.triple).startsWith("A")) {
        tip += " · Z: cân safety stock";
      }
      if (coverMissing && r.triple === "AAA") {
        tip = tip.replace(/nguy cơ đứt hàng[^·]*/g, "").trim();
      }

      return { r, priority, tip };
    })
    .sort((a, b) => a.priority - b.priority || b.r.revenue - a.r.revenue)
    .slice(0, 50);

  actionRows.forEach((item, i) => {
    const r = item.r;
    const line = act.getRow(5 + i);
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
    line.getCell(10).numFmt = "#,##0";
    line.getCell(11).value = r.qty;
    line.getCell(12).value = r.coverDays;
    line.getCell(13).value = item.tip;
    if (item.priority === 1) {
      line.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } };
    } else if (item.priority === 2) {
      line.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_BG } };
    }
  });
  act.views = [{ state: "frozen", ySplit: 4 }];
  act.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 13 } };

  // ========== Data Quality ==========
  const dq = wb.addWorksheet("Data Quality", { properties: { tabColor: { argb: "FF8A9AA8" } } });
  dq.columns = [{ width: 44 }, { width: 28 }, { width: 56 }];
  dq.getCell("A1").value = "DATA QUALITY — ABC-XYZ";
  dq.getCell("A1").font = { bold: true, size: 14, color: { argb: BRAND } };
  const onePeriod = rows.length > 0 && rows.every((r) => r.cv === 0 || r.cv < 0.01);
  const noJoin = rows.filter((r) => r.qty === 0 && (r.coverDays === 0 || r.coverDays == null)).length;
  const lines: [string, string, string][] = [
    ["SKU trong rank (có phát sinh)", String(rows.length), "Master ∩ có sale kỳ"],
    ["AAA", String(k.aaa ?? 0), "Top SL+DT+LN"],
    ["XYZ", onePeriod ? "WARN — nghi 1 kỳ (CV~0)" : "OK", "Cần ≥2 kỳ"],
    [
      "Join tồn",
      noJoin > rows.length * 0.5 ? "WARN — nhiều SKU chưa join tồn" : "OK / một phần",
      "Cover không dùng để kết luận đứt hàng nếu chưa join",
    ],
    ["Cost / Profit", "Cost = DT − Profit (có thể ước)", "Map MASTER unitCost để profit thật"],
    ["Top N", String(topN), "Đổi trên UI lúc export (meta.topN)"],
    ["Store breakdown", "Chưa có trên rank SKU gộp", "Map Cửa hàng + giữ sale theo CH ở engine sau"],
  ];
  dq.getCell("A3").value = "Chỉ số";
  dq.getCell("B3").value = "Kết quả";
  dq.getCell("C3").value = "Giải thích";
  paintHeaderRow(dq.getRow(3), 1, 3);
  lines.forEach((L, i) => {
    dq.getCell(4 + i, 1).value = L[0];
    dq.getCell(4 + i, 2).value = L[1];
    dq.getCell(4 + i, 3).value = L[2];
    if (String(L[1]).startsWith("WARN")) {
      dq.getCell(4 + i, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_BG } };
    }
  });

  // ========== Chi tiết + Matrix ==========
  addDetailSheet(wb, schema, rows as unknown as Record<string, unknown>[]);
  const mx = wb.addWorksheet("Matrix", { properties: { tabColor: { argb: BRAND } } });
  mx.addRow(["key", "count", "revenue"]);
  paintHeaderRow(mx.getRow(1), 1, 3);
  result.matrix.forEach((m) => {
    const r = mx.addRow([m.key, m.count, m.revenue]);
    r.getCell(3).numFmt = "#,##0";
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
    for (const c of schema.columns) values[c.key] = cellValue(c.format, rec[c.key]);
    const r = det.addRow(values);
    schema.columns.forEach((c, i) => {
      const f = numFmt(c.format);
      if (f) r.getCell(i + 1).numFmt = f;
    });
  }
  if (schema.columns.length) {
    det.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: schema.columns.length },
    };
  }
  for (const rule of schema.statusRules) {
    const colIndex = schema.columns.findIndex((c) => c.key === rule.column);
    if (colIndex < 0 || !rows.length) continue;
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

function buildGeneric(
  wb: ExcelJS.Workbook,
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
  sum.getCell("A3").value = `Tạo: ${(meta.generatedAt ?? new Date()).toLocaleString("vi-VN")}`;
  let row = 6;
  sum.getCell(`A${row}`).value = "KPI";
  sum.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: BRAND } };
  row += 1;
  for (const kpi of schema.kpis) {
    sum.getRow(row).getCell(1).value = kpi.label;
    sum.getRow(row).getCell(2).value = cellValue(kpi.format, result.kpis[kpi.key]);
    sum.getRow(row).getCell(2).numFmt = numFmt(kpi.format) ?? "General";
    row += 1;
  }
  row += 1;
  for (const line of schema.insights(result.kpis)) {
    sum.getCell(`A${row}`).value = `• ${line}`;
    row += 1;
  }
  addDetailSheet(wb, schema, result.rows as unknown as Record<string, unknown>[]);
}
