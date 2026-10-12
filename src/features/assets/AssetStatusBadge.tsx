import { Badge, type Tone } from "@/shared/ui/primitives";

const STATUS: Record<string, [string, Tone, string]> = {
  active: ["Ativo", "success", "Observado na última coleta."],
  missing: ["Ausente", "warning", "Não observado numa coleta completa. Nada foi excluído."],
  deprecation_candidate: ["Candidato a descontinuação", "danger", "Ausente em várias coletas completas: requer decisão humana."],
};

export function AssetStatusBadge({ status }: { status: string }) {
  const [label, tone, title] = STATUS[status] ?? [status, "neutral", ""];
  return (
    <Badge tone={tone} title={title}>
      {label}
    </Badge>
  );
}
