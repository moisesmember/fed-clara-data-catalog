import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { queryKeys } from "@/api/queryKeys";
import type { Job, ReviewSubmission, TaskDetail } from "@/api/types";
import { useSession } from "@/core/auth/SessionProvider";
import { ApiError, describeError } from "@/core/http/apiError";
import { useServices } from "@/core/services";
import { formatDuration } from "@/shared/format";
import { JobStatusLine } from "@/shared/jobs/JobStatusLine";
import { useJobTracker } from "@/shared/jobs/useJobTracker";
import { useNotify } from "@/shared/ui/notifications";
import { Badge, Button, PageHeader, Panel } from "@/shared/ui/primitives";
import { Alert, EmptyState, QueryView, Skeleton } from "@/shared/ui/states";
import { TaskStatusBadge, decisionLabel, jobStatusLabel, taskStatusLabel } from "@/shared/ui/statusBadges";

import { DraftView, EvidencePanel } from "./DraftView";
import { usePublishTask, useRefreshTask, useStartTask, useSubmitReview, useTask } from "./hooks";
import { ReviewPanel } from "./ReviewPanel";
import { isCardEdit, taskKindLabel } from "./taskKinds";
import "./curation.css";

const OUTCOME_MESSAGES: Record<string, string> = {
  awaiting_review: "Rascunho pronto para revisão.",
  published: "Ficha publicada.",
  approved: "Aprovado (publicação pendente).",
  publication_blocked: "Publicação bloqueada: verifique os requisitos.",
  rejected: "Tarefa rejeitada.",
  already_started: "A curadoria já estava em andamento.",
};

export function TaskReviewPage() {
  const taskId = Number(useParams().taskId);
  const task = useTask(taskId);
  return <QueryView query={task} skeletonLines={10}>{(data) => <TaskReview task={data} />}</QueryView>;
}

