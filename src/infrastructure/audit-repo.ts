import type { AuditEvent, Decision } from "../domain/audit.js";
import { summarizeByDecision } from "../domain/audit.js";
import type { AuditSink } from "../application/ports.js";
import type { SqliteDb } from "./db.js";

/**
 * Persistencia da trilha de auditoria em SQLite. Toda decisao de
 * seguranca (allow/deny/mask) tomada pelo RBAC ou pelos guardrails vira
 * uma linha aqui — e a fonte de verdade para `npm run audit:report`.
 */

interface AuditRow {
  ts: string;
  user_id: string;
  role: string;
  action: string;
  decision: Decision;
  reason: string;
}

function toEvent(row: AuditRow): AuditEvent {
  return {
    ts: row.ts,
    userId: row.user_id,
    role: row.role as AuditEvent["role"],
    action: row.action,
    decision: row.decision,
    reason: row.reason,
  };
}

export function createSqliteAuditSink(db: SqliteDb): AuditSink {
  const insert = db.prepare(
    "INSERT INTO audit_log (ts, user_id, role, action, decision, reason) VALUES (?, ?, ?, ?, ?, ?)",
  );

  return {
    record(event: AuditEvent): void {
      insert.run(event.ts, event.userId, event.role, event.action, event.decision, event.reason);
    },
  };
}

export function getAllAuditEvents(db: SqliteDb): AuditEvent[] {
  const rows = db
    .prepare<[], AuditRow>("SELECT ts, user_id, role, action, decision, reason FROM audit_log ORDER BY id ASC")
    .all();
  return rows.map(toEvent);
}

export function summarizeAuditLog(db: SqliteDb): Record<Decision, number> {
  return summarizeByDecision(getAllAuditEvents(db));
}

export function summarizeAuditByReason(db: SqliteDb): Record<string, number> {
  const rows = db
    .prepare<[], { reason: string; count: number }>(
      "SELECT reason, COUNT(*) as count FROM audit_log GROUP BY reason ORDER BY count DESC",
    )
    .all();

  const summary: Record<string, number> = {};
  for (const row of rows) summary[row.reason] = row.count;
  return summary;
}
