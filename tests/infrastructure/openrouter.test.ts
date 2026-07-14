import { describe, expect, it } from "vitest";
import { createOpenRouterChatPort, createOpenRouterGuardian } from "../../src/infrastructure/openrouter.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  } as Response;
}

describe("infrastructure/openrouter chat port (fetch mockado, sem rede real)", () => {
  it("envia mensagens/tools no formato openai e retorna tool_call quando o modelo pede uma", async () => {
    let capturedBody: any;
    const fetchImpl = async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return jsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [{ function: { name: "search_policy", arguments: '{"query":"ferias"}' } }],
            },
          },
        ],
      });
    };

    const port = createOpenRouterChatPort({
      apiKey: "test-key",
      chatModel: "test-model",
      guardianModel: "test-model",
      guardianTimeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const outcome = await port.send(
      [{ role: "user", content: "busca a politica de ferias" }],
      [{ name: "search_policy", description: "busca politicas" }],
    );

    expect(outcome).toEqual({ type: "tool_call", toolCall: { name: "search_policy", arguments: { query: "ferias" } } });
    expect(capturedBody.model).toBe("test-model");
    expect(capturedBody.messages[0]).toEqual({ role: "user", content: "busca a politica de ferias" });
  });

  it("retorna texto final quando o modelo nao chama nenhuma tool", async () => {
    const fetchImpl = async () => jsonResponse({ choices: [{ message: { content: "Resposta final." } }] });

    const port = createOpenRouterChatPort({
      apiKey: "test-key",
      chatModel: "test-model",
      guardianModel: "test-model",
      guardianTimeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const outcome = await port.send([{ role: "user", content: "oi" }], []);
    expect(outcome).toEqual({ type: "final", content: "Resposta final." });
  });

  it("lanca erro quando a resposta http nao e ok", async () => {
    const fetchImpl = async () => jsonResponse({}, false, 500);

    const port = createOpenRouterChatPort({
      apiKey: "test-key",
      chatModel: "test-model",
      guardianModel: "test-model",
      guardianTimeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(port.send([], [])).rejects.toThrow();
  });
});

describe("infrastructure/openrouter guardian (fetch mockado, sem rede real)", () => {
  it("interpreta o veredito json retornado pelo modelo guardian", async () => {
    const fetchImpl = async () =>
      jsonResponse({ choices: [{ message: { content: '{"flagged":true,"reason":"prompt_injection"}' } }] });

    const guardian = createOpenRouterGuardian({
      apiKey: "test-key",
      chatModel: "test-model",
      guardianModel: "test-model",
      guardianTimeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(guardian.check("mensagem suspeita")).resolves.toEqual({ flagged: true, reason: "prompt_injection" });
  });

  it("propaga erro (para fail-closed) quando a resposta nao e json valido", async () => {
    const fetchImpl = async () => jsonResponse({ choices: [{ message: { content: "isso nao e json" } }] });

    const guardian = createOpenRouterGuardian({
      apiKey: "test-key",
      chatModel: "test-model",
      guardianModel: "test-model",
      guardianTimeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(guardian.check("mensagem qualquer")).rejects.toThrow();
  });
});
