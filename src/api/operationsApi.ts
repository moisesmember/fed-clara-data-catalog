import type { HttpClient } from "@/core/http/httpClient";

import { endpoints } from "./endpoints";
import { callEndpoint } from "./request";
import type { AuditEvent, GraphMetrics, Job, JobAccepted, Page, SourceSummary, SyncRun } from "./types";

/** Administração e operação: fontes, sincronizações, jobs, auditoria e métricas. */
export interface OperationsApi {
  sources(): Promise<SourceSummary[]>;
  testSource(sourceId: string): Promise<JobAccepted>;
  syncSource(sourceId: string, scopes?: string[]): Promise<JobAccepted>;
  importFile(sourceId: string, file: File): Promise<JobAccepted & { note: string }>;
  syncRuns(sourceId: string, page: Page): Promise<SyncRun[]>;
  job(jobId: number): Promise<Job>;
  cancelJob(jobId: number): Promise<{ ok: boolean }>;
  audit(filters: { entityType?: string; entityId?: string }, page: Page): Promise<AuditEvent[]>;
  graphMetrics(graph?: "curation" | "answer", sinceHours?: number): Promise<GraphMetrics>;
}

export function createOperationsApi(http: HttpClient): OperationsApi {
  return {
    sources: () => callEndpoint(http, endpoints.sources),
    testSource: (sourceId) => callEndpoint(http, endpoints.sourceTest, { source_id: sourceId }),
    syncSource: (sourceId, scopes) =>
      callEndpoint(http, endpoints.sourceSync, { source_id: sourceId }, { json: { scopes: scopes?.length ? scopes : null } }),
    importFile: (sourceId, file) =>
      callEndpoint(http, endpoints.sourceImport, { source_id: sourceId }, { query: { filename: file.name }, rawBody: file }),
    syncRuns: (sourceId, page) =>
      callEndpoint(http, endpoints.sourceSyncRuns, { source_id: sourceId }, { query: { page: page.page, page_size: page.pageSize } }),
    job: (jobId) => callEndpoint(http, endpoints.job, { job_id: jobId }),
    cancelJob: (jobId) => callEndpoint(http, endpoints.jobCancel, { job_id: jobId }),
    audit: (filters, page) =>
      callEndpoint(http, endpoints.audit, {}, {
        query: { entity_type: filters.entityType, entity_id: filters.entityId, page: page.page, page_size: page.pageSize },
      }),
    graphMetrics: (graph, sinceHours = 24) =>
      callEndpoint(http, endpoints.graphMetrics, {}, { query: { graph, since_hours: sinceHours } }),
  };
}
