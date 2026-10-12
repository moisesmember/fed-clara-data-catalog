import type { Claim, DraftContent } from "@/api/types";

/** Campos editáveis pelo revisor (o restante do rascunho é preservado como está). */
export interface DraftForm {
  businessName: string;
  businessDescription: string;
  subject: string;
  granularity: string;
  synonyms: string;
  limitations: string;
  /** Linguagem simples, para quem não é técnico (contrato v2). */
  plainLanguageSummary: string;
  /** Uma pergunta por linha. */
  exampleQuestions: string;
}

export function toForm(content: DraftContent): DraftForm {
  return {
    businessName: content.business_name.text,
    businessDescription: content.business_description.text,
    subject: content.subject.text,
    granularity: content.granularity.text,
    synonyms: content.synonyms.join(", "),
    limitations: content.limitations.map((claim) => claim.text).join("\n"),
    plainLanguageSummary: content.plain_language_summary ?? "",
    exampleQuestions: (content.example_questions ?? []).join("\n"),
  };
}

/** Texto alterado pelo revisor passa a "supported" sem referência a evidência: é afirmação
 *  humana revisada. Texto inalterado mantém status e evidências originais. */
function revise(original: Claim, text: string): Claim {
  const trimmed = text.trim();
  if (trimmed === original.text.trim()) return original;
  return { text: trimmed, status: trimmed ? "supported" : "unknown", evidence_refs: [] };
}

function splitList(value: string, separator: RegExp): string[] {
  return [...new Set(value.split(separator).map((item) => item.trim()).filter(Boolean))];
}

export function applyEdits(original: DraftContent, form: DraftForm): DraftContent {
  const previousLimitations = new Map(original.limitations.map((claim) => [claim.text.trim(), claim]));
  const edited: DraftContent = {
    ...original,
    business_name: revise(original.business_name, form.businessName),
    business_description: revise(original.business_description, form.businessDescription),
    subject: revise(original.subject, form.subject),
    granularity: revise(original.granularity, form.granularity),
    synonyms: splitList(form.synonyms, /,/),
    limitations: splitList(form.limitations, /\n/).map(
      (text) => previousLimitations.get(text) ?? { text, status: "supported", evidence_refs: [] },
    ),
  };
  // Rascunhos anteriores ao contrato v2 não têm os campos: só os acrescenta se houver conteúdo,
  // para não acusar "alteração" sem que o revisor tenha mudado nada.
  const summary = form.plainLanguageSummary.trim();
  const questions = splitList(form.exampleQuestions, /\n/);
  if ("plain_language_summary" in original || summary) edited.plain_language_summary = summary;
  if ("example_questions" in original || questions.length) edited.example_questions = questions;
  return edited;
}

export function hasChanges(original: DraftContent, form: DraftForm): boolean {
  return JSON.stringify(applyEdits(original, form)) !== JSON.stringify(original);
}
