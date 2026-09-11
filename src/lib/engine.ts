import type { Dataset, Gap, ReplenRow, SkuRecord, ToolId } from "./types";
import { TOOL_BY_ID } from "./catalog";

const STORES = ["THISO MALL", "IPH", "SORA GARDENS", "SAIGON CENTRE", "AEON TAN PHU"];
const WH = "KHO TỔNG";
const TARGET_DAYS = 14;
const CARRY_RATE = 0.25;

export interface InventoryRow {
  sku: string;
  name: string;
  category: string;
  qty: number;
  weeklySales: number;
  ads: number;
  coverDays: number | null;
  status: "ZERO" | "LOW" | "HEALTHY" | "EXCESS" | "DEAD";
  value: number;
}

export interface AbcRow {
  sku: string;
  name: string;
  category: string;
  revenue: number;
  weeklySales: number;
  profit: number;
  share: number;
  cumulative: number;
  abc: "A" | "B" | "C";
  abcQty: "A" | "B" | "C";
  abcRev: "A" | "B" | "C";
  abcProfit: "A" | "B" | "C";
  triple: string;
  xyz: "X" | "Y" | "Z";
  cv: number;
  qty: number;
  coverDays: number | null;
}

export interface TurnoverRow {
  sku: string;
  name: string;
  category: string;
  qty: number;
  weeklySales: number;
  turns: number | null;
  dos: number | null;
  flag: "SHORT" | "OK" | "LONG" | "IDLE";
}

export interface FinancialRow {
  sku: string;
  name: string;
  category: string;
  qty: number;
  unitCost: number;
  unitPrice: number;
  inventoryValue: number;
  carryingCost: number;
  margin: number;
  gmroi: number | null;
}

export interface ForecastRow {
  sku: string;
  name: string;
  mape: number | null;
  bias: number | null;
  trackingSignal: number | null;
  actualSum: number;
  forecastSum: number;
  method: "uploaded" | "baseline-ma3";
}

export type ToolResult =
  | {
      tool: "inventory";
      kpis: Record<string, number>;
      rows: InventoryRow[];
      byCategory: { name: string; qty: number; value: number }[];
      byStatus: { name: string; count: number }[];
    }
  | {
      tool: "abc-xyz";
      kpis: Record<string, number>;
      rows: AbcRow[];
      matrix: { key: string; count: number; revenue: number }[];
    }
  | { tool: "turnover"; kpis: Record<string, number>; rows: TurnoverRow[] }
  | {
      tool: "financial";
      kpis: Record<string, number>;
      rows: FinancialRow[];
      byCategory: { name: string; value: number; carrying: number }[];
    }
  | { tool: "forecast"; kpis: Record<string, number>; rows: ForecastRow[] }
  | { tool: "replenishment"; kpis: Record<string, number>; rows: ReplenRow[] };

function ads(sku: SkuRecord, periodDays: number) {
  return sku.weeklySales / Math.max(periodDays, 1);
}

function cover(sku: SkuRecord, periodDays: number) {
  const d = ads(sku, periodDays);
  if (d <= 0) return sku.qty > 0 ? Infinity : null;
  return sku.qty / d;
}

function cv(series: number[]) {
  if (series.length < 2) return 0;
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  if (mean === 0) return 99;
  const varc = series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length;
  return Math.sqrt(varc) / mean;
}

function abcClassByMetric<T>(items: T[], valueFn: (x: T) => number): Map<T, "A" | "B" | "C"> {
  const sorted = [...items].sort((a, b) => valueFn(b) - valueFn(a));
  const total = sorted.reduce((s, x) => s + Math.max(0, valueFn(x)), 0) || 1;
  let cum = 0;
  const map = new Map<T, "A" | "B" | "C">();
  for (const x of sorted) {
    cum += Math.max(0, valueFn(x));
    const c = cum / total;
    map.set(x, c <= 0.8 ? "A" : c <= 0.95 ? "B" : "C");
  }
  return map;
}

export function detectGaps(tool: ToolId, dataset: Dataset | null): Gap[] {
  const def = TOOL_BY_ID[tool];
  const gaps: Gap[] = [];
  if (!dataset || dataset.skus.length === 0) {
    for (const slot of def.requiredSlots) {
      gaps.push({ slot, severity: "required", message: `Thiếu ${slot}` });
    }
    return gaps;
  }
  const hasQty = dataset.skus.some((s) => s.qty > 0);
  const hasSales = dataset.skus.some((s) => s.weeklySales > 0 || s.actuals.length > 0);
  const hasCost = dataset.skus.some((s) => s.unitCost > 0);
  const hasFc = dataset.skus.some((s) => s.forecasts.length > 0);
  const has = { inventory: hasQty, sales: hasSales, cost: hasCost, forecast: hasFc };

  for (const slot of def.requiredSlots) {
    if (!has[slot]) gaps.push({ slot, severity: "required", message: def.missingMessage });
  }
  for (const slot of def.optionalSlots) {
    if (!has[slot]) gaps.push({ slot, severity: "optional", message: def.missingMessage });
  }
  return gaps;
}

