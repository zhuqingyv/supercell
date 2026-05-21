import { OpenAI } from "openai";

export const openaiServiceCache: Record<string, OpenAI> = {};

export const getService = (_model?: string) => {
  const baseURL = import.meta.env.VITE_OPENAI_BASE_URL?.trim();
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim();
  if (!baseURL || !apiKey) {
    throw new Error("Missing VITE_OPENAI_BASE_URL or VITE_OPENAI_API_KEY");
  }
  const cacheKey = `${baseURL}::${apiKey}`;
  if (openaiServiceCache[cacheKey]) {
    return openaiServiceCache[cacheKey];
  }
  const service = new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true,
  });
  openaiServiceCache[cacheKey] = service;
  return service;
};
