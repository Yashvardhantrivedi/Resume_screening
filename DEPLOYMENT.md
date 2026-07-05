# ResumeRank — Deployment Guide

This guide is for anyone receiving this application and running it on their own machine or server. No source-code knowledge is required for Option A or B.

## Requirements

- Docker (Desktop or Engine) — https://docs.docker.com/get-docker/
- An API key from ONE of the supported AI providers (optional — see [AI provider configuration](#ai-provider-configuration))

---

## Option A: Run from a Docker image file (offline handover)

The sender exports the image once:

```bash
docker build -t resumerank .
docker save resumerank | gzip > resumerank.tar.gz     # ~200 MB, share this file
```

The receiver loads and runs it:

```bash
docker load < resumerank.tar.gz

docker run -d --name resumerank \
  -p 3000:3000 \
  -v resumerank_data:/app/data \
  -e LLM_PROVIDER=groq \
  -e GROQ_API_KEY=your_key_here \
  resumerank
```

Open **http://localhost:3000**. Done.

- All data (jobs, candidates, uploaded resumes) persists in the `resumerank_data` Docker volume — restarting or updating the container never loses data.
- To use a different port, change `-p 3000:3000` to e.g. `-p 8080:3000` and open http://localhost:8080.

## Option B: Run from source with Docker Compose

If you received the source code folder instead of an image:

```bash
cp .env.example .env.local   # then edit .env.local and add your API key
docker compose up -d --build
```

Open **http://localhost:3000**.

Daily commands:

```bash
docker compose ps        # status
docker compose logs -f   # logs
docker compose down      # stop (data is kept)
docker compose up -d     # start again
```

## Option C: Publish to a registry (for teams)

```bash
docker tag resumerank yourcompany/resumerank:1.0
docker push yourcompany/resumerank:1.0
# recipients: docker run -d -p 3000:3000 -v resumerank_data:/app/data \
#   -e GROQ_API_KEY=... yourcompany/resumerank:1.0
```

---

## AI provider configuration

The app uses an LLM to parse resumes and explain rankings. **Any one** of these providers works — pick whichever your company already uses. Without any key, the app still runs using a built-in rule engine (less accurate on messy PDFs, no AI-written explanations).

Set these as `-e` flags (`docker run`) or in `.env.local` (compose):

| Provider | Required variables | Default model |
|---|---|---|
| **Groq** (free tier) | `LLM_PROVIDER=groq`, `GROQ_API_KEY=gsk_...` | `llama-3.3-70b-versatile` |
| **OpenAI** | `LLM_PROVIDER=openai`, `OPENAI_API_KEY=sk-...` | `gpt-5-mini` |
| **Anthropic Claude** | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=sk-ant-...` | `claude-opus-4-8` |
| **Ollama** (local Llama, free, no key) | `LLM_PROVIDER=ollama`, `LLM_BASE_URL=http://host.docker.internal:11434/v1` | `llama3.2` |
| **Any OpenAI-compatible API** | `LLM_PROVIDER=custom`, `LLM_BASE_URL=...`, `LLM_API_KEY=...`, `LLM_MODEL=...` | — |

Extra options for every provider:

| Variable | Purpose | Example |
|---|---|---|
| `LLM_MODEL` | Override the default model | `claude-haiku-4-5` (cheaper for high volume), `llama-3.1-8b-instant` |
| `LLM_API_KEY` | Generic key slot, used when the provider-specific variable is empty | — |

Notes:

- `LLM_PROVIDER` can be omitted — the app auto-detects the provider from whichever key is set.
- If the AI call ever fails (bad key, rate limit, network), the app automatically falls back to the rule engine for that resume — uploads never break.
- **Ollama from inside Docker:** the container cannot see `localhost` of the host machine; use `http://host.docker.internal:11434/v1` as shown. On Linux add `--add-host=host.docker.internal:host-gateway` to the `docker run` command.
- Changing providers later: just change the env vars and restart (`docker compose up -d` or `docker restart resumerank`). No rebuild needed — keys are read at runtime, never baked into the image.

## How it works (1-minute overview)

1. HR creates a job opening with required skills, experience, education, and keywords.
2. Resumes (PDF/DOCX/TXT) are bulk-uploaded; duplicates are auto-detected by content hash.
3. Each resume is parsed (by the configured LLM, or the rule engine) and scored 0–100: keywords 30%, skills 25%, experience 15%, education 10%, projects 10%, structure 5%, formatting 5%.
4. **Automatic decision:** score ≥ 50 → Shortlisted, below 50 → Rejected.
5. Ranked candidates can be filtered, searched, exported to CSV (all / shortlisted / rejected), and inspected individually with a full score breakdown and AI explanations.

## Data & backup

- Everything lives in the Docker volume (`resumerank_data` / `hr_data`): SQLite database + original resume files.
- Backup: `docker run --rm -v resumerank_data:/data -v $(pwd):/backup alpine tar czf /backup/resumerank-backup.tar.gz /data`
- The AI provider only receives resume text for parsing; all files and results stay on your server.
