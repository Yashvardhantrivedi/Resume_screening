import Anthropic from "@anthropic-ai/sdk";
import { ParsedResume, Job } from "./types";
import { parseWithRules } from "./parser";

/**
 * Provider-agnostic LLM layer.
 *
 * Configure via env:
 *   LLM_PROVIDER = groq | openai | anthropic | ollama | custom | none
 *   LLM_API_KEY  = API key (or use the provider-specific vars below)
 *   LLM_MODEL    = model override
 *   LLM_BASE_URL = base URL override (required for "custom")
 *
 * Provider-specific keys also work: GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY.
 * If LLM_PROVIDER is unset, the provider is inferred from whichever key is present.
 * With no provider/key at all, the app falls back to the rule-based engine.
 */

type Provider = "groq" | "openai" | "anthropic" | "ollama" | "custom" | "none";

const DEFAULTS: Record<
  Exclude<Provider, "none">,
  { base: string; model: string; keyEnv: string }
> = {
  groq: {
    base: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    keyEnv: "GROQ_API_KEY",
  },
  openai: {
    base: "https://api.openai.com/v1",
    model: "gpt-5-mini",
    keyEnv: "OPENAI_API_KEY",
  },
  anthropic: {
    base: "", // SDK manages the endpoint
    model: "claude-opus-4-8",
    keyEnv: "ANTHROPIC_API_KEY",
  },
  ollama: {
    base: "http://localhost:11434/v1",
    model: "llama3.2",
    keyEnv: "LLM_API_KEY", // usually not needed for local Ollama
  },
  custom: {
    base: "",
    model: "",
    keyEnv: "LLM_API_KEY",
  },
};

function getProvider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();
  if (p === "none") return "none";
  if (p in DEFAULTS) return p as Provider;
  // Infer from whichever key is set (back-compat with the original Groq-only setup)
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "none";
}

function getConfig() {
  const provider = getProvider();
  if (provider === "none") return null;
  const d = DEFAULTS[provider];
  const apiKey = process.env.LLM_API_KEY || process.env[d.keyEnv] || "";
  const model = process.env.LLM_MODEL || process.env.GROQ_MODEL || d.model;
  const base = process.env.LLM_BASE_URL || d.base;
  // Ollama runs keyless; every remote provider needs a key.
  if (!apiKey && provider !== "ollama" && provider !== "custom") return null;
  if (provider === "custom" && (!base || !model)) return null;
  return { provider, apiKey, model, base };
}

export function llmAvailable(): boolean {
  return getConfig() !== null;
}

export function llmProviderName(): string {
  return getConfig()?.provider ?? "none";
}

/** Pull a JSON object out of a model response, tolerating code fences and prose. */
function extractJSON(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in LLM response");
  return JSON.parse(text.slice(start, end + 1));
}

/** Single entry point: send system+user, get a parsed JSON object back. */
async function chatJSON(system: string, user: string): Promise<unknown> {
  const cfg = getConfig();
  if (!cfg) throw new Error("no LLM provider configured");

  if (cfg.provider === "anthropic") {
    const client = new Anthropic({ apiKey: cfg.apiKey });
    const response = await client.messages.create({
      model: cfg.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") {
      throw new Error("Anthropic request was refused");
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("empty Anthropic response");
    return extractJSON(textBlock.text);
  }

  // OpenAI-compatible chat completions: groq, openai, ollama, custom
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      // Ollama's /v1 shim ignores response_format; harmless to send everywhere.
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`${cfg.provider} API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`empty ${cfg.provider} response`);
  return extractJSON(content);
}

const PARSE_SYSTEM = `You are a resume parsing engine. Extract structured data from resume text.
Respond ONLY with a JSON object matching exactly this shape (use null for unknown scalars, [] for unknown lists):
{
  "name": string|null, "email": string|null, "phone": string|null,
  "linkedin": string|null, "github": string|null,
  "skills": string[],            // normalized lowercase technology/skill names
  "education": [{"degree": string|null, "institution": string|null, "year": number|null, "cgpa": number|null}],
  "experience_years": number,    // total professional experience in years (internships count 0.5x)
  "experience": [{"company": string, "role": string, "duration": string}],
  "projects": [{"name": string, "description": string}],
  "certifications": string[],
  "languages": string[],         // spoken languages
  "summary": string|null         // 1-2 sentence candidate summary you write
}`;

export async function parseResume(
  text: string,
  fileName: string
): Promise<{ parsed: ParsedResume; method: "llm" | "rules" }> {
  const rules = parseWithRules(text, fileName);
  if (!llmAvailable()) return { parsed: rules, method: "rules" };

  try {
    const parsed = (await chatJSON(
      PARSE_SYSTEM,
      `Resume file: ${fileName}\n\n${text.slice(0, 12000)}`
    )) as ParsedResume;
    // Merge: trust the LLM but backfill from rules where it returned nothing.
    return {
      parsed: {
        name: parsed.name ?? rules.name,
        email: parsed.email ?? rules.email,
        phone: parsed.phone ?? rules.phone,
        linkedin: parsed.linkedin ?? rules.linkedin,
        github: parsed.github ?? rules.github,
        skills: parsed.skills?.length ? parsed.skills.map((s) => s.toLowerCase()) : rules.skills,
        education: parsed.education?.length ? parsed.education : rules.education,
        experience_years:
          typeof parsed.experience_years === "number"
            ? parsed.experience_years
            : rules.experience_years,
        experience: parsed.experience ?? [],
        projects: parsed.projects?.length ? parsed.projects : rules.projects,
        certifications: parsed.certifications?.length ? parsed.certifications : rules.certifications,
        languages: parsed.languages ?? [],
        summary: parsed.summary ?? null,
      },
      method: "llm",
    };
  } catch (err) {
    console.error(`LLM parse failed for ${fileName}, using rules:`, err);
    return { parsed: rules, method: "rules" };
  }
}

export interface LlmAssessment {
  project_relevance: number; // 0-10
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export async function assessCandidate(
  job: Job,
  parsed: ParsedResume,
  resumeText: string
): Promise<LlmAssessment | null> {
  if (!llmAvailable()) return null;
  try {
    const a = (await chatJSON(
      `You are an expert technical recruiter. Assess a candidate against a job requirement.
Respond ONLY with JSON: {"project_relevance": number 0-10 (how relevant their projects/experience are to this role),
"strengths": string[] (3-5 short bullet phrases), "weaknesses": string[] (2-4 short bullet phrases),
"suggestions": string[] (2-3 short resume improvement tips)}`,
      `JOB: ${job.title}
Required skills: ${job.required_skills.join(", ")}
Preferred skills: ${job.preferred_skills.join(", ")}
Min experience: ${job.min_experience} years
Description: ${job.description.slice(0, 1500)}

CANDIDATE: ${parsed.name ?? "Unknown"}
Skills: ${parsed.skills.join(", ")}
Experience: ${parsed.experience_years} years
Projects: ${parsed.projects.map((p) => p.name).join("; ")}

RESUME EXCERPT:
${resumeText.slice(0, 6000)}`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any;
    return {
      project_relevance: Math.max(0, Math.min(10, Number(a.project_relevance) || 0)),
      strengths: Array.isArray(a.strengths) ? a.strengths.slice(0, 6) : [],
      weaknesses: Array.isArray(a.weaknesses) ? a.weaknesses.slice(0, 6) : [],
      suggestions: Array.isArray(a.suggestions) ? a.suggestions.slice(0, 5) : [],
    };
  } catch (err) {
    console.error("LLM assessment failed:", err);
    return null;
  }
}
