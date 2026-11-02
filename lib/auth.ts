/**
 * Authentication system that validates against the actual router.
 * Router credentials are stored in an encrypted session cookie.
 */

import { cookies } from "next/headers";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

const SECRET = process.env.SESSION_SECRET ?? "changeme-secret-32chars-minimum!";

// Derive a 32-byte key from the secret for AES-256
const ENCRYPTION_KEY = createHash("sha256").update(SECRET).digest();

// ── encryption helpers ───────────────────────────────────────────────────────

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

function decrypt(text: string): string | null {
  try {
    const [ivHex, encrypted] = text.split(":");
    if (!ivHex || !encrypted) return null;
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

// ── token helpers ────────────────────────────────────────────────────────────

function sign(payload: string): string {
  const hmac = createHash("sha256")
    .update(payload + SECRET)
    .digest("hex");
  return `${payload}.${hmac}`;
}

function verify(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const hmac = token.slice(idx + 1);
  const expected = createHash("sha256")
    .update(payload + SECRET)
    .digest("hex");
  return hmac === expected ? payload : null;
}

// ── session data ─────────────────────────────────────────────────────────────

export interface RouterCredentials {
  ip: string;
  username: string;
  password: string;
}

// ── public API ───────────────────────────────────────────────────────────────

export async function createSession(credentials: RouterCredentials): Promise<void> {
  const data = JSON.stringify(credentials);
  const encrypted = encrypt(data);
  const token = sign(encrypted);
  
  const cookieStore = await cookies();
  cookieStore.set("wifi_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("wifi_session");
}

export async function isAuthenticated(): Promise<boolean> {
  const creds = await getRouterCredentials();
  return creds !== null;
}

export async function getRouterCredentials(): Promise<RouterCredentials | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("wifi_session")?.value;
  if (!token) return null;
  
  const payload = verify(token);
  if (!payload) return null;
  
  const decrypted = decrypt(payload);
  if (!decrypted) return null;
  
  try {
    const credentials = JSON.parse(decrypted) as RouterCredentials;
    if (!credentials.ip || !credentials.username || !credentials.password) {
      return null;
    }
    return credentials;
  } catch {
    return null;
  }
}
