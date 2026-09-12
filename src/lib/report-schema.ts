import type { ToolId } from "./types";
import type { ToolResult } from "./engine";

export type CellFormat = "int" | "number" | "pct" | "days" | "vnd" | "text";

export interface ReportColumn {
  key: string;
  label: string;
  format: CellFormat;
}

export interface KpiMeta {
  key: string;
  label: string;
  format: CellFormat;
  badWhenHigh?: boolean;
}

export interface StatusRule {
  column: string;
  colors: Record<string, string>;
}

export interface ToolReportSchema {
  title: string;
  subtitle: string;
  kpis: KpiMeta[];
  columns: ReportColumn[];
  statusRules: StatusRule[];
  insights: (kpis: Record<string, number>) => string[];
}

const RED = "FFF4C7C3";
const RED_TEXT = "FFB3261E";
const ORANGE = "FFFCE7C2";
const ORANGE_TEXT = "FF9A6A00";
const GREEN = "FFDCEBD9";
const GREEN_TEXT = "FF2E6B3A";
const BLUE = "FFD9E4EC";
const BLUE_TEXT = "FF2B5A78";
const GREY = "FFE7E4DD";
const GREY_TEXT = "FF55524B";

export const REPORT_SCHEMA: Record<ToolId, ToolReportSchema> = {
  inventory: {
    title: "Báo cáo Tình trạng Tồn kho (Inventory Health Report)",
    subtitle: "Phân loại trạng thái tồn theo cover days & vận tốc bán",
    kpis: [
      { key: "skus", label: "Tổng số SKU", format: "int" },
      { key: "qty", label: "Tổng tồn (đơn vị)", format: "int" },
      { key: "zero", label: "SKU hết hàng đang bán (ZERO)", format: "int", badWhenHigh: true },
      { key: "low", label: "SKU cover thấp (LOW < 7 ngày)", format: "int", badWhenHigh: true },
      { key: "dead", label: "SKU tồn không bán (DEAD)", format: "int", badWhenHigh: true },
    ],
    columns: [
      { key: "sku", label: "SKU", format: "text" },
      { key: "name", label: "Tên sản phẩm", format: "text" },
      { key: "category", label: "Nhóm", format: "text" },
      { key: "qty", label: "Tồn", format: "int" },
      { key: "weeklySales", label: "Bán/tuần", format: "number" },
      { key: "coverDays", label: "Cover (ngày)", format: "days" },
      { key: "value", label: "Giá trị tồn", format: "vnd" },
      { key: "status", label: "Trạng thái", format: "text" },
    ],
    statusRules: [
      {
        column: "status",
        colors: { ZERO: RED, LOW: ORANGE, DEAD: GREY, EXCESS: BLUE, HEALTHY: GREEN },
      },
    ],
    insights: (k) => {
      const out: string[] = [];
      if (k.zero > 0)
        out.push(
          `${k.zero} SKU đang hết hàng nhưng vẫn có nhu cầu bán — rủi ro mất doanh thu trực tiếp, cần ưu tiên bổ sung.`,
        );
      if (k.low > 0)
        out.push(`${k.low} SKU có cover dưới 7 ngày — theo dõi sát để tránh chuyển sang trạng thái hết hàng.`);
      if (k.dead > 0)
        out.push(
          `${k.dead} SKU có tồn nhưng không phát sinh bán — cân nhắc khuyến mãi, chuyển kho hoặc thanh lý để giải phóng vốn.`,
        );
      if (!out.length) out.push("Danh mục tồn kho đang ở trạng thái cân bằng, không phát hiện rủi ro nổi bật.");
      return out;
    },
  },

  "abc-xyz": {
    title: "ABC-XYZ Executive Report (Rank 3D)",
    subtitle:
      "Phân lớp 3 chiều: Số lượng bán (ABC SL) · Doanh thu (ABC DT) · Profit (ABC LN) + biến động nhu cầu (XYZ). Ngưỡng lũy kế 80/15/5.",
    kpis: [
      { key: "revenue", label: "Tổng doanh thu", format: "vnd" },
      { key: "profit", label: "Tổng profit (ước)", format: "vnd" },
      { key: "aaa", label: "SKU AAA (top Qty+Rev+Profit)", format: "int" },
      { key: "a", label: "SKU nhóm A theo doanh thu", format: "int" },
      { key: "b", label: "SKU nhóm B theo doanh thu", format: "int" },
      { key: "c", label: "SKU nhóm C theo doanh thu", format: "int" },
    ],
    columns: [
      { key: "sku", label: "SKU", format: "text" },
      { key: "name", label: "Tên sản phẩm", format: "text" },
      { key: "category", label: "Nhóm", format: "text" },
      { key: "triple", label: "Rank 3D", format: "text" },
      { key: "abcQty", label: "ABC SL (số lượng)", format: "text" },
      { key: "abcRev", label: "ABC DT (doanh thu)", format: "text" },
      { key: "abcProfit", label: "ABC LN (profit)", format: "text" },
      { key: "xyz", label: "XYZ", format: "text" },
      { key: "weeklySales", label: "SL bán", format: "number" },
      { key: "revenue", label: "Doanh thu", format: "vnd" },
      { key: "profit", label: "Profit", format: "vnd" },
      { key: "share", label: "Tỷ trọng DT", format: "pct" },
      { key: "cv", label: "CV", format: "number" },
      { key: "qty", label: "Tồn", format: "int" },
      { key: "coverDays", label: "Cover (ngày)", format: "days" },
    ],
    statusRules: [
      {
        column: "triple",
        colors: {
          AAA: GREEN,
          AAB: GREEN,
          ABA: GREEN,
          ABB: ORANGE,
          AAC: ORANGE,
          ACA: ORANGE,
          BAA: ORANGE,
          BBB: GREY,
          CCC: GREY,
        },
      },
      { column: "abcQty", colors: { A: GREEN, B: ORANGE, C: GREY } },
      { column: "abcRev", colors: { A: GREEN, B: ORANGE, C: GREY } },
      { column: "abcProfit", colors: { A: GREEN, B: ORANGE, C: GREY } },
      { column: "xyz", colors: { X: BLUE, Y: ORANGE, Z: RED } },
    ],
    insights: (k) => {
      const out: string[] = [];
      out.push(
        `Rank 3D: chữ 1 = số lượng bán, chữ 2 = doanh thu, chữ 3 = profit (vd AAA = top cả 3 chiều).`,
      );
      if (k.aaa > 0) {
        out.push(
          `${k.aaa} SKU đạt AAA — đây là nhóm then chốt: ưu tiên độ chính xác tồn, fill rate cao, theo dõi daily.`,
        );
      } else {
        out.push(`Chưa có SKU AAA trong kỳ — kiểm tra lại data sale/cost hoặc ngưỡng phân lớp.`);
      }
      out.push(
        `Theo doanh thu: A=${k.a}, B=${k.b}, C=${k.c} SKU. Nhóm A tạo ~80% doanh thu — chính sách tồn & forecast phải ưu tiên nhóm này.`,
      );
      if (k.c > (k.a || 1) * 3) {
        out.push(
          `Nhóm C theo DT khá lớn (${k.c} SKU) so với A (${k.a}) — cân nhắc chính sách tồn tối giản / đặt hàng gộp để giảm chi phí vận hành.`,
        );
      }
      if (k.profit > 0) {
        out.push(
          `Tổng profit ước tính: ${Math.round(k.profit).toLocaleString("vi-VN")} VND (dùng unit cost nếu có, không thì ước margin).`,
        );
      }
      out.push(
        `Ma trận XYZ: X = nhu cầu ổn định, Y = biến động vừa, Z = biến động cao — kết hợp Rank 3D để chọn chính sách (vd AAZ cần safety stock cao hơn AAX).`,
      );
      return out;
    },
  },

  turnover: {
    title: "Báo cáo Vòng quay & Days of Supply (Turnover Report)",
    subtitle: "Đo tốc độ luân chuyển tồn kho theo SKU",
    kpis: [
      { key: "avgTurns", label: "Vòng quay trung bình (turns/năm)", format: "number" },
      { key: "avgDos", label: "DOS trung bình (ngày)", format: "days" },
      { key: "short", label: "SKU cover ngắn (< 7 ngày)", format: "int", badWhenHigh: true },
      { key: "idle", label: "SKU tồn không luân chuyển", format: "int", badWhenHigh: true },
    ],
    columns: [
      { key: "sku", label: "SKU", format: "text" },
      { key: "name", label: "Tên sản phẩm", format: "text" },
      { key: "category", label: "Nhóm", format: "text" },
      { key: "qty", label: "Tồn", format: "int" },
      { key: "weeklySales", label: "Bán/tuần", format: "number" },
      { key: "turns", label: "Turns/năm", format: "number" },
      { key: "dos", label: "DOS (ngày)", format: "days" },
      { key: "flag", label: "Cảnh báo", format: "text" },
    ],
    statusRules: [{ column: "flag", colors: { SHORT: RED, IDLE: GREY, LONG: ORANGE, OK: GREEN } }],
    insights: (k) => {
      const out: string[] = [];
      if (k.short > 0)
        out.push(`${k.short} SKU có DOS dưới 7 ngày — nguy cơ đứt hàng ngắn hạn, cần đặt hàng/chuyển kho gấp.`);
      if (k.idle > 0)
        out.push(`${k.idle} SKU không luân chuyển — xem xét thanh lý hoặc điều chuyển sang kênh khác.`);
      out.push(`Vòng quay trung bình toàn danh mục: ${k.avgTurns?.toFixed?.(1) ?? k.avgTurns} lần/năm.`);
      return out;
    },
  },

  financial: {
    title: "Báo cáo Tài chính Tồn kho (Financial Inventory Report)",
    subtitle: "Giá trị vốn tồn, carrying cost và hiệu quả sử dụng vốn (GMROI)",
    kpis: [
      { key: "value", label: "Tổng giá trị tồn", format: "vnd" },
      { key: "carrying", label: "Carrying cost / năm", format: "vnd" },
      { key: "gmroi", label: "GMROI bình quân", format: "number" },
      { key: "skus", label: "SKU được định giá", format: "int" },
    ],
    columns: [
      { key: "sku", label: "SKU", format: "text" },
      { key: "name", label: "Tên sản phẩm", format: "text" },
      { key: "category", label: "Nhóm", format: "text" },
      { key: "qty", label: "Tồn", format: "int" },
      { key: "unitCost", label: "Giá vốn/đv", format: "vnd" },
      { key: "inventoryValue", label: "Giá trị tồn", format: "vnd" },
      { key: "carryingCost", label: "Carrying cost", format: "vnd" },
      { key: "gmroi", label: "GMROI", format: "number" },
    ],
    statusRules: [],
    insights: (k) => {
      const out: string[] = [];
      out.push(
        `Tổng vốn đang giữ trong tồn kho: ${Math.round(k.value).toLocaleString("vi-VN")} VND, phát sinh carrying cost khoảng ${Math.round(k.carrying).toLocaleString("vi-VN")} VND/năm (giả định 25%/năm).`,
      );
      if (k.gmroi < 1.5)
        out.push(
          `GMROI bình quân ${k.gmroi?.toFixed?.(2)} — thấp hơn ngưỡng khuyến nghị (1.5-2.0 cho ngành bán lẻ thời trang), nên rà soát nhóm hàng GMROI thấp để tối ưu vốn.`,
        );
      else
        out.push(
          `GMROI bình quân ${k.gmroi?.toFixed?.(2)} đang ở mức tốt, vốn tồn kho đang được sử dụng hiệu quả.`,
        );
      return out;
    },
  },

  forecast: {
    title: "Báo cáo Độ chính xác Dự báo (Forecast Accuracy Report)",
    subtitle: "MAPE, bias và tracking signal theo SKU",
    kpis: [
      { key: "mape", label: "MAPE trung bình", format: "pct" },
      { key: "over", label: "Số SKU bias dương (actual > forecast)", format: "int" },
      { key: "under", label: "Số SKU bias âm (actual < forecast)", format: "int" },
      { key: "baseline", label: "SKU dùng baseline MA3", format: "int" },
    ],
    columns: [
      { key: "sku", label: "SKU", format: "text" },
      { key: "name", label: "Tên sản phẩm", format: "text" },
      { key: "mape", label: "MAPE", format: "pct" },
      { key: "bias", label: "Bias", format: "number" },
      { key: "trackingSignal", label: "Tracking Signal", format: "number" },
      { key: "method", label: "Phương pháp", format: "text" },
    ],
    statusRules: [],
    insights: (k) => {
      const out: string[] = [];
      const mapePct = (k.mape ?? 0) * 100;
      if (mapePct > 50)
        out.push(
          `MAPE trung bình ${mapePct.toFixed(1)}% — độ chính xác dự báo thấp, cần rà soát phương pháp dự báo hoặc dữ liệu đầu vào.`,
        );
      else if (mapePct > 25)
        out.push(`MAPE trung bình ${mapePct.toFixed(1)}% — ở mức chấp nhận được nhưng còn dư địa cải thiện.`);
      else out.push(`MAPE trung bình ${mapePct.toFixed(1)}% — độ chính xác dự báo tốt.`);
      if (k.baseline > 0)
        out.push(
          `${k.baseline} SKU đang dùng baseline moving-average do thiếu file forecast — nên bổ sung forecast thực tế để đánh giá chính xác hơn.`,
        );
      return out;
    },
  },

  replenishment: {
    title: "Báo cáo Đề xuất Chuyển kho (Replenishment / Transfer Report)",
    subtitle: "Gợi ý chuyển hàng từ kho tổng theo cover target",
    kpis: [
      { key: "lines", label: "Tổng số dòng cần xử lý", format: "int" },
      { key: "need", label: "Dòng cần hành động", format: "int", badWhenHigh: true },
      { key: "suggestQty", label: "Tổng số lượng đề xuất chuyển", format: "int" },
      { key: "stockout", label: "Dòng thiếu / hết hàng", format: "int", badWhenHigh: true },
    ],
    columns: [
      { key: "sku", label: "SKU", format: "text" },
      { key: "name", label: "Tên sản phẩm", format: "text" },
      { key: "store", label: "Cửa hàng", format: "text" },
      { key: "stock", label: "Tồn CH", format: "int" },
      { key: "weeklySales", label: "Bán/tuần", format: "number" },
      { key: "coverDays", label: "Cover (ngày)", format: "days" },
      { key: "suggest", label: "Đề xuất chuyển", format: "int" },
      { key: "whAvailable", label: "Tồn kho tổng", format: "int" },
      { key: "status", label: "Trạng thái", format: "text" },
    ],
    statusRules: [
      {
        column: "status",
        colors: {
          "THIẾU HÀNG (WH hết)": RED,
          "HẾT HÀNG TẠI STORE": RED,
          "CẦN BỔ SUNG": ORANGE,
          "NÊN BỔ SUNG": BLUE,
          OK: GREEN,
        },
      },
    ],
    insights: (k) => {
      const out: string[] = [];
      if (k.stockout > 0)
        out.push(`${k.stockout} dòng đang thiếu/hết hàng tại cửa hàng — ưu tiên xử lý trước để tránh mất doanh thu.`);
      out.push(
        `Tổng số lượng đề xuất chuyển từ kho tổng: ${Math.round(k.suggestQty).toLocaleString("vi-VN")} đơn vị trên ${k.lines} dòng.`,
      );
      return out;
    },
  },
};

export const STATUS_COLOR_TEXT: Record<string, string> = {
  [RED]: RED_TEXT,
  [ORANGE]: ORANGE_TEXT,
  [GREEN]: GREEN_TEXT,
  [BLUE]: BLUE_TEXT,
  [GREY]: GREY_TEXT,
};

export function schemaFor(tool: ToolId) {
  return REPORT_SCHEMA[tool];
}

export function kpisForResult(result: ToolResult): Record<string, number> {
  return result.kpis;
}
