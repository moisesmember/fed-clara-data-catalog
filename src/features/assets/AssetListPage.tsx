import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import type { AssetFilters } from "@/api/assetsApi";
import { Badge, Button, PageHeader, Pagination, Panel, Select, TextInput } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";
import { EditorialBadge, TrustBadge } from "@/shared/ui/statusBadges";

import { AssetStatusBadge } from "./AssetStatusBadge";
import { useAssetList } from "./hooks";
import "./assets.css";

const PAGE_SIZE = 50;
const FILTER_KEYS = ["sourceId", "catalog", "schema", "status"] as const;

export function AssetListPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("pagina") ?? "1") || 1;
  const filters: AssetFilters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? undefined]).filter(([, v]) => v));
  const [draft, setDraft] = useState<AssetFilters>(filters);
  const assets = useAssetList(filters, { page, pageSize: PAGE_SIZE });

  const apply = (next: AssetFilters, nextPage = 1) => {
    const search = new URLSearchParams();
    FILTER_KEYS.forEach((key) => next[key] && search.set(key, String(next[key])));
    if (nextPage > 1) search.set("pagina", String(nextPage));
    setParams(search, { replace: true });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply(draft);
  };

  return (
    <>
      <PageHeader eyebrow="Curadoria" title="Ativos e versões" subtitle="Metadados importados das fontes. Visível a curadores e aprovadores dos domínios autorizados." />
      <Panel>
        <form className="filters" onSubmit={submit} aria-label="Filtros de ativos">
          <TextInput aria-label="Fonte" placeholder="Fonte (ex.: dbx-free-lab)" value={draft.sourceId ?? ""} onChange={(e) => setDraft({ ...draft, sourceId: e.target.value })} />
          <TextInput aria-label="Catálogo" placeholder="Catálogo" value={draft.catalog ?? ""} onChange={(e) => setDraft({ ...draft, catalog: e.target.value })} />
          <TextInput aria-label="Schema" placeholder="Schema" value={draft.schema ?? ""} onChange={(e) => setDraft({ ...draft, schema: e.target.value })} />
          <Select aria-label="Situação" value={draft.status ?? ""} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <option value="">Todas as situações</option>
            <option value="active">Ativo</option>
            <option value="missing">Ausente na origem</option>
            <option value="deprecation_candidate">Candidato a descontinuação</option>
          </Select>
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
        </form>
      </Panel>
      <Panel>
        <QueryView query={assets} skeletonLines={8}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState title="Nenhum ativo encontrado">Verifique os filtros ou se há sincronizações concluídas para os seus domínios.</EmptyState>
            ) : (
              <div className="stack">
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th scope="col">Ativo</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Fonte</th>
                        <th scope="col">Domínio</th>
                        <th scope="col">Situação</th>
                        <th scope="col">Versão</th>
                        <th scope="col">Ficha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((asset) => (
                        <tr key={asset.id}>
                          <td>
                            <Link to={`/ativos/${asset.id}`}>
                              <code>{asset.fqn}</code>
                            </Link>
                          </td>
                          <td className="muted small">{asset.object_type}</td>
                          <td>
                            <Badge>{asset.source_id}</Badge>
                          </td>
                          <td>{asset.domain}</td>
                          <td>
                            <AssetStatusBadge status={asset.status} />
                          </td>
                          <td className="muted">{asset.version_no ? `v${asset.version_no}` : "—"}</td>
                          <td>
                            <span className="cluster">
                              {asset.editorial_status ? <EditorialBadge status={asset.editorial_status} /> : <span className="muted small">sem ficha</span>}
                              {asset.trust_status && asset.editorial_status === "published" ? <TrustBadge status={asset.trust_status} /> : null}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} hasNext={rows.length === PAGE_SIZE} onChange={(p) => apply(filters, p)} />
              </div>
            )
          }
        </QueryView>
      </Panel>
    </>
  );
}
