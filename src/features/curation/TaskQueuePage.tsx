import { Link, useSearchParams } from "react-router";

import type { TaskStatus } from "@/api/types";
import { useSession } from "@/core/auth/SessionProvider";
import { formatDateTime } from "@/shared/format";
import { Badge, PageHeader, Pagination, Panel, Select } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";
import { TaskStatusBadge, taskStatusLabel } from "@/shared/ui/statusBadges";

import { useTaskQueue } from "./hooks";

const PAGE_SIZE = 25;
const STATUS_FILTERS: TaskStatus[] = ["awaiting_review", "open", "failed", "publication_blocked", "approved", "published", "rejected", "superseded"];
const KIND_LABEL: Record<string, string> = { new_asset: "Novo ativo", change_review: "Mudança na origem", semantic_change: "Mudança semântica" };

export function TaskQueuePage() {
  const [params, setParams] = useSearchParams();
  const { permissions } = useSession();
  const status = (params.get("status") ?? "") as TaskStatus | "";
  const domain = params.get("dominio") ?? "";
  const page = Number(params.get("pagina") ?? "1") || 1;
  const queue = useTaskQueue({ status, domain }, { page, pageSize: PAGE_SIZE });
  const domains = permissions.domainsFor("curate").filter((d) => d !== "*");

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "pagina") next.delete("pagina"); // mudar filtro volta para a primeira página
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader eyebrow="Curadoria" title="Fila de curadoria" subtitle="Tarefas abertas por novos ativos, mudanças na origem ou sinalização manual de mudança semântica." />
      <Panel
        title="Tarefas"
        actions={
          <div className="cluster">
            <label className="visually-hidden" htmlFor="filtro-status">
              Filtrar por situação
            </label>
            <Select id="filtro-status" value={status} onChange={(event) => setFilter("status", event.target.value)} style={{ width: 220 }}>
              <option value="">Todas as situações</option>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {taskStatusLabel(s)}
                </option>
              ))}
            </Select>
            {domains.length > 1 ? (
              <Select aria-label="Filtrar por domínio" value={domain} onChange={(event) => setFilter("dominio", event.target.value)} style={{ width: 180 }}>
                <option value="">Todos os domínios</option>
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        }
      >
        <QueryView query={queue} skeletonLines={6}>
          {(tasks) =>
            tasks.length === 0 ? (
              <EmptyState title="Nenhuma tarefa encontrada">Ajuste os filtros ou aguarde a próxima sincronização.</EmptyState>
            ) : (
              <div className="stack">
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th scope="col">Ativo</th>
                        <th scope="col">Motivo</th>
                        <th scope="col">Domínio</th>
                        <th scope="col">Situação</th>
                        <th scope="col">Revisão</th>
                        <th scope="col">Atualizada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr key={task.id}>
                          <td>
                            <Link to={`/curadoria/${task.id}`}>
                              <code>{task.fqn}</code>
                            </Link>
                          </td>
                          <td>{KIND_LABEL[task.kind] ?? task.kind}</td>
                          <td>
                            <Badge>{task.domain}</Badge>
                          </td>
                          <td>
                            <TaskStatusBadge status={task.status} />
                          </td>
                          <td className="muted">{task.draft_revision ? `r${task.draft_revision}` : "—"}</td>
                          <td className="muted small">{formatDateTime(task.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} hasNext={tasks.length === PAGE_SIZE} onChange={(p) => setFilter("pagina", p > 1 ? String(p) : "")} />
              </div>
            )
          }
        </QueryView>
      </Panel>
    </>
  );
}
