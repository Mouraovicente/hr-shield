import { describe, expect, it } from "vitest";
import { createLlmAdapters } from "../../src/infrastructure/llm-factory.js";

describe("infrastructure/llm-factory", () => {
  it("usa o fake llm por padrao (sem LLM definido)", async () => {
    const { chat, guardian } = createLlmAdapters({});
    await expect(guardian.check("qualquer coisa")).resolves.toEqual({ flagged: false, reason: "passthrough" });
    const outcome = await chat.send([{ role: "user", content: "oi" }], []);
    expect(outcome.type).toBe("final");
  });

  it("usa o fake llm quando LLM=fake", async () => {
    const { guardian } = createLlmAdapters({ LLM: "fake" });
    await expect(guardian.check("x")).resolves.toEqual({ flagged: false, reason: "passthrough" });
  });

  it("exige OPENROUTER_API_KEY quando LLM=openrouter", () => {
    expect(() => createLlmAdapters({ LLM: "openrouter" })).toThrow(/OPENROUTER_API_KEY/);
  });

  it("constroi adaptadores openrouter quando a chave esta presente (sem chamar rede)", () => {
    const { chat, guardian } = createLlmAdapters({ LLM: "openrouter", OPENROUTER_API_KEY: "sk-test" });
    expect(typeof chat.send).toBe("function");
    expect(typeof guardian.check).toBe("function");
  });

  it("lanca erro para um valor de LLM desconhecido", () => {
    expect(() => createLlmAdapters({ LLM: "unknown-provider" })).toThrow(/LLM invalido/);
  });
});
