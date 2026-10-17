import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { DiscoveredObjects, ScopeConfig, ScopesOverview, SourceSummary, Warehouse } from "@/api/types";
import { ApiError } from "@/core/http/apiError";
import { FakeHttpClient } from "@/test/fakeHttpClient";
import { renderApp } from "@/test/renderApp";

const ALL = { tables: null, exclude: [], table_types: null, formats: null };
const CREDIT_RISK: ScopeConfig = { catalog: "workspace", schema: "credit_risk", domain: "financeiro", ...ALL };
const HEALTH: ScopeConfig = { catalog: "workspace", schema: "health", domain: "saude", ...ALL };
const STARTER: Warehouse = { id: "w1", name: "Starter", state: "STOPPED", size: "2X-Small", type: "PRO", serverless: true, http_path: "/sql/1.0/warehouses/w1" };
const BIG: Warehouse = { ...STARTER, id: "w2", name: "Grande", state: "RUNNING", size: "Large", http_path: "/sql/1.0/warehouses/w2" };

const SOURCE: SourceSummary = {
  id: "dbx-free-lab",
  name: "Databricks Free Edition",
  environment: "lab",
  kind: "databricks_sql",
  host: "dbc.cloud.databricks.com",
  http_path: STARTER.http_path,
  warehouses: { listed_at: "2026-10-16T12:00:00Z", items: [STARTER], error: null },
  auth_method: "pat",
  scopes: [CREDIT_RISK, HEALTH],
  schedule_time: null,
  schedule_tz: "America/Sao_Paulo",
  owner: "voce@exemplo.local",
  status: "active",
  metastore_id: null,
  last_capability_check: null,
};

const OVERVIEW: ScopesOverview = {
  source_id: "dbx-free-lab",
  http_path: STARTER.http_path,
  warehouses: SOURCE.warehouses,
  discovered_at: "2026-10-12T12:00:00Z",
  discovery_truncated: false,
  objects_truncated: false,
  discovery_errors: [{ catalog: "sem_acesso", error: "ServerOperationError" }],
  catalogs: [
    {
      catalog: "workspace",
      comment: "Área de trabalho compartilhada",
      rule: null,
      schemas: [
        { schema: "credit_risk", comment: null, tables: 3, types: { MANAGED: 1, EXTERNAL: 1, VIEW: 1 }, formats: { DELTA: 1, PARQUET: 1 },
          rule: CREDIT_RISK, owner: "workspace.credit_risk", domain: "financeiro", selected: 3 },
        { schema: "marketing", comment: "Campanhas e leads do CRM", tables: 9, types: { MANAGED: 9 }, formats: { DELTA: 9 },
          rule: null, owner: null, domain: null, selected: 0 },
      ],
    },
  ],
  rules: [
    { ...CREDIT_RISK, key: "workspace.credit_risk", visible: true },
    { ...HEALTH, key: "workspace.health", visible: false },
  ],
};

const OBJECTS: DiscoveredObjects = {
  catalog: "workspace",
  schema: "credit_risk",
  owner: "workspace.credit_risk",
  objects: [
    { name: "emprestimos", table_type: "MANAGED", data_format: "DELTA", selected: true },
    { name: "score_raw", table_type: "EXTERNAL", data_format: "PARQUET", selected: true },
    { name: "vw_inadimplencia", table_type: "VIEW", data_format: null, selected: true },
  ],
};

const RUNNING_JOB = (id: number, kind: string) => ({
  id, kind, status: "running", attempts: 1, max_attempts: 1, last_error: null, result: null, created_at: "", started_at: null, finished_at: null, cancel_requested: false,
});

function sourcesHttp(extra: Record<string, unknown> = {}) {
  return new FakeHttpClient({
    "GET /sources": [SOURCE],
    "GET /sources/dbx-free-lab/sync-runs": [],
    "GET /sources/dbx-free-lab/scopes": OVERVIEW,
    "GET /sources/dbx-free-lab/genie-spaces": [],
    "GET /sources/dbx-free-lab/genie-coverage": [],
    ...extra,
  });
}

async function openSelection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText("Selecionar o que publicar (catálogos, schemas, tabelas e filtros)"));
  return {
    rules: await screen.findByRole("region", { name: "Seleções configuradas" }),
    origin: screen.getByRole("region", { name: "Na origem" }),
  };
}

const rowOf = (container: HTMLElement, text: string) => within(container).getByText(text).closest("tr") as HTMLElement;

