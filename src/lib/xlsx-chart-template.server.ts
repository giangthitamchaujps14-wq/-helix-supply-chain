/**
 * Chuẩn bị 1 file template .xlsx thật trên đĩa cho xlsx-chart dùng lúc chạy,
 * bằng cách ghi lại từ dữ liệu base64 đã nhúng sẵn trong code (xem
 * xlsx-chart-template-data.server.ts để biết vì sao phải làm vậy thay vì
 * đọc trực tiếp file trong node_modules/ hay public/).
 *
 * os.tmpdir() luôn ghi được trên Vercel serverless function (AWS Lambda).
 */
import { mkdtemp, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COLUMN_TEMPLATE_BASE64 } from "./xlsx-chart-template-data.server";

let cachedPath: string | null = null;

export async function getColumnTemplatePath(): Promise<string> {
  if (cachedPath) {
    try {
      await access(cachedPath);
      return cachedPath;
    } catch {
      cachedPath = null; // file biến mất (cold start mới) -> ghi lại
    }
  }
  const dir = await mkdtemp(join(tmpdir(), "xlsx-chart-"));
  const path = join(dir, "column.xlsx");
  await writeFile(path, Buffer.from(COLUMN_TEMPLATE_BASE64, "base64"));
  cachedPath = path;
  return path;
}
