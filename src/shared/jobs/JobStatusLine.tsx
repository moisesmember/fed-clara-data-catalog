import { useState } from "react";

import type { Job } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { useServices } from "@/core/services";
import { Button } from "@/shared/ui/primitives";
import { Spinner } from "@/shared/ui/states";
import { JobStatusBadge } from "@/shared/ui/statusBadges";

/** Linha de acompanhamento de um job em andamento, com cancelamento. */
export function JobStatusLine({ job, label }: { job: Job | undefined; label: string }) {
  const { operations } = useServices();
  const [cancelError, setCancelError] = useState<string | null>(null);
  if (!job) {
    return (
      <div className="cluster small muted" role="status">
        <Spinner label="" /> {label}: enviando…
      </div>
    );
  }
  const active = job.status === "pending" || job.status === "running";
  return (
    <div className="stack-sm" role="status" aria-live="polite">
      <div className="cluster small">
        {active ? <Spinner label="" /> : null}
        <span>{label}</span>
        <JobStatusBadge status={job.status} />
        <span className="muted xsmall">
          job #{job.id} · tentativa {job.attempts}/{job.max_attempts}
        </span>
        {active && !job.cancel_requested ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => operations.cancelJob(job.id).catch((error: unknown) => setCancelError(describeError(error)))}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
      {job.last_error ? <span className="xsmall" style={{ color: "var(--danger)" }}>{job.last_error}</span> : null}
      {cancelError ? <span className="xsmall" style={{ color: "var(--danger)" }}>{cancelError}</span> : null}
    </div>
  );
}
