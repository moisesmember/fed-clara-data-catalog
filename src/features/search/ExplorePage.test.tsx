import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { RecordedCall } from "@/test/fakeHttpClient";
import { FakeHttpClient } from "@/test/fakeHttpClient";
import { renderApp } from "@/test/renderApp";

const hit = {
  asset_id: 3, card_id: 1, publication_id: 1, chunk_id: 9, score: 0.03, fqn: "lab_dw.vendas.ft_faturamento",
  business_name: "Faturamento por item", domain: "financeiro", visibility: "domain", trust_status: "not_validated",
  revision_no: 1, asset_version_no: 1, review_required: true, branches: ["text", "vector"], owner: "gerencia.comercial", subject: "Vendas",
};
const metrics = { wall_ms: 80, llm_calls: 1, docs_retrieved: 2, context_chars: 900 };
const option = (asset_id: number, business_name: string) => ({
  asset_id, business_name, fqn: `lab.vendas.t${asset_id}`, owner: "gerencia.comercial", subject: "Vendas", domain: "financeiro", trust_status: "not_validated",
});
const browse = {
  domains: [
    {
      domain: "financeiro", card_count: 1, example_questions: ["onde encontro o faturamento por nota?"],
      subjects: [{ subject: "Vendas", cards: [{ asset_id: 3, business_name: "Faturamento por item", fqn: hit.fqn, summary: "O que foi faturado em cada nota.", trust_status: "not_validated" }] }],
    },
  ],
};

function askResponder(byQuestion: (question: string, allow: boolean) => object) {
  return ({ options }: RecordedCall) => {
    const body = options.json as { question: string; allow_clarification: boolean };
    return { degraded: [], mode: "text", metrics, citations: [], suggestions: [], expanded_terms: [], intent: "discovery", ...byQuestion(body.question, body.allow_clarification) };
  };
}

