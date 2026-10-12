/** Contrato de identidade. A UI não sabe se a identidade vem de um cabeçalho de desenvolvimento
 *  ou de OIDC: troca-se o provedor sem tocar nas telas. */
export interface Session {
  subject: string;
}

export interface IdentityProvider {
  readonly kind: string;
  current(): Session | null;
  signIn(subject: string): void;
  signOut(): void;
  /** Cabeçalhos que autenticam cada requisição. */
  authHeaders(): Record<string, string>;
  subscribe(listener: (session: Session | null) => void): () => void;
}
