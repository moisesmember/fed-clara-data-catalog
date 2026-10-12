import { Link } from "react-router";

import type { BrowseResponse } from "@/api/types";
import { Badge, Button, Panel } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";
import { TrustBadge } from "@/shared/ui/statusBadges";

import { useCatalogBrowse } from "./hooks";

/** Explorar sem precisar digitar: domínios -> assuntos -> fichas, com perguntas de exemplo. */
export function BrowseView({ onAsk }: { onAsk: (question: string) => void }) {
  const browse = useCatalogBrowse();
  return (
    <QueryView query={browse} skeletonLines={8}>
      {(data: BrowseResponse) =>
        data.domains.length === 0 ? (
          <EmptyState title="Ainda não há fichas publicadas para você">Quando os curadores publicarem fichas dos seus domínios, elas aparecem aqui.</EmptyState>
        ) : (
          <div className="stack">
            {data.domains.map((domain) => (
              <Panel
                key={domain.domain}
                title={
                  <span className="cluster">
                    Domínio {domain.domain}
                    <Badge>{domain.card_count} ficha(s)</Badge>
                  </span>
                }
              >
                <div className="stack">
                  {domain.example_questions.length ? (
                    <div className="stack-sm">
                      <span className="xsmall muted">Perguntas que você pode fazer</span>
                      <div className="cluster">
                        {domain.example_questions.map((question) => (
                          <Button key={question} size="sm" variant="ghost" className="chip" onClick={() => onAsk(question)}>
                            {question}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="subjects">
                    {domain.subjects.map((subject) => (
                      <section key={subject.subject} className="subject" aria-label={`Assunto ${subject.subject}`}>
                        <h3 className="small">{subject.subject}</h3>
                        <ul className="subject__cards">
                          {subject.cards.map((card) => (
                            <li key={card.asset_id}>
                              <Link to={`/fichas/${card.asset_id}`} className="subject__card">
                                <span className="spread">
                                  <strong>{card.business_name}</strong>
                                  <TrustBadge status={card.trust_status} />
                                </span>
                                {card.summary ? <span className="small muted">{card.summary}</span> : null}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )
      }
    </QueryView>
  );
}
