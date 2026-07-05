import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToJob, UPLOADS_DIR } from "@/lib/db";
import { extractText } from "@/lib/extract";
import { parseResume, assessCandidate, llmAvailable } from "@/lib/llm";
import { scoreCandidate, SHORTLIST_THRESHOLD } from "@/lib/scoring";
import { Job } from "@/lib/types";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

interface FileResult {
  file: string;
  ok: boolean;
  candidate_id?: number;
  score?: number;
  status?: string;
  duplicate?: boolean;
  error?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const jobRow = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!jobRow) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const job = rowToJob(jobRow) as Job;

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const jobDir = path.join(UPLOADS_DIR, String(job.id));
  await fs.mkdir(jobDir, { recursive: true });

  const insert = db.prepare(
    `INSERT INTO candidates (job_id, file_name, file_path, status, ats_score, parsed, breakdown, explanation, parse_method, raw_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const useLlm = llmAvailable();
  const results: FileResult[] = [];
  // Process with limited concurrency so LLM calls don't hit rate limits too hard.
  const CONCURRENCY = useLlm ? 4 : 16;
  const queue = [...files];

  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;
      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        // Duplicate detection by content hash within this job.
        const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 24);
        const dup = db
          .prepare("SELECT id FROM candidates WHERE job_id = ? AND file_path LIKE ?")
          .get(job.id, `%${hash}%`);
        if (dup) {
          results.push({ file: file.name, ok: false, duplicate: true, error: "Duplicate resume (identical content already uploaded)" });
          continue;
        }

        const { text, pages } = await extractText(buffer, file.name);
        if (!text.trim()) {
          results.push({ file: file.name, ok: false, error: "No text could be extracted (scanned image PDF?)" });
          continue;
        }

        const safeName = `${hash}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const filePath = path.join(jobDir, safeName);
        await fs.writeFile(filePath, buffer);

        const { parsed, method } = await parseResume(text, file.name);
        const llmAssessment = useLlm ? await assessCandidate(job, parsed, text) : null;
        const { breakdown, explanation } = scoreCandidate(job, parsed, text, pages, llmAssessment);

        // Automated decision: at or above the threshold → shortlisted, below → rejected.
        const status = breakdown.total >= SHORTLIST_THRESHOLD ? "shortlisted" : "rejected";

        const res = insert.run(
          job.id, file.name, filePath, status, breakdown.total,
          JSON.stringify(parsed), JSON.stringify(breakdown), JSON.stringify(explanation),
          method, text.slice(0, 50000)
        );
        results.push({ file: file.name, ok: true, candidate_id: Number(res.lastInsertRowid), score: breakdown.total, status });
      } catch (err) {
        results.push({ file: file.name, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

  return NextResponse.json({
    processed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    llm_used: useLlm,
    results,
  });
}
