import type { HttpClient } from "@/core/http/httpClient";

import { endpoints } from "./endpoints";
import { callEndpoint } from "./request";
import type { AssetDetail, AssetSummary, AssetVersionDetail, AssetVersionSummary, Page } from "./types";

export interface AssetFilters {
  sourceId?: string;
  catalog?: string;
  schema?: string;
  domain?: string;
  status?: string;
}

/** Metadados importados (visíveis a curadores e aprovadores do domínio). */
export interface AssetsApi {
  list(filters: AssetFilters, page: Page): Promise<AssetSummary[]>;
  get(assetId: number): Promise<AssetDetail>;
  versions(assetId: number): Promise<AssetVersionSummary[]>;
  version(assetId: number, versionNo: number): Promise<AssetVersionDetail>;
  flagSemanticChange(assetId: number, reason: string): Promise<{ task_id: number }>;
}

export function createAssetsApi(http: HttpClient): AssetsApi {
  return {
    list: (filters, page) =>
      callEndpoint(http, endpoints.assets, {}, {
        query: {
          source_id: filters.sourceId,
          catalog: filters.catalog,
          schema: filters.schema,
          domain: filters.domain,
          status: filters.status,
          page: page.page,
          page_size: page.pageSize,
        },
      }),
    get: (assetId) => callEndpoint(http, endpoints.asset, { asset_id: assetId }),
    versions: (assetId) => callEndpoint(http, endpoints.assetVersions, { asset_id: assetId }),
    version: (assetId, versionNo) => callEndpoint(http, endpoints.assetVersion, { asset_id: assetId, version_no: versionNo }),
    flagSemanticChange: (assetId, reason) =>
      callEndpoint(http, endpoints.assetSemanticChange, { asset_id: assetId }, { json: { reason } }),
  };
}
