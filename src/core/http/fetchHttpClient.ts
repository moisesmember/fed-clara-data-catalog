import { ApiError } from "./apiError";
import { buildQuery, type HttpClient, type RequestOptions } from "./httpClient";

export type HeaderSource = () => Record<string, string>;

/** Implementação de HttpClient sobre `fetch`. A identidade entra por `authHeaders`, sem que o
 *  transporte conheça o provedor de identidade (inversão de dependência). */
export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private readonly authHeaders: HeaderSource;
  private readonly fetchImpl: typeof fetch;

  constructor(baseUrl: string, authHeaders: HeaderSource, fetchImpl: typeof fetch = (...args) => fetch(...args)) {
    this.baseUrl = baseUrl;
    this.authHeaders = authHeaders;
    this.fetchImpl = fetchImpl;
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("POST", path, options);
  }

  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }

  private async request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", ...this.authHeaders() };
    let body: BodyInit | undefined;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json; charset=utf-8";
      body = JSON.stringify(options.json);
    } else if (options.rawBody !== undefined) {
      body = options.rawBody;
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}${buildQuery(options.query)}`, {
      method,
      headers,
      body,
      signal: options.signal,
    });
    if (!response.ok) {
      throw await ApiError.fromResponse(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
}
