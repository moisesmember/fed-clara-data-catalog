import type { CapabilityReport } from "@/api/types";
import { formatDateTime } from "@/shared/format";

const STEP_LABEL: Record<string, string> = {
  authentication: "Autenticação",
  sql_execution: "Execução de SQL no warehouse",
  unity_catalog: "Unity Catalog (metastore)",
  metadata_relations: "Relações do information_schema",
  scope_visibility: "Visibilidade do escopo",
  file_import: "Importação por arquivo",
};

/** Resultado do teste de capacidades da fonte, passo a passo. */
export function CapabilityChecklist({ report }: { report: CapabilityReport }) {
  return (
    <div className="stack-sm">
      <ul className="checklist" aria-label="Resultado do teste de capacidades">
        {report.steps.map((step, index) => (
          <li key={`${step.name}-${index}`} className={step.ok ? "checklist__ok" : "checklist__fail"}>
            <span aria-hidden="true">{step.ok ? "✓" : "✕"}</span>
            <span className="visually-hidden">{step.ok ? "Aprovado:" : "Falhou:"}</span>
            <span>
              {STEP_LABEL[step.name] ?? step.name}
              {step.scope ? <code> {step.scope}</code> : null}
              {step.catalog && !step.scope ? <code> {step.catalog}</code> : null}
              {typeof step.tables === "number" ? <span className="muted"> · {step.tables} tabela(s)</span> : null}
              {step.metastore_id ? <span className="muted"> · {step.metastore_id}</span> : null}
              {step.detail ? <span className="checklist__detail"> — {step.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {report.checked_at ? <span className="xsmall muted">Verificado em {formatDateTime(report.checked_at)}</span> : null}
    </div>
  );
}
