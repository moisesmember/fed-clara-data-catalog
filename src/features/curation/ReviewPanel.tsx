import { useState, type FormEvent } from "react";

import { VISIBILITIES, type ChangeKind, type ReviewDecision, type ReviewSubmission, type TaskDetail, type Visibility } from "@/api/types";
import { Button, Checkbox, Field, Panel, Select, TextArea, TextInput } from "@/shared/ui/primitives";
import { visibilityDescription, visibilityLabel } from "@/shared/ui/statusBadges";

import { applyEdits, hasChanges, toForm, type DraftForm } from "./draftEdits";
import { isCardEdit } from "./taskKinds";

interface DecisionOption {
  value: ReviewDecision;
  label: string;
  description: string;
  needsApprover: boolean;
}

const DECISIONS: DecisionOption[] = [
  { value: "approve", label: "Aprovar", description: "Aprova (com as edições abaixo, se houver) e publica.", needsApprover: true },
  { value: "request_changes", label: "Editar e revalidar", description: "Salva suas edições como nova revisão e valida de novo.", needsApprover: false },
  { value: "regenerate", label: "Regenerar", description: "Pede um novo rascunho ao modelo, com suas notas como orientação.", needsApprover: false },
  { value: "reject", label: "Rejeitar", description: "Encerra a tarefa sem publicar.", needsApprover: true },
];

export interface ReviewPanelProps {
  task: TaskDetail;
  canApprove: boolean;
  submitting: boolean;
  onSubmit: (submission: ReviewSubmission) => void;
}

