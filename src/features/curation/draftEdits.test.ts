import { describe, expect, it } from "vitest";

import { draftContent } from "@/test/fixtures";

import { applyEdits, hasChanges, toForm } from "./draftEdits";

describe("draftEdits", () => {
  it("sem alteração, devolve o rascunho idêntico (status e evidências preservados)", () => {
    const form = toForm(draftContent);
    expect(hasChanges(draftContent, form)).toBe(false);
    expect(applyEdits(draftContent, form)).toEqual(draftContent);
  });

  it("texto revisado vira afirmação humana sem referência a evidência", () => {
    const form = { ...toForm(draftContent), granularity: "Uma linha por item de nota fiscal" };
    const edited = applyEdits(draftContent, form);
    expect(edited.granularity).toEqual({ text: "Uma linha por item de nota fiscal", status: "supported", evidence_refs: [] });
    expect(edited.business_description).toBe(draftContent.business_description); // inalterado
    expect(hasChanges(draftContent, form)).toBe(true);
  });

  it("listas: sinônimos sem duplicatas e limitações existentes preservadas", () => {
    const form = {
      ...toForm(draftContent),
      synonyms: "faturamento, vendas,faturamento , ",
      limitations: "Regras de cálculo não documentadas.\nInclui notas canceladas.\n",
    };
    const edited = applyEdits(draftContent, form);
    expect(edited.synonyms).toEqual(["faturamento", "vendas"]);
    expect(edited.limitations[0]).toBe(draftContent.limitations[0]);
    expect(edited.limitations[1]).toEqual({ text: "Inclui notas canceladas.", status: "supported", evidence_refs: [] });
    expect(edited.column_notes).toBe(draftContent.column_notes);
  });
});

describe("draftEdits (linguagem simples)", () => {
  it("edita resumo e perguntas de exemplo", () => {
    const form = { ...toForm(draftContent), plainLanguageSummary: " Vendas por nota. ", exampleQuestions: "quanto vendemos?\n\nquanto vendemos?\nonde vejo as notas?" };
    const edited = applyEdits(draftContent, form);
    expect(edited.plain_language_summary).toBe("Vendas por nota.");
    expect(edited.example_questions).toEqual(["quanto vendemos?", "onde vejo as notas?"]);
  });

  it("rascunho anterior ao contrato v2 não acusa alteração sem edição", () => {
    const legacy = { ...draftContent } as Partial<typeof draftContent>;
    delete legacy.plain_language_summary;
    delete legacy.example_questions;
    const original = legacy as typeof draftContent;
    expect(hasChanges(original, toForm(original))).toBe(false);
  });
});