describe("Fontes: o que publicar, a partir da origem", () => {
  it("mostra seleções e árvore, descobre e inclui o catálogo inteiro com filtros", async () => {
    const http = sourcesHttp({
      "POST /sources/dbx-free-lab/discover": { job_id: 7 },
      "GET /jobs/7": RUNNING_JOB(7, "source.discover"),
      "POST /sources/dbx-free-lab/scopes": { scope: "workspace", domain: "comercial", sync_job_id: null, note: null },
    });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });
    const { rules, origin } = await openSelection(user);

    expect(within(rowOf(rules, "workspace.health")).getByText("Não visível")).toBeInTheDocument();
    expect(within(rowOf(rules, "workspace.credit_risk")).getByText("Schema inteiro")).toBeInTheDocument();
    expect(screen.getByText(/Sem acesso a: sem_acesso/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Catálogos a descobrir"), "workspace");
    await user.click(screen.getByRole("button", { name: "Descobrir na origem" }));
    expect(http.callsTo("POST", "/sources/dbx-free-lab/discover")[0]?.options.json).toEqual({ catalogs: ["workspace"] });

    // A árvore mostra o que a origem tem e quem decide cada schema.
    const marketing = rowOf(origin, "marketing");
    expect(within(marketing).getByText("Não selecionado")).toBeInTheDocument();
    expect(within(marketing).getByText("Campanhas e leads do CRM")).toBeInTheDocument();
    expect(within(rowOf(origin, "credit_risk")).getByText(/3 de 3/)).toBeInTheDocument();
    expect(within(origin).getByText("Área de trabalho compartilhada")).toBeInTheDocument();

    await user.click(within(origin).getByRole("button", { name: "Selecionar catálogo workspace inteiro" }));
    const form = screen.getByRole("form", { name: "Catálogo workspace inteiro" });
    await user.type(within(form).getByLabelText("Domínio"), "comercial");
    await user.click(within(form).getByLabelText("View"));
    await user.click(within(form).getByLabelText("Parquet"));
    await user.click(within(form).getByLabelText("marketing"));
    await user.click(within(form).getByRole("button", { name: "Incluir catálogo" }));

    expect(await screen.findByText("Seleção workspace incluída no domínio comercial.")).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources/dbx-free-lab/scopes")[0]?.options.json).toEqual({
      catalog: "workspace", schema: null, domain: "comercial", sync: false, exclude: ["marketing"],
      table_types: ["MANAGED", "EXTERNAL", "MATERIALIZED_VIEW", "STREAMING_TABLE", "FOREIGN"], formats: ["CSV", "DELTA", "JSON"],
    });
  });

  it("escolhe tabelas de um schema e cria a seleção de outro com todos os tipos", async () => {
    const http = sourcesHttp({
      "GET /sources/dbx-free-lab/objects": OBJECTS,
      "PATCH /sources/dbx-free-lab/scopes/workspace.credit_risk": { ...CREDIT_RISK, key: "workspace.credit_risk", tables: ["emprestimos", "vw_inadimplencia"] },
      "POST /sources/dbx-free-lab/scopes": { scope: "workspace.marketing", domain: "marketing", sync_job_id: null, note: null },
    });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });
    const { origin } = await openSelection(user);

    await user.click(within(origin).getByRole("button", { name: "Escolher tabelas de workspace.credit_risk" }));
    const list = await screen.findByRole("list", { name: "Objetos de workspace.credit_risk" });
    expect(http.callsTo("GET", "/sources/dbx-free-lab/objects")[0]?.options.query).toEqual({ catalog: "workspace", schema: "credit_risk" });
    expect(within(list).getByText("Tabela externa")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Só as marcadas" }));
    await user.click(within(list).getByLabelText(/score_raw/));
    expect(screen.getByText("2 de 3 selecionado(s)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar seleção" }));

    expect(await screen.findByText("Seleção de workspace.credit_risk salva.")).toBeInTheDocument();
    expect(http.callsTo("PATCH", "/sources/dbx-free-lab/scopes/workspace.credit_risk")[0]?.options.json).toEqual({
      tables: ["emprestimos", "vw_inadimplencia"], exclude: [],
    });

    await user.click(within(origin).getByRole("button", { name: "Selecionar schema workspace.marketing" }));
    const form = screen.getByRole("form", { name: "Schema workspace.marketing inteiro" });
    await user.type(within(form).getByLabelText("Domínio"), "marketing");
    await user.click(within(form).getByRole("button", { name: "Incluir schema" }));
    expect(await screen.findByText("Seleção workspace.marketing incluída no domínio marketing.")).toBeInTheDocument();
    // Todos os tipos e formatos marcados = sem filtro: o que surgir na origem também entra.
    expect(http.callsTo("POST", "/sources/dbx-free-lab/scopes")[0]?.options.json).toEqual({
      catalog: "workspace", schema: "marketing", domain: "marketing", table_types: null, formats: null, exclude: [], sync: false,
    });
  });

  it("remoção pede confirmação e a troca de domínio mostra a recusa do backend", async () => {
    const http = sourcesHttp({
      "DELETE /sources/dbx-free-lab/scopes/workspace.health": { scope: "workspace.health", assets_kept: 3 },
      "PATCH /sources/dbx-free-lab/scopes/workspace.credit_risk": () =>
        new ApiError(409, "conflict", "seleção já tem ativos importados: o domínio deles não muda com a configuração"),
    });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });
    const { rules } = await openSelection(user);

    await user.click(within(rules).getByRole("button", { name: "Remover workspace.health" }));
    expect(http.callsTo("DELETE", "/sources/dbx-free-lab/scopes/workspace.health")).toHaveLength(0);
    await user.click(within(rules).getByRole("button", { name: "Confirmar remoção" }));
    expect(await screen.findByText(/Seleção workspace.health removida. 3 ativo\(s\) já importado\(s\) continuam no catálogo./)).toBeInTheDocument();

    await user.click(within(rules).getByRole("button", { name: "Editar workspace.credit_risk" }));
    const form = screen.getByRole("form", { name: "Editar workspace.credit_risk" });
    const domain = within(form).getByLabelText("Domínio");
    await user.clear(domain);
    await user.type(domain, "comercial");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/o domínio deles não muda com a configuração/)).toBeInTheDocument();
    expect(http.callsTo("PATCH", "/sources/dbx-free-lab/scopes/workspace.credit_risk")[0]?.options.json).toEqual({
      table_types: null, formats: null, exclude: [], domain: "comercial",
    });
  });

  it("inclui seleção digitada e já pede a sincronização", async () => {
    const http = sourcesHttp({
      "POST /sources/dbx-free-lab/scopes": { scope: "usecase_factory.factory", domain: "producao", sync_job_id: null, note: "fonte paused: sincronização não enfileirada" },
    });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });
    await openSelection(user);

    await user.click(screen.getByLabelText("Sincronizar ao incluir (fonte ativa)"));
    const form = screen.getByRole("form", { name: "Adicionar seleção manualmente" });
    await user.type(within(form).getByLabelText("Catálogo"), "usecase_factory");
    await user.type(within(form).getByLabelText("Schema"), "factory");
    await user.type(within(form).getByLabelText("Domínio"), "producao");
    await user.click(within(form).getByRole("button", { name: "Adicionar seleção" }));

    expect(await screen.findByText(/fonte paused: sincronização não enfileirada/)).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources/dbx-free-lab/scopes")[0]?.options.json).toEqual({
      catalog: "usecase_factory", schema: "factory", domain: "producao", sync: true,
    });
  });
});

