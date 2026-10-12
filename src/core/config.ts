export type AuthMode = "dev-header";

export interface AppConfig {
  /** Prefixo da API na mesma origem (o proxy do Vite/Nginx encaminha ao backend). */
  apiBase: string;
  authMode: AuthMode;
}

export function readConfig(env: ImportMetaEnv = import.meta.env): AppConfig {
  const authMode = env.VITE_AUTH_MODE ?? "dev-header";
  if (authMode !== "dev-header") {
    // Falha fechada: não há provedor implementado para outros modos.
    throw new Error(`Modo de identidade não suportado: ${authMode}`);
  }
  return { apiBase: (env.VITE_API_BASE ?? "/api").replace(/\/$/, ""), authMode };
}
