import type { FileSlot, ToolDef, ToolId } from "./types";

export const SLOT_LABEL: Record<FileSlot, string> = {
  inventory: "Tồn kho (snapshot)",
  sales: "Doanh số / vận tốc bán",
  cost: "Giá vốn / cost",
  forecast: "Forecast vs actual",
};

export const SLOT_HINT: Record<FileSlot, string> = {
  inventory: "Cột bắt buộc: SKU, số lượng tồn. Nên có: location, tên, nhóm.",
  sales: "Cột bắt buộc: SKU, số lượng bán. Nên có: doanh thu, cửa hàng.",
  cost: "Cột bắt buộc: SKU, unit cost. Nếu thiếu, hệ thống ước từ giá bán.",
  forecast: "Cột: SKU, forecast, actual (theo tuần/kỳ).",
};

export const TOOLS: ToolDef[] = [
  {
    id: "inventory",
    name: "Inventory Analysis",
    group: "Inventory",
    summary: "Trạng thái tồn, cover days, slow/fast moving theo SKU và location.",
    detail:
      "Đọc snapshot tồn kho, gắn vận tốc bán (nếu có) để phân loại thiếu hàng, tồn chậm và tập trung SKU sống.",
    requiredSlots: ["inventory"],
    optionalSlots: ["sales"],
    missingMessage:
      "Để phân loại Slow / Fast moving và Days of Supply chính xác, hệ thống cần thêm file Sales. Bạn muốn upload thêm hay chạy với tồn kho hiện có?",
    reports: [
      {
        id: "stock-status",
        name: "Stock status",
        description: "Zero / low / healthy / excess theo cover days",
      },
      {
        id: "velocity",
        name: "Slow & fast moving",
        description: "Phân vị vận tốc và tồn không bán",
      },
    ],
  },
  {
    id: "abc-xyz",
    name: "ABC-XYZ Analysis",
    group: "Inventory",
    summary: "Phân lớp giá trị (ABC) và biến động nhu cầu (XYZ).",
    detail:
      "ABC theo doanh thu lũy kế 80/15/5. XYZ theo hệ số biến thiên chuỗi bán. Ma trận 9 ô để chọn chính sách tồn.",
    requiredSlots: ["sales"],
    optionalSlots: ["inventory"],
    missingMessage:
      "ABC-XYZ đầy đủ nên có Inventory snapshot để đọc cover của từng ô. Bạn muốn upload tồn kho hay chạy chỉ với doanh số?",
    reports: [
      { id: "abc", name: "ABC ranking", description: "A/B/C theo doanh thu" },
      { id: "matrix", name: "ABC-XYZ matrix", description: "9 ô chính sách" },
    ],
  },
  {
    id: "turnover",
    name: "Turnover & Days of Supply",
    group: "Inventory",
    summary: "Vòng quay tồn và số ngày phủ hàng theo SKU / nhóm.",
    detail:
      "Turns = bán năm / tồn. DOS = tồn ÷ bán/ngày. Cảnh báo SKU dưới 7 ngày hoặc trên 90 ngày.",
    requiredSlots: ["inventory", "sales"],
    optionalSlots: [],
    missingMessage:
      "Turnover cần cả tồn kho và doanh số. Hãy upload file còn thiếu trước khi chạy.",
    reports: [
      { id: "dos", name: "Days of supply", description: "Cover theo SKU" },
      { id: "turns", name: "Inventory turns", description: "Vòng quay năm" },
    ],
  },
  {
    id: "financial",
    name: "Financial Inventory",
    group: "Finance",
    summary: "Giá trị tồn, carrying cost, vốn lưu động và GMROI.",
    detail:
      "Giá trị = tồn × giá vốn. Carrying cost mặc định 25%/năm (chỉnh được). GMROI = lãi gộp / tồn bình quân.",
    requiredSlots: ["inventory"],
    optionalSlots: ["cost", "sales"],
    missingMessage:
      "Carrying cost và GMROI chính xác cần unit cost và giá bán. Thiếu cost, hệ thống ước 55% giá bán. Upload thêm file cost?",
    reports: [
      { id: "value", name: "Inventory valuation", description: "Giá trị theo nhóm" },
      { id: "gmroi", name: "GMROI", description: "Hiệu quả vốn tồn" },
    ],
  },
  {
    id: "forecast",
    name: "Forecast Accuracy",
    group: "Demand",
    summary: "MAPE, bias, tracking signal — đo chất lượng dự báo.",
    detail:
      "Nếu không có forecast, hệ thống dùng trung bình động 3 kỳ làm baseline để bạn vẫn có thước đo.",
    requiredSlots: ["sales"],
    optionalSlots: ["forecast"],
    missingMessage:
      "Chưa có file Forecast. Hệ thống có thể chạy baseline moving-average từ actual. Upload forecast hay chạy baseline?",
    reports: [
      { id: "mape", name: "Accuracy board", description: "MAPE / bias / TS" },
    ],
  },
  {
    id: "replenishment",
    name: "Replenishment",
    group: "Fulfillment",
    summary: "Gợi ý chuyển kho theo vận tốc, cover target và tồn kho tổng.",
    detail:
      "Target mặc định 14 ngày cover. Ưu tiên cửa hàng dưới 7 ngày nếu kho tổng còn hàng.",
    requiredSlots: ["inventory", "sales"],
    optionalSlots: [],
    missingMessage:
      "Gợi ý chuyển kho cần tồn theo location (gồm kho tổng) và vận tốc bán. Upload file còn thiếu?",
    reports: [
      {
        id: "transfer",
        name: "Transfer suggestion",
        description: "SKU × store cần bổ sung",
      },
    ],
  },
];

export const TOOL_BY_ID: Record<ToolId, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t]),
) as Record<ToolId, ToolDef>;

export const GROUPS = ["Inventory", "Finance", "Demand", "Fulfillment"] as const;

export function isToolId(id: string): id is ToolId {
  return id in TOOL_BY_ID;
}
