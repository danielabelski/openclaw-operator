import {
  createSharedCoordinationStore,
  type CoordinationHealth,
} from "../../shared/runtime-coordination.js";

export type RedditHelperBudgetState = {
  budgetDate: string;
  llmCallsToday: number;
  tokensToday: number;
  budgetStatus: "ok" | "exhausted";
  lastBudgetExceededAt?: string;
};

const coordinationStore = createSharedCoordinationStore({
  prefix: "openclaw:orchestrator:coordination",
  loggerPrefix: "reddit-helper-coordination",
});

const PROCESSED_DRAFT_IDS_KEY = "processed-draft-ids";
const PROCESSED_DRAFT_IDS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROCESSED_DRAFT_IDS_LIMIT = 500;
const BUDGET_STATE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export async function getRedditCoordinationHealth(): Promise<CoordinationHealth> {
  return coordinationStore.getHealth();
}

export async function loadSharedBudgetState(
  budgetDate: string,
): Promise<RedditHelperBudgetState> {
  const existing = await coordinationStore.getJson<RedditHelperBudgetState>(
    "reddit-helper-budget",
    budgetDate,
  );

  if (
    existing.value &&
    existing.value.budgetDate === budgetDate &&
    typeof existing.value.llmCallsToday === "number" &&
    typeof existing.value.tokensToday === "number"
  ) {
    return {
      budgetDate,
      llmCallsToday: existing.value.llmCallsToday,
      tokensToday: existing.value.tokensToday,
      budgetStatus: existing.value.budgetStatus === "exhausted" ? "exhausted" : "ok",
      lastBudgetExceededAt: existing.value.lastBudgetExceededAt,
    };
  }

  return {
    budgetDate,
    llmCallsToday: 0,
    tokensToday: 0,
    budgetStatus: "ok",
  };
}

export async function saveSharedBudgetState(state: RedditHelperBudgetState) {
  await coordinationStore.setJson(
    "reddit-helper-budget",
    state.budgetDate,
    state,
    { ttlMs: BUDGET_STATE_TTL_MS },
  );
}

export async function loadProcessedDraftIds() {
  const existing = await coordinationStore.getJson<{ processedIds?: string[] }>(
    "reddit-helper-service",
    PROCESSED_DRAFT_IDS_KEY,
  );
  if (!Array.isArray(existing.value?.processedIds)) {
    return [];
  }
  return existing.value.processedIds
    .map((draftId) => String(draftId).trim())
    .filter((draftId) => draftId.length > 0)
    .slice(0, PROCESSED_DRAFT_IDS_LIMIT);
}

export async function rememberProcessedDraftId(draftId: string) {
  const current = await loadProcessedDraftIds();
  const next = [draftId, ...current.filter((existing) => existing !== draftId)].slice(
    0,
    PROCESSED_DRAFT_IDS_LIMIT,
  );
  await coordinationStore.setJson(
    "reddit-helper-service",
    PROCESSED_DRAFT_IDS_KEY,
    { processedIds: next },
    { ttlMs: PROCESSED_DRAFT_IDS_TTL_MS },
  );
  return next;
}

export async function closeRedditCoordinationStore() {
  await coordinationStore.close();
}

export async function resetRedditCoordinationStoreForTests() {
  await coordinationStore.resetMemory();
}
