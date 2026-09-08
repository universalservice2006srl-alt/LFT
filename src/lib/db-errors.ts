/**
 * Drizzle wraps driver errors (message becomes "Failed query: …"), so unique
 * violations must be detected by walking the `cause` chain for SQLSTATE 23505.
 */
export function isUniqueViolation(error: unknown): boolean {
  let e: unknown = error;
  for (let i = 0; i < 5 && e; i++) {
    const candidate = e as { code?: string; message?: string; cause?: unknown };
    if (candidate.code === "23505") return true;
    if (typeof candidate.message === "string" && /duplicate key value/i.test(candidate.message)) {
      return true;
    }
    e = candidate.cause;
  }
  return false;
}
