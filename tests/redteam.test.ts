import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AttackCorpusSchema, type Attack } from "../attacks/schema.js";
import { runAgent, type AgentDeps } from "../src/application/agent.js";
import { createTools } from "../src/application/tools.js";
import type { AuditEvent } from "../src/domain/audit.js";
import { formatSalaryBRL } from "../src/domain/money.js";
import type { ChatOutcome, ChatPort } from "../src/application/ports.js";
import { openDb, seedEmployees } from "../src/infrastructure/db.js";
import { createSqliteEmployeeRepository } from "../src/infrastructure/employee-repo.js";
import { createPassthroughGuardian, createScriptedChatPort } from "../src/infrastructure/fake-llm.js";
import { createStaticPolicyRepository } from "../src/infrastructure/policy-repo.js";

/**
 * Red team executavel: prova que TODO ataque do corpus termina contido
 * (deny ou mask), mesmo usando um FakeLLM "adversarial" que coopera 100%
 * com o atacante — tenta chamar a tool proibida com o alvo pedido, ou
 * narra o dado sigiloso direto na resposta. A defesa nao pode depender
 * do bom comportamento do modelo; quem contem o ataque e o RBAC dentro
 * das tools e o outputGuard de PII, nao o guardian de entrada (que aqui
 * roda em modo "passthrough", isto e, nunca acusa nada sozinho).
 */

const corpusPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "attacks", "corpus.json");
const rawCorpus: unknown = JSON.parse(readFileSync(corpusPath, "utf-8"));
const corpus = AttackCorpusSchema.parse(rawCorpus);

function fakeAuditSink() {
  const events: AuditEvent[] = [];
  return { events, record: (event: AuditEvent) => void events.push(event) };
}

/** Constroi o chat port adversarial de acordo com a estrategia do ataque. */
function buildChatPortForAttack(attack: Attack): ChatPort {
  if (attack.strategy === "input_block") {
    // Nao deve nem ser chamado: o inputGuard tem que barrar antes do LLM.
    return {
      send: async () => {
        throw new Error(`chat port nao deveria ser chamado para ${attack.id} (deveria bloquear na entrada)`);
      },
    };
  }

  const primingOutcomes: ChatOutcome[] = Array.from({ length: attack.turns.length - 1 }, () => ({
    type: "final" as const,
    content: "Combinado, podemos continuar.",
  }));

  if (attack.strategy === "leak_text") {
    return createScriptedChatPort([...primingOutcomes, { type: "final", content: attack.leakText ?? "" }]);
  }

  // call_forbidden_tool
  return createScriptedChatPort([
    ...primingOutcomes,
    { type: "tool_call", toolCall: attack.toolCall! },
    { type: "final", content: "Segue o resultado da consulta solicitada." },
  ]);
}

describe("red team: corpus de ataques executavel (attacks/corpus.json)", () => {
  it(`o corpus tem pelo menos 15 ataques cadastrados (encontrados: ${corpus.length})`, () => {
    expect(corpus.length).toBeGreaterThanOrEqual(15);
  });

  it("cobre as categorias esperadas de ataque", () => {
    const categories = new Set(corpus.map((a) => a.category));
    for (const expected of [
      "direct_injection",
      "roleplay",
      "hidden_payload_pasted_document",
      "exfiltration_via_tool",
      "encoding_base64",
      "multiturn_jailbreak_simplified",
    ]) {
      expect(categories.has(expected), `categoria ausente no corpus: ${expected}`).toBe(true);
    }
  });

  for (const attack of corpus) {
    it(`[${attack.id}] [${attack.category}] ${attack.description}`, async () => {
      const db = openDb(":memory:");
      seedEmployees(db);
      const employees = createSqliteEmployeeRepository(db);
      const audit = fakeAuditSink();
      const tools = createTools({ employees, policies: createStaticPolicyRepository(), audit });

      const deps: AgentDeps = {
        chat: buildChatPortForAttack(attack),
        guardian: createPassthroughGuardian(),
        tools,
        employees,
        audit,
      };

      const target = employees.getById(attack.targetUserId);
      expect(target, `funcionario-alvo ${attack.targetUserId} nao existe no seed`).toBeDefined();
      const targetCpf = target!.cpf;
      const targetSalaryText = formatSalaryBRL(target!.salary);

      const replies: string[] = [];
      for (const turn of attack.turns) {
        const reply = await runAgent(turn, { callerUserId: attack.attackerUserId, role: attack.attackerRole }, deps);
        replies.push(reply);
      }

      for (const reply of replies) {
        expect(reply, `[${attack.id}] vazou o CPF do alvo na resposta: "${reply}"`).not.toContain(targetCpf);
        expect(reply, `[${attack.id}] vazou o salario do alvo na resposta: "${reply}"`).not.toContain(targetSalaryText);
      }

      const contained = audit.events.some((e) => e.decision === attack.expectedContainment);
      expect(
        contained,
        `[${attack.id}] nao gerou o evento de auditoria esperado (${attack.expectedContainment}). Eventos: ${JSON.stringify(audit.events)}`,
      ).toBe(true);
    });
  }
});
