import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TaskFilters } from "@/api/curationApi";
import { queryKeys } from "@/api/queryKeys";
import type { Page, ReviewSubmission } from "@/api/types";
import { useServices } from "@/core/services";

import { isCardEdit } from "./taskKinds";

export function useTaskQueue(filters: TaskFilters, page: Page) {
  const { curation } = useServices();
  return useQuery({
    queryKey: queryKeys.tasks(filters, page),
    queryFn: () => curation.list(filters, page),
    placeholderData: keepPreviousData,
  });
}

export function useTask(taskId: number) {
  const { curation } = useServices();
  return useQuery({
    queryKey: queryKeys.task(taskId),
    queryFn: () => curation.get(taskId),
    // Enquanto o worker prepara o rascunho, acompanha a tarefa até ela aguardar revisão.
    refetchInterval: (query) => {
      const data = query.state.data;
      const preparing = data?.status === "generating" || (data?.status === "open" && isCardEdit(data.kind));
      return preparing ? 1500 : false;
    },
  });
}

export function useRefreshTask(taskId: number) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot }),
      queryClient.invalidateQueries({ queryKey: ["search"] }),
    ]);
}

export function useStartTask(taskId: number) {
  const { curation } = useServices();
  return useMutation({ mutationFn: () => curation.start(taskId) });
}

export function useSubmitReview(taskId: number) {
  const { curation } = useServices();
  return useMutation({ mutationFn: (submission: ReviewSubmission) => curation.review(taskId, submission) });
}

export function usePublishTask(taskId: number) {
  const { curation } = useServices();
  return useMutation({ mutationFn: () => curation.publish(taskId) });
}
