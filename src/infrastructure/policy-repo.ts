import type { PolicyRepository } from "../application/ports.js";

/**
 * Politicas de RH publicas (sem dado pessoal), disponiveis a qualquer
 * papel via a tool `search_policy`. Conteudo estatico de demonstracao.
 */
const POLICIES: string[] = [
  "Politica de ferias: todo funcionario tem direito a 30 dias corridos de ferias por ano, solicitados com pelo menos 30 dias de antecedencia.",
  "Politica de home office: ate 3 dias remotos por semana, mediante acordo com o gestor direto.",
  "Politica de reembolso: despesas de viagem a trabalho devem ser lancadas em ate 15 dias apos a viagem, com nota fiscal.",
  "Politica de horario: jornada padrao de 8h/dia, com tolerancia de 10 minutos de flexibilidade na entrada.",
  "Politica de licenca maternidade/paternidade: 180 dias para maes e 20 dias para pais, conforme legislacao vigente.",
  "Codigo de conduta: dados pessoais de colegas (CPF, salario) sao confidenciais e nunca devem ser compartilhados fora dos canais oficiais de RH.",
];

export function createStaticPolicyRepository(): PolicyRepository {
  return {
    search(query: string): string[] {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return [];
      return POLICIES.filter((policy) => policy.toLowerCase().includes(normalized));
    },
  };
}
