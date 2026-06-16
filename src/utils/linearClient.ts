/**
 * Linear GraphQL client (server-only).
 *
 * Wraps the Linear `https://api.linear.app/graphql` endpoint with:
 *   - 10s timeout (AbortController)
 *   - 1 retry on 5xx server errors, no retry on 4xx (except 429 with 2s backoff)
 *   - Custom error classes so callers can distinguish auth, rate-limit, and network
 *
 * SECURITY: this module only ever sees the plaintext API key inside the
 * `Authorization: <key>` header. It MUST NOT log, persist, or return the
 * key to its caller — `validateApiKey` returns only the safe subset
 * `{ id, name, email }`, and `fetchIssues` returns the issue list.
 */

const LINEAR_GQL_URL = "https://api.linear.app/graphql";
const REQUEST_TIMEOUT_MS = 10_000;
const RATE_LIMIT_BACKOFF_MS = 2_000;
const USER_AGENT = "workshop-kiro-task-manager/0.1";

export interface LinearViewer {
  id: string;
  name: string;
  email: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  state: { id: string; name: string };
  priority: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Error taxonomy
// ---------------------------------------------------------------------------

export class LinearError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "LinearError";
    this.code = code;
  }
}

export class LinearAuthError extends LinearError {
  constructor(message = "API key inválido o sin acceso") {
    super(message, "linear_auth");
    this.name = "LinearAuthError";
  }
}

export class LinearRateLimitError extends LinearError {
  readonly retryAfterMs: number;
  constructor(retryAfterMs = RATE_LIMIT_BACKOFF_MS) {
    super("Linear limitó las peticiones. Espera un momento.", "linear_rate_limit");
    this.name = "LinearRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class LinearNetworkError extends LinearError {
  constructor(message = "No se pudo conectar con Linear. Inténtalo de nuevo.") {
    super(message, "linear_network");
    this.name = "LinearNetworkError";
  }
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

interface RequestOptions {
  /** Number of retries remaining (default 1 = 1 retry on 5xx). */
  retriesLeft?: number;
  /** Internal: AbortController for the whole call chain (timeout). */
  outerSignal?: AbortSignal;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new LinearNetworkError("Petición cancelada");
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true },
      );
    }
  });
}

async function gqlFetch<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown> = {},
  opts: RequestOptions = {},
): Promise<T> {
  const { retriesLeft = 1, outerSignal } = opts;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    outerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(LINEAR_GQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    // Network failure or timeout — retry once if available
    if (retriesLeft > 0) {
      await sleep(500, outerSignal);
      return gqlFetch(apiKey, query, variables, {
        retriesLeft: retriesLeft - 1,
        outerSignal,
      });
    }
    if (e instanceof Error && e.name === "AbortError") {
      throw new LinearNetworkError("La petición a Linear excedió el tiempo máximo (10s)");
    }
    throw new LinearNetworkError();
  }
  clearTimeout(timeoutId);

  // Status code handling
  if (response.status === 401 || response.status === 403) {
    throw new LinearAuthError();
  }
  if (response.status === 429) {
    if (retriesLeft > 0) {
      await sleep(RATE_LIMIT_BACKOFF_MS, outerSignal);
      return gqlFetch(apiKey, query, variables, {
        retriesLeft: retriesLeft - 1,
        outerSignal,
      });
    }
    throw new LinearRateLimitError();
  }
  if (response.status >= 500) {
    if (retriesLeft > 0) {
      await sleep(500, outerSignal);
      return gqlFetch(apiKey, query, variables, {
        retriesLeft: retriesLeft - 1,
        outerSignal,
      });
    }
    throw new LinearNetworkError(`Linear devolvió un error ${response.status}`);
  }
  if (!response.ok) {
    throw new LinearNetworkError(`Linear devolvió un error ${response.status}`);
  }

  let body: GraphQLResponse<T>;
  try {
    body = (await response.json()) as GraphQLResponse<T>;
  } catch {
    throw new LinearNetworkError("Respuesta inválida de Linear");
  }

  if (body.errors && body.errors.length > 0) {
    // GraphQL-level auth failures often surface as errors with a specific code.
    const authError = body.errors.find(
      (e) => e.extensions?.code === "AUTHENTICATION_ERROR" || /auth/i.test(e.message),
    );
    if (authError) throw new LinearAuthError();
    throw new LinearNetworkError(body.errors[0]?.message ?? "Error de Linear");
  }
  if (body.data === undefined || body.data === null) {
    throw new LinearNetworkError("Linear devolvió una respuesta vacía");
  }
  return body.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates an API key by issuing a minimal `viewer` query.
 * Returns the safe subset `{ id, name, email }` (NEVER the key).
 *
 * Throws `LinearAuthError` if the key is empty or invalid (no network call
 * is made for an empty key — the early-return is intentional and documented
 * for the unit tests).
 */
export async function validateApiKey(apiKey: string): Promise<LinearViewer> {
  if (!apiKey || apiKey.trim() === "") {
    throw new LinearAuthError();
  }
  const data = await gqlFetch<{ viewer: LinearViewer | null }>(
    apiKey,
    "query Viewer { viewer { id name email } }",
  );
  if (!data.viewer) {
    throw new LinearAuthError();
  }
  return data.viewer;
}

/**
 * Fetches the first N issues from Linear (most recently updated first).
 * Returns a normalized `LinearIssue[]`.
 */
export async function fetchIssues(apiKey: string, first = 50): Promise<LinearIssue[]> {
  if (!apiKey || apiKey.trim() === "") {
    throw new LinearAuthError();
  }
  const data = await gqlFetch<{
    issues: {
      nodes: Array<{
        id: string;
        identifier: string;
        title: string;
        url: string;
        priority: number;
        updatedAt: string;
        state: { id: string; name: string };
      }>;
    };
  }>(
    apiKey,
    `query Issues($first: Int!) {
      issues(first: $first, orderBy: updatedAt) {
        nodes {
          id identifier title url priority updatedAt
          state { id name }
        }
      }
    }`,
    { first },
  );
  return data.issues.nodes;
}
