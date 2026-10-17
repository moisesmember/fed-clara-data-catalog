import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
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
import { Badge, Button, Disclosure, PageHeader, Panel } from "@/shared/ui/primitives";
import { Alert, EmptyState, QueryView, Skeleton } from "@/shared/ui/states";
import { TaskStatusBadge, decisionLabel, jobStatusLabel, taskStatusLabel } from "@/shared/ui/statusBadges";

import { DecisionBar } from "./DecisionBar";
import { applyEdits, hasChanges, toForm, type DraftForm } from "./draftEdits";
import { DraftView, EvidenceList } from "./DraftView";
import { usePublishTask, useRefreshTask, useStartTask, useSubmitReview, useTask } from "./hooks";
import { PublicationChecklist } from "./PublicationChecklist";
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

type Draft = NonNullable<TaskDetail["draft"]>;

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

  const businessName = task.draft?.content.business_name.text.trim();
  const fqn = asset.data?.fqn;

  return (
    <>
      <PageHeader
        eyebrow="Curadoria"
        title={businessName || (fqn ? <code>{fqn}</code> : `Ativo #${task.asset_id}`)}
        subtitle={
          <span className="cluster">
            <Badge>{task.domain}</Badge>
            <span>{taskKindLabel(task.kind)}</span>
            {businessName && fqn ? <code className="small muted">{fqn}</code> : null}
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
      {/* Bloqueio de publicação entra no quadro de pendências; outros erros (ex.: geração) ficam aqui. */}
      {task.last_error && task.status !== "publication_blocked" ? <Alert tone="danger">{task.last_error}</Alert> : null}
      <PublicationChecklist task={task} />

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
      ) : reviewable && permissionsLoading ? (
        <Skeleton lines={8} />
      ) : (
        // A chave reinicia as edições se a revisão, a situação ou o papel mudarem.
        <ReviewWorkspace
          key={`${task.draft_revision}-${task.status}-${canApprove}`}
          task={task}
          draft={task.draft}
          reviewable={reviewable}
          canApprove={canApprove}
          submitting={review.isPending || tracker.running}
          onSubmit={submitReview}
        >
          {reviewable ? null : (
            <div className="stack-sm">
              {cardEdit && (task.status === "open" || task.status === "generating") ? (
                <Alert tone="info">Preparando a edição: validando o conteúdo aprovado. Sem chamada à IA.</Alert>
              ) : (
                <Alert tone="info">Esta tarefa não aguarda revisão (situação: {taskStatusLabel(task.status)}).</Alert>
              )}
              <div className="cluster">
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
              </div>
            </div>
          )}
        </ReviewWorkspace>
      )}
    </>
  );
}

interface ReviewWorkspaceProps {
  task: TaskDetail;
  draft: Draft;
  reviewable: boolean;
  canApprove: boolean;
  submitting: boolean;
  onSubmit: (submission: ReviewSubmission) => void;
  /** Ações de quem não está revisando (retomar, publicar aprovação). */
  children?: ReactNode;
}

/** Ficha editável no próprio lugar, consulta recolhida e a decisão no fim. */
function ReviewWorkspace({ task, draft, reviewable, canApprove, submitting, onSubmit, children }: ReviewWorkspaceProps) {
  const initial = useMemo(() => toForm(draft.content), [draft.content]);
  const [form, setForm] = useState<DraftForm>(initial);
  const edited = reviewable && hasChanges(draft.content, form);

  return (
    <div className="review-workspace stack">
      <DraftView
        draft={draft}
        evidences={task.evidences}
        editing={reviewable ? { form, initial, onChange: (key, value) => setForm((current) => ({ ...current, [key]: value })) } : undefined}
      />

      <Panel>
        <div className="stack-sm">
          <Disclosure summary={`Todas as evidências da versão (${task.evidences.length})`}>
            <EvidenceList evidences={task.evidences} />
          </Disclosure>
          <Disclosure summary="Detalhes da tarefa">
            <TaskDetails task={task} draft={draft} />
          </Disclosure>
        </div>
      </Panel>

      {children}
      {reviewable ? (
        <DecisionBar
          task={task}
          canApprove={canApprove}
          edited={edited}
          editedContent={() => applyEdits(draft.content, form)}
          noLimitations={!form.limitations.trim()}
          submitting={submitting}
          onSubmit={onSubmit}
        />
      ) : null}
    </div>
  );
}

function TaskDetails({ task, draft }: { task: TaskDetail; draft: Draft }) {
  return (
    <div className="stack-sm small">
      <dl className="details-list">
        <dt>Tarefa</dt>
        <dd>#{task.id}</dd>
        <dt>Rascunho</dt>
        <dd>
          r{draft.revision} · {draft.origin === "ai" ? "gerado por IA" : "editado por pessoa"}
        </dd>
        {draft.model ? (
          <>
            <dt>Modelo</dt>
            <dd>
              {draft.model}
              {draft.prompt_version ? ` · prompt ${draft.prompt_version}` : ""}
            </dd>
          </>
        ) : null}
        <dt>Versão técnica</dt>
        <dd>#{task.asset_version_id}</dd>
        <dt>Rodadas de revisão</dt>
        <dd>{task.review_rounds}</dd>
        <dt>Regenerações</dt>
        <dd>{task.regenerations}</dd>
        {task.human_wait_ms ? (
          <>
            <dt>Espera humana acumulada</dt>
            <dd>{formatDuration(task.human_wait_ms)}</dd>
          </>
        ) : null}
      </dl>
      {task.decisions.length ? (
        <div>
          <strong>Histórico de decisões</strong>
          <ul>
            {task.decisions.map((decision) => (
              <li key={decision.id}>
                {decisionLabel(decision.decision)} — <strong>{decision.approver}</strong> (rascunho r{decision.draft_revision})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
