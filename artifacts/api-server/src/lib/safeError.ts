export function clientErrorMessage(err: unknown, fallback = "Request failed"): string {
  if (process.env.NODE_ENV === "production") {
    return fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

export function internalErrorMessage(): string {
  return "Internal server error";
}
