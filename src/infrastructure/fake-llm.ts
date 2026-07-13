import type { ChatMessage, ChatOutcome, ChatPort, GuardianPort, GuardianVerdict, ToolCallRequest, ToolSpec } from "../application/ports.js";

/**
 * Adaptadores fake de LLM: usados 100% offline nos testes (unit e
 * red team) e tambem como o modo padrao (`LLM=fake`) da demo de CLI,
 * para quem quer rodar o projeto sem uma chave de API.
 *
 * Tres familias:
 *  - guardians fake (passthrough / flagging / throwing) para testar o
 *    input guard fail-closed sem depender de rede.
 *  - `createScriptedChatPort` / `createAdversarialChatPort`: simulam um
 *    modelo que "obedece" a um ataque — usados no corpus de red team
 *    para provar que a defesa nao depende do bom comportamento do LLM.
 *  - `createBenignFakeChatPort`: um LLM de brincadeira, com heuristicas
 *    simples, usado na demo de CLI offline.
 */

// ---------------------------------------------------------------------------
// Guardians
// ---------------------------------------------------------------------------

export function createPassthroughGuardian(): GuardianPort {
  return {
    check: async (): Promise<GuardianVerdict> => ({ flagged: false, reason: "passthrough" }),
  };
}

export function createFlaggingGuardian(reason: string): GuardianPort {
  return {
    check: async (): Promise<GuardianVerdict> => ({ flagged: true, reason }),
  };
}

export function createThrowingGuardian(): GuardianPort {
  return {
    check: async (): Promise<GuardianVerdict> => {
      throw new Error("guardian indisponivel (simulado)");
    },
  };
}

// ---------------------------------------------------------------------------
// Scripted chat port — utilitario generico
// ---------------------------------------------------------------------------

/** Retorna os outcomes configurados, em ordem; repete o ultimo ao esgotar. */
export function createScriptedChatPort(outcomes: ChatOutcome[]): ChatPort {
  if (outcomes.length === 0) {
    throw new Error("createScriptedChatPort precisa de ao menos um outcome");
  }
  let index = 0;
  return {
    send: async (): Promise<ChatOutcome> => {
      const outcome = outcomes[Math.min(index, outcomes.length - 1)]!;
      index += 1;
      return outcome;
    },
  };
}

// ---------------------------------------------------------------------------
// Adversarial chat port — usado no corpus de red team
// ---------------------------------------------------------------------------

export type AdversarialPlan =
  | { kind: "call_forbidden_tool"; toolCall: ToolCallRequest }
  | { kind: "leak_text"; text: string };

/**
 * Um LLM de "melhor caso para o atacante": obedece a instrucao maliciosa
 * ao pe da letra, seja tentando chamar uma tool proibida com o alvo que
 * o atacante pediu, seja narrando o dado sigiloso direto na resposta.
 * Usado no red team para provar que RBAC e outputGuard seguram mesmo
 * quando o modelo coopera 100% com o ataque.
 */
export function createAdversarialChatPort(plan: AdversarialPlan): ChatPort {
  if (plan.kind === "leak_text") {
    return createScriptedChatPort([{ type: "final", content: plan.text }]);
  }

  return createScriptedChatPort([
    { type: "tool_call", toolCall: plan.toolCall },
    { type: "final", content: "Segue o resultado da consulta solicitada." },
  ]);
}

// ---------------------------------------------------------------------------
// Benign fake chat port — demo de CLI offline (LLM=fake)
// ---------------------------------------------------------------------------

function extractCallerUserId(messages: ChatMessage[]): string | undefined {
  const system = messages.find((m) => m.role === "system");
  const match = system?.content.match(/Usuario atual:\s*(\S+)/i);
  return match?.[1];
}

function hasToolResult(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.role === "tool");
}

/**
 * Fake "razoavel": interpreta pedidos comuns e chama a tool certa, tal
 * qual um LLM bem-comportado faria. Nao e usado no red team (que exige
 * um modelo que coopera com o ataque) — serve para a demo de CLI e para
 * mostrar o caminho feliz (allow) nos testes de aplicacao.
 */
export function createBenignFakeChatPort(): ChatPort {
  return {
    send: async (messages: ChatMessage[]): Promise<ChatOutcome> => {
      if (hasToolResult(messages)) {
        const toolMessage = [...messages].reverse().find((m) => m.role === "tool");
        return {
          type: "final",
          content: `Aqui esta o resultado da sua solicitacao: ${toolMessage?.content ?? "(sem dados)"}`,
        };
      }

      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const text = (lastUser?.content ?? "").toLowerCase();
      const callerUserId = extractCallerUserId(messages) ?? "unknown";

      if (text.includes("holerite") || text.includes("payslip")) {
        return { type: "tool_call", toolCall: { name: "get_own_payslip", arguments: { targetUserId: callerUserId } } };
      }

      if (text.includes("ferias") || text.includes("férias") || text.includes("vacation")) {
        return {
          type: "tool_call",
          toolCall: {
            name: "request_vacation",
            arguments: { targetUserId: callerUserId, startDate: "2026-08-01", endDate: "2026-08-10" },
          },
        };
      }

      if (text.includes("politica") || text.includes("política") || text.includes("policy")) {
        return { type: "tool_call", toolCall: { name: "search_policy", arguments: { query: lastUser?.content ?? "" } } };
      }

      return {
        type: "final",
        content: "Posso ajudar com holerite, pedido de ferias ou politicas de RH. O que voce precisa?",
      };
    },
  };
}
