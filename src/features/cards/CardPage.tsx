import { Link, useNavigate, useParams } from "react-router";

import { useSession } from "@/core/auth/SessionProvider";
import { describeError } from "@/core/http/apiError";
import { formatDateTime } from "@/shared/format";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, PageHeader, Panel } from "@/shared/ui/primitives";
import { Alert, QueryView } from "@/shared/ui/states";
import { EditorialBadge, TrustBadge, VisibilityBadge } from "@/shared/ui/statusBadges";

import { CardContentView } from "./CardContentView";
import { CardGovernancePanel } from "./CardGovernancePanel";
import { useEditCard, usePublishedCard } from "./hooks";

export function CardPage() {
  const assetId = Number(useParams().assetId);
  const card = usePublishedCard(assetId);
  const { permissions } = useSession();
  const editCard = useEditCard(assetId);
  const navigate = useNavigate();
  const notify = useNotify();

  const startEdit = () =>
    editCard.mutate(undefined, {
      onSuccess: ({ task_id, existing }) => {
        if (existing) notify("info", "Já existe uma revisão em andamento para esta ficha. Continue por ela.");
        void navigate(`/curadoria/${task_id}`);
      },
      onError: (error) => notify("danger", describeError(error)),
    });

  return (
    <QueryView query={card} skeletonLines={8}>
      {(data) => {
        const canGovern = permissions.can("approve", data.content.domain);
        const canSeeMetadata = permissions.can("read_metadata", data.content.domain);
        const canEdit = permissions.can("curate", data.content.domain) && data.editorial_status === "published";
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
                {canEdit ? (
                  <Panel title="Corrigir esta ficha">
                    <p className="small">
                      Abre uma revisão com o conteúdo aprovado atual, sem gerar texto com IA. A nova revisão só é publicada depois
                      de aprovada.
                    </p>
                    <Button onClick={startEdit} loading={editCard.isPending}>
                      Editar ficha
                    </Button>
                  </Panel>
                ) : null}
                {canGovern ? <CardGovernancePanel card={data} /> : null}
              </div>
            </div>
          </>
        );
      }}
    </QueryView>
  );
}
