import { Link } from "react-router";

import type { SearchHit } from "@/api/types";
import { Badge } from "@/shared/ui/primitives";
import { EmptyState } from "@/shared/ui/states";
import { TrustBadge, VisibilityBadge } from "@/shared/ui/statusBadges";

const BRANCH_LABEL: Record<string, string> = { text: "texto", vector: "semântica" };

/** `technical` mostra nome técnico, revisão e como a ficha foi encontrada (para quem lê metadados). */
export function SearchResults({ hits, query, technical = false }: { hits: SearchHit[]; query: string; technical?: boolean }) {
  if (hits.length === 0) {
    return (
      <EmptyState title={`Nenhuma ficha publicada encontrada para “${query}”`}>
        Tente sinônimos ou termos de negócio. Só aparecem fichas publicadas que você tem permissão de ver.
      </EmptyState>
    );
  }
  return (
    <ol className="results" aria-label="Resultados da busca">
      {hits.map((hit) => (
        <li key={hit.card_id} className="result">
          <div className="spread">
            <Link to={`/fichas/${hit.asset_id}`} className="result__title">
              {hit.business_name || hit.fqn}
            </Link>
            <div className="cluster">
              <TrustBadge status={hit.trust_status} />
              <VisibilityBadge visibility={hit.visibility} />
              {hit.review_required ? (
                <Badge tone="warning" title="A origem mudou depois da publicação; um curador ainda vai revisar a ficha.">
                  Pode estar desatualizada
                </Badge>
              ) : null}
            </div>
          </div>
          {hit.summary ? (
            <p className="result__summary">{hit.summary}</p>
          ) : (
            <p className="result__summary muted">Esta ficha ainda não tem uma descrição. Abra para ver as colunas e o responsável.</p>
          )}
          <dl className="result__facts">
            {hit.subject ? (
              <div>
                <dt>Assunto</dt>
                <dd>{hit.subject}</dd>
              </div>
            ) : null}
            <div>
              <dt>Área</dt>
              <dd>{hit.domain}</dd>
            </div>
            <div>
              <dt>Responsável</dt>
              <dd>{hit.owner || "não informado"}</dd>
            </div>
          </dl>
          {technical ? (
            <div className="cluster xsmall muted">
              <code className="result__fqn">{hit.fqn}</code>
              <span aria-hidden="true">·</span>
              <span>
                Publicação r{hit.revision_no} · versão técnica v{hit.asset_version_no}
              </span>
              <span aria-hidden="true">·</span>
              <span>Encontrado por {hit.branches.map((b) => BRANCH_LABEL[b] ?? b).join(" + ")}</span>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
