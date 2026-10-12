import { Link } from "react-router";

import { EmptyState } from "@/shared/ui/states";

export function NotFoundPage() {
  return (
    <EmptyState title="Página não encontrada" action={<Link to="/explorar">Voltar para Explorar</Link>}>
      O endereço não existe ou você não tem acesso a ele.
    </EmptyState>
  );
}
