import * as XLSX from "xlsx";
import type { ColumnRole, FileSlot, SkuRecord, UploadedTable } from "./types";

const ROLE_ALIASES: Record<ColumnRole, string[]> = {
  sku: ["sku", "ma sku", "mã sku", "item", "itemid", "product_id", "ma hang", "mã hàng", "model", "ma model"],
  name: ["name", "ten", "tên", "product", "item name", "ten hang", "tên hàng"],
  category: ["category", "nhom", "nhóm", "nganh", "ngành", "group", "brand"],
  location: ["location", "cua hang", "cửa hàng", "store", "kho", "warehouse", "site"],
  qty: ["qty", "quantity", "ton", "tồn", "ton cuoi", "tồn cuối", "closing", "onhand", "stock", "sl ton"],
  salesQty: ["sales", "qty sold", "sl ban", "sl bán", "weekly", "ban tuan", "bán tuần", "sold", "velocity"],
  revenue: ["revenue", "doanh thu", "amount", "thanh tien", "thành tiền", "sales value"],
  unitCost: ["cost", "unit cost", "gia von", "giá vốn", "cogs", "von"],
  unitPrice: ["price", "unit price", "gia ban", "giá bán", "avg price"],
  forecast: ["forecast", "fcst", "du bao", "dự báo", "plan"],
  actual: ["actual", "thuc te", "thực tế", "sold qty"],
  period: ["period", "week", "tuan", "tuần", "date", "ngay", "ngày"],
  size: ["size", "kich co", "kích cỡ"],
  store: ["store", "shop", "cua hang", "cửa hàng"],
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function guessRole(header: string): ColumnRole | null {
  const h = norm(header);
  for (const [role, aliases] of Object.entries(ROLE_ALIASES) as [ColumnRole, string[]][]) {
    if (aliases.some((a) => h === a || h.includes(a))) return role;
  }
  return null;
}

export function autoMap(headers: string[]): Partial<Record<ColumnRole, string>> {
  const mapping: Partial<Record<ColumnRole, string>> = {};
  for (const header of headers) {
    const role = guessRole(header);
    if (role && !mapping[role]) mapping[role] = header;
  }
  return mapping;
}

function cell(v: unknown) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

export function parseWorkbook(buffer: ArrayBuffer, filename: string): UploadedTable {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  let headerIdx = 0;
  let best = 0;
  for (let i = 0; i < Math.min(matrix.length, 12); i++) {
    const row = matrix[i] ?? [];
    const filled = row.filter((c) => String(c).trim()).length;
    if (filled > best) {
      best = filled;
      headerIdx = i;
    }
  }
  const headers = (matrix[headerIdx] ?? []).map((c, i) => {
    const s = cell(c);
    return s || `col_${i + 1}`;
  });
  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const raw = matrix[i] ?? [];
    if (!raw.some((c) => String(c).trim())) continue;
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = cell(raw[idx]);
    });
    rows.push(rec);
  }
  return { name: filename, headers, rows, mapping: autoMap(headers) };
}

function num(v: string | undefined) {
  if (!v) return 0;
  const n = Number(String(v).replace(/[%\s]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function guessSlot(table: UploadedTable): FileSlot {
  const roles = new Set(Object.keys(table.mapping));
  if (roles.has("forecast") || roles.has("actual")) return "forecast";
  if (roles.has("unitCost") && !roles.has("qty") && !roles.has("salesQty")) return "cost";
  if (roles.has("salesQty") || roles.has("revenue")) return "sales";
  return "inventory";
}

export function tablesToSkus(tables: { table: UploadedTable; slot: FileSlot }[]): SkuRecord[] {
  const map = new Map<string, SkuRecord>();

  const ensure = (sku: string): SkuRecord => {
    let rec = map.get(sku);
    if (!rec) {
      rec = {
        sku,
        name: sku,
        category: "KHÁC",
        unit: "CÁI",
        qty: 0,
        locations: {},
        weeklySales: 0,
        revenue: 0,
        unitCost: 0,
        unitPrice: 0,
        actuals: [],
        forecasts: [],
      };
      map.set(sku, rec);
    }
    return rec;
  };

  for (const { table, slot } of tables) {
    const m = table.mapping;
    for (const row of table.rows) {
      const sku = (m.sku ? row[m.sku] : "") || "";
      if (!sku || sku.toLowerCase() === "nan") continue;
      const rec = ensure(sku);
      if (m.name && row[m.name]) rec.name = row[m.name];
      if (m.category && row[m.category]) rec.category = row[m.category];
      if (m.size && row[m.size]) rec.size = row[m.size];
      const loc = (m.location ? row[m.location] : m.store ? row[m.store] : "") || "";

      if (slot === "inventory") {
        const q = num(m.qty ? row[m.qty] : undefined);
        rec.qty += q;
        if (loc) rec.locations[loc] = (rec.locations[loc] ?? 0) + q;
      }
      if (slot === "sales") {
        rec.weeklySales += num(m.salesQty ? row[m.salesQty] : undefined);
        rec.revenue += num(m.revenue ? row[m.revenue] : undefined);
        if (m.unitPrice) rec.unitPrice = num(row[m.unitPrice]);
      }
      if (slot === "cost") {
        rec.unitCost = num(m.unitCost ? row[m.unitCost] : undefined);
      }
      if (slot === "forecast") {
        rec.forecasts.push(num(m.forecast ? row[m.forecast] : undefined));
        rec.actuals.push(num(m.actual ? row[m.actual] : m.salesQty ? row[m.salesQty] : undefined));
      }
    }
  }

  for (const rec of map.values()) {
    if (!rec.unitPrice && rec.weeklySales > 0 && rec.revenue > 0) {
      rec.unitPrice = rec.revenue / rec.weeklySales;
    }
    if (!rec.unitCost && rec.unitPrice) rec.unitCost = rec.unitPrice * 0.55;
    if (rec.actuals.length === 0 && rec.weeklySales > 0) {
      rec.actuals = [rec.weeklySales];
    }
  }

  return [...map.values()];
}
