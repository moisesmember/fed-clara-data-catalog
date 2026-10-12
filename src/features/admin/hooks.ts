import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/api/queryKeys";
import type { Page } from "@/api/types";
import { useServices } from "@/core/services";

export function useSources() {
  const { operations } = useServices();
  return useQuery({ queryKey: queryKeys.sources, queryFn: () => operations.sources() });
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

export function useAuditEvents(filters: { entityType?: string; entityId?: string }, page: Page) {
  const { operations } = useServices();
  return useQuery({ queryKey: queryKeys.audit(filters, page), queryFn: () => operations.audit(filters, page), placeholderData: keepPreviousData });
}

export function useGraphMetrics(graph: "curation" | "answer" | undefined, sinceHours: number) {
  const { operations } = useServices();
  return useQuery({ queryKey: queryKeys.graphMetrics(graph, sinceHours), queryFn: () => operations.graphMetrics(graph, sinceHours) });
}
