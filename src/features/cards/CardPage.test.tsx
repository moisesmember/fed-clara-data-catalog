import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FakeHttpClient } from "@/test/fakeHttpClient";
import { card } from "@/test/fixtures";
import { renderApp } from "@/test/renderApp";

describe("Ficha publicada", () => {
  it("consumidor vê conteúdo e aviso de não certificação, sem ações de governança", async () => {
    renderApp({ path: "/fichas/3", subject: "joao.consumidor", http: new FakeHttpClient({ "GET /cards/3": card }) });
    expect(await screen.findByRole("heading", { name: "Faturamento por item" })).toBeInTheDocument();
    expect(screen.getByText(/Ficha não certificada/)).toBeInTheDocument();
    expect(screen.getByText("Significado não documentado")).toBeInTheDocument();
    expect(screen.queryByText("Governança da ficha")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ver metadados técnicos/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar ficha" })).not.toBeInTheDocument();
  });

  it("curador abre a edição da ficha e vai para a revisão", async () => {
    const http = new FakeHttpClient({ "GET /cards/3": card, "POST /cards/3/edit": { task_id: 7, job_id: 91, existing: false } });
    const user = userEvent.setup();
    const { router } = renderApp({ path: "/fichas/3", subject: "carlos.curador", http });

    await user.click(await screen.findByRole("button", { name: "Editar ficha" }));
    expect(http.callsTo("POST", "/cards/3/edit")).toHaveLength(1);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/curadoria/7"));
  });

  it("aprovadora do domínio revoga visibilidade e a ficha é recarregada", async () => {
    const http = new FakeHttpClient({ "GET /cards/3": card, "POST /cards/3/visibility": { lock_version: 3 } });
    const user = userEvent.setup();
    renderApp({ path: "/fichas/3", subject: "bia.aprovadora", http });

    await user.selectOptions(await screen.findByLabelText("Visibilidade"), "restricted");
    await user.click(screen.getByRole("button", { name: "Aplicar visibilidade" }));
    expect(await screen.findByText(/Visibilidade atualizada/)).toBeInTheDocument();
    expect(http.callsTo("POST", "/cards/3/visibility")[0]?.options.json).toMatchObject({ visibility: "restricted" });
    expect(http.callsTo("GET", "/cards/3").length).toBe(2);
  });

  it("ficha inexistente ou sem permissão mostra mensagem neutra", async () => {
    const { ApiError } = await import("@/core/http/apiError");
    renderApp({ path: "/fichas/99", subject: "joao.consumidor", http: new FakeHttpClient({ "GET /cards/99": () => new ApiError(404, "not_found", "ficha") }) });
    expect(await screen.findByText("Não encontrado ou sem permissão de acesso.")).toBeInTheDocument();
  });
});
