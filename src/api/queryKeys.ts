import type { AssetFilters } from "./assetsApi";
import type { TaskFilters } from "./curationApi";
import type { Page, SearchMode } from "./types";

/** Chaves de cache centralizadas: invalidações entre funcionalidades usam a mesma fonte.
 *  O cache inteiro é descartado ao trocar de identidade (SessionProvider), então nenhum
 *  resultado autorizado para um usuário é reaproveitado para outro. */
export const queryKeys = {
  me: (subject: string) => ["me", subject] as const,
  search: (query: string, mode: SearchMode) => ["search", query, mode] as const,
  card: (assetId: number) => ["card", assetId] as const,
  tasks: (filters: TaskFilters, page: Page) => ["tasks", filters, page] as const,
  tasksRoot: ["tasks"] as const,
  task: (taskId: number) => ["task", taskId] as const,
  assets: (filters: AssetFilters, page: Page) => ["assets", filters, page] as const,
  asset: (assetId: number) => ["asset", assetId] as const,
  assetVersions: (assetId: number) => ["asset", assetId, "versions"] as const,
  assetVersion: (assetId: number, versionNo: number) => ["asset", assetId, "versions", versionNo] as const,
  sources: ["sources"] as const,
  syncRuns: (sourceId: string, page: Page) => ["sources", sourceId, "runs", page] as const,
  job: (jobId: number) => ["job", jobId] as const,
  audit: (filters: { entityType?: string; entityId?: string }, page: Page) => ["audit", filters, page] as const,
  browse: ["browse"] as const,
  suggest: (text: string) => ["suggest", text] as const,
  glossary: ["glossary"] as const,
  unanswered: (days: number) => ["unanswered", days] as const,
  helpRequests: (status: string) => ["help-requests", status] as const,
  graphMetrics: (graph: string | undefined, sinceHours: number) => ["metrics", graph ?? "all", sinceHours] as const,
};
