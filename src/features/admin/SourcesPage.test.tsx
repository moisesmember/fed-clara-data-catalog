import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ScopesOverview, SourceSummary } from "@/api/types";
import { ApiError } from "@/core/http/apiError";
import { FakeHttpClient } from "@/test/fakeHttpClient";
import { renderApp } from "@/test/renderApp";

const SOURCE: SourceSummary = {
  id: "dbx-free-lab",
  name: "Databricks Free Edition",
  environment: "lab",
  kind: "databricks_sql",
  host: "dbc.cloud.databricks.com",
  auth_method: "pat",
  scopes: [
    { catalog: "workspace", schema: "credit_risk", domain: "financeiro" },
    { catalog: "workspace", schema: "health", domain: "saude" },
  ],
  schedule_time: null,
  schedule_tz: "America/Sao_Paulo",
  owner: "voce@exemplo.local",
  status: "active",
  metastore_id: null,
  last_capability_check: null,
};

const OVERVIEW: ScopesOverview = {
  source_id: "dbx-free-lab",
  discovered_at: "2026-10-12T12:00:00Z",
  discovery_truncated: false,
  discovery_errors: [{ catalog: "sem_acesso", error: "ServerOperationError" }],
  scopes: [
    { scope: "workspace.credit_risk", catalog: "workspace", schema: "credit_risk", tables: 4, configured: true, domain: "financeiro", visible: true },
    { scope: "workspace.health", catalog: "workspace", schema: "health", tables: null, configured: true, domain: "saude", visible: false },
    { scope: "workspace.marketing", catalog: "workspace", schema: "marketing", tables: 9, configured: false, domain: null, visible: true },
  ],
};

function sourcesHttp(extra: Record<string, unknown> = {}) {
  return new FakeHttpClient({
    "GET /sources": [SOURCE],
    "GET /sources/dbx-free-lab/sync-runs": [],
    "GET /sources/dbx-free-lab/scopes": OVERVIEW,
    ...extra,
  });
}

async function openScopes(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText("Gerenciar escopos (descobrir, incluir, remover)"));
  return (await screen.findByText("workspace.marketing")).closest("table") as HTMLElement;
}

describe("Fontes: escopos sem mexer no código", () => {
  it("descobre na origem e inclui um schema candidato com o domínio escolhido", async () => {
    const http = sourcesHttp({
      "POST /sources/dbx-free-lab/discover": { job_id: 7 },
      "GET /jobs/7": { id: 7, kind: "source.discover", status: "running", attempts: 1, max_attempts: 1, last_error: null, result: null,
        created_at: "", started_at: null, finished_at: null, cancel_requested: false },
      "POST /sources/dbx-free-lab/scopes": { scope: "workspace.marketing", domain: "marketing", sync_job_id: null, note: null },
    });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });
    const table = await openScopes(user);

    expect(within(table).getAllByText("Configurado")).toHaveLength(1);
    expect(within(table).getByText("Não visível")).toBeInTheDocument();
    expect(screen.getByText(/Sem acesso a: sem_acesso/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Catálogos a descobrir"), "workspace");
    await user.click(screen.getByRole("button", { name: "Descobrir na origem" }));
    expect(http.callsTo("POST", "/sources/dbx-free-lab/discover")[0]?.options.json).toEqual({ catalogs: ["workspace"] });

    const row = within(table).getByText("workspace.marketing").closest("tr") as HTMLElement;
    expect(within(row).getByText("Disponível")).toBeInTheDocument();
    await user.type(within(row).getByLabelText("Domínio de workspace.marketing"), "marketing");
    await user.click(within(row).getByRole("button", { name: "Incluir" }));

    expect(await screen.findByText("Escopo workspace.marketing incluído no domínio marketing.")).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources/dbx-free-lab/scopes")[0]?.options.json).toEqual({
      catalog: "workspace", schema: "marketing", domain: "marketing", sync: false,
    });
  });

  it("remoção pede confirmação e a troca de domínio mostra a recusa do backend", async () => {
    const http = sourcesHttp({
      "DELETE /sources/dbx-free-lab/scopes/workspace.health": { scope: "workspace.health", assets_kept: 3 },
      "PATCH /sources/dbx-free-lab/scopes/workspace.credit_risk": () =>
        new ApiError(409, "conflict", "escopo já tem ativos importados: o domínio deles não muda com a configuração"),
    });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });
    const table = await openScopes(user);

    await user.click(within(table).getByRole("button", { name: "Remover workspace.health" }));
    expect(http.callsTo("DELETE", "/sources/dbx-free-lab/scopes/workspace.health")).toHaveLength(0);
    await user.click(within(table).getByRole("button", { name: "Confirmar remoção" }));
    expect(await screen.findByText(/Escopo workspace.health removido. 3 ativo\(s\) já importado\(s\) continuam no catálogo./)).toBeInTheDocument();

    const row = within(table).getByText("workspace.credit_risk").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Alterar domínio" }));
    const input = within(row).getByLabelText("Domínio de workspace.credit_risk");
    await user.clear(input);
    await user.type(input, "comercial");
    await user.click(within(row).getByRole("button", { name: "Salvar domínio" }));
    expect(await screen.findByText(/o domínio deles não muda com a configuração/)).toBeInTheDocument();
    expect(http.callsTo("PATCH", "/sources/dbx-free-lab/scopes/workspace.credit_risk")[0]?.options.json).toEqual({ domain: "comercial" });
  });

  it("inclui escopo digitado e já pede a sincronização", async () => {
    const http = sourcesHttp({
      "POST /sources/dbx-free-lab/scopes": { scope: "usecase_factory.factory", domain: "producao", sync_job_id: null, note: "fonte paused: sincronização não enfileirada" },
    });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });
    await openScopes(user);

    await user.click(screen.getByLabelText("Sincronizar ao incluir (fonte ativa)"));
    const form = screen.getByRole("form", { name: "Adicionar escopo manualmente" });
    await user.type(within(form).getByLabelText("Catálogo"), "usecase_factory");
    await user.type(within(form).getByLabelText("Schema"), "factory");
    await user.type(within(form).getByLabelText("Domínio"), "producao");
    await user.click(within(form).getByRole("button", { name: "Adicionar escopo" }));

    expect(await screen.findByText(/fonte paused: sincronização não enfileirada/)).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources/dbx-free-lab/scopes")[0]?.options.json).toEqual({
      catalog: "usecase_factory", schema: "factory", domain: "producao", sync: true,
    });
  });
});

