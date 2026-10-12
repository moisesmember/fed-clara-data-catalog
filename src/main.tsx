import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import { AppProviders } from "@/app/AppProviders";
import { routes } from "@/app/routes";
import { DevHeaderIdentity } from "@/core/auth/devHeaderIdentity";
import { readConfig } from "@/core/config";
import { createServices } from "@/core/services";
import "@/shared/ui/ui.css";
import "@/styles/global.css";

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const config = readConfig();
const services = createServices(config, new DevHeaderIdentity(safeLocalStorage()));
const router = createBrowserRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders services={services}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
