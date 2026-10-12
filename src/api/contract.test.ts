/** Teste de contrato contra o `openapi.json` real do backend.
 *  Rode com o backend no ar:  CLARA_API_URL=http://127.0.0.1:8000 npm run contract
 *  Sem a variável, é ignorado (os testes unitários não dependem do backend). */
import { describe, expect, it } from "vitest";

import { endpoints } from "./endpoints";
import { CHANGE_KINDS, CLAIM_STATUSES, REVIEW_DECISIONS, TRUST_STATUSES, VISIBILITIES } from "./types";

const apiUrl = process.env.CLARA_API_URL;

interface OpenApi {
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, { enum?: string[]; properties?: Record<string, unknown> }> };
}

describe.skipIf(!apiUrl)("contrato com o backend (openapi.json)", () => {
  const load = async (): Promise<OpenApi> => {
    const response = await fetch(`${apiUrl}/openapi.json`);
    expect(response.ok).toBe(true);
    return (await response.json()) as OpenApi;
  };

  it("todo endpoint consumido existe com o mesmo método", async () => {
    const spec = await load();
    const missing = Object.entries(endpoints)
      .filter(([, endpoint]) => !spec.paths[endpoint.path]?.[endpoint.method.toLowerCase()])
      .map(([name, endpoint]) => `${name}: ${endpoint.method} ${endpoint.path}`);
    expect(missing).toEqual([]);
  });

  it("enums usados pela UI coincidem com os do backend", async () => {
    const { schemas } = (await load()).components;
    expect([...VISIBILITIES].sort()).toEqual([...(schemas.Visibility?.enum ?? [])].sort());
    expect([...TRUST_STATUSES].sort()).toEqual([...(schemas.TrustStatus?.enum ?? [])].sort());
    expect([...REVIEW_DECISIONS].sort()).toEqual([...(schemas.ReviewDecision?.enum ?? [])].sort());
    expect([...CHANGE_KINDS].sort()).toEqual([...(schemas.ChangeKind?.enum ?? [])].sort());
    expect([...CLAIM_STATUSES].sort()).toEqual([...(schemas.ClaimStatus?.enum ?? [])].sort());
  });

  it("campos enviados na revisão existem em ReviewSubmission", async () => {
    const props = Object.keys((await load()).components.schemas.ReviewSubmission?.properties ?? {});
    const sent = ["decision", "expected_draft_revision", "expected_asset_version_id", "edits", "confirmed_owner", "visibility", "limitations_none_known", "change_kind", "notes", "publish"];
    expect(sent.filter((field) => !props.includes(field))).toEqual([]);
  });
});
