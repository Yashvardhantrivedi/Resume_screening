import { ParsedResume } from "./types";

// Common tech skills dictionary for rule-based extraction.
const SKILL_DICT = [
  "python", "java", "javascript", "typescript", "c++", "c#", "go", "golang",
  "rust", "ruby", "php", "swift", "kotlin", "scala", "r", "matlab",
  "react", "next.js", "nextjs", "angular", "vue", "svelte", "redux",
  "node.js", "nodejs", "express", "express.js", "django", "flask", "fastapi",
  "spring", "spring boot", "rails", "laravel", ".net", "asp.net",
  "html", "css", "tailwind", "sass", "bootstrap",
  "sql", "mysql", "postgresql", "postgres", "mongodb", "redis", "sqlite",
  "oracle", "dynamodb", "cassandra", "elasticsearch", "firebase", "supabase",
  "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s",
  "terraform", "jenkins", "ci/cd", "git", "github", "gitlab", "linux",
  "rest api", "rest", "graphql", "grpc", "websocket", "microservices",
  "machine learning", "deep learning", "nlp", "computer vision",
  "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy",
  "data analysis", "data science", "power bi", "tableau", "excel",
  "kafka", "rabbitmq", "spark", "hadoop", "airflow",
  "figma", "jira", "agile", "scrum", "selenium", "cypress", "jest",
  "react native", "flutter", "android", "ios",
];

// Aliases for semantic-ish matching: each group is treated as related.
const ALIAS_GROUPS: string[][] = [
  ["node.js", "nodejs", "node", "express", "express.js"],
  ["next.js", "nextjs", "react"],
  ["postgresql", "postgres", "sql"],
  ["mysql", "sql"],
  ["golang", "go"],
  ["kubernetes", "k8s"],
  ["google cloud", "gcp"],
  ["rest api", "rest", "restful"],
  ["machine learning", "ml"],
  ["javascript", "js"],
  ["typescript", "ts"],
  ["scikit-learn", "sklearn"],
];

export function normalizeSkill(s: string): string {
  return s.trim().toLowerCase();
}

/** Returns true if candidate skill list covers the wanted skill (exact or alias). */
export function skillCovered(wanted: string, have: Set<string>): boolean {
  const w = normalizeSkill(wanted);
  if (have.has(w)) return true;
  for (const group of ALIAS_GROUPS) {
    if (group.includes(w)) {
      if (group.some((g) => have.has(g))) return true;
    }
  }
  // substring tolerance, e.g. "aws" matches "aws lambda"
  for (const h of have) {
    if (h.includes(w) || w.includes(h)) {
      if (Math.min(h.length, w.length) >= 3) return true;
    }
  }
  return false;
}

const DEGREE_PATTERNS: [RegExp, string][] = [
  [/\bb\.?\s?tech\b|\bbachelor of technology\b/i, "B.Tech"],
  [/\bm\.?\s?tech\b|\bmaster of technology\b/i, "M.Tech"],
  [/\bbca\b/i, "BCA"],
  [/\bmca\b/i, "MCA"],
  [/\bb\.?\s?sc\b|\bbachelor of science\b/i, "B.Sc"],
  [/\bm\.?\s?sc\b|\bmaster of science\b/i, "M.Sc"],
  [/\bmba\b/i, "MBA"],
  [/\bb\.?\s?e\b\.?|\bbachelor of engineering\b/i, "B.E"],
  [/\bph\.?d\b/i, "PhD"],
];

export function parseWithRules(text: string, fileName: string): ParsedResume {
  const lower = text.toLowerCase();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? null;
  const phone =
    text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)?\d{3}[-.\s]?\d{4,5}/)?.[0]?.trim() ??
    null;
  const linkedin = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,)]+/i)?.[0] ?? null;
  const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s|,)]+/i)?.[0] ?? null;

  // Name heuristic: first short line without digits/@ that isn't a section header.
  const headerWords = /resume|curriculum|vitae|profile|summary|objective|contact|email|phone/i;
  let name: string | null = null;
  for (const line of lines.slice(0, 8)) {
    if (line.length > 2 && line.length < 45 && !/[@0-9]/.test(line) && !headerWords.test(line)) {
      name = line.replace(/[^a-zA-Z .'-]/g, "").trim();
      if (name.split(" ").length <= 5 && name.length > 2) break;
      name = null;
    }
  }
  if (!name) {
    name = fileName.replace(/\.(pdf|docx?|txt)$/i, "").replace(/[_-]+/g, " ").trim();
  }

  const skills: string[] = [];
  for (const skill of SKILL_DICT) {
    const esc = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, "i");
    if (re.test(lower)) skills.push(skill);
  }

  const education: ParsedResume["education"] = [];
  for (const [re, degree] of DEGREE_PATTERNS) {
    if (re.test(text)) {
      const cgpaMatch = text.match(/(?:cgpa|gpa)[:\s]*([0-9]{1,2}(?:\.[0-9]{1,2})?)/i);
      const yearMatch = text.match(/\b(20[0-3][0-9]|19[89][0-9])\b/);
      education.push({
        degree,
        institution: null,
        year: yearMatch ? parseInt(yearMatch[1]) : null,
        cgpa: cgpaMatch ? parseFloat(cgpaMatch[1]) : null,
      });
    }
  }

  // Experience: explicit "X years" mention, else estimate from date ranges.
  let expYears = 0;
  const expMention = text.match(/(\d{1,2}(?:\.\d)?)\s*\+?\s*years?(?:\s+of)?\s+(?:experience|exp)/i);
  if (expMention) {
    expYears = parseFloat(expMention[1]);
  } else {
    const ranges = [...text.matchAll(/\b(20[0-2][0-9])\s*[-–—to]+\s*(20[0-3][0-9]|present|current|now)\b/gi)];
    let months = 0;
    for (const m of ranges) {
      const start = parseInt(m[1]);
      const end = /present|current|now/i.test(m[2]) ? new Date().getFullYear() : parseInt(m[2]);
      if (end >= start && end - start < 40) months += (end - start) * 12;
    }
    expYears = Math.round((months / 12) * 10) / 10;
  }

  const projects: ParsedResume["projects"] = [];
  const projIdx = lines.findIndex((l) => /^projects?\b/i.test(l));
  if (projIdx >= 0) {
    for (const line of lines.slice(projIdx + 1, projIdx + 12)) {
      if (/^(experience|education|skills|certifications|achievements)\b/i.test(line)) break;
      if (line.length > 8 && projects.length < 6) {
        projects.push({ name: line.slice(0, 60), description: line });
      }
    }
  }

  const certifications = lines
    .filter((l) => /certifi(ed|cate|cation)/i.test(l) && l.length < 120)
    .slice(0, 6);

  return {
    name, email, phone, linkedin, github,
    skills,
    education,
    experience_years: expYears,
    experience: [],
    projects,
    certifications,
    languages: [],
    summary: null,
  };
}
