// Snake-case → camelCase normalization layer
// Preserves original raw payload under __raw for debugging

const SNAKE_TO_CAMEL_MAP: Record<string, string> = {
  run_id: "runId",
  task_id: "taskId",
  created_at: "createdAt",
  started_at: "startedAt",
  completed_at: "completedAt",
  updated_at: "updatedAt",
  requested_at: "requestedAt",
  reviewed_at: "reviewedAt",
  api_key_version: "apiKeyVersion",
  skill_id: "skillId",
};

function normalizeKey(key: string): string {
  return SNAKE_TO_CAMEL_MAP[key] ?? key;
}

export function normalizeObject<T>(obj: unknown): T {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeObject(item)) as T;
  }

  const raw = JSON.parse(JSON.stringify(obj));
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const camelKey = normalizeKey(key);
    result[camelKey] = normalizeObject(value);
    // Keep original key too if it was remapped (avoids breaking anything)
    if (camelKey !== key) {
      result[key] = value;
    }
  }

  result.__raw = raw;
  return result as T;
}
