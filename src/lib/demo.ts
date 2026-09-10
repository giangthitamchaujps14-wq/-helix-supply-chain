import demo from "@/data/abc-mart.json";
import type { Dataset } from "./types";

export const DEMO_DATASET = demo as unknown as Omit<Dataset, "files">;

export async function fetchDemo(): Promise<Omit<Dataset, "files">> {
  return DEMO_DATASET;
}
