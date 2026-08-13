import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, getStoredToken } from "../context/AuthContext";
import App from "../App";

// Phase 9 goals UI tests + modal-create coverage. Same in-memory fetch stub
// pattern as auth-flow.test.tsx — synthetic tokens, no live backend.

type FetchCall = { path: string; body: unknown; method: string };

type Handler = (body: any, init?: { method?: string }) => { status: number; json: unknown };

function installFetchStub(handlers: Record<string, Handler>) {
  const calls: FetchCall[] = [];
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, body, method: init?.method ?? "GET" });
    // Longest-prefix match so /api/goals/11 beats /api/goals for detail ops.
    const key = Object.keys(handlers)
      .filter((k) => path.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (!key) return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "no stub" } }), { status: 404, headers: { "Content-Type": "application/json" } });
    const { status, json } = handlers[key](body, { method: init?.method ?? "GET" });
    // 204 must have null body — an empty string body throws in jsdom for
    // null-body statuses, which the client correctly surfaces as NETWORK_ERROR.
    return new Response(status === 204 ? null : JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
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

// Stateful in-memory goal store: GET /api/goals returns current list; POST
// adds; DELETE /api/goals/:id removes (so list refresh reflects deletion);
// PATCH updates. Mirrors backend semantics for the UI tests.
function goalsHandlers() {
  const store: any[] = [
    {
      id: 11,
      habitId: 1,
      title: "Meditate daily",
      description: "10 min every morning",
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      habit: { id: 1, name: "Meditate", type: "BUILD" },
    },
  ];
  let nextId = 12;
  const habitFor = (habitId: number) =>
    habitId === 1 ? { id: 1, name: "Meditate", type: "BUILD" } : { id: 2, name: "Smoking", type: "BREAK" };

  return {
    "/api/auth/me": meHandler["/api/auth/me"],
    "/api/habits?refDate=": () => ({
      status: 200,
      json: {
        habits: [
          { id: 1, name: "Meditate", type: "BUILD", startDate: "2026-08-01", createdAt: "2026-08-01T00:00:00.000Z", stats: { currentStreak: 5 } },
          { id: 2, name: "Smoking", type: "BREAK", startDate: "2026-08-01", createdAt: "2026-08-01T00:00:00.000Z", stats: { cleanStreak: 3 } },
        ],
      },
    }),
    "/api/goals": (body: any, init: any) => {
      if (body === undefined && init?.method === "GET") {
        return { status: 200, json: { goals: store } };
      }
      const goal = {
        id: nextId++,
        habitId: body.habitId,
        title: body.title,
        description: body.description ?? null,
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
        habit: habitFor(body.habitId),
      };
      store.push(goal);
      return { status: 201, json: { goal } };
    },
    "/api/goals/11": (body: any, init?: { method?: string }) => {
      if (init?.method === "DELETE") {
        const idx = store.findIndex((g) => g.id === 11);
        if (idx >= 0) store.splice(idx, 1);
        return { status: 204, json: null };
      }
      // PATCH — return updated goal
      const g = store.find((x) => x.id === 11)!;
      if (body.title !== undefined) g.title = body.title;
      if (body.description !== undefined) g.description = body.description;
      if (body.habitId !== undefined) {
        g.habitId = body.habitId;
        g.habit = habitFor(body.habitId);
      }
      return { status: 200, json: { goal: g } };
    },
  };
}

function renderGoals(path = "/goals") {
  localStorage.setItem("habit-shaper-token", "synthetic-jwt-goals");
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function renderGoalsNoToken(path = "/goals") {
  localStorage.removeItem("habit-shaper-token");
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function getEditForm(): HTMLFormElement {
  // Edit form input carries id goal-edit-title-<goalId> — anchor via id,
  // then scope queries to the containing form (create form shares labels).
  const input = document.getElementById("goal-edit-title-11") as HTMLInputElement;
  if (!input) throw new Error("edit form not open");
  return input.closest("form") as HTMLFormElement;
}

// Open the create modal and return the dialog element.
async function openCreateDialog() {
  await userEvent.click(screen.getByRole("button", { name: /add goal/i }));
  return await screen.findByRole("dialog", { name: /add a new goal/i });
}

describe("Phase 9 goals", () => {
  it("1. goals route is protected", async () => {
    installFetchStub(meHandler);
    renderGoalsNoToken("/goals");
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
  });

  it("2. page is content-first: no permanent create form, Add goal CTA present", async () => {
    installFetchStub({
      "/api/auth/me": meHandler["/api/auth/me"],
      "/api/habits?refDate=": () => ({
        status: 200,
        json: {
          habits: [{ id: 1, name: "Meditate", type: "BUILD", startDate: "2026-08-01", createdAt: "2026-08-01T00:00:00.000Z", stats: {} }],
        },
      }),
      "/api/goals": () => ({ status: 200, json: { goals: [] } }),
    });
    renderGoals();
    expect(await screen.findByRole("heading", { name: /^goals$/i })).toBeInTheDocument();
    expect(screen.getByText(/no goals yet/i)).toBeInTheDocument();
    // no permanently visible create form on the page
    expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create goal/i })).not.toBeInTheDocument();
    // CTA exists
    expect(screen.getByRole("button", { name: /add goal/i })).toBeInTheDocument();
  });

  it("3. Add goal opens an accessible dialog with BUILD + BREAK habits", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    const dialog = await openCreateDialog();
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const select = within(dialog).getByLabelText(/linked habit/i);
    expect(select).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: /meditate — build/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: /smoking — break/i })).toBeInTheDocument();
  });

  it("4. no-habits state explains a habit is required (no Add goal CTA)", async () => {
    installFetchStub({
      "/api/auth/me": meHandler["/api/auth/me"],
      "/api/habits?refDate=": () => ({ status: 200, json: { habits: [] } }),
      "/api/goals": () => ({ status: 200, json: { goals: [] } }),
    });
    renderGoals();
    expect(await screen.findByText(/create a habit before adding a goal/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add goal/i })).not.toBeInTheDocument();
  });

  it("5. create goal posts habitId + title + description (no userId)", async () => {
    const { calls } = installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    await openCreateDialog();
    await userEvent.type(screen.getByLabelText(/title/i), "Quit smoking");
    await userEvent.type(screen.getByLabelText(/description/i), "No cigarettes");
    await userEvent.selectOptions(screen.getByLabelText(/linked habit/i), "2");
    await userEvent.click(within(screen.getByRole("dialog", { name: /add a new goal/i })).getByRole("button", { name: /add goal/i }));

    await waitFor(() => {
      const post = calls.find((c) => c.path === "/api/goals" && c.method === "POST");
      expect(post).toBeDefined();
      expect(post?.body).toEqual({ habitId: 2, title: "Quit smoking", description: "No cigarettes" });
      expect(JSON.stringify(post?.body)).not.toContain("userId");
    });
  });

  it("6. create goal success closes dialog and refreshes the list", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    await openCreateDialog();
    await userEvent.type(screen.getByLabelText(/title/i), "Run 5k");
    await userEvent.selectOptions(screen.getByLabelText(/linked habit/i), "1");
    await userEvent.click(within(screen.getByRole("dialog", { name: /add a new goal/i })).getByRole("button", { name: /add goal/i }));

    expect(await screen.findByText(/goal created/i)).toBeInTheDocument();
    // dialog closed
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // list refreshed — the pre-existing goal is still there
    expect(await screen.findByText(/meditate daily/i)).toBeInTheDocument();
  });

  it("7. create API error keeps dialog open, shows error, keeps values", async () => {
    installFetchStub({
      ...goalsHandlers(),
      // Override the collection key: GET list ok, POST fails validation.
      "/api/goals": (_body: any, init: any) =>
        init?.method === "POST"
          ? { status: 400, json: { error: { code: "VALIDATION_ERROR", message: "Title is required" } } }
          : { status: 200, json: { goals: [] } },
    });
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    await openCreateDialog();
    await userEvent.type(screen.getByLabelText(/title/i), "X");
    await userEvent.selectOptions(screen.getByLabelText(/linked habit/i), "1");
    await userEvent.click(within(screen.getByRole("dialog", { name: /add a new goal/i })).getByRole("button", { name: /add goal/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required");
    // dialog still open, values kept
    expect(screen.getByRole("dialog", { name: /add a new goal/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe("X");
  });

  it("8. goal list renders embedded linked habit data", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    expect(await screen.findByText(/meditate daily/i)).toBeInTheDocument();
    expect(screen.getByText(/10 min every morning/i)).toBeInTheDocument();
    // linked habit name + type appear in the goal card (scoped to the list)
    const card = screen.getByText(/meditate daily/i).closest("li")!;
    expect(within(card).getByText("Meditate")).toBeInTheDocument();
    expect(within(card).getByText("BUILD")).toBeInTheDocument();
  });

  it("9. dialog closes via X", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    await openCreateDialog();
    await userEvent.click(screen.getByRole("button", { name: /close dialog/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("10. dialog closes via Cancel", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    await openCreateDialog();
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("11. dialog closes via Escape", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    await openCreateDialog();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("12. dialog closes via backdrop click", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    await openCreateDialog();
    // click the backdrop itself (outside the dialog panel)
    const backdrop = document.querySelector(".modal-backdrop")!;
    await userEvent.click(backdrop);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("13. form resets after successful create (reopen is fresh)", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    await openCreateDialog();
    await userEvent.type(screen.getByLabelText(/title/i), "Run 5k");
    await userEvent.selectOptions(screen.getByLabelText(/linked habit/i), "1");
    await userEvent.click(within(screen.getByRole("dialog", { name: /add a new goal/i })).getByRole("button", { name: /add goal/i }));
    await screen.findByText(/goal created/i);
    // reopen — form is fresh
    await openCreateDialog();
    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/linked habit/i) as HTMLSelectElement).value).toBe("");
  });

  it("14. focus returns to Add goal trigger after close", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    await openCreateDialog();
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /add goal/i })).toHaveFocus();
  });

  it("15. edit goal title saves", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByText(/meditate daily/i);
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    const editForm = getEditForm();
    const titleInput = within(editForm).getByLabelText(/title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Meditate 15 min");
    await userEvent.click(within(editForm).getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/goal updated/i)).toBeInTheDocument();
  });

  it("16. clear description on edit sends null", async () => {
    const { calls } = installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByText(/meditate daily/i);
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    const editForm = getEditForm();
    const desc = within(editForm).getByLabelText(/description/i);
    await userEvent.clear(desc);
    await userEvent.click(within(editForm).getByRole("button", { name: /save/i }));
    await waitFor(() => {
      const patch = calls.find((c) => c.path.startsWith("/api/goals/11") && c.method === "PATCH");
      expect(patch?.method).toBe("PATCH");
      expect(patch?.body).toMatchObject({ description: null });
    });
  });

  it("17. relink goal to another owned habit", async () => {
    const { calls } = installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByText(/meditate daily/i);
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    const editForm = getEditForm();
    await userEvent.selectOptions(within(editForm).getByLabelText(/linked habit/i), "2");
    await userEvent.click(within(editForm).getByRole("button", { name: /save/i }));
    await waitFor(() => {
      const patch = calls.find((c) => c.path.startsWith("/api/goals/11") && c.method === "PATCH");
      expect(patch?.body).toMatchObject({ habitId: 2 });
    });
  });

  it("18. delete goal confirms and removes from UI", async () => {
    const { calls } = installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByText(/meditate daily/i);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true), { timeout: 3000 });
    // after delete, the goal disappears (list refresh after DELETE)
    await waitFor(() => expect(screen.queryByText(/meditate daily/i)).not.toBeInTheDocument(), { timeout: 3000 });
  });

  it("19. cancel delete (confirm=false) keeps goal", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByText(/meditate daily/i);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(screen.getByText(/meditate daily/i)).toBeInTheDocument();
  });

  it("20. deleting a goal leaves the linked habit intact", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByText(/meditate daily/i);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(screen.queryByText(/meditate daily/i)).not.toBeInTheDocument());
    // habit list still fetched and rendered — navigate to dashboard
    await userEvent.click(screen.getByRole("link", { name: /dashboard/i }));
    expect(await screen.findByRole("heading", { name: /today's habits/i })).toBeInTheDocument();
    expect(screen.getByText(/meditate/i)).toBeInTheDocument();
    expect(screen.getByText(/smoking/i)).toBeInTheDocument();
  });

  it("21. logout still works from goals page", async () => {
    installFetchStub(goalsHandlers());
    renderGoals();
    await screen.findByRole("heading", { name: /^goals$/i });
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument());
    expect(getStoredToken()).toBeNull();
  });
});
