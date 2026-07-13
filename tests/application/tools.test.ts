import { beforeEach, describe, expect, it } from "vitest";
import { createTools } from "../../src/application/tools.js";
import type { AuditEvent } from "../../src/domain/audit.js";
import type { EmployeeRecord, EmployeeRepository, PolicyRepository } from "../../src/application/ports.js";

const EMPLOYEES: EmployeeRecord[] = [
  {
    id: "emp-001",
    name: "Ana Souza (ficticio)",
    role: "employee",
    cpf: "111.111.111-11",
    salary: 6000,
    department: "Engenharia",
  },
  {
    id: "emp-002",
    name: "Bruno Lima (ficticio)",
    role: "employee",
    cpf: "222.222.222-22",
    salary: 7000,
    department: "Engenharia",
  },
  {
    id: "hr-001",
    name: "Carla Nunes (ficticio)",
    role: "hr_admin",
    cpf: "333.333.333-33",
    salary: 9000,
    department: "RH",
  },
];

function fakeEmployeeRepo(): EmployeeRepository {
  const byId = new Map(EMPLOYEES.map((e) => [e.id, e]));
  return {
    getById: (id) => byId.get(id),
    list: () => EMPLOYEES,
  };
}

function fakePolicyRepo(): PolicyRepository {
  return {
    search: (query) => [`Politica encontrada para: ${query}`],
  };
}

function fakeAuditSink() {
  const events: AuditEvent[] = [];
  return {
    events,
    record: (event: AuditEvent) => {
      events.push(event);
    },
  };
}

describe("application/tools (RBAC aplicado dentro das tools)", () => {
  let audit: ReturnType<typeof fakeAuditSink>;
  let tools: ReturnType<typeof createTools>;

  beforeEach(() => {
    audit = fakeAuditSink();
    tools = createTools({ employees: fakeEmployeeRepo(), policies: fakePolicyRepo(), audit });
  });

  it("permite employee ver o proprio holerite e audita allow", () => {
    const result = tools.getOwnPayslip(
      { callerUserId: "emp-001", role: "employee" },
      { targetUserId: "emp-001" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.cpf).toBe("111.111.111-11");
    }
    expect(audit.events.some((e) => e.decision === "allow" && e.action === "get_own_payslip")).toBe(true);
  });

  it("nega employee ver salario de terceiro, mesmo que o LLM tente, e audita deny", () => {
    const result = tools.getEmployeeSalary(
      { callerUserId: "emp-001", role: "employee" },
      { targetUserId: "emp-002" },
    );

    expect(result.ok).toBe(false);
    const deny = audit.events.find((e) => e.action === "get_employee_salary");
    expect(deny?.decision).toBe("deny");
    expect(deny?.reason).toContain("get_employee_salary");
  });

  it("permite hr_admin ver salario de qualquer funcionario", () => {
    const result = tools.getEmployeeSalary(
      { callerUserId: "hr-001", role: "hr_admin" },
      { targetUserId: "emp-002" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.salary).toBe(7000);
    }
  });

  it("permite search_policy para qualquer role", () => {
    const employeeResult = tools.searchPolicy({ callerUserId: "emp-001", role: "employee" }, { query: "ferias" });
    const adminResult = tools.searchPolicy({ callerUserId: "hr-001", role: "hr_admin" }, { query: "ferias" });

    expect(employeeResult.ok).toBe(true);
    expect(adminResult.ok).toBe(true);
  });

  it("nega employee abrir pedido de ferias em nome de terceiro", () => {
    const result = tools.requestVacation(
      { callerUserId: "emp-001", role: "employee" },
      { targetUserId: "emp-002", startDate: "2026-08-01", endDate: "2026-08-10" },
    );

    expect(result.ok).toBe(false);
  });
});
