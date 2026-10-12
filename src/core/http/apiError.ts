/** Erro da API normalizado a partir dos formatos do backend:
 *  - erros de domínio: `{ "error": "conflict", "detail": "...", "reasons"?: [...] }`
 *  - validação do FastAPI: `{ "detail": [{ "loc": [...], "msg": "..." }] }` */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly reasons: string[];

  constructor(status: number, code: string, message: string, reasons: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.reasons = reasons;
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // corpo vazio ou não-JSON
    }
    if (isRecord(body)) {
      if (Array.isArray(body.detail)) {
        const messages = body.detail.map((item) => (isRecord(item) ? String(item.msg ?? "") : String(item))).filter(Boolean);
        return new ApiError(response.status, "validation_failed", messages.join("; ") || "Dados inválidos.");
      }
      const reasons = Array.isArray(body.reasons) ? body.reasons.map(String) : [];
      const code = typeof body.error === "string" ? body.error : `http_${response.status}`;
      const detail = typeof body.detail === "string" ? body.detail : response.statusText;
      return new ApiError(response.status, code, detail, reasons);
    }
    return new ApiError(response.status, `http_${response.status}`, response.statusText || "Erro na API.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Mensagem para a pessoa usuária, sem jargão técnico. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return "Sessão não identificada. Entre novamente.";
      case 403:
        return "Você não tem permissão para esta ação.";
      case 404:
        return "Não encontrado ou sem permissão de acesso.";
      case 409:
        return `O conteúdo mudou desde que você o abriu. Recarregue e tente de novo. (${error.message})`;
      case 422:
        return error.reasons.length ? `Não foi possível concluir: ${error.reasons.join("; ")}` : `Dados inválidos: ${error.message}`;
      case 429:
        return "O serviço está ocupado. Aguarde alguns segundos e tente novamente.";
      case 504:
        return "A operação demorou demais. Tente novamente.";
      default:
        return error.status >= 500 ? "Falha no servidor. Tente novamente em instantes." : error.message;
    }
  }
  if (error instanceof TypeError) {
    return "Não foi possível conectar à API. Verifique se o backend está em execução.";
  }
  return error instanceof Error ? error.message : "Erro inesperado.";
}
