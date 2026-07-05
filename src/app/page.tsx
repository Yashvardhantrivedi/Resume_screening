"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { StatCard, Card, ScoreBadge, StatusBadge, Spinner } from "@/components/ui";

interface Stats {
  totals: { jobs: number; resumes: number; shortlisted: number; rejected: number; avg_score: number };
  skills: { name: string; count: number }[];
  experience: { range: string; count: number }[];
  scores: { range: string; count: number }[];
  education: { name: string; count: number }[];
  top: { id: number; name: string; score: number; status: string; job_id: number }[];
}

const PIE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#a855f7", "#64748b",
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-rose-600">Failed to load stats: {error}</p>;
  if (!stats) return <Spinner label="Loading dashboard..." />;

  const empty = stats.totals.resumes === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Screening overview across all job openings
          </p>
        </div>
        <Link
          href="/jobs/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Create Job Opening
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Job Openings" value={stats.totals.jobs} icon="💼" />
        <StatCard label="Total Resumes" value={stats.totals.resumes} icon="📄" />
        <StatCard label="Shortlisted" value={stats.totals.shortlisted} icon="✅" />
        <StatCard label="Rejected" value={stats.totals.rejected} icon="❌" />
        <StatCard label="Avg ATS Score" value={stats.totals.avg_score} icon="🎯" sub="out of 100" />
      </div>

      {empty ? (
        <Card>
          <div className="py-10 text-center">
            <div className="text-4xl">📭</div>
            <p className="mt-3 font-medium text-slate-700">No resumes yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create a job opening, then bulk-upload resumes to see analytics here.
            </p>
            <Link
              href="/jobs/new"
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Create your first job
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Skill Distribution (top skills across all resumes)">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.skills}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name }) => name}
                  >
                    {stats.skills.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Experience Distribution (years)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.experience}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="ATS Score Histogram">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.scores}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Education Distribution">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.education} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={90} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title="Top Candidates (all jobs)">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                  <th className="pb-2">#</th>
                  <th className="pb-2">Candidate</th>
                  <th className="pb-2">ATS Score</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {stats.top.map((c, i) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 text-slate-400">{i + 1}</td>
                    <td className="py-2.5 font-medium text-slate-800">{c.name}</td>
                    <td className="py-2.5"><ScoreBadge score={c.score} /></td>
                    <td className="py-2.5"><StatusBadge status={c.status} /></td>
                    <td className="py-2.5 text-right">
                      <Link href={`/candidates/${c.id}`} className="text-indigo-600 hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
