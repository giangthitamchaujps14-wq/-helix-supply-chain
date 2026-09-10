import { create } from "zustand";
import type { Dataset, FileSlot, ToolId, UploadedTable } from "./types";
import type { ToolResult } from "./engine";
import { detectGaps, runTool } from "./engine";
import { DEMO_DATASET } from "./demo";
import { guessSlot, tablesToSkus } from "./parse";

interface WorkspaceState {
  dataset: Dataset | null;
  demoLoaded: boolean;
  tables: { table: UploadedTable; slot: FileSlot }[];
  lastResult: ToolResult | null;
  lastTool: ToolId | null;
  carryingRate: number;
  targetDays: number;
  loadDemo: (data: Omit<Dataset, "files">) => void;
  addTable: (table: UploadedTable, slot?: FileSlot) => FileSlot;
  setSlot: (name: string, slot: FileSlot) => void;
  setMapping: (name: string, mapping: UploadedTable["mapping"]) => void;
  rebuildFromTables: () => void;
  run: (tool: ToolId, ignoreOptional?: boolean) => { blocked: boolean };
  clearResult: () => void;
}

function emptyDataset(source: string): Dataset {
  return {
    source,
    asOf: new Date().toISOString().slice(0, 10),
    periodDays: 7,
    skus: [],
    replenishment: [],
    files: [],
  };
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  dataset: {
    ...DEMO_DATASET,
    files: [{ name: "ABC-MART snapshot", slot: "demo" }],
  },
  demoLoaded: true,
  tables: [],
  lastResult: null,
  lastTool: null,
  carryingRate: 0.25,
  targetDays: 14,

  loadDemo: (data) => {
    set({
      dataset: {
        ...data,
        files: [{ name: "ABC-MART snapshot", slot: "demo" }],
      },
      demoLoaded: true,
      lastResult: null,
      lastTool: null,
    });
  },

  addTable: (table, slot) => {
    const s = slot ?? guessSlot(table);
    set((st) => ({
      tables: [...st.tables.filter((t) => t.table.name !== table.name), { table, slot: s }],
    }));
    get().rebuildFromTables();
    return s;
  },

  setSlot: (name, slot) => {
    set((st) => ({
      tables: st.tables.map((t) => (t.table.name === name ? { ...t, slot } : t)),
    }));
    get().rebuildFromTables();
  },

  setMapping: (name, mapping) => {
    set((st) => ({
      tables: st.tables.map((t) =>
        t.table.name === name ? { ...t, table: { ...t.table, mapping } } : t,
      ),
    }));
    get().rebuildFromTables();
  },

  rebuildFromTables: () => {
    const { tables, dataset, demoLoaded } = get();
    if (!tables.length) return;
    const skus = tablesToSkus(tables);
    const base = dataset && demoLoaded ? dataset : emptyDataset(tables.map((t) => t.table.name).join(", "));
    set({
      dataset: {
        ...base,
        source: tables.map((t) => t.table.name).join(" + ") + (demoLoaded ? " + demo" : ""),
        skus: skus.length ? skus : base.skus,
        files: [
          ...(demoLoaded ? [{ name: "ABC-MART snapshot", slot: "demo" as const }] : []),
          ...tables.map((t) => ({ name: t.table.name, slot: t.slot })),
        ],
      },
    });
  },

  run: (tool, ignoreOptional = false) => {
    const ds = get().dataset;
    if (!ds) return { blocked: true };
    const gaps = detectGaps(tool, ds);
    const hard = gaps.filter((g) => g.severity === "required");
    const soft = gaps.filter((g) => g.severity === "optional");
    if (hard.length) return { blocked: true };
    if (soft.length && !ignoreOptional) return { blocked: true };
    const result = runTool(tool, ds);
    set({ lastResult: result, lastTool: tool });
    return { blocked: false };
  },

  clearResult: () => set({ lastResult: null, lastTool: null }),
}));
