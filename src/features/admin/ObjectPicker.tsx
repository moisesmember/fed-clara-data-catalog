import { useState } from "react";

import type { DiscoveredObject, ScopeConfig, ScopeInput } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, Checkbox, Field, Segmented, TextInput } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";

import { useDiscoveredObjects, type useScopeActions } from "./hooks";
import { kindOf, passesFilters, TABLE_KIND_LABEL } from "./selection";

type Mode = "whole" | "chosen";

const MODES: { value: Mode; label: string; description: string }[] = [
  { value: "whole", label: "Schema inteiro", description: "Tabelas novas na origem entram sozinhas; desmarcadas viram exceção." },
  { value: "chosen", label: "Só as marcadas", description: "Lista fechada: tabela nova não entra sem nova escolha." },
];

/** Tabelas e views de um schema na última descoberta. Marcar e salvar vira a seleção do schema:
 *  inteiro com exceções ou só as marcadas. Se hoje quem decide é a seleção do catálogo, o schema
 *  passa a ter seleção própria (que vence a do catálogo). */
export function ObjectPicker({
  sourceId,
  catalog,
  schema,
  rule,
  inherited,
  domainsId,
  sync,
  actions,
  onDone,
}: {
  sourceId: string;
  catalog: string;
  schema: string;
  /** Seleção configurada neste schema, se houver. */
  rule: ScopeConfig | null;
  /** Seleção do catálogo que hoje decide este schema, se houver. */
  inherited: ScopeConfig | null;
  domainsId: string;
  sync: boolean;
  actions: ReturnType<typeof useScopeActions>;
  onDone: () => void;
}) {
  const objects = useDiscoveredObjects(sourceId, catalog, schema);
  return (
    <div className="object-picker stack-sm">
      <QueryView query={objects} skeletonLines={3}>
        {(data) =>
          data.objects.length === 0 ? (
            <EmptyState title="A última descoberta não viu objetos neste schema" />
          ) : (
            <PickerForm
              key={`${rule?.tables?.join(",")}|${rule?.exclude.join(",")}`}
              catalog={catalog}
              schema={schema}
              rule={rule}
              inherited={inherited}
              objects={data.objects}
              domainsId={domainsId}
              sync={sync}
              actions={actions}
              onDone={onDone}
            />
          )
        }
      </QueryView>
    </div>
  );
}

function PickerForm({
  catalog,
  schema,
  rule,
  inherited,
  objects,
  domainsId,
  sync,
  actions,
  onDone,
}: {
  catalog: string;
  schema: string;
  rule: ScopeConfig | null;
  inherited: ScopeConfig | null;
  objects: DiscoveredObject[];
  domainsId: string;
  sync: boolean;
  actions: ReturnType<typeof useScopeActions>;
  onDone: () => void;
}) {
  const notify = useNotify();
  const filters = rule ?? inherited ?? { table_types: null, formats: null };
  const [mode, setMode] = useState<Mode>(rule?.tables ? "chosen" : "whole");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(objects.filter((item) => item.selected).map((item) => item.name)));
  const [domain, setDomain] = useState(rule?.domain ?? inherited?.domain ?? "");
  const eligible = (item: DiscoveredObject) => passesFilters(filters, item.table_type, item.data_format);
  const key = `${catalog}.${schema}`;

  const toggle = (name: string, on: boolean) =>
    setChecked((current) => {
      const next = new Set(current);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });

  const selection = (): Pick<ScopeConfig, "tables" | "exclude"> => {
    const names = objects.filter((item) => eligible(item) && checked.has(item.name)).map((item) => item.name);
    if (mode === "chosen") return { tables: names, exclude: [] };
    return { tables: null, exclude: objects.filter((item) => eligible(item) && !checked.has(item.name)).map((item) => item.name) };
  };

  const save = () => {
    const chosen = selection();
    if (chosen.tables && chosen.tables.length === 0) {
      notify("danger", "Marque ao menos uma tabela, ou escolha “Schema inteiro”.");
      return;
    }
    const onError = (error: unknown) => notify("danger", describeError(error));
    if (rule) {
      actions.update.mutate(
        { scope: key, changes: chosen },
        {
          onSuccess: () => {
            notify("success", `Seleção de ${key} salva.`);
            onDone();
          },
          onError,
        },
      );
      return;
    }
    const input: ScopeInput & { sync: boolean } = {
      catalog, schema, domain: domain.trim(), table_types: inherited?.table_types ?? null, formats: inherited?.formats ?? null, ...chosen, sync,
    };
    actions.add.mutate(input, {
      onError,
      onSuccess: (result) => {
        notify("success", `Seleção de ${key} criada no domínio ${result.domain}.${result.note ? ` ${result.note}.` : ""}`);
        onDone();
      },
    });
  };

  const count = objects.filter((item) => eligible(item) && checked.has(item.name)).length;

  return (
    <div className="stack-sm">
      {!rule && inherited ? (
        <p className="xsmall muted">
          Hoje quem decide aqui é a seleção do catálogo <code>{inherited.catalog}</code>. Ao salvar, este schema passa a ter seleção própria, com os mesmos
          filtros, e a do catálogo deixa de valer nele.
        </p>
      ) : null}
      <div className="cluster">
        <Segmented label={`Abrangência em ${key}`} options={MODES} value={mode} onChange={setMode} />
        <span className="xsmall muted">{MODES.find((option) => option.value === mode)?.description}</span>
      </div>
      <ul className="object-list" aria-label={`Objetos de ${key}`}>
        {objects.map((item) => {
          const kind = kindOf(item.table_type);
          const ok = eligible(item);
          return (
            <li key={item.name}>
              <Checkbox
                label={
                  <>
                    <code>{item.name}</code> <span className="xsmall muted">{kind ? TABLE_KIND_LABEL[kind] : (item.table_type ?? "Tipo desconhecido")}</span>
                    {item.data_format ? <span className="xsmall muted"> · {item.data_format}</span> : null}
                  </>
                }
                checked={ok && checked.has(item.name)}
                disabled={!ok}
                onChange={(event) => toggle(item.name, event.target.checked)}
              />
              {!ok ? <Badge tone="neutral" title="Mude os filtros de tipo/formato da seleção para incluí-lo.">fora do filtro</Badge> : null}
            </li>
          );
        })}
      </ul>
      <div className="cluster">
        {!rule ? (
          <Field label="Domínio">
            {(props) => <TextInput {...props} list={domainsId} value={domain} onChange={(event) => setDomain(event.target.value)} style={{ maxWidth: 180 }} />}
          </Field>
        ) : null}
        <span className="small">{count} de {objects.length} selecionado(s)</span>
        <Button size="sm" variant="primary" disabled={!rule && !domain.trim()} loading={actions.add.isPending || actions.update.isPending} onClick={save}>
          Salvar seleção
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
