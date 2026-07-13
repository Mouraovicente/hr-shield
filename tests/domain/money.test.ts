import { describe, expect, it } from "vitest";
import { formatSalaryBRL } from "../../src/domain/money.js";
import { detectPii } from "../../src/domain/pii.js";

describe("money.formatSalaryBRL", () => {
  it("formata milhares com ponto e centavos com virgula", () => {
    expect(formatSalaryBRL(6000)).toBe("R$ 6.000,00");
    expect(formatSalaryBRL(12345.67)).toBe("R$ 12.345,67");
    expect(formatSalaryBRL(950.5)).toBe("R$ 950,50");
  });

  it("produz um texto que o detector de pii reconhece como salario", () => {
    const text = `O salario e ${formatSalaryBRL(7500)}.`;
    const findings = detectPii(text);
    expect(findings.some((f) => f.type === "salary")).toBe(true);
  });
});
