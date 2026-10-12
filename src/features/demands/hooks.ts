import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/api/queryKeys";
import { useServices } from "@/core/services";

export function useUnanswered(days: number) {
  const { knowledge } = useServices();
  return useQuery({ queryKey: queryKeys.unanswered(days), queryFn: () => knowledge.unanswered(days) });
}

export function useHelpRequests(status: "open" | "resolved") {
  const { knowledge } = useServices();
  return useQuery({ queryKey: queryKeys.helpRequests(status), queryFn: () => knowledge.helpRequests(status) });
}

export function useGlossary() {
  const { knowledge } = useServices();
  return useQuery({ queryKey: queryKeys.glossary, queryFn: () => knowledge.glossary() });
}

/** Mudar o glossário afeta busca, sugestões e respostas: invalida tudo que depende dele. */
function useGlossaryInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.glossary }),
      queryClient.invalidateQueries({ queryKey: ["search"] }),
      queryClient.invalidateQueries({ queryKey: ["suggest"] }),
    ]);
}

export function useSaveTerm() {
  const { knowledge } = useServices();
  const invalidate = useGlossaryInvalidation();
  return useMutation({
    mutationFn: ({ domain, term, expansions }: { domain: string; term: string; expansions: string[] }) => knowledge.saveTerm(domain, term, expansions),
    onSuccess: invalidate,
  });
}

export function useDeleteTerm() {
  const { knowledge } = useServices();
  const invalidate = useGlossaryInvalidation();
  return useMutation({ mutationFn: (termId: number) => knowledge.deleteTerm(termId), onSuccess: invalidate });
}

export function useResolveHelp() {
  const { knowledge } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, note }: { requestId: number; note: string }) => knowledge.resolveHelp(requestId, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["help-requests"] }),
  });
}
