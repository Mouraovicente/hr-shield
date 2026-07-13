import { z } from "zod";
import { createAuditEvent } from "../domain/audit.js";
import { can, type Role, type ToolName } from "../domain/rbac.js";
import type { AuditSink, EmployeeRepository, PolicyRepository } from "./ports.js";

/**
 * As tools sao a fronteira de seguranca real do agente.
 *
 * Cada funcao aqui valida seus argumentos com Zod e, ANTES de tocar em
 * qualquer dado, chama `rbac.can()`. Se o LLM foi manipulado por uma
 * prompt injection e decidiu chamar `getEmployeeSalary` para um
 * `targetUserId` de terceiro, a tool nega e audita — o modelo pode
 * "obedecer" ao ataque, mas o codigo nao executa o efeito.
 */

export interface ToolContext {
  callerUserId: string;
  role: Role;
}

export type ToolResult<T> = { ok: true; data: T } | { ok: false; reason: string };

export interface ToolsDeps {
  employees: EmployeeRepository;
  policies: PolicyRepository;
  audit: AuditSink;
}

const targetUserIdSchema = z.object({ targetUserId: z.string().min(1) });
const vacationSchema = z.object({
  targetUserId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});
const policySearchSchema = z.object({ query: z.string().min(1) });

export function createTools(deps: ToolsDeps) {
  function enforce(ctx: ToolContext, tool: ToolName, targetUserId: string): boolean {
    const allowed = can(ctx.role, tool, targetUserId, ctx.callerUserId);
    deps.audit.record(
      createAuditEvent({
        userId: ctx.callerUserId,
        role: ctx.role,
        action: tool,
        decision: allowed ? "allow" : "deny",
        reason: allowed ? `rbac_allowed:${tool}` : `rbac_denied:${tool}`,
      }),
    );
    return allowed;
  }

  function getOwnPayslip(
    ctx: ToolContext,
    rawArgs: unknown,
  ): ToolResult<{ name: string; cpf: string; salary: number; department: string }> {
    const args = targetUserIdSchema.parse(rawArgs);
    if (!enforce(ctx, "get_own_payslip", args.targetUserId)) {
      return { ok: false, reason: "access_denied" };
    }
    const employee = deps.employees.getById(args.targetUserId);
    if (!employee) return { ok: false, reason: "not_found" };
    const { name, cpf, salary, department } = employee;
    return { ok: true, data: { name, cpf, salary, department } };
  }

  function getEmployeeSalary(
    ctx: ToolContext,
    rawArgs: unknown,
  ): ToolResult<{ name: string; salary: number }> {
    const args = targetUserIdSchema.parse(rawArgs);
    if (!enforce(ctx, "get_employee_salary", args.targetUserId)) {
      return { ok: false, reason: "access_denied" };
    }
    const employee = deps.employees.getById(args.targetUserId);
    if (!employee) return { ok: false, reason: "not_found" };
    return { ok: true, data: { name: employee.name, salary: employee.salary } };
  }

  function requestVacation(
    ctx: ToolContext,
    rawArgs: unknown,
  ): ToolResult<{ status: "requested"; targetUserId: string; startDate: string; endDate: string }> {
    const args = vacationSchema.parse(rawArgs);
    if (!enforce(ctx, "request_vacation", args.targetUserId)) {
      return { ok: false, reason: "access_denied" };
    }
    return {
      ok: true,
      data: {
        status: "requested",
        targetUserId: args.targetUserId,
        startDate: args.startDate,
        endDate: args.endDate,
      },
    };
  }

  function searchPolicy(ctx: ToolContext, rawArgs: unknown): ToolResult<{ results: string[] }> {
    const args = policySearchSchema.parse(rawArgs);
    // search_policy nao tem alvo real; usamos o proprio caller para
    // satisfazer a assinatura pura de rbac.can (o resultado independe disso).
    if (!enforce(ctx, "search_policy", ctx.callerUserId)) {
      return { ok: false, reason: "access_denied" };
    }
    return { ok: true, data: { results: deps.policies.search(args.query) } };
  }

  return { getOwnPayslip, getEmployeeSalary, requestVacation, searchPolicy };
}

export type Tools = ReturnType<typeof createTools>;
