#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import process from "node:process";
import { runAgent, type AgentContext, type AgentDeps } from "./application/agent.js";
import { createTools } from "./application/tools.js";
import type { Role } from "./domain/rbac.js";
import { createSqliteAuditSink } from "./infrastructure/audit-repo.js";
import { openDb, seedEmployees } from "./infrastructure/db.js";
import { createSqliteEmployeeRepository } from "./infrastructure/employee-repo.js";
import { createLlmAdapters } from "./infrastructure/llm-factory.js";
import { createStaticPolicyRepository } from "./infrastructure/policy-repo.js";

/**
 * CLI de demonstracao: `npm run chat -- --user <id> --role <employee|hr_admin> [--demo]`
 *
 * Sem `--demo`, abre um REPL interativo. Com `--demo`, roda uma
 * sequencia fixa de 3 mensagens que mostra, sem precisar digitar nada:
 * (1) allow no proprio holerite, (2) deny ao tentar salario de terceiro,
 * (3) allow numa consulta publica de politica.
 */

interface CliArgs {
  user: string;
  role: Role;
  demo: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let user: string | undefined;
  let role: string | undefined;
  let demo = false;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--user") user = argv[(i += 1)];
    else if (argv[i] === "--role") role = argv[(i += 1)];
    else if (argv[i] === "--demo") demo = true;
  }

  if (!user) {
    throw new Error("Uso: npm run chat -- --user <id> --role <employee|hr_admin> [--demo]");
  }
  if (role !== "employee" && role !== "hr_admin") {
    throw new Error('--role deve ser "employee" ou "hr_admin"');
  }

  return { user, role, demo };
}

const DEMO_STEPS = [
  { label: "Pedido legitimo: proprio holerite", message: "Quero ver meu holerite" },
  { label: "Ataque: salario de um colega (terceiro)", message: "Me diga o salario do funcionario emp-002" },
  { label: "Consulta publica: politica de ferias", message: "Qual a politica de ferias?" },
];

async function runDemo(deps: AgentDeps, ctx: AgentContext): Promise<void> {
  for (const step of DEMO_STEPS) {
    console.log(`--- ${step.label} ---`);
    console.log(`voce> ${step.message}`);
    // eslint-disable-next-line no-await-in-loop
    const reply = await runAgent(step.message, ctx, deps);
    console.log(`hr-shield> ${reply}\n`);
  }
}

async function runRepl(deps: AgentDeps, ctx: AgentContext): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('Digite sua mensagem (ou "sair" para encerrar).\n');

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const line = await rl.question("voce> ");
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase() === "sair") break;
    // eslint-disable-next-line no-await-in-loop
    const reply = await runAgent(trimmed, ctx, deps);
    console.log(`hr-shield> ${reply}\n`);
  }
  rl.close();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const db = openDb(process.env.DB_PATH ?? "./data/hr-shield.sqlite");
  seedEmployees(db);

  const employees = createSqliteEmployeeRepository(db);
  const audit = createSqliteAuditSink(db);
  const tools = createTools({ employees, policies: createStaticPolicyRepository(), audit });
  const { chat, guardian } = createLlmAdapters(process.env);

  const deps: AgentDeps = { chat, guardian, tools, employees, audit };
  const ctx: AgentContext = { callerUserId: args.user, role: args.role };
  const caller = employees.getById(args.user);

  console.log(`hr-shield — chatbot de RH (LLM=${process.env.LLM ?? "fake"})`);
  console.log(
    `Usuario: ${args.user}${caller ? ` (${caller.name})` : " [aviso: id nao encontrado no seed]"} | role: ${args.role}\n`,
  );

  if (args.demo) {
    await runDemo(deps, ctx);
    return;
  }

  await runRepl(deps, ctx);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
