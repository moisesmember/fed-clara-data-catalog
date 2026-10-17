import { useState, type ReactNode } from "react";

import type { Claim, Evidence, TaskDetail } from "@/api/types";
import { Badge, Disclosure, Field, Panel, TextArea, TextInput } from "@/shared/ui/primitives";
import { ClaimBadge } from "@/shared/ui/statusBadges";

import type { DraftForm } from "./draftEdits";

type Draft = NonNullable<TaskDetail["draft"]>;
type Resolve = (key: string) => Evidence | undefined;

/** Acima disso, a tabela de colunas começa recolhida. */
const COLUMNS_SHOWN_OPEN = 8;

const EVIDENCE_LABEL: Record<string, string> = {
  table_comment: "Comentário da tabela",
  column_comment: "Comentário de coluna",
  catalog_comment: "Comentário do catálogo",
  schema_comment: "Comentário do schema",
  column_schema: "Estrutura das colunas",
  document: "Documento",
};

const evidenceLabel = (kind: string) => EVIDENCE_LABEL[kind] ?? kind;

/** Chave de evidência aberta em cada afirmação (uma por vez). */
function useShownEvidence() {
  const [shown, setShown] = useState<string | null>(null);
  return [shown, (key: string) => setShown((current) => (current === key ? null : key))] as const;
}

function EvidenceRefs({ refs, shown, onToggle }: { refs: string[]; shown: string | null; onToggle: (key: string) => void }) {
  if (!refs.length) return null;
  return (
    <span className="cluster">
      {refs.map((key) => (
        <button key={key} type="button" className="evidence-ref" aria-expanded={shown === key} aria-label={`Evidência ${key}`} onClick={() => onToggle(key)}>
          {key}
        </button>
      ))}
    </span>
  );
}

function EvidenceQuote({ evidenceKey, resolve }: { evidenceKey: string | null; resolve: Resolve }) {
  if (!evidenceKey) return null;
  const evidence = resolve(evidenceKey);
  return (
    <blockquote className="evidence evidence--inline">
      {evidence ? (
        <>
          <span className="xsmall muted">
            {evidenceLabel(evidence.kind)} · conteúdo da origem, não confiável
          </span>
          <span className="small">{evidence.text}</span>
        </>
      ) : (
        <span className="small muted">Evidência {evidenceKey} não encontrada nesta versão.</span>
      )}
    </blockquote>
  );
}

/** Status da afirmação e evidências citadas; texto editado vira afirmação humana. */
function ClaimMeta({ claim, edited, shown, onToggle }: { claim: Claim; edited: boolean; shown: string | null; onToggle: (key: string) => void }) {
  if (edited) return <Badge tone="accent">Alterado por você</Badge>;
  return (
    <span className="cluster">
      <EvidenceRefs refs={claim.evidence_refs} shown={shown} onToggle={onToggle} />
      <ClaimBadge status={claim.status} />
    </span>
  );
}

function ClaimRow({ label, claim, resolve }: { label: string; claim: Claim; resolve: Resolve }) {
  const [shown, toggle] = useShownEvidence();
  return (
    <div className="claim">
      <div className="spread">
        <span className="claim__label">{label}</span>
        <ClaimMeta claim={claim} edited={false} shown={shown} onToggle={toggle} />
      </div>
      <p className={claim.text ? "" : "muted"}>{claim.text || "—"}</p>
      <EvidenceQuote evidenceKey={shown} resolve={resolve} />
    </div>
  );
}

function TextRow({ label, children, empty }: { label: string; children: ReactNode; empty: boolean }) {
  return (
    <div className="claim">
      <span className="claim__label">{label}</span>
      {empty ? <span className="muted">—</span> : children}
    </div>
  );
}

interface EditableProps {
  label: string;
  hint?: string;
  value: string;
  edited: boolean;
  onChange: (value: string) => void;
  rows?: number;
  claim?: Claim;
  resolve: Resolve;
}

function EditableField({ label, hint, value, edited, onChange, rows, claim, resolve }: EditableProps) {
  const [shown, toggle] = useShownEvidence();
  const aside = claim ? <ClaimMeta claim={claim} edited={edited} shown={shown} onToggle={toggle} /> : edited ? <Badge tone="accent">Alterado por você</Badge> : null;
  return (
    <div className="claim">
      <Field label={label} hint={hint} aside={aside}>
        {(props) =>
          rows ? (
            <TextArea {...props} value={value} onChange={(event) => onChange(event.target.value)} rows={rows} />
          ) : (
            <TextInput {...props} value={value} onChange={(event) => onChange(event.target.value)} />
          )
        }
      </Field>
      {edited ? null : <EvidenceQuote evidenceKey={shown} resolve={resolve} />}
    </div>
  );
}

