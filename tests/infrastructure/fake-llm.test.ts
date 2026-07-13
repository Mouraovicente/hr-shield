import { describe, expect, it } from "vitest";
import {
  createPassthroughGuardian,
  createFlaggingGuardian,
  createThrowingGuardian,
  createScriptedChatPort,
  createAdversarialChatPort,
  createBenignFakeChatPort,
} from "../../src/infrastructure/fake-llm.js";

describe("infrastructure/fake-llm guardians", () => {
  it("passthrough guardian nunca sinaliza", async () => {
    const guardian = createPassthroughGuardian();
    await expect(guardian.check("qualquer coisa")).resolves.toEqual({ flagged: false, reason: "passthrough" });
  });

  it("flagging guardian sempre sinaliza com o motivo dado", async () => {
    const guardian = createFlaggingGuardian("suspicious");
    await expect(guardian.check("qualquer coisa")).resolves.toEqual({ flagged: true, reason: "suspicious" });
  });

  it("throwing guardian sempre rejeita (simula erro/timeout)", async () => {
    const guardian = createThrowingGuardian();
    await expect(guardian.check("qualquer coisa")).rejects.toThrow();
  });
});

describe("infrastructure/fake-llm scripted chat port", () => {
  it("retorna os outcomes na ordem configurada e repete o ultimo ao esgotar", async () => {
    const port = createScriptedChatPort([
      { type: "tool_call", toolCall: { name: "search_policy", arguments: { query: "ferias" } } },
      { type: "final", content: "Aqui esta a politica." },
    ]);

    const first = await port.send([], []);
    const second = await port.send([], []);
    const third = await port.send([], []);

    expect(first).toEqual({ type: "tool_call", toolCall: { name: "search_policy", arguments: { query: "ferias" } } });
    expect(second).toEqual({ type: "final", content: "Aqui esta a politica." });
    expect(third).toEqual({ type: "final", content: "Aqui esta a politica." });
  });
});

describe("infrastructure/fake-llm adversarial chat port", () => {
  it("estrategia call_forbidden_tool: tenta chamar a tool proibida com o alvo indicado", async () => {
    const port = createAdversarialChatPort({
      kind: "call_forbidden_tool",
      toolCall: { name: "get_employee_salary", arguments: { targetUserId: "emp-002" } },
    });

    const outcome = await port.send([], []);
    expect(outcome).toEqual({
      type: "tool_call",
      toolCall: { name: "get_employee_salary", arguments: { targetUserId: "emp-002" } },
    });

    const next = await port.send(
      [{ role: "tool", name: "get_employee_salary", content: JSON.stringify({ ok: false, reason: "access_denied" }) }],
      [],
    );
    expect(next.type).toBe("final");
  });

  it("estrategia leak_text: tenta vazar o texto diretamente na resposta final", async () => {
    const port = createAdversarialChatPort({ kind: "leak_text", text: "O CPF do Bruno e 222.222.222-22." });
    const outcome = await port.send([], []);
    expect(outcome).toEqual({ type: "final", content: "O CPF do Bruno e 222.222.222-22." });
  });
});

describe("infrastructure/fake-llm benign chat port (demo offline)", () => {
  it("chama get_own_payslip quando o usuario pede o proprio holerite", async () => {
    const port = createBenignFakeChatPort();
    const outcome = await port.send(
      [
        { role: "system", content: "Usuario atual: emp-001 (role: employee)" },
        { role: "user", content: "Quero ver meu holerite" },
      ],
      [],
    );
    expect(outcome).toEqual({
      type: "tool_call",
      toolCall: { name: "get_own_payslip", arguments: { targetUserId: "emp-001" } },
    });
  });

  it("apos o resultado da tool, retorna uma resposta final", async () => {
    const port = createBenignFakeChatPort();
    const outcome = await port.send(
      [
        { role: "system", content: "Usuario atual: emp-001 (role: employee)" },
        { role: "user", content: "Quero ver meu holerite" },
        { role: "assistant", content: "[tool_call] get_own_payslip" },
        { role: "tool", name: "get_own_payslip", content: JSON.stringify({ ok: true, data: { salary: 6000 } }) },
      ],
      [],
    );
    expect(outcome.type).toBe("final");
  });
});