describe("Fontes: conexão automática", () => {
  const NEW_SOURCE: SourceSummary = {
    ...SOURCE, id: "dbx-novo", name: "Databricks novo", http_path: null, scopes: [], status: "paused",
    warehouses: { listed_at: "2026-10-16T12:00:00Z", items: [STARTER, BIG], error: null },
  };

  it("com vários SQL Warehouses, o administrador escolhe na tela", async () => {
    const http = new FakeHttpClient({
      "GET /sources": [NEW_SOURCE],
      "GET /sources/dbx-novo/sync-runs": [],
      "GET /sources/dbx-novo/scopes": { ...OVERVIEW, source_id: "dbx-novo", http_path: null, discovered_at: null, discovery_errors: [], catalogs: [], rules: [] },
      "GET /sources/dbx-novo/genie-spaces": [],
      "GET /sources/dbx-novo/genie-coverage": [],
      "POST /sources/dbx-novo/warehouse": { warehouse: BIG, jobs: { test: 11, discover: 12 } },
      "GET /jobs/12": RUNNING_JOB(12, "source.discover"),
    });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });

    expect(await screen.findByText("Há mais de um SQL Warehouse. Escolha qual a Clara deve usar para ler os metadados:")).toBeInTheDocument();
    expect(screen.getByText("Nada selecionado ainda: a fonte não sincroniza.")).toBeInTheDocument();
    expect(screen.getByText("Escolha o SQL Warehouse para a Clara descobrir o que há na origem.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usar o SQL Warehouse Grande" }));

    expect(await screen.findByText(/SQL Warehouse Grande escolhido. A Clara vai testar a conexão e descobrir a origem./)).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources/dbx-novo/warehouse")[0]?.options.json).toEqual({ warehouse_id: "w2" });
  });

  it("falha ao listar os warehouses aparece com o que fazer", async () => {
    const failed = { ...NEW_SOURCE, warehouses: { listed_at: "2026-10-16T12:00:00Z", items: [], error: "PermissionDenied" } };
    const http = new FakeHttpClient({
      "GET /sources": [failed],
      "GET /sources/dbx-novo/sync-runs": [],
      "GET /sources/dbx-novo/scopes": { ...OVERVIEW, source_id: "dbx-novo", http_path: null, discovered_at: null, discovery_errors: [], catalogs: [], rules: [] },
      "GET /sources/dbx-novo/genie-spaces": [],
      "GET /sources/dbx-novo/genie-coverage": [],
    });
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });
    expect(await screen.findByText(/Não foi possível listar os SQL Warehouses \(PermissionDenied\)/)).toBeInTheDocument();
  });
});

