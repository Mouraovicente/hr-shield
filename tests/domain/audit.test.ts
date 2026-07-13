import { describe, expect, it } from "vitest";
import { createAuditEvent, summarizeByDecision } from "../../src/domain/audit.js";

describe("audit.createAuditEvent", () => {
  it("cria um evento de auditoria com decision 'deny' e preenche o timestamp", () => {
    const event = createAuditEvent({
      userId: "emp-001",
      role: "employee",
      action: "get_employee_salary",
      decision: "deny",
      reason: "rbac_denied",
    });

    expect(event.decision).toBe("deny");
    expect(event.userId).toBe("emp-001");
    expect(event.reason).toBe("rbac_denied");
    expect(typeof event.ts).toBe("string");
    expect(new Date(event.ts).toString()).not.toBe("Invalid Date");
  });

  it("aceita um timestamp explicito quando fornecido", () => {
    const event = createAuditEvent({
      ts: "2026-01-01T00:00:00.000Z",
      userId: "hr-001",
      role: "hr_admin",
      action: "get_employee_salary",
      decision: "allow",
      reason: "rbac_allowed",
    });

    expect(event.ts).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("audit.summarizeByDecision", () => {
  it("agrega eventos por decision, incluindo decisoes com contagem zero", () => {
    const events = [
      createAuditEvent({ userId: "a", role: "employee", action: "x", decision: "deny", reason: "r1" }),
      createAuditEvent({ userId: "a", role: "employee", action: "x", decision: "deny", reason: "r2" }),
      createAuditEvent({ userId: "b", role: "hr_admin", action: "y", decision: "allow", reason: "r3" }),
    ];

    const summary = summarizeByDecision(events);

    expect(summary.deny).toBe(2);
    expect(summary.allow).toBe(1);
    expect(summary.mask).toBe(0);
  });
});
