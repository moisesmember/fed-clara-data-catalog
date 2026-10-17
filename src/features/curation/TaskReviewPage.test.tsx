import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ReviewSubmission, TaskDetail } from "@/api/types";
import { ApiError } from "@/core/http/apiError";
import { FakeHttpClient } from "@/test/fakeHttpClient";
import { assetDetail, task } from "@/test/fixtures";
import { renderApp } from "@/test/renderApp";

function curationHttp(overrides: Record<string, unknown> = {}) {
  return new FakeHttpClient({
    "GET /curation/tasks/7": task,
    "GET /assets/3": assetDetail,
    "GET /jobs/90": { id: 90, kind: "curation.resume", status: "succeeded", attempts: 1, max_attempts: 2, last_error: null, result: { outcome: "published", blockers: [] }, created_at: "", started_at: "", finished_at: "", cancel_requested: false },
    ...overrides,
  });
}

const sentReview = (http: FakeHttpClient) => http.callsTo("POST", "/curation/tasks/7/review")[0]?.options.json as ReviewSubmission;

describe("Revisão de curadoria", () => {
  it("edição de ficha sugere mudança editorial, que preserva o selo", async () => {
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "bia.aprovadora", http: curationHttp({ "GET /curation/tasks/7": { ...task, kind: "editorial_edit" } }) });
    expect(await screen.findByText("Edição de ficha")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aprovar…" }));
    expect(screen.getByLabelText("Tipo de mudança")).toHaveValue("editorial");
  });

  it("evidências mostram o tipo em português e marcam o comentário de schema substituído", async () => {
    const evidences = [
      ...task.evidences,
      { id: 32, kind: "schema_comment", ref: "lab_dw.vendas#schema@aaaaaaaaaaaa", text: "Vendas do varejo", untrusted: true },
      { id: 33, kind: "catalog_comment", ref: "lab_dw#catalog@bbbbbbbbbbbb", text: "Data warehouse do laboratório", untrusted: true },
      { id: 40, kind: "schema_comment", ref: "lab_dw.vendas#schema@cccccccccccc", text: "Vendas do varejo e do e-commerce", untrusted: true },
    ];
    renderApp({ path: "/curadoria/7", subject: "carlos.curador", http: curationHttp({ "GET /curation/tasks/7": { ...task, evidences } }) });

    expect(await screen.findByText("Comentário da tabela")).toBeInTheDocument();
    expect(screen.getByText("Comentário do catálogo")).toBeInTheDocument();
    expect(screen.getAllByText("Comentário do schema")).toHaveLength(2);
    const superseded = screen.getByText("Substituído").closest("li") as HTMLElement;
    expect(superseded).toHaveTextContent("Vendas do varejo");
    expect(superseded).not.toHaveTextContent("e-commerce");
  });

  it("perguntas do Genie viram sugestões das perguntas de exemplo, só da versão mais recente do espaço", async () => {
    const evidences = [
      ...task.evidences,
      { id: 50, kind: "genie_questions", ref: "genie:sp1#questions@aaaaaaaaaaaa", text: "Pergunta antiga do Genie?", untrusted: true },
      { id: 51, kind: "genie_instructions", ref: "genie:sp1#instructions@bbbbbbbbbbbb", text: "Instruções do espaço Genie “Vendas”:\nUse a data de emissão.", untrusted: true },
      { id: 52, kind: "genie_questions", ref: "genie:sp1#questions@cccccccccccc", text: "Quanto vendemos por loja?\nQual o ticket médio?", untrusted: true },
    ];
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "carlos.curador", http: curationHttp({ "GET /curation/tasks/7": { ...task, evidences } }) });

    const suggestions = await screen.findByRole("region", { name: "Perguntas sugeridas pelo Genie" });
    expect(within(suggestions).queryByText("Pergunta antiga do Genie?")).not.toBeInTheDocument();
    await user.click(within(suggestions).getByRole("button", { name: "Usar a pergunta: Quanto vendemos por loja?" }));
    expect((screen.getByLabelText("Perguntas que esta ficha responde") as HTMLTextAreaElement).value).toMatch(/\nQuanto vendemos por loja\?$/);
    // A pergunta usada sai da lista; o rótulo da evidência aparece em português.
    expect(within(suggestions).queryByRole("button", { name: "Usar a pergunta: Quanto vendemos por loja?" })).not.toBeInTheDocument();
    expect(within(suggestions).getByRole("button", { name: "Usar a pergunta: Qual o ticket médio?" })).toBeInTheDocument();
    expect(screen.getAllByText("Perguntas do Genie")).toHaveLength(2);
    expect(screen.getByText("Instruções do Genie")).toBeInTheDocument();
  });

  it("significado sugerido pelo Genie aparece marcado como sugestão de IA, com a resposta à vista", async () => {
    const genie = { id: 60, kind: "genie_answer", ref: "genie:sp1#answer:columns@dddddddddddd", untrusted: true,
      text: "Pergunta da Clara ao Genie: …\nResposta do Genie: vl_liq: valor líquido do item após descontos" };
    const draft = {
      ...task.draft!,
      evidence_map: { ...task.draft!.evidence_map, E2: 60 },
      content: { ...task.draft!.content, column_notes: [{ column: "vl_liq", meaning: { text: "valor líquido do item após descontos", status: "suggested" as const, evidence_refs: ["E2"] } }] },
    };
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "carlos.curador", http: curationHttp({ "GET /curation/tasks/7": { ...task, draft, evidences: [...task.evidences, genie] } }) });

    const row = (await screen.findByText("valor líquido do item após descontos")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Sugerido pelo Genie")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Evidência E2" }));
    expect(within(row).getByText(/Resposta do Genie · inferência de IA a partir dos dados, a confirmar/)).toBeInTheDocument();
    // Descrição sustentada pela origem não ganha o selo.
    expect(screen.getAllByText("Sugerido pelo Genie")).toHaveLength(1);
  });

  it("curador não vê aprovar/rejeitar; salvar só com edição, enviando nova revisão com a versão exibida", async () => {
    const http = curationHttp({ "POST /curation/tasks/7/review": { job_id: 90, decision_id: "d1" } });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "carlos.curador", http });

    const save = await screen.findByRole("button", { name: "Salvar edições e revalidar" });
    expect(save).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Aprovar…" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rejeitar" })).not.toBeInTheDocument();

    const granularity = screen.getByLabelText("Cada linha representa");
    await user.clear(granularity);
    await user.type(granularity, "Uma linha por item de nota fiscal");
    expect(screen.getByText("Alterado por você")).toBeInTheDocument();
    await user.click(save);

    const sent = sentReview(http);
    expect(sent).toMatchObject({ decision: "request_changes", expected_draft_revision: 2, expected_asset_version_id: 11 });
    expect(sent.edits?.granularity).toEqual({ text: "Uma linha por item de nota fiscal", status: "supported", evidence_refs: [] });
    expect(await screen.findByText("Ficha publicada.")).toBeInTheDocument(); // resultado do job acompanhado
  });

  it("o conteúdo aparece uma vez só: o campo editável é a própria ficha", async () => {
    renderApp({ path: "/curadoria/7", subject: "carlos.curador", http: curationHttp() });
    expect(await screen.findByLabelText("Nome de negócio")).toHaveValue("Faturamento por item");
    expect(screen.getAllByText("Faturamento por item")).toHaveLength(1); // só o título da página
  });

  it("aprovadora precisa confirmar o responsável; envia visibilidade e sem edições", async () => {
    const http = curationHttp({ "POST /curation/tasks/7/review": { job_id: 90, decision_id: "d2" } });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "bia.aprovadora", http });

    await user.click(await screen.findByRole("button", { name: "Aprovar…" }));
    const submit = screen.getByRole("button", { name: "Aprovar e publicar" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("Informe o responsável de negócio.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Responsável confirmado"), "gerencia.comercial");
    await user.selectOptions(screen.getByLabelText("Visibilidade"), "restricted");
    await user.click(submit);

    const sent = sentReview(http);
    expect(sent).toMatchObject({ decision: "approve", confirmed_owner: "gerencia.comercial", visibility: "restricted", publish: true });
    expect(sent.edits).toBeUndefined();
  });

  it("aprovar sem publicar dispensa o responsável", async () => {
    const http = curationHttp({ "POST /curation/tasks/7/review": { job_id: 90, decision_id: "d3" } });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "bia.aprovadora", http });

    await user.click(await screen.findByRole("button", { name: "Aprovar…" }));
    await user.click(screen.getByRole("button", { name: "Aprovar sem publicar" }));
    expect(sentReview(http)).toMatchObject({ decision: "approve", publish: false });
  });

  it("declarar que não há limitações só é possível com o campo de limitações vazio", async () => {
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "bia.aprovadora", http: curationHttp() });

    await user.click(await screen.findByRole("button", { name: "Aprovar…" }));
    expect(screen.queryByLabelText(/Não há limitações conhecidas/)).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Limitações"));
    expect(screen.getByLabelText(/Não há limitações conhecidas/)).toBeInTheDocument();
  });

  it("rejeitar pede confirmação antes de enviar", async () => {
    const http = curationHttp({ "POST /curation/tasks/7/review": { job_id: 90, decision_id: "d4" } });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "bia.aprovadora", http });

    await user.click(await screen.findByRole("button", { name: "Rejeitar" }));
    expect(http.callsTo("POST", "/curation/tasks/7/review")).toHaveLength(0);
    await user.type(screen.getByLabelText("Notas"), "Tabela descontinuada");
    await user.click(screen.getByRole("button", { name: "Confirmar rejeição" }));
    expect(sentReview(http)).toMatchObject({ decision: "reject", notes: "Tabela descontinuada" });
  });

  it("junta bloqueio, pendências e validação num só quadro, bloqueios primeiro", async () => {
    const blocked: TaskDetail = {
      ...task,
      status: "publication_blocked",
      last_error: "Falta o responsável de negócio.",
      open_pendencies: [{ id: 1, code: "stale", message: "Origem mudou desde o rascunho.", blocking: false }],
      draft: task.draft && { ...task.draft, issues: [{ code: "granularity", severity: "blocking", message: "Granularidade sem evidência.", path: "granularity" }] },
    };
    renderApp({ path: "/curadoria/7", subject: "carlos.curador", http: curationHttp({ "GET /curation/tasks/7": blocked }) });

    const panel = (await screen.findByRole("heading", { name: "O que falta para publicar" })).closest("section") as HTMLElement;
    expect(within(panel).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Bloqueia publicaçãoFalta o responsável de negócio.",
      "Bloqueia publicaçãoGranularidade sem evidência.",
      "AtençãoOrigem mudou desde o rascunho.",
    ]);
    expect(within(panel).getByText("2 bloqueios")).toBeInTheDocument();
  });

  it("detalhes técnicos da tarefa começam recolhidos", async () => {
    renderApp({ path: "/curadoria/7", subject: "carlos.curador", http: curationHttp() });
    const details = (await screen.findByText("Detalhes da tarefa")).closest("details") as HTMLElement;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("fake-deterministic-v1 · prompt curation-v1")).toBeInTheDocument();
  });

  it("conflito de concorrência (409) explica e recarrega a tarefa", async () => {
    const http = curationHttp({ "POST /curation/tasks/7/review": () => new ApiError(409, "conflict", "rascunho ou versão técnica mudou desde a leitura") });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "bia.aprovadora", http });

    await user.click(await screen.findByRole("button", { name: "Aprovar…" }));
    await user.type(screen.getByLabelText("Responsável confirmado"), "dono");
    await user.click(screen.getByRole("button", { name: "Aprovar e publicar" }));
    expect(await screen.findByText(/O conteúdo mudou desde que você o abriu/)).toBeInTheDocument();
    expect(http.callsTo("GET", "/curation/tasks/7").length).toBeGreaterThan(1);
  });

  it("a referência de evidência abre o trecho da origem junto da afirmação", async () => {
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "carlos.curador", http: curationHttp() });
    expect(await screen.findByText(/tratado como não confiável/)).toBeInTheDocument();

    const ref = screen.getByRole("button", { name: "Evidência E1" });
    expect(ref).toHaveAttribute("aria-expanded", "false");
    await user.click(ref);
    expect(ref).toHaveAttribute("aria-expanded", "true");
    const quote = ref.closest(".claim")?.querySelector("blockquote");
    expect(quote).toHaveTextContent("Comentário da tabela · conteúdo da origem, não confiável");
    expect(quote).toHaveTextContent("Faturamento diário por nota fiscal emitida.");
  });
});
