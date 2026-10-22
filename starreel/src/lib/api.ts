// Browser-side API client.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The session ran out or a grown-up locked the parent room. */
  get needsUnlock(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

async function errorFrom(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // Not JSON; keep the generic message.
  }
  return new ApiError(response.status, message);
}

export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: json === undefined ? rest.headers : { "content-type": "application/json", ...rest.headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
    cache: "no-store",
  });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as T;
}

/**
 * Sends people whose session lapsed back to the right PIN pad. A full page
 * load drops anything cached client-side; replace() keeps the locked page out
 * of the Back history.
 */
export function goToUnlock(mode: "family" | "parent") {
  const next = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams({ next });
  if (mode === "parent") params.set("mode", "parent");
  window.location.replace(`/unlock?${params}`);
}

export interface UploadHandle {
  done: Promise<{ id: string; title: string }>;
  cancel: () => void;
}

/**
 * Streams a file to /api/upload as the raw request body. XMLHttpRequest
 * because fetch() can't report upload progress.
 */
export function uploadVideo(file: File, title: string, onProgress: (fraction: number) => void): UploadHandle {
  const xhr = new XMLHttpRequest();
  const done = new Promise<{ id: string; title: string }>((resolve, reject) => {
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-video-title", encodeURIComponent(title));
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      const body = xhr.response as { video?: { id: string; title: string }; error?: string } | null;
      if (xhr.status === 201 && body?.video) resolve(body.video);
      else reject(new ApiError(xhr.status, body?.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, "The connection dropped. Check the Wi-Fi and try again."));
    xhr.onabort = () => reject(new ApiError(0, "Upload cancelled."));
    xhr.send(file);
  });
  return { done, cancel: () => xhr.abort() };
}
