import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { queryKeys } from "@/api/queryKeys";
import type { Job, JobStatus } from "@/api/types";
import { useServices } from "@/core/services";

export const TERMINAL_JOB_STATUSES: ReadonlySet<JobStatus> = new Set(["succeeded", "failed", "dead", "cancelled"]);

export function isTerminal(job: Job | undefined): boolean {
  return job !== undefined && TERMINAL_JOB_STATUSES.has(job.status);
}

/** Acompanha um job até um estado terminal (consulta periódica com recuo) e avisa uma única vez.
 *  Operações longas da API devolvem `job_id`; a UI nunca bloqueia esperando. */
export function useJobTracker(jobId: number | null, onSettled?: (job: Job) => void) {
  const { operations } = useServices();
  const settledFor = useRef<number | null>(null);
  const callback = useRef(onSettled);
  useEffect(() => {
    callback.current = onSettled; // sempre o callback mais recente, sem reiniciar o acompanhamento
  });

  const query = useQuery({
    queryKey: queryKeys.job(jobId ?? 0),
    queryFn: () => operations.job(jobId as number),
    enabled: jobId !== null,
    refetchInterval: (current) => {
      if (isTerminal(current.state.data)) return false;
      // 0,5 s nas primeiras consultas e depois 2 s: resposta rápida sem sobrecarregar a API.
      return current.state.dataUpdateCount < 10 ? 500 : 2000;
    },
  });

  useEffect(() => {
    const job = query.data;
    if (job && jobId !== null && isTerminal(job) && settledFor.current !== jobId) {
      settledFor.current = jobId;
      callback.current?.(job);
    }
  }, [query.data, jobId]);

  return { job: query.data, error: query.error, running: jobId !== null && !isTerminal(query.data) };
}
