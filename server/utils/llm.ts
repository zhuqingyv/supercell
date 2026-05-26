import path from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const BASE_URL =
  process.env.VITE_OPENAI_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  "http://localhost:1234/v1";

const API_KEY =
  process.env.VITE_OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  "lm-studio";

const MODEL =
  process.env.AGENT_MODEL ||
  process.env.VITE_OPENAI_MODEL ||
  "local-model";

let _client: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ baseURL: BASE_URL, apiKey: API_KEY });
  }
  return _client;
}

export interface LLMCallOptions {
  systemPrompt: string;
  userMessage: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/** 60-second hard timeout per LLM request — prevents indefinite hangs */
const LLM_TIMEOUT_MS = 60_000;

/**
 * Single-shot LLM call, returns full response text.
 * Retries up to twice with exponential backoff (2s → 4s) on transient errors.
 */
export async function callLLM(opts: LLMCallOptions): Promise<string> {
  const client = getLLMClient();
  const attempt = async () => {
    const response = await client.chat.completions.create(
      {
        model: opts.model || MODEL,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 4096,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userMessage },
        ],
      },
      { signal: AbortSignal.timeout(LLM_TIMEOUT_MS) }
    );
    return response.choices[0]?.message?.content ?? "";
  };

  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      // Don't retry on explicit timeout — it will time out again
      if (err instanceof Error && err.name === "TimeoutError") throw err;
      if (i < 2) await new Promise((r) => setTimeout(r, 2 ** i * 2000));
    }
  }
  throw lastErr;
}

/**
 * Extract JSON from an LLM response that may include markdown fences.
 * Tries fenced blocks first, then falls back to finding the first valid JSON object in the text.
 */
export function extractJSON<T = unknown>(text: string): T {
  // Try fenced code block first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch {
      // fall through to fallback
    }
  }

  // Fallback: find the first valid JSON object in the text
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) {
    throw new Error(
      `Failed to parse LLM JSON response: no JSON object found.\nRaw (first 500 chars): ${text.slice(0, 500)}`
    );
  }

  for (let end = text.indexOf("}", firstBrace); end !== -1; end = text.indexOf("}", end + 1)) {
    const candidate = text.slice(firstBrace, end + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      continue; // try next closing brace
    }
  }

  throw new Error(
    `Failed to parse LLM JSON response: no valid JSON object found.\nRaw (first 500 chars): ${text.slice(0, 500)}`
  );
}
