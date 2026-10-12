import { useState, type FormEvent } from "react";

import { useSession } from "@/core/auth/SessionProvider";
import { describeError } from "@/core/http/apiError";
import { useNotify } from "@/shared/ui/notifications";
import { Button, Field, Select, TextInput } from "@/shared/ui/primitives";

import { useSaveTerm } from "./hooks";

/** Ensina ao catálogo como as pessoas falam: "dinheiro que entrou" -> faturamento. */
export function GlossaryForm({ initialTerm = "", onSaved }: { initialTerm?: string; onSaved?: () => void }) {
  const { permissions } = useSession();
  const domains = permissions.domainsFor("curate");
  const [domain, setDomain] = useState(domains.find((d) => d !== "*") ?? domains[0] ?? "");
  const [term, setTerm] = useState(initialTerm);
  const [expansions, setExpansions] = useState("");
  const save = useSaveTerm();
  const notify = useNotify();
  const parsed = expansions.split(",").map((e) => e.trim()).filter(Boolean);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(
      { domain, term: term.trim(), expansions: parsed },
      {
        onSuccess: () => {
          notify("success", `“${term.trim()}” agora também busca por ${parsed.join(", ")}.`);
          setTerm("");
          setExpansions("");
          onSaved?.();
        },
        onError: (error) => notify("danger", describeError(error)),
      },
    );
  };

  return (
    <form className="glossary-form" onSubmit={submit} aria-label="Adicionar termo ao glossário">
      <Field label="Quando alguém disser…" hint="A expressão como os usuários falam.">
        {(props) => <TextInput {...props} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="ex.: dinheiro que entrou" />}
      </Field>
      <Field label="…buscar também por" hint="Termos do catálogo, separados por vírgula (até 6).">
        {(props) => <TextInput {...props} value={expansions} onChange={(e) => setExpansions(e.target.value)} placeholder="ex.: faturamento, receita" />}
      </Field>
      <Field label="Domínio" hint="Só quem lê este domínio terá a busca expandida.">
        {(props) => (
          <Select {...props} value={domain} onChange={(e) => setDomain(e.target.value)}>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d === "*" ? "Todos os domínios" : d}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Button type="submit" variant="primary" loading={save.isPending} disabled={term.trim().length < 2 || !parsed.length || !domain}>
        Salvar no glossário
      </Button>
    </form>
  );
}
