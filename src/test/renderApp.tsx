import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { AppProviders, createQueryClient } from "@/app/AppProviders";
import { routes } from "@/app/routes";
import { DevHeaderIdentity } from "@/core/auth/devHeaderIdentity";
import { createServices } from "@/core/services";

import { FakeHttpClient } from "./fakeHttpClient";

type Binding = [string, string, string];

export const BINDINGS: Record<string, Binding[]> = {
  "joao.consumidor": [["consumer", "financeiro", "*"]],
  "carlos.curador": [["curator", "financeiro", "*"]],
  "bia.aprovadora": [["approver", "financeiro", "*"]],
  "ana.admin": [["admin", "*", "*"]],
};

/** Renderiza a aplicação real (rotas, provedores, serviços) sobre um transporte falso. */
export function renderApp({ path, subject, http = new FakeHttpClient() }: { path: string; subject?: string; http?: FakeHttpClient }) {
  const identity = new DevHeaderIdentity(null);
  if (subject) {
    identity.signIn(subject);
    http.on("GET /me", { subject, bindings: BINDINGS[subject] ?? [] });
  }
  const services = createServices({ apiBase: "/api", authMode: "dev-header" }, identity, http);
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <AppProviders services={services} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, http, router, identity };
}
