import { useState, type FormEvent } from "react";

import { formatDateTime } from "@/shared/format";
import { Badge, Button, PageHeader, Pagination, Panel, TextInput } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";

import { useAuditEvents } from "./hooks";
import "./admin.css";

const PAGE_SIZE = 50;

export function AuditPage() {
  const [filters, setFilters] = useState<{ entityType?: string; entityId?: string }>({});
  const [draft, setDraft] = useState(filters);
  const [page, setPage] = useState(1);
  const events = useAuditEvents(filters, { page, pageSize: PAGE_SIZE });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFilters({ entityType: draft.entityType || undefined, entityId: draft.entityId || undefined });
    setPage(1);
  };

  return (
    <>
      <PageHeader eyebrow="Administração" title="Auditoria" subtitle="Decisões e mudanças registradas na mesma transação do fato. Aprovadores veem apenas seus domínios." />
      <Panel>
        <form className="cluster" onSubmit={submit} aria-label="Filtros de auditoria">
          <TextInput aria-label="Tipo de entidade" placeholder="Tipo (asset, curation_task, source…)" value={draft.entityType ?? ""} onChange={(e) => setDraft({ ...draft, entityType: e.target.value })} style={{ maxWidth: 260 }} />
          <TextInput aria-label="Identificador" placeholder="Identificador" value={draft.entityId ?? ""} onChange={(e) => setDraft({ ...draft, entityId: e.target.value })} style={{ maxWidth: 180 }} />
          <Button type="submit">Filtrar</Button>
        </form>
      </Panel>
      <Panel>
        <QueryView query={events} skeletonLines={8}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState title="Nenhum evento encontrado" />
            ) : (
              <div className="stack">
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th scope="col">Quando</th>
                        <th scope="col">Quem</th>
                        <th scope="col">Ação</th>
                        <th scope="col">Entidade</th>
                        <th scope="col">Domínio</th>
                        <th scope="col">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((event) => (
                        <tr key={event.id}>
                          <td className="small">{formatDateTime(event.at)}</td>
                          <td className="small">{event.actor}</td>
                          <td>
                            <Badge tone="accent">{event.action}</Badge>
                          </td>
                          <td className="small">
                            {event.entity_type} <code>#{event.entity_id}</code>
                          </td>
                          <td className="small">{event.domain ?? "—"}</td>
                          <td>
                            <details>
                              <summary className="xsmall">ver</summary>
                              <pre className="audit-details">{JSON.stringify(event.details, null, 2)}</pre>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} hasNext={rows.length === PAGE_SIZE} onChange={setPage} />
              </div>
            )
          }
        </QueryView>
      </Panel>
    </>
  );
}
