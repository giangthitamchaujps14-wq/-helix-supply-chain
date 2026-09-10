export type FileSlot = "inventory" | "sales" | "cost" | "forecast";

export type ColumnRole =
  | "sku"
  | "name"
  | "category"
  | "location"
  | "qty"
  | "salesQty"
  | "revenue"
  | "unitCost"
  | "unitPrice"
  | "forecast"
  | "actual"
  | "period"
  | "size"
  | "store";

export interface SkuRecord {
  sku: string;
  name: string;
  category: string;
  unit: string;
  size?: string | null;
  color?: string | null;
  qty: number;
  locations: Record<string, number>;
  weeklySales: number;
  revenue: number;
  unitCost: number;
  unitPrice: number;
  actuals: number[];
  forecasts: number[];
}

export interface ReplenRow {
  sku: string;
  model?: string | null;
  name: string;
  size?: string | null;
  color?: string | null;
  category?: string | null;
  store: string;
  weeklySales: number;
  velocity: number;
  stock: number;
  coverDays: number | null;
  target: number;
  need: number;
  whAvailable: number;
  suggest: number;
  status: string;
}

export interface LocationSummary {
  location: string;
  sku_count: number;
  total_qty: number;
  positive: number;
}

export interface Dataset {
  source: string;
  asOf: string;
  periodDays: number;
  summary?: {
    totalQty: number;
    whQty: number;
    storeQty: number;
    skuPositive: number;
    locations: LocationSummary[];
  };
  skus: SkuRecord[];
  replenishment: ReplenRow[];
  files: { name: string; slot: FileSlot | "demo" }[];
}

export interface UploadedTable {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  mapping: Partial<Record<ColumnRole, string>>;
}

export type ToolId =
  | "inventory"
  | "abc-xyz"
  | "turnover"
  | "financial"
  | "forecast"
  | "replenishment";

export interface ToolReport {
  id: string;
  name: string;
  description: string;
}

export interface ToolDef {
  id: ToolId;
  name: string;
  group: string;
  summary: string;
  detail: string;
  requiredSlots: FileSlot[];
  optionalSlots: FileSlot[];
  missingMessage: string;
  reports: ToolReport[];
}

export interface Gap {
  slot: FileSlot;
  severity: "required" | "optional";
  message: string;
}
