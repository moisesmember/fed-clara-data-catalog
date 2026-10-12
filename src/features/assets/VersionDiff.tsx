import type { VersionDiff as Diff } from "@/api/types";
import { Badge } from "@/shared/ui/primitives";

/** Resume as diferenças estruturadas registradas pelo backend entre duas versões técnicas. */
export function VersionDiff({ diff }: { diff: Diff }) {
  if (diff.kind === "created") {
    return <Badge tone="accent">Primeira versão</Badge>;
  }
  const added = (diff.columns_added as string[] | undefined) ?? [];
  const removed = (diff.columns_removed as string[] | undefined) ?? [];
  const modified = (diff.columns_modified as { name: string; fields: string[] }[] | undefined) ?? [];
  const description = diff.description as { old: string | null; new: string | null } | undefined;
  return (
    <ul className="diff small">
      {description ? (
        <li>
          <Badge tone="info">Descrição</Badge> “{description.old ?? "—"}” → “{description.new ?? "—"}”
        </li>
      ) : null}
      {added.length ? (
        <li>
          <Badge tone="success">+ colunas</Badge> {added.map((c) => <code key={c}>{c} </code>)}
        </li>
      ) : null}
      {removed.length ? (
        <li>
          <Badge tone="danger">− colunas</Badge> {removed.map((c) => <code key={c}>{c} </code>)}
        </li>
      ) : null}
      {modified.map((m) => (
        <li key={m.name}>
          <Badge tone="warning">alterada</Badge> <code>{m.name}</code> <span className="muted">({m.fields.join(", ")})</span>
        </li>
      ))}
      {!description && !added.length && !removed.length && !modified.length ? <li className="muted">Mudança de tipo do objeto.</li> : null}
    </ul>
  );
}
