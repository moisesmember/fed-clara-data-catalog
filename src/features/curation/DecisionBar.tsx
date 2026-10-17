import { useState, type FormEvent } from "react";

import { VISIBILITIES, type ChangeKind, type DraftContent, type ReviewSubmission, type TaskDetail, type Visibility } from "@/api/types";
import { Button, Checkbox, Field, Select, TextArea, TextInput } from "@/shared/ui/primitives";
import { visibilityDescription, visibilityLabel } from "@/shared/ui/statusBadges";

import { isCardEdit } from "./taskKinds";

type Mode = "approve" | "regenerate" | "reject";

export interface DecisionBarProps {
  task: TaskDetail;
  canApprove: boolean;
  /** Há edições do revisor no conteúdo exibido. */
  edited: boolean;
  /** Conteúdo com as edições aplicadas (chamado só no envio). */
  editedContent: () => DraftContent;
  /** O campo de limitações está vazio: só então cabe declarar "nenhuma conhecida". */
  noLimitations: boolean;
  submitting: boolean;
  onSubmit: (submission: ReviewSubmission) => void;
}

/**
 * Ações de revisão, fixas no fim da página: lê-se e edita-se a ficha primeiro, decide-se depois.
 * A concorrência otimista usa a revisão e a versão exibidas na tela.
 */
export function DecisionBar({ task, canApprove, edited, editedContent, noLimitations, submitting, onSubmit }: DecisionBarProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [owner, setOwner] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("domain");
  const [limitationsNoneKnown, setLimitationsNoneKnown] = useState(false);
  // Edição de ficha costuma ser correção de texto: sugere "editorial" (o aprovador decide).
  const [changeKind, setChangeKind] = useState<ChangeKind>(isCardEdit(task.kind) ? "editorial" : "substantive");
  const [notes, setNotes] = useState("");

  const base = (decision: ReviewSubmission["decision"]): ReviewSubmission => ({
    decision,
    expected_draft_revision: task.draft_revision,
    expected_asset_version_id: task.asset_version_id,
    notes: notes.trim() || undefined,
  });

  const toggle = (next: Mode) => setMode((current) => (current === next ? null : next));
  const saveEdits = () => onSubmit({ ...base("request_changes"), notes: undefined, edits: editedContent() });

  const approve = (publish: boolean) =>
    onSubmit({
      ...base("approve"),
      edits: edited ? editedContent() : undefined,
      confirmed_owner: owner.trim() || undefined,
      visibility,
      limitations_none_known: noLimitations && limitationsNoneKnown,
      change_kind: changeKind,
      publish,
    });

  const ownerMissing = !owner.trim();
  const submitMode = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "approve") {
      if (!ownerMissing) approve(true);
    } else if (mode) {
      onSubmit(base(mode));
    }
  };

  return (
    <section className="decision-bar" aria-label="Sua decisão">
      {mode ? (
        <form className="decision-bar__panel stack-sm" onSubmit={submitMode}>
          {mode === "approve" ? (
            <>
              <h2 className="decision-bar__title">Aprovar{edited ? " com as suas edições" : ""}</h2>
              <div className="decision-bar__grid">
                <Field label="Responsável confirmado" hint="Obrigatório para publicar. Nunca é definido pela IA." error={ownerMissing ? "Informe o responsável de negócio." : undefined}>
                  {(props) => <TextInput {...props} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="ex.: risco.credito" autoFocus />}
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
                <Field label="Tipo de mudança" hint="Correção editorial preserva o selo de confiança atual.">
                  {(props) => (
                    <Select {...props} value={changeKind} onChange={(e) => setChangeKind(e.target.value as ChangeKind)}>
                      <option value="substantive">Substantiva (muda o sentido)</option>
                      <option value="editorial">Editorial (só correção de texto)</option>
                    </Select>
                  )}
                </Field>
              </div>
              {noLimitations ? (
                <Checkbox label="Não há limitações conhecidas (declaração explícita)" checked={limitationsNoneKnown} onChange={(e) => setLimitationsNoneKnown(e.target.checked)} />
              ) : null}
            </>
          ) : (
            <h2 className="decision-bar__title">{mode === "regenerate" ? "Pedir novo rascunho à IA" : "Rejeitar a tarefa"}</h2>
          )}

          <Field
            label="Notas"
            hint={mode === "regenerate" ? "Diga o que corrigir: o novo rascunho usa estas notas como orientação." : mode === "reject" ? "Explique o motivo; fica registrado na auditoria." : "Registradas na auditoria."}
          >
            {(props) => <TextArea {...props} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} autoFocus={mode !== "approve"} />}
          </Field>

          <div className="cluster decision-bar__confirm">
            {mode === "approve" ? (
              <>
                <Button type="submit" variant="primary" loading={submitting} disabled={ownerMissing}>
                  Aprovar e publicar
                </Button>
                <Button onClick={() => approve(false)} disabled={submitting} title="Registra a aprovação; a publicação fica para depois.">
                  Aprovar sem publicar
                </Button>
              </>
            ) : (
              <Button type="submit" variant={mode === "reject" ? "danger" : "primary"} loading={submitting}>
                {mode === "reject" ? "Confirmar rejeição" : "Pedir novo rascunho"}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setMode(null)} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      <div className="decision-bar__actions">
        <span className="xsmall muted">{edited ? "Você alterou a ficha." : "Sem alterações."}</span>
        <div className="cluster">
          <Button onClick={saveEdits} disabled={!edited || submitting} loading={submitting && !mode} title={edited ? undefined : "Edite a ficha acima para salvar."}>
            Salvar edições e revalidar
          </Button>
          <Button variant="ghost" aria-pressed={mode === "regenerate"} onClick={() => toggle("regenerate")} disabled={submitting}>
            Pedir novo rascunho à IA
          </Button>
          {canApprove ? (
            <>
              <Button variant="ghost" aria-pressed={mode === "reject"} onClick={() => toggle("reject")} disabled={submitting}>
                Rejeitar
              </Button>
              <Button variant="primary" aria-pressed={mode === "approve"} onClick={() => toggle("approve")} disabled={submitting}>
                Aprovar…
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {!canApprove ? <p className="xsmall muted">Aprovar e rejeitar exigem papel de aprovador neste domínio.</p> : null}
    </section>
  );
}
