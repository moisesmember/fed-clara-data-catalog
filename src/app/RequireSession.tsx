import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { useSession } from "@/core/auth/SessionProvider";

/** Sem identidade, envia para a tela de entrada e volta ao destino depois. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}
