import type { WeightEntry } from "../domain/types";

export type WeightExportFormat = "excel" | "notepad" | "pdf";

export interface WeightExport {
  blob: Blob;
  filename: string;
}

export function weightsForMonths(
  weights: WeightEntry[],
  fromMonth: string,
  toMonth: string
): WeightEntry[] {
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || !/^\d{4}-\d{2}$/.test(toMonth)) {
    throw new Error("Select a valid start and end month.");
  }
  if (fromMonth > toMonth) throw new Error("The start month must not be after the end month.");
  return weights
    .filter(({ date }) => date.slice(0, 7) >= fromMonth && date.slice(0, 7) <= toMonth)
    .sort((a, b) => a.date.localeCompare(b.date));
}

const pdfText = (value: string): string => value.replace(/\\/g, "\\\\").replace(/[()]/g, "\\$&");

function createPdf(entries: WeightEntry[], fromMonth: string, toMonth: string): Uint8Array {
  const rows = [
    `Weight records: ${fromMonth} through ${toMonth}`,
    "Date          Weight (kg)",
    "-------------------------",
    ...entries.map(({ date, weightKg }) => `${date}    ${weightKg}`)
  ];
  const pages = Array.from({ length: Math.ceil(rows.length / 42) }, (_, index) =>
    rows.slice(index * 42, index * 42 + 42)
  );
  const fontId = 3 + pages.length * 2;
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] >>`;
  pages.forEach((pageRows, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const commands = pageRows
      .map((row, rowIndex) => `${rowIndex ? "0 -18 Td " : ""}(${pdfText(row)}) Tj`)
      .join("\n");
    const stream = `BT /F1 11 Tf 50 790 Td\n${commands}\nET`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = document.length;
    document += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = document.length;
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  document += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(document);
}

export function createWeightExport(
  weights: WeightEntry[],
  fromMonth: string,
  toMonth: string,
  format: WeightExportFormat
): WeightExport {
  const entries = weightsForMonths(weights, fromMonth, toMonth);
  if (!entries.length) throw new Error("No weight records exist in the selected months.");
  const base = `weights-${fromMonth}-to-${toMonth}`;
  if (format === "excel") {
    const csv = `\uFEFFDate,Weight (kg)\r\n${entries.map(({ date, weightKg }) => `${date},${weightKg}`).join("\r\n")}\r\n`;
    return { blob: new Blob([csv], { type: "text/csv;charset=utf-8" }), filename: `${base}.csv` };
  }
  if (format === "notepad") {
    const text = `Date\tWeight (kg)\r\n${entries.map(({ date, weightKg }) => `${date}\t${weightKg}`).join("\r\n")}\r\n`;
    return {
      blob: new Blob([text], { type: "text/plain;charset=utf-8" }),
      filename: `${base}.txt`
    };
  }
  const pdf = Uint8Array.from(createPdf(entries, fromMonth, toMonth));
  return {
    blob: new Blob([pdf], { type: "application/pdf" }),
    filename: `${base}.pdf`
  };
}
