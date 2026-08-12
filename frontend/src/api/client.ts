// Thin fetch wrapper (architecture.md §2): relative /api paths (same-origin
// through nginx in prod, Vite proxy in dev), Bearer token attached when
// authenticated, uniform { error: { code, message } } parsing. Never logs
// tokens or passwords.

export type ApiErrorBody = { error: { code: string; message: string } };

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export type RequestOptions = {
  token?: string | null;
  body?: unknown;
};

// Parses the backend's uniform error shape; falls back to a safe generic
// message for non-JSON/unexpected responses (no internal details leaked).
export function parseApiError(status: number, data: unknown): ApiClientError {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as ApiErrorBody).error;
    if (err && typeof err.message === "string") {
      return new ApiClientError(status, err.code, err.message);
    }
  }
  return new ApiClientError(status, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

// Relative /api path — never a hard-coded backend host (same-origin, STEP 1).
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method: options.body !== undefined ? "POST" : "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Cannot reach the server. Please check your connection.");
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null; // empty/non-JSON body → fall through to generic error
  }

  if (!res.ok) throw parseApiError(res.status, data);
  return data as T;
}
