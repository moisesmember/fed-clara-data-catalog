import type { ReactNode } from "react";

import { describeError } from "@/core/http/apiError";

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return (
    <span className="cluster" role={label ? "status" : undefined}>
      <span className="ui-spinner" aria-hidden="true" />
      {label ? <span className="visually-hidden">{label}</span> : null}
    </span>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="ui-skeleton" style={{ height: 14, width: `${90 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ui-state">
      <span className="ui-state__title">{title}</span>
      {children ? <span className="small">{children}</span> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="ui-alert ui-alert--danger" role="alert">
      <span>{describeError(error)}</span>
      {onRetry ? (
        <button type="button" className="ui-button ui-button--sm ui-button--secondary" onClick={onRetry} style={{ marginLeft: "auto" }}>
          Tentar de novo
        </button>
      ) : null}
    </div>
  );
}

export function Alert({ tone, children }: { tone: "danger" | "warning" | "info" | "success"; children: ReactNode }) {
  return (
    <div className={`ui-alert ui-alert--${tone}`} role={tone === "danger" ? "alert" : "note"}>
      <div>{children}</div>
    </div>
  );
}

/** Renderiza os estados de uma consulta de forma consistente em todas as telas. */
export function QueryView<T>({
  query,
  children,
  skeletonLines = 4,
}: {
  query: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  children: (data: T) => ReactNode;
  skeletonLines?: number;
}) {
  if (query.isPending) {
    return <Skeleton lines={skeletonLines} />;
  }
  if (query.error || query.data === undefined) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}
