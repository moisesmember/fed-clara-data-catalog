import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AssetFilters } from "@/api/assetsApi";
import { queryKeys } from "@/api/queryKeys";
import type { Page } from "@/api/types";
import { useServices } from "@/core/services";

export function useAssetList(filters: AssetFilters, page: Page) {
  const { assets } = useServices();
  return useQuery({ queryKey: queryKeys.assets(filters, page), queryFn: () => assets.list(filters, page), placeholderData: keepPreviousData });
}

export function useAsset(assetId: number) {
  const { assets } = useServices();
  return useQuery({ queryKey: queryKeys.asset(assetId), queryFn: () => assets.get(assetId) });
}

export function useAssetVersions(assetId: number) {
  const { assets } = useServices();
  return useQuery({ queryKey: queryKeys.assetVersions(assetId), queryFn: () => assets.versions(assetId) });
}

export function useAssetVersion(assetId: number, versionNo: number | null) {
  const { assets } = useServices();
  return useQuery({
    queryKey: queryKeys.assetVersion(assetId, versionNo ?? 0),
    queryFn: () => assets.version(assetId, versionNo as number),
    enabled: versionNo !== null,
  });
}

export function useFlagSemanticChange(assetId: number) {
  const { assets } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => assets.flagSemanticChange(assetId, reason),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.asset(assetId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot }),
      ]),
  });
}
