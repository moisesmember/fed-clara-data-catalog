import { NavLink, Outlet, useNavigate } from "react-router";

import { useSession } from "@/core/auth/SessionProvider";
import { Button } from "@/shared/ui/primitives";
import { Alert, Spinner } from "@/shared/ui/states";

import { visibleNavigation } from "./navigation";
import "./shell.css";

const ROLE_LABELS: Record<string, string> = {
  consumer: "Consumidor",
  restricted_reader: "Leitor restrito",
  curator: "Curador",
  approver: "Aprovador",
  admin: "Administrador",
};

export function AppShell() {
  const { session, permissions, loading, error, signOut } = useSession();
  const navigate = useNavigate();
  const groups = visibleNavigation(permissions);

  return (
    <div className="shell">
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <aside className="sidebar" aria-label="Navegação principal">
        <NavLink to="/explorar" className="brand">
          <span className="brand__mark" aria-hidden="true">C</span>
          <span>
            Clara
            <span className="brand__sub">Catálogo de dados</span>
          </span>
        </NavLink>
        {loading ? <Spinner label="Carregando permissões" /> : null}
        {groups.map((group) => (
          <nav key={group.title} className="nav-group" aria-label={group.title}>
            <span className="nav-group__title">{group.title}</span>
            {group.items.map((item) => (
              <NavLink key={item.to} to={item.to} end className="nav-link">
                <span className="nav-link__icon" aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        ))}
        <div className="sidebar__footer stack-sm">
          <div>
            <div className="xsmall muted">Conectado como</div>
            <strong>{session?.subject}</strong>
          </div>
          <div className="xsmall muted">
            {permissions.bindings.length
              ? permissions.bindings
                  .map((b) => `${ROLE_LABELS[b.role] ?? b.role}${b.domain !== "*" ? ` · ${b.domain}` : ""}`)
                  .join(" | ")
              : loading
                ? "…"
                : "Sem papéis atribuídos"}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              signOut();
              navigate("/entrar");
            }}
          >
            Trocar usuário
          </Button>
        </div>
      </aside>
      <main id="conteudo" className="main" tabIndex={-1}>
        <div className="main__inner stack">
          {error ? <Alert tone="danger">Não foi possível carregar suas permissões. Verifique se a API está em execução.</Alert> : null}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
