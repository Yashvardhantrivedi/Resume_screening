"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Candidate } from "@/lib/types";
import { Card, ScoreBadge, StatusBadge, Spinner } from "@/components/ui";

const WEIGHTS: { key: keyof Candidate["breakdown"]; label: string; max: number }[] = [
  { key: "keyword_match", label: "Keyword Match", max: 30 },
  { key: "skills_match", label: "Skills Match", max: 25 },
  { key: "experience_match", label: "Experience Match", max: 15 },
  { key: "education_match", label: "Education Match", max: 10 },
  { key: "project_relevance", label: "Project Relevance", max: 10 },
  { key: "structure", label: "Resume Structure", max: 5 },
  { key: "formatting", label: "Formatting", max: 5 },
];

export default function CandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [c, setC] = useState<Candidate | null>(null);

  const load = () =>
    fetch(`/api/candidates/${id}`).then((r) => r.json()).then(setC);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!c) return <Spinner label="Loading candidate..." />;

  const p = c.parsed;
  const ex = c.explanation;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/jobs/${c.job_id}`} className="text-xs text-slate-400 hover:text-indigo-600">
            ← Back to candidates
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{p.name ?? c.file_name}</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {[p.email, p.phone].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-1 flex gap-3 text-sm">
            {p.linkedin && (
              <a href={p.linkedin.startsWith("http") ? p.linkedin : `https://${p.linkedin}`}
                 target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                LinkedIn
              </a>
            )}
            {p.github && (
              <a href={p.github.startsWith("http") ? p.github : `https://${p.github}`}
                 target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                GitHub
              </a>
            )}
            <a href={`/api/candidates/${c.id}/file`} className="text-indigo-600 hover:underline">
              ⬇ Download resume ({c.file_name})
            </a>
          </div>
          {p.summary && <p className="mt-3 max-w-2xl text-sm italic text-slate-600">“{p.summary}”</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-4xl font-bold text-slate-900">{c.ats_score}</div>
            <div className="text-xs text-slate-400">ATS score / 100</div>
          </div>
          <span
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              c.status === "shortlisted"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {c.status === "shortlisted" ? "✓ Auto-shortlisted (score ≥ 50)" : "✗ Auto-rejected (score < 50)"}
          </span>
          <span className="text-[11px] text-slate-400">
            Parsed via {c.parse_method === "llm" ? "AI (LLM)" : "rule engine"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Score Breakdown">
          <div className="space-y-3">
            {WEIGHTS.map(({ key, label, max }) => {
              const val = Number(c.breakdown[key] ?? 0);
              const pct = (val / max) * 100;
              return (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-medium text-slate-800">
                      {val} / {max}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${
                        pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-rose-400"
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Why this ranking?">
          <div className="space-y-4 text-sm">
            {ex.strengths?.length > 0 && (
              <div>
                <div className="mb-1 font-medium text-emerald-700">Strengths</div>
                <ul className="space-y-1">
                  {ex.strengths.map((s, i) => (
                    <li key={i} className="text-slate-700">✔ {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {ex.weaknesses?.length > 0 && (
              <div>
                <div className="mb-1 font-medium text-rose-700">Gaps</div>
                <ul className="space-y-1">
                  {ex.weaknesses.map((s, i) => (
                    <li key={i} className="text-slate-700">✘ {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {ex.suggestions?.length > 0 && (
              <div>
                <div className="mb-1 font-medium text-slate-700">Resume improvement suggestions</div>
                <ul className="space-y-1">
                  {ex.suggestions.map((s, i) => (
                    <li key={i} className="text-slate-500">💡 {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <Card title={`Skills (${p.skills?.length ?? 0})`}>
          <div className="flex flex-wrap gap-1.5">
            {(p.skills ?? []).map((s) => {
              const matched = (ex.matched_skills ?? []).some(
                (m) => m.toLowerCase() === s.toLowerCase()
              );
              return (
                <span
                  key={s}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    matched
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {s}
                </span>
              );
            })}
            {(!p.skills || p.skills.length === 0) && (
              <span className="text-sm text-slate-400">No skills detected</span>
            )}
          </div>
          {(ex.missing_skills ?? []).length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-1.5 text-xs font-medium text-slate-500">
                Missing for this job
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ex.missing_skills.map((s) => (
                  <span key={s} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-600">
                    ✗ {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Profile">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-400">Experience</dt>
              <dd className="text-slate-800">{p.experience_years ?? 0} years</dd>
              {(p.experience ?? []).slice(0, 5).map((e, i) => (
                <dd key={i} className="text-slate-600">
                  • {e.role} @ {e.company} <span className="text-slate-400">({e.duration})</span>
                </dd>
              ))}
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Education</dt>
              {(p.education ?? []).length === 0 && <dd className="text-slate-400">Not detected</dd>}
              {(p.education ?? []).map((e, i) => (
                <dd key={i} className="text-slate-700">
                  {[e.degree, e.institution, e.year, e.cgpa ? `CGPA ${e.cgpa}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              ))}
            </div>
            {(p.projects ?? []).length > 0 && (
              <div>
                <dt className="text-xs uppercase text-slate-400">Projects</dt>
                {p.projects.slice(0, 6).map((pr, i) => (
                  <dd key={i} className="text-slate-700">• {pr.name}</dd>
                ))}
              </div>
            )}
            {(p.certifications ?? []).length > 0 && (
              <div>
                <dt className="text-xs uppercase text-slate-400">Certifications</dt>
                {p.certifications.map((cert, i) => (
                  <dd key={i} className="text-slate-700">• {cert}</dd>
                ))}
              </div>
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
}
