import { NextResponse } from "next/server";
import { testLlm } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const result = await testLlm();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
