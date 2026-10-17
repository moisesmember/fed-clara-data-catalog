import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TaskSummary } from "@/api/types";
import { FakeHttpClient } from "@/test/fakeHttpClient";
import { renderApp } from "@/test/renderApp";

const summary: TaskSummary = {
  id: 7,
  asset_id: 3,
  fqn: "lab_dw.vendas.ft_faturamento",
  kind: "new_asset",
  status: "awaiting_review",
  domain: "financeiro",
  draft_revision: 2,
  updated_at: "2026-10-12T02:45:10Z",
};

describe("Fila de curadoria", () => {
  it("abre no que aguarda revisão e permite ver todas as situações", async () => {
    const http = new FakeHttpClient({ "GET /curation/tasks": [summary] });
    const user = userEvent.setup();
    renderApp({ path: "/curadoria", subject: "carlos.curador", http });

    expect(await screen.findByText("lab_dw.vendas.ft_faturamento")).toBeInTheDocument();
    expect(http.callsTo("GET", "/curation/tasks")[0]?.options.query).toMatchObject({ status: "awaiting_review" });
    expect(screen.getByLabelText("Filtrar por situação")).toHaveValue("awaiting_review");
    expect(screen.queryByRole("columnheader", { name: "Revisão" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filtrar por situação"), "todas");
    await vi.waitFor(() => expect(http.calls.filter((call) => call.path === "/curation/tasks").at(-1)?.options.query).toMatchObject({ status: "" }));
  });
});
