import { useState } from "react";

import type { SearchMode } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { Button } from "@/shared/ui/primitives";

import { useFeedback, useRequestHelp } from "./hooks";

/** "Não encontrei": envia a dúvida para os curadores do domínio. */
export function RequestHelpButton({ question, assetId, label = "Pedir ajuda a um curador" }: { question: string; assetId?: number; label?: string }) {
  const help = useRequestHelp();
  if (help.isSuccess) {
    return (
      <p className="small" role="status">
        Pedido enviado. Um curador vai analisar sua dúvida.
      </p>
    );
  }
  return (
    <div className="stack-sm">
      <Button size="sm" variant="secondary" loading={help.isPending} onClick={() => help.mutate({ question, assetId })}>
        {label}
      </Button>
      {help.error ? <span className="xsmall" style={{ color: "var(--danger)" }}>{describeError(help.error)}</span> : null}
    </div>
  );
}

/** "Isso ajudou?": alimenta a lista de demandas dos curadores. */
export function FeedbackBar({ question, mode }: { question: string; mode?: SearchMode }) {
  const feedback = useFeedback();
  const [answered, setAnswered] = useState<boolean | null>(null);

  if (answered === true) {
    return <p className="xsmall muted" role="status">Obrigado pelo retorno!</p>;
  }
  if (answered === false) {
    return (
      <div className="feedback stack-sm" role="status">
        <span className="small">Obrigado. Quer que um curador ajude a encontrar o dado certo?</span>
        <RequestHelpButton question={question} />
      </div>
    );
  }
  const send = (helpful: boolean) => {
    setAnswered(helpful);
    feedback.mutate({ question, helpful, mode });
  };
  return (
    <div className="feedback cluster small">
      <span className="muted">Isso ajudou?</span>
      <Button size="sm" variant="ghost" onClick={() => send(true)}>
        👍 Sim
      </Button>
      <Button size="sm" variant="ghost" onClick={() => send(false)}>
        👎 Não era isso
      </Button>
    </div>
  );
}
