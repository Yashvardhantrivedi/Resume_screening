"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { Job, Candidate } from "@/lib/types";
import { Card, ScoreBadge, StatusBadge, Spinner } from "@/components/ui";

interface UploadSummary {
  processed: number;
  failed: number;
  llm_used: boolean;
  results: { file: string; ok: boolean; error?: string; duplicate?: boolean }[];
}

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);

  // filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("");
  const [minExp, setMinExp] = useState("");

  const loadCandidates = useCallback(() => {
    const qs = new URLSearchParams();
    if (statusFilter !== "all") qs.set("status", statusFilter);
    if (search) qs.set("q", search);
    if (minScore) qs.set("min_score", minScore);
    if (minExp) qs.set("min_exp", minExp);
    fetch(`/api/jobs/${id}/candidates?${qs}`)
      .then((r) => r.json())
      .then(setCandidates);
  }, [id, statusFilter, search, minScore, minExp]);

  useEffect(() => {
    fetch(`/api/jobs/${id}`).then((r) => r.json()).then(setJob);
  }, [id]);

  useEffect(() => {
    const t = setTimeout(loadCandidates, 250);
    return () => clearTimeout(t);
  }, [loadCandidates]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      setUploading(true);
      setSummary(null);
      setUploadNote(`Processing ${accepted.length} resume(s)... parsing, scoring, ranking`);
      try {
        // Upload in batches of 20 so one huge request doesn't time out.
        const BATCH = 20;
        const totals: UploadSummary = { processed: 0, failed: 0, llm_used: false, results: [] };
        for (let i = 0; i < accepted.length; i += BATCH) {
          const form = new FormData();
          for (const f of accepted.slice(i, i + BATCH)) form.append("files", f);
          setUploadNote(
            `Processing ${Math.min(i + BATCH, accepted.length)} / ${accepted.length} resumes...`
          );
          const res = await fetch(`/api/jobs/${id}/upload`, { method: "POST", body: form });
          const data: UploadSummary = await res.json();
          if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? "Upload failed");
          totals.processed += data.processed;
          totals.failed += data.failed;
          totals.llm_used = data.llm_used;
          totals.results.push(...data.results);
          loadCandidates();
        }
        setSummary(totals);
      } catch (err) {
        setSummary({
          processed: 0, failed: accepted.length, llm_used: false,
          results: [{ file: "upload", ok: false, error: err instanceof Error ? err.message : String(err) }],
        });
      } finally {
        setUploading(false);
        setUploadNote(null);
        loadCandidates();
      }
    },
    [id, loadCandidates]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    disabled: uploading,
  });

  if (!job) return <Spinner label="Loading job..." />;

  const failures = summary?.results.filter((r) => !r.ok) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/jobs" className="text-xs text-slate-400 hover:text-indigo-600">
            ← All jobs
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
          <p className="text-sm text-slate-500">
            {job.job_type} · {job.employment_type}
            {job.location ? ` · ${job.location}` : ""} · min {job.min_experience} yrs
            {job.min_cgpa ? ` · CGPA ${job.min_cgpa}+` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.required_skills.map((s) => (
              <span key={s} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                {s}
              </span>
            ))}
            {job.preferred_skills.map((s) => (
              <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {s} (preferred)
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href={`/api/jobs/${id}/export?status=shortlisted`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            ⬇ Shortlisted CSV
          </a>
          <a
            href={`/api/jobs/${id}/export?status=rejected`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            ⬇ Rejected CSV
          </a>
          <a
            href={`/api/jobs/${id}/export`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            ⬇ All CSV
          </a>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          isDragActive
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-300 bg-white hover:border-indigo-400"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex justify-center"><Spinner label={uploadNote ?? "Processing..."} /></div>
        ) : (
          <>
            <div className="text-3xl">📥</div>
            <p className="mt-2 font-medium text-slate-700">
              Drag & drop resumes here, or click to select
            </p>
            <p className="mt-1 text-xs text-slate-400">
              PDF, DOCX or TXT · bulk upload supported · duplicates auto-detected
            </p>
            <p className="mt-2 text-xs font-medium text-indigo-600">
              ⚡ Automatic decision: ATS score ≥ 50 → Shortlisted · below 50 → Rejected
            </p>
          </>
        )}
      </div>

      {summary && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            summary.failed > 0
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          Processed {summary.processed} resume(s)
          {summary.failed > 0 && `, ${summary.failed} failed/skipped`}.{" "}
          {summary.llm_used
            ? "AI parsing was used."
            : "Rule-based parsing was used — configure an AI provider in .env.local for AI parsing."}
          {failures.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {failures.slice(0, 8).map((f, i) => (
                <li key={i}>
                  {f.file}: {f.error}
                </li>
              ))}
              {failures.length > 8 && <li>...and {failures.length - 8} more</li>}
            </ul>
          )}
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search name, skill, email, college..."
            className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any score</option>
            <option value="50">Score ≥ 50</option>
            <option value="65">Score ≥ 65</option>
            <option value="80">Score ≥ 80</option>
          </select>
          <select
            value={minExp}
            onChange={(e) => setMinExp(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any experience</option>
            <option value="1">≥ 1 yr</option>
            <option value="3">≥ 3 yrs</option>
            <option value="5">≥ 5 yrs</option>
          </select>
          <span className="ml-auto text-sm text-slate-400">
            {candidates?.length ?? 0} candidate(s)
          </span>
        </div>

        {!candidates ? (
          <Spinner label="Loading candidates..." />
        ) : candidates.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No candidates match. Upload resumes above to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                  <th className="pb-2 pr-2">Rank</th>
                  <th className="pb-2 pr-2">Candidate</th>
                  <th className="pb-2 pr-2">ATS</th>
                  <th className="pb-2 pr-2">Exp</th>
                  <th className="pb-2 pr-2">Matched Skills</th>
                  <th className="pb-2">Decision (auto)</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => (
                  <tr key={c.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50">
                    <td className="py-3 pr-2 font-medium text-slate-400">#{i + 1}</td>
                    <td className="py-3 pr-2">
                      <Link href={`/candidates/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {c.parsed.name ?? c.file_name}
                      </Link>
                      <div className="text-xs text-slate-400">{c.parsed.email ?? c.file_name}</div>
                    </td>
                    <td className="py-3 pr-2"><ScoreBadge score={c.ats_score} /></td>
                    <td className="py-3 pr-2 text-slate-600">{c.parsed.experience_years ?? 0}y</td>
                    <td className="py-3 pr-2">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {(c.explanation.matched_skills ?? []).slice(0, 5).map((s) => (
                          <span key={s} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">
                            ✓ {s}
                          </span>
                        ))}
                        {(c.explanation.missing_skills ?? []).slice(0, 3).map((s) => (
                          <span key={s} className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-600">
                            ✗ {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
