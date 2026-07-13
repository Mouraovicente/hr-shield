import { describe, expect, it } from "vitest";
import { openDb } from "../../src/infrastructure/db.js";
import { createSqliteAuditSink, getAllAuditEvents, summarizeAuditLog } from "../../src/infrastructure/audit-repo.js";
import { createAuditEvent } from "../../src/domain/audit.js";

describe("infrastructure/audit-repo", () => {
  it("persiste um evento de deny e consegue le-lo de volta", () => {
    const db = openDb(":memory:");
    const sink = createSqliteAuditSink(db);

    sink.record(
      createAuditEvent({
        userId: "emp-001",
        role: "employee",
        action: "get_employee_salary",
        decision: "deny",
        reason: "rbac_denied:get_employee_salary",
      }),
    );

    const events = getAllAuditEvents(db);
    expect(events).toHaveLength(1);
    expect(events[0]?.decision).toBe("deny");
    expect(events[0]?.userId).toBe("emp-001");
  });

  it("agrega o relatorio por decision (allow/deny/mask)", () => {
    const db = openDb(":memory:");
    const sink = createSqliteAuditSink(db);

    sink.record(createAuditEvent({ userId: "a", role: "employee", action: "x", decision: "deny", reason: "r1" }));
    sink.record(createAuditEvent({ userId: "a", role: "employee", action: "x", decision: "deny", reason: "r2" }));
    sink.record(createAuditEvent({ userId: "b", role: "hr_admin", action: "y", decision: "allow", reason: "r3" }));
    sink.record(createAuditEvent({ userId: "a", role: "employee", action: "z", decision: "mask", reason: "r4" }));

    const summary = summarizeAuditLog(db);
    expect(summary).toEqual({ allow: 1, deny: 2, mask: 1 });
  });
});
