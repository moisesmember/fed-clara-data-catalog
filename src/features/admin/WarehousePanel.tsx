import { useState } from "react";

import type { SourceSummary, Warehouse } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { formatDateTime } from "@/shared/format";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button } from "@/shared/ui/primitives";
import { Alert } from "@/shared/ui/states";

import { useWarehouseActions } from "./hooks";

const STATE_LABEL: Record<string, string> = { RUNNING: "Ligado", STOPPED: "Desligado", STARTING: "Ligando", STOPPING: "Desligando" };

function describe(warehouse: Warehouse): string {
  return [warehouse.size, warehouse.serverless ? "serverless" : null, warehouse.type].filter(Boolean).join(" · ");
}

/** SQL Warehouse da fonte (ADR 0015 do backend). Sem HTTP path no cadastro, a Clara lista os
 *  warehouses e adota o único; com vários, quem administra escolhe aqui, sem digitar caminhos. */
export function WarehousePanel({ source, busy, onJob }: { source: SourceSummary; busy: boolean; onJob: (label: string, jobId: number) => void }) {
  const actions = useWarehouseActions(source.id);
  const notify = useNotify();
  const [choosing, setChoosing] = useState(false);
  const listing = source.warehouses;
  const items = listing?.items ?? [];
  const current = items.find((item) => item.http_path === source.http_path);
  const showChooser = !source.http_path || choosing;

  const choose = (warehouse: Warehouse) =>
    actions.choose.mutate(warehouse.id, {
      onSuccess: ({ jobs }) => {
        notify("success", `SQL Warehouse ${warehouse.name ?? warehouse.id} escolhido. A Clara vai testar a conexão e descobrir a origem.`);
        if (jobs.discover) onJob("Descoberta da origem", jobs.discover);
        setChoosing(false);
      },
      onError: (error) => notify("danger", describeError(error)),
    });

  const relist = () =>
    actions.refresh.mutate(undefined, {
      onSuccess: ({ job_id }) => onJob("Listagem de SQL Warehouses", job_id),
      onError: (error) => notify("danger", describeError(error)),
    });

  return (
    <div className="warehouse-panel stack-sm" aria-label="SQL Warehouse">
      <div className="cluster">
        <span className="ui-field__label">SQL Warehouse</span>
        {source.http_path ? (
          <>
            {current ? <strong className="small">{current.name}</strong> : null}
            <code className="xsmall muted">{source.http_path}</code>
            {items.length > 1 ? (
              <Button size="sm" variant="ghost" onClick={() => setChoosing(!choosing)}>
                {choosing ? "Manter este" : "Trocar"}
              </Button>
            ) : null}
          </>
        ) : !listing ? (
          <span className="small muted">Procurando os SQL Warehouses do workspace…</span>
        ) : null}
        {listing ? (
          <Button size="sm" variant="ghost" disabled={busy || actions.refresh.isPending} onClick={relist} title={`Última listagem: ${formatDateTime(listing.listed_at)}`}>
            Listar de novo
          </Button>
        ) : null}
      </div>

      {showChooser && listing?.error ? (
        <Alert tone="warning">
          Não foi possível listar os SQL Warehouses ({listing.error}). Verifique a credencial e a permissão de listar warehouses, ou informe o HTTP path no
          cadastro da fonte.
        </Alert>
      ) : null}
      {showChooser && listing && !listing.error && items.length === 0 ? (
        <Alert tone="warning">A credencial da fonte não enxerga nenhum SQL Warehouse. Conceda CAN USE em um deles e liste de novo.</Alert>
      ) : null}
      {showChooser && items.length ? (
        <>
          {!source.http_path ? <p className="small">Há mais de um SQL Warehouse. Escolha qual a Clara deve usar para ler os metadados:</p> : null}
          <ul className="warehouse-list">
            {items.map((warehouse) => (
              <li key={warehouse.id} className="cluster">
                <strong className="small">{warehouse.name ?? warehouse.id}</strong>
                <Badge tone={warehouse.state === "RUNNING" ? "success" : "neutral"}>{STATE_LABEL[warehouse.state ?? ""] ?? warehouse.state ?? "—"}</Badge>
                <span className="xsmall muted">{describe(warehouse)}</span>
                <Button
                  size="sm"
                  variant={warehouse.http_path === source.http_path ? "ghost" : "primary"}
                  disabled={warehouse.http_path === source.http_path}
                  loading={actions.choose.isPending && actions.choose.variables === warehouse.id}
                  aria-label={`Usar o SQL Warehouse ${warehouse.name ?? warehouse.id}`}
                  onClick={() => choose(warehouse)}
                >
                  {warehouse.http_path === source.http_path ? "Em uso" : "Usar este"}
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
