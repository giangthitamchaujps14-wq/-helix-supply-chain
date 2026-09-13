declare module "xlsx-chart" {
  interface XLSXChartOptions {
    file?: string;
    chart?: "column" | "bar" | "line" | "area" | "pie" | "radar" | "scatter";
    titles: string[];
    fields: string[];
    data: Record<string, Record<string, number>>;
    chartTitle?: string;
    templatePath?: string;
  }

  class XLSXChart {
    generate(
      opts: XLSXChartOptions,
      callback: (err: Error | null, data: Buffer) => void
    ): void;

    writeFile(
      opts: XLSXChartOptions,
      callback: (err: Error | null) => void
    ): void;
  }

  export default XLSXChart;
}
