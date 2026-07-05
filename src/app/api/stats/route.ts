import { NextResponse } from "next/server";
import { getDb, rowToCandidate } from "@/lib/db";
import { Candidate } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'shortlisted' THEN 1 ELSE 0 END) AS shortlisted,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        AVG(ats_score) AS avg_score
       FROM candidates`
    )
    .get() as { total: number; shortlisted: number; rejected: number; avg_score: number | null };

  const jobCount = (db.prepare("SELECT COUNT(*) AS n FROM jobs").get() as { n: number }).n;

  const candidates = db
    .prepare("SELECT * FROM candidates")
    .all()
    .map((r) => rowToCandidate(r)) as Candidate[];

  // Skill distribution (top 12)
  const skillCounts = new Map<string, number>();
  for (const c of candidates) {
    for (const s of c.parsed.skills ?? []) {
      skillCounts.set(s, (skillCounts.get(s) ?? 0) + 1);
    }
  }
  const skills = [...skillCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));

  // Experience distribution
  const expBuckets = { "0-1": 0, "1-3": 0, "3-5": 0, "5-8": 0, "8+": 0 };
  for (const c of candidates) {
    const y = c.parsed.experience_years ?? 0;
    if (y < 1) expBuckets["0-1"]++;
    else if (y < 3) expBuckets["1-3"]++;
    else if (y < 5) expBuckets["3-5"]++;
    else if (y < 8) expBuckets["5-8"]++;
    else expBuckets["8+"]++;
  }

  // Score histogram (10-point bins)
  const scoreBins: { range: string; count: number }[] = [];
  for (let lo = 0; lo < 100; lo += 10) {
    scoreBins.push({
      range: `${lo}-${lo + 10}`,
      count: candidates.filter((c) => c.ats_score >= lo && c.ats_score < lo + 10 + (lo === 90 ? 1 : 0)).length,
    });
  }

  // Education distribution
  const eduCounts = new Map<string, number>();
  for (const c of candidates) {
    const deg = c.parsed.education?.[0]?.degree ?? "Unknown";
    eduCounts.set(deg, (eduCounts.get(deg) ?? 0) + 1);
  }
  const education = [...eduCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // Top candidates overall
  const top = candidates
    .sort((a, b) => b.ats_score - a.ats_score)
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.parsed.name ?? c.file_name,
      score: c.ats_score,
      status: c.status,
      job_id: c.job_id,
    }));

  return NextResponse.json({
    totals: {
      jobs: jobCount,
      resumes: totals.total ?? 0,
      shortlisted: totals.shortlisted ?? 0,
      rejected: totals.rejected ?? 0,
      avg_score: totals.avg_score ? Math.round(totals.avg_score * 10) / 10 : 0,
    },
    skills,
    experience: Object.entries(expBuckets).map(([range, count]) => ({ range, count })),
    scores: scoreBins,
    education,
    top,
  });
}
