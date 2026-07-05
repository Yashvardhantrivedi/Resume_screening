import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToCandidate } from "@/lib/db";
import { Candidate } from "@/lib/types";

export const runtime = "nodejs";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const status = req.nextUrl.searchParams.get("status");
  const db = getDb();

  let sql = "SELECT * FROM candidates WHERE job_id = ?";
  const args: (string | number)[] = [id];
  if (status && status !== "all") {
    sql += " AND status = ?";
    args.push(status);
  }
  sql += " ORDER BY ats_score DESC";
  const candidates = db.prepare(sql).all(...args).map((r) => rowToCandidate(r)) as Candidate[];

  const header = [
    "Rank", "Name", "Email", "Phone", "ATS Score", "Status", "Experience (yrs)",
    "Skills", "Matched Skills", "Missing Skills", "Education", "CGPA",
    "LinkedIn", "GitHub", "File",
  ];
  const lines = [header.join(",")];
  candidates.forEach((c, i) => {
    const edu = c.parsed.education?.[0];
    lines.push(
      [
        i + 1,
        c.parsed.name, c.parsed.email, c.parsed.phone,
        c.ats_score, c.status, c.parsed.experience_years,
        (c.parsed.skills ?? []).join("; "),
        (c.explanation.matched_skills ?? []).join("; "),
        (c.explanation.missing_skills ?? []).join("; "),
        edu ? `${edu.degree ?? ""} ${edu.institution ?? ""}`.trim() : "",
        edu?.cgpa ?? "",
        c.parsed.linkedin, c.parsed.github, c.file_name,
      ]
        .map(csvEscape)
        .join(",")
    );
  });

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidates_job${id}${status && status !== "all" ? "_" + status : ""}.csv"`,
    },
  });
}
