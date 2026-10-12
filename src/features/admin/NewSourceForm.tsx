import { useState, type FormEvent } from "react";

import { SOURCE_ENVIRONMENTS, type AuthMethod, type SourceEnvironment, type SourceInput, type SourceKind } from "@/api/types";
import { useSession } from "@/core/auth/SessionProvider";
import { describeError } from "@/core/http/apiError";
import { useNotify } from "@/shared/ui/notifications";
import { Button, Field, Panel, Select, TextInput } from "@/shared/ui/primitives";

import { useCreateSource } from "./hooks";

const ENVIRONMENT_LABEL: Record<SourceEnvironment, string> = { lab: "Laboratório", dev: "Desenvolvimento", prod: "Produção" };

interface SourceForm {
  id: string;
  name: string;
  environment: SourceEnvironment;
  kind: SourceKind;
  host: string;
  httpPath: string;
  authMethod: Exclude<AuthMethod, "none">;
  credentialRef: string;
  catalog: string;
  schema: string;
  domain: string;
  scheduleTime: string;
  owner: string;
}

type Errors = Partial<Record<keyof SourceForm, string>>;

/** Espelha as regras de `SourceConfig` no backend para avisar antes de enviar; quem valida de fato é a API. */
function validateSource(form: SourceForm, existingIds: string[]): Errors {
  const errors: Errors = {};
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(form.id)) errors.id = "Use de 2 a 64 caracteres: letras minúsculas, números, _ ou -.";
  else if (existingIds.includes(form.id)) errors.id = "Já existe uma fonte com este identificador. Cadastrar de novo substituiria a configuração dela.";
  if (!form.name.trim()) errors.name = "Informe um nome.";
  if (!form.owner.trim()) errors.owner = "Informe o responsável.";
  if (form.kind === "databricks_sql") {
    if (!form.host.trim()) errors.host = "Informe o host do workspace.";
    if (!form.httpPath.trim()) errors.httpPath = "Informe o HTTP path do SQL Warehouse.";
    if (!form.credentialRef.trim()) errors.credentialRef = "Informe a referência da credencial.";
    if (form.authMethod === "pat" && form.environment === "prod") errors.authMethod = "Token pessoal não é permitido em produção.";
  }
  if (!form.catalog.trim()) errors.catalog = "Informe o catálogo.";
  if (!form.schema.trim()) errors.schema = "Informe o schema.";
  if (!/^[a-z0-9_-]{1,64}$/.test(form.domain)) errors.domain = "Use letras minúsculas, números, _ ou - (ex.: financeiro).";
  return errors;
}

function toSourceInput(form: SourceForm): SourceInput {
  const databricks = form.kind === "databricks_sql";
  return {
    id: form.id,
    name: form.name.trim(),
    environment: form.environment,
    kind: form.kind,
    host: databricks ? form.host.trim() : undefined,
    http_path: databricks ? form.httpPath.trim() : undefined,
    auth_method: databricks ? form.authMethod : "none",
    credential_ref: databricks ? form.credentialRef.trim() : undefined,
    scopes: [{ catalog: form.catalog.trim(), schema: form.schema.trim(), domain: form.domain }],
    schedule_time: form.scheduleTime || undefined,
    owner: form.owner.trim(),
  };
}

