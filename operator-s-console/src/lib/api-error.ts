import { ApiError } from "@/lib/api-client";

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const body = error.body;
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      for (const key of ["reason", "message", "error"]) {
        if (typeof record[key] === "string" && record[key].trim()) {
          return record[key] as string;
        }
      }
    }
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
