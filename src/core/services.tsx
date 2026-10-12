import { createContext, useContext, type ReactNode } from "react";

import { createAssetsApi, type AssetsApi } from "@/api/assetsApi";
import { createCurationApi, type CurationApi } from "@/api/curationApi";
import { createDiscoveryApi, type DiscoveryApi } from "@/api/discoveryApi";
import { createKnowledgeApi, type KnowledgeApi } from "@/api/knowledgeApi";
import { createOperationsApi, type OperationsApi } from "@/api/operationsApi";

import type { IdentityProvider } from "./auth/identity";
import type { AppConfig } from "./config";
import { FetchHttpClient } from "./http/fetchHttpClient";
import type { HttpClient } from "./http/httpClient";

/** Raiz de composição: o único lugar que conhece as implementações concretas. */
export interface Services {
  identity: IdentityProvider;
  discovery: DiscoveryApi;
  curation: CurationApi;
  assets: AssetsApi;
  operations: OperationsApi;
  knowledge: KnowledgeApi;
}

export function createServices(config: AppConfig, identity: IdentityProvider, http?: HttpClient): Services {
  const client = http ?? new FetchHttpClient(config.apiBase, () => identity.authHeaders());
  return {
    identity,
    discovery: createDiscoveryApi(client),
    curation: createCurationApi(client),
    assets: createAssetsApi(client),
    operations: createOperationsApi(client),
    knowledge: createKnowledgeApi(client),
  };
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error("useServices deve ser usado dentro de <ServicesProvider>");
  }
  return services;
}
