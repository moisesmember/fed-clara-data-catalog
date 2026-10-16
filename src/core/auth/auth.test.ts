import { describe, expect, it, vi } from "vitest";

import { visibleNavigation } from "@/app/navigation";

import { DevHeaderIdentity, type KeyValueStorage } from "./devHeaderIdentity";
import { Permissions } from "./permissions";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("DevHeaderIdentity", () => {
  it("envia X-Clara-User só com sessão, persiste e notifica", () => {
    const storage = memoryStorage();
    const identity = new DevHeaderIdentity(storage);
    const listener = vi.fn();
    identity.subscribe(listener);
    expect(identity.authHeaders()).toEqual({});
    identity.signIn("  bia.aprovadora ");
    expect(identity.authHeaders()).toEqual({ "X-Clara-User": "bia.aprovadora" });
    expect(new DevHeaderIdentity(storage).current()).toEqual({ subject: "bia.aprovadora" });
    identity.signOut();
    expect(storage.data.size).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("recusa identificadores inválidos (cabeçalho não aceita qualquer texto)", () => {
    const identity = new DevHeaderIdentity(null);
    expect(() => identity.signIn("joão consumidor")).toThrow();
    expect(() => identity.signIn("a\r\nX-Injected: 1")).toThrow();
    expect(identity.current()).toBeNull();
  });

  it("funciona sem armazenamento disponível", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => undefined,
    };
    const identity = new DevHeaderIdentity(broken);
    identity.signIn("ana.admin");
    expect(identity.current()).toEqual({ subject: "ana.admin" });
  });
});

describe("Permissions (espelho das políticas do backend, só para a UI)", () => {
  it("respeita papel e domínio", () => {
    const curator = Permissions.fromMe([["curator", "financeiro", "*"]]);
    expect(curator.can("curate", "financeiro")).toBe(true);
    expect(curator.can("curate", "rh")).toBe(false);
    expect(curator.can("approve", "financeiro")).toBe(false);
    expect(curator.can("read_metadata")).toBe(true);
    const admin = Permissions.fromMe([["admin", "*", "*"]]);
    expect(admin.can("admin")).toBe(true);
    expect(admin.can("read_metadata", "financeiro")).toBe(false);
  });

  it("navegação mostra só o que faz sentido para o papel", () => {
    const labels = (raw: [string, string, string][]) =>
      visibleNavigation(Permissions.fromMe(raw)).flatMap((group) => group.items.map((item) => item.to));
    expect(labels([["consumer", "financeiro", "*"]])).toEqual(["/explorar"]);
    expect(labels([["curator", "financeiro", "*"]])).toEqual(["/explorar", "/governanca", "/curadoria", "/curadoria/demandas", "/ativos"]);
    expect(labels([["admin", "*", "*"]])).toEqual(["/governanca", "/admin/fontes", "/admin/auditoria", "/admin/metricas"]);
  });
});
