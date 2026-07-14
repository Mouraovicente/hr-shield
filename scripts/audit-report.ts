#!/usr/bin/env node
import { openDb } from "../src/infrastructure/db.js";
import { getAllAuditEvents, summarizeAuditByReason, summarizeAuditLog } from "../src/infrastructure/audit-repo.js";

/**
 * `npm run audit:report` — le a trilha de auditoria persistida em SQLite
 * (a mesma usada por `npm run chat`) e imprime um resumo por decision e
 * por motivo. Uso tipico: rode o chat, tente alguns ataques, depois rode
 * este script para ver o que foi contido e por que.
 */
function main(): void {
  const dbPath = process.env.DB_PATH ?? "./data/hr-shield.sqlite";
  const db = openDb(dbPath);

  const events = getAllAuditEvents(db);
  const byDecision = summarizeAuditLog(db);
  const byReason = summarizeAuditByReason(db);

  console.log(`hr-shield — relatorio de auditoria (${dbPath})`);
  console.log(`Total de eventos: ${events.length}\n`);

  console.log("Por decisao:");
  for (const decision of ["allow", "deny", "mask"] as const) {
    console.log(`  ${decision.padEnd(6)} ${byDecision[decision]}`);
  }

  console.log("\nPor motivo:");
  const reasonEntries = Object.entries(byReason);
  if (reasonEntries.length === 0) {
    console.log("  (nenhum evento registrado ainda — rode `npm run chat` primeiro)");
  } else {
    for (const [reason, count] of reasonEntries) {
      console.log(`  ${String(count).padStart(4)}  ${reason}`);
    }
  }

  db.close();
}

main();
