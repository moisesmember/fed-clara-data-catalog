import { Link } from "react-router";

import type { SearchHit } from "@/api/types";
import { Badge } from "@/shared/ui/primitives";
import { EmptyState } from "@/shared/ui/states";
import { TrustBadge, VisibilityBadge } from "@/shared/ui/statusBadges";

const BRANCH_LABEL: Record<string, string> = { text: "texto", vector: "semântica" };

export function SearchResults({ hits, query }: { hits: SearchHit[]; query: string }) {
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
              {hit.review_required ? <Badge tone="warning">Revisão pendente</Badge> : null}
            </div>
          </div>
          <code className="result__fqn">{hit.fqn}</code>
          <div className="cluster xsmall muted">
            <span>Domínio {hit.domain}</span>
            <span aria-hidden="true">·</span>
            <span>
              Publicação r{hit.revision_no} · versão técnica v{hit.asset_version_no}
            </span>
            <span aria-hidden="true">·</span>
            <span>Encontrado por {hit.branches.map((b) => BRANCH_LABEL[b] ?? b).join(" + ")}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
