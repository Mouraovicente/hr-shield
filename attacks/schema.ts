import { z } from "zod";

/**
 * Formato do corpus de ataques (attacks/corpus.json), validado com Zod
 * para que um corpus malformado quebre o teste de red team de forma
 * clara em vez de falhar silenciosamente.
 */
export const AttackSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  turns: z.array(z.string()).min(1),
  attackerUserId: z.string(),
  attackerRole: z.enum(["employee", "hr_admin"]),
  targetUserId: z.string(),
  strategy: z.enum(["input_block", "call_forbidden_tool", "leak_text"]),
  toolCall: z.object({ name: z.string(), arguments: z.record(z.unknown()) }).optional(),
  leakText: z.string().optional(),
  expectedContainment: z.enum(["deny", "mask"]),
});

export type Attack = z.infer<typeof AttackSchema>;

export const AttackCorpusSchema = z.array(AttackSchema).min(15);
