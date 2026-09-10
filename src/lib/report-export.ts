import type ExcelJS from "exceljs";
import type { ToolId } from "./types";
import type { ToolResult } from "./engine";
import { schemaFor, STATUS_COLOR_TEXT, type CellFormat } from "./report-schema";

const BRAND = "FF1F2A24"; // header dark green-black
const BRAND_TEXT = "FFEFEBE3";
const SUBTLE = "FF6D6A64";
const BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFDDD8CE" } };

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
  if (format === "pct" && typeof raw === "number") return raw; // already 0..1 fraction
  return raw as string | number;
}

function styleTitle(ws: ExcelJS.Worksheet, row: number, text: string, size = 16) {
  const r = ws.getRow(row);
  r.getCell(1).value = text;
  r.getCell(1).font = { bold: true, size, color: { argb: BRAND } };
  r.height = size + 10;
}

function styleSubtitle(ws: ExcelJS.Worksheet, row: number, text: string) {
  const r = ws.getRow(row);
  r.getCell(1).value = text;
  r.getCell(1).font = { italic: true, size: 10, color: { argb: SUBTLE } };
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

  // ---------- Sheet 1: Tổng quan (Executive Summary) ----------
  const sum = wb.addWorksheet("Tổng quan", { properties: { tabColor: { argb: BRAND } } });
  sum.columns = [{ width: 42 }, { width: 26 }, { width: 60 }];
  styleTitle(sum, 1, schema.title);
  styleSubtitle(sum, 2, schema.subtitle);
  sum.getCell("A3").value = `Tạo lúc: ${(meta.generatedAt ?? new Date()).toLocaleString("vi-VN")}`;
  sum.getCell("A3").font = { size: 9, color: { argb: SUBTLE } };
  if (meta.datasetSource) {
    sum.getCell("A4").value = `Nguồn dữ liệu: ${meta.datasetSource}${meta.skuCount ? ` · ${meta.skuCount} SKU` : ""}${
      meta.files?.length ? ` · File: ${meta.files.join(", ")}` : ""
    }`;
    sum.getCell("A4").font = { size: 9, color: { argb: SUBTLE } };
  }

  let row = 6;
  sum.getCell(`A${row}`).value = "CHỈ SỐ CHÍNH (KPI)";
  sum.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: BRAND } };
  row += 1;
  const kpiHeaderRow = sum.getRow(row);
  ["Chỉ số", "Giá trị", ""].forEach((h, i) => {
    const c = kpiHeaderRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: BRAND_TEXT } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });
  row += 1;
  for (const k of schema.kpis) {
    const val = result.kpis[k.key];
    const r = sum.getRow(row);
    r.getCell(1).value = k.label;
    r.getCell(2).value = cellValue(k.format, val);
    r.getCell(2).numFmt = numFmt(k.format) ?? "General";
    r.getCell(2).font = { bold: true };
    if (k.badWhenHigh && typeof val === "number" && val > 0) {
      r.getCell(2).font = { bold: true, color: { argb: "FFB3261E" } };
    }
    r.getCell(1).border = { bottom: BORDER };
    r.getCell(2).border = { bottom: BORDER };
    row += 1;
  }

  row += 1;
  sum.getCell(`A${row}`).value = "NHẬN ĐỊNH & KHUYẾN NGHỊ";
  sum.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: BRAND } };
  row += 1;
  for (const line of schema.insights(result.kpis)) {
    sum.getCell(`A${row}`).value = `•  ${line}`;
    sum.mergeCells(`A${row}:C${row}`);
    sum.getCell(`A${row}`).alignment = { wrapText: true, vertical: "top" };
    sum.getRow(row).height = 30;
    row += 1;
  }

  // ---------- Sheet 2: Phân tích (breakdowns) nếu có ----------
  const anyResult = result as unknown as Record<string, unknown>;
  const breakdownSets: { name: string; rows: Record<string, unknown>[] }[] = [];
  if (Array.isArray(anyResult.byStatus)) breakdownSets.push({ name: "Theo trạng thái", rows: anyResult.byStatus as Record<string, unknown>[] });
  if (Array.isArray(anyResult.byCategory)) breakdownSets.push({ name: "Theo nhóm hàng", rows: anyResult.byCategory as Record<string, unknown>[] });
  if (Array.isArray(anyResult.matrix)) breakdownSets.push({ name: "Ma trận ABC-XYZ", rows: anyResult.matrix as Record<string, unknown>[] });

  if (breakdownSets.length) {
    const bd = wb.addWorksheet("Phân tích", { properties: { tabColor: { argb: BRAND } } });
    let bdRow = 1;
    for (const set of breakdownSets) {
      bd.getCell(`A${bdRow}`).value = set.name;
      bd.getCell(`A${bdRow}`).font = { bold: true, size: 12, color: { argb: BRAND } };
      bdRow += 1;
      const keys = Object.keys(set.rows[0] ?? {});
      const headerRow = bd.getRow(bdRow);
      keys.forEach((k, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = k;
        c.font = { bold: true, color: { argb: BRAND_TEXT } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
      });
      bdRow += 1;
      const dataStartRow = bdRow;
      for (const rec of set.rows) {
        const r = bd.getRow(bdRow);
        keys.forEach((k, i) => {
          r.getCell(i + 1).value = rec[k] as string | number;
        });
        bdRow += 1;
      }
      // data bar on the last numeric column (heuristic: 2nd or last numeric col)
      const numericColIndex = keys.findIndex((k) => typeof set.rows[0][k] === "number" && k !== keys[0]);
      if (numericColIndex >= 0) {
        const colLetter = bd.getColumn(numericColIndex + 1).letter;
        bd.addConditionalFormatting({
          ref: `${colLetter}${dataStartRow}:${colLetter}${bdRow - 1}`,
          rules: [
            {
              type: "dataBar",
              cfvo: [{ type: "min" }, { type: "max" }],
              color: { argb: "FF7D9A86" },
              priority: 1,
            } as unknown as ExcelJS.ConditionalFormattingRule,
          ],
        });
      }
      keys.forEach((_, i) => {
        bd.getColumn(i + 1).width = 20;
      });
      bdRow += 2;
    }
  }

  // ---------- Sheet 3: Chi tiết SKU ----------
  const det = wb.addWorksheet("Chi tiết SKU", { properties: { tabColor: { argb: BRAND } } });
  det.columns = schema.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4) }));
  const headerRow = det.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: BRAND_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.border = { bottom: BORDER };
  });
  det.views = [{ state: "frozen", ySplit: 1 }];

  const rows = (result.rows as unknown as Record<string, unknown>[]) ?? [];
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

  // Conditional formatting theo status/flag/abc/xyz
  for (const rule of schema.statusRules) {
    const colIndex = schema.columns.findIndex((c) => c.key === rule.column);
    if (colIndex < 0) continue;
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

  // Xuất file
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
