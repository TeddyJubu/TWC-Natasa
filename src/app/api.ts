/**
 * POSTs to one of our body-carrying routes (/api/images, /api/neighborhood-logos, /api/applications, /api/contact): FormData as
 * multipart, anything else as JSON. Resolves the JSON result (undefined for 204); throws the server's message.
 */
export async function postApi<T>(path: string, body: FormData | object): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
  });
  const data = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) throw new Error((data as { error?: string } | undefined)?.error || "Something went wrong. Please try again.");
  return data as T;
}
