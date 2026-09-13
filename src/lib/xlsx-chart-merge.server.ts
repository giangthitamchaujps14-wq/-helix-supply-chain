/**
 * Ghép 1 chart Excel GỐC (tạo bởi thư viện `xlsx-chart`, chạy Node-only) vào
 * 1 workbook đã được ExcelJS build sẵn (giữ nguyên toàn bộ style/màu/border).
 *
 * Excel lưu file .xlsx dưới dạng file zip chứa nhiều XML. Chart không phải là
 * 1 "loại dữ liệu" mà ExcelJS hiểu, nên cách duy nhất để có chart GỐC (không
 * phải ảnh tĩnh) là chèn thẳng các phần XML mô tả chart vào đúng chỗ trong
 * zip đó. Hàm này làm chính xác việc đó — không có API cấp cao nào thay thế
 * được bước "phẫu thuật" thủ công này.
 *
 * CHỈ chạy được trên server (dùng JSZip trực tiếp trên Buffer, không đụng
 * tới trình duyệt).
 */
import JSZip from "jszip";

export interface MergeChartOptions {
  /** Buffer .xlsx do ExcelJS tạo ra (report chính, đầy đủ style). */
  mainBuffer: ArrayBuffer | Buffer;
  /** Buffer .xlsx do `xlsx-chart` tạo ra (chỉ chứa 1 chart + data thô). */
  chartBuffer: Buffer;
  /** Tên sheet trong file chính sẽ được gắn chart vào, vd "Dashboard". */
  targetSheetName: string;
}

export async function mergeChartIntoWorkbook({
  mainBuffer,
  chartBuffer,
  targetSheetName,
}: MergeChartOptions): Promise<Buffer> {
  const mainZip = await JSZip.loadAsync(mainBuffer);
  const chartZip = await JSZip.loadAsync(chartBuffer);

  // 1) Tìm đúng file sheetN.xml tương ứng với targetSheetName, qua
  //    workbook.xml (tên -> r:id) rồi workbook.xml.rels (r:id -> file).
  const workbookXmlFile = mainZip.file("xl/workbook.xml");
  if (!workbookXmlFile) throw new Error("xl/workbook.xml not found in main workbook");
  const workbookXml = await workbookXmlFile.async("string");

  const sheetMatch = new RegExp(
    `<sheet[^>]*name="${escapeRegExp(targetSheetName)}"[^>]*r:id="(rId\\d+)"`,
  ).exec(workbookXml);
  if (!sheetMatch) {
    throw new Error(`Sheet "${targetSheetName}" not found in xl/workbook.xml`);
  }
  const sheetRid = sheetMatch[1];

  const workbookRelsFile = mainZip.file("xl/_rels/workbook.xml.rels");
  if (!workbookRelsFile) throw new Error("xl/_rels/workbook.xml.rels not found");
  const workbookRels = await workbookRelsFile.async("string");
  const relMatch = new RegExp(
    `<Relationship Id="${sheetRid}"[^>]*Target="worksheets/(sheet\\d+\\.xml)"`,
  ).exec(workbookRels);
  if (!relMatch) throw new Error(`Relationship for ${sheetRid} not found`);
  const sheetFile = relMatch[1]; // vd "sheet1.xml"

  // 2) Tính số thứ tự drawing/chart tiếp theo để không đè lên file có sẵn.
  const existingDrawings = Object.keys(mainZip.files).filter((f) =>
    /^xl\/drawings\/drawing\d+\.xml$/.test(f),
  );
  const existingCharts = Object.keys(mainZip.files).filter((f) =>
    /^xl\/charts\/chart\d+\.xml$/.test(f),
  );
  const drawingNum = existingDrawings.length + 1;
  const chartNum = existingCharts.length + 1;
  const drawingFile = `xl/drawings/drawing${drawingNum}.xml`;
  const drawingRelsFile = `xl/drawings/_rels/drawing${drawingNum}.xml.rels`;
  const chartFile = `xl/charts/chart${chartNum}.xml`;

  // 3) Lấy XML của chart + drawing từ file do xlsx-chart tạo ra.
  const srcChart = chartZip.file("xl/charts/chart1.xml");
  const srcDrawing = chartZip.file("xl/drawings/drawing1.xml");
  const srcDrawingRels = chartZip.file("xl/drawings/_rels/drawing1.xml.rels");
  if (!srcChart || !srcDrawing || !srcDrawingRels) {
    throw new Error("Chart-only workbook thiếu chart1.xml / drawing1.xml — xlsx-chart có thể đã đổi cấu trúc output");
  }
  const chartXml = await srcChart.async("string");
  const drawingXml = await srcDrawing.async("string");
  const drawingRelsXml = (await srcDrawingRels.async("string")).replace(
    /chart1\.xml/,
    `chart${chartNum}.xml`,
  );

  mainZip.file(chartFile, chartXml);
  mainZip.file(drawingFile, drawingXml);
  mainZip.file(drawingRelsFile, drawingRelsXml);

  // 4) Gắn drawing vào sheet đích: thêm quan hệ vào sheetN.xml.rels
  const sheetRelsFile = `xl/worksheets/_rels/${sheetFile}.rels`;
  const existingSheetRels = mainZip.file(sheetRelsFile);
  let sheetRelsXml = existingSheetRels
    ? await existingSheetRels.async("string")
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  const usedIds = [...sheetRelsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));
  const newRid = `rId${(usedIds.length ? Math.max(...usedIds) : 0) + 1}`;
  const newRel = `<Relationship Id="${newRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingNum}.xml"/>`;
  sheetRelsXml = sheetRelsXml.replace("</Relationships>", `${newRel}</Relationships>`);
  mainZip.file(sheetRelsFile, sheetRelsXml);

  // 5) Thêm thẻ <drawing r:id="..."/> vào cuối sheetN.xml (đúng vị trí theo
  //    schema OOXML: ngay trước </worksheet>).
  const sheetPath = `xl/worksheets/${sheetFile}`;
  const sheetXmlFile = mainZip.file(sheetPath);
  if (!sheetXmlFile) throw new Error(`${sheetPath} not found`);
  let sheetXml = await sheetXmlFile.async("string");
  if (!/<drawing\s/.test(sheetXml)) {
    sheetXml = sheetXml.replace("</worksheet>", `<drawing r:id="${newRid}"/></worksheet>`);
    mainZip.file(sheetPath, sheetXml);
  }

  // 6) Đăng ký 2 phần mới (drawing + chart) trong [Content_Types].xml,
  //    nếu không Excel sẽ báo file hỏng khi mở.
  const contentTypesFile = mainZip.file("[Content_Types].xml");
  if (!contentTypesFile) throw new Error("[Content_Types].xml not found");
  let contentTypes = await contentTypesFile.async("string");
  const additions: string[] = [];
  if (!contentTypes.includes(`PartName="/${drawingFile}"`)) {
    additions.push(
      `<Override PartName="/${drawingFile}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    );
  }
  if (!contentTypes.includes(`PartName="/${chartFile}"`)) {
    additions.push(
      `<Override PartName="/${chartFile}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    );
  }
  if (additions.length) {
    contentTypes = contentTypes.replace("</Types>", `${additions.join("")}</Types>`);
    mainZip.file("[Content_Types].xml", contentTypes);
  }

  return mainZip.generateAsync({ type: "nodebuffer" });
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
