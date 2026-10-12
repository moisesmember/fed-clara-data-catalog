/** Catálogo único dos endpoints consumidos. Os serviços usam estes templates e o teste de
 *  contrato verifica cada um contra o `openapi.json` do backend. */
export interface Endpoint {
  method: "GET" | "POST" | "DELETE";
  path: string;
}

export const endpoints = {
  me: { method: "GET", path: "/me" },
  search: { method: "GET", path: "/search" },
  ask: { method: "POST", path: "/ask" },
  card: { method: "GET", path: "/cards/{asset_id}" },
  cardVisibility: { method: "POST", path: "/cards/{asset_id}/visibility" },
  cardTrust: { method: "POST", path: "/cards/{asset_id}/trust" },
  cardRetire: { method: "POST", path: "/cards/{asset_id}/retire" },
  cardEdit: { method: "POST", path: "/cards/{asset_id}/edit" },
  tasks: { method: "GET", path: "/curation/tasks" },
  task: { method: "GET", path: "/curation/tasks/{task_id}" },
  taskStart: { method: "POST", path: "/curation/tasks/{task_id}/start" },
  taskReview: { method: "POST", path: "/curation/tasks/{task_id}/review" },
  taskPublish: { method: "POST", path: "/curation/tasks/{task_id}/publish" },
  assets: { method: "GET", path: "/assets" },
  asset: { method: "GET", path: "/assets/{asset_id}" },
  assetVersions: { method: "GET", path: "/assets/{asset_id}/versions" },
  assetVersion: { method: "GET", path: "/assets/{asset_id}/versions/{version_no}" },
  assetSemanticChange: { method: "POST", path: "/assets/{asset_id}/semantic-change" },
  sources: { method: "GET", path: "/sources" },
  sourceTest: { method: "POST", path: "/sources/{source_id}/test" },
  sourceSync: { method: "POST", path: "/sources/{source_id}/syncs" },
  sourceImport: { method: "POST", path: "/sources/{source_id}/imports" },
  sourceSyncRuns: { method: "GET", path: "/sources/{source_id}/sync-runs" },
  job: { method: "GET", path: "/jobs/{job_id}" },
  jobCancel: { method: "POST", path: "/jobs/{job_id}/cancel" },
  audit: { method: "GET", path: "/audit" },
  graphMetrics: { method: "GET", path: "/metrics/graphs" },
  // Descoberta guiada para usuários não técnicos.
  browse: { method: "GET", path: "/catalog/browse" },
  suggest: { method: "GET", path: "/catalog/suggest" },
  feedback: { method: "POST", path: "/feedback" },
  helpRequestCreate: { method: "POST", path: "/help-requests" },
  helpRequests: { method: "GET", path: "/help-requests" },
  helpRequestResolve: { method: "POST", path: "/help-requests/{request_id}/resolve" },
  unanswered: { method: "GET", path: "/insights/unanswered" },
  glossary: { method: "GET", path: "/glossary" },
  glossaryUpsert: { method: "POST", path: "/glossary" },
  glossaryDelete: { method: "DELETE", path: "/glossary/{term_id}" },
} as const satisfies Record<string, Endpoint>;

export type EndpointName = keyof typeof endpoints;
