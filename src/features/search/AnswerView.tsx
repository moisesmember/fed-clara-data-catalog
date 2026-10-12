import { Link } from "react-router";

import type { AnswerSuggestion, AskResponse } from "@/api/types";
import { formatDuration } from "@/shared/format";
import { Badge, Button } from "@/shared/ui/primitives";
import { Alert } from "@/shared/ui/states";
import { TrustBadge } from "@/shared/ui/statusBadges";

import { FeedbackBar, RequestHelpButton } from "./HelpActions";

const EVIDENCE_LABEL = { supported: "Bem fundamentada", partial: "Parcialmente fundamentada", none: "Sem evidência" } as const;

export interface AnswerViewProps {
  response: AskResponse;
  question: string;
  /** Escolha de uma opção de esclarecimento: refaz a pergunta já com o assunto escolhido. */
  onChoose?: (option: AnswerSuggestion) => void;
}

function ExpandedTerms({ terms }: { terms: string[] }) {
  if (!terms.length) return null;
  return (
    <p className="xsmall muted">
      Entendi “{terms.join("”, “")}” usando o glossário da empresa.
    </p>
  );
}

function SuggestionList({ suggestions, onChoose }: { suggestions: AnswerSuggestion[]; onChoose?: (option: AnswerSuggestion) => void }) {
  return (
    <ul className="options">
      {suggestions.map((option) => (
        <li key={option.asset_id} className="option">
          <div className="stack-sm">
            <strong>{option.business_name}</strong>
            <span className="xsmall muted">
              {option.subject ? `${option.subject} · ` : ""}domínio {option.domain}
              {option.owner ? ` · responsável: ${option.owner}` : ""}
            </span>
          </div>
          <div className="cluster">
            <TrustBadge status={option.trust_status} />
            {onChoose ? (
              <Button size="sm" variant="primary" onClick={() => onChoose(option)}>
                É este
              </Button>
            ) : null}
            <Link to={`/fichas/${option.asset_id}`} className="small">
              Ver ficha →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Resposta pensada para quem não é técnico: nunca termina num "não sei" sem caminho. */
export function AnswerView({ response: raw, question, onChoose }: AnswerViewProps) {
  // Campos da descoberta guiada podem faltar em respostas de versões anteriores da API.
  const response = { ...raw, suggestions: raw.suggestions ?? [], expanded_terms: raw.expanded_terms ?? [], degraded: raw.degraded ?? [] };
  if (response.status === "clarify") {
    return (
      <article className="answer stack" aria-label="Escolha o assunto">
        <ExpandedTerms terms={response.expanded_terms} />
        <p className="answer__text">{response.answer}</p>
        <SuggestionList suggestions={response.suggestions} onChoose={onChoose} />
        <RequestHelpButton question={question} label="Nenhum destes — pedir ajuda" />
      </article>
    );
  }
  if (response.status === "out_of_scope") {
    return (
      <article className="answer stack" aria-label="Onde encontrar este dado">
        <Alert tone="info">
          <strong>Eu não calculo valores nem gero consultas</strong>, mas posso mostrar onde estão os dados e quem pode ajudar.
        </Alert>
        {response.suggestions.length ? (
          <>
            <p className="small">Estes dados podem responder à sua pergunta:</p>
            <SuggestionList suggestions={response.suggestions} />
            <p className="xsmall muted">Fale com o responsável indicado ou com a equipe de análise da sua área.</p>
          </>
        ) : (
          <>
            <p className="small">{response.answer}</p>
            <RequestHelpButton question={question} />
          </>
        )}
      </article>
    );
  }
  if (response.status === "no_evidence") {
    return (
      <article className="answer stack" aria-label="Sem resposta">
        <ExpandedTerms terms={response.expanded_terms} />
        <Alert tone="info">
          <strong>Não encontrei uma ficha que responda a isso.</strong> {response.answer}
        </Alert>
        <p className="small muted">Dica: descreva o processo de negócio (ex.: “vendas da loja”, “cadastro de clientes”) ou navegue pelos assuntos.</p>
        <RequestHelpButton question={question} />
      </article>
    );
  }
  return (
    <article className="answer stack" aria-label="Resposta">
      <ExpandedTerms terms={response.expanded_terms} />
      <div className="cluster">
        {response.evidence_status ? (
          <Badge tone={response.evidence_status === "supported" ? "success" : "warning"}>{EVIDENCE_LABEL[response.evidence_status]}</Badge>
        ) : null}
        {response.degraded.length ? <Badge tone="warning">Busca por significado indisponível — usei só a busca por palavras</Badge> : null}
      </div>
      <p className="answer__text">{response.answer}</p>
      {response.citations.length ? (
        <div className="stack-sm">
          <h3 className="small">Fontes citadas</h3>
          <ul className="citations">
            {response.citations.map((citation) => (
              <li key={citation.context_id}>
                <Link to={`/fichas/${citation.asset_id}`} className="citation">
                  <span className="citation__id">{citation.context_id}</span>
                  <code>{citation.fqn}</code>
                  <span className="muted xsmall">
                    r{citation.publication_revision} · v{citation.asset_version}
                  </span>
                  <TrustBadge status={citation.trust_status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <FeedbackBar question={question} mode={response.mode} />
      <p className="xsmall muted">
        {response.metrics.docs_retrieved} trecho(s) consultado(s) · {formatDuration(response.metrics.wall_ms)} · busca{" "}
        {response.mode === "hybrid" ? "por palavras e significado" : "por palavras"}
      </p>
    </article>
  );
}
