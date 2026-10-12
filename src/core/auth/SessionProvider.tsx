import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { queryKeys } from "@/api/queryKeys";
import { useServices } from "@/core/services";

import type { Session } from "./identity";
import { Permissions } from "./permissions";

interface SessionState {
  session: Session | null;
  /** Permissões vindas de `/me` (vazias enquanto carregam ou sem sessão). */
  permissions: Permissions;
  loading: boolean;
  error: unknown;
  signIn(subject: string): void;
  signOut(): void;
}

const SessionContext = createContext<SessionState | null>(null);
const EMPTY = new Permissions([]);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { identity, discovery } = useServices();
  const queryClient = useQueryClient();
  const session = useSyncExternalStore(
    (listener) => identity.subscribe(listener),
    () => identity.current(),
  );
  const me = useQuery({
    queryKey: queryKeys.me(session?.subject ?? ""),
    queryFn: () => discovery.me(),
    enabled: session !== null,
    staleTime: 60_000,
  });

  const signIn = useCallback(
    (subject: string) => {
      queryClient.clear(); // caches são por identidade: nada vaza entre usuários
      identity.signIn(subject);
    },
    [identity, queryClient],
  );
  const signOut = useCallback(() => {
    queryClient.clear();
    identity.signOut();
  }, [identity, queryClient]);

  const value = useMemo<SessionState>(
    () => ({
      session,
      permissions: me.data ? Permissions.fromMe(me.data.bindings) : EMPTY,
      loading: session !== null && me.isPending,
      error: me.error,
      signIn,
      signOut,
    }),
    [session, me.data, me.isPending, me.error, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const state = useContext(SessionContext);
  if (!state) {
    throw new Error("useSession deve ser usado dentro de <SessionProvider>");
  }
  return state;
}
