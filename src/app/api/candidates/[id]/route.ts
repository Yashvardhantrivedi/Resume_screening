import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToCandidate } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rowToCandidate(row));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const status = body.status;
  if (!["new", "shortlisted", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const db = getDb();
  const result = db.prepare("UPDATE candidates SET status = ? WHERE id = ?").run(status, id);
  if (result.changes === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(id);
  return NextResponse.json(rowToCandidate(row));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM candidates WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
