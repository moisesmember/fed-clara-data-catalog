import type { HttpClient } from "@/core/http/httpClient";

import { endpoints } from "./endpoints";
import { callEndpoint } from "./request";
import type {
  AuditEvent,
  DiscoveredObjects,
  GenieSpace,
  GenieSpaceInput,
  GovernanceDashboard,
  GraphMetrics,
  Job,
  JobAccepted,
  Page,
  ScopeAdded,
  ScopeChanges,
  ScopeConfig,
  ScopeInput,
  ScopesOverview,
  SourceCreated,
  SourceInput,
  SourceSummary,
  SyncRun,
  WarehouseSelected,
} from "./types";

/** Administração e operação: fontes, sincronizações, jobs, auditoria e métricas. */
export interface OperationsApi {
  sources(): Promise<SourceSummary[]>;
  /** Cadastra a fonte. Com um `id` existente, o backend substitui a configuração: confira antes.
   *  Para Databricks, o backend já enfileira a conexão (warehouse, teste e descoberta). */
  createSource(source: SourceInput): Promise<SourceCreated>;
  testSource(sourceId: string): Promise<JobAccepted>;
  syncSource(sourceId: string, scopes?: string[]): Promise<JobAccepted>;
  importFile(sourceId: string, file: File): Promise<JobAccepted & { note: string }>;
  syncRuns(sourceId: string, page: Page): Promise<SyncRun[]>;
  scopes(sourceId: string): Promise<ScopesOverview>;
  addScope(sourceId: string, scope: ScopeInput & { sync: boolean }): Promise<ScopeAdded>;
  /** Muda filtros, tabelas e exceções; o domínio só antes da primeira importação (409 depois). */
  updateScope(sourceId: string, scope: string, changes: ScopeChanges): Promise<ScopeConfig & { key: string }>;
  removeScope(sourceId: string, scope: string): Promise<{ scope: string; assets_kept: number }>;
  discover(sourceId: string, catalogs?: string[]): Promise<JobAccepted>;
  /** Tabelas e views de um schema na última descoberta, com o que a seleção atual inclui. */
  discoveredObjects(sourceId: string, catalog: string, schema: string): Promise<DiscoveredObjects>;
  /** Escolhe um dos SQL Warehouses listados; o backend testa e descobre em seguida. */
  setWarehouse(sourceId: string, warehouseId: string): Promise<WarehouseSelected>;
  refreshWarehouses(sourceId: string): Promise<JobAccepted>;
  /** Atalhos para espaços Genie da fonte (só o vínculo: a Clara não chama o Genie). */
  genieSpaces(sourceId: string): Promise<GenieSpace[]>;
  addGenieSpace(sourceId: string, space: GenieSpaceInput): Promise<{ id: number }>;
  removeGenieSpace(sourceId: string, genieId: number): Promise<{ ok: boolean }>;
  job(jobId: number): Promise<Job>;
  cancelJob(jobId: number): Promise<{ ok: boolean }>;
  audit(filters: { entityType?: string; entityId?: string }, page: Page): Promise<AuditEvent[]>;
  graphMetrics(graph?: "curation" | "answer", sinceHours?: number): Promise<GraphMetrics>;
  /** Procura e qualidade de catalogação no período (curadores veem só os seus domínios). */
  governanceDashboard(days: number): Promise<GovernanceDashboard>;
}

export function createOperationsApi(http: HttpClient): OperationsApi {
  return {
    sources: () => callEndpoint(http, endpoints.sources),
    createSource: (source) => callEndpoint(http, endpoints.sourceUpsert, {}, { json: source }),
    testSource: (sourceId) => callEndpoint(http, endpoints.sourceTest, { source_id: sourceId }),
    syncSource: (sourceId, scopes) =>
      callEndpoint(http, endpoints.sourceSync, { source_id: sourceId }, { json: { scopes: scopes?.length ? scopes : null } }),
    importFile: (sourceId, file) =>
      callEndpoint(http, endpoints.sourceImport, { source_id: sourceId }, { query: { filename: file.name }, rawBody: file }),
    syncRuns: (sourceId, page) =>
      callEndpoint(http, endpoints.sourceSyncRuns, { source_id: sourceId }, { query: { page: page.page, page_size: page.pageSize } }),
    scopes: (sourceId) => callEndpoint(http, endpoints.sourceScopes, { source_id: sourceId }),
    addScope: (sourceId, scope) => callEndpoint(http, endpoints.sourceScopeAdd, { source_id: sourceId }, { json: scope }),
    updateScope: (sourceId, scope, changes) => callEndpoint(http, endpoints.sourceScopeUpdate, { source_id: sourceId, scope }, { json: changes }),
    removeScope: (sourceId, scope) => callEndpoint(http, endpoints.sourceScopeRemove, { source_id: sourceId, scope }),
    discover: (sourceId, catalogs) =>
      callEndpoint(http, endpoints.sourceDiscover, { source_id: sourceId }, { json: { catalogs: catalogs?.length ? catalogs : null } }),
    discoveredObjects: (sourceId, catalog, schema) => callEndpoint(http, endpoints.sourceObjects, { source_id: sourceId }, { query: { catalog, schema } }),
    setWarehouse: (sourceId, warehouseId) =>
      callEndpoint(http, endpoints.sourceWarehouse, { source_id: sourceId }, { json: { warehouse_id: warehouseId } }),
    refreshWarehouses: (sourceId) => callEndpoint(http, endpoints.sourceWarehousesRefresh, { source_id: sourceId }),
    genieSpaces: (sourceId) => callEndpoint(http, endpoints.sourceGenieSpaces, { source_id: sourceId }),
    addGenieSpace: (sourceId, space) => callEndpoint(http, endpoints.sourceGenieSpaceAdd, { source_id: sourceId }, { json: space }),
    removeGenieSpace: (sourceId, genieId) => callEndpoint(http, endpoints.sourceGenieSpaceRemove, { source_id: sourceId, genie_id: genieId }),
    job: (jobId) => callEndpoint(http, endpoints.job, { job_id: jobId }),
    cancelJob: (jobId) => callEndpoint(http, endpoints.jobCancel, { job_id: jobId }),
    audit: (filters, page) =>
      callEndpoint(http, endpoints.audit, {}, {
        query: { entity_type: filters.entityType, entity_id: filters.entityId, page: page.page, page_size: page.pageSize },
      }),
    graphMetrics: (graph, sinceHours = 24) =>
      callEndpoint(http, endpoints.graphMetrics, {}, { query: { graph, since_hours: sinceHours } }),
    governanceDashboard: (days) => callEndpoint(http, endpoints.governanceDashboard, {}, { query: { days } }),
  };
}
