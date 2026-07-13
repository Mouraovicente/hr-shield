import { describe, expect, it } from "vitest";
import { detectPii, maskPii } from "../../src/domain/pii.js";

describe("pii.detectPii", () => {
  it("detecta CPF formatado (xxx.xxx.xxx-xx)", () => {
    const findings = detectPii("O CPF do funcionario e 123.456.789-09, guarde em sigilo.");
    expect(findings.some((f) => f.type === "cpf" && f.value === "123.456.789-09")).toBe(true);
  });

  it("detecta CPF cru (11 digitos seguidos)", () => {
    const findings = detectPii("CPF sem formatacao: 12345678909 no cadastro.");
    expect(findings.some((f) => f.type === "cpf" && f.value === "12345678909")).toBe(true);
  });

  it("detecta padrao de salario em reais (R$ 12.345,67)", () => {
    const findings = detectPii("O salario dele e R$ 12.345,67 por mes.");
    expect(findings.some((f) => f.type === "salary" && f.value.includes("12.345,67"))).toBe(true);
  });

  it("nao encontra nada em texto limpo", () => {
    const findings = detectPii("Qual o horario do RH na sexta-feira?");
    expect(findings).toHaveLength(0);
  });
});

describe("pii.maskPii", () => {
  it("mascara CPF formatado e cru", () => {
    const masked = maskPii("CPFs: 123.456.789-09 e 98765432100.");
    expect(masked).not.toContain("123.456.789-09");
    expect(masked).not.toContain("98765432100");
    expect(masked).toContain("***");
  });

  it("mascara padrao de salario", () => {
    const masked = maskPii("Salario: R$ 9.876,54.");
    expect(masked).not.toContain("9.876,54");
    expect(masked).toContain("***");
  });

  it("preserva texto sem PII", () => {
    const text = "Nenhum dado sensivel aqui.";
    expect(maskPii(text)).toBe(text);
  });
});
