/** Contrato de transporte HTTP. Serviços de API dependem desta interface, nunca do `fetch`. */
export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  /** Corpo serializado como JSON (UTF-8). */
  json?: unknown;
  /** Corpo bruto (ex.: upload de arquivo), enviado como está. */
  rawBody?: Blob | string;
  signal?: AbortSignal;
}

export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
}

/** Monta um caminho a partir do template do endpoint, codificando cada parâmetro. */
export function buildPath(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Parâmetro de caminho ausente: ${name}`);
    }
    return encodeURIComponent(String(value));
  });
}

export function buildQuery(query: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
