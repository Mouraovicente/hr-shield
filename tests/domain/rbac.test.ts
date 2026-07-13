import { describe, expect, it } from "vitest";
import { can } from "../../src/domain/rbac.js";

describe("rbac.can (matriz pura de permissoes)", () => {
  it("permite employee ver o proprio holerite", () => {
    expect(can("employee", "get_own_payslip", "emp-001", "emp-001")).toBe(true);
  });

  it("nega employee ver salario de terceiro", () => {
    expect(can("employee", "get_employee_salary", "emp-002", "emp-001")).toBe(false);
  });

  it("permite hr_admin ver salario de qualquer funcionario", () => {
    expect(can("hr_admin", "get_employee_salary", "emp-002", "hr-001")).toBe(true);
  });

  it("permite search_policy para qualquer role, sem restricao de alvo", () => {
    expect(can("employee", "search_policy", "n/a", "emp-001")).toBe(true);
    expect(can("hr_admin", "search_policy", "n/a", "hr-001")).toBe(true);
  });

  it("nega employee acessar holerite de terceiro", () => {
    expect(can("employee", "get_own_payslip", "emp-002", "emp-001")).toBe(false);
  });

  it("nega employee criar pedido de ferias em nome de terceiro", () => {
    expect(can("employee", "request_vacation", "emp-002", "emp-001")).toBe(false);
  });

  it("permite hr_admin ver o proprio holerite", () => {
    expect(can("hr_admin", "get_own_payslip", "hr-001", "hr-001")).toBe(true);
  });
});
