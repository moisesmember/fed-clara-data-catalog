import type { IdentityProvider, Session } from "./identity";

const SUBJECT_PATTERN = /^[A-Za-z0-9._@-]{1,200}$/;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Identidade simulada do backend em dev/test: cabeçalho `X-Clara-User`. Os papéis NÃO vêm do
 *  cabeçalho — o backend os carrega de `role_bindings`. Fora de dev/test o backend recusa. */
export class DevHeaderIdentity implements IdentityProvider {
  readonly kind = "dev-header";
  private session: Session | null;
  private readonly listeners = new Set<(session: Session | null) => void>();
  private readonly storage: KeyValueStorage | null;
  private readonly storageKey: string;

  constructor(storage: KeyValueStorage | null, storageKey = "clara.devSubject") {
    this.storage = storage;
    this.storageKey = storageKey;
    this.session = this.restore();
  }

  current(): Session | null {
    return this.session;
  }

  signIn(subject: string): void {
    const trimmed = subject.trim();
    if (!SUBJECT_PATTERN.test(trimmed)) {
      throw new Error("Identificador inválido: use letras, números, ponto, hífen, sublinhado ou @.");
    }
    this.session = { subject: trimmed };
    this.persist(trimmed);
    this.emit();
  }

  signOut(): void {
    this.session = null;
    this.persist(null);
    this.emit();
  }

  authHeaders(): Record<string, string> {
    return this.session ? { "X-Clara-User": this.session.subject } : {};
  }

  subscribe(listener: (session: Session | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.session));
  }

  private restore(): Session | null {
    try {
      const subject = this.storage?.getItem(this.storageKey);
      return subject && SUBJECT_PATTERN.test(subject) ? { subject } : null;
    } catch {
      return null; // armazenamento indisponível (modo privado, bloqueio)
    }
  }

  private persist(subject: string | null): void {
    try {
      if (subject) {
        this.storage?.setItem(this.storageKey, subject);
      } else {
        this.storage?.removeItem(this.storageKey);
      }
    } catch {
      // sem persistência: a sessão vale até recarregar a página
    }
  }
}
