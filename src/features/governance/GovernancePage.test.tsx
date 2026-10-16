import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { GovernanceAsset, GovernanceDashboard } from "@/api/types";
import { ApiError } from "@/core/http/apiError";
import { FakeHttpClient } from "@/test/fakeHttpClient";
import { renderApp } from "@/test/renderApp";

const levels = { well: 1, partial: 1, poor: 0, uncataloged: 2 };

function asset(overrides: Partial<GovernanceAsset>): GovernanceAsset {
  return {
    asset_id: 1, fqn: "lab_dw.vendas.ft_faturamento", name: "Faturamento por item", domain: "financeiro", source_id: "lab-dw", published: true,
    trust_status: "not_validated", score: 90, level: "well", gaps: ["trust"], demand: 12, card_views: 9, citations: 3, search_hits: 20, ...overrides,
  };
}

const faturamento = asset({});
const metas = asset({ asset_id: 2, fqn: "lab_dw.vendas.metas", name: "Metas comerciais", score: 55, level: "partial", gaps: ["columns", "trust", "current"],
  demand: 7, card_views: 7, citations: 0, search_hits: 4 });
const semFicha = asset({ asset_id: 3, fqn: "lab_dw.vendas.dim_regiao", name: "dim_regiao", published: false, trust_status: null, score: 0,
  level: "uncataloged", gaps: ["published"], demand: 0, card_views: 0, citations: 0, search_hits: 0 });

function dashboard(days: number, overrides: Partial<GovernanceDashboard> = {}): GovernanceDashboard {
  return {
    period: { days, since: "2026-10-10", until: "2026-10-16" },
    scope: { all_domains: true, domains: [] },
    summary: {
      assets: 4, assets_missing: 1, published: 2, published_pct: 50, certified: 0, certified_pct: 0, avg_score: 36.3, avg_score_published: 72.5,
      open_pendencies: 3, searches: 40, questions: 10, card_views: 16, unanswered: 5, unanswered_pct: 10, assets_with_demand: 2,
      published_without_demand: 0,
    },
    timeline: [
      { day: "2026-10-15", searches: 18, questions: 4, card_views: 7, unanswered: 2 },
      { day: "2026-10-16", searches: 22, questions: 6, card_views: 9, unanswered: 3 },
    ],
    quality_distribution: levels,
    most_demanded: [faturamento, metas],
    least_demanded: [metas, faturamento],
    best_cataloged: [faturamento, metas],
    poorly_cataloged: [semFicha, metas],
    curation_priorities: [{ ...metas, priority: 3.2 }],
    gaps: [{ key: "published", label: "Ficha publicada", assets: 2 }, { key: "trust", label: "Confiança certificada", assets: 2 }],
    by_source: [{ key: "lab-dw", label: "Data warehouse do laboratório", assets: 4, published: 2, published_pct: 50, certified: 0, avg_score: 36.3, levels, demand: 19, search_hits: 24 }],
    by_domain: [{ key: "financeiro", label: "financeiro", assets: 4, published: 2, published_pct: 50, certified: 0, avg_score: 36.3, levels, demand: 19, search_hits: 24 }],
    methodology: {
      criteria: [
        { key: "published", label: "Ficha publicada", weight: 30 },
        { key: "description", label: "Descrição de negócio sustentada por evidência", weight: 15 },
        { key: "owner", label: "Responsável de negócio definido", weight: 15 },
        { key: "columns", label: "Colunas com significado documentado", weight: 20 },
        { key: "trust", label: "Confiança certificada", weight: 10 },
        { key: "current", label: "Ficha atualizada com a versão do ativo", weight: 10 },
      ],
      thresholds: { well: 80, partial: 50 },
      demand: "fichas abertas + citações em respostas",
      privacy: "contagens diárias agregadas, sem identificar quem consultou",
      retention_days: 400,
      timezone: "America/Sao_Paulo",
    },
    ...overrides,
  };
}