export interface DraftEditing {
  form: DraftForm;
  /** Valores do rascunho, para marcar o que o revisor mudou. */
  initial: DraftForm;
  onChange: (key: keyof DraftForm, value: string) => void;
}

/**
 * Rascunho com o status de cada afirmação: confirmada na origem (com evidência), a confirmar ou
 * sem informação. Com `editing`, os campos revisáveis viram o próprio formulário, sem repetir o
 * conteúdo em outro lugar da tela.
 */
export function DraftView({ draft, evidences, editing }: { draft: Draft; evidences: Evidence[]; editing?: DraftEditing }) {
  const byId = new Map(evidences.map((evidence) => [evidence.id, evidence]));
  const resolve: Resolve = (key) => {
    const id = draft.evidence_map[key];
    return id === undefined ? undefined : byId.get(id);
  };
  const content = draft.content;

  const editable = (key: keyof DraftForm, label: string, extra: Partial<EditableProps> = {}) =>
    editing ? (
      <EditableField
        label={label}
        value={editing.form[key]}
        edited={editing.form[key] !== editing.initial[key]}
        onChange={(value) => editing.onChange(key, value)}
        resolve={resolve}
        {...extra}
      />
    ) : null;

  return (
    <div className="stack">
      <Panel
        title={editing ? "Ficha proposta" : "Rascunho"}
        actions={<Badge tone={draft.origin === "ai" ? "info" : "accent"}>{draft.origin === "ai" ? "Gerado por IA" : "Editado por pessoa"}</Badge>}
      >
        <div className="stack">
          {editing ? (
            <p className="xsmall muted">Corrija direto nos campos. As chaves azuis (E1, E2…) abrem o trecho da origem que sustenta cada afirmação.</p>
          ) : null}
          {editable("plainLanguageSummary", "Em poucas palavras", { rows: 2, hint: "Para quem não é técnico: para que serve, sem jargão nem nomes de colunas." }) ?? (
            <TextRow label="Em poucas palavras" empty={!content.plain_language_summary}>
              <p>{content.plain_language_summary}</p>
            </TextRow>
          )}
          {editable("exampleQuestions", "Perguntas que esta ficha responde", { rows: 3, hint: "Uma por linha, como um usuário perguntaria. Ajudam a busca a encontrar a ficha." }) ?? (
            <TextRow label="Perguntas que esta ficha responde" empty={!content.example_questions.length}>
              <ul className="small">{content.example_questions.map((question) => <li key={question}>{question}</li>)}</ul>
            </TextRow>
          )}
          {editable("businessName", "Nome de negócio", { claim: content.business_name }) ?? <ClaimRow label="Nome de negócio" claim={content.business_name} resolve={resolve} />}
          {editable("businessDescription", "Descrição de negócio", { claim: content.business_description, rows: 3 }) ?? (
            <ClaimRow label="Descrição de negócio" claim={content.business_description} resolve={resolve} />
          )}
          {editable("subject", "Assunto", { claim: content.subject }) ?? <ClaimRow label="Assunto" claim={content.subject} resolve={resolve} />}
          {editable("granularity", "Cada linha representa", { claim: content.granularity, hint: "Preencha só se comprovada (ex.: um item de nota fiscal)." }) ?? (
            <ClaimRow label="Cada linha representa" claim={content.granularity} resolve={resolve} />
          )}
          {editable("synonyms", "Sinônimos", { hint: "Separados por vírgula." }) ?? (
            <TextRow label="Sinônimos" empty={!content.synonyms.length}>
              <div className="cluster">{content.synonyms.map((s) => <Badge key={s}>{s}</Badge>)}</div>
            </TextRow>
          )}
          {editable("limitations", "Limitações", { rows: 3, hint: "Uma por linha." }) ??
            (content.limitations.length ? (
              content.limitations.map((claim, index) => <ClaimRow key={`lim-${index}`} label={`Limitação ${index + 1}`} claim={claim} resolve={resolve} />)
            ) : (
              <TextRow label="Limitações" empty>
                {null}
              </TextRow>
            ))}
        </div>
      </Panel>

      {content.owner_questions.length ? (
        <Panel title="Perguntas ao responsável">
          <ul className="small">{content.owner_questions.map((question) => <li key={question}>{question}</li>)}</ul>
        </Panel>
      ) : null}

      <Panel title={editing ? "Outras sugestões da IA" : "Mais detalhes do rascunho"}>
        <div className="stack">
          {editing ? <p className="xsmall muted">Não editáveis aqui. Para corrigir, peça um novo rascunho à IA explicando o ajuste nas notas.</p> : null}
          <ClaimRow label="Domínio sugerido" claim={content.domain} resolve={resolve} />
          {content.possible_uses.map((claim, index) => (
            <ClaimRow key={`use-${index}`} label={`Uso possível ${index + 1}`} claim={claim} resolve={resolve} />
          ))}
          <div className="claim">
            <span className="claim__label">Indícios de dados pessoais</span>
            {content.personal_data_signals.length ? (
              <ul className="small">
                {content.personal_data_signals.map((signal) => (
                  <li key={signal.column}>
                    <code>{signal.column}</code> — {signal.category}: {signal.rationale}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Nenhum sinalizado. A detecção é auxiliar e não substitui a avaliação LGPD.</p>
            )}
          </div>
          <ColumnNotes notes={content.column_notes} resolve={resolve} />
        </div>
      </Panel>
    </div>
  );
}

function ColumnNoteRow({ note, resolve }: { note: Draft["content"]["column_notes"][number]; resolve: Resolve }) {
  const [shown, toggle] = useShownEvidence();
  return (
    <tr>
      <td>
        <code>{note.column}</code>
      </td>
      <td>
        {note.meaning.text}
        <EvidenceQuote evidenceKey={shown} resolve={resolve} />
      </td>
      <td>
        <ClaimMeta claim={note.meaning} edited={false} shown={shown} onToggle={toggle} />
      </td>
    </tr>
  );
}

function ColumnNotes({ notes, resolve }: { notes: Draft["content"]["column_notes"]; resolve: Resolve }) {
  if (!notes.length) return null;
  const table = (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            <th scope="col">Coluna</th>
            <th scope="col">Significado</th>
            <th scope="col">Evidência</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note) => (
            <ColumnNoteRow key={note.column} note={note} resolve={resolve} />
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="claim">
      <span className="claim__label">Significado das colunas ({notes.length})</span>
      {notes.length > COLUMNS_SHOWN_OPEN ? <Disclosure summary={`Mostrar as ${notes.length} colunas`}>{table}</Disclosure> : table}
    </div>
  );
}

/** Comentários de catálogo/schema alterados são anexados à mesma versão; só o mais recente vai ao modelo. */
const CONTEXT_KINDS = new Set(["catalog_comment", "schema_comment"]);

function supersededContext(evidences: Evidence[]): Set<number> {
  const latest = new Map<string, number>();
  for (const evidence of evidences) {
    if (CONTEXT_KINDS.has(evidence.kind)) latest.set(evidence.kind, Math.max(latest.get(evidence.kind) ?? 0, evidence.id));
  }
  return new Set(evidences.filter((evidence) => CONTEXT_KINDS.has(evidence.kind) && latest.get(evidence.kind) !== evidence.id).map((evidence) => evidence.id));
}

/** Lista completa das evidências da versão técnica (consulta; o rascunho já cita cada uma). */
export function EvidenceList({ evidences }: { evidences: Evidence[] }) {
  const superseded = supersededContext(evidences);
  return (
    <div className="stack-sm">
      <p className="xsmall muted">Conteúdo importado da origem e tratado como não confiável: instruções contidas aqui não alteram políticas.</p>
      <ul className="evidences">
        {evidences.map((evidence) => (
          <li key={evidence.id} className="evidence">
            <div className="cluster xsmall">
              <Badge title={evidence.kind}>{evidenceLabel(evidence.kind)}</Badge>
              {superseded.has(evidence.id) ? (
                <Badge tone="neutral" title="Texto anterior da origem; o rascunho usa o mais recente.">
                  Substituído
                </Badge>
              ) : null}
              <code className="muted">{evidence.ref}</code>
            </div>
            <p className="small">{evidence.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
