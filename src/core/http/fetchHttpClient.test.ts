import { describe, expect, it, vi } from "vitest";

import { ApiError, describeError } from "./apiError";
import { FetchHttpClient } from "./fetchHttpClient";
import { buildPath, buildQuery } from "./httpClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("buildPath / buildQuery", () => {
  it("codifica parâmetros de caminho e omite filtros vazios", () => {
    expect(buildPath("/cards/{asset_id}", { asset_id: 5 })).toBe("/cards/5");
    expect(buildPath("/x/{id}", { id: "a/b c" })).toBe("/x/a%2Fb%20c");
    expect(() => buildPath("/x/{id}")).toThrow("id");
    expect(buildQuery({ q: "empréstimo", mode: undefined, page: 1, status: "" })).toBe("?q=empr%C3%A9stimo&page=1");
  });
});

describe("FetchHttpClient", () => {
  it("envia identidade e JSON em UTF-8 (acentos não quebram o corpo)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = new FetchHttpClient("/api", () => ({ "X-Clara-User": "joao.consumidor" }), fetchMock);
    await client.post("/ask", { json: { question: "onde estão os empréstimos?" } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/ask");
    expect(init.headers).toMatchObject({ "X-Clara-User": "joao.consumidor", "Content-Type": "application/json; charset=utf-8" });
    expect(JSON.parse(init.body as string)).toEqual({ question: "onde estão os empréstimos?" });
  });

  it("normaliza erros de domínio com motivos de bloqueio", async () => {
    const body = { error: "publication_blocked", detail: "x", reasons: ["responsável não confirmado"] };
    const client = new FetchHttpClient("/api", () => ({}), vi.fn().mockResolvedValue(jsonResponse(422, body)));
    const error = await client.post("/curation/tasks/1/publish").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).reasons).toEqual(["responsável não confirmado"]);
    expect(describeError(error)).toContain("responsável não confirmado");
  });

  it("normaliza erros de validação do FastAPI", async () => {
    const body = { detail: [{ loc: ["body", 0], msg: "JSON decode error" }] };
    const client = new FetchHttpClient("/api", () => ({}), vi.fn().mockResolvedValue(jsonResponse(422, body)));
    const error = (await client.post("/x").catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("validation_failed");
    expect(error.message).toBe("JSON decode error");
  });

  it("traduz conflito, autorização e falha de rede para mensagens claras", () => {
    expect(describeError(new ApiError(409, "conflict", "rascunho mudou"))).toMatch(/mudou desde que você o abriu/);
    expect(describeError(new ApiError(403, "forbidden", "x"))).toMatch(/permissão/);
    expect(describeError(new TypeError("Failed to fetch"))).toMatch(/backend/);
  });
});
