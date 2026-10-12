import type { HttpClient } from "@/core/http/httpClient";

import { endpoints } from "./endpoints";
import { callEndpoint } from "./request";
import type {
  AskResponse,
  BrowseResponse,
  MeResponse,
  PublishedCard,
  SearchMode,
  SearchResponse,
  SuggestionItem,
  TrustStatus,
  Visibility,
} from "./types";

/** Descoberta: sessão, busca, perguntas e fichas publicadas. */
export interface DiscoveryApi {
  me(): Promise<MeResponse>;
  search(query: string, mode?: SearchMode, limit?: number): Promise<SearchResponse>;
  /** `allowClarification=false` quando a pessoa já escolheu uma das opções oferecidas. */
  ask(question: string, mode?: SearchMode, allowClarification?: boolean): Promise<AskResponse>;
  browse(): Promise<BrowseResponse>;
  suggest(text: string): Promise<SuggestionItem[]>;
  feedback(question: string, helpful: boolean, mode?: SearchMode): Promise<{ ok: boolean }>;
  requestHelp(question: string, assetId?: number): Promise<{ id: number }>;
  card(assetId: number): Promise<PublishedCard>;
  setVisibility(assetId: number, visibility: Visibility, expectedLockVersion?: number): Promise<{ lock_version: number }>;
  setTrust(assetId: number, status: TrustStatus, notes?: string): Promise<{ ok: boolean }>;
  retire(assetId: number, reason: string): Promise<{ ok: boolean }>;
}

export function createDiscoveryApi(http: HttpClient): DiscoveryApi {
  return {
    me: () => callEndpoint(http, endpoints.me),
    search: (query, mode, limit = 10) => callEndpoint(http, endpoints.search, {}, { query: { q: query, mode, limit } }),
    ask: (question, mode, allowClarification = true) =>
      callEndpoint(http, endpoints.ask, {}, { json: { question, mode, allow_clarification: allowClarification } }),
    browse: () => callEndpoint(http, endpoints.browse),
    suggest: (text) => callEndpoint(http, endpoints.suggest, {}, { query: { q: text } }),
    feedback: (question, helpful, mode) => callEndpoint(http, endpoints.feedback, {}, { json: { question, helpful, mode } }),
    requestHelp: (question, assetId) => callEndpoint(http, endpoints.helpRequestCreate, {}, { json: { question, asset_id: assetId ?? null } }),
    card: (assetId) => callEndpoint(http, endpoints.card, { asset_id: assetId }),
    setVisibility: (assetId, visibility, expectedLockVersion) =>
      callEndpoint(http, endpoints.cardVisibility, { asset_id: assetId }, {
        json: { visibility, expected_lock_version: expectedLockVersion },
      }),
    setTrust: (assetId, status, notes) =>
      callEndpoint(http, endpoints.cardTrust, { asset_id: assetId }, { json: { status, notes } }),
    retire: (assetId, reason) => callEndpoint(http, endpoints.cardRetire, { asset_id: assetId }, { json: { reason } }),
  };
}
