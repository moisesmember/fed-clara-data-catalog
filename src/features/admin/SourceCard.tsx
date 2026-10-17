import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { queryKeys } from "@/api/queryKeys";
import type { Job, SourceSummary } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { formatDateTime, formatDuration } from "@/shared/format";
import { JobStatusLine } from "@/shared/jobs/JobStatusLine";
import { useJobTracker } from "@/shared/jobs/useJobTracker";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, Checkbox, Disclosure, Pagination, Panel } from "@/shared/ui/primitives";
import { Alert, EmptyState, QueryView } from "@/shared/ui/states";
import { jobStatusLabel } from "@/shared/ui/statusBadges";

import { CapabilityChecklist } from "./CapabilityChecklist";
import { GenieSpacesManager } from "./GenieSpacesManager";
import { useSourceActions, useSyncRuns } from "./hooks";
import { ScopesManager } from "./ScopesManager";
import { describeRule, ruleKey } from "./selection";
import { WarehousePanel } from "./WarehousePanel";

const STATUS_TONE = { active: "success", paused: "neutral", error: "danger" } as const;
const STATUS_LABEL = { active: "Ativa", paused: "Pausada", error: "Com erro" } as const;
const RUNS_PAGE_SIZE = 10;

export function SourceCard({ source }: { source: SourceSummary }) {
  const actions = useSourceActions(source.id);
  const queryClient = useQueryClient();
  const notify = useNotify();
  const fileInput = useRef<HTMLInputElement>(null);
  const [activeJob, setActiveJob] = useState<{ id: number; label: string } | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [runsPage, setRunsPage] = useState(1);
  const runs = useSyncRuns(source.id, { page: runsPage, pageSize: RUNS_PAGE_SIZE });
  const isWarehouse = source.kind === "databricks_sql";

  const tracker = useJobTracker(activeJob?.id ?? null, (job: Job) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sources });
    void queryClient.invalidateQueries({ queryKey: ["sources", source.id, "runs"] });
    if (job.status === "succeeded") {
      const coverage = typeof job.result?.coverage === "string" ? ` · cobertura ${job.result.coverage}` : "";
      notify("success", `${activeJob?.label ?? "Operação"} concluída${coverage}.`);
    } else {
      notify("danger", `${activeJob?.label ?? "Operação"} terminou como “${jobStatusLabel(job.status)}”. ${job.last_error ?? ""}`);
    }
    setActiveJob(null);
  });

  const launch = (label: string, promise: Promise<{ job_id: number }>) =>
    promise.then(
      ({ job_id }) => setActiveJob({ id: job_id, label }),
      (error: unknown) => notify("danger", describeError(error)),
    );

  const busy = tracker.running || actions.test.isPending || actions.sync.isPending || actions.importFile.isPending;
  const scopeKeys = source.scopes.map(ruleKey);
  const onJob = (label: string, jobId: number) => setActiveJob({ id: jobId, label });

  return (
    <Panel
      title={
        <span className="cluster">
          {source.name}
          <Badge tone={STATUS_TONE[source.status]}>{STATUS_LABEL[source.status]}</Badge>
        </span>
      }
      actions={<code className="xsmall muted">{source.id}</code>}
    >
      <div className="stack">
        <dl className="ui-dl">
          <dt>Tipo</dt>
          <dd>{isWarehouse ? "Databricks SQL Warehouse" : "Importação por arquivo (não valida a integração automática)"}</dd>
          {source.host ? (
            <>
              <dt>Host</dt>
              <dd>
                <code>{source.host}</code>
              </dd>
            </>
          ) : null}
          <dt>Autenticação</dt>
          <dd>{source.auth_method}</dd>
          <dt>Ambiente</dt>
          <dd>{source.environment}</dd>
          <dt>Agenda</dt>
          <dd>{source.schedule_time ? `Diária às ${source.schedule_time} (${source.schedule_tz})` : "Somente manual"}</dd>
          <dt>Responsável</dt>
          <dd>{source.owner}</dd>
          {source.metastore_id ? (
            <>
              <dt>Metastore</dt>
              <dd className="mono xsmall">{source.metastore_id}</dd>
            </>
          ) : null}
        </dl>

        {isWarehouse ? <WarehousePanel source={source} busy={busy} onJob={onJob} /> : null}

        <fieldset className="scopes">
          <legend className="ui-field__label">O que é publicado (seleção → domínio)</legend>
          {source.scopes.length === 0 ? <span className="small muted">Nada selecionado ainda: a fonte não sincroniza.</span> : null}
          {source.scopes.map((scope, index) => {
            const key = scopeKeys[index] as string;
            return (
              <Checkbox
                key={key}
                label={
                  <>
                    <code>{key}</code> <span className="muted">→ {scope.domain}</span> <span className="xsmall muted">({describeRule(scope)})</span>
                  </>
                }
                checked={selectedScopes.includes(key)}
                onChange={(event) => setSelectedScopes(event.target.checked ? [...selectedScopes, key] : selectedScopes.filter((s) => s !== key))}
                disabled={!isWarehouse}
              />
            );
          })}
          {isWarehouse && source.scopes.length ? <span className="xsmall muted">Nenhuma marcada = sincronizar todas as seleções.</span> : null}
        </fieldset>

        <Disclosure summary="Selecionar o que publicar (catálogos, schemas, tabelas e filtros)">
          <ScopesManager source={source} busy={busy} onJob={onJob} />
        </Disclosure>

        {isWarehouse ? (
          <Disclosure summary="Atalhos para o Genie (dados sem ficha e pedidos de valor)">
            <GenieSpacesManager source={source} />
          </Disclosure>
        ) : null}

        <div className="cluster">
          {isWarehouse ? (
            <>
              <Button onClick={() => void launch("Teste de conexão", actions.test.mutateAsync())} disabled={busy}>
                Testar conexão
              </Button>
              <Button
                variant="primary"
                disabled={busy || source.status !== "active" || source.scopes.length === 0}
                title={
                  source.status !== "active"
                    ? "Teste a conexão: a fonte fica ativa quando todas as verificações passam."
                    : source.scopes.length === 0
                      ? "Selecione o que publicar antes de sincronizar."
                      : undefined
                }
                onClick={() => void launch("Sincronização", actions.sync.mutateAsync(selectedScopes))}
              >
                Sincronizar agora
              </Button>
            </>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept=".json,.csv"
            className="visually-hidden"
            aria-label="Arquivo de metadados (JSON ou CSV)"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void launch("Importação de arquivo", actions.importFile.mutateAsync(file));
              event.target.value = "";
            }}
          />
          <Button variant="ghost" disabled={busy} onClick={() => fileInput.current?.click()}>
            Importar JSON/CSV
          </Button>
        </div>

        {activeJob ? <JobStatusLine job={tracker.job} label={activeJob.label} /> : null}
        {source.status === "error" ? <Alert tone="warning">O último teste de conexão falhou. Veja os detalhes abaixo.</Alert> : null}
        {source.last_capability_check ? <CapabilityChecklist report={source.last_capability_check} /> : <p className="small muted">Conexão ainda não testada.</p>}

        <div className="stack-sm">
          <h3 className="small">Execuções recentes</h3>
          <QueryView query={runs} skeletonLines={3}>
            {(rows) =>
              rows.length === 0 ? (
                <EmptyState title="Nenhuma sincronização ainda" />
              ) : (
                <>
                  <div className="ui-table-wrap">
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">Início</th>
                          <th scope="col">Origem</th>
                          <th scope="col">Situação</th>
                          <th scope="col">Cobertura</th>
                          <th scope="col">Novos / alterados / iguais</th>
                          <th scope="col">Duração</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((run) => (
                          <tr key={run.id} title={run.errors.join("\n") || undefined}>
                            <td className="muted">{run.id}</td>
                            <td className="small">{formatDateTime(run.started_at)}</td>
                            <td className="small">{run.trigger}</td>
                            <td>
                              <Badge tone={run.status === "succeeded" ? "success" : run.status === "running" ? "info" : run.status === "partial" ? "warning" : "danger"}>{run.status}</Badge>
                            </td>
                            <td>
                              <Badge tone={run.coverage === "complete" ? "success" : "warning"}>{run.coverage}</Badge>
                            </td>
                            <td className="small">
                              {run.counts.new ?? 0} / {run.counts.changed ?? 0} / {run.counts.unchanged ?? 0}
                            </td>
                            <td className="small muted">{formatDuration(run.duration_ms)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={runsPage} hasNext={rows.length === RUNS_PAGE_SIZE} onChange={setRunsPage} />
                </>
              )
            }
          </QueryView>
        </div>
      </div>
    </Panel>
  );
}
