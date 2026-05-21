import OpenAI from "openai";

// ── Types ────────────────────────────────────────────────────────────────────

export type LLMProviderType = "openai" | "ollama";

export interface LLMConfig {
  provider: LLMProviderType;
  /** OpenAI API key (required for "openai" provider) */
  apiKey?: string;
  /** Base URL override. Defaults: OpenAI="https://api.openai.com/v1", Ollama="http://localhost:11434/v1" */
  baseURL?: string;
  /** Model name. Defaults: OpenAI="gpt-4o", Ollama="qwen2.5-coder:7b" */
  model?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Override model for this single call */
  model?: string;
}

export interface CompletionResult {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: Record<LLMProviderType, { baseURL: string; model: string }> = {
  openai: { baseURL: "https://api.openai.com/v1", model: "gpt-4o" },
  ollama: { baseURL: "http://localhost:11434/v1", model: "qwen2.5-coder:7b" },
};

const TIMEOUT_MS = 120_000; // 2 min — local models can be slow

// ── Provider Class ───────────────────────────────────────────────────────────

export class LLMProvider {
  private client: OpenAI;
  private model: string;
  readonly provider: LLMProviderType;

  constructor(config: LLMConfig) {
    const defaults = DEFAULTS[config.provider];
    this.provider = config.provider;
    this.model = config.model || defaults.model;

    const baseURL = config.baseURL || defaults.baseURL;
    const apiKey = config.provider === "ollama" ? "ollama" : config.apiKey;

    if (config.provider === "openai" && !apiKey) {
      throw new Error("OpenAI provider requires an API key");
    }

    this.client = new OpenAI({ baseURL, apiKey });
  }

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    const model = opts.model || this.model;

    const response = await this.client.chat.completions.create(
      {
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 4096,
      },
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );

    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? "",
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  /** Quick health check — tries a minimal completion */
  async ping(): Promise<boolean> {
    try {
      await this.complete({
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 5,
      });
      return true;
    } catch {
      return false;
    }
  }

  getModel(): string {
    return this.model;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

/** Create provider from env vars or explicit config */
export function createProvider(config?: Partial<LLMConfig>): LLMProvider {
  const provider = config?.provider || (process.env.DATALENS_LLM_PROVIDER as LLMProviderType) || "ollama";
  return new LLMProvider({
    provider,
    apiKey: config?.apiKey || process.env.DATALENS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: config?.baseURL || process.env.DATALENS_LLM_BASE_URL,
    model: config?.model || process.env.DATALENS_LLM_MODEL,
  });
}
