import { createAuditEvent } from "../domain/audit.js";
import { formatSalaryBRL } from "../domain/money.js";
import type { Role } from "../domain/rbac.js";
import { inputGuard, outputGuard } from "./guardrails.js";
import type { AuditSink, ChatMessage, ChatPort, GuardianPort, ToolCallRequest, ToolSpec } from "./ports.js";
import type { EmployeeRepository } from "./ports.js";
import type { ToolContext, Tools } from "./tools.js";

/**
 * Pipeline do agente: inputGuard -> LLM com tools (loop simples) ->
 * outputGuard -> auditoria.
 *
 * Este e o unico lugar que orquestra as camadas de defesa; ele nao
 * confia no LLM para decidir o que e permitido — quem decide e o
 * inputGuard (fail-closed), a tool (rbac.can) e o outputGuard (pii).
 */

export interface AgentContext {
  callerUserId: string;
  role: Role;
}

export interface AgentDeps {
  chat: ChatPort;
  guardian: GuardianPort;
  tools: Tools;
  employees: EmployeeRepository;
  audit: AuditSink;
}

const TOOL_SPECS: ToolSpec[] = [
  {
    name: "get_own_payslip",
    description: "Retorna o holerite (nome, cpf, salario, departamento) do funcionario indicado por targetUserId.",
  },
  {
    name: "get_employee_salary",
    description: "Retorna o salario de um funcionario pelo targetUserId. Uso restrito a hr_admin.",
  },
  {
    name: "request_vacation",
    description: "Abre um pedido de ferias para targetUserId, com startDate e endDate (YYYY-MM-DD).",
  },
  { name: "search_policy", description: "Busca politicas publicas de RH por palavra-chave (query)." },
];

const MAX_TOOL_ITERATIONS = 4;
const BLOCKED_MESSAGE = "Nao posso atender a essa solicitacao.";
const FALLBACK_MESSAGE = "Nao foi possivel concluir a solicitacao no momento.";

function buildSystemMessage(ctx: AgentContext): ChatMessage {
  return {
    role: "system",
    content:
      "Voce e o assistente de RH. Use as ferramentas disponiveis para consultar dados. " +
      `Usuario atual: ${ctx.callerUserId} (role: ${ctx.role})`,
  };
}

type ToolHandler = (ctx: ToolContext, args: unknown) => unknown;

function buildHandlers(tools: Tools): Record<string, ToolHandler> {
  return {
    get_own_payslip: tools.getOwnPayslip,
    get_employee_salary: tools.getEmployeeSalary,
    request_vacation: tools.requestVacation,
    search_policy: tools.searchPolicy,
  };
}

function executeTool(handlers: Record<string, ToolHandler>, ctx: ToolContext, call: ToolCallRequest): unknown {
  const handler = handlers[call.name];
  if (!handler) return { ok: false, reason: "unknown_tool" };
  try {
    return handler(ctx, call.arguments);
  } catch {
    return { ok: false, reason: "invalid_arguments" };
  }
}

function resolveOwnValues(employees: EmployeeRepository, callerUserId: string): string[] {
  const own = employees.getById(callerUserId);
  if (!own) return [];
  return [own.cpf, formatSalaryBRL(own.salary)];
}

export async function runAgent(userMessage: string, ctx: AgentContext, deps: AgentDeps): Promise<string> {
  const guard = await inputGuard(userMessage, deps.guardian);
  if (!guard.allowed) {
    deps.audit.record(
      createAuditEvent({
        userId: ctx.callerUserId,
        role: ctx.role,
        action: "input_guard",
        decision: "deny",
        reason: guard.reason,
      }),
    );
    return BLOCKED_MESSAGE;
  }

  const toolCtx: ToolContext = { callerUserId: ctx.callerUserId, role: ctx.role };
  const handlers = buildHandlers(deps.tools);
  const messages: ChatMessage[] = [buildSystemMessage(ctx), { role: "user", content: userMessage }];

  let finalText = FALLBACK_MESSAGE;
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i += 1) {
    const outcome = await deps.chat.send(messages, TOOL_SPECS);
    if (outcome.type === "final") {
      finalText = outcome.content;
      break;
    }

    const result = executeTool(handlers, toolCtx, outcome.toolCall);
    messages.push({
      role: "assistant",
      content: `[tool_call] ${outcome.toolCall.name}(${JSON.stringify(outcome.toolCall.arguments)})`,
    });
    messages.push({ role: "tool", name: outcome.toolCall.name, content: JSON.stringify(result) });
  }

  const ownValues = resolveOwnValues(deps.employees, ctx.callerUserId);
  const guarded = outputGuard(finalText, { role: ctx.role, ownValues });

  if (guarded.masked) {
    deps.audit.record(
      createAuditEvent({
        userId: ctx.callerUserId,
        role: ctx.role,
        action: "output_guard",
        decision: "mask",
        reason: `pii_masked:${guarded.maskedValues.length}`,
      }),
    );
  }

  return guarded.text;
}