describe("Fontes: atalhos para o Genie", () => {
  it("registra um espaço a partir do link copiado do Genie e remove com confirmação", async () => {
    const space = { id: 4, title: "Vendas e faturamento", description: null, domains: ["financeiro", "comercial"], source_id: "dbx-free-lab",
      space_id: "01f0a1b2c3d4e5f60718293a4b5c6d7e", created_by: "ana.admin", created_at: "2026-10-17T10:00:00Z",
      url: "https://dbc.cloud.databricks.com/genie/rooms/01f0a1b2c3d4e5f60718293a4b5c6d7e", synced_at: "2026-10-17T11:00:00Z", sync_error: null,
      tables: 3, questions: 5 };
    const http = sourcesHttp({
      "GET /sources/dbx-free-lab/genie-spaces": [space],
      "POST /sources/dbx-free-lab/genie-spaces": { id: 5 },
      "DELETE /sources/dbx-free-lab/genie-spaces/4": { ok: true },
    });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });

    await user.click(await screen.findByText("Genie (atalhos e contexto para a curadoria)"));
    expect(await screen.findByRole("link", { name: "Vendas e faturamento" })).toHaveAttribute("href", space.url);
    expect(screen.getByText(/3 tabela\(s\) · 5 pergunta\(s\)/)).toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Registrar espaço Genie" });
    await user.type(within(form).getByLabelText("Espaço Genie"), "https://dbc.cloud.databricks.com/genie/rooms/01f0ffffeeeeddddccccbbbbaaaa9999?o=123");
    await user.type(within(form).getByLabelText("Título"), "Dados gerais");
    await user.type(within(form).getByLabelText("Domínios"), "*");
    await user.click(within(form).getByRole("button", { name: "Registrar atalho" }));
    expect(await screen.findByText("Atalho “Dados gerais” registrado.")).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources/dbx-free-lab/genie-spaces")[0]?.options.json).toEqual({
      space_id: "01f0ffffeeeeddddccccbbbbaaaa9999", title: "Dados gerais", description: undefined, domains: ["*"],
    });

    await user.click(screen.getByRole("button", { name: "Remover atalho Vendas e faturamento" }));
    await user.click(screen.getByRole("button", { name: "Confirmar remoção" }));
    expect(await screen.findByText("Atalho “Vendas e faturamento” removido.")).toBeInTheDocument();
  });
});

describe("Fontes: contexto do Genie para a curadoria", () => {
  it("mostra a leitura dos espaços, relê sob demanda e aponta o que o Genie usa e a Clara não cataloga", async () => {
    const failing = { id: 4, title: "Crédito", description: null, domains: ["financeiro"], source_id: "dbx-free-lab", space_id: "01f0a1b2c3d4e5f60718293a4b5c6d7e",
      created_by: "ana.admin", created_at: "2026-10-17T10:00:00Z", url: "https://dbc.cloud.databricks.com/genie/rooms/01f0a1b2c3d4e5f60718293a4b5c6d7e",
      synced_at: "2026-10-17T11:00:00Z", sync_error: "PermissionDenied", tables: 2, questions: 4 };
    const http = sourcesHttp({
      "GET /sources/dbx-free-lab/genie-spaces": [failing],
      "GET /sources/dbx-free-lab/genie-coverage": [
        { fqn: "workspace.credit_risk.emprestimos", catalog: "workspace", schema: "credit_risk", name: "emprestimos", spaces: ["Crédito"], status: "catalogued", asset_id: 9 },
        { fqn: "workspace.marketing.leads", catalog: "workspace", schema: "marketing", name: "leads", spaces: ["Crédito"], status: "not_selected", asset_id: null },
      ],
      "POST /sources/dbx-free-lab/genie-spaces/refresh": { job_id: 77 },
      "GET /jobs/77": { id: 77, kind: "genie.refresh", status: "running", attempts: 1, max_attempts: 1, last_error: null, result: null,
        created_at: "", started_at: null, finished_at: null, cancel_requested: false },
    });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });

    await user.click(await screen.findByText("Genie (atalhos e contexto para a curadoria)"));
    expect(await screen.findByText("Leitura falhou (PermissionDenied)")).toBeInTheDocument();
    const coverage = await screen.findByRole("region", { name: "Tabelas usadas no Genie" });
    expect(within(coverage).getByText("1 tabela(s) usada(s) no Genie ainda não fazem parte da seleção da fonte.")).toBeInTheDocument();
    const leads = within(coverage).getByText("workspace.marketing.leads").closest("li") as HTMLElement;
    expect(within(leads).getByText("Fora da seleção")).toBeInTheDocument();
    expect(within(coverage).getByText("Catalogada")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Atualizar do Genie" }));
    expect(http.callsTo("POST", "/sources/dbx-free-lab/genie-spaces/refresh")).toHaveLength(1);
  });
});

