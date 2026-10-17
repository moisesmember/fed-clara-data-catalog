import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { HelpRequest } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { formatDateTime } from "@/shared/format";
import { GenieShortcuts } from "@/shared/genie/GenieShortcuts";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, PageHeader, Panel, Segmented, Tabs, TextInput } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";

import { GlossaryForm } from "./GlossaryForm";
import { useDeleteTerm, useGlossary, useHelpRequests, useResolveHelp, useUnanswered } from "./hooks";
import { SuggestionsTab } from "./SuggestionsTab";
import "./demands.css";

type Tab = "perguntas" | "ajuda" | "glossario" | "sugestoes";
const TABS: readonly Tab[] = ["perguntas", "ajuda", "glossario", "sugestoes"];

const KIND_LABEL: Record<string, [string, "neutral" | "warning" | "info" | "danger"]> = {
  search_no_results: ["Busca sem resultado", "warning"],
  answer_no_evidence: ["Pergunta sem resposta", "warning"],
  answer_out_of_scope: ["Pediu um valor", "info"],
  answer_clarify: ["Pergunta vaga", "neutral"],
  feedback_not_helpful: ["Não ajudou", "danger"],
};

/** O que os usuários procuram e não encontram: matéria-prima do glossário e da curadoria. */
export function DemandsPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("aba");
  const tab: Tab = TABS.find((value) => value === tabParam) ?? "perguntas";
  return (
    <>
      <PageHeader
        eyebrow="Curadoria"
        title="Demandas dos usuários"
        subtitle="Perguntas sem resposta, pedidos de ajuda e o glossário que traduz o jeito como as pessoas falam para os termos do catálogo."
      />
      <Tabs
        label="Demandas"
        value={tab}
        onChange={(value) => setParams(value === "perguntas" ? {} : { aba: value }, { replace: true })}
        tabs={[
          { value: "perguntas", label: "Perguntas sem resposta" },
          { value: "ajuda", label: "Pedidos de ajuda" },
          { value: "glossario", label: "Glossário" },
          { value: "sugestoes", label: "Sugestões da IA" },
        ]}
      />
      {tab === "perguntas" ? <UnansweredTab /> : tab === "ajuda" ? <HelpTab /> : tab === "glossario" ? <GlossaryTab /> : <SuggestionsTab />}
    </>
  );
}

function UnansweredTab() {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const [teaching, setTeaching] = useState<string | null>(null);
  const unanswered = useUnanswered(Number(days));
  return (
    <Panel
      title="Mais procurado sem resposta"
      actions={
        <Segmented
          label="Período"
          value={days}
          onChange={setDays}
          options={[
            { value: "7", label: "7 dias" },
            { value: "30", label: "30 dias" },
            { value: "90", label: "90 dias" },
          ]}
        />
      }
    >
      <p className="xsmall muted" style={{ marginBottom: "var(--space-3)" }}>
        Textos com e-mails, documentos e números longos são mascarados; não registramos quem perguntou. Os registros expiram automaticamente.
      </p>
      <QueryView query={unanswered} skeletonLines={6}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="Nada pendente no período">Os usuários dos seus domínios estão encontrando o que procuram.</EmptyState>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th scope="col">O que procuraram</th>
                    <th scope="col">Vezes</th>
                    <th scope="col">Sinais</th>
                    <th scope="col">Última vez</th>
                    <th scope="col">
                      <span className="visually-hidden">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.query}>
                      <td>
                        “{row.query}”
                        {teaching === row.query ? (
                          <div className="teach">
                            <GlossaryForm initialTerm={row.query} onSaved={() => setTeaching(null)} />
                          </div>
                        ) : null}
                      </td>
                      <td>{row.occurrences}</td>
                      <td>
                        <span className="cluster">
                          {row.kinds.map((kind) => {
                            const [label, tone] = KIND_LABEL[kind] ?? [kind, "neutral"];
                            return (
                              <Badge key={kind} tone={tone}>
                                {label}
                              </Badge>
                            );
                          })}
                        </span>
                      </td>
                      <td className="small muted">{formatDateTime(row.last_seen)}</td>
                      <td>
                        <Button size="sm" variant="ghost" onClick={() => setTeaching(teaching === row.query ? null : row.query)}>
                          {teaching === row.query ? "Fechar" : "Ensinar ao glossário"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </QueryView>
    </Panel>
  );
}

