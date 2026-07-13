import { detectPii, maskFindings } from "../domain/pii.js";
import type { Role } from "../domain/rbac.js";
import type { GuardianPort } from "./ports.js";

/**
 * Guardrail de ENTRADA — fail-closed.
 *
 * Camada 1 (heuristica): regexes deterministicos e instantaneos que
 * pegam os padroes classicos de prompt injection sem depender de
 * nenhum modelo. Rodam sempre e, se casarem, bloqueiam sem sequer
 * chamar o guardian.
 *
 * Camada 2 (guardian LLM, via port): um segundo modelo classifica a
 * entrada. QUALQUER excecao/timeout desta chamada e tratado como
 * ataque — a mensagem e bloqueada. O sistema nunca "abre" por causa
 * de uma falha de infraestrutura do guardian.
 */

interface Heuristic {
  id: string;
  pattern: RegExp;
}

const HEURISTICS: Heuristic[] = [
  { id: "ignore_instructions_pt", pattern: /ignore\s+(todas\s+)?(as\s+)?instru[cç][oõ]es/i },
  { id: "ignore_instructions_en", pattern: /ignore\s+(all\s+)?(the\s+)?previous\s+instructions/i },
  { id: "disregard_rules_pt", pattern: /desconsidere\s+(as\s+)?(regras|instru[cç][oõ]es)/i },
  { id: "roleplay_admin_pt", pattern: /finja\s+que\s+(voc[eê]\s+)?[eé]/i },
  { id: "roleplay_act_as", pattern: /(aja|atue)\s+como/i },
  { id: "you_are_now", pattern: /you\s+are\s+now/i },
  { id: "fake_system_message", pattern: /system\s*:/i },
  { id: "base64_blob", pattern: /[A-Za-z0-9+/]{100,}={0,2}/ },
];

function heuristicCheck(text: string): { flagged: boolean; id?: string } {
  for (const heuristic of HEURISTICS) {
    if (heuristic.pattern.test(text)) {
      return { flagged: true, id: heuristic.id };
    }
  }
  return { flagged: false };
}

export interface InputGuardResult {
  allowed: boolean;
  reason: string;
}

export async function inputGuard(text: string, guardian: GuardianPort): Promise<InputGuardResult> {
  const heuristic = heuristicCheck(text);
  if (heuristic.flagged) {
    return { allowed: false, reason: `heuristic:${heuristic.id}` };
  }

  try {
    const verdict = await guardian.check(text);
    if (verdict.flagged) {
      return { allowed: false, reason: `guardian_flagged:${verdict.reason}` };
    }
    return { allowed: true, reason: "clean" };
  } catch {
    // Fail-closed: erro ou timeout no guardian NUNCA libera a mensagem.
    return { allowed: false, reason: "guardian_error:fail_closed" };
  }
}

/**
 * Guardrail de SAIDA — impede vazamento de PII de terceiros.
 *
 * Para `role === "hr_admin"`, nada e mascarado (papel autorizado a ver
 * qualquer dado de RH). Para `role === "employee"`, toda ocorrencia de
 * CPF/salario detectada no texto e mascarada, EXCETO os valores que
 * estejam em `ownValues` (os proprios dados do usuario, que ele tem
 * direito de ver, por exemplo no seu holerite).
 */
export interface OutputGuardContext {
  role: Role;
  ownValues: readonly string[];
}

export interface OutputGuardResult {
  text: string;
  masked: boolean;
  maskedValues: string[];
}

export function outputGuard(text: string, ctx: OutputGuardContext): OutputGuardResult {
  if (ctx.role === "hr_admin") {
    return { text, masked: false, maskedValues: [] };
  }

  const ownSet = new Set(ctx.ownValues);
  const findings = detectPii(text).filter((finding) => !ownSet.has(finding.value));

  if (findings.length === 0) {
    return { text, masked: false, maskedValues: [] };
  }

  return {
    text: maskFindings(text, findings),
    masked: true,
    maskedValues: findings.map((f) => f.value),
  };
}
