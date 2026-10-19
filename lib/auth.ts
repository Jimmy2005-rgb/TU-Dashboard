/**
 * Minimal single-user password gate. Works in both the Edge (middleware) and
 * Node runtimes because it only uses Web Crypto.
 */
export const SESSION_COOKIE = "tu_hub_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function isAuthEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cookie value derived from the password; changing APP_PASSWORD logs everyone out. */
export async function expectedSessionToken(): Promise<string> {
  return sha256Hex(`tu-hub-session:v1:${process.env.APP_PASSWORD ?? ""}`);
}

/** Length-independent constant-time string comparison. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}
