import { useState, type FormEvent } from "react";

import type { GenieCoverageRow, SourceSummary } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { formatDateTime } from "@/shared/format";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, Field, TextInput } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";

import { useGenieActions, useGenieCoverage, useGenieSpaces } from "./hooks";

const COVERAGE: Record<GenieCoverageRow["status"], [string, "success" | "info" | "warning", string]> = {
  catalogued: ["Catalogada", "success", "Já tem ativo na Clara; o contexto do Genie entra na curadoria dele."],
  selected: ["Na seleção", "info", "A seleção da fonte já a inclui: entra na próxima sincronização."],
  not_selected: ["Fora da seleção", "warning", "O time usa no Genie, mas a Clara não cataloga. Inclua em “Selecionar o que publicar”."],
};

/** Espaços Genie da fonte (ADRs 0016, 0017 e 0018 do backend): atalho quando a Clara não tem a
 *  resposta, contexto para a curadoria e apoio nas lacunas (o Genie sugere significados quando a
 *  origem não descreve). A Clara não escreve nada no Genie nem no Databricks. */
export function GenieSpacesManager({ source, onJob }: { source: SourceSummary; onJob?: (label: string, jobId: number) => void }) {
  const spaces = useGenieSpaces(source.id);
  const coverage = useGenieCoverage(source.id);
  const actions = useGenieActions(source.id);
  const notify = useNotify();
  const [confirming, setConfirming] = useState<number | null>(null);

  const remove = (genieId: number, title: string) =>
    actions.remove.mutate(genieId, {
      onSuccess: () => {
        notify("success", `Atalho “${title}” removido.`);
        setConfirming(null);
      },
      onError: (error) => notify("danger", describeError(error)),
    });

  const reload = () =>
    actions.reload.mutate(undefined, {
      onSuccess: ({ job_id }) => onJob?.("Atualização do contexto do Genie", job_id),
      onError: (error) => notify("danger", describeError(error)),
    });

  return (
    <div className="stack">
      <p className="xsmall muted">
        Quando a Clara não tem a resposta (pedido de valor ou dado ainda não catalogado), ela oferece estes espaços; o Genie responde no Databricks com as
        permissões de quem pergunta (dê CAN RUN no espaço a quem deve usá-lo). A configuração do espaço também vira contexto da curadoria: descrições,
        instruções e perguntas de exemplo, lidas todo dia e guardadas só na Clara (a credencial da fonte precisa de CAN EDIT no espaço). Quando
        faltam descrições na origem, a curadoria pergunta ao Genie e mostra as respostas como sugestão (a credencial precisa de CAN RUN no espaço e
        SELECT nas tabelas; só o texto do Genie é guardado).
      </p>
      <QueryView query={spaces} skeletonLines={2}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="Nenhum espaço Genie registrado" />
          ) : (
            <ul className="genie-admin-list">
              {rows.map((space) => (
                <li key={space.id} className="cluster">
                  <a href={space.url} target="_blank" rel="noopener noreferrer">
                    {space.title}
                  </a>
                  {space.domains.map((domain) => (
                    <Badge key={domain}>{domain === "*" ? "todos os domínios" : domain}</Badge>
                  ))}
                  {space.description ? <span className="xsmall muted">{space.description}</span> : null}
                  <GenieSyncState synced={space.synced_at} error={space.sync_error} tables={space.tables} questions={space.questions} />
                  {confirming === space.id ? (
                    <>
                      <Button size="sm" variant="danger" loading={actions.remove.isPending} onClick={() => remove(space.id, space.title)}>
                        Confirmar remoção
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" aria-label={`Remover atalho ${space.title}`} onClick={() => setConfirming(space.id)}>
                      Remover
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </QueryView>
      {spaces.data?.length ? (
        <div className="cluster">
          <Button size="sm" onClick={reload} loading={actions.reload.isPending}>
            Atualizar do Genie
          </Button>
          <span className="xsmall muted">Relê a configuração dos espaços agora (sem executar perguntas).</span>
        </div>
      ) : null}
      <GenieCoverage rows={coverage.data ?? []} />
      <GenieSpaceForm pending={actions.add.isPending} onSubmit={(input, onDone) =>
        actions.add.mutate(input, {
          onSuccess: () => {
            notify("success", `Atalho “${input.title}” registrado.`);
            onDone();
          },
          onError: (error) => notify("danger", describeError(error)),
        })
      } />
    </div>
  );
}

function GenieSyncState({ synced, error, tables, questions }: { synced: string | null; error: string | null; tables: number; questions: number }) {
  if (error) {
    return (
      <Badge tone="warning" title="Verifique se a credencial da fonte tem CAN EDIT no espaço. O último retrato lido continua valendo.">
        Leitura falhou ({error})
      </Badge>
    );
  }
  if (!synced) return <span className="xsmall muted">Lendo a configuração do espaço…</span>;
  return (
    <span className="xsmall muted">
      Lido em {formatDateTime(synced)} · {tables} tabela(s) · {questions} pergunta(s)
    </span>
  );
}

/** O que os espaços Genie usam e a Clara ainda não cataloga: pendência de catalogação. */
function GenieCoverage({ rows }: { rows: GenieCoverageRow[] }) {
  if (!rows.length) return null;
  const missing = rows.filter((row) => row.status === "not_selected").length;
  return (
    <section className="stack-sm" aria-label="Tabelas usadas no Genie">
      <h4 className="small">Tabelas usadas no Genie</h4>
      {missing ? <p className="small">{missing} tabela(s) usada(s) no Genie ainda não fazem parte da seleção da fonte.</p> : null}
      <ul className="genie-admin-list">
        {rows.map((row) => {
          const [label, tone, title] = COVERAGE[row.status];
          return (
            <li key={row.fqn} className="cluster">
              <code>{row.fqn}</code>
              <Badge tone={tone} title={title}>
                {label}
              </Badge>
              <span className="xsmall muted">{row.spaces.join(", ")}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Aceita o id do espaço ou o link copiado do Genie (…/genie/rooms/<id>). */
export function spaceIdFrom(value: string): string {
  const match = /\/genie\/(?:rooms|spaces)\/([A-Za-z0-9]+)/.exec(value);
  return (match?.[1] ?? value).trim();
}

function GenieSpaceForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (input: { space_id: string; title: string; description?: string; domains: string[] }, onDone: () => void) => void;
}) {
  const [space, setSpace] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domains, setDomains] = useState("");
  const domainList = domains.split(",").map((domain) => domain.trim()).filter(Boolean);
  const ready = spaceIdFrom(space) && title.trim() && domainList.length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ space_id: spaceIdFrom(space), title: title.trim(), description: description.trim() || undefined, domains: domainList }, () => {
      setSpace("");
      setTitle("");
      setDescription("");
      setDomains("");
    });
  };

  return (
    <form className="scope-form" onSubmit={submit} aria-label="Registrar espaço Genie">
      <Field label="Espaço Genie" hint="Cole o link do espaço (Compartilhar) ou o id, em Configurações.">
        {(props) => <TextInput {...props} value={space} onChange={(event) => setSpace(event.target.value)} autoComplete="off" />}
      </Field>
      <Field label="Título" hint="Aparece no botão. Ex.: Vendas e faturamento">
        {(props) => <TextInput {...props} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />}
      </Field>
      <Field label="Descrição (opcional)">
        {(props) => <TextInput {...props} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />}
      </Field>
      <Field label="Domínios" hint="Separados por vírgula; * = todos.">
        {(props) => <TextInput {...props} value={domains} onChange={(event) => setDomains(event.target.value.toLowerCase())} placeholder="financeiro, comercial" />}
      </Field>
      <Button type="submit" disabled={!ready} loading={pending}>
        Registrar atalho
      </Button>
    </form>
  );
}
