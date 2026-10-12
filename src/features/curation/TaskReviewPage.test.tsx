import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ReviewSubmission } from "@/api/types";
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

describe("Revisão de curadoria", () => {
  it("curador não vê aprovar/rejeitar; edição envia nova revisão com a versão exibida", async () => {
    const http = curationHttp({ "POST /curation/tasks/7/review": { job_id: 90, decision_id: "d1" } });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "carlos.curador", http });

    expect(await screen.findByRole("radio", { name: /Editar e revalidar/ })).toBeChecked();
    expect(screen.queryByRole("radio", { name: /Aprovar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Rejeitar/ })).not.toBeInTheDocument();

    const granularity = screen.getByLabelText("Granularidade");
    await user.clear(granularity);
    await user.type(granularity, "Uma linha por item de nota fiscal");
    await user.click(screen.getByRole("button", { name: "Editar e revalidar" }));

    const sent = http.callsTo("POST", "/curation/tasks/7/review")[0]?.options.json as ReviewSubmission;
    expect(sent).toMatchObject({ decision: "request_changes", expected_draft_revision: 2, expected_asset_version_id: 11 });
    expect(sent.edits?.granularity).toEqual({ text: "Uma linha por item de nota fiscal", status: "supported", evidence_refs: [] });
    expect(await screen.findByText("Ficha publicada.")).toBeInTheDocument(); // resultado do job acompanhado
  });

  it("aprovadora precisa confirmar o responsável; envia visibilidade e sem edições", async () => {
    const http = curationHttp({ "POST /curation/tasks/7/review": { job_id: 90, decision_id: "d2" } });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "bia.aprovadora", http });

    expect(await screen.findByRole("radio", { name: /Aprovar/ })).toBeChecked();
    const submit = screen.getByRole("button", { name: "Aprovar" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("Informe o responsável de negócio.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Responsável confirmado"), "gerencia.comercial");
    await user.selectOptions(screen.getByLabelText("Visibilidade"), "restricted");
    await user.click(submit);

    const sent = http.callsTo("POST", "/curation/tasks/7/review")[0]?.options.json as ReviewSubmission;
    expect(sent).toMatchObject({ decision: "approve", confirmed_owner: "gerencia.comercial", visibility: "restricted", publish: true });
    expect(sent.edits).toBeUndefined();
  });

  it("conflito de concorrência (409) explica e recarrega a tarefa", async () => {
    const http = curationHttp({ "POST /curation/tasks/7/review": () => new ApiError(409, "conflict", "rascunho ou versão técnica mudou desde a leitura") });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria/7", subject: "bia.aprovadora", http });

    await user.type(await screen.findByLabelText("Responsável confirmado"), "dono");
    await user.click(screen.getByRole("button", { name: "Aprovar" }));
    expect(await screen.findByText(/O conteúdo mudou desde que você o abriu/)).toBeInTheDocument();
    expect(http.callsTo("GET", "/curation/tasks/7").length).toBeGreaterThan(1);
  });

  it("mostra evidência como conteúdo não confiável e referência resolvida", async () => {
    renderApp({ path: "/curadoria/7", subject: "carlos.curador", http: curationHttp() });
    expect(await screen.findByText(/tratado como não confiável/)).toBeInTheDocument();
    expect(screen.getByText("E1")).toHaveAttribute("title", expect.stringContaining("Faturamento diário por nota fiscal emitida."));
  });
});
