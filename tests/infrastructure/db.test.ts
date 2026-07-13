import { describe, expect, it } from "vitest";
import { openDb, seedEmployees } from "../../src/infrastructure/db.js";
import { createSqliteEmployeeRepository } from "../../src/infrastructure/employee-repo.js";

describe("infrastructure/db (seed de RH ficticio)", () => {
  it("semeia exatamente 5 funcionarios ficticios em banco novo", () => {
    const db = openDb(":memory:");
    seedEmployees(db);
    const repo = createSqliteEmployeeRepository(db);
    expect(repo.list()).toHaveLength(5);
  });

  it("e idempotente: rodar o seed duas vezes nao duplica registros", () => {
    const db = openDb(":memory:");
    seedEmployees(db);
    seedEmployees(db);
    const repo = createSqliteEmployeeRepository(db);
    expect(repo.list()).toHaveLength(5);
  });

  it("marca claramente todos os funcionarios como dados ficticios", () => {
    const db = openDb(":memory:");
    seedEmployees(db);
    const repo = createSqliteEmployeeRepository(db);
    for (const employee of repo.list()) {
      expect(employee.name.toLowerCase()).toContain("ficticio");
    }
  });

  it("permite buscar um funcionario por id e retorna undefined se nao existir", () => {
    const db = openDb(":memory:");
    seedEmployees(db);
    const repo = createSqliteEmployeeRepository(db);
    expect(repo.getById("emp-001")).toBeDefined();
    expect(repo.getById("emp-999")).toBeUndefined();
  });
});
