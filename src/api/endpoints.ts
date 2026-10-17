/** Catálogo único dos endpoints consumidos. Os serviços usam estes templates e o teste de
 *  contrato verifica cada um contra o `openapi.json` do backend. */
export interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
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
  sourceUpsert: { method: "POST", path: "/sources" },
  sourceTest: { method: "POST", path: "/sources/{source_id}/test" },
  sourceSync: { method: "POST", path: "/sources/{source_id}/syncs" },
  sourceImport: { method: "POST", path: "/sources/{source_id}/imports" },
  sourceSyncRuns: { method: "GET", path: "/sources/{source_id}/sync-runs" },
  // Escopos um a um e descoberta na origem (ADR 0012 do backend).
  sourceScopes: { method: "GET", path: "/sources/{source_id}/scopes" },
  sourceScopeAdd: { method: "POST", path: "/sources/{source_id}/scopes" },
  sourceScopeUpdate: { method: "PATCH", path: "/sources/{source_id}/scopes/{scope}" },
  sourceScopeRemove: { method: "DELETE", path: "/sources/{source_id}/scopes/{scope}" },
  sourceDiscover: { method: "POST", path: "/sources/{source_id}/discover" },
  sourceObjects: { method: "GET", path: "/sources/{source_id}/objects" },
  sourceWarehouse: { method: "POST", path: "/sources/{source_id}/warehouse" },
  sourceWarehousesRefresh: { method: "POST", path: "/sources/{source_id}/warehouses/refresh" },
  sourceGenieSpaces: { method: "GET", path: "/sources/{source_id}/genie-spaces" },
  sourceGenieSpaceAdd: { method: "POST", path: "/sources/{source_id}/genie-spaces" },
  sourceGenieSpaceRemove: { method: "DELETE", path: "/sources/{source_id}/genie-spaces/{genie_id}" },
  sourceGenieRefresh: { method: "POST", path: "/sources/{source_id}/genie-spaces/refresh" },
  sourceGenieCoverage: { method: "GET", path: "/sources/{source_id}/genie-coverage" },
  job: { method: "GET", path: "/jobs/{job_id}" },
  jobCancel: { method: "POST", path: "/jobs/{job_id}/cancel" },
  audit: { method: "GET", path: "/audit" },
  graphMetrics: { method: "GET", path: "/metrics/graphs" },
  governanceDashboard: { method: "GET", path: "/governance/dashboard" },
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
  // Sugestões de termos pela IA, decididas por curadores (ADR 0011 do backend).
  glossarySuggestions: { method: "GET", path: "/glossary/suggestions" },
  glossarySuggestionAccept: { method: "POST", path: "/glossary/suggestions/{suggestion_id}/accept" },
  glossarySuggestionReject: { method: "POST", path: "/glossary/suggestions/{suggestion_id}/reject" },
} as const satisfies Record<string, Endpoint>;

export type EndpointName = keyof typeof endpoints;
