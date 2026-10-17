import type { TaskDetail } from "@/api/types";
import { Badge, Panel } from "@/shared/ui/primitives";

interface ChecklistItem {
  key: string;
  blocking: boolean;
  message: string;
  title?: string;
}

/**
 * Junta num só lugar o que impede ou pede atenção antes de publicar: pendências do ativo,
 * problemas de validação do rascunho e o motivo de um bloqueio de publicação.
 */
function checklistItems(task: TaskDetail): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  if (task.status === "publication_blocked" && task.last_error) {
    items.push({ key: "last-error", blocking: true, message: task.last_error });
  }
  for (const pendency of task.open_pendencies) {
    items.push({ key: `pendency-${pendency.code}-${pendency.id ?? pendency.message}`, blocking: pendency.blocking, message: pendency.message });
  }
  task.draft?.issues.forEach((issue, index) => {
    items.push({ key: `issue-${issue.code}-${index}`, blocking: issue.severity === "blocking", message: issue.message, title: issue.path ?? undefined });
  });
  // Primeiro o que bloqueia; a ordem de origem se mantém dentro de cada grupo.
  return [...items.filter((item) => item.blocking), ...items.filter((item) => !item.blocking)];
}

export function PublicationChecklist({ task }: { task: TaskDetail }) {
  const items = checklistItems(task);
  if (!items.length) return null;
  const blocking = items.filter((item) => item.blocking).length;
  return (
    <Panel title="O que falta para publicar" actions={blocking ? <Badge tone="danger">{blocking === 1 ? "1 bloqueio" : `${blocking} bloqueios`}</Badge> : null}>
      <ul className="issues">
        {items.map((item) => (
          <li key={item.key} className="cluster small" title={item.title}>
            <Badge tone={item.blocking ? "danger" : "warning"}>{item.blocking ? "Bloqueia publicação" : "Atenção"}</Badge>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
