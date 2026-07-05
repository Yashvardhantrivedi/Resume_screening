import { Job, ParsedResume, ScoreBreakdown, MatchExplanation } from "./types";
import { normalizeSkill, skillCovered } from "./parser";
import { LlmAssessment } from "./llm";

// Candidates scoring at or above this ATS score are auto-shortlisted; below it, auto-rejected.
export const SHORTLIST_THRESHOLD = 50;

/**
 * ATS scoring per spec weights:
 * keywords 30, skills 25, experience 15, education 10, projects 10, structure 5, formatting 5.
 */
export function scoreCandidate(
  job: Job,
  parsed: ParsedResume,
  text: string,
  pages: number,
  llm: LlmAssessment | null
): { breakdown: ScoreBreakdown; explanation: MatchExplanation } {
  const lower = text.toLowerCase();
  const have = new Set(parsed.skills.map(normalizeSkill));

  // --- Keywords (30): mandatory keywords weigh 2x nice-to-have ---
  const mandatory = job.mandatory_keywords.filter(Boolean);
  const nice = job.nice_keywords.filter(Boolean);
  const matchedKw: string[] = [];
  const missingKw: string[] = [];
  let kwPoints = 0;
  let kwMax = mandatory.length * 2 + nice.length;
  for (const kw of mandatory) {
    if (lower.includes(kw.toLowerCase())) { matchedKw.push(kw); kwPoints += 2; }
    else missingKw.push(kw);
  }
  for (const kw of nice) {
    if (lower.includes(kw.toLowerCase())) { matchedKw.push(kw); kwPoints += 1; }
  }
  if (kwMax === 0) {
    // No keywords defined: fall back to required skills as keywords.
    kwMax = job.required_skills.length || 1;
    kwPoints = job.required_skills.filter((s) => lower.includes(s.toLowerCase())).length;
  }
  const keyword_match = round((kwPoints / kwMax) * 30);

  // --- Skills (25): required weigh 3x preferred, alias-aware ---
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  let skillPoints = 0;
  let skillMax = job.required_skills.length * 3 + job.preferred_skills.length;
  for (const s of job.required_skills) {
    if (skillCovered(s, have)) { matchedSkills.push(s); skillPoints += 3; }
    else missingSkills.push(s);
  }
  for (const s of job.preferred_skills) {
    if (skillCovered(s, have)) { matchedSkills.push(s); skillPoints += 1; }
    else missingSkills.push(s);
  }
  if (skillMax === 0) skillMax = 1;
  const skills_match = round((skillPoints / skillMax) * 25);

  // --- Experience (15): full marks at requirement, partial below ---
  let experience_match: number;
  if (job.min_experience <= 0) {
    experience_match = 15;
  } else {
    experience_match = round(Math.min(parsed.experience_years / job.min_experience, 1) * 15);
  }

  // --- Education (10): degree match 7, CGPA 3 ---
  let eduPts = 0;
  if (job.education.length === 0) {
    eduPts = 7;
  } else {
    const degrees = parsed.education.map((e) => (e.degree ?? "").toLowerCase().replace(/[^a-z]/g, ""));
    const wanted = job.education.map((d) => d.toLowerCase().replace(/[^a-z]/g, ""));
    if (degrees.some((d) => d && wanted.some((w) => d.includes(w) || w.includes(d)))) eduPts = 7;
  }
  const bestCgpa = Math.max(0, ...parsed.education.map((e) => e.cgpa ?? 0));
  if (!job.min_cgpa) eduPts += 3;
  else if (bestCgpa >= job.min_cgpa) eduPts += 3;
  else if (bestCgpa > 0) eduPts += round((bestCgpa / job.min_cgpa) * 3);
  const education_match = round(Math.min(eduPts, 10));

  // --- Projects (10): LLM relevance when available, else heuristic overlap ---
  let project_relevance: number;
  if (llm) {
    project_relevance = round(llm.project_relevance);
  } else {
    const projText = parsed.projects.map((p) => `${p.name} ${p.description}`).join(" ").toLowerCase();
    const relSkills = [...job.required_skills, ...job.preferred_skills];
    const hits = relSkills.filter((s) => projText.includes(s.toLowerCase())).length;
    const base = parsed.projects.length > 0 ? 4 : 0;
    project_relevance = round(Math.min(base + (relSkills.length ? (hits / relSkills.length) * 6 : 3), 10));
  }

  // --- Structure (5): presence of standard sections + contact info ---
  let structure = 0;
  if (/experience|employment|work history/i.test(text)) structure += 1;
  if (/education|academic/i.test(text)) structure += 1;
  if (/skills|technologies|tech stack/i.test(text)) structure += 1;
  if (parsed.email) structure += 1;
  if (parsed.phone) structure += 0.5;
  if (parsed.linkedin || parsed.github) structure += 0.5;
  structure = round(Math.min(structure, 5));

  // --- Formatting (5): sane length, bullets, not a wall of text ---
  let formatting = 5;
  const words = text.split(/\s+/).length;
  if (words < 120) formatting -= 2; // too thin
  if (pages > 3 || words > 2200) formatting -= 1.5; // too long
  if (!/[•·▪\-–*]\s/.test(text)) formatting -= 1; // no bullet points
  const avgLineLen = text.length / Math.max(text.split("\n").length, 1);
  if (avgLineLen > 200) formatting -= 0.5; // wall-of-text extraction
  formatting = round(Math.max(formatting, 0));

  const total = round(
    keyword_match + skills_match + experience_match + education_match +
    project_relevance + structure + formatting
  );

  // --- Explanation ---
  const strengths: string[] = llm?.strengths?.length ? llm.strengths : [];
  const weaknesses: string[] = llm?.weaknesses?.length ? llm.weaknesses : [];
  const suggestions: string[] = llm?.suggestions?.length ? llm.suggestions : [];

  if (!strengths.length) {
    if (matchedSkills.length) strengths.push(`Has ${matchedSkills.slice(0, 6).join(", ")}`);
    if (job.min_experience > 0 && parsed.experience_years >= job.min_experience)
      strengths.push(`${parsed.experience_years} years experience (meets ${job.min_experience}+ requirement)`);
    if (education_match >= 9) strengths.push("Education requirement fully met");
    if (parsed.projects.length >= 2) strengths.push(`${parsed.projects.length} projects listed`);
  }
  if (!weaknesses.length) {
    if (missingSkills.length) weaknesses.push(`Missing: ${missingSkills.slice(0, 6).join(", ")}`);
    if (job.min_experience > 0 && parsed.experience_years < job.min_experience)
      weaknesses.push(`Only ${parsed.experience_years} years experience (needs ${job.min_experience}+)`);
    if (missingKw.length) weaknesses.push(`Missing keywords: ${missingKw.slice(0, 5).join(", ")}`);
  }
  if (!suggestions.length) {
    if (!parsed.github) suggestions.push("Add a GitHub profile link");
    if (!parsed.linkedin) suggestions.push("Add a LinkedIn profile link");
    if (formatting < 4) suggestions.push("Use bullet points and keep the resume to 1-2 pages");
    if (!parsed.summary && structure < 4) suggestions.push("Add a professional summary section");
  }

  return {
    breakdown: {
      keyword_match, skills_match, experience_match, education_match,
      project_relevance, structure, formatting, total,
    },
    explanation: {
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
      matched_keywords: matchedKw,
      missing_keywords: missingKw,
      strengths, weaknesses, suggestions,
    },
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
