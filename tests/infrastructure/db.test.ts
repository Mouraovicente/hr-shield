import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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

  it("cria o diretorio pai do arquivo de banco quando ele ainda nao existe", () => {
    const tmpRoot = mkdtempSync(path.join(tmpdir(), "hr-shield-db-test-"));
    const nestedDbPath = path.join(tmpRoot, "nested", "dir", "hr-shield.sqlite");

    try {
      expect(existsSync(nestedDbPath)).toBe(false);
      const db = openDb(nestedDbPath);
      seedEmployees(db);
      db.close();
      expect(existsSync(nestedDbPath)).toBe(true);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
