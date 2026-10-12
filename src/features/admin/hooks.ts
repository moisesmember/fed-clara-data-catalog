import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/api/queryKeys";
import type { Page, SourceInput } from "@/api/types";
import { useServices } from "@/core/services";

export function useSources() {
  const { operations } = useServices();
  return useQuery({ queryKey: queryKeys.sources, queryFn: () => operations.sources() });
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

export function useSourceScopes(sourceId: string) {
  const { operations } = useServices();
  return useQuery({ queryKey: queryKeys.sourceScopes(sourceId), queryFn: () => operations.scopes(sourceId) });
}

/** Mudanças de escopo alteram a configuração da fonte: atualiza a lista de fontes e a visão de escopos. */
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
      mutationFn: (scope: { catalog: string; schema: string; domain: string; sync: boolean }) => operations.addScope(sourceId, scope),
      onSuccess: refresh,
    }),
    setDomain: useMutation({
      mutationFn: ({ scope, domain }: { scope: string; domain: string }) => operations.setScopeDomain(sourceId, scope, domain),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (scope: string) => operations.removeScope(sourceId, scope), onSuccess: refresh }),
    discover: useMutation({ mutationFn: (catalogs?: string[]) => operations.discover(sourceId, catalogs) }),
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
