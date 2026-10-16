import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/api/queryKeys";
import { useServices } from "@/core/services";

/** Ao trocar o período, o painel mantém os números anteriores (esmaecidos) até chegar o novo recorte. */
export function useGovernanceDashboard(days: number) {
  const { operations } = useServices();
  return useQuery({
    queryKey: queryKeys.governanceDashboard(days),
    queryFn: () => operations.governanceDashboard(days),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
