/**
 * Deteccao e mascaramento de PII (dados pessoais de RH) em texto livre.
 *
 * Modulo puro, sem I/O — usado pelo outputGuard (application) para
 * impedir que a resposta final do assistente vaze CPF ou salario de
 * um funcionario para quem nao tem direito de ve-los.
 */

export type PiiType = "cpf" | "salary";

export interface PiiFinding {
  type: PiiType;
  value: string;
  index: number;
}

const CPF_FORMATTED_RE = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const CPF_RAW_RE = /\b\d{11}\b/g;
const SALARY_RE = /R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}/g;

function findAll(re: RegExp, text: string, type: PiiType): PiiFinding[] {
  const findings: PiiFinding[] = [];
  const pattern = new RegExp(re.source, re.flags);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    findings.push({ type, value: match[0], index: match.index });
  }
  return findings;
}

/**
 * Encontra ocorrencias de CPF (formatado ou cru) e de padroes de salario
 * em reais dentro de `text`. Retorna posicoes ordenadas para permitir
 * mascaramento posterior sem sobreposicao.
 */
export function detectPii(text: string): PiiFinding[] {
  const cpfFormatted = findAll(CPF_FORMATTED_RE, text, "cpf");

  // Evita contar duas vezes os 11 digitos que ja fazem parte de um CPF
  // formatado (o raw regex tambem casaria os digitos sem a pontuacao).
  const formattedRanges = cpfFormatted.map((f) => [f.index, f.index + f.value.length] as const);
  const cpfRaw = findAll(CPF_RAW_RE, text, "cpf").filter(
    (f) => !formattedRanges.some(([start, end]) => f.index >= start && f.index < end),
  );

  const salary = findAll(SALARY_RE, text, "salary");

  return [...cpfFormatted, ...cpfRaw, ...salary].sort((a, b) => a.index - b.index);
}

/**
 * Substitui toda PII detectada em `text` por "***".
 */
export function maskPii(text: string): string {
  const findings = detectPii(text);
  if (findings.length === 0) return text;

  let result = "";
  let cursor = 0;
  for (const finding of findings) {
    result += text.slice(cursor, finding.index);
    result += "***";
    cursor = finding.index + finding.value.length;
  }
  result += text.slice(cursor);
  return result;
}
