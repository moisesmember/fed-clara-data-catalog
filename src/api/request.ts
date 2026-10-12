import { buildPath, type HttpClient, type RequestOptions } from "@/core/http/httpClient";

import type { Endpoint } from "./endpoints";

/** Executa um endpoint do catálogo: garante que método e caminho venham da mesma fonte. */
export function callEndpoint<T>(
  http: HttpClient,
  endpoint: Endpoint,
  pathParams: Record<string, string | number> = {},
  options: RequestOptions = {},
): Promise<T> {
  const path = buildPath(endpoint.path, pathParams);
  switch (endpoint.method) {
    case "GET":
      return http.get<T>(path, options);
    case "POST":
      return http.post<T>(path, options);
    case "DELETE":
      return http.delete<T>(path, options);
  }
}
