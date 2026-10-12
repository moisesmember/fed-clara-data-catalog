import type { HttpClient, RequestOptions } from "@/core/http/httpClient";

export interface RecordedCall {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  options: RequestOptions;
}

type Handler = (call: RecordedCall) => unknown;

/** Transporte falso: responde por "MÉTODO /caminho" e registra as chamadas.
 *  Os serviços de API reais rodam sobre ele (só o transporte é substituído). */
export class FakeHttpClient implements HttpClient {
  readonly calls: RecordedCall[] = [];
  private readonly handlers: Record<string, Handler>;

  constructor(handlers: Record<string, Handler | unknown> = {}) {
    this.handlers = Object.fromEntries(
      Object.entries(handlers).map(([key, value]) => [key, typeof value === "function" ? (value as Handler) : () => value]),
    );
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.handle<T>({ method: "GET", path, options });
  }

  post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.handle<T>({ method: "POST", path, options });
  }

  patch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.handle<T>({ method: "PATCH", path, options });
  }

  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.handle<T>({ method: "DELETE", path, options });
  }

  on(key: string, handler: Handler | unknown): void {
    this.handlers[key] = typeof handler === "function" ? (handler as Handler) : () => handler;
  }

  callsTo(method: RecordedCall["method"], path: string): RecordedCall[] {
    return this.calls.filter((call) => call.method === method && call.path === path);
  }

  private async handle<T>(call: RecordedCall): Promise<T> {
    this.calls.push(call);
    const handler = this.handlers[`${call.method} ${call.path}`];
    if (!handler) {
      throw new Error(`Rota não simulada: ${call.method} ${call.path}`);
    }
    const result = handler(call);
    if (result instanceof Error) throw result;
    return result as T;
  }
}
