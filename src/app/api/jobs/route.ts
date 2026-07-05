import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToJob } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT j.*,
        (SELECT COUNT(*) FROM candidates c WHERE c.job_id = j.id) AS candidate_count,
        (SELECT COUNT(*) FROM candidates c WHERE c.job_id = j.id AND c.status = 'shortlisted') AS shortlisted_count
       FROM jobs j ORDER BY j.id DESC`
    )
    .all();
  return NextResponse.json(rows.map(rowToJob));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO jobs (title, description, required_skills, preferred_skills, min_experience,
        education, min_cgpa, job_type, employment_type, location, mandatory_keywords, nice_keywords)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      body.title.trim(),
      body.description ?? "",
      JSON.stringify(body.required_skills ?? []),
      JSON.stringify(body.preferred_skills ?? []),
      Number(body.min_experience) || 0,
      JSON.stringify(body.education ?? []),
      body.min_cgpa ? Number(body.min_cgpa) : null,
      body.job_type ?? "Onsite",
      body.employment_type ?? "Full Time",
      body.location ?? "",
      JSON.stringify(body.mandatory_keywords ?? []),
      JSON.stringify(body.nice_keywords ?? [])
    );
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(rowToJob(row), { status: 201 });
}
