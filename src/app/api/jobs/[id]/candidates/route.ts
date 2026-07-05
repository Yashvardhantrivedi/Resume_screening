import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToCandidate } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const search = sp.get("q")?.toLowerCase();
  const minScore = sp.get("min_score");
  const minExp = sp.get("min_exp");

  const db = getDb();
  let sql = "SELECT * FROM candidates WHERE job_id = ?";
  const args: (string | number)[] = [id];
  if (status && status !== "all") {
    sql += " AND status = ?";
    args.push(status);
  }
  if (minScore) {
    sql += " AND ats_score >= ?";
    args.push(Number(minScore));
  }
  sql += " ORDER BY ats_score DESC";

  let candidates = db.prepare(sql).all(...args).map((r) => rowToCandidate(r));

  if (search) {
    candidates = candidates.filter((c) => {
      const hay = [
        c.parsed.name, c.parsed.email, c.file_name,
        ...(c.parsed.skills ?? []),
        ...(c.parsed.education ?? []).map((e: { degree: string | null; institution: string | null }) => `${e.degree} ${e.institution}`),
      ].join(" ").toLowerCase();
      return hay.includes(search);
    });
  }
  if (minExp) {
    candidates = candidates.filter((c) => (c.parsed.experience_years ?? 0) >= Number(minExp));
  }

  return NextResponse.json(candidates);
}
