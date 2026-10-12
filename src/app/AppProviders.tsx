import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ApiError } from "@/core/http/apiError";
import { SessionProvider } from "@/core/auth/SessionProvider";
import { ServicesProvider, type Services } from "@/core/services";
import { NotificationsProvider } from "@/shared/ui/notifications";

/** Não repete erros que não mudam com nova tentativa (4xx); repete pouco os transitórios. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500 && error.status !== 429) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 15_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export function AppProviders({ services, queryClient, children }: { services: Services; queryClient?: QueryClient; children: ReactNode }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <ServicesProvider services={services}>
      <QueryClientProvider client={client}>
        <NotificationsProvider>
          <SessionProvider>{children}</SessionProvider>
        </NotificationsProvider>
      </QueryClientProvider>
    </ServicesProvider>
  );
}
