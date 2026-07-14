import { describe, expect, it } from "vitest";
import { createStaticPolicyRepository } from "../../src/infrastructure/policy-repo.js";

describe("infrastructure/policy-repo", () => {
  it("encontra politicas cujo texto contem a palavra-chave buscada", () => {
    const repo = createStaticPolicyRepository();
    const results = repo.search("ferias");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.toLowerCase().includes("ferias") || r.toLowerCase().includes("férias"))).toBe(true);
  });

  it("retorna lista vazia quando nenhuma politica bate com a busca", () => {
    const repo = createStaticPolicyRepository();
    expect(repo.search("assunto-completamente-inexistente-xyz")).toHaveLength(0);
  });

  it("encontra politicas a partir de uma pergunta em linguagem natural (multi-palavra)", () => {
    const repo = createStaticPolicyRepository();
    const results = repo.search("Qual a politica de ferias?");
    expect(results.length).toBeGreaterThan(0);
  });
});
