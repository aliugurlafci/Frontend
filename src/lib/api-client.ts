/**
 * Phase U4 — client-side API helper.
 *
 * Used by client components to call the REST API. Attaches the CSRF token from
 * the cookie (double-submit) and supports extra headers (e.g. If-Match for
 * optimistic concurrency). On failure it throws an `ApiRequestError` carrying
 * the structured code + per-field details so forms can show inline errors.
 */
export interface FieldDetail {
  field?: string;
  message: string;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details: FieldDetail[] = [],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  /** Map field-scoped details into a { field: message } record. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details) if (d.field) out[d.field] = d.message;
    return out;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

interface ErrorPayload {
  error?: { code?: string; message?: string; details?: FieldDetail[] };
}

export async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json", ...opts.headers };
  const csrf = getCookie("aula_csrf");
  if (csrf) headers["x-csrf-token"] = csrf;

  const res = await fetch(`/api/v1${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const json = (await res.json().catch(() => ({}))) as T & ErrorPayload;
  if (!res.ok) {
    throw new ApiRequestError(
      json?.error?.code ?? "ERROR",
      res.status,
      json?.error?.message ?? `Request failed (${res.status})`,
      json?.error?.details ?? [],
    );
  }
  return json as T;
}

/**
 * Upload multipart form data (e.g. a file). The browser sets the multipart
 * boundary, so we must not set content-type ourselves. CSRF is attached the
 * same way as {@link apiFetch}.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const csrf = getCookie("aula_csrf");
  if (csrf) headers["x-csrf-token"] = csrf;

  const res = await fetch(`/api/v1${path}`, { method: "POST", headers, body: form });
  const json = (await res.json().catch(() => ({}))) as T & ErrorPayload;
  if (!res.ok) {
    throw new ApiRequestError(
      json?.error?.code ?? "ERROR",
      res.status,
      json?.error?.message ?? `Upload failed (${res.status})`,
      json?.error?.details ?? [],
    );
  }
  return json as T;
}

/**
 * Upload multipart form data with progress reporting. `fetch` can't surface
 * upload progress, so this uses XMLHttpRequest and calls `onProgress(0..100)`
 * as the body is sent. Same CSRF handling as {@link apiUpload}.
 */
export function apiUploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1${path}`);
    const csrf = getCookie("aula_csrf");
    if (csrf) xhr.setRequestHeader("x-csrf-token", csrf);
    // Do not set content-type — the browser adds the multipart boundary.

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let json: (T & ErrorPayload) | Record<string, never> = {};
      try {
        json = JSON.parse(xhr.responseText) as T & ErrorPayload;
      } catch {
        /* non-JSON body */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json as T);
      } else {
        const err = (json as ErrorPayload).error;
        reject(new ApiRequestError(err?.code ?? "ERROR", xhr.status, err?.message ?? `Upload failed (${xhr.status})`, err?.details ?? []));
      }
    };
    xhr.onerror = () => reject(new ApiRequestError("NETWORK", 0, "Network error during upload"));
    xhr.onabort = () => reject(new ApiRequestError("ABORTED", 0, "Upload cancelled"));

    xhr.send(form);
  });
}
