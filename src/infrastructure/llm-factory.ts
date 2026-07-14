import type { ChatPort, GuardianPort } from "../application/ports.js";
import { createBenignFakeChatPort, createPassthroughGuardian } from "./fake-llm.js";
import { createOpenRouterChatPort, createOpenRouterGuardian, type OpenRouterConfig } from "./openrouter.js";

/**
 * Escolhe a implementacao de ChatPort/GuardianPort de acordo com a
 * variavel de ambiente LLM ("fake" | "openrouter"). E o unico lugar do
 * projeto que decide isso — cli.ts so chama esta factory.
 */

export interface LlmAdapters {
  chat: ChatPort;
  guardian: GuardianPort;
}

export interface LlmEnv {
  LLM?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_CHAT_MODEL?: string;
  OPENROUTER_GUARDIAN_MODEL?: string;
  GUARDIAN_TIMEOUT_MS?: string;
}

const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_GUARDIAN_TIMEOUT_MS = 8000;

export function createLlmAdapters(env: LlmEnv): LlmAdapters {
  const mode = env.LLM ?? "fake";

  if (mode === "fake") {
    return { chat: createBenignFakeChatPort(), guardian: createPassthroughGuardian() };
  }

  if (mode === "openrouter") {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY e obrigatorio quando LLM=openrouter (veja .env.example).");
    }

    const config: OpenRouterConfig = {
      apiKey: env.OPENROUTER_API_KEY,
      chatModel: env.OPENROUTER_CHAT_MODEL ?? DEFAULT_MODEL,
      guardianModel: env.OPENROUTER_GUARDIAN_MODEL ?? DEFAULT_MODEL,
      guardianTimeoutMs: env.GUARDIAN_TIMEOUT_MS ? Number(env.GUARDIAN_TIMEOUT_MS) : DEFAULT_GUARDIAN_TIMEOUT_MS,
    };

    return { chat: createOpenRouterChatPort(config), guardian: createOpenRouterGuardian(config) };
  }

  throw new Error(`LLM invalido: "${mode}". Use "fake" ou "openrouter".`);
}
