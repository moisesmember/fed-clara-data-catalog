import { useState, type FormEvent } from "react";

import { TABLE_KINDS, type ScopeConfig, type TableKind } from "@/api/types";
import { Button, Checkbox, Field, TextInput } from "@/shared/ui/primitives";

import { COMMON_FORMATS, FORMAT_LABEL, TABLE_KIND_LABEL } from "./selection";

/** O que o editor devolve: domínio, filtros e (no catálogo) os schemas deixados de fora. */
export type RuleDraft = Pick<ScopeConfig, "domain" | "table_types" | "formats" | "exclude">;

/** Lista marcada inteira = sem filtro (`null`): objetos de tipos/formatos novos também entram. */
function toFilter<T extends string>(checked: T[], all: readonly T[]): T[] | null {
  return checked.length === all.length ? null : checked;
}

/** Domínio, tipos de objeto e formatos de uma seleção; no catálogo, também quais schemas ficam
 *  de fora. Exceções de tabela são feitas na lista de objetos do schema. */
export function RuleEditor({
  title,
  initial,
  formats,
  schemas,
  domainsId,
  domainLocked,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  title: string;
  initial: RuleDraft;
  /** Formatos vistos na origem para esta seleção. */
  formats: string[];
  /** Só no catálogo inteiro: schemas vistos na origem (desmarcar = exceção). */
  schemas?: string[];
  domainsId: string;
  /** Seleção já com ativos importados: o domínio não muda (o backend recusa). */
  domainLocked?: boolean;
  submitLabel: string;
  pending: boolean;
  onSubmit: (draft: RuleDraft) => void;
  onCancel: () => void;
}) {
  const formatOptions = [...new Set([...(initial.formats ?? []), ...formats, ...COMMON_FORMATS])].sort();
  const [domain, setDomain] = useState(initial.domain);
  const [types, setTypes] = useState<TableKind[]>(initial.table_types ?? [...TABLE_KINDS]);
  const [chosenFormats, setChosenFormats] = useState<string[]>(initial.formats ?? formatOptions);
  // Exceções de schema (no catálogo); exceções `schema.tabela` vindas da API são preservadas.
  const [excludedSchemas, setExcludedSchemas] = useState<string[]>(initial.exclude.filter((entry) => !entry.includes(".")));
  const [submitted, setSubmitted] = useState(false);

  const domainError = /^[a-z0-9_-]{1,64}$/.test(domain) ? undefined : "Use letras minúsculas, números, _ ou - (ex.: financeiro).";
  const typesError = types.length ? undefined : "Marque ao menos um tipo.";
  const formatsError = chosenFormats.length ? undefined : "Marque ao menos um formato.";

  const toggle = <T extends string>(list: T[], value: T, on: boolean) => (on ? [...list, value] : list.filter((item) => item !== value));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (domainError || typesError || formatsError) return;
    const keptTableExceptions = initial.exclude.filter((entry) => entry.includes("."));
    onSubmit({
      domain,
      table_types: toFilter(types, TABLE_KINDS),
      formats: toFilter(chosenFormats, formatOptions),
      exclude: schemas ? [...excludedSchemas, ...keptTableExceptions] : initial.exclude,
    });
  };

  return (
    <form className="rule-editor stack-sm" onSubmit={submit} aria-label={title} noValidate>
      <strong className="small">{title}</strong>
      <Field
        label="Domínio"
        hint={domainLocked ? "Já há ativos importados: o domínio deles não muda." : "Define quem vê o que esta seleção trouxer."}
        error={submitted ? domainError : undefined}
      >
        {(props) => (
          <TextInput {...props} list={domainsId} value={domain} disabled={domainLocked} onChange={(event) => setDomain(event.target.value)} style={{ maxWidth: 220 }} />
        )}
      </Field>

      <fieldset className="rule-editor__group">
        <legend className="ui-field__label">Tipos de objeto</legend>
        {TABLE_KINDS.map((kind) => (
          <Checkbox key={kind} label={TABLE_KIND_LABEL[kind]} checked={types.includes(kind)} onChange={(event) => setTypes(toggle(types, kind, event.target.checked))} />
        ))}
        <span className="xsmall muted">
          Todos marcados = qualquer tipo, inclusive os que surgirem.
        </span>
        {submitted && typesError ? (
          <span className="ui-field__error" role="alert">
            {typesError}
          </span>
        ) : null}
      </fieldset>

      <fieldset className="rule-editor__group">
        <legend className="ui-field__label">Formatos de tabela</legend>
        {formatOptions.map((format) => (
          <Checkbox
            key={format}
            label={FORMAT_LABEL[format] ?? format}
            checked={chosenFormats.includes(format)}
            onChange={(event) => setChosenFormats(toggle(chosenFormats, format, event.target.checked))}
          />
        ))}
        <span className="xsmall muted">Views não têm formato e seguem só o filtro de tipo.</span>
        {submitted && formatsError ? (
          <span className="ui-field__error" role="alert">
            {formatsError}
          </span>
        ) : null}
      </fieldset>

      {schemas?.length ? (
        <fieldset className="rule-editor__group">
          <legend className="ui-field__label">Schemas incluídos</legend>
          {schemas.map((schema) => (
            <Checkbox
              key={schema}
              label={<code>{schema}</code>}
              checked={!excludedSchemas.includes(schema)}
              onChange={(event) => setExcludedSchemas(toggle(excludedSchemas, schema, !event.target.checked))}
            />
          ))}
          <span className="xsmall muted">Schemas criados depois na origem entram automaticamente.</span>
        </fieldset>
      ) : null}

      <div className="cluster">
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          {submitLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
