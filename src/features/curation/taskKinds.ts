/** Rótulos dos tipos de tarefa de curadoria (`TaskKind` do backend). */
export const TASK_KIND_LABEL: Record<string, string> = {
  new_asset: "Novo ativo",
  change_review: "Mudança na origem",
  semantic_change: "Mudança semântica",
  editorial_edit: "Edição de ficha",
};

export const taskKindLabel = (kind: string): string => TASK_KIND_LABEL[kind] ?? kind;

/** Edição de ficha parte do conteúdo aprovado: o rascunho já existe e não há geração com IA. */
export const isCardEdit = (kind: string): boolean => kind === "editorial_edit";