export function runInventory(ds: Dataset): ToolResult {
  const rows: InventoryRow[] = ds.skus.map((s) => {
    const d = cover(s, ds.periodDays);
    let status: InventoryRow["status"] = "HEALTHY";
    if (s.qty <= 0 && s.weeklySales > 0) status = "ZERO";
    else if (s.qty > 0 && s.weeklySales <= 0) status = "DEAD";
    else if (d != null && d !== Infinity && d < 7) status = "LOW";
    else if (d === Infinity || (d != null && d > 90)) status = "EXCESS";
    return {
      sku: s.sku,
      name: s.name,
      category: s.category,
      qty: s.qty,
      weeklySales: s.weeklySales,
      ads: ads(s, ds.periodDays),
      coverDays: d === Infinity ? 999 : d,
      status,
      value: s.qty * (s.unitCost || s.unitPrice * 0.55),
    };
  });
  const byStatusMap = new Map<string, number>();
  const byCat = new Map<string, { qty: number; value: number }>();
  for (const r of rows) {
    byStatusMap.set(r.status, (byStatusMap.get(r.status) ?? 0) + 1);
    const c = byCat.get(r.category) ?? { qty: 0, value: 0 };
    c.qty += r.qty;
    c.value += r.value;
    byCat.set(r.category, c);
  }
  const byCategory = [...byCat.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  return {
    tool: "inventory",
    kpis: {
      skus: rows.length,
      zero: rows.filter((r) => r.status === "ZERO").length,
      low: rows.filter((r) => r.status === "LOW").length,
      dead: rows.filter((r) => r.status === "DEAD").length,
      qty: rows.reduce((a, r) => a + r.qty, 0),
    },
    rows: rows.sort((a, b) => (a.coverDays === null ? 1 : (b.coverDays ?? 0) - (a.coverDays ?? 0))),
    byCategory,
    byStatus: [...byStatusMap.entries()].map(([name, count]) => ({ name, count })),
  };
}

export function runAbc(ds: Dataset): ToolResult {
  const skus = ds.skus.filter((s) => s.weeklySales > 0 || s.revenue > 0 || s.qty > 0);

  const profitOf = (s: (typeof skus)[0]) => {
    const cost = s.unitCost > 0 ? s.unitCost : s.unitPrice > 0 ? s.unitPrice * 0.55 : 0;
    const sold = s.weeklySales > 0 ? s.weeklySales : 0;
    if (s.revenue > 0 && cost > 0) return s.revenue - cost * sold;
    if (s.revenue > 0) return s.revenue * 0.45;
    return 0;
  };

  const byQty = abcClassByMetric(skus, (s) => s.weeklySales);
  const byRev = abcClassByMetric(skus, (s) => s.revenue);
  const byProfit = abcClassByMetric(skus, (s) => profitOf(s));

  const live = [...skus].sort((a, b) => b.revenue - a.revenue);
  const total = live.reduce((a, s) => a + s.revenue, 0) || 1;
  let cum = 0;

  const rows: AbcRow[] = live.map((s) => {
    cum += s.revenue;
    const share = s.revenue / total;
    const c = cum / total;
    const abcRev = byRev.get(s) ?? "C";
    const abcQty = byQty.get(s) ?? "C";
    const abcProfit = byProfit.get(s) ?? "C";
    const v = cv(s.actuals.length ? s.actuals : [s.weeklySales]);
    const xyz: AbcRow["xyz"] = v < 0.5 ? "X" : v < 1 ? "Y" : "Z";
    const d = cover(s, ds.periodDays);
    const profit = profitOf(s);
    return {
      sku: s.sku,
      name: s.name,
      category: s.category,
      revenue: s.revenue,
      weeklySales: s.weeklySales,
      profit,
      share,
      cumulative: c,
      abc: abcRev,
      abcQty,
      abcRev,
      abcProfit,
      triple: `${abcQty}${abcRev}${abcProfit}`,
      xyz,
      cv: v,
      qty: s.qty,
      coverDays: d === Infinity ? 999 : d,
    };
  });

  const matrixMap = new Map<string, { count: number; revenue: number }>();
  for (const r of rows) {
    const key = `${r.abc}${r.xyz}`;
    const cur = matrixMap.get(key) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += r.revenue;
    matrixMap.set(key, cur);
  }
  const matrix = ["AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ"].map((key) => ({
    key,
    count: matrixMap.get(key)?.count ?? 0,
    revenue: matrixMap.get(key)?.revenue ?? 0,
  }));

  const tripleTop = rows.filter((r) => r.triple === "AAA").length;

  return {
    tool: "abc-xyz",
    kpis: {
      a: rows.filter((r) => r.abcRev === "A").length,
      b: rows.filter((r) => r.abcRev === "B").length,
      c: rows.filter((r) => r.abcRev === "C").length,
      revenue: total,
      aaa: tripleTop,
      profit: rows.reduce((s, r) => s + r.profit, 0),
    },
    rows,
    matrix,
  };
}

export function runTurnover(ds: Dataset): ToolResult {
  const rows: TurnoverRow[] = ds.skus.map((s) => {
    const dos = cover(s, ds.periodDays);
    const annual = s.weeklySales * (365 / Math.max(ds.periodDays, 1));
    const turns = s.qty > 0 ? annual / s.qty : null;
    let flag: TurnoverRow["flag"] = "OK";
    if (s.weeklySales <= 0 && s.qty > 0) flag = "IDLE";
    else if (dos != null && dos !== Infinity && dos < 7) flag = "SHORT";
    else if (dos === Infinity || (dos != null && dos > 90)) flag = "LONG";
    return {
      sku: s.sku,
      name: s.name,
      category: s.category,
      qty: s.qty,
      weeklySales: s.weeklySales,
      turns,
      dos: dos === Infinity ? 999 : dos,
      flag,
    };
  });
  const withTurns = rows.filter((r) => r.turns != null);
  const avgTurns = withTurns.length
    ? withTurns.reduce((a, r) => a + (r.turns ?? 0), 0) / withTurns.length
    : 0;
  const avgDos = rows.filter((r) => r.dos != null && r.dos < 900).length
    ? rows.filter((r) => r.dos != null && r.dos < 900).reduce((a, r) => a + (r.dos ?? 0), 0) /
      rows.filter((r) => r.dos != null && r.dos < 900).length
    : 0;
  return {
    tool: "turnover",
    kpis: {
      avgTurns,
      avgDos,
      short: rows.filter((r) => r.flag === "SHORT").length,
      idle: rows.filter((r) => r.flag === "IDLE").length,
    },
    rows,
  };
}

export function runFinancial(ds: Dataset, carryRate = CARRY_RATE): ToolResult {
  const rows: FinancialRow[] = ds.skus.map((s) => {
    const cost = s.unitCost || s.unitPrice * 0.55;
    const price = s.unitPrice || cost / 0.55;
    const inventoryValue = s.qty * cost;
    const carryingCost = inventoryValue * carryRate;
    const annualSales = s.weeklySales * (365 / Math.max(ds.periodDays, 1));
    const margin = (price - cost) * annualSales;
    const gmroi = inventoryValue > 0 ? margin / inventoryValue : null;
    return {
      sku: s.sku,
      name: s.name,
      category: s.category,
      qty: s.qty,
      unitCost: cost,
      unitPrice: price,
      inventoryValue,
      carryingCost,
      margin,
      gmroi,
    };
  });
  const byCat = new Map<string, { value: number; carrying: number }>();
  for (const r of rows) {
    const c = byCat.get(r.category) ?? { value: 0, carrying: 0 };
    c.value += r.inventoryValue;
    c.carrying += r.carryingCost;
    byCat.set(r.category, c);
  }
  const totalVal = rows.reduce((a, r) => a + r.inventoryValue, 0);
  const totalCarry = rows.reduce((a, r) => a + r.carryingCost, 0);
  const totalMargin = rows.reduce((a, r) => a + r.margin, 0);
  return {
    tool: "financial",
    kpis: {
      value: totalVal,
      carrying: totalCarry,
      gmroi: totalVal > 0 ? totalMargin / totalVal : 0,
      skus: rows.length,
    },
    rows: rows.sort((a, b) => b.inventoryValue - a.inventoryValue),
    byCategory: [...byCat.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };
}

export function runForecast(ds: Dataset): ToolResult {
  const rows: ForecastRow[] = ds.skus
    .filter((s) => s.actuals.length || s.weeklySales > 0)
    .map((s) => {
      const actuals = s.actuals.length ? s.actuals : [s.weeklySales];
      let forecasts = s.forecasts.slice();
      let method: ForecastRow["method"] = "uploaded";
      if (forecasts.length === 0) {
        method = "baseline-ma3";
        forecasts = actuals.map((_, i) => {
          const window = actuals.slice(Math.max(0, i - 3), i);
          if (!window.length) return actuals[i] ?? 0;
          return window.reduce((a, b) => a + b, 0) / window.length;
        });
      }
      const n = Math.min(actuals.length, forecasts.length);
      if (n === 0) {
        return {
          sku: s.sku,
          name: s.name,
          mape: null,
          bias: null,
          trackingSignal: null,
          actualSum: 0,
          forecastSum: 0,
          method,
        };
      }
      let absPct = 0;
      let err = 0;
      let absErr = 0;
      let used = 0;
      for (let i = 0; i < n; i++) {
        const a = actuals[i];
        const f = forecasts[i];
        const e = a - f;
        err += e;
        absErr += Math.abs(e);
        if (a !== 0) {
          absPct += Math.abs(e / a);
          used += 1;
        }
      }
      const mape = used ? absPct / used : null;
      const mad = absErr / n;
      const ts = mad > 0 ? err / mad : 0;
      return {
        sku: s.sku,
        name: s.name,
        mape,
        bias: err / n,
        trackingSignal: ts,
        actualSum: actuals.slice(0, n).reduce((a, b) => a + b, 0),
        forecastSum: forecasts.slice(0, n).reduce((a, b) => a + b, 0),
        method,
      };
    });
  const withMape = rows.filter((r) => r.mape != null);
  const avgMape = withMape.length
    ? withMape.reduce((a, r) => a + (r.mape ?? 0), 0) / withMape.length
    : 0;
  return {
    tool: "forecast",
    kpis: {
      mape: avgMape,
      over: rows.filter((r) => (r.bias ?? 0) > 0).length,
      under: rows.filter((r) => (r.bias ?? 0) < 0).length,
      baseline: rows.filter((r) => r.method === "baseline-ma3").length,
    },
    rows: rows.sort((a, b) => (b.mape ?? 0) - (a.mape ?? 0)),
  };
}

export function runReplenishment(ds: Dataset, targetDays = TARGET_DAYS): ToolResult {
  if (ds.replenishment.length) {
    const rows = ds.replenishment;
    return {
      tool: "replenishment",
      kpis: {
        lines: rows.length,
        need: rows.filter((r) => r.suggest > 0 || r.status.includes("THIẾU") || r.status.includes("CẦN")).length,
        suggestQty: rows.reduce((a, r) => a + r.suggest, 0),
        stockout: rows.filter((r) => r.status.includes("HẾT") || r.status.includes("THIẾU")).length,
      },
      rows,
    };
  }

  const rows: ReplenRow[] = [];
  for (const s of ds.skus) {
    if (s.weeklySales <= 0) continue;
    const velocity = ads(s, ds.periodDays);
    const wh = s.locations[WH] ?? 0;
    for (const store of STORES) {
      const stock = s.locations[store] ?? 0;
      const coverDays = velocity > 0 ? stock / velocity : null;
      const target = velocity * targetDays;
      const need = Math.max(0, Math.ceil(target - stock));
      const suggest = Math.min(need, Math.max(0, Math.floor(wh)));
      let status = "OK";
      if (coverDays != null && coverDays < 7 && suggest > 0) status = "CẦN BỔ SUNG";
      else if (coverDays != null && coverDays < 7 && suggest === 0) status = "THIẾU HÀNG (WH hết)";
      else if (need > 0 && suggest > 0) status = "NÊN BỔ SUNG";
      else if (stock === 0 && s.weeklySales > 0) status = "HẾT HÀNG TẠI STORE";
      if (status === "OK") continue;
      rows.push({
        sku: s.sku,
        name: s.name,
        store,
        weeklySales: s.weeklySales,
        velocity,
        stock,
        coverDays,
        target,
        need,
        whAvailable: wh,
        suggest,
        status,
        category: s.category,
        size: s.size,
        color: s.color,
      });
    }
  }
  return {
    tool: "replenishment",
    kpis: {
      lines: rows.length,
      need: rows.length,
      suggestQty: rows.reduce((a, r) => a + r.suggest, 0),
      stockout: rows.filter((r) => r.status.includes("HẾT") || r.status.includes("THIẾU")).length,
    },
    rows: rows.sort((a, b) => (a.coverDays ?? 0) - (b.coverDays ?? 0)),
  };
}

export function runTool(tool: ToolId, ds: Dataset): ToolResult {
  switch (tool) {
    case "inventory":
      return runInventory(ds);
    case "abc-xyz":
      return runAbc(ds);
    case "turnover":
      return runTurnover(ds);
    case "financial":
      return runFinancial(ds);
    case "forecast":
      return runForecast(ds);
    case "replenishment":
      return runReplenishment(ds);
  }
}

export function resultRows(result: ToolResult): Record<string, unknown>[] {
  return result.rows as unknown as Record<string, unknown>[];
}
