/**
 * DataVault — API helpers: uniform responses, auth guards, error handling (spec §48).
 */
import { NextResponse } from "next/server";
import { AuthError, requireUser, requireRole, getSessionUser, type SessionUser } from "./auth";
import { ensureSeeded } from "./seed";

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

type Handler = (ctx: { user: SessionUser }) => Promise<NextResponse>;

/** Wrap a route handler with authentication + uniform error handling. */
export async function withAuth(handler: Handler, roles?: string[]): Promise<NextResponse> {
  try {
    await ensureSeeded();
    const user = roles ? await requireRole(...roles) : await requireUser();
    return await handler({ user });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Public route wrapper (no auth) with error handling. */
export async function withPublic(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    await ensureSeeded();
    return await handler();
  } catch (err) {
    return errorResponse(err);
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) return fail(err.message, err.status);
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[api]", err);
  return fail(message, 500);
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export { requireUser, requireRole, getSessionUser };
