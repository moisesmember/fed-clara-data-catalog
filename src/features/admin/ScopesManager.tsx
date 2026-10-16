import { useId, useState, type FormEvent } from "react";

import type { AvailableScope, SourceSummary } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { formatDateTime } from "@/shared/format";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, Checkbox, Field, TextInput } from "@/shared/ui/primitives";
import { Alert, EmptyState, QueryView } from "@/shared/ui/states";

import { useScopeActions, useSourceScopes } from "./hooks";

type ScopeActions = ReturnType<typeof useScopeActions>;

/** Situação do escopo frente à última descoberta na origem. */
function scopeState(row: AvailableScope): [string, "success" | "warning" | "info" | "neutral", string | undefined] {
  if (!row.configured) return ["Disponível", "info", "Visto na origem e ainda não configurado."];
  if (row.visible === false) return ["Não visível", "warning", "Configurado, mas a credencial da fonte não enxerga este schema."];
  if (row.visible === null) return ["Configurado", "neutral", "Catálogo fora da última descoberta: visibilidade não verificada."];
  return ["Configurado", "success", undefined];
}

/** Escopos (catálogo.schema → domínio) um por vez, a partir do que a origem mostra.
 *  O backend valida, audita e decide; a tela só não deixa a pessoa adivinhar nomes. */
