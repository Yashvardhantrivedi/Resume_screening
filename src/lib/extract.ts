import mammoth from "mammoth";

export interface ExtractedDoc {
  text: string;
  pages: number;
}

export async function extractText(
  buffer: Buffer,
  fileName: string
): Promise<ExtractedDoc> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return { text: result.text ?? "", pages: result.pages?.length ?? 1 };
    } finally {
      await parser.destroy();
    }
  }
  if (ext === "docx" || ext === "doc") {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value ?? "", pages: 1 };
  }
  if (ext === "txt") {
    return { text: buffer.toString("utf-8"), pages: 1 };
  }
  throw new Error(`Unsupported file type: .${ext}`);
}
