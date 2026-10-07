/**
 * DataVault — Authentication & RBAC (spec §7, §26, §33).
 * JWT (HMAC-SHA256 via node:crypto) in httpOnly cookies + scrypt password hashing.
 * Roles: ADMIN | ORG_ADMIN | ML_OPERATOR | PARTICIPANT | VIEWER
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

const SECRET = process.env.JWT_SECRET || "datavault-dev-secret-change-me";
const COOKIE = "datavault_session";
const TTL = 60 * 60 * 24 * 3; // 3 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string | null;
  organizationName?: string | null;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");

export function signToken(user: SessionUser): string {
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...user, iat: Date.now(), exp: Date.now() + TTL * 1000 }));
  const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): SessionUser | null {
  const [header, body, sig] = token.split(".");
  if (!header || !body || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return { id: payload.id, email: payload.email, name: payload.name, role: payload.role, organizationId: payload.organizationId, organizationName: payload.organizationName };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const jar = await cookies();
  jar.set(COOKIE, signToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Require any authenticated session. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new AuthError("Authentication required", 401);
  return u;
}

/** Require one of the given roles. */
export async function requireRole(...roles: string[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new AuthError(`Requires role: ${roles.join(" | ")}`, 403);
  return u;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Simple in-memory rate limiter (per-process, demo-grade). */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Platform Admin",
  ORG_ADMIN: "Organization Admin",
  ML_OPERATOR: "Data Scientist / ML Operator",
  PARTICIPANT: "Participant",
  VIEWER: "Marketplace Viewer",
};
