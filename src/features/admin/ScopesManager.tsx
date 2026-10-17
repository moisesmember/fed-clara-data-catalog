import { useId, useState, type FormEvent } from "react";

import type { ConfiguredRule, DiscoveredCatalog, DiscoveredSchema, ScopeConfig, ScopeInput, SourceSummary } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { formatDateTime } from "@/shared/format";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, Checkbox, Field, TextInput } from "@/shared/ui/primitives";
import { Alert, EmptyState, QueryView } from "@/shared/ui/states";

import { useScopeActions, useSourceScopes } from "./hooks";
import { ObjectPicker } from "./ObjectPicker";
import { RuleEditor, type RuleDraft } from "./RuleEditor";
import { describeRule, describeTypes } from "./selection";

type ScopeActions = ReturnType<typeof useScopeActions>;

/** Contexto comum às linhas: ações, domínios conhecidos e a opção de sincronizar ao incluir. */
interface Ctx {
  sourceId: string;
  actions: ScopeActions;
  domainsId: string;
  syncOnAdd: boolean;
  onJob: (label: string, jobId: number) => void;
}

/** Situação da seleção frente à última descoberta na origem. */
function ruleState(rule: ConfiguredRule): [string, "success" | "warning" | "neutral", string | undefined] {
  if (rule.visible === false) return ["Não visível", "warning", "A credencial da fonte não enxerga esta seleção na origem."];
  if (rule.visible === null) return ["Não verificada", "neutral", "Catálogo fora da última descoberta."];
  return ["Visível", "success", undefined];
}

function formatsOf(schemas: DiscoveredSchema[]): string[] {
  return [...new Set(schemas.flatMap((schema) => Object.keys(schema.formats)))];
}

/** O que publicar, a partir do que a origem mostra (ADR 0015 do backend): catálogo inteiro,
 *  schema inteiro ou tabelas escolhidas, com filtros de tipo e formato. O backend valida, audita
 *  e decide; a tela só evita que a pessoa adivinhe nomes. */
