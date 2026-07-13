import type { EmployeeRecord, EmployeeRepository } from "../application/ports.js";
import type { Role } from "../domain/rbac.js";
import type { SqliteDb } from "./db.js";

interface EmployeeRow {
  id: string;
  name: string;
  role: Role;
  cpf: string;
  salary: number;
  department: string;
}

function toRecord(row: EmployeeRow): EmployeeRecord {
  return { ...row };
}

/** Implementacao SQLite do port EmployeeRepository. */
export function createSqliteEmployeeRepository(db: SqliteDb): EmployeeRepository {
  const getByIdStmt = db.prepare<[string], EmployeeRow>("SELECT * FROM employees WHERE id = ?");
  const listStmt = db.prepare<[], EmployeeRow>("SELECT * FROM employees ORDER BY id ASC");

  return {
    getById(id: string): EmployeeRecord | undefined {
      const row = getByIdStmt.get(id);
      return row ? toRecord(row) : undefined;
    },
    list(): EmployeeRecord[] {
      return listStmt.all().map(toRecord);
    },
  };
}
