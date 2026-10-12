import type { Action, Permissions } from "@/core/auth/permissions";

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Ação exigida para o item fazer sentido (a API continua sendo quem autoriza). */
  requires?: Action;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    title: "Descobrir",
    items: [{ to: "/explorar", label: "Explorar e perguntar", icon: "⌕", requires: "read_published" }],
  },
  {
    title: "Curadoria",
    items: [
      { to: "/curadoria", label: "Fila de curadoria", icon: "✎", requires: "curate" },
      { to: "/curadoria/demandas", label: "Demandas dos usuários", icon: "?", requires: "curate" },
      { to: "/ativos", label: "Ativos e versões", icon: "▦", requires: "read_metadata" },
    ],
  },
  {
    title: "Administração",
    items: [
      { to: "/admin/fontes", label: "Fontes e sincronização", icon: "⇄", requires: "admin" },
      { to: "/admin/auditoria", label: "Auditoria", icon: "≡", requires: "approve" },
      { to: "/admin/metricas", label: "Métricas dos grafos", icon: "◔", requires: "admin" },
    ],
  },
];

/** Itens visíveis para o usuário. Auditoria também é liberada a administradores. */
export function visibleNavigation(permissions: Permissions): NavGroup[] {
  const allowed = (item: NavItem) =>
    !item.requires ||
    permissions.can(item.requires) ||
    (item.to === "/admin/auditoria" && permissions.can("admin"));
  return NAVIGATION.map((group) => ({ ...group, items: group.items.filter(allowed) })).filter((group) => group.items.length > 0);
}
