import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import App from "../App";

// Dashboard habit-creation modal tests. Same in-memory fetch stub pattern as
// auth-flow.test.tsx / goals-flow.test.tsx — synthetic tokens, no live backend.
// Dashboard is rendered through App (full routing) so the modal is exercised
// through the real ProtectedRoute + layout.

type FetchCall = { path: string; body: unknown; method: string };

type Handler = (body: any, init?: { method?: string }) => { status: number; json: unknown } | Promise<{ status: number; json: unknown }>;

function installFetchStub(handlers: Record<string, Handler>) {
  const calls: FetchCall[] = [];
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, body, method: init?.method ?? "GET" });
    // Longest-prefix match so /api/habits/1 beats /api/habits for detail ops.
    const key = Object.keys(handlers)
      .filter((k) => path.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (!key)
      return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "no stub" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    const { status, json } = await handlers[key](body, { method: init?.method ?? "GET" });
    // 204 must have null body — an empty string body throws in jsdom for
    // null-body statuses, which the client correctly surfaces as NETWORK_ERROR.
    return new Response(status === 204 ? null : JSON.stringify(json), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", stub);
  return { stub, calls };
}

const meHandler = {
  "/api/auth/me": () => ({
    status: 200,
    json: { user: { id: 7, email: "carol@example.com", createdAt: "2026-01-01T00:00:00.000Z" } },
  }),
};

// Stateful in-memory habit store mirroring backend semantics for the UI
// tests: GET lists (with stats), POST adds and bumps the count, DELETE
// removes, PUT /:id/completions toggles completed. Mirrors backend
// shape the frontend consumes.
function habitsHandlers(): Record<string, Handler> {
  const habit = (id: number, name: string, type: string, startDate: string) => ({
    id,
    name,
    type,
    startDate,
    stats: { currentStreak: 0, cleanStreak: 0, weekCompleted: 0, weekElapsedDays: 1, missedDays: 0 },
  });
  const store: any[] = [
    habit(1, "Meditate", "BUILD", "2026-08-01"),
    habit(2, "Smoking", "BREAK", "2026-08-01"),
  ];
  let nextId = 3;

  return {
    "/api/auth/me": meHandler["/api/auth/me"],
    "/api/habits": (body: any) => {
      if (body) {
        const created = habit(nextId++, body.name, body.type, body.startDate);
        store.push(created);
        return { status: 201, json: created };
      }
      return { status: 200, json: { habits: store } };
    },
    "/api/habits/": (_body: any, init?: { method?: string }) => {
      const method = init?.method ?? "GET";
      if (method === "DELETE") return { status: 204, json: null };
      // PUT /:id/completions — return updated habit with streak bumped.
      return { status: 200, json: { ...store[0], stats: { ...store[0].stats, currentStreak: 1, weekCompleted: 1 } } };
    },
  } satisfies Record<string, Handler>;
}

async function renderDashboard() {
  localStorage.setItem("habit-shaper-token", "synthetic-jwt-dashboard");
  const utils = render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    </AuthProvider>,
  );
  await screen.findByRole("heading", { name: /today's habits/i });
  return utils;
}

describe("Dashboard — add habit modal", () => {
  it("renders the habit list and summary with the Add habit trigger", async () => {
    installFetchStub(habitsHandlers());
    await renderDashboard();

    expect(screen.getByRole("heading", { name: /today's habits/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add habit/i })).toBeInTheDocument();
    // Two seeded habits render as cards.
    expect(screen.getByText("Meditate")).toBeInTheDocument();
    expect(screen.getByText("Smoking")).toBeInTheDocument();
    // Summary strip values (BUILD/BREAK appear in the strip AND on badges).
    const summary = screen.getByLabelText("Habit summary");
    expect(within(summary).getByText("Total habits")).toBeInTheDocument();
    expect(within(summary).getByText("BUILD")).toBeInTheDocument();
    expect(within(summary).getByText("BREAK")).toBeInTheDocument();
    expect(screen.getAllByText("BUILD").length).toBeGreaterThanOrEqual(2);
    // The create form is NOT inline anymore — no always-visible form panel.
    expect(screen.queryByRole("heading", { name: /create a habit/i })).not.toBeInTheDocument();
  });

  it("opens the modal from the Add habit trigger", async () => {
    installFetchStub(habitsHandlers());
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole("button", { name: /add habit/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(within(dialog).getByRole("heading", { name: /add a new habit/i })).toBeInTheDocument();
    // Existing create fields present.
    expect(within(dialog).getByLabelText(/name/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/type/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/start date/i)).toBeInTheDocument();
    // Focus moved into the first field.
    expect(within(dialog).getByLabelText(/name/i)).toHaveFocus();
  });

  it("closes the modal via Cancel", async () => {
    installFetchStub(habitsHandlers());
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole("button", { name: /add habit/i }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the modal via the X close button", async () => {
    installFetchStub(habitsHandlers());
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole("button", { name: /add habit/i }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /close dialog/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the modal via Escape", async () => {
    installFetchStub(habitsHandlers());
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole("button", { name: /add habit/i }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the modal via backdrop click", async () => {
    installFetchStub(habitsHandlers());
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole("button", { name: /add habit/i }));
    const dialog = await screen.findByRole("dialog");
    // Click on the backdrop (the dialog's parent) — not inside the dialog.
    await user.click(dialog.parentElement as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("creates a habit on submit and closes the modal", async () => {
    const { calls } = installFetchStub(habitsHandlers());
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole("button", { name: /add habit/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/name/i), "Read 10 pages");
    await user.selectOptions(within(dialog).getByLabelText(/type/i), "BUILD");
    await user.click(within(dialog).getByRole("button", { name: /^add habit$/i }));

    // Modal closes after successful creation.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // New habit appears in the refreshed list.
    expect(await screen.findByText("Read 10 pages")).toBeInTheDocument();
    // POST body uses the existing contract, no extra fields.
    const post = calls.find((c) => c.path === "/api/habits" && c.method === "POST");
    expect(post).toBeDefined();
    expect(post!.body).toEqual({ name: "Read 10 pages", type: "BUILD", startDate: expect.any(String) });
    // Success notice.
    expect(screen.getByRole("status")).toHaveTextContent(/created build habit/i);
    // stub used to fetch the refreshed list (initial load + after create).
    const habitGets = calls.filter((c) => c.path.startsWith("/api/habits") && c.method === "GET");
    expect(habitGets.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps the modal open on validation/API error and shows the error", async () => {
    const handlers = habitsHandlers();
    const original = handlers["/api/habits"];
    // Force the create POST to fail; GET delegates to the original.
    handlers["/api/habits"] = async (body: any) =>
      body
        ? { status: 400, json: { error: { code: "VALIDATION_ERROR", message: "Title is required" } } }
        : original(undefined);
    installFetchStub(handlers);
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole("button", { name: /add habit/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/name/i), "Bad habit");
    await user.click(within(dialog).getByRole("button", { name: /^add habit$/i }));

    // Modal stays open and the accessible error is shown inside it.
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/title is required/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("disables submit while creating and does not close during submission", async () => {
    const handlers = habitsHandlers();
    let release: () => void = () => {};
    handlers["/api/habits"] = (body: any) => {
      if (body) {
        // Pending promise: submit is in flight until we release it.
        return new Promise((resolve) => {
          release = () =>
            resolve({ status: 201, json: { id: 99, name: body.name, type: body.type, startDate: body.startDate, stats: {} } });
        });
      }
      return { status: 200, json: { habits: [] } };
    };
    installFetchStub(handlers);
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole("button", { name: /add habit/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/name/i), "Slow habit");
    await user.click(within(dialog).getByRole("button", { name: /^add habit$/i }));

    // While in flight: submit disabled and labeled Creating, modal still open.
    expect(within(dialog).getByRole("button", { name: /creating/i })).toBeDisabled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Escape does not close while creating.
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    release();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("returns focus to the Add habit trigger when the modal closes", async () => {
    installFetchStub(habitsHandlers());
    const user = userEvent.setup();
    await renderDashboard();

    const trigger = screen.getByRole("button", { name: /add habit/i });
    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("keeps existing dashboard functionality intact (complete today, view details)", async () => {
    const { stub, calls } = installFetchStub(habitsHandlers());
    const user = userEvent.setup();
    await renderDashboard();

    // Complete today still works.
    await user.click(screen.getByRole("button", { name: /complete today/i }));
    await waitFor(() => {
      const put = calls.find((c) => c.path.startsWith("/api/habits/") && c.method === "PUT");
      expect(put).toBeDefined();
    });
    expect(stub).toHaveBeenCalled();

    // View details links still navigate (one per habit card).
    const detailsLinks = screen.getAllByRole("link", { name: /view details/i });
    expect(detailsLinks.length).toBeGreaterThanOrEqual(1);
    expect(detailsLinks[0]).toHaveAttribute("href", "/habits/1");
  });
});
