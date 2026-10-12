import { useState } from "react";

import type { GlossarySuggestion, SuggestionStatus } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { formatDateTime } from "@/shared/format";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, Panel, Segmented, TextInput } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";

import { useDecideSuggestion, useGlossarySuggestions } from "./hooks";

const STATUS_LABEL: Record<SuggestionStatus, string> = { pending: "Pendentes", accepted: "Aceitas", rejected: "Rejeitadas", expired: "Expiradas" };

/** Termos propostos pela IA a partir do conteúdo publicado. Nada vale para a busca até um
 *  curador aceitar; as perguntas dos usuários só ordenam a fila (não são enviadas ao modelo). */
export function SuggestionsTab() {
  const [status, setStatus] = useState<SuggestionStatus>("pending");
  const suggestions = useGlossarySuggestions(status);
  return (
    <Panel
      title="Sugestões de termos"
      actions={
        <Segmented
          label="Situação"
          value={status}
          onChange={setStatus}
          options={(["pending", "accepted", "rejected"] as const).map((value) => ({ value, label: STATUS_LABEL[value] }))}
        />
      }
    >
      <p className="xsmall muted" style={{ marginBottom: "var(--space-3)" }}>
        Geradas só a partir de fichas publicadas não restritas e verificadas contra o vocabulário delas. “Procuras” conta quantas perguntas sem resposta
        contêm a expressão.
      </p>
      <QueryView query={suggestions} skeletonLines={5}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title={status === "pending" ? "Nenhuma sugestão pendente" : `Nenhuma sugestão ${STATUS_LABEL[status].toLowerCase()}`}>
              {status === "pending" ? "As sugestões chegam pelo job diário, quando o recurso está ligado no backend." : null}
            </EmptyState>
          ) : (
            <ul className="requests">
              {rows.map((suggestion) => (
                <SuggestionItem key={suggestion.id} suggestion={suggestion} />
              ))}
            </ul>
          )
        }
      </QueryView>
    </Panel>
  );
}

function SuggestionItem({ suggestion }: { suggestion: GlossarySuggestion }) {
  const decide = useDecideSuggestion();
  const notify = useNotify();
  const [term, setTerm] = useState(suggestion.term);
  const [expansions, setExpansions] = useState(suggestion.expansions.join(", "));
  const parsed = expansions.split(",").map((value) => value.trim()).filter(Boolean);
  const pending = suggestion.status === "pending";

  const accept = () => {
    // Só envia o que o curador mudou: o resto fica como sugerido.
    const edits = {
      ...(term.trim() !== suggestion.term ? { term: term.trim() } : {}),
      ...(parsed.join("|") !== suggestion.expansions.join("|") ? { expansions: parsed } : {}),
    };
    decide.accept.mutate(
      { id: suggestion.id, edits },
      {
        onSuccess: () => notify("success", `“${term.trim()}” agora também busca por ${parsed.join(", ")}.`),
        onError: (error) => notify("danger", describeError(error)),
      },
    );
  };

  const reject = () =>
    decide.reject.mutate(suggestion.id, {
      onSuccess: () => notify("success", `Sugestão “${suggestion.term}” rejeitada.`),
      onError: (error) => notify("danger", describeError(error)),
    });

  return (
    <li className="request">
      <div className="spread">
        {pending ? (
          <TextInput aria-label={`Expressão sugerida ${suggestion.id}`} value={term} onChange={(e) => setTerm(e.target.value)} style={{ maxWidth: 320 }} />
        ) : (
          <strong>“{suggestion.term}”</strong>
        )}
        <span className="cluster xsmall">
          <Badge>{suggestion.domain}</Badge>
          <Badge tone={suggestion.demand ? "warning" : "neutral"} title="Perguntas sem resposta que contêm a expressão">
            {suggestion.demand} procura(s)
          </Badge>
        </span>
      </div>
      {pending ? (
        <TextInput aria-label={`Buscar também por ${suggestion.id}`} value={expansions} onChange={(e) => setExpansions(e.target.value)} />
      ) : (
        <span className="cluster">
          {suggestion.expansions.map((value) => (
            <Badge key={value} tone="accent">
              {value}
            </Badge>
          ))}
        </span>
      )}
      {suggestion.rationale ? <p className="small muted">{suggestion.rationale}</p> : null}
      {pending ? (
        <div className="cluster">
          <Button size="sm" variant="primary" disabled={term.trim().length < 2 || !parsed.length} loading={decide.accept.isPending} onClick={accept}>
            Aceitar
          </Button>
          <Button size="sm" variant="ghost" loading={decide.reject.isPending} onClick={reject}>
            Rejeitar
          </Button>
        </div>
      ) : (
        <p className="xsmall muted">
          {STATUS_LABEL[suggestion.status]} por {suggestion.decided_by ?? "—"} em {suggestion.decided_at ? formatDateTime(suggestion.decided_at) : "—"}
        </p>
      )}
    </li>
  );
}
