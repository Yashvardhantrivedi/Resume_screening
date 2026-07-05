export interface Job {
  id: number;
  title: string;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  min_experience: number;
  education: string[];
  min_cgpa: number | null;
  job_type: string;
  employment_type: string;
  location: string;
  mandatory_keywords: string[];
  nice_keywords: string[];
  created_at: string;
  candidate_count?: number;
  shortlisted_count?: number;
}

export interface ParsedResume {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  skills: string[];
  education: {
    degree: string | null;
    institution: string | null;
    year: number | null;
    cgpa: number | null;
  }[];
  experience_years: number;
  experience: { company: string; role: string; duration: string }[];
  projects: { name: string; description: string }[];
  certifications: string[];
  languages: string[];
  summary: string | null;
}

export interface ScoreBreakdown {
  keyword_match: number; // out of 30
  skills_match: number; // out of 25
  experience_match: number; // out of 15
  education_match: number; // out of 10
  project_relevance: number; // out of 10
  structure: number; // out of 5
  formatting: number; // out of 5
  total: number; // out of 100
}

export interface MatchExplanation {
  matched_skills: string[];
  missing_skills: string[];
  matched_keywords: string[];
  missing_keywords: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export type CandidateStatus = "new" | "shortlisted" | "rejected";

export interface Candidate {
  id: number;
  job_id: number;
  file_name: string;
  file_path: string;
  status: CandidateStatus;
  ats_score: number;
  parsed: ParsedResume;
  breakdown: ScoreBreakdown;
  explanation: MatchExplanation;
  parse_method: "llm" | "rules";
  created_at: string;
}
