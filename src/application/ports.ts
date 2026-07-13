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

/** Resultado da checagem do guardian (classificador de input malicioso). */
export interface GuardianVerdict {
  flagged: boolean;
  reason: string;
}

/**
 * Porta para o modelo "guardian" — um segundo LLM (ou heuristica externa)
 * que classifica a entrada do usuario. Qualquer erro/timeout desta porta
 * deve ser tratado pelo chamador como fail-closed (bloquear).
 */
export interface GuardianPort {
  check(input: string): Promise<GuardianVerdict>;
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
}

export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export type ChatOutcome = { type: "tool_call"; toolCall: ToolCallRequest } | { type: "final"; content: string };

export interface ToolSpec {
  name: string;
  description: string;
}

/** Porta para o LLM principal de chat, com suporte a tool-use simples. */
export interface ChatPort {
  send(messages: ChatMessage[], tools: ToolSpec[]): Promise<ChatOutcome>;
}
