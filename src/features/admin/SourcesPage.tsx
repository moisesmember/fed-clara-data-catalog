import { PageHeader } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";

import { useSources } from "./hooks";
import { SourceCard } from "./SourceCard";
import "./admin.css";

export function SourcesPage() {
  const sources = useSources();
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Fontes e sincronização"
        subtitle="Teste conexões, sincronize metadados do SQL Warehouse ou importe arquivos. Somente metadados são lidos."
      />
      <QueryView query={sources} skeletonLines={6}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="Nenhuma fonte cadastrada">Cadastre fontes pela API (POST /sources) ou pelo seed do backend.</EmptyState>
          ) : (
            <div className="sources">
              {rows.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          )
        }
      </QueryView>
    </>
  );
}