function HelpTab() {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const requests = useHelpRequests(status);
  return (
    <Panel
      title="Pedidos de ajuda"
      actions={
        <Segmented
          label="Situação"
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "Abertos" },
            { value: "resolved", label: "Resolvidos" },
          ]}
        />
      }
    >
      <QueryView query={requests} skeletonLines={5}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title={status === "open" ? "Nenhum pedido aberto" : "Nenhum pedido resolvido"} />
          ) : (
            <ul className="requests">
              {rows.map((request) => (
                <HelpRequestItem key={request.id} request={request} />
              ))}
            </ul>
          )
        }
      </QueryView>
    </Panel>
  );
}

function HelpRequestItem({ request }: { request: HelpRequest }) {
  const [note, setNote] = useState("");
  const resolve = useResolveHelp();
  const notify = useNotify();
  return (
    <li className="request">
      <div className="spread">
        <strong>“{request.question}”</strong>
        <span className="xsmall muted">
          {request.requester} · {formatDateTime(request.created_at)}
        </span>
      </div>
      <div className="cluster xsmall">
        {request.domains.map((d) => (
          <Badge key={d}>{d === "*" ? "todos os domínios" : d}</Badge>
        ))}
        {request.asset_id ? <Link to={`/fichas/${request.asset_id}`}>Ficha relacionada →</Link> : null}
      </div>
      {request.status === "open" ? (
        <GenieShortcuts
          spaces={request.genie_spaces}
          question={request.question}
          intro="Investigue no Genie onde está esse dado; se ele ainda não estiver catalogado, inclua a fonte e responda o pedido com a ficha."
        />
      ) : null}
      {request.status === "open" ? (
        <form
          className="cluster"
          onSubmit={(event) => {
            event.preventDefault();
            resolve.mutate(
              { requestId: request.id, note },
              { onSuccess: () => notify("success", "Pedido resolvido."), onError: (error) => notify("danger", describeError(error)) },
            );
          }}
        >
          <TextInput aria-label="Resposta ao usuário" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Como foi resolvido (ex.: use a ficha X)" style={{ maxWidth: 420 }} />
          <Button type="submit" size="sm" variant="primary" loading={resolve.isPending}>
            Marcar como resolvido
          </Button>
        </form>
      ) : (
        <p className="small muted">
          Resolvido por {request.resolved_by}: {request.resolution_note ?? "sem observação"}
        </p>
      )}
    </li>
  );
}

function GlossaryTab() {
  const glossary = useGlossary();
  const remove = useDeleteTerm();
  const notify = useNotify();
  return (
    <div className="grid-2">
      <Panel title="Termos do glossário">
        <QueryView query={glossary} skeletonLines={6}>
          {(terms) =>
            terms.length === 0 ? (
              <EmptyState title="Glossário vazio">Comece pelas perguntas sem resposta mais frequentes.</EmptyState>
            ) : (
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Quando alguém disser</th>
                      <th scope="col">Buscar também por</th>
                      <th scope="col">Domínio</th>
                      <th scope="col">
                        <span className="visually-hidden">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {terms.map((term) => (
                      <tr key={term.id}>
                        <td>“{term.term}”</td>
                        <td>
                          <span className="cluster">
                            {term.expansions.map((e) => (
                              <Badge key={e} tone="accent">
                                {e}
                              </Badge>
                            ))}
                          </span>
                        </td>
                        <td className="small">{term.domain === "*" ? "todos" : term.domain}</td>
                        <td>
                          {term.can_manage ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Remover ${term.term}`}
                              onClick={() =>
                                remove.mutate(term.id, {
                                  onSuccess: () => notify("success", `“${term.term}” removido.`),
                                  onError: (error) => notify("danger", describeError(error)),
                                })
                              }
                            >
                              Remover
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </QueryView>
      </Panel>
      <Panel title="Adicionar termo">
        <GlossaryForm />
      </Panel>
    </div>
  );
}
