import type { HttpClient } from "@/core/http/httpClient";

import { endpoints } from "./endpoints";
import { callEndpoint } from "./request";
import type { GlossaryTerm, HelpRequest, UnansweredQuery } from "./types";

/** Conhecimento mantido pelos curadores a partir do que os usuários procuram:
 *  glossário de negócio, perguntas sem resposta e pedidos de ajuda. */
export interface KnowledgeApi {
  glossary(): Promise<GlossaryTerm[]>;
  saveTerm(domain: string, term: string, expansions: string[]): Promise<{ id: number }>;
  deleteTerm(termId: number): Promise<{ ok: boolean }>;
  unanswered(days?: number): Promise<UnansweredQuery[]>;
  helpRequests(status?: "open" | "resolved"): Promise<HelpRequest[]>;
  resolveHelp(requestId: number, note: string): Promise<{ ok: boolean }>;
}

export function createKnowledgeApi(http: HttpClient): KnowledgeApi {
  return {
    glossary: () => callEndpoint(http, endpoints.glossary),
    saveTerm: (domain, term, expansions) => callEndpoint(http, endpoints.glossaryUpsert, {}, { json: { domain, term, expansions } }),
    deleteTerm: (termId) => callEndpoint(http, endpoints.glossaryDelete, { term_id: termId }),
    unanswered: (days = 30) => callEndpoint(http, endpoints.unanswered, {}, { query: { days } }),
    helpRequests: (status = "open") => callEndpoint(http, endpoints.helpRequests, {}, { query: { status } }),
    resolveHelp: (requestId, note) => callEndpoint(http, endpoints.helpRequestResolve, { request_id: requestId }, { json: { note } }),
  };
}
