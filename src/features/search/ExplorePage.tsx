import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";

import type { AnswerSuggestion, SearchMode } from "@/api/types";
import { Button, PageHeader, Panel, Segmented, Tabs, TextArea } from "@/shared/ui/primitives";
import { ErrorState, Skeleton } from "@/shared/ui/states";

import { AnswerView } from "./AnswerView";
import { BrowseView } from "./BrowseView";
import { RequestHelpButton } from "./HelpActions";
import { useAskQuestion, useCatalogBrowse, useCatalogSearch } from "./hooks";
import { SearchBox } from "./SearchBox";
import { SearchResults } from "./SearchResults";
import "./search.css";

type Tab = "buscar" | "perguntar" | "navegar";

const MODE_OPTIONS: { value: SearchMode; label: string; description: string }[] = [
  { value: "text", label: "Por palavras", description: "Encontra as palavras que você digitou (mais previsível)" },
  { value: "hybrid", label: "Por significado", description: "Também encontra textos parecidos, mesmo com outras palavras ou erros de digitação" },
];

const FALLBACK_EXAMPLES = ["onde encontro as vendas por região?", "tem algum cadastro de clientes?", "quais dados existem sobre empréstimos?"];

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("aba");
  const tab: Tab = tabParam === "perguntar" || tabParam === "navegar" ? tabParam : "buscar";
  const mode: SearchMode = params.get("modo") === "hybrid" ? "hybrid" : "text";

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="Descobrir"
        title="Encontre os dados que você precisa"
        subtitle="Descreva o que procura do seu jeito, faça uma pergunta ou navegue pelos assuntos. Você só vê fichas que tem permissão de acessar."
        actions={<Segmented label="Como buscar" options={MODE_OPTIONS} value={mode} onChange={(value) => update({ modo: value === "text" ? null : value })} />}
      />
      <Tabs
        label="Forma de explorar"
        value={tab}
        onChange={(value) => update({ aba: value === "buscar" ? null : value })}
        tabs={[
          { value: "buscar", label: "Buscar" },
          { value: "perguntar", label: "Perguntar" },
          { value: "navegar", label: "Navegar pelos assuntos" },
        ]}
      />
      {tab === "buscar" ? (
        <SearchTab query={params.get("q") ?? ""} mode={mode} onSubmit={(q) => update({ q })} onBrowse={() => update({ aba: "navegar" })} />
      ) : tab === "perguntar" ? (
        <AskTab key={params.get("pergunta") ?? ""} initialQuestion={params.get("pergunta") ?? ""} mode={mode} />
      ) : (
        <BrowseView onAsk={(question) => update({ aba: "perguntar", pergunta: question })} />
      )}
    </>
  );
}

function SearchTab({ query, mode, onSubmit, onBrowse }: { query: string; mode: SearchMode; onSubmit: (query: string) => void; onBrowse: () => void }) {
  const search = useCatalogSearch(query, mode);
  return (
    <div className="stack">
      <SearchBox initialValue={query} onSubmit={onSubmit} />
      {query.trim().length < 2 ? (
        <p className="muted small">
          Não sabe por onde começar? <button type="button" className="link-button" onClick={onBrowse}>Navegue pelos assuntos</button>.
        </p>
      ) : search.isPending ? (
        <Skeleton lines={5} />
      ) : search.error ? (
        <ErrorState error={search.error} onRetry={() => void search.refetch()} />
      ) : (
        <>
          {search.data?.expanded_terms?.length ? (
            <p className="xsmall muted" role="status">
              Também procurei por: <strong>{(search.data.added_terms ?? []).join(", ")}</strong> (entendi “{search.data.expanded_terms.join("”, “")}”).
            </p>
          ) : null}
          <SearchResults hits={search.data?.results ?? []} query={query} />
          {search.data && search.data.results.length === 0 ? (
            <div className="cluster">
              <RequestHelpButton question={query} />
              <Button size="sm" variant="ghost" onClick={onBrowse}>
                Navegar pelos assuntos
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function AskTab({ initialQuestion, mode }: { initialQuestion: string; mode: SearchMode }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [asked, setAsked] = useState(initialQuestion);
  const ask = useAskQuestion();
  const browse = useCatalogBrowse();
  const autoAsked = useRef(false);
  const examples = browse.data?.domains.flatMap((d) => d.example_questions).slice(0, 5) ?? [];

  const send = (text: string, allowClarification = true) => {
    setAsked(text);
    ask.mutate({ question: text, mode, allowClarification });
  };

  useEffect(() => {
    // Pergunta vinda da aba "Navegar": já envia, poupando um clique.
    if (initialQuestion.trim().length >= 3 && !autoAsked.current) {
      autoAsked.current = true;
      ask.mutate({ question: initialQuestion.trim(), mode, allowClarification: true });
    }
  }, [initialQuestion, mode, ask]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (question.trim().length >= 3) send(question.trim());
  };

  const choose = (option: AnswerSuggestion) => {
    const refined = `${asked} — ${option.business_name}`;
    setQuestion(refined);
    send(refined, false);
  };

  return (
    <div className="grid-2">
      <div className="stack">
        <form className="stack-sm" onSubmit={submit} aria-label="Fazer uma pergunta">
          <label htmlFor="pergunta" className="ui-field__label">
            O que você quer saber sobre os dados?
          </label>
          <TextArea
            id="pergunta"
            value={question}
            maxLength={500}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Escreva como falaria com um colega. Ex.: onde vejo quanto cada loja vendeu?"
          />
          <div className="spread">
            <span className="xsmall muted">{question.length}/500</span>
            <Button type="submit" variant="primary" loading={ask.isPending} disabled={question.trim().length < 3}>
              Perguntar
            </Button>
          </div>
        </form>
        {ask.isPending ? <Skeleton lines={4} /> : null}
        {ask.error ? <ErrorState error={ask.error} /> : null}
        {ask.data && !ask.isPending ? <AnswerView response={ask.data} question={asked} onChoose={choose} /> : null}
      </div>
      <Panel title="Como perguntar">
        <div className="stack-sm small">
          <p>Pergunte <strong>onde estão</strong> e <strong>o que significam</strong> os dados — não precisa saber o nome das tabelas.</p>
          <p className="muted">
            Eu não calculo valores (como “quanto vendemos ontem”), mas mostro onde está o dado e quem é o responsável.
          </p>
          <div className="stack-sm">
            <span className="xsmall muted">Exemplos</span>
            {(examples.length ? examples : FALLBACK_EXAMPLES).map((example) => (
              <Button key={example} size="sm" variant="ghost" onClick={() => setQuestion(example)} style={{ justifyContent: "flex-start" }}>
                {example}
              </Button>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
