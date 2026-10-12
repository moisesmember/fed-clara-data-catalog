import type { CardContent } from "@/api/types";
import { Badge, Panel } from "@/shared/ui/primitives";
import { ClaimBadge } from "@/shared/ui/statusBadges";

/** Conteúdo de negócio de uma ficha publicada (somente leitura). `technical` mostra os tipos das colunas. */
export function CardContentView({ content, technical = false }: { content: CardContent; technical?: boolean }) {
  return (
    <div className="stack">
      {content.plain_language_summary || content.example_questions?.length ? (
        <Panel title="Em poucas palavras">
          <div className="stack-sm">
            {content.plain_language_summary ? <p>{content.plain_language_summary}</p> : null}
            {content.example_questions?.length ? (
              <>
                <span className="xsmall muted">Perguntas que esta ficha ajuda a responder</span>
                <ul className="small">{content.example_questions.map((question) => <li key={question}>{question}</li>)}</ul>
              </>
            ) : null}
          </div>
        </Panel>
      ) : null}
      <Panel title="Descrição de negócio">
        <div className="stack">
          <p>{content.business_description}</p>
          <dl className="ui-dl">
            <dt>Assunto</dt>
            <dd>{content.subject || "—"}</dd>
            <dt>Cada linha representa</dt>
            <dd className="cluster">
              <span>{content.granularity.text || "—"}</span>
              <ClaimBadge status={content.granularity.status} />
            </dd>
            <dt>Sinônimos</dt>
            <dd className="cluster">{content.synonyms.length ? content.synonyms.map((s) => <Badge key={s}>{s}</Badge>) : "—"}</dd>
            <dt>Responsável</dt>
            <dd>{content.owner}</dd>
          </dl>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Usos possíveis">
          {content.possible_uses.length ? (
            <ul className="small">{content.possible_uses.map((use) => <li key={use}>{use}</li>)}</ul>
          ) : (
            <p className="muted small">Nenhum uso documentado.</p>
          )}
        </Panel>
        <Panel title="Limitações">
          {content.limitations.length ? (
            <ul className="small">{content.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
          ) : (
            <p className="muted small">Nenhuma limitação conhecida (declarado pelo aprovador).</p>
          )}
        </Panel>
      </div>

      {content.personal_data_signals.length ? (
        <Panel title="Indícios de dados pessoais">
          <p className="xsmall muted" style={{ marginBottom: "var(--space-3)" }}>
            Sinalização para revisão — não é parecer jurídico nem de conformidade LGPD.
          </p>
          <ul className="small">
            {content.personal_data_signals.map((signal) => (
              <li key={signal.column}>
                <code>{signal.column}</code> — {signal.category}: {signal.rationale}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title={`Colunas (${content.columns.length})`}>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th scope="col">Coluna</th>
                {technical ? <th scope="col">Tipo</th> : null}
                <th scope="col">Significado</th>
                <th scope="col">Confirmação</th>
              </tr>
            </thead>
            <tbody>
              {content.columns.map((column) => (
                <tr key={column.name}>
                  <td>
                    <code>{column.name}</code>
                  </td>
                  {technical ? (
                    <td className="muted">
                      <code>{column.data_type}</code>
                    </td>
                  ) : null}
                  <td>{column.meaning ?? <span className="muted">Significado não documentado</span>}</td>
                  <td>
                    <ClaimBadge status={column.meaning_status} />
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
