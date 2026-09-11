import * as XLSX from "xlsx";
import type { ColumnRole, FileSlot, SkuRecord, UploadedTable } from "./types";

const ROLE_ALIASES: Record<ColumnRole, string[]> = {
  sku: [
    "sku",
    "ma sku",
    "mã sku",
    "ma hang",
    "mã hàng",
    "item",
    "itemid",
    "product_id",
    "model",
    "ma model",
    "ma sp",
    "mã sp",
  ],
  name: ["name", "ten", "tên", "product", "item name", "ten hang", "tên hàng", "ten hang hoa", "tên hàng hóa"],
  category: ["category", "nhom", "nhóm", "nganh", "ngành", "group", "brand", "nhom hang", "nhóm hàng", "nhom hang hoa"],
  location: ["location", "cua hang", "cửa hàng", "store", "kho", "warehouse", "site", "chi nhanh", "chi nhánh"],
  qty: [
    "qty",
    "quantity",
    "ton",
    "tồn",
    "ton cuoi",
    "tồn cuối",
    "ton cuoi ky",
    "tồn cuối kỳ",
    "closing",
    "onhand",
    "stock",
    "sl ton",
    "so luong ton",
    "số lượng tồn",
  ],
  salesQty: [
    "sales",
    "qty sold",
    "sl ban",
    "sl bán",
    "weekly",
    "ban tuan",
    "bán tuần",
    "sold",
    "velocity",
    "so luong ban",
    "số lượng bán",
  ],
  revenue: ["revenue", "doanh thu", "amount", "thanh tien", "thành tiền", "sales value", "gia tri"],
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
  if (!h) return null;
  for (const [role, aliases] of Object.entries(ROLE_ALIASES) as [ColumnRole, string[]][]) {
    if (aliases.some((a) => h === a || h.includes(a) || a.includes(h))) return role;
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

function isMostlyNumeric(row: (string | number | null)[]) {
  const filled = row.filter((c) => String(c ?? "").trim());
  if (!filled.length) return false;
  let nums = 0;
  for (const c of filled) {
    const s = String(c).replace(/[,%\s]/g, "");
    if (s && !Number.isNaN(Number(s))) nums++;
  }
  return nums / filled.length >= 0.5;
}

function headerScore(row: (string | number | null)[]): number {
  const texts = row.map((c) => cell(c)).filter(Boolean);
  if (texts.length < 2) return 0;
  if (isMostlyNumeric(row)) return 0;

  let score = texts.length;
  let roleHits = 0;
  for (const t of texts) {
    if (guessRole(t)) {
      roleHits++;
      score += 8;
    }
    const n = norm(t);
    // common inventory report headers
    if (n.includes("ma sku") || n.includes("sku") || n.includes("ton cuoi") || n.includes("ten hang")) {
      score += 12;
    }
    if (n === "so luong" || n === "gia tri") score += 2;
  }
  // strong bonus if looks like a real header row
  if (roleHits >= 2) score += 20;
  return score;
}

/** Build flat headers from 1–2 header rows (handles "Tồn cuối kỳ" + "Số lượng"). */
function buildHeaders(
  primary: (string | number | null)[],
  secondary?: (string | number | null)[],
): string[] {
  const len = Math.max(primary.length, secondary?.length ?? 0);
  const headers: string[] = [];
  let lastParent = "";

  for (let i = 0; i < len; i++) {
    const p = cell(primary[i]);
    const s = secondary ? cell(secondary[i]) : "";
    if (p) lastParent = p;

    let label = "";
    if (p && s) {
      // e.g. parent "Tồn cuối kỳ" + child "Số lượng"
      label = `${lastParent} - ${s}`;
    } else if (p) {
      label = p;
    } else if (s && lastParent) {
      label = `${lastParent} - ${s}`;
    } else if (s) {
      label = s;
    } else {
      label = `col_${i + 1}`;
    }

    // Prefer quantity column under tồn cuối as plain qty-friendly name
    const n = norm(label);
    if (n.includes("ton cuoi") && n.includes("so luong")) {
      label = "Tồn cuối kỳ - Số lượng";
    }

    headers.push(label);
  }

  // de-dupe identical names
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const c = (seen.get(h) ?? 0) + 1;
    seen.set(h, c);
    return c > 1 ? `${h} (${c})` : h;
  });
}

function pickBestSheet(wb: XLSX.WorkBook): string {
  let bestName = wb.SheetNames[0];
  let bestScore = -1;

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    let score = 0;
    for (let i = 0; i < Math.min(matrix.length, 20); i++) {
      score = Math.max(score, headerScore(matrix[i] ?? []));
    }
    // prefer sheets with more rows (detail vs summary)
    score += Math.min(matrix.length / 100, 30);
    if (score > bestScore) {
      bestScore = score;
      bestName = name;
    }
  }
  return bestName;
}

export function parseWorkbook(buffer: ArrayBuffer, filename: string): UploadedTable {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = pickBestSheet(wb);
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  // Find best header row by semantic score (not just fill count)
  let headerIdx = 0;
  let best = -1;
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const sc = headerScore(matrix[i] ?? []);
    if (sc > best) {
      best = sc;
      headerIdx = i;
    }
  }

  // Detect 2-level header: next row is "Số lượng / Giá trị"
  let secondaryIdx: number | null = null;
  const next = matrix[headerIdx + 1] ?? [];
  const nextTexts = next.map((c) => norm(cell(c))).filter(Boolean);
  const looksLikeSubHeader =
    nextTexts.length >= 2 &&
    nextTexts.some((t) => t === "so luong" || t.includes("so luong")) &&
    nextTexts.some((t) => t === "gia tri" || t.includes("gia tri")) &&
    !isMostlyNumeric(next);

  if (looksLikeSubHeader) secondaryIdx = headerIdx + 1;

  const headers = buildHeaders(
    matrix[headerIdx] ?? [],
    secondaryIdx != null ? matrix[secondaryIdx] : undefined,
  );

  const dataStart = (secondaryIdx != null ? secondaryIdx : headerIdx) + 1;
  const rows: Record<string, string>[] = [];
  for (let i = dataStart; i < matrix.length; i++) {
    const raw = matrix[i] ?? [];
    if (!raw.some((c) => String(c).trim())) continue;
    // skip total/summary trailing rows (empty sku-like first col + large numbers)
    const first = cell(raw[0]);
    if (!first && i > dataStart + 5) continue;

    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = cell(raw[idx]);
    });
    rows.push(rec);
  }

  const mapping = autoMap(headers);

  // Prefer "Tồn cuối kỳ - Số lượng" for qty if multiple qty-like cols
  if (!mapping.qty) {
    const qtyHeader = headers.find((h) => {
      const n = norm(h);
      return n.includes("ton cuoi") && n.includes("so luong");
    });
    if (qtyHeader) mapping.qty = qtyHeader;
  }

  return { name: filename, headers, rows, mapping };
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
