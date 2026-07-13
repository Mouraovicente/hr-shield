import Database from "better-sqlite3";
import type { EmployeeRecord } from "../application/ports.js";

/**
 * Camada de acesso ao SQLite: schema (funcionarios + trilha de auditoria)
 * e o seed de RH 100% ficticio usado nas demos e nos testes.
 *
 * ATENCAO: todos os nomes, CPFs e salarios abaixo sao INVENTADOS para
 * este projeto de portfolio. Os CPFs usam digitos repetidos de proposito
 * (111.111.111-11 etc.) para que fiquem obviamente falsos.
 */

export type SqliteDb = Database.Database;

export function openDb(path: string = ":memory:"): SqliteDb {
  const db = new Database(path);
  migrate(db);
  return db;
}

function migrate(db: SqliteDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      cpf TEXT NOT NULL,
      salary REAL NOT NULL,
      department TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      decision TEXT NOT NULL,
      reason TEXT NOT NULL
    );
  `);
}

/** Dados 100% ficticios criados para este portfolio — nenhuma pessoa real. */
export const FICTITIOUS_EMPLOYEES: EmployeeRecord[] = [
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
    salary: 7500,
    department: "Engenharia",
  },
  {
    id: "emp-003",
    name: "Diego Alves (ficticio)",
    role: "employee",
    cpf: "444.444.444-44",
    salary: 5500,
    department: "Vendas",
  },
  {
    id: "emp-004",
    name: "Elisa Prado (ficticio)",
    role: "employee",
    cpf: "555.555.555-55",
    salary: 6800,
    department: "Financeiro",
  },
  {
    id: "hr-001",
    name: "Carla Nunes (ficticio)",
    role: "hr_admin",
    cpf: "333.333.333-33",
    salary: 9000,
    department: "Recursos Humanos",
  },
];

/** Popula a tabela `employees` se ela estiver vazia. Idempotente. */
export function seedEmployees(db: SqliteDb, employees: EmployeeRecord[] = FICTITIOUS_EMPLOYEES): void {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM employees").get() as { count: number };
  if (count > 0) return;

  const insert = db.prepare(
    "INSERT INTO employees (id, name, role, cpf, salary, department) VALUES (@id, @name, @role, @cpf, @salary, @department)",
  );
  const insertAll = db.transaction((rows: EmployeeRecord[]) => {
    for (const row of rows) insert.run(row);
  });
  insertAll(employees);
}