export function ScopesManager({ source, busy, onJob }: { source: SourceSummary; busy: boolean; onJob: (label: string, jobId: number) => void }) {
  const overview = useSourceScopes(source.id);
  const actions = useScopeActions(source.id);
  const notify = useNotify();
  const [catalogs, setCatalogs] = useState("");
  const [syncOnAdd, setSyncOnAdd] = useState(false);
  const domainsId = useId();
  const isWarehouse = source.kind === "databricks_sql";
  const knownDomains = [...new Set(source.scopes.map((scope) => scope.domain))].sort();

  const add = (catalog: string, schema: string, domain: string, onDone?: () => void) =>
    actions.add.mutate(
      { catalog, schema, domain, sync: syncOnAdd },
      {
        onSuccess: (result) => {
          notify("success", `Escopo ${result.scope} incluído no domínio ${result.domain}.${result.note ? ` ${result.note}.` : ""}`);
          if (result.sync_job_id) onJob(`Sincronização de ${result.scope}`, result.sync_job_id);
          onDone?.();
        },
        onError: (error) => notify("danger", describeError(error)),
      },
    );

  const discover = () => {
    const names = catalogs.split(",").map((name) => name.trim()).filter(Boolean);
    actions.discover.mutate(names, {
      onSuccess: ({ job_id }) => onJob("Descoberta de catálogos e schemas", job_id),
      onError: (error) => notify("danger", describeError(error)),
    });
  };

  return (
    <div className="stack">
      <datalist id={domainsId}>
        {knownDomains.map((domain) => (
          <option key={domain} value={domain} />
        ))}
      </datalist>

      {isWarehouse ? (
        <div className="cluster scopes-discover">
          <TextInput
            aria-label="Catálogos a descobrir"
            value={catalogs}
            onChange={(event) => setCatalogs(event.target.value)}
            placeholder="Todos os visíveis (ou: catalogo_a, catalogo_b)"
            style={{ maxWidth: 340 }}
          />
          <Button onClick={discover} disabled={busy || actions.discover.isPending}>
            Descobrir na origem
          </Button>
        </div>
      ) : (
        <p className="small muted">Fonte por arquivo: não há descoberta; inclua os escopos manualmente.</p>
      )}

      <QueryView query={overview} skeletonLines={4}>
        {(data) => (
          <>
            <p className="xsmall muted">
              {data.discovered_at ? `Última descoberta: ${formatDateTime(data.discovered_at)}.` : "A origem ainda não foi descoberta."} Só aparece o que a
              credencial da fonte enxerga.
            </p>
            {data.discovery_truncated ? <Alert tone="info">Há mais catálogos do que o limite da descoberta. Informe os catálogos desejados.</Alert> : null}
            {data.discovery_errors.length ? (
              <Alert tone="warning">
                Sem acesso a: {data.discovery_errors.map((item) => `${item.catalog} (${item.error})`).join(", ")}.
              </Alert>
            ) : null}
            {data.scopes.length === 0 ? (
              <EmptyState title="Nenhum escopo" />
            ) : (
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Catálogo.schema</th>
                      <th scope="col">Tabelas</th>
                      <th scope="col">Situação</th>
                      <th scope="col">Domínio</th>
                      <th scope="col">
                        <span className="visually-hidden">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.scopes.map((row) => (
                      <ScopeRow key={row.scope} row={row} actions={actions} domainsId={domainsId} onInclude={add} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </QueryView>

      <Checkbox label="Sincronizar ao incluir (fonte ativa)" checked={syncOnAdd} onChange={(event) => setSyncOnAdd(event.target.checked)} />
      <ManualScopeForm domainsId={domainsId} pending={actions.add.isPending} onSubmit={add} />
    </div>
  );
}

function ScopeRow({
  row,
  actions,
  domainsId,
  onInclude,
}: {
  row: AvailableScope;
  actions: ScopeActions;
  domainsId: string;
  onInclude: (catalog: string, schema: string, domain: string) => void;
}) {
  const notify = useNotify();
  const [domain, setDomain] = useState(row.domain ?? "");
  const [editing, setEditing] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [label, tone, title] = scopeState(row);

  const saveDomain = () =>
    actions.setDomain.mutate(
      { scope: row.scope, domain: domain.trim() },
      {
        onSuccess: () => {
          notify("success", `Escopo ${row.scope} agora no domínio ${domain.trim()}.`);
          setEditing(false);
        },
        onError: (error) => notify("danger", describeError(error)),
      },
    );

  const remove = () =>
    actions.remove.mutate(row.scope, {
      onSuccess: ({ assets_kept }) =>
        notify("success", `Escopo ${row.scope} removido.${assets_kept ? ` ${assets_kept} ativo(s) já importado(s) continuam no catálogo.` : ""}`),
      onError: (error) => notify("danger", describeError(error)),
    });

  const domainInput = (
    <TextInput aria-label={`Domínio de ${row.scope}`} list={domainsId} value={domain} onChange={(event) => setDomain(event.target.value)} style={{ maxWidth: 160 }} />
  );

  return (
    <tr>
      <td>
        <code>{row.scope}</code>
        <ScopeComments row={row} />
      </td>
      <td className="small">{row.tables ?? "—"}</td>
      <td>
        <Badge tone={tone} title={title}>
          {label}
        </Badge>
      </td>
      <td>{!row.configured || editing ? domainInput : <span className="small">{row.domain}</span>}</td>
      <td>
        <span className="cluster">
          {!row.configured ? (
            <Button size="sm" variant="primary" disabled={!domain.trim()} onClick={() => onInclude(row.catalog, row.schema, domain.trim())}>
              Incluir
            </Button>
          ) : editing ? (
            <>
              <Button size="sm" variant="primary" disabled={!domain.trim()} loading={actions.setDomain.isPending} onClick={saveDomain}>
                Salvar domínio
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </>
          ) : confirmingRemoval ? (
            <>
              <Button size="sm" variant="danger" loading={actions.remove.isPending} onClick={remove}>
                Confirmar remoção
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingRemoval(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} title="Só antes da primeira importação deste escopo.">
                Alterar domínio
              </Button>
              <Button size="sm" variant="ghost" aria-label={`Remover ${row.scope}`} onClick={() => setConfirmingRemoval(true)}>
                Remover
              </Button>
            </>
          )}
        </span>
      </td>
    </tr>
  );
}

/** Comentários do catálogo e do schema na origem: ajudam a escolher o escopo e viram contexto
 *  da curadoria (ADR 0013 do backend). */
function ScopeComments({ row }: { row: AvailableScope }) {
  if (!row.schema_comment && !row.catalog_comment) return null;
  return (
    <div className="scope-comments xsmall muted">
      {row.schema_comment ? <p>{row.schema_comment}</p> : null}
      {row.catalog_comment ? <p>Catálogo: {row.catalog_comment}</p> : null}
    </div>
  );
}

function ManualScopeForm({
  domainsId,
  pending,
  onSubmit,
}: {
  domainsId: string;
  pending: boolean;
  onSubmit: (catalog: string, schema: string, domain: string, onDone?: () => void) => void;
}) {
  const [catalog, setCatalog] = useState("");
  const [schema, setSchema] = useState("");
  const [domain, setDomain] = useState("");
  const ready = catalog.trim() && schema.trim() && domain.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(catalog.trim(), schema.trim(), domain.trim(), () => {
      setCatalog("");
      setSchema("");
    });
  };

  return (
    <form className="scope-form" onSubmit={submit} aria-label="Adicionar escopo manualmente">
      <Field label="Catálogo">{(props) => <TextInput {...props} value={catalog} onChange={(e) => setCatalog(e.target.value)} />}</Field>
      <Field label="Schema">{(props) => <TextInput {...props} value={schema} onChange={(e) => setSchema(e.target.value)} />}</Field>
      <Field label="Domínio" hint="Define quem vê os ativos deste escopo.">
        {(props) => <TextInput {...props} list={domainsId} value={domain} onChange={(e) => setDomain(e.target.value)} />}
      </Field>
      <Button type="submit" disabled={!ready} loading={pending}>
        Adicionar escopo
      </Button>
    </form>
  );
}