export function ScopesManager({ source, busy, onJob }: { source: SourceSummary; busy: boolean; onJob: (label: string, jobId: number) => void }) {
  const overview = useSourceScopes(source.id);
  const actions = useScopeActions(source.id);
  const notify = useNotify();
  const [catalogs, setCatalogs] = useState("");
  const [syncOnAdd, setSyncOnAdd] = useState(false);
  const domainsId = useId();
  const isWarehouse = source.kind === "databricks_sql";
  const knownDomains = [...new Set(source.scopes.map((scope) => scope.domain))].sort();
  const ctx: Ctx = { sourceId: source.id, actions, domainsId, syncOnAdd, onJob };

  const discover = () => {
    const names = catalogs.split(",").map((name) => name.trim()).filter(Boolean);
    actions.discover.mutate(names, {
      onSuccess: ({ job_id }) => onJob("Descoberta da origem", job_id),
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

      {!isWarehouse ? (
        <p className="small muted">Fonte por arquivo: não há descoberta; inclua as seleções manualmente.</p>
      ) : !source.http_path ? (
        <p className="small muted">Escolha o SQL Warehouse para a Clara descobrir o que há na origem.</p>
      ) : (
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
      )}

      <QueryView query={overview} skeletonLines={4}>
        {(data) => (
          <>
            <p className="xsmall muted">
              {data.discovered_at
                ? `Última descoberta: ${formatDateTime(data.discovered_at)}. A Clara refaz a descoberta todo dia.`
                : isWarehouse && data.http_path
                  ? "Descobrindo a origem…"
                  : "A origem ainda não foi descoberta."}{" "}
              Só aparece o que a credencial da fonte enxerga.
            </p>
            {data.discovery_truncated ? <Alert tone="info">Há mais catálogos do que o limite da descoberta. Informe os catálogos desejados.</Alert> : null}
            {data.objects_truncated ? (
              <Alert tone="info">A origem tem mais objetos do que a lista da tela comporta; as contagens estão completas. Descubra por catálogo para ver todos.</Alert>
            ) : null}
            {data.discovery_errors.length ? (
              <Alert tone="warning">Sem acesso a: {data.discovery_errors.map((item) => `${item.catalog} (${item.error})`).join(", ")}.</Alert>
            ) : null}

            <section className="stack-sm" aria-label="Seleções configuradas">
              <h3 className="small">Seleções configuradas</h3>
              {data.rules.length === 0 ? (
                <EmptyState title="Nada selecionado ainda">Escolha abaixo catálogos, schemas ou tabelas. Sem seleção, a fonte não sincroniza.</EmptyState>
              ) : (
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th scope="col">Seleção</th>
                        <th scope="col">Abrangência e filtros</th>
                        <th scope="col">Domínio</th>
                        <th scope="col">Situação</th>
                        <th scope="col">
                          <span className="visually-hidden">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rules.map((rule) => (
                        <RuleRow key={rule.key} rule={rule} catalog={data.catalogs.find((item) => item.catalog === rule.catalog)} ctx={ctx} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {data.catalogs.length ? (
              <section className="stack-sm" aria-label="Na origem">
                <h3 className="small">Na origem</h3>
                {data.catalogs.map((catalog) => (
                  <CatalogSection key={catalog.catalog} catalog={catalog} ctx={ctx} />
                ))}
              </section>
            ) : null}
          </>
        )}
      </QueryView>

      <Checkbox label="Sincronizar ao incluir (fonte ativa)" checked={syncOnAdd} onChange={(event) => setSyncOnAdd(event.target.checked)} />
      <ManualScopeForm domainsId={domainsId} pending={actions.add.isPending} onSubmit={(input, onDone) => addSelection(ctx, input, notify, onDone)} />
    </div>
  );
}

function addSelection(ctx: Ctx, input: ScopeInput, notify: ReturnType<typeof useNotify>, onDone?: () => void) {
  ctx.actions.add.mutate(
    { ...input, sync: ctx.syncOnAdd },
    {
      onSuccess: (result) => {
        notify("success", `Seleção ${result.scope} incluída no domínio ${result.domain}.${result.note ? ` ${result.note}.` : ""}`);
        if (result.sync_job_id) ctx.onJob(`Sincronização de ${result.scope}`, result.sync_job_id);
        onDone?.();
      },
      onError: (error) => notify("danger", describeError(error)),
    },
  );
}

function RuleRow({ rule, catalog, ctx }: { rule: ConfiguredRule; catalog: DiscoveredCatalog | undefined; ctx: Ctx }) {
  const notify = useNotify();
  const [editing, setEditing] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [label, tone, title] = ruleState(rule);
  const schemas = catalog?.schemas ?? [];
  const ruleSchemas = rule.schema ? schemas.filter((schema) => schema.schema === rule.schema) : schemas;

  const save = (draft: RuleDraft) =>
    ctx.actions.update.mutate(
      {
        scope: rule.key,
        changes: { table_types: draft.table_types, formats: draft.formats, exclude: draft.exclude, ...(draft.domain !== rule.domain ? { domain: draft.domain } : {}) },
      },
      {
        onSuccess: () => {
          notify("success", `Seleção ${rule.key} atualizada.`);
          setEditing(false);
        },
        onError: (error) => notify("danger", describeError(error)),
      },
    );

  const remove = () =>
    ctx.actions.remove.mutate(rule.key, {
      onSuccess: ({ assets_kept }) =>
        notify("success", `Seleção ${rule.key} removida.${assets_kept ? ` ${assets_kept} ativo(s) já importado(s) continuam no catálogo.` : ""}`),
      onError: (error) => notify("danger", describeError(error)),
    });

  return (
    <>
      <tr>
        <td>
          <code>{rule.key}</code>
        </td>
        <td className="small">{describeRule(rule)}</td>
        <td className="small">{rule.domain}</td>
        <td>
          <Badge tone={tone} title={title}>
            {label}
          </Badge>
        </td>
        <td>
          <span className="cluster">
            {confirmingRemoval ? (
              <>
                <Button size="sm" variant="danger" loading={ctx.actions.remove.isPending} onClick={remove}>
                  Confirmar remoção
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingRemoval(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" aria-label={`Editar ${rule.key}`} onClick={() => setEditing(!editing)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Remover ${rule.key}`} onClick={() => setConfirmingRemoval(true)}>
                  Remover
                </Button>
              </>
            )}
          </span>
        </td>
      </tr>
      {editing ? (
        <tr>
          <td colSpan={5}>
            <RuleEditor
              title={`Editar ${rule.key}`}
              initial={rule}
              formats={formatsOf(ruleSchemas)}
              schemas={rule.schema ? undefined : schemas.map((schema) => schema.schema)}
              domainsId={ctx.domainsId}
              submitLabel="Salvar"
              pending={ctx.actions.update.isPending}
              onSubmit={save}
              onCancel={() => setEditing(false)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

const EMPTY_DRAFT: RuleDraft = { domain: "", table_types: null, formats: null, exclude: [] };

function CatalogSection({ catalog, ctx }: { catalog: DiscoveredCatalog; ctx: Ctx }) {
  const notify = useNotify();
  const [selecting, setSelecting] = useState(false);
  const objects = catalog.schemas.reduce((total, schema) => total + schema.tables, 0);

  const selectCatalog = (draft: RuleDraft) => addSelection(ctx, { catalog: catalog.catalog, schema: null, ...draft }, notify, () => setSelecting(false));

  return (
    <div className="catalog-section stack-sm">
      <div className="cluster">
        <strong>
          <code>{catalog.catalog}</code>
        </strong>
        <span className="xsmall muted">
          {catalog.schemas.length} schema(s) · {objects} objeto(s)
        </span>
        {catalog.rule ? (
          <Badge tone="success" title={describeRule(catalog.rule)}>
            Catálogo inteiro → {catalog.rule.domain}
          </Badge>
        ) : (
          <Button size="sm" variant="ghost" aria-label={`Selecionar catálogo ${catalog.catalog} inteiro`} onClick={() => setSelecting(!selecting)}>
            Selecionar catálogo inteiro
          </Button>
        )}
      </div>
      {catalog.comment ? <p className="xsmall muted scope-comments">{catalog.comment}</p> : null}
      {selecting ? (
        <RuleEditor
          title={`Catálogo ${catalog.catalog} inteiro`}
          initial={EMPTY_DRAFT}
          formats={formatsOf(catalog.schemas)}
          schemas={catalog.schemas.map((schema) => schema.schema)}
          domainsId={ctx.domainsId}
          submitLabel="Incluir catálogo"
          pending={ctx.actions.add.isPending}
          onSubmit={selectCatalog}
          onCancel={() => setSelecting(false)}
        />
      ) : null}
      {catalog.schemas.length ? (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th scope="col">Schema</th>
                <th scope="col">Objetos</th>
                <th scope="col">Selecionados</th>
                <th scope="col">Domínio</th>
                <th scope="col">
                  <span className="visually-hidden">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {catalog.schemas.map((schema) => (
                <SchemaRow key={schema.schema} catalog={catalog} schema={schema} ctx={ctx} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="xsmall muted">Nenhum schema visível neste catálogo.</p>
      )}
    </div>
  );
}

function SchemaRow({ catalog, schema, ctx }: { catalog: DiscoveredCatalog; schema: DiscoveredSchema; ctx: Ctx }) {
  const notify = useNotify();
  const [panel, setPanel] = useState<"none" | "rule" | "objects">("none");
  const key = `${catalog.catalog}.${schema.schema}`;
  const inherited: ScopeConfig | null = !schema.rule && schema.owner === catalog.catalog ? catalog.rule : null;
  const decidedBy = schema.rule ? "seleção do schema" : inherited ? "seleção do catálogo" : null;

  const selectSchema = (draft: RuleDraft) =>
    addSelection(ctx, { catalog: catalog.catalog, schema: schema.schema, ...draft }, notify, () => setPanel("none"));

  return (
    <>
      <tr>
        <td>
          <code>{schema.schema}</code>
          {schema.comment ? (
            <div className="scope-comments xsmall muted">
              <p>{schema.comment}</p>
            </div>
          ) : null}
        </td>
        <td className="small">
          {schema.tables}
          {schema.tables ? <div className="xsmall muted">{describeTypes(schema.types)}</div> : null}
        </td>
        <td className="small">
          {decidedBy ? (
            <>
              {schema.selected} de {schema.tables}
              <div className="xsmall muted">pela {decidedBy}</div>
            </>
          ) : (
            <Badge tone="info" title="Visto na origem e fora de qualquer seleção.">
              Não selecionado
            </Badge>
          )}
        </td>
        <td className="small">{schema.domain ?? "—"}</td>
        <td>
          <span className="cluster">
            {!schema.rule ? (
              <Button size="sm" variant="ghost" aria-label={`Selecionar schema ${key}`} onClick={() => setPanel(panel === "rule" ? "none" : "rule")}>
                {inherited ? "Regra própria" : "Selecionar schema"}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" aria-label={`Escolher tabelas de ${key}`} onClick={() => setPanel(panel === "objects" ? "none" : "objects")}>
              Escolher tabelas
            </Button>
          </span>
        </td>
      </tr>
      {panel !== "none" ? (
        <tr>
          <td colSpan={5}>
            {panel === "rule" ? (
              <RuleEditor
                title={`Schema ${key} inteiro`}
                initial={inherited ? { ...EMPTY_DRAFT, domain: inherited.domain, table_types: inherited.table_types, formats: inherited.formats } : EMPTY_DRAFT}
                formats={Object.keys(schema.formats)}
                domainsId={ctx.domainsId}
                submitLabel="Incluir schema"
                pending={ctx.actions.add.isPending}
                onSubmit={selectSchema}
                onCancel={() => setPanel("none")}
              />
            ) : (
              <ObjectPicker
                sourceId={ctx.sourceId}
                catalog={catalog.catalog}
                schema={schema.schema}
                rule={schema.rule}
                inherited={inherited}
                domainsId={ctx.domainsId}
                sync={ctx.syncOnAdd}
                actions={ctx.actions}
                onDone={() => setPanel("none")}
              />
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** Para fontes por arquivo ou nomes fora da descoberta. Schema em branco = catálogo inteiro. */
function ManualScopeForm({
  domainsId,
  pending,
  onSubmit,
}: {
  domainsId: string;
  pending: boolean;
  onSubmit: (input: ScopeInput, onDone?: () => void) => void;
}) {
  const [catalog, setCatalog] = useState("");
  const [schema, setSchema] = useState("");
  const [domain, setDomain] = useState("");
  const ready = catalog.trim() && domain.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ catalog: catalog.trim(), schema: schema.trim() || null, domain: domain.trim() }, () => {
      setCatalog("");
      setSchema("");
    });
  };

  return (
    <form className="scope-form" onSubmit={submit} aria-label="Adicionar seleção manualmente">
      <Field label="Catálogo">{(props) => <TextInput {...props} value={catalog} onChange={(e) => setCatalog(e.target.value)} />}</Field>
      <Field label="Schema" hint="Em branco = catálogo inteiro.">
        {(props) => <TextInput {...props} value={schema} onChange={(e) => setSchema(e.target.value)} />}
      </Field>
      <Field label="Domínio" hint="Define quem vê os ativos desta seleção.">
        {(props) => <TextInput {...props} list={domainsId} value={domain} onChange={(e) => setDomain(e.target.value)} />}
      </Field>
      <Button type="submit" disabled={!ready} loading={pending}>
        Adicionar seleção
      </Button>
    </form>
  );
}
