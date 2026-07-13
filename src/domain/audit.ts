import type { Role } from "./rbac.js";

/**
 * Toda decisao de seguranca do sistema (RBAC, input guard, output guard)
 * vira um AuditEvent. E o registro que prova, depois do fato, que a
 * defesa funcionou — mesmo quando o usuario nunca ve o motivo na tela.
 */

export type Decision = "allow" | "deny" | "mask";

export interface AuditEvent {
  ts: string;
  userId: string;
  role: Role;
  action: string;
  decision: Decision;
  reason: string;
}

export type AuditEventInput = Omit<AuditEvent, "ts"> & { ts?: string };

/** Cria um AuditEvent preenchendo o timestamp (ISO 8601) quando omitido. */
export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return {
    ts: input.ts ?? new Date().toISOString(),
    userId: input.userId,
    role: input.role,
    action: input.action,
    decision: input.decision,
    reason: input.reason,
  };
}

/** Agrega uma lista de eventos por decision, sempre incluindo as 3 chaves. */
export function summarizeByDecision(events: readonly AuditEvent[]): Record<Decision, number> {
  const summary: Record<Decision, number> = { allow: 0, deny: 0, mask: 0 };
  for (const event of events) {
    summary[event.decision] += 1;
  }
  return summary;
}
