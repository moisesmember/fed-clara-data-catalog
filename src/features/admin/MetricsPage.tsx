import { useState } from "react";

import { formatDuration, formatInteger, formatNumber } from "@/shared/format";
import { Alert, EmptyState, QueryView } from "@/shared/ui/states";
import { Badge, PageHeader, Panel, Segmented, Select } from "@/shared/ui/primitives";

import { useGraphMetrics } from "./hooks";
import "./admin.css";

type GraphFilter = "all" | "curation" | "answer";
const WINDOWS = [
  { hours: 1, label: "Última hora" },
  { hours: 24, label: "Últimas 24 h" },
  { hours: 168, label: "Últimos 7 dias" },
  { hours: 720, label: "Últimos 30 dias" },
];

export function MetricsPage() {
  const [graph, setGraph] = useState<GraphFilter>("all");
  const [hours, setHours] = useState(24);
  const metrics = useGraphMetrics(graph === "all" ? undefined : graph, hours);

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Métricas dos grafos"
        subtitle="Latência, chamadas ao modelo, tokens e custo estimado por grafo e situação."
        actions={
          <>
            <Segmented
              label="Grafo"
              value={graph}
              onChange={setGraph}
              options={[
                { value: "all", label: "Todos" },
                { value: "curation", label: "Curadoria" },
                { value: "answer", label: "Respostas" },
              ]}
            />
            <Select aria-label="Janela de tempo" value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ width: 170 }}>
              {WINDOWS.map((w) => (
                <option key={w.hours} value={w.hours}>
                  {w.label}
                </option>
              ))}
            </Select>
          </>
        }
      />
      <QueryView query={metrics} skeletonLines={6}>
        {(data) => (
          <div className="stack">
            <Alert tone="info">{data.note}</Alert>
            <div className="kpis">
              <Kpi label="Execuções" value={formatInteger(data.runs.reduce((sum, run) => sum + run.count, 0))} />
              <Kpi label="Chamadas ao modelo" value={formatInteger(data.runs.reduce((sum, run) => sum + (run.llm_calls ?? 0), 0))} />
              <Kpi label="Custo estimado (USD)" value={formatNumber(data.runs.reduce((sum, run) => sum + (run.est_cost_usd ?? 0), 0), 4)} />
              <Kpi label="Espera humana média" value={formatDuration(data.human_wait_ms?.avg ?? null)} />
              <Kpi
                label="Cache de busca (processo)"
                value={`${formatInteger(data.search_cache.hits)} / ${formatInteger(data.search_cache.hits + data.search_cache.misses)}`}
                hint="acertos / consultas"
              />
            </div>
            <Panel title="Por grafo e situação">
              {data.runs.length === 0 ? (
                <EmptyState title="Sem execuções na janela selecionada" />
              ) : (
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th scope="col">Grafo</th>
                        <th scope="col">Situação</th>
                        <th scope="col">Execuções</th>
                        <th scope="col">p50</th>
                        <th scope="col">p95</th>
                        <th scope="col">Chamadas LLM</th>
                        <th scope="col">Tokens (entrada/saída)</th>
                        <th scope="col">Custo est. (USD)</th>
                        <th scope="col">Checkpoint médio</th>
                        <th scope="col">Contexto médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.runs.map((run) => (
                        <tr key={`${run.graph}-${run.status}`}>
                          <td>{run.graph === "curation" ? "Curadoria" : "Respostas"}</td>
                          <td>
                            <Badge tone={run.status === "ok" || run.status === "interrupted" ? "success" : run.status === "error" || run.status === "timeout" ? "danger" : "neutral"}>{run.status}</Badge>
                          </td>
                          <td>{formatInteger(run.count)}</td>
                          <td>{formatDuration(run.p50_ms)}</td>
                          <td>{formatDuration(run.p95_ms)}</td>
                          <td>{formatInteger(run.llm_calls)}</td>
                          <td className="small">
                            {formatInteger(run.input_tokens)} / {formatInteger(run.output_tokens)}
                          </td>
                          <td>{formatNumber(run.est_cost_usd, 4)}</td>
                          <td className="small">{run.avg_checkpoint_bytes ? `${formatNumber(run.avg_checkpoint_bytes / 1024)} KB` : "—"}</td>
                          <td className="small">{run.avg_context_chars ? `${formatInteger(Math.round(run.avg_context_chars))} car.` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        )}
      </QueryView>
    </>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      {hint ? <span className="xsmall muted">{hint}</span> : null}
    </div>
  );
}
