import { NextRequest, NextResponse } from "next/server";
import { setSetting, deleteSetting } from "@/lib/db";
import { llmConfigSummary } from "@/lib/llm";

export const runtime = "nodejs";

const PROVIDERS = ["groq", "openai", "anthropic", "ollama", "custom", "none"];

export async function GET() {
  return NextResponse.json(llmConfigSummary());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const provider = String(body.provider ?? "").toLowerCase();
  if (!PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  setSetting("llm_provider", provider);

  // Empty key field means "keep the existing key"; provider none clears everything.
  if (provider === "none") {
    deleteSetting("llm_api_key");
    deleteSetting("llm_model");
    deleteSetting("llm_base_url");
  } else {
    if (typeof body.api_key === "string" && body.api_key.trim()) {
      setSetting("llm_api_key", body.api_key.trim());
    }
    if (typeof body.model === "string") {
      if (body.model.trim()) setSetting("llm_model", body.model.trim());
      else deleteSetting("llm_model");
    }
    if (typeof body.base_url === "string") {
      if (body.base_url.trim()) setSetting("llm_base_url", body.base_url.trim());
      else deleteSetting("llm_base_url");
    }
  }

  return NextResponse.json(llmConfigSummary());
}
