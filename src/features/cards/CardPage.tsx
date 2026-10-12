import { Link, useNavigate, useParams } from "react-router";

import { useSession } from "@/core/auth/SessionProvider";
import { describeError } from "@/core/http/apiError";
import { formatDateTime } from "@/shared/format";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, Disclosure, PageHeader, Panel } from "@/shared/ui/primitives";
import { Alert, QueryView } from "@/shared/ui/states";
import { EditorialBadge, TrustBadge, VisibilityBadge, trustDescription, visibilityDescription } from "@/shared/ui/statusBadges";

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
              subtitle={canSeeMetadata ? <code>{data.content.fqn}</code> : undefined}
              actions={
                <>
                  {canSeeMetadata ? <EditorialBadge status={data.editorial_status} /> : null}
                  <TrustBadge status={data.trust_status} />
                  <VisibilityBadge visibility={data.visibility} />
                </>
              }
            />
            <dl className="ui-dl small">
              <dt>Confiança</dt>
              <dd>{trustDescription(data.trust_status)}</dd>
              <dt>Quem pode ver</dt>
              <dd>{visibilityDescription(data.visibility)}</dd>
            </dl>
            {data.review_required ? (
              <Alert tone="warning">
                Os dados de origem mudaram depois desta publicação: parte do conteúdo abaixo pode estar desatualizada e já está em
                revisão.{canSeeMetadata ? ` O conteúdo foi aprovado para a versão técnica v${data.asset_version}.` : ""}
              </Alert>
            ) : null}
            {data.trust_status !== "certified" ? (
              <Alert tone="info">Ficha não certificada: confirme com o responsável antes de tratá-la como fonte oficial.</Alert>
            ) : null}
            <div className="grid-2">
              <CardContentView content={data.content} technical={canSeeMetadata} />
              <div className="stack">
                <Panel title="Publicação">
                  <div className="stack">
                    <dl className="ui-dl">
                      <dt>Publicada em</dt>
                      <dd>{formatDateTime(data.published_at)}</dd>
                      {data.trust_notes ? (
                        <>
                          <dt>Notas de confiança</dt>
                          <dd>{data.trust_notes}</dd>
                        </>
                      ) : null}
                    </dl>
                    {/* Aberto para quem trabalha com metadados; recolhido para quem só consulta. */}
                    <Disclosure summary="Detalhes técnicos" open={canSeeMetadata}>
                      <dl className="ui-dl">
                        <dt>Nome técnico</dt>
                        <dd>
                          <code>{data.content.fqn}</code>
                        </dd>
                        <dt>Revisão</dt>
                        <dd>r{data.publication_revision}</dd>
                        <dt>Versão técnica</dt>
                        <dd>v{data.asset_version}</dd>
                        <dt>Fonte</dt>
                        <dd>
                          <Badge>{data.content.source_id}</Badge>
                        </dd>
                        <dt>Tipo</dt>
                        <dd>{data.content.object_type}</dd>
                      </dl>
                      {canSeeMetadata ? (
                        <p className="small" style={{ marginTop: "var(--space-4)" }}>
                          <Link to={`/ativos/${data.asset_id}`}>Ver metadados técnicos e versões →</Link>
                        </p>
                      ) : null}
                    </Disclosure>
                  </div>
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
