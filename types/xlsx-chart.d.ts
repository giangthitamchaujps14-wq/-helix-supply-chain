declare module "xlsx-chart" {
  export interface XlsxChartOptions {
    file?: string;
    chart?: "column" | "bar" | "line" | "area" | "pie" | "radar" | "scatter";
    titles: string[];
    fields: string[];
    data: Record<string, Record<string, number>>;
    chartTitle?: string;
    templatePath?: string;
  }

  export default class XLSXChart {
    generate(opts: XlsxChartOptions, callback: (err: Error | null, data: Buffer) => void): void;
    writeFile(opts: XlsxChartOptions, callback: (err: Error | null) => void): void;
  }
}
