import { Link, useParams } from "react-router";

import { useSession } from "@/core/auth/SessionProvider";
import { formatDateTime } from "@/shared/format";
import { Badge, PageHeader, Panel } from "@/shared/ui/primitives";
import { Alert, QueryView } from "@/shared/ui/states";
import { EditorialBadge, TrustBadge, VisibilityBadge } from "@/shared/ui/statusBadges";

import { CardContentView } from "./CardContentView";
import { CardGovernancePanel } from "./CardGovernancePanel";
import { usePublishedCard } from "./hooks";

export function CardPage() {
  const assetId = Number(useParams().assetId);
  const card = usePublishedCard(assetId);
  const { permissions } = useSession();

  return (
    <QueryView query={card} skeletonLines={8}>
      {(data) => {
        const canGovern = permissions.can("approve", data.content.domain);
        const canSeeMetadata = permissions.can("read_metadata", data.content.domain);
        return (
          <>
            <PageHeader
              eyebrow={`Ficha · domínio ${data.content.domain}`}
              title={data.content.business_name}
              subtitle={<code>{data.content.fqn}</code>}
              actions={
                <>
                  <EditorialBadge status={data.editorial_status} />
                  <TrustBadge status={data.trust_status} />
                  <VisibilityBadge visibility={data.visibility} />
                </>
              }
            />
            {data.review_required ? (
              <Alert tone="warning">
                A origem mudou depois desta publicação. O conteúdo abaixo foi aprovado para a versão técnica v{data.asset_version} e
                está em revisão.
              </Alert>
            ) : null}
            {data.trust_status !== "certified" ? (
              <Alert tone="info">Ficha não certificada: confirme com o responsável antes de tratá-la como fonte oficial.</Alert>
            ) : null}
            <div className="grid-2">
              <CardContentView content={data.content} />
              <div className="stack">
                <Panel title="Publicação">
                  <dl className="ui-dl">
                    <dt>Revisão</dt>
                    <dd>r{data.publication_revision}</dd>
                    <dt>Versão técnica</dt>
                    <dd>v{data.asset_version}</dd>
                    <dt>Publicada em</dt>
                    <dd>{formatDateTime(data.published_at)}</dd>
                    <dt>Fonte</dt>
                    <dd>
                      <Badge>{data.content.source_id}</Badge>
                    </dd>
                    <dt>Tipo</dt>
                    <dd>{data.content.object_type}</dd>
                    {data.trust_notes ? (
                      <>
                        <dt>Notas de confiança</dt>
                        <dd>{data.trust_notes}</dd>
                      </>
                    ) : null}
                  </dl>
                  {canSeeMetadata ? (
                    <p className="small" style={{ marginTop: "var(--space-4)" }}>
                      <Link to={`/ativos/${data.asset_id}`}>Ver metadados técnicos e versões →</Link>
                    </p>
                  ) : null}
                </Panel>
                {canGovern ? <CardGovernancePanel card={data} /> : null}
              </div>
            </div>
          </>
        );
      }}
    </QueryView>
  );
}