function governanceHttp(overrides: Partial<GovernanceDashboard> = {}) {
  return new FakeHttpClient({
    "GET /governance/dashboard": (call: { options: { query?: Record<string, unknown> } }) => dashboard(Number(call.options.query?.days), overrides),
  });
}

describe("Painel de governança", () => {
  it("mostra saúde do catálogo, uso e prioridades; troca o período e o agrupamento", async () => {
    const http = governanceHttp();
    const user = userEvent.setup();
    renderApp({ path: "/governanca", subject: "ana.admin", http });

    expect(await screen.findByText("Saúde do catálogo")).toBeInTheDocument();
    expect(http.callsTo("GET", "/governance/dashboard")[0]?.options.query).toEqual({ days: 30 });
    expect(screen.getByText("Todos os domínios", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("66")).toBeInTheDocument(); // interações = 40 + 10 + 16
    expect(screen.getByText("1 ausentes na origem")).toBeInTheDocument();

    const priorities = screen.getByRole("heading", { name: "Prioridades de curadoria" }).closest("section") as HTMLElement;
    const row = within(priorities).getByText("Metas comerciais").closest("tr") as HTMLElement;
    expect(within(row).getByText("Colunas com significado documentado")).toBeInTheDocument();
    expect(within(row).getByRole("meter")).toHaveAttribute("aria-valuenow", "55");
    // Administrador não lê metadados de domínio: nome sem link para a página do ativo.
    expect(within(row).queryByRole("link")).not.toBeInTheDocument();

    const legend = screen.getByRole("list", { name: "Legenda" });
    expect(within(legend).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Buscas", "Perguntas", "Fichas abertas", "Sem resposta"]);
    await user.click(screen.getByText("Ver dados em tabela"));
    expect(screen.getByRole("row", { name: /16\/10\/2026 22 6 9 3/ })).toBeInTheDocument();

    const distribution = screen.getByRole("heading", { name: "Situação da catalogação" }).closest("section") as HTMLElement;
    expect(within(distribution).getByRole("img", { name: "Bem catalogado: 1; Parcial: 1; Pouco catalogado: 0; Sem ficha: 2" })).toBeInTheDocument();
    expect(screen.getByText("Data warehouse do laboratório")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Domínios" }));
    expect(screen.getByRole("rowheader", { name: "financeiro" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "7 dias" }));
    expect(http.callsTo("GET", "/governance/dashboard").map((call) => call.options.query)).toEqual([{ days: 30 }, { days: 7 }]);
  });

  it("curador vê o recorte dos seus domínios e acessa o ativo", async () => {
    renderApp({ path: "/governanca", subject: "carlos.curador", http: governanceHttp({ scope: { all_domains: false, domains: ["financeiro"] } }) });
    expect(await screen.findByText("Domínios: financeiro", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/fichas abertas, só dos seus domínios/)).toBeInTheDocument();
    const mostDemanded = screen.getByRole("heading", { name: "Mais procuradas" }).closest("section") as HTMLElement;
    expect(within(mostDemanded).getByRole("link", { name: "Faturamento por item" })).toHaveAttribute("href", "/ativos/1");
  });

  it("sem interações, explica de onde vêm os números em vez de um gráfico vazio", async () => {
    const quiet = dashboard(30).summary;
    renderApp({
      path: "/governanca",
      subject: "ana.admin",
      http: governanceHttp({
        summary: { ...quiet, searches: 0, questions: 0, card_views: 0, unanswered: 0 },
        timeline: [{ day: "2026-10-16", searches: 0, questions: 0, card_views: 0, unanswered: 0 }],
      }),
    });
    expect(await screen.findByText("Sem interações no período")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Legenda" })).not.toBeInTheDocument();
  });

  it("consumidor recebe a negativa do backend", async () => {
    renderApp({
      path: "/governanca",
      subject: "joao.consumidor",
      http: new FakeHttpClient({ "GET /governance/dashboard": new ApiError(403, "forbidden", "painel de governança restrito") }),
    });
    expect(await screen.findByText("Você não tem permissão para esta ação.")).toBeInTheDocument();
  });
});
