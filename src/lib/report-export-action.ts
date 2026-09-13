import { createServerFn } from "@tanstack/react-start";
import type { ToolId } from "./types";
import type { ToolResult } from "./engine";
import { buildReportBuffer, reportFileName, type ReportMeta } from "./report-export";
import { join } from "path";

export interface GenerateReportInput {
  tool: ToolId;
  result: ToolResult;
  meta?: ReportMeta;
}

export interface GenerateReportOutput {
  /** Nội dung file .xlsx, mã hoá base64 để gửi qua JSON an toàn. */
  base64: string;
  filename: string;
  /** true nếu chart Excel gốc đã được chèn thành công. */
  chartEmbedded: boolean;
}

/**
 * Tạo file Excel report kèm chart Excel GỐC (không phải ảnh).
 * Chạy hoàn toàn trên server vì `xlsx-chart` cần Node.js (đọc template từ
 * ổ đĩa) — không chạy được trong trình duyệt.
 */
export const generateReportWithChart = createServerFn({ method: "POST" })
  .validator((data: GenerateReportInput) => data)
  .handler(async ({ data }): Promise<GenerateReportOutput> => {
    const { tool, result, meta = {} } = data;
    const { buffer, chartData } = await buildReportBuffer(tool, result, meta);
    const filename = reportFileName(tool);

    // Không có dữ liệu để vẽ chart (vd tool khác abc-xyz) -> trả file gốc.
    if (!chartData.length) {
      return {
        base64: Buffer.from(buffer).toString("base64"),
        filename,
        chartEmbedded: false,
      };
    }

    try {
      const { default: XLSXChart } = await import("xlsx-chart");
      const { mergeChartIntoWorkbook } = await import("./xlsx-chart-merge.server");

      // Template nằm trong public/ → Vercel luôn copy vào output
      const templatePath = join(process.cwd(), "public/xlsx-chart-templates/column.xlsx");

      const fields = chartData.map((r) => r.sku);
      const values: Record<string, number> = {};
      chartData.forEach((r) => {
        values[r.sku] = r.qty;
      });

      const xlsxChart = new XLSXChart();
      const chartBuffer: Buffer = await new Promise((resolve, reject) => {
        xlsxChart.generate(
          {
            chart: "column",
            titles: ["QTY"],
            fields,
            data: { QTY: values },
            chartTitle: `Top ${fields.length} SKU theo QTY`,
            templatePath,
          },
          (err: Error | null, buf: Buffer) =>
            err ? reject(err) : resolve(buf),
        );
      });

      const merged = await mergeChartIntoWorkbook({
        mainBuffer: Buffer.from(buffer),
        chartBuffer,
        targetSheetName: "Dashboard",
      });

      return {
        base64: merged.toString("base64"),
        filename,
        chartEmbedded: true,
      };
    } catch (err) {
      console.error(
        "[report-export] chart embed failed, falling back to plain report:",
        err,
      );
      return {
        base64: Buffer.from(buffer).toString("base64"),
        filename,
        chartEmbedded: false,
      };
    }
  });
