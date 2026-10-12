import { useState } from "react";

import { Button, PageHeader } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";

import { useSources } from "./hooks";
import { NewSourceForm } from "./NewSourceForm";
import { SourceCard } from "./SourceCard";
import "./admin.css";

export function SourcesPage() {
  const sources = useSources();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Fontes e sincronização"
        subtitle="Cadastre fontes, teste conexões, sincronize metadados do SQL Warehouse ou importe arquivos. Somente metadados são lidos."
        actions={
          creating ? null : (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Nova fonte
            </Button>
          )
        }
      />
      {creating ? <NewSourceForm existingIds={sources.data?.map((source) => source.id) ?? []} onDone={() => setCreating(false)} /> : null}
      <QueryView query={sources} skeletonLines={6}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="Nenhuma fonte cadastrada">Use “Nova fonte” para cadastrar a primeira.</EmptyState>
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
