import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import fs from "fs/promises";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare("SELECT file_name, file_path FROM candidates WHERE id = ?").get(id) as
    | { file_name: string; file_path: string }
    | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const buffer = await fs.readFile(row.file_path);
    const ext = row.file_name.toLowerCase().split(".").pop();
    const type =
      ext === "pdf"
        ? "application/pdf"
        : ext === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/octet-stream";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${row.file_name.replace(/"/g, "")}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }
}
