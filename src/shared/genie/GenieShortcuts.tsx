import { useState } from "react";

import type { GenieOffer } from "@/api/types";
import { Button } from "@/shared/ui/primitives";

/** Atalhos para espaços Genie do Databricks (ADR 0016 do backend). A Clara não envia a pergunta
 *  nem recebe dados: o espaço abre no Databricks, com as permissões de quem clica, e a pergunta
 *  só é copiada aqui no navegador para colar lá. */
export function GenieShortcuts({ spaces, question, intro }: { spaces: GenieOffer[] | undefined; question: string; intro: string }) {
  const [copied, setCopied] = useState(false);
  if (!spaces?.length) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(question);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="genie-shortcuts stack-sm" aria-label="Perguntar ao Genie">
      <p className="small">{intro}</p>
      <ul className="genie-shortcuts__list">
        {spaces.map((space) => (
          <li key={space.id}>
            <a href={space.url} target="_blank" rel="noopener noreferrer" className="ui-button ui-button--secondary ui-button--sm">
              Abrir no Genie: {space.title}
            </a>
            {space.description ? <span className="xsmall muted">{space.description}</span> : null}
          </li>
        ))}
      </ul>
      <div className="cluster">
        <Button size="sm" variant="ghost" onClick={() => void copy()}>
          {copied ? "Pergunta copiada" : "Copiar a pergunta"}
        </Button>
        <span className="xsmall muted">O Genie abre no Databricks e responde com as suas permissões de acesso aos dados; cole a pergunta lá.</span>
      </div>
    </section>
  );
}
