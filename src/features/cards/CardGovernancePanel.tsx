import { useState } from "react";

import { TRUST_STATUSES, VISIBILITIES, type PublishedCard, type TrustStatus, type Visibility } from "@/api/types";
import { describeError } from "@/core/http/apiError";
import { Button, Field, Panel, Select, TextArea, TextInput } from "@/shared/ui/primitives";
import { useNotify } from "@/shared/ui/notifications";
import { trustLabel, visibilityDescription, visibilityLabel } from "@/shared/ui/statusBadges";

import { useCardActions } from "./hooks";

/** Ações do aprovador sobre a ficha: visibilidade (revogação imediata), confiança e retirada. */
export function CardGovernancePanel({ card }: { card: PublishedCard }) {
  const actions = useCardActions(card.asset_id);
  const notify = useNotify();
  const [visibility, setVisibility] = useState<Visibility>(card.visibility);
  const [trust, setTrust] = useState<TrustStatus>(card.trust_status);
  const [trustNotes, setTrustNotes] = useState(card.trust_notes ?? "");
  const [retireReason, setRetireReason] = useState("");

  const run = <T,>(promise: Promise<T>, success: string) =>
    promise.then(
      () => notify("success", success),
      (error: unknown) => notify("danger", describeError(error)),
    );

  return (
    <Panel title="Governança da ficha">
      <div className="stack">
        <form
          className="stack-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void run(actions.setVisibility.mutateAsync(visibility), "Visibilidade atualizada. A busca já reflete a mudança.");
          }}
        >
          <Field label="Visibilidade" hint={visibilityDescription(visibility)}>
            {(props) => (
              <Select {...props} value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}>
                {VISIBILITIES.map((option) => (
                  <option key={option} value={option}>
                    {visibilityLabel(option)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button type="submit" size="sm" disabled={visibility === card.visibility} loading={actions.setVisibility.isPending}>
            Aplicar visibilidade
          </Button>
        </form>

        <form
          className="stack-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void run(actions.setTrust.mutateAsync({ status: trust, notes: trustNotes || undefined }), "Confiança atualizada.");
          }}
        >
          <Field label="Confiança" hint="Publicar não certifica: a certificação é uma decisão explícita.">
            {(props) => (
              <Select {...props} value={trust} onChange={(event) => setTrust(event.target.value as TrustStatus)}>
                {TRUST_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {trustLabel(option)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Observações (opcional)">
            {(props) => <TextArea {...props} value={trustNotes} onChange={(event) => setTrustNotes(event.target.value)} rows={2} />}
          </Field>
          <Button type="submit" size="sm" loading={actions.setTrust.isPending}>
            Salvar confiança
          </Button>
        </form>

        <form
          className="stack-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void run(actions.retire.mutateAsync(retireReason.trim()), "Ficha retirada do catálogo.");
          }}
        >
          <Field label="Retirar ficha" hint="Remove da busca e das respostas imediatamente (o histórico é preservado).">
            {(props) => <TextInput {...props} value={retireReason} onChange={(event) => setRetireReason(event.target.value)} placeholder="Motivo da retirada" />}
          </Field>
          <Button type="submit" size="sm" variant="danger" disabled={retireReason.trim().length < 3} loading={actions.retire.isPending}>
            Retirar
          </Button>
        </form>
      </div>
    </Panel>
  );
}
