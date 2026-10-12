import { useMutation, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/api/queryKeys";
import type { SearchMode } from "@/api/types";
import { useServices } from "@/core/services";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

export function useCatalogSearch(query: string, mode: SearchMode) {
  const { discovery } = useServices();
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.search(trimmed, mode),
    queryFn: () => discovery.search(trimmed, mode, 20),
    enabled: trimmed.length >= 2,
  });
}

/** Perguntas não são cacheadas: cada resposta é revalidada pelo backend no momento da entrega. */
export function useAskQuestion() {
  const { discovery } = useServices();
  return useMutation({
    mutationFn: ({ question, mode, allowClarification = true }: { question: string; mode: SearchMode; allowClarification?: boolean }) =>
      discovery.ask(question, mode, allowClarification),
  });
}

/** Mapa do catálogo (domínios -> assuntos -> fichas) para quem não sabe o que digitar. */
export function useCatalogBrowse() {
  const { discovery } = useServices();
  return useQuery({ queryKey: queryKeys.browse, queryFn: () => discovery.browse(), staleTime: 60_000 });
}

/** Sugestões enquanto a pessoa digita (nomes de negócio, sinônimos e glossário). */
export function useSuggestions(text: string) {
  const { discovery } = useServices();
  const debounced = useDebouncedValue(text.trim(), 200);
  return useQuery({
    queryKey: queryKeys.suggest(debounced),
    queryFn: () => discovery.suggest(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });
}

export function useFeedback() {
  const { discovery } = useServices();
  return useMutation({
    mutationFn: ({ question, helpful, mode }: { question: string; helpful: boolean; mode?: SearchMode }) => discovery.feedback(question, helpful, mode),
  });
}

export function useRequestHelp() {
  const { discovery } = useServices();
  return useMutation({
    mutationFn: ({ question, assetId }: { question: string; assetId?: number }) => discovery.requestHelp(question, assetId),
  });
}