/** Cadastro de fonte com o primeiro escopo. Os demais escopos são geridos depois, no cartão da fonte. */
export function NewSourceForm({ existingIds, onDone }: { existingIds: string[]; onDone: () => void }) {
  const { session } = useSession();
  const create = useCreateSource();
  const notify = useNotify();
  const [form, setForm] = useState<SourceForm>({
    id: "",
    name: "",
    environment: "dev",
    kind: "databricks_sql",
    host: "",
    httpPath: "",
    authMethod: "oauth_m2m",
    credentialRef: "",
    catalog: "",
    schema: "",
    domain: "",
    scheduleTime: "",
    owner: session?.subject ?? "",
  });
  const [submitted, setSubmitted] = useState(false);
  const errors = validateSource(form, existingIds);
  const shown = submitted ? errors : {};
  const set = <K extends keyof SourceForm>(key: K) => (value: SourceForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const text = (key: keyof SourceForm) => ({ value: form[key], onChange: (event: { target: { value: string } }) => set(key)(event.target.value as never) });
  const databricks = form.kind === "databricks_sql";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    create.mutate(toSourceInput(form), {
      onSuccess: ({ id }) => {
        notify("success", databricks ? `Fonte ${id} cadastrada. Teste a conexão para verificar a credencial.` : `Fonte ${id} cadastrada. Importe um arquivo para trazer os metadados.`);
        onDone();
      },
      onError: (error) => notify("danger", describeError(error)),
    });
  };

  return (
    <Panel title="Nova fonte">
      <form className="stack" onSubmit={submit} aria-label="Cadastrar fonte" noValidate>
        <fieldset className="source-form">
          <legend className="ui-field__label">Identificação</legend>
          <Field label="Identificador" hint="Não muda depois. Ex.: dbx-vendas." error={shown.id}>
            {(props) => <TextInput {...props} {...text("id")} onChange={(e) => set("id")(e.target.value.toLowerCase())} autoComplete="off" />}
          </Field>
          <Field label="Nome" error={shown.name}>{(props) => <TextInput {...props} {...text("name")} placeholder="Databricks Vendas" />}</Field>
          <Field label="Ambiente">
            {(props) => (
              <Select {...props} value={form.environment} onChange={(e) => set("environment")(e.target.value as SourceEnvironment)}>
                {SOURCE_ENVIRONMENTS.map((env) => (
                  <option key={env} value={env}>
                    {ENVIRONMENT_LABEL[env]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Tipo" hint={databricks ? "Lê só metadados do SQL Warehouse." : "Metadados importados de JSON/CSV no contrato normalizado."}>
            {(props) => (
              <Select {...props} value={form.kind} onChange={(e) => set("kind")(e.target.value as SourceKind)}>
                <option value="databricks_sql">Databricks SQL</option>
                <option value="file">Arquivo (JSON/CSV)</option>
              </Select>
            )}
          </Field>
          <Field label="Responsável" error={shown.owner}>{(props) => <TextInput {...props} {...text("owner")} />}</Field>
        </fieldset>

        {databricks ? (
          <fieldset className="source-form">
            <legend className="ui-field__label">Conexão</legend>
            <Field label="Host" hint="Ex.: adb-123.azuredatabricks.net" error={shown.host}>
              {(props) => <TextInput {...props} {...text("host")} autoComplete="off" />}
            </Field>
            <Field label="HTTP path" hint="Ex.: /sql/1.0/warehouses/abc123" error={shown.httpPath}>
              {(props) => <TextInput {...props} {...text("httpPath")} autoComplete="off" />}
            </Field>
            <Field label="Autenticação" error={shown.authMethod}>
              {(props) => (
                <Select {...props} value={form.authMethod} onChange={(e) => set("authMethod")(e.target.value as SourceForm["authMethod"])}>
                  <option value="oauth_m2m">Service principal (OAuth M2M)</option>
                  <option value="pat">Token pessoal (só laboratório/desenvolvimento)</option>
                </Select>
              )}
            </Field>
            <Field
              label="Referência da credencial"
              hint="Nome da variável de ambiente no backend, nunca o segredo. Ex.: env:DBX_VENDAS"
              error={shown.credentialRef}
            >
              {(props) => <TextInput {...props} {...text("credentialRef")} placeholder="env:DBX_VENDAS" autoComplete="off" />}
            </Field>
          </fieldset>
        ) : null}

        <fieldset className="source-form">
          <legend className="ui-field__label">Primeiro escopo</legend>
          <Field label="Catálogo" error={shown.catalog}>{(props) => <TextInput {...props} {...text("catalog")} autoComplete="off" />}</Field>
          <Field label="Schema" error={shown.schema}>{(props) => <TextInput {...props} {...text("schema")} autoComplete="off" />}</Field>
          <Field label="Domínio" hint="Área dona dos dados. Ex.: financeiro" error={shown.domain}>
            {(props) => <TextInput {...props} {...text("domain")} onChange={(e) => set("domain")(e.target.value.toLowerCase())} autoComplete="off" />}
          </Field>
          <Field label="Sincronização diária (opcional)" hint="Horário de São Paulo. Em branco: só manual.">
            {(props) => <TextInput {...props} type="time" {...text("scheduleTime")} />}
          </Field>
        </fieldset>
        <p className="xsmall muted">Depois de cadastrar, descubra e inclua outros escopos no cartão da fonte.</p>

        <div className="cluster">
          <Button type="submit" variant="primary" loading={create.isPending}>
            Cadastrar fonte
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </Panel>
  );
}
