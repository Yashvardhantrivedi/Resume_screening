"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Job } from "@/lib/types";
import { Card, Spinner } from "@/components/ui";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  const load = () =>
    fetch("/api/jobs")
      .then((r) => r.json())
      .then(setJobs);

  useEffect(() => {
    load();
  }, []);

  async function deleteJob(id: number) {
    if (!confirm("Delete this job and all its candidates?")) return;
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    load();
  }

  if (!jobs) return <Spinner label="Loading jobs..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Openings</h1>
          <p className="text-sm text-slate-500">{jobs.length} job opening(s)</p>
        </div>
        <Link
          href="/jobs/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Create Job Opening
        </Link>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-slate-500">
            No jobs yet.{" "}
            <Link href="/jobs/new" className="text-indigo-600 hover:underline">
              Create your first job opening
            </Link>{" "}
            to start screening resumes.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {jobs.map((job) => (
            <Card key={job.id}>
              <div className="flex items-start justify-between">
                <div>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="text-lg font-semibold text-slate-900 hover:text-indigo-600"
                  >
                    {job.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {job.job_type} · {job.employment_type}
                    {job.location ? ` · ${job.location}` : ""} · min{" "}
                    {job.min_experience} yrs
                  </p>
                </div>
                <button
                  onClick={() => deleteJob(job.id)}
                  className="text-xs text-slate-400 hover:text-rose-600"
                  title="Delete job"
                >
                  ✕
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.required_skills.slice(0, 8).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                  >
                    {s}
                  </span>
                ))}
                {job.required_skills.length > 8 && (
                  <span className="text-xs text-slate-400">
                    +{job.required_skills.length - 8} more
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="text-slate-500">
                  📄 {job.candidate_count ?? 0} resumes · ✅{" "}
                  {job.shortlisted_count ?? 0} shortlisted
                </span>
                <Link
                  href={`/jobs/${job.id}`}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Open →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
