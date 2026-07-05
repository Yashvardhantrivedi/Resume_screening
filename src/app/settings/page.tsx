"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "@/components/ui";

interface Summary {
  provider: string;
  model: string | null;
  base_url: string | null;
  key_hint: string | null;
  source: "ui" | "env";
}

const PROVIDER_INFO: Record<string, { label: string; keyUrl?: string; keyPlaceholder: string; needsBase?: boolean }> = {
  groq: { label: "Groq (free tier available)", keyUrl: "https://console.groq.com/keys", keyPlaceholder: "gsk_..." },
  openai: { label: "OpenAI", keyUrl: "https://platform.openai.com/api-keys", keyPlaceholder: "sk-..." },
  anthropic: { label: "Anthropic Claude", keyUrl: "https://console.anthropic.com/", keyPlaceholder: "sk-ant-..." },
  ollama: { label: "Ollama (local Llama, no key needed)", keyPlaceholder: "(not required)", needsBase: true },
  custom: { label: "Custom (OpenAI-compatible)", keyPlaceholder: "your API key", needsBase: true },
  none: { label: "None — rule-based engine only", keyPlaceholder: "" },
};

export default function SettingsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [provider, setProvider] = useState("groq");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: Summary) => {
        setSummary(s);
        if (s.provider !== "none") setProvider(s.provider);
      });
  }, []);

  async function save() {
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: apiKey, model, base_url: baseUrl }),
      });
      const s = await res.json();
      if (!res.ok) throw new Error(s.error ?? "Save failed");
      setSummary(s);
      setApiKey("");
      setNote({ kind: "ok", text: "Settings saved. New uploads will use this provider." });
    } catch (err) {
      setNote({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setNote(null);
    try {
      const res = await fetch("/api/settings/test", { method: "POST" });
      const r = await res.json();
      if (r.ok) {
        setNote({ kind: "ok", text: `✓ Connected to ${r.provider} (${r.model}) — AI parsing is working.` });
      } else {
        setNote({ kind: "err", text: `✗ ${r.provider}: ${r.error ?? "connection failed"}` });
      }
    } catch (err) {
      setNote({ kind: "err", text: String(err) });
    } finally {
      setTesting(false);
    }
  }

  if (!summary) return <Spinner label="Loading settings..." />;

  const info = PROVIDER_INFO[provider];
  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
  const labelCls = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Connect your own AI provider. Your key is stored only on this device/server, never sent anywhere except your chosen provider.
        </p>
      </div>

      <Card title="Current status">
        <p className="text-sm text-slate-700">
          {summary.provider === "none" ? (
            <>No AI provider configured — resumes are parsed with the built-in rule engine. The app works, but parsing is less accurate on complex PDFs.</>
          ) : (
            <>
              Active provider: <span className="font-semibold capitalize">{summary.provider}</span>
              {summary.model && <> · model <code className="rounded bg-slate-100 px-1">{summary.model}</code></>}
              {summary.key_hint && <> · key <code className="rounded bg-slate-100 px-1">{summary.key_hint}</code></>}
              {" · "}
              <span className="text-slate-400">
                {summary.source === "ui" ? "saved from this page" : "from environment variables"}
              </span>
            </>
          )}
        </p>
      </Card>

      <Card title="AI provider">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Provider</label>
            <select className={inputCls} value={provider} onChange={(e) => { setProvider(e.target.value); setNote(null); }}>
              {Object.entries(PROVIDER_INFO).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {provider !== "none" && provider !== "ollama" && (
            <div>
              <label className={labelCls}>API key</label>
              <input
                className={inputCls}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={summary.key_hint ? `saved (${summary.key_hint}) — type to replace` : info.keyPlaceholder}
              />
              {info.keyUrl && (
                <p className="mt-1 text-xs text-slate-400">
                  Get a key: <a href={info.keyUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{info.keyUrl}</a>
                </p>
              )}
            </div>
          )}

          {provider !== "none" && (
            <div>
              <label className={labelCls}>Model (optional — leave empty for default)</label>
              <input
                className={inputCls}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={summary.model ?? "default"}
              />
            </div>
          )}

          {info.needsBase && (
            <div>
              <label className={labelCls}>Base URL</label>
              <input
                className={inputCls}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={provider === "ollama" ? "http://localhost:11434/v1" : "https://api.example.com/v1"}
              />
            </div>
          )}

          {note && (
            <p
              className={`rounded-lg border px-4 py-2 text-sm ${
                note.kind === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {note.text}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
            <button
              onClick={testConnection}
              disabled={testing}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test connection"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
