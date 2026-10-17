import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/api/queryKeys";
import type { GenieSpaceInput, Page, ScopeChanges, ScopeInput, ScopesOverview, SourceInput, SourceSummary } from "@/api/types";
import { useServices } from "@/core/services";

/** Fonte Databricks recém-cadastrada que ainda espera a listagem de SQL Warehouses. */
function connecting(source: SourceSummary): boolean {
  return source.kind === "databricks_sql" && !source.http_path && !source.warehouses;
}

/** Espera pelos jobs automáticos com limite (~2 min): fonte que nunca foi descoberta não fica
 *  consultando o backend para sempre; "Descobrir na origem" acompanha o job explicitamente. */
const MAX_POLLS = 40;

/** Enquanto a Clara conecta uma fonte nova (job em segundo plano), a lista se atualiza sozinha. */
export function useSources() {
  const { operations } = useServices();
  return useQuery({
    queryKey: queryKeys.sources,
    queryFn: () => operations.sources(),
    refetchInterval: (query) => (query.state.data?.some(connecting) && query.state.dataUpdateCount < MAX_POLLS ? 3000 : false),
  });
}

export function useCreateSource() {
  const { operations } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source: SourceInput) => operations.createSource(source),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sources, exact: true }),
  });
}

export function useSyncRuns(sourceId: string, page: Page) {
  const { operations } = useServices();
  return useQuery({ queryKey: queryKeys.syncRuns(sourceId, page), queryFn: () => operations.syncRuns(sourceId, page), placeholderData: keepPreviousData });
}

/** Ações sobre uma fonte. Todas devolvem `job_id`, acompanhado pelo chamador. */
export function useSourceActions(sourceId: string) {
  const { operations } = useServices();
  return {
    test: useMutation({ mutationFn: () => operations.testSource(sourceId) }),
    sync: useMutation({ mutationFn: (scopes?: string[]) => operations.syncSource(sourceId, scopes) }),
    importFile: useMutation({ mutationFn: (file: File) => operations.importFile(sourceId, file) }),
  };
}

/** Com o warehouse definido e a primeira descoberta ainda em curso, a árvore se atualiza sozinha. */
function awaitingDiscovery(overview: ScopesOverview | undefined): boolean {
  return Boolean(overview?.http_path && !overview.discovered_at);
}

export function useSourceScopes(sourceId: string) {
  const { operations } = useServices();
  return useQuery({
    queryKey: queryKeys.sourceScopes(sourceId),
    queryFn: () => operations.scopes(sourceId),
    refetchInterval: (query) => (awaitingDiscovery(query.state.data) && query.state.dataUpdateCount < MAX_POLLS ? 3000 : false),
  });
}

export function useDiscoveredObjects(sourceId: string, catalog: string, schema: string) {
  const { operations } = useServices();
  return useQuery({
    queryKey: queryKeys.sourceObjects(sourceId, catalog, schema),
    queryFn: () => operations.discoveredObjects(sourceId, catalog, schema),
  });
}

/** Escolha do SQL Warehouse: muda a fonte e dispara teste + descoberta no backend. */
export function useWarehouseActions(sourceId: string) {
  const { operations } = useServices();
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.sources, exact: true }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceScopes(sourceId) }),
    ]);
  return {
    choose: useMutation({ mutationFn: (warehouseId: string) => operations.setWarehouse(sourceId, warehouseId), onSuccess: refresh }),
    refresh: useMutation({ mutationFn: () => operations.refreshWarehouses(sourceId) }),
  };
}

/** Mudanças de seleção alteram a configuração da fonte: atualiza a lista de fontes e a árvore
 *  (inclusive as listas de objetos, cujo `selected` depende da seleção). */
export function useScopeActions(sourceId: string) {
  const { operations } = useServices();
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.sources, exact: true }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceScopes(sourceId) }),
    ]);
  return {
    add: useMutation({
      mutationFn: (scope: ScopeInput & { sync: boolean }) => operations.addScope(sourceId, scope),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ scope, changes }: { scope: string; changes: ScopeChanges }) => operations.updateScope(sourceId, scope, changes),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (scope: string) => operations.removeScope(sourceId, scope), onSuccess: refresh }),
    discover: useMutation({ mutationFn: (catalogs?: string[]) => operations.discover(sourceId, catalogs) }),
  };
}

export function useGenieSpaces(sourceId: string) {
  const { operations } = useServices();
  return useQuery({ queryKey: queryKeys.genieSpaces(sourceId), queryFn: () => operations.genieSpaces(sourceId) });
}

export function useGenieCoverage(sourceId: string) {
  const { operations } = useServices();
  return useQuery({ queryKey: queryKeys.genieCoverage(sourceId), queryFn: () => operations.genieCoverage(sourceId) });
}

/** Mudanças nos espaços (e a releitura deles) atualizam a lista e a cobertura. */
export function useGenieActions(sourceId: string) {
  const { operations } = useServices();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.genieSpaces(sourceId) });
  return {
    add: useMutation({ mutationFn: (space: GenieSpaceInput) => operations.addGenieSpace(sourceId, space), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (genieId: number) => operations.removeGenieSpace(sourceId, genieId), onSuccess: refresh }),
    reload: useMutation({ mutationFn: () => operations.refreshGenie(sourceId) }),
  };
}

export function useAuditEvents(filters: { entityType?: string; entityId?: string }, page: Page) {
  const { operations } = useServices();
  return useQuery({ queryKey: queryKeys.audit(filters, page), queryFn: () => operations.audit(filters, page), placeholderData: keepPreviousData });
}

export function useGraphMetrics(graph: "curation" | "answer" | undefined, sinceHours: number) {
  const { operations } = useServices();
  return useQuery({ queryKey: queryKeys.graphMetrics(graph, sinceHours), queryFn: () => operations.graphMetrics(graph, sinceHours) });
}