describe("Fontes: cadastro pela tela", () => {
  it("cadastra Databricks só com host e credencial; a Clara segue sozinha", async () => {
    const http = sourcesHttp({ "POST /sources": { id: "dbx-vendas", jobs: { connect: 5 } } });
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
    await user.selectOptions(within(form).getByLabelText("Autenticação"), "pat");
    await user.type(within(form).getByLabelText("Referência da credencial"), "env:DBX_VENDAS");
    // Seleção é opcional, mas se começar, precisa de catálogo.
    await user.type(within(form).getByLabelText("Domínio"), "financeiro");
    await user.click(within(form).getByRole("button", { name: "Cadastrar fonte" }));
    expect(within(form).getByText("Token pessoal não é permitido em produção.")).toBeInTheDocument();
    expect(within(form).getByText("Informe o catálogo.")).toBeInTheDocument();

    await user.clear(within(form).getByLabelText("Domínio"));
    await user.selectOptions(within(form).getByLabelText("Autenticação"), "oauth_m2m");
    await user.click(within(form).getByRole("button", { name: "Cadastrar fonte" }));
    expect(await screen.findByText(/Fonte dbx-vendas cadastrada. A Clara está procurando o SQL Warehouse/)).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources")[0]?.options.json).toEqual({
      id: "dbx-vendas", name: "Databricks Vendas", environment: "prod", kind: "databricks_sql", host: "adb-1.azuredatabricks.net",
      http_path: undefined, auth_method: "oauth_m2m", credential_ref: "env:DBX_VENDAS", scopes: [], schedule_time: undefined, owner: "ana.admin",
    });
    expect(screen.queryByRole("form", { name: "Cadastrar fonte" })).not.toBeInTheDocument();
  });

  it("fonte por arquivo não pede conexão, exige a seleção e mostra a recusa do backend", async () => {
    const http = sourcesHttp({ "POST /sources": () => new ApiError(422, "validation_error", "catálogo inválido") });
    const user = userEvent.setup();
    renderApp({ path: "/admin/fontes", subject: "ana.admin", http });

    await user.click(await screen.findByRole("button", { name: "Nova fonte" }));
    const form = screen.getByRole("form", { name: "Cadastrar fonte" });
    await user.selectOptions(within(form).getByLabelText("Tipo"), "file");
    expect(within(form).queryByLabelText("Host")).not.toBeInTheDocument();
    await user.type(within(form).getByLabelText("Identificador"), "arquivos-rh");
    await user.type(within(form).getByLabelText("Nome"), "Arquivos RH");
    await user.click(within(form).getByRole("button", { name: "Cadastrar fonte" }));
    expect(within(form).getByText("Informe o catálogo.")).toBeInTheDocument();

    await user.type(within(form).getByLabelText("Catálogo"), "rh");
    await user.type(within(form).getByLabelText("Schema"), "pessoas");
    await user.type(within(form).getByLabelText("Domínio"), "rh");
    await user.click(within(form).getByRole("button", { name: "Cadastrar fonte" }));

    expect(await screen.findByText(/catálogo inválido/)).toBeInTheDocument();
    expect(http.callsTo("POST", "/sources")[0]?.options.json).toMatchObject({
      kind: "file", auth_method: "none", host: undefined, credential_ref: undefined, scopes: [{ catalog: "rh", schema: "pessoas", domain: "rh" }],
    });
  });
});