describe("Explorar (busca)", () => {
  it("busca com o modo escolhido, mostra confiança e o que o glossário entendeu", async () => {
    const http = new FakeHttpClient({
      "GET /search": { cache_hit: false, expanded_terms: ["dinheiro que entrou"], added_terms: ["faturamento"], results: [hit] },
    });
    renderApp({ path: "/explorar?q=dinheiro%20que%20entrou&modo=hybrid", subject: "joao.consumidor", http });

    const result = await screen.findByRole("link", { name: "Faturamento por item" });
    expect(result).toHaveAttribute("href", "/fichas/3");
    const item = result.closest("li") as HTMLElement;
    expect(within(item).getByText("Não validado")).toBeInTheDocument();
    expect(within(item).getByText("Revisão pendente")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Também procurei por: faturamento");
    expect(http.callsTo("GET", "/search")[0]?.options.query).toMatchObject({ q: "dinheiro que entrou", mode: "hybrid" });
  });

  it("sem resultado oferece pedido de ajuda ao curador", async () => {
    const http = new FakeHttpClient({ "GET /search": { cache_hit: false, expanded_terms: [], added_terms: [], results: [] }, "POST /help-requests": { id: 1 } });
    const user = userEvent.setup();
    renderApp({ path: "/explorar?q=previsao%20do%20tempo", subject: "joao.consumidor", http });
    await user.click(await screen.findByRole("button", { name: "Pedir ajuda a um curador" }));
    expect(await screen.findByText(/Pedido enviado/)).toBeInTheDocument();
    expect(http.callsTo("POST", "/help-requests")[0]?.options.json).toMatchObject({ question: "previsao do tempo" });
  });

  it("sugere termos enquanto a pessoa digita e busca ao escolher", async () => {
    const http = new FakeHttpClient({
      "GET /catalog/suggest": [{ label: "Faturamento por item", kind: "card", asset_id: 3 }, { label: "faturamento", kind: "synonym", asset_id: 3 }],
      "GET /search": { cache_hit: false, expanded_terms: [], added_terms: [], results: [hit] },
    });
    const user = userEvent.setup();
    renderApp({ path: "/explorar", subject: "joao.consumidor", http });
    await user.type(screen.getByRole("combobox"), "fatu");
    const suggestion = await screen.findByRole("option", { name: /Faturamento por item/ });
    await user.click(suggestion);
    expect(await screen.findByRole("link", { name: "Faturamento por item" })).toBeInTheDocument();
    expect(http.callsTo("GET", "/search")[0]?.options.query).toMatchObject({ q: "Faturamento por item" });
  });
});

describe("Explorar (perguntas)", () => {
  it("resposta com citação e feedback que leva a pedido de ajuda", async () => {
    const http = new FakeHttpClient({
      "GET /catalog/browse": browse,
      "POST /ask": askResponder(() => ({
        status: "ok", answer: "Use a ficha de faturamento [C1].", evidence_status: "partial",
        citations: [{ context_id: "C1", asset_id: 3, fqn: hit.fqn, publication_revision: 1, asset_version: 1, trust_status: "certified" }],
      })),
      "POST /feedback": { ok: true },
      "POST /help-requests": { id: 9 },
    });
    const user = userEvent.setup();
    renderApp({ path: "/explorar?aba=perguntar", subject: "joao.consumidor", http });

    await user.type(await screen.findByLabelText("O que você quer saber sobre os dados?"), "onde está o faturamento por nota?");
    await user.click(screen.getByRole("button", { name: "Perguntar" }));
    expect(await screen.findByRole("link", { name: /C1/ })).toHaveAttribute("href", "/fichas/3");
    await user.click(screen.getByRole("button", { name: /Não era isso/ }));
    expect(http.callsTo("POST", "/feedback")[0]?.options.json).toMatchObject({ helpful: false, question: "onde está o faturamento por nota?" });
    await user.click(await screen.findByRole("button", { name: "Pedir ajuda a um curador" }));
    expect(await screen.findByText(/Pedido enviado/)).toBeInTheDocument();
  });

  it("pergunta vaga oferece opções e, ao escolher, pergunta de novo sem pedir esclarecimento", async () => {
    const http = new FakeHttpClient({
      "GET /catalog/browse": browse,
      "POST /ask": askResponder((question, allow) =>
        allow
          ? { status: "clarify", answer: "Sua pergunta pode se referir a assuntos diferentes. Qual destes você procura?", evidence_status: "none", suggestions: [option(1, "Faturamento atual"), option(2, "Faturamento histórico")] }
          : { status: "ok", answer: `Resposta sobre ${question}`, evidence_status: "partial", citations: [{ context_id: "C1", asset_id: 2, fqn: "lab.vendas.t2", publication_revision: 1, asset_version: 1, trust_status: "not_validated" }] },
      ),
    });
    const user = userEvent.setup();
    renderApp({ path: "/explorar?aba=perguntar", subject: "joao.consumidor", http });

    await user.type(await screen.findByLabelText("O que você quer saber sobre os dados?"), "faturamento");
    await user.click(screen.getByRole("button", { name: "Perguntar" }));
    const chosen = (await screen.findByText("Faturamento histórico")).closest("li") as HTMLElement;
    await user.click(within(chosen).getByRole("button", { name: "É este" }));

    expect(await screen.findByText(/Resposta sobre faturamento — Faturamento histórico/)).toBeInTheDocument();
    const second = http.callsTo("POST", "/ask")[1]?.options.json as { question: string; allow_clarification: boolean };
    expect(second).toEqual(expect.objectContaining({ question: "faturamento — Faturamento histórico", allow_clarification: false }));
  });

  it("pedido de valor indica a ficha e o responsável em vez de só recusar", async () => {
    const http = new FakeHttpClient({
      "GET /catalog/browse": browse,
      "POST /ask": askResponder(() => ({ status: "out_of_scope", answer: "…", evidence_status: "none", intent: "value_request", suggestions: [option(3, "Faturamento por item")] })),
    });
    const user = userEvent.setup();
    renderApp({ path: "/explorar?aba=perguntar", subject: "joao.consumidor", http });

    await user.type(await screen.findByLabelText("O que você quer saber sobre os dados?"), "quanto faturamos ontem?");
    await user.click(screen.getByRole("button", { name: "Perguntar" }));
    expect(await screen.findByText(/Eu não calculo valores nem gero consultas/)).toBeInTheDocument();
    expect(screen.getByText(/responsável: gerencia.comercial/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver ficha →" })).toHaveAttribute("href", "/fichas/3");
  });
});

describe("Explorar (navegar)", () => {
  it("mostra domínios, assuntos e perguntas de exemplo que viram pergunta com um clique", async () => {
    const http = new FakeHttpClient({
      "GET /catalog/browse": browse,
      "POST /ask": askResponder(() => ({ status: "no_evidence", answer: "Não encontrei.", evidence_status: "none" })),
    });
    const user = userEvent.setup();
    const { router } = renderApp({ path: "/explorar?aba=navegar", subject: "joao.consumidor", http });

    expect(await screen.findByRole("link", { name: /Faturamento por item/ })).toHaveAttribute("href", "/fichas/3");
    expect(screen.getByText("O que foi faturado em cada nota.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "onde encontro o faturamento por nota?" }));
    expect(router.state.location.search).toContain("aba=perguntar");
    expect(await screen.findByText(/Não encontrei uma ficha que responda a isso/)).toBeInTheDocument();
    expect((http.callsTo("POST", "/ask")[0]?.options.json as { question: string }).question).toBe("onde encontro o faturamento por nota?");
  });

  it("consumidor não vê itens de curadoria nem administração na navegação", async () => {
    renderApp({ path: "/explorar", subject: "joao.consumidor", http: new FakeHttpClient() });
    expect(await screen.findByRole("link", { name: /Explorar e perguntar/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Demandas dos usuários/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Fontes e sincronização/ })).not.toBeInTheDocument();
  });
});
