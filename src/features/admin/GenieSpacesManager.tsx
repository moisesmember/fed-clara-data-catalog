import { useState, type FormEvent } from "react";

import type { SourceSummary } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, Field, TextInput } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";

import { useGenieActions, useGenieSpaces } from "./hooks";

/** Espaços Genie oferecidos como atalho quando a Clara não tem a resposta e na ajuda do curador
 *  (ADR 0016 do backend). Só o vínculo: a Clara não chama o Genie nem vê os dados dele. */
export function GenieSpacesManager({ source }: { source: SourceSummary }) {
  const spaces = useGenieSpaces(source.id);
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

  return (
    <div className="stack">
      <p className="xsmall muted">
        Quando a Clara não tem a resposta (pedido de valor ou dado ainda não catalogado), ela oferece estes espaços. O Genie responde no Databricks com as
        permissões de quem pergunta: dê CAN RUN no espaço a quem deve usá-lo.
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
