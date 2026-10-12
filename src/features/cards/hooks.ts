import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/api/queryKeys";
import type { TrustStatus, Visibility } from "@/api/types";
import { useServices } from "@/core/services";

export function usePublishedCard(assetId: number) {
  const { discovery } = useServices();
  return useQuery({ queryKey: queryKeys.card(assetId), queryFn: () => discovery.card(assetId) });
}

/** Abre a edição da ficha (curadores). O backend devolve a tarefa nova ou a revisão já em andamento. */
export function useEditCard(assetId: number) {
  const { curation } = useServices();
  return useMutation({ mutationFn: () => curation.editCard(assetId) });
}

/** Ações do aprovador. Mudanças de visibilidade/confiança invalidam ficha, busca e ativo. */
export function useCardActions(assetId: number) {
  const { discovery } = useServices();
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.card(assetId) }),
      queryClient.invalidateQueries({ queryKey: ["search"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.asset(assetId) }),
    ]);
  };
  return {
    setVisibility: useMutation({
      mutationFn: (visibility: Visibility) => discovery.setVisibility(assetId, visibility),
      onSuccess: refresh,
    }),
    setTrust: useMutation({
      mutationFn: ({ status, notes }: { status: TrustStatus; notes?: string }) => discovery.setTrust(assetId, status, notes),
      onSuccess: refresh,
    }),
    retire: useMutation({
      mutationFn: (reason: string) => discovery.retire(assetId, reason),
      onSuccess: refresh,
    }),
  };
}
