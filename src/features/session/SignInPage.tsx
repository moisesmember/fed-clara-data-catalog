import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { useSession } from "@/core/auth/SessionProvider";
import { Button, Field, Panel, TextInput } from "@/shared/ui/primitives";
import { Alert } from "@/shared/ui/states";

import "./session.css";

/** Usuários do seed de demonstração do backend (os papéis vêm do backend, não daqui). */
const DEMO_USERS = [
  { subject: "joao.consumidor", description: "Consumidor do domínio financeiro" },
  { subject: "marina.rh", description: "Consumidora de RH com acesso a conteúdo restrito" },
  { subject: "carlos.curador", description: "Curador do domínio financeiro" },
  { subject: "bia.aprovadora", description: "Aprovadora do domínio financeiro" },
  { subject: "rui.rh", description: "Aprovador do domínio RH" },
  { subject: "lucas.producao", description: "Consumidor do domínio produção" },
  { subject: "carla.curadora", description: "Curadora do domínio produção" },
  { subject: "paulo.aprovador", description: "Aprovador do domínio produção" },
  { subject: "ana.admin", description: "Administradora (fontes, operação)" },
];

export function SignInPage() {
  const { session, signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const destination = (location.state as { from?: string } | null)?.from ?? "/explorar";

  if (session) {
    return <Navigate to={destination} replace />;
  }

  const enter = (value: string) => {
    try {
      signIn(value);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identificador inválido.");
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    enter(subject);
  };

  return (
    <main className="signin">
      <div className="signin__card stack">
        <div className="stack-sm">
          <span className="brand__mark" aria-hidden="true">C</span>
          <h1>Entrar no Clara</h1>
          <p className="muted small">Catálogo de dados com curadoria assistida e respostas fundamentadas.</p>
        </div>

        <Alert tone="info">
          Modo de desenvolvimento: a identidade é enviada no cabeçalho <code>X-Clara-User</code> e só é aceita pelo backend em
          dev/test. Os papéis de cada usuário são definidos no backend.
        </Alert>

        <Panel title="Usuários de demonstração">
          <ul className="signin__users">
            {DEMO_USERS.map((user) => (
              <li key={user.subject}>
                <button type="button" className="signin__user" onClick={() => enter(user.subject)}>
                  <strong>{user.subject}</strong>
                  <span className="muted small">{user.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <form onSubmit={onSubmit} className="stack-sm" aria-label="Entrar com outro identificador">
          <Field label="Outro identificador" hint="Use um usuário cadastrado em role_bindings no backend." error={error}>
            {(props) => (
              <TextInput {...props} value={subject} onChange={(event) => setSubject(event.target.value)} autoComplete="username" placeholder="ex.: maria.silva" />
            )}
          </Field>
          <Button type="submit" variant="primary" disabled={!subject.trim()}>
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
