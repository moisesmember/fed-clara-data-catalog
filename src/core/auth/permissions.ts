/** Espelho das políticas do backend (`domain/policies.py`) usado APENAS para orientar a UI
 *  (mostrar/ocultar ações). A autorização efetiva é sempre do backend. */
export type Role = "consumer" | "restricted_reader" | "curator" | "approver" | "admin";
export type Action = "read_published" | "read_metadata" | "curate" | "approve" | "admin";

export interface RoleBinding {
  role: Role;
  domain: string;
  sourceId: string;
}

const ANY = "*";

const ACTION_ROLES: Record<Action, Role[]> = {
  read_published: ["consumer", "restricted_reader", "curator", "approver"],
  read_metadata: ["curator", "approver"],
  curate: ["curator", "approver"],
  approve: ["approver"],
  admin: ["admin"],
};

export class Permissions {
  constructor(readonly bindings: RoleBinding[]) {}

  /** Converte o formato de `/me`: `[[role, domain, source_id], ...]`. */
  static fromMe(raw: [string, string, string][]): Permissions {
    return new Permissions(raw.map(([role, domain, sourceId]) => ({ role: role as Role, domain, sourceId })));
  }

  can(action: Action, domain?: string): boolean {
    return this.bindings.some(
      (binding) =>
        ACTION_ROLES[action].includes(binding.role) && (binding.domain === ANY || domain === undefined || binding.domain === domain),
    );
  }

  domainsFor(action: Action): string[] {
    return [...new Set(this.bindings.filter((b) => ACTION_ROLES[action].includes(b.role)).map((b) => b.domain))];
  }

  get roles(): Role[] {
    return [...new Set(this.bindings.map((b) => b.role))];
  }
}
