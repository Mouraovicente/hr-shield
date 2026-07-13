import type { AuditEvent } from "../domain/audit.js";
import type { Role } from "../domain/rbac.js";

/**
 * Ports (interfaces) que a camada de aplicacao depende, mas nao implementa.
 * A infraestrutura (SQLite, OpenRouter, fakes de teste) fornece as
 * implementacoes concretas — assim o dominio e a aplicacao permanecem
 * livres de detalhes de I/O.
 */

export interface EmployeeRecord {
  id: string;
  name: string;
  role: Role;
  cpf: string;
  salary: number;
  department: string;
}

export interface EmployeeRepository {
  getById(id: string): EmployeeRecord | undefined;
  list(): EmployeeRecord[];
}

export interface PolicyRepository {
  search(query: string): string[];
}

export interface AuditSink {
  record(event: AuditEvent): void;
}