function TaskReview({ task }: { task: TaskDetail }) {
  const { assets } = useServices();
  const { permissions, loading: permissionsLoading } = useSession();
  const notify = useNotify();
  const refresh = useRefreshTask(task.id);
  const start = useStartTask(task.id);
  const review = useSubmitReview(task.id);
  const publish = usePublishTask(task.id);
  const [activeJob, setActiveJob] = useState<{ id: number; label: string } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const asset = useQuery({ queryKey: queryKeys.asset(task.asset_id), queryFn: () => assets.get(task.asset_id) });

  const tracker = useJobTracker(activeJob?.id ?? null, (job: Job) => {
    void refresh();
    const outcome = typeof job.result?.outcome === "string" ? job.result.outcome : null;
    const blockers = Array.isArray(job.result?.blockers) ? (job.result.blockers as string[]) : [];
    if (job.status === "succeeded") {
      notify(blockers.length ? "danger" : "success", outcome ? `${OUTCOME_MESSAGES[outcome] ?? outcome}${blockers.length ? ` ${blockers.join("; ")}` : ""}` : "Concluído.");
    } else {
      notify("danger", `A operação terminou como “${jobStatusLabel(job.status)}”. ${job.last_error ?? ""}`);
    }
    setActiveJob(null);
  });

  const canApprove = permissions.can("approve", task.domain);
  const reviewable = task.status === "awaiting_review" || task.status === "publication_blocked";
  const cardEdit = isCardEdit(task.kind);
  // Edição de ficha é iniciada pelo próprio backend; só uma falha pede reinício manual.
  const startable = cardEdit ? task.status === "failed" : task.status === "open" || task.status === "failed";

  const startCuration = () =>
    start.mutate(undefined, {
      onSuccess: ({ job_id }) => setActiveJob({ id: job_id, label: "Gerando rascunho" }),
      onError: (error) => notify("danger", describeError(error)),
    });

  const submitReview = (submission: ReviewSubmission) => {
    setConflict(null);
    review.mutate(submission, {
      onSuccess: ({ job_id }) => setActiveJob({ id: job_id, label: "Aplicando decisão" }),
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          setConflict(describeError(error));
          void refresh();
        } else {
          notify("danger", describeError(error));
        }
      },
    });
  };

  return (
    <>
      <PageHeader
        eyebrow={`Curadoria · tarefa #${task.id}`}
        title={asset.data ? <code>{asset.data.fqn}</code> : `Ativo #${task.asset_id}`}
        subtitle={
          <span className="cluster">
            <Badge>{task.domain}</Badge>
            <span>{taskKindLabel(task.kind)}</span>
            <span>· rodadas de revisão: {task.review_rounds}</span>
            <span>· regenerações: {task.regenerations}</span>
            {task.human_wait_ms ? <span>· espera humana acumulada: {formatDuration(task.human_wait_ms)}</span> : null}
          </span>
        }
        actions={
          <>
            <TaskStatusBadge status={task.status} />
            <Link to={`/ativos/${task.asset_id}`} className="small">
              Metadados técnicos →
            </Link>
          </>
        }
      />

      {activeJob ? <JobStatusLine job={tracker.job} label={activeJob.label} /> : null}
      {conflict ? <Alert tone="warning">{conflict}</Alert> : null}
      {task.last_error ? <Alert tone={task.status === "publication_blocked" ? "warning" : "danger"}>{task.last_error}</Alert> : null}
      {task.open_pendencies.length ? (
        <Panel title="Pendências abertas">
          <ul className="issues">
            {task.open_pendencies.map((pendency) => (
              <li key={`${pendency.code}-${pendency.id ?? pendency.message}`} className="cluster small">
                <Badge tone={pendency.blocking ? "danger" : "warning"}>{pendency.blocking ? "Bloqueia publicação" : "Atenção"}</Badge>
                <span>{pendency.message}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {!task.draft ? (
        <Panel>
          <EmptyState
            title={startable ? "Ainda não há rascunho" : "Rascunho em geração"}
            action={
              startable ? (
                <Button variant="primary" onClick={startCuration} loading={start.isPending || tracker.running}>
                  Gerar rascunho com IA
                </Button>
              ) : null
            }
          >
            {startable ? "O modelo gera uma sugestão a partir das evidências da versão técnica; você revisa antes de qualquer publicação." : "Aguarde: o rascunho está sendo gerado."}
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid-2">
          <DraftView draft={task.draft} evidences={task.evidences} />
          <div className="stack review-sidebar">
            {reviewable && permissionsLoading ? (
              <Skeleton lines={4} />
            ) : reviewable ? (
              // A chave reinicia o formulário se a revisão, a situação ou o papel mudarem.
              <ReviewPanel key={`${task.draft_revision}-${task.status}-${canApprove}`} task={task} canApprove={canApprove} submitting={review.isPending || tracker.running} onSubmit={submitReview} />
            ) : cardEdit && (task.status === "open" || task.status === "generating") ? (
              <Alert tone="info">Preparando a edição: validando o conteúdo aprovado. Sem chamada à IA.</Alert>
            ) : (
              <Alert tone="info">Esta tarefa não aguarda revisão (situação: {taskStatusLabel(task.status)}).</Alert>
            )}
            {startable ? (
              <Button onClick={startCuration} loading={start.isPending || tracker.running}>
                {cardEdit ? "Retomar edição" : "Gerar novo rascunho"}
              </Button>
            ) : null}
            {task.status === "approved" && canApprove ? (
              <Button
                variant="primary"
                loading={publish.isPending}
                onClick={() =>
                  publish.mutate(undefined, {
                    onSuccess: () => {
                      notify("success", "Ficha publicada.");
                      void refresh();
                    },
                    onError: (error) => notify("danger", describeError(error)),
                  })
                }
              >
                Publicar aprovação
              </Button>
            ) : null}
            <EvidencePanel evidences={task.evidences} />
            {task.decisions.length ? (
              <Panel title="Histórico de decisões">
                <ul className="small">
                  {task.decisions.map((decision) => (
                    <li key={decision.id}>
                      {decisionLabel(decision.decision)} — <strong>{decision.approver}</strong> (rascunho r{decision.draft_revision})
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
