import type { Action, Permissions } from "@/core/auth/permissions";

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Ação (ou qualquer uma das ações) exigida para o item fazer sentido; a API continua sendo quem autoriza. */
  requires?: Action | Action[];
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
      { to: "/governanca", label: "Painel de governança", icon: "▤", requires: ["curate", "admin"] },
      { to: "/curadoria", label: "Fila de curadoria", icon: "✎", requires: "curate" },
      { to: "/curadoria/demandas", label: "Demandas dos usuários", icon: "?", requires: "curate" },
      { to: "/ativos", label: "Ativos e versões", icon: "▦", requires: "read_metadata" },
    ],
  },
  {
    title: "Administração",
    items: [
      { to: "/admin/fontes", label: "Fontes e sincronização", icon: "⇄", requires: "admin" },
      { to: "/admin/auditoria", label: "Auditoria", icon: "≡", requires: ["approve", "admin"] },
      { to: "/admin/metricas", label: "Métricas dos grafos", icon: "◔", requires: "admin" },
    ],
  },
];

/** Itens visíveis para o usuário. */
export function visibleNavigation(permissions: Permissions): NavGroup[] {
  const allowed = (item: NavItem) =>
    !item.requires || (Array.isArray(item.requires) ? item.requires : [item.requires]).some((action) => permissions.can(action));
  return NAVIGATION.map((group) => ({ ...group, items: group.items.filter(allowed) })).filter((group) => group.items.length > 0);
}
