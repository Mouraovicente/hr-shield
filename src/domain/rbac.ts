/**
 * RBAC puro — a fronteira de seguranca real do sistema.
 *
 * Esta funcao NAO confia no que o modelo de linguagem "decidiu" fazer.
 * Toda tool da camada de aplicacao chama `can()` ANTES de executar
 * qualquer efeito, e nega a chamada mesmo que o LLM tenha sido
 * manipulado por prompt injection para tentar chama-la.
 *
 * Sem dependencias externas, sem I/O — apenas uma matriz de decisao.
 */

export type Role = "employee" | "hr_admin";

export type ToolName =
  | "get_own_payslip"
  | "get_employee_salary"
  | "request_vacation"
  | "search_policy";

/**
 * Decide se `role` pode executar `tool` tendo `targetUserId` como alvo,
 * quando quem chama e `callerUserId`.
 */
export function can(
  role: Role,
  tool: ToolName,
  targetUserId: string,
  callerUserId: string,
): boolean {
  const isOwnTarget = targetUserId === callerUserId;

  switch (tool) {
    case "search_policy":
      // Consulta de politicas publicas de RH: sem dado sensivel, sem alvo.
      return true;

    case "get_own_payslip":
      // Qualquer role pode ver o proprio holerite, nunca o de terceiros.
      return isOwnTarget;

    case "request_vacation":
      // Um pedido de ferias so pode ser aberto em nome de quem pediu.
      return isOwnTarget;

    case "get_employee_salary":
      // Dado mais sensivel do sistema: exclusivo de hr_admin,
      // independente de quem seja o alvo (inclusive o proprio hr_admin).
      return role === "hr_admin";

    default:
      return false;
  }
}
