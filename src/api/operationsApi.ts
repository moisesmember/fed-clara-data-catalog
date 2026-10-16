import type { HttpClient } from "@/core/http/httpClient";

import { endpoints } from "./endpoints";
import { callEndpoint } from "./request";
import type { AuditEvent, GovernanceDashboard, GraphMetrics, Job, JobAccepted, Page, ScopeAdded, ScopesOverview, SourceInput, SourceSummary, SyncRun } from "./types";

/** Administração e operação: fontes, sincronizações, jobs, auditoria e métricas. */
export interface OperationsApi {
  sources(): Promise<SourceSummary[]>;
  /** Cadastra a fonte. Com um `id` existente, o backend substitui a configuração: confira antes. */
  createSource(source: SourceInput): Promise<{ id: string }>;
  testSource(sourceId: string): Promise<JobAccepted>;
  syncSource(sourceId: string, scopes?: string[]): Promise<JobAccepted>;
  importFile(sourceId: string, file: File): Promise<JobAccepted & { note: string }>;
  syncRuns(sourceId: string, page: Page): Promise<SyncRun[]>;
  scopes(sourceId: string): Promise<ScopesOverview>;
  addScope(sourceId: string, scope: { catalog: string; schema: string; domain: string; sync: boolean }): Promise<ScopeAdded>;
  setScopeDomain(sourceId: string, scope: string, domain: string): Promise<{ scope: string; domain: string }>;
  removeScope(sourceId: string, scope: string): Promise<{ scope: string; assets_kept: number }>;
  discover(sourceId: string, catalogs?: string[]): Promise<JobAccepted>;
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
    setScopeDomain: (sourceId, scope, domain) =>
      callEndpoint(http, endpoints.sourceScopeDomain, { source_id: sourceId, scope }, { json: { domain } }),
    removeScope: (sourceId, scope) => callEndpoint(http, endpoints.sourceScopeRemove, { source_id: sourceId, scope }),
    discover: (sourceId, catalogs) =>
      callEndpoint(http, endpoints.sourceDiscover, { source_id: sourceId }, { json: { catalogs: catalogs?.length ? catalogs : null } }),
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
