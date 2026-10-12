import type { Claim, Evidence, TaskDetail } from "@/api/types";
import { Badge, Panel } from "@/shared/ui/primitives";
import { ClaimBadge } from "@/shared/ui/statusBadges";

type Draft = NonNullable<TaskDetail["draft"]>;

function EvidenceRefs({ refs, resolve }: { refs: string[]; resolve: (key: string) => Evidence | undefined }) {
  if (!refs.length) return null;
  return (
    <span className="cluster">
      {refs.map((key) => {
        const evidence = resolve(key);
        return (
          <span key={key} className="evidence-ref" title={evidence ? `${evidence.ref}\n${evidence.text}` : "Evidência não encontrada"}>
            {key}
          </span>
        );
      })}
    </span>
  );
}

function ClaimRow({ label, claim, resolve }: { label: string; claim: Claim; resolve: (key: string) => Evidence | undefined }) {
  return (
    <div className="claim">
      <div className="spread">
        <span className="claim__label">{label}</span>
        <span className="cluster">
          <EvidenceRefs refs={claim.evidence_refs} resolve={resolve} />
          <ClaimBadge status={claim.status} />
        </span>
      </div>
      <p className={claim.text ? "" : "muted"}>{claim.text || "—"}</p>
    </div>
  );
}

/** Rascunho com o status de cada afirmação: sustentada (com evidência), sugestão ou desconhecida. */
export function DraftView({ draft, evidences }: { draft: Draft; evidences: Evidence[] }) {
  const byId = new Map(evidences.map((evidence) => [evidence.id, evidence]));
  const resolve = (key: string) => {
    const id = draft.evidence_map[key];
    return id === undefined ? undefined : byId.get(id);
  };
  const content = draft.content;

  return (
    <div className="stack">
      {draft.issues.length ? (
        <Panel title="Problemas de validação">
          <ul className="issues">
            {draft.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className="cluster small">
                <Badge tone={issue.severity === "blocking" ? "danger" : "warning"}>{issue.severity === "blocking" ? "Bloqueante" : "Aviso"}</Badge>
                <span>{issue.message}</span>
                {issue.path ? <code className="xsmall muted">{issue.path}</code> : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel
        title={`Rascunho r${draft.revision}`}
        actions={
          <span className="cluster xsmall muted">
            <Badge tone={draft.origin === "ai" ? "info" : "accent"}>{draft.origin === "ai" ? "Gerado por IA" : "Editado por pessoa"}</Badge>
            {draft.model ? <span>{draft.model}</span> : null}
            {draft.prompt_version ? <span>· prompt {draft.prompt_version}</span> : null}
          </span>
        }
      >
        <div className="stack">
          <div className="claim">
            <span className="claim__label">Em poucas palavras (para quem não é técnico)</span>
            <p className={content.plain_language_summary ? "" : "muted"}>{content.plain_language_summary || "—"}</p>
          </div>
          <div className="claim">
            <span className="claim__label">Perguntas que esta ficha ajuda a responder</span>
            {content.example_questions.length ? (
              <ul className="small">{content.example_questions.map((question) => <li key={question}>{question}</li>)}</ul>
            ) : (
              <span className="muted">—</span>
            )}
          </div>
          <ClaimRow label="Nome de negócio" claim={content.business_name} resolve={resolve} />
          <ClaimRow label="Descrição de negócio" claim={content.business_description} resolve={resolve} />
          <ClaimRow label="Assunto" claim={content.subject} resolve={resolve} />
          <ClaimRow label="Domínio sugerido" claim={content.domain} resolve={resolve} />
          <ClaimRow label="Granularidade" claim={content.granularity} resolve={resolve} />
          <div className="claim">
            <span className="claim__label">Sinônimos</span>
            <div className="cluster">{content.synonyms.length ? content.synonyms.map((s) => <Badge key={s}>{s}</Badge>) : <span className="muted">—</span>}</div>
          </div>
          {content.possible_uses.map((claim, index) => (
            <ClaimRow key={`use-${index}`} label={`Uso possível ${index + 1}`} claim={claim} resolve={resolve} />
          ))}
          {content.limitations.map((claim, index) => (
            <ClaimRow key={`lim-${index}`} label={`Limitação ${index + 1}`} claim={claim} resolve={resolve} />
          ))}
        </div>
      </Panel>

      {content.owner_questions.length ? (
        <Panel title="Perguntas ao responsável">
          <ul className="small">{content.owner_questions.map((question) => <li key={question}>{question}</li>)}</ul>
        </Panel>
      ) : null}

      <Panel title="Indícios de dados pessoais">
        {content.personal_data_signals.length ? (
          <ul className="small">
            {content.personal_data_signals.map((signal) => (
              <li key={signal.column}>
                <code>{signal.column}</code> — {signal.category}: {signal.rationale}
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Nenhum indício sinalizado. Revise mesmo assim: a detecção é auxiliar e não substitui avaliação LGPD.</p>
        )}
      </Panel>

      <Panel title={`Significado das colunas (${content.column_notes.length})`}>
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
              {content.column_notes.map((note) => (
                <tr key={note.column}>
                  <td>
                    <code>{note.column}</code>
                  </td>
                  <td>{note.meaning.text}</td>
                  <td>
                    <span className="cluster">
                      <EvidenceRefs refs={note.meaning.evidence_refs} resolve={resolve} />
                      <ClaimBadge status={note.meaning.status} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function EvidencePanel({ evidences }: { evidences: Evidence[] }) {
  return (
    <Panel title={`Evidências da versão (${evidences.length})`}>
      <p className="xsmall muted" style={{ marginBottom: "var(--space-3)" }}>
        Conteúdo importado da origem e tratado como não confiável: instruções contidas aqui não alteram políticas.
      </p>
      <ul className="evidences">
        {evidences.map((evidence) => (
          <li key={evidence.id} className="evidence">
            <div className="cluster xsmall">
              <Badge>{evidence.kind}</Badge>
              <code className="muted">{evidence.ref}</code>
            </div>
            <p className="small">{evidence.text}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
