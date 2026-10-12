import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";

import type { AssetDetail } from "@/api/types";
import { useSession } from "@/core/auth/SessionProvider";
import { describeError } from "@/core/http/apiError";
import { formatDateTime } from "@/shared/format";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, Field, PageHeader, Panel, TextArea } from "@/shared/ui/primitives";
import { QueryView } from "@/shared/ui/states";
import { EditorialBadge, TaskStatusBadge, TrustBadge, VisibilityBadge } from "@/shared/ui/statusBadges";

import { AssetStatusBadge } from "./AssetStatusBadge";
import { useAsset, useAssetVersion, useAssetVersions, useFlagSemanticChange } from "./hooks";
import { VersionDiff } from "./VersionDiff";
import "./assets.css";

export function AssetDetailPage() {
  const assetId = Number(useParams().assetId);
  const asset = useAsset(assetId);
  return <QueryView query={asset} skeletonLines={8}>{(data) => <AssetDetailView asset={data} />}</QueryView>;
}

function AssetDetailView({ asset }: { asset: AssetDetail }) {
  const { permissions } = useSession();
  const versions = useAssetVersions(asset.id);
  const [selected, setSelected] = useState<number | null>(asset.current_version?.version_no ?? null);
  const version = useAssetVersion(asset.id, selected);

  return (
    <>
      <PageHeader
        eyebrow={`Ativo · ${asset.source_id}`}
        title={<code>{asset.fqn}</code>}
        subtitle={<span className="mono xsmall">{asset.identity_key}</span>}
        actions={
          <>
            <AssetStatusBadge status={asset.status} />
            <Badge>{asset.object_type}</Badge>
            <Badge>{asset.domain}</Badge>
          </>
        }
      />
      <div className="grid-2">
        <div className="stack">
          <Panel title="Histórico de versões técnicas">
            <QueryView query={versions}>
              {(rows) => (
                <ol className="timeline">
                  {[...rows].reverse().map((row) => (
                    <li key={row.id} className={`timeline__item ${row.version_no === selected ? "timeline__item--active" : ""}`}>
                      <button type="button" className="timeline__button" onClick={() => setSelected(row.version_no)} aria-pressed={row.version_no === selected}>
                        <span className="spread">
                          <strong>v{row.version_no}</strong>
                          <span className="xsmall muted">{formatDateTime(row.collected_at)}</span>
                        </span>
                        <VersionDiff diff={row.diff} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </QueryView>
          </Panel>
          {selected !== null ? (
            <Panel title={`Colunas da versão v${selected}`}>
              <QueryView query={version}>
                {(detail) => (
                  <div className="stack-sm">
                    <p className="small">{detail.description ?? <span className="muted">Sem descrição na origem.</span>}</p>
                    <div className="ui-table-wrap">
                      <table className="ui-table">
                        <thead>
                          <tr>
                            <th scope="col">#</th>
                            <th scope="col">Coluna</th>
                            <th scope="col">Tipo</th>
                            <th scope="col">Descrição na origem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.columns.map((column) => (
                            <tr key={column.position}>
                              <td className="muted">{column.position}</td>
                              <td>
                                <code>{column.name}</code>
                              </td>
                              <td className="muted">
                                <code>{column.data_type}</code>
                              </td>
                              <td>{column.description ?? <span className="muted">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </QueryView>
            </Panel>
          ) : null}
        </div>
        <div className="stack">
          <Panel title="Ficha">
            {asset.card ? (
              <div className="stack-sm">
                <div className="cluster">
                  <EditorialBadge status={asset.card.editorial_status} />
                  <TrustBadge status={asset.card.trust_status} />
                  <VisibilityBadge visibility={asset.card.visibility} />
                  {asset.card.review_required ? <Badge tone="warning">Revisão pendente</Badge> : null}
                </div>
                {asset.card.editorial_status === "published" ? <Link to={`/fichas/${asset.id}`}>Abrir ficha publicada →</Link> : null}
              </div>
            ) : (
              <p className="small muted">Ainda sem ficha publicada.</p>
            )}
          </Panel>
          <Panel title="Curadoria">
            {asset.latest_task ? (
              <div className="cluster small">
                <TaskStatusBadge status={asset.latest_task.status} />
                <Link to={`/curadoria/${asset.latest_task.id}`}>Abrir tarefa #{asset.latest_task.id} →</Link>
              </div>
            ) : (
              <p className="small muted">Nenhuma tarefa.</p>
            )}
          </Panel>
          {asset.open_pendencies.length ? (
            <Panel title="Pendências abertas">
              <ul className="small">
                {asset.open_pendencies.map((p) => (
                  <li key={p.code + p.message}>
                    <Badge tone={p.blocking ? "danger" : "warning"}>{p.blocking ? "Bloqueante" : "Atenção"}</Badge> {p.message}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
          {permissions.can("curate", asset.domain) ? <SemanticChangePanel assetId={asset.id} /> : null}
        </div>
      </div>
    </>
  );
}

/** Mudanças de cálculo podem ocorrer sem mudança de schema: o curador abre uma revisão manual. */
function SemanticChangePanel({ assetId }: { assetId: number }) {
  const [reason, setReason] = useState("");
  const flag = useFlagSemanticChange(assetId);
  const notify = useNotify();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    flag.mutate(reason.trim(), {
      onSuccess: ({ task_id }) => {
        notify("success", `Revisão aberta (tarefa #${task_id}).`);
        setReason("");
      },
      onError: (error) => notify("danger", describeError(error)),
    });
  };

  return (
    <Panel title="Sinalizar mudança semântica">
      <form className="stack-sm" onSubmit={submit}>
        <Field label="O que mudou?" hint="Ex.: a regra de cálculo de vl_liq passou a excluir devoluções.">
          {(props) => <TextArea {...props} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />}
        </Field>
        <Button type="submit" disabled={reason.trim().length < 5} loading={flag.isPending}>
          Abrir revisão
        </Button>
      </form>
    </Panel>
  );
}
