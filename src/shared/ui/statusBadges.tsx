import type { ClaimStatus, EditorialStatus, JobStatus, TaskStatus, TrustStatus, Visibility } from "@/api/types";

import { Badge, type Tone } from "./primitives";

/** Rótulos e tons de cada estado do domínio. Sempre texto + cor (nunca só cor). */
const TRUST: Record<TrustStatus, [string, Tone, string]> = {
  certified: ["Certificado", "success", "Validado formalmente pelo aprovador do domínio."],
  with_caveats: ["Com ressalvas", "warning", "Utilizável, mas com limitações conhecidas."],
  not_validated: ["Não validado", "neutral", "Publicado, mas sem certificação: confirme com o responsável."],
};

const EDITORIAL: Record<EditorialStatus, [string, Tone]> = {
  draft: ["Rascunho", "neutral"],
  in_review: ["Em revisão", "info"],
  published: ["Publicado", "accent"],
  retired: ["Retirado", "danger"],
};

const VISIBILITY: Record<Visibility, [string, Tone, string]> = {
  internal: ["Interno", "neutral", "Visível a qualquer consumidor autenticado."],
  domain: ["Domínio", "info", "Visível a quem tem papel no domínio do ativo."],
  restricted: ["Restrito", "warning", "Visível só a leitores autorizados de conteúdo restrito do domínio."],
};

const TASK: Record<TaskStatus, [string, Tone]> = {
  open: ["Aberta", "neutral"],
  generating: ["Gerando rascunho", "info"],
  awaiting_review: ["Aguardando revisão", "accent"],
  approved: ["Aprovada", "success"],
  published: ["Publicada", "success"],
  publication_blocked: ["Publicação bloqueada", "warning"],
  rejected: ["Rejeitada", "danger"],
  failed: ["Falhou", "danger"],
  superseded: ["Superada", "neutral"],
};

const CLAIM: Record<ClaimStatus, [string, Tone, string]> = {
  supported: ["Sustentado", "success", "Afirmação apoiada por evidência citada."],
  suggested: ["Sugestão", "warning", "Hipótese a confirmar com o responsável."],
  unknown: ["Desconhecido", "neutral", "Sem informação suficiente na origem."],
};

const JOB: Record<JobStatus, [string, Tone]> = {
  pending: ["Na fila", "neutral"],
  running: ["Em execução", "info"],
  succeeded: ["Concluído", "success"],
  failed: ["Falhou", "danger"],
  dead: ["Esgotado", "danger"],
  cancelled: ["Cancelado", "neutral"],
};

export const trustLabel = (status: TrustStatus) => TRUST[status][0];
export const visibilityLabel = (visibility: Visibility) => VISIBILITY[visibility][0];
export const visibilityDescription = (visibility: Visibility) => VISIBILITY[visibility][2];
export const taskStatusLabel = (status: TaskStatus) => TASK[status][0];

export function TrustBadge({ status }: { status: TrustStatus }) {
  const [label, tone, title] = TRUST[status];
  return <Badge tone={tone} title={title}>{label}</Badge>;
}

export function EditorialBadge({ status }: { status: EditorialStatus }) {
  const [label, tone] = EDITORIAL[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const [label, tone, title] = VISIBILITY[visibility];
  return <Badge tone={tone} title={title}>{label}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const [label, tone] = TASK[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

export function ClaimBadge({ status }: { status: ClaimStatus }) {
  const [label, tone, title] = CLAIM[status];
  return <Badge tone={tone} title={title}>{label}</Badge>;
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const [label, tone] = JOB[status];
  return <Badge tone={tone}>{label}</Badge>;
}
