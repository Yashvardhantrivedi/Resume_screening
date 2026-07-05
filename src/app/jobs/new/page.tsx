"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TagInput from "@/components/TagInput";
import { Card } from "@/components/ui";

const EDUCATION_OPTIONS = ["B.Tech", "B.E", "BCA", "MCA", "M.Tech", "B.Sc", "M.Sc", "MBA", "PhD"];
const JOB_TYPES = ["Onsite", "Hybrid", "Remote", "Internship", "Freelancer", "Contract"];
const EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Internship"];

export default function NewJobPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [preferredSkills, setPreferredSkills] = useState<string[]>([]);
  const [minExperience, setMinExperience] = useState("0");
  const [education, setEducation] = useState<string[]>([]);
  const [minCgpa, setMinCgpa] = useState("");
  const [jobType, setJobType] = useState("Onsite");
  const [employmentType, setEmploymentType] = useState("Full Time");
  const [location, setLocation] = useState("");
  const [mandatoryKeywords, setMandatoryKeywords] = useState<string[]>([]);
  const [niceKeywords, setNiceKeywords] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Role title is required.");
    if (requiredSkills.length === 0)
      return setError("Add at least one required skill — scoring depends on it.");
    setSaving(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          required_skills: requiredSkills,
          preferred_skills: preferredSkills,
          min_experience: Number(minExperience),
          education,
          min_cgpa: minCgpa ? Number(minCgpa) : null,
          job_type: jobType,
          employment_type: employmentType,
          location,
          mandatory_keywords: mandatoryKeywords,
          nice_keywords: niceKeywords,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      const job = await res.json();
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
  const labelCls = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create Job Opening</h1>
        <p className="text-sm text-slate-500">
          Define the hiring requirements. Resumes are scored against these criteria.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Card title="Role">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Role Title *</label>
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Software Development Engineer"
              />
            </div>
            <div>
              <label className={labelCls}>Job Description</label>
              <textarea
                className={`${inputCls} h-28 resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Responsibilities, team, tech stack... (used by the AI for project-relevance scoring)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <div>
                <label className={labelCls}>Job Type</label>
                <select className={inputCls} value={jobType} onChange={(e) => setJobType(e.target.value)}>
                  {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Employment Type</label>
                <select className={inputCls} value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                  {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bangalore" />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Skills (25% of ATS score)">
          <div className="space-y-4">
            <TagInput
              label="Required Skills *"
              tags={requiredSkills}
              onChange={setRequiredSkills}
              placeholder="Type a skill and press Enter (e.g. Python, React, AWS)"
              hint="Weighted 3x vs preferred skills. Related tools count (e.g. Express counts for Node.js)."
            />
            <TagInput
              label="Preferred Skills"
              tags={preferredSkills}
              onChange={setPreferredSkills}
              placeholder="Nice-to-have skills (e.g. Kubernetes, Redis)"
            />
          </div>
        </Card>

        <Card title="Experience & Education (25% of ATS score)">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Minimum Experience (years)</label>
              <select className={inputCls} value={minExperience} onChange={(e) => setMinExperience(e.target.value)}>
                {["0", "1", "2", "3", "4", "5"].map((y) => (
                  <option key={y} value={y}>{y === "5" ? "5+" : y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Minimum CGPA (optional)</label>
              <input
                className={inputCls}
                type="number" step="0.1" min="0" max="10"
                value={minCgpa}
                onChange={(e) => setMinCgpa(e.target.value)}
                placeholder="e.g. 7.0"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelCls}>Accepted Degrees (leave empty for any)</label>
            <div className="flex flex-wrap gap-2">
              {EDUCATION_OPTIONS.map((deg) => {
                const active = education.includes(deg);
                return (
                  <button
                    key={deg}
                    type="button"
                    onClick={() =>
                      setEducation(active ? education.filter((d) => d !== deg) : [...education, deg])
                    }
                    className={`rounded-full border px-3 py-1 text-sm ${
                      active
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400"
                    }`}
                  >
                    {deg}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card title="Keywords (30% of ATS score)">
          <div className="space-y-4">
            <TagInput
              label="Mandatory Keywords"
              tags={mandatoryKeywords}
              onChange={setMandatoryKeywords}
              placeholder="Must appear in the resume (e.g. REST API, microservices)"
              hint="Weighted 2x vs nice-to-have. If left empty, required skills are used as keywords."
            />
            <TagInput
              label="Nice-to-Have Keywords"
              tags={niceKeywords}
              onChange={setNiceKeywords}
              placeholder="Bonus keywords (e.g. open source, hackathon)"
            />
          </div>
        </Card>

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Job & Upload Resumes →"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
