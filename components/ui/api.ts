/**
 * Small fetch wrapper for the app's API routes. Sends JSON, or multipart form
 * data when `body` is a FormData (file uploads). Throws with the server's error message.
 */
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(url, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: isForm ? (init!.body as FormData) : init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) window.location.href = "/login";
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data as T;
}
