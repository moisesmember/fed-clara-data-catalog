import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FakeHttpClient } from "@/test/fakeHttpClient";
import { renderApp } from "@/test/renderApp";

describe("Demandas dos usuários (curadoria)", () => {
  it("transforma uma pergunta sem resposta em termo do glossário", async () => {
    const http = new FakeHttpClient({
      "GET /insights/unanswered": [{ query: "dinheiro que entrou", occurrences: 4, last_seen: "2026-10-12T03:00:00Z", kinds: ["search_no_results", "feedback_not_helpful"] }],
      "POST /glossary": { id: 11 },
    });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/demandas", subject: "carlos.curador", http });

    const row = (await screen.findByText("“dinheiro que entrou”")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Busca sem resultado")).toBeInTheDocument();
    expect(within(row).getByText("Não ajudou")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Ensinar ao glossário" }));
    expect(screen.getByLabelText("Quando alguém disser…")).toHaveValue("dinheiro que entrou");
    await user.type(screen.getByLabelText("…buscar também por"), "faturamento, receita");
    await user.click(screen.getByRole("button", { name: "Salvar no glossário" }));

    expect(await screen.findByText(/agora também busca por faturamento, receita/)).toBeInTheDocument();
    expect(http.callsTo("POST", "/glossary")[0]?.options.json).toEqual({ domain: "financeiro", term: "dinheiro que entrou", expansions: ["faturamento", "receita"] });
  });

  it("resolve pedido de ajuda com uma resposta", async () => {
    const http = new FakeHttpClient({
      "GET /insights/unanswered": [],
      "GET /help-requests": [
        { id: 5, created_at: "2026-10-12T03:00:00Z", requester: "joao.consumidor", question: "vendas por loja", asset_id: 3, domains: ["financeiro"], status: "open", resolution_note: null, resolved_by: null },
      ],
      "POST /help-requests/5/resolve": { ok: true },
    });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/demandas?aba=ajuda", subject: "carlos.curador", http });

    expect(await screen.findByText("“vendas por loja”")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Resposta ao usuário"), "Use a ficha de faturamento.");
    await user.click(screen.getByRole("button", { name: "Marcar como resolvido" }));
    expect(await screen.findByText("Pedido resolvido.")).toBeInTheDocument();
    expect(http.callsTo("POST", "/help-requests/5/resolve")[0]?.options.json).toEqual({ note: "Use a ficha de faturamento." });
  });

  it("glossário só permite remover o que o curador pode gerenciar", async () => {
    const http = new FakeHttpClient({
      "GET /glossary": [
        { id: 1, domain: "financeiro", term: "grana", expansions: ["faturamento"], created_by: "carlos.curador", updated_at: "", can_manage: true },
        { id: 2, domain: "*", term: "vendas", expansions: ["faturamento"], created_by: "ana", updated_at: "", can_manage: false },
      ],
      "DELETE /glossary/1": { ok: true },
    });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/demandas?aba=glossario", subject: "carlos.curador", http });

    expect(await screen.findByText("“grana”")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover vendas" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remover grana" }));
    expect(await screen.findByText("“grana” removido.")).toBeInTheDocument();
    expect(http.callsTo("DELETE", "/glossary/1")).toHaveLength(1);
  });
});