/** Formulário de decisão. A concorrência otimista usa a revisão e a versão exibidas na tela. */
export function ReviewPanel({ task, canApprove, submitting, onSubmit }: ReviewPanelProps) {
  const draft = task.draft;
  const available = DECISIONS.filter((option) => canApprove || !option.needsApprover);
  const [decision, setDecision] = useState<ReviewDecision>(available[0]?.value ?? "request_changes");
  const [form, setForm] = useState<DraftForm | null>(draft ? toForm(draft.content) : null);
  const [owner, setOwner] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("domain");
  const [limitationsNoneKnown, setLimitationsNoneKnown] = useState(false);
  // Edição de ficha costuma ser correção de texto: sugere "editorial" (o aprovador decide).
  const [changeKind, setChangeKind] = useState<ChangeKind>(isCardEdit(task.kind) ? "editorial" : "substantive");
  const [publish, setPublish] = useState(true);
  const [notes, setNotes] = useState("");

  if (!draft || !form) return null;

  const edited = hasChanges(draft.content, form);
  const update = (key: keyof DraftForm) => (value: string) => setForm({ ...form, [key]: value });
  const ownerMissing = decision === "approve" && publish && !owner.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const base: ReviewSubmission = {
      decision,
      expected_draft_revision: task.draft_revision,
      expected_asset_version_id: task.asset_version_id,
      notes: notes.trim() || undefined,
    };
    if (decision === "approve") {
      onSubmit({
        ...base,
        edits: edited ? applyEdits(draft.content, form) : undefined,
        confirmed_owner: owner.trim() || undefined,
        visibility,
        limitations_none_known: limitationsNoneKnown,
        change_kind: changeKind,
        publish,
      });
    } else if (decision === "request_changes") {
      onSubmit({ ...base, edits: applyEdits(draft.content, form) });
    } else {
      onSubmit(base);
    }
  };

  const showEditor = decision === "approve" || decision === "request_changes";

  return (
    <Panel title="Sua decisão">
      <form className="stack" onSubmit={submit}>
        <fieldset className="decisions">
          <legend className="ui-field__label">Decisão</legend>
          {available.map((option) => (
            <label key={option.value} className={`decision ${decision === option.value ? "decision--active" : ""}`}>
              <input type="radio" name="decision" value={option.value} checked={decision === option.value} onChange={() => setDecision(option.value)} />
              <span>
                <strong>{option.label}</strong>
                <span className="xsmall muted">{option.description}</span>
              </span>
            </label>
          ))}
          {!canApprove ? <p className="xsmall muted">Aprovar e rejeitar exigem papel de aprovador neste domínio.</p> : null}
        </fieldset>

        {showEditor ? (
          <fieldset className="stack-sm editor">
            <legend className="ui-field__label">Conteúdo revisado {edited ? <span className="xsmall muted">(alterado)</span> : null}</legend>
            <Field label="Em poucas palavras" hint="Para quem não é técnico: para que serve, sem jargão nem nomes de colunas.">
              {(props) => <TextArea {...props} value={form.plainLanguageSummary} onChange={(e) => update("plainLanguageSummary")(e.target.value)} rows={2} />}
            </Field>
            <Field label="Perguntas que esta ficha responde" hint="Uma por linha, como um usuário perguntaria. Ajudam a busca a encontrar a ficha.">
              {(props) => <TextArea {...props} value={form.exampleQuestions} onChange={(e) => update("exampleQuestions")(e.target.value)} rows={3} />}
            </Field>
            <Field label="Nome de negócio">{(props) => <TextInput {...props} value={form.businessName} onChange={(e) => update("businessName")(e.target.value)} />}</Field>
            <Field label="Descrição de negócio">{(props) => <TextArea {...props} value={form.businessDescription} onChange={(e) => update("businessDescription")(e.target.value)} rows={3} />}</Field>
            <Field label="Assunto">{(props) => <TextInput {...props} value={form.subject} onChange={(e) => update("subject")(e.target.value)} />}</Field>
            <Field label="Granularidade" hint="Preencha só se comprovada (ex.: uma linha por item de nota fiscal).">
              {(props) => <TextInput {...props} value={form.granularity} onChange={(e) => update("granularity")(e.target.value)} />}
            </Field>
            <Field label="Sinônimos" hint="Separados por vírgula.">{(props) => <TextInput {...props} value={form.synonyms} onChange={(e) => update("synonyms")(e.target.value)} />}</Field>
            <Field label="Limitações" hint="Uma por linha.">{(props) => <TextArea {...props} value={form.limitations} onChange={(e) => update("limitations")(e.target.value)} rows={3} />}</Field>
          </fieldset>
        ) : null}

        {decision === "approve" ? (
          <fieldset className="stack-sm editor">
            <legend className="ui-field__label">Publicação</legend>
            <Field label="Responsável confirmado" hint="Obrigatório para publicar. Nunca é definido pela IA." error={ownerMissing ? "Informe o responsável de negócio." : undefined}>
              {(props) => <TextInput {...props} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="ex.: risco.credito" />}
            </Field>
            <Field label="Visibilidade" hint={visibilityDescription(visibility)}>
              {(props) => (
                <Select {...props} value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
                  {VISIBILITIES.map((option) => (
                    <option key={option} value={option}>
                      {visibilityLabel(option)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Checkbox label="Não há limitações conhecidas (declaração explícita)" checked={limitationsNoneKnown} onChange={(e) => setLimitationsNoneKnown(e.target.checked)} />
            <Field label="Tipo de mudança" hint="Correção editorial preserva o selo de confiança atual.">
              {(props) => (
                <Select {...props} value={changeKind} onChange={(e) => setChangeKind(e.target.value as ChangeKind)}>
                  <option value="substantive">Substantiva</option>
                  <option value="editorial">Editorial</option>
                </Select>
              )}
            </Field>
            <Checkbox label="Publicar imediatamente após aprovar" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          </fieldset>
        ) : null}

        <Field label="Notas" hint={decision === "regenerate" ? "Orientação para o novo rascunho." : "Registradas na auditoria."}>
          {(props) => <TextArea {...props} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />}
        </Field>

        <div className="spread">
          <span className="xsmall muted">
            Revisão r{task.draft_revision} · versão técnica #{task.asset_version_id}
          </span>
          <Button type="submit" variant={decision === "reject" ? "danger" : "primary"} loading={submitting} disabled={ownerMissing}>
            {DECISIONS.find((option) => option.value === decision)?.label}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
