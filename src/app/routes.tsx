import type { ComponentType } from "react";
import { Navigate, type RouteObject } from "react-router";

import { ExplorePage } from "@/features/search/ExplorePage";
import { NotFoundPage } from "@/features/session/NotFoundPage";
import { SignInPage } from "@/features/session/SignInPage";

import { AppShell } from "./AppShell";
import { RequireSession } from "./RequireSession";

/** Carrega a página sob demanda: consumidores não baixam o código de curadoria/administração. */
function lazyPage<M>(load: () => Promise<M>, pick: (module: M) => ComponentType) {
  return async () => ({ Component: pick(await load()) });
}

/** Tabela de rotas. Cada página é um componente de funcionalidade independente. */
export const routes: RouteObject[] = [
  { path: "/entrar", element: <SignInPage /> },
  {
    path: "/",
    element: (
      <RequireSession>
        <AppShell />
      </RequireSession>
    ),
    children: [
      { index: true, element: <Navigate to="/explorar" replace /> },
      { path: "explorar", element: <ExplorePage /> },
      { path: "fichas/:assetId", lazy: lazyPage(() => import("@/features/cards/CardPage"), (m) => m.CardPage) },
      { path: "governanca", lazy: lazyPage(() => import("@/features/governance/GovernancePage"), (m) => m.GovernancePage) },
      { path: "curadoria", lazy: lazyPage(() => import("@/features/curation/TaskQueuePage"), (m) => m.TaskQueuePage) },
      { path: "curadoria/demandas", lazy: lazyPage(() => import("@/features/demands/DemandsPage"), (m) => m.DemandsPage) },
      { path: "curadoria/:taskId", lazy: lazyPage(() => import("@/features/curation/TaskReviewPage"), (m) => m.TaskReviewPage) },
      { path: "ativos", lazy: lazyPage(() => import("@/features/assets/AssetListPage"), (m) => m.AssetListPage) },
      { path: "ativos/:assetId", lazy: lazyPage(() => import("@/features/assets/AssetDetailPage"), (m) => m.AssetDetailPage) },
      { path: "admin/fontes", lazy: lazyPage(() => import("@/features/admin/SourcesPage"), (m) => m.SourcesPage) },
      { path: "admin/auditoria", lazy: lazyPage(() => import("@/features/admin/AuditPage"), (m) => m.AuditPage) },
      { path: "admin/metricas", lazy: lazyPage(() => import("@/features/admin/MetricsPage"), (m) => m.MetricsPage) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