describe("Fontes: cadastro pela tela", () => {
  it("valida antes de enviar e cadastra Databricks com o primeiro escopo", async () => {
    const http = sourcesHttp({ "POST /sources": { id: "dbx-vendas" } });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });

    await user.click(await screen.findByRole("button", { name: "Nova fonte" }));
    const form = screen.getByRole("form", { name: "Cadastrar fonte" });
    await user.type(within(form).getByLabelText("Identificador"), "dbx-free-lab");
    await user.click(within(form).getByRole("button", { name: "Cadastrar fonte" }));
    expect(within(form).getByText(/Já existe uma fonte com este identificador/)).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources")).toHaveLength(0);

    await user.clear(within(form).getByLabelText("Identificador"));
    await user.type(within(form).getByLabelText("Identificador"), "dbx-vendas");
    await user.type(within(form).getByLabelText("Nome"), "Databricks Vendas");
    await user.selectOptions(within(form).getByLabelText("Ambiente"), "prod");
    await user.type(within(form).getByLabelText("Host"), "adb-1.azuredatabricks.net");
    await user.type(within(form).getByLabelText("HTTP path"), "/sql/1.0/warehouses/abc");
    await user.selectOptions(within(form).getByLabelText("Autenticação"), "pat");
    await user.type(within(form).getByLabelText("Referência da credencial"), "env:DBX_VENDAS");
    await user.type(within(form).getByLabelText("Catálogo"), "lab_dw");
    await user.type(within(form).getByLabelText("Schema"), "vendas");
    await user.type(within(form).getByLabelText("Domínio"), "financeiro");
    await user.click(within(form).getByRole("button", { name: "Cadastrar fonte" }));
    expect(within(form).getByText("Token pessoal não é permitido em produção.")).toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText("Autenticação"), "oauth_m2m");
    await user.click(within(form).getByRole("button", { name: "Cadastrar fonte" }));
    expect(await screen.findByText(/Fonte dbx-vendas cadastrada. Teste a conexão/)).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources")[0]?.options.json).toEqual({
      id: "dbx-vendas", name: "Databricks Vendas", environment: "prod", kind: "databricks_sql", host: "adb-1.azuredatabricks.net",
      http_path: "/sql/1.0/warehouses/abc", auth_method: "oauth_m2m", credential_ref: "env:DBX_VENDAS",
      scopes: [{ catalog: "lab_dw", schema: "vendas", domain: "financeiro" }], schedule_time: undefined, owner: "ana.admin",
    });
    expect(screen.queryByRole("form", { name: "Cadastrar fonte" })).not.toBeInTheDocument();
  });

  it("fonte por arquivo não pede conexão e mostra a recusa do backend", async () => {
    const http = sourcesHttp({ "POST /sources": () => new ApiError(422, "validation_error", "identificador de escopo inválido") });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });

    await user.click(await screen.findByRole("button", { name: "Nova fonte" }));
    const form = screen.getByRole("form", { name: "Cadastrar fonte" });
    await user.selectOptions(within(form).getByLabelText("Tipo"), "file");
    expect(within(form).queryByLabelText("Host")).not.toBeInTheDocument();
    await user.type(within(form).getByLabelText("Identificador"), "arquivos-rh");
    await user.type(within(form).getByLabelText("Nome"), "Arquivos RH");
    await user.type(within(form).getByLabelText("Catálogo"), "rh");
    await user.type(within(form).getByLabelText("Schema"), "pessoas");
    await user.type(within(form).getByLabelText("Domínio"), "rh");
    await user.click(within(form).getByRole("button", { name: "Cadastrar fonte" }));

    expect(await screen.findByText(/identificador de escopo inválido/)).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources")[0]?.options.json).toMatchObject({ kind: "file", auth_method: "none", host: undefined, credential_ref: undefined });
  });
});
