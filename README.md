# ResumeRank — AI HR Resume Screening (MVP)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Local-first resume screening app: create a job opening, bulk-upload resumes (PDF/DOCX/TXT), and get every candidate parsed, ATS-scored, ranked, and explained.

## Quick start

```bash
npm install
cp .env.example .env.local   # paste your Groq API key (optional but recommended)
npm run dev                  # http://localhost:3000
```

No external services needed — data lives in `data/hr_evaluator.db` (SQLite) and uploaded files in `data/uploads/`.

## AI parsing (multi-provider)

Configure any one provider in `.env.local`: **Groq**, **OpenAI**, **Anthropic Claude**, **Ollama** (local Llama), or any OpenAI-compatible API — see [.env.example](.env.example) and [DEPLOYMENT.md](DEPLOYMENT.md) for all options. Without a key, a deterministic rule engine (regex + skill dictionary) is used — everything still works, explanations are just less nuanced.

Docker deployment and handover instructions (image export, env configuration, backups): [DEPLOYMENT.md](DEPLOYMENT.md).

## ATS scoring (out of 100)

| Component | Weight |
|---|---|
| Keyword match (mandatory 2x nice-to-have) | 30 |
| Skills match (required 3x preferred, alias-aware: Express ≈ Node.js) | 25 |
| Experience vs minimum | 15 |
| Education (degree 7 + CGPA 3) | 10 |
| Project relevance (LLM-judged when available) | 10 |
| Resume structure (sections, contact info) | 5 |
| Formatting (length, bullets) | 5 |

## Features

- Job openings with required/preferred skills, experience, degrees, CGPA, keywords
- Drag-and-drop bulk upload, batched processing, duplicate detection (content hash)
- Candidate ranking table with search + filters (status, score, experience)
- Per-candidate detail: score breakdown bars, strengths/gaps/suggestions, parsed profile, resume download
- Dashboard: totals, skill pie, experience bars, score histogram, education chart, top candidates
- CSV export (all or shortlisted only)

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · better-sqlite3 · pdf-parse · mammoth · Recharts

## Contributing

Issues and pull requests are welcome. To develop locally: `npm install`, `cp .env.example .env.local` (add an API key from any supported provider, or leave empty for rule-based mode), `npm run dev`.

## License

[MIT](LICENSE) — free to use, modify, and distribute with attribution.
