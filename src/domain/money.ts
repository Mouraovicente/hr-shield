/**
 * Formata um valor numerico como salario em reais no MESMO formato que
 * `pii.ts` sabe detectar ("R$ 12.345,67"). Mantido separado do detector
 * para nao acoplar deteccao a formatacao.
 */
export function formatSalaryBRL(value: number): string {
  const [intPart = "0", fracPart = "00"] = value.toFixed(2).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${withThousands},${fracPart}`;
}
