import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FakeHttpClient } from "@/test/fakeHttpClient";
import { renderApp } from "@/test/renderApp";

describe("Entrada e sessão", () => {
  it("sem sessão, redireciona para /entrar e volta ao destino após entrar", async () => {
    const http = new FakeHttpClient({ "GET /me": { subject: "carlos.curador", bindings: [["curator", "financeiro", "*"]] }, "GET /curation/tasks": [] });
    const user = userEvent.setup();
    const { router, identity } = renderApp({ path: "/curadoria", http });

    await user.click(await screen.findByRole("button", { name: /carlos\.curador/ }));
    expect(router.state.location.pathname).toBe("/curadoria");
    expect(identity.authHeaders()).toEqual({ "X-Clara-User": "carlos.curador" });
    expect(await screen.findByRole("heading", { name: "Fila de curadoria" })).toBeInTheDocument();
  });

  it("valida identificador digitado", async () => {
    const user = userEvent.setup();
    renderApp({ path: "/entrar", http: new FakeHttpClient() });
    await user.type(screen.getByLabelText("Outro identificador"), "nome com espaço");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Identificador inválido/);
  });

  it("trocar usuário limpa a sessão", async () => {
    const user = userEvent.setup();
    const { router, identity } = renderApp({ path: "/explorar", subject: "joao.consumidor", http: new FakeHttpClient() });
    await user.click(await screen.findByRole("button", { name: "Trocar usuário" }));
    expect(identity.current()).toBeNull();
    expect(router.state.location.pathname).toBe("/entrar");
  });
});
