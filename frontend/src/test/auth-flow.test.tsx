import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, getStoredToken } from "../context/AuthContext";
import App from "../App";

// In-memory fetch stub: returns the same shape the backend serves through
// nginx (same-origin /api). No real credentials or tokens in fixtures —
// these are synthetic test payloads.
type FetchCall = { path: string; body: unknown };

function installFetchStub(handlers: Record<string, (body: any) => { status: number; json: unknown }>) {
  const calls: FetchCall[] = [];
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, body });
    // Prefix match so ?refDate=... query strings resolve to the stub key.
    const key = Object.keys(handlers).find((k) => path.startsWith(k));
    if (!key) return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "no stub" } }), { status: 404, headers: { "Content-Type": "application/json" } });
    const { status, json } = handlers[key](body);
    return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", stub);
  return { stub, calls };
}

// Dashboard also fetches /api/habits?refDate=... on mount — stub it with an
// empty list so tests 3/4/6/7/9 don't error on the extra call.
const dashboardHandlers = {
  "/api/auth/me": (_body: unknown) => ({
    status: 200,
    json: { user: { id: 7, email: "carol@example.com", createdAt: "2026-01-01T00:00:00.000Z" } },
  }),
  "/api/habits?refDate=": (_body: unknown) => ({ status: 200, json: { habits: [] } }),
};

function renderApp(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

// ---- /api/auth/me bootstrap stub used by most tests ----
const meHandlers = {
  "/api/auth/me": (_body: unknown) => ({
    status: 200,
    json: { user: { id: 7, email: "carol@example.com", createdAt: "2026-01-01T00:00:00.000Z" } },
  }),
};

describe("Phase 7 auth flow", () => {
  it("1. login form renders", async () => {
    installFetchStub(meHandlers);
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("2. register form renders", async () => {
    installFetchStub(meHandlers);
    renderApp("/register");
    expect(await screen.findByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("3. valid registration succeeds and reaches the protected shell", async () => {
    const { stub, calls } = installFetchStub({
      "/api/auth/register": (body: any) => ({
        status: 201,
        json: { user: { id: 8, email: body.email, createdAt: "2026-01-01T00:00:00.000Z" }, token: "synthetic-jwt-register" },
      }),
      ...dashboardHandlers,
    });
    renderApp("/register");
    await userEvent.type(screen.getByLabelText(/email/i), "dave@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password-123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("heading", { name: /today's habits/i })).toBeInTheDocument();
    expect(getStoredToken()).toBe("synthetic-jwt-register");
    expect(calls.some((c) => c.path === "/api/auth/register")).toBe(true);
    // never logged: stub only records calls, no console output assertions needed here
    expect(stub).toHaveBeenCalled();
  });

  it("4. valid login succeeds and reaches the protected shell", async () => {
    const { calls } = installFetchStub({
      "/api/auth/login": (body: any) => ({
        status: 200,
        json: { user: { id: 9, email: body.email, createdAt: "2026-01-01T00:00:00.000Z" }, token: "synthetic-jwt-login" },
      }),
      ...dashboardHandlers,
    });
    renderApp("/login");
    await userEvent.type(screen.getByLabelText(/email/i), "erin@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password-456");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByRole("heading", { name: /today's habits/i })).toBeInTheDocument();
    expect(getStoredToken()).toBe("synthetic-jwt-login");
    expect(calls.some((c) => c.path === "/api/auth/login")).toBe(true);
  });

  it("5. invalid login displays the safe backend error", async () => {
    installFetchStub({
      "/api/auth/login": () => ({
        status: 401,
        json: { error: { code: "UNAUTHORIZED", message: "Invalid email or password" } },
      }),
      ...meHandlers,
    });
    renderApp("/login");
    await userEvent.type(screen.getByLabelText(/email/i), "erin@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(getStoredToken()).toBeNull();
    // still on login
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("6. authenticated user reaches the protected shell", async () => {
    localStorage.setItem("habit-shaper-token", "synthetic-jwt-pre");
    installFetchStub(dashboardHandlers);
    renderApp("/");
    expect(await screen.findByRole("heading", { name: /today's habits/i })).toBeInTheDocument();
  });

  it("7. /auth/me bootstrap restores session after reload", async () => {
    localStorage.setItem("habit-shaper-token", "synthetic-jwt-reload");
    const { calls } = installFetchStub(dashboardHandlers);
    renderApp("/");
    expect(await screen.findByRole("heading", { name: /today's habits/i })).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/api/auth/me")).toBe(true);
    expect(getStoredToken()).toBe("synthetic-jwt-reload");
  });

  it("8. invalid/expired stored token produces logged-out state", async () => {
    localStorage.setItem("habit-shaper-token", "expired-jwt");
    installFetchStub({
      "/api/auth/me": () => ({ status: 401, json: { error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } } }),
    });
    renderApp("/");
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(getStoredToken()).toBeNull();
  });

  it("9. logout clears the session and returns to login", async () => {
    localStorage.setItem("habit-shaper-token", "synthetic-jwt-logout");
    installFetchStub(dashboardHandlers);
    renderApp("/");
    await screen.findByRole("heading", { name: /today's habits/i });
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument());
    expect(getStoredToken()).toBeNull();
  });

  it("10. protected route cannot be accessed while unauthenticated", async () => {
    installFetchStub(meHandlers);
    renderApp("/");
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.queryByText(/today's habits/i)).not.toBeInTheDocument();
  });
});
