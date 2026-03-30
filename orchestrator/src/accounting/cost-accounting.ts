import type {
  TaskExecutionAccounting,
  TaskExecutionBudget,
  TaskExecutionRecord,
  TaskExecutionUsage,
} from "../types.js";

type PricingCatalogEntry = {
  provider: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
};

const DEFAULT_MODEL_PRICING: Record<string, PricingCatalogEntry> = {
  "gpt-4": {
    provider: "openai",
    inputUsdPer1M: 30,
    outputUsdPer1M: 60,
  },
  "gpt-4-turbo": {
    provider: "openai",
    inputUsdPer1M: 10,
    outputUsdPer1M: 30,
  },
  "gpt-3.5-turbo": {
    provider: "openai",
    inputUsdPer1M: 0.5,
    outputUsdPer1M: 1.5,
  },
  "gpt-4o": {
    provider: "openai",
    inputUsdPer1M: 5,
    outputUsdPer1M: 15,
  },
  "gpt-4o-mini": {
    provider: "openai",
    inputUsdPer1M: 0.6,
    outputUsdPer1M: 2.4,
  },
  "gpt-4.1": {
    provider: "openai",
    inputUsdPer1M: 2,
    outputUsdPer1M: 8,
  },
  "gpt-4.1-mini": {
    provider: "openai",
    inputUsdPer1M: 0.8,
    outputUsdPer1M: 3.2,
  },
  "gpt-4.1-nano": {
    provider: "openai",
    inputUsdPer1M: 0.2,
    outputUsdPer1M: 0.8,
  },
  "gpt-5.4": {
    provider: "openai",
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 15,
  },
  "gpt-5.4-mini": {
    provider: "openai",
    inputUsdPer1M: 0.75,
    outputUsdPer1M: 4.5,
  },
  "gpt-5.4-nano": {
    provider: "openai",
    inputUsdPer1M: 0.2,
    outputUsdPer1M: 1.25,
  },
};

function normalizeModelKey(model: string) {
  return model.trim().toLowerCase();
}

function readPricingOverrideCatalog() {
  const raw = process.env.OPENCLAW_MODEL_PRICING_JSON?.trim();
  if (!raw) {
    return new Map<string, PricingCatalogEntry>();
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<PricingCatalogEntry>>;
    const entries = Object.entries(parsed)
      .filter(([, value]) =>
        Boolean(
          value &&
            typeof value.inputUsdPer1M === "number" &&
            Number.isFinite(value.inputUsdPer1M) &&
            typeof value.outputUsdPer1M === "number" &&
            Number.isFinite(value.outputUsdPer1M),
        ),
      )
      .map(([model, value]) => [
        normalizeModelKey(model),
        {
          provider:
            typeof value.provider === "string" && value.provider.trim().length > 0
              ? value.provider.trim()
              : "custom",
          inputUsdPer1M: Number(value.inputUsdPer1M),
          outputUsdPer1M: Number(value.outputUsdPer1M),
        },
      ] as const);

    return new Map<string, PricingCatalogEntry>(entries);
  } catch (error) {
    console.warn(
      `[accounting] ignoring invalid OPENCLAW_MODEL_PRICING_JSON override: ${(error as Error).message}`,
    );
    return new Map<string, PricingCatalogEntry>();
  }
}

export function normalizeTaskExecutionUsage(raw: unknown): TaskExecutionUsage | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const promptTokens =
    typeof value.promptTokens === "number" && Number.isFinite(value.promptTokens)
      ? value.promptTokens
      : typeof value.prompt_tokens === "number" && Number.isFinite(value.prompt_tokens)
        ? value.prompt_tokens
        : null;
  const completionTokens =
    typeof value.completionTokens === "number" &&
    Number.isFinite(value.completionTokens)
      ? value.completionTokens
      : typeof value.completion_tokens === "number" &&
          Number.isFinite(value.completion_tokens)
        ? value.completion_tokens
        : null;
  const totalTokens =
    typeof value.totalTokens === "number" && Number.isFinite(value.totalTokens)
      ? value.totalTokens
      : typeof value.total_tokens === "number" && Number.isFinite(value.total_tokens)
        ? value.total_tokens
        : promptTokens !== null || completionTokens !== null
          ? (promptTokens ?? 0) + (completionTokens ?? 0)
          : null;

  if (promptTokens === null && completionTokens === null && totalTokens === null) {
    return null;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

export function normalizeTaskExecutionBudget(raw: unknown): TaskExecutionBudget | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const status =
    value.status === "ok" || value.status === "exhausted" || value.status === "unknown"
      ? value.status
      : "unknown";

  return {
    status,
    reason: typeof value.reason === "string" ? value.reason : null,
    llmCallsToday:
      typeof value.llmCallsToday === "number" && Number.isFinite(value.llmCallsToday)
        ? value.llmCallsToday
        : null,
    tokensToday:
      typeof value.tokensToday === "number" && Number.isFinite(value.tokensToday)
        ? value.tokensToday
        : null,
    maxLlmCallsPerDay:
      typeof value.maxLlmCallsPerDay === "number" &&
      Number.isFinite(value.maxLlmCallsPerDay)
        ? value.maxLlmCallsPerDay
        : null,
    maxTokensPerDay:
      typeof value.maxTokensPerDay === "number" &&
      Number.isFinite(value.maxTokensPerDay)
        ? value.maxTokensPerDay
        : null,
    remainingLlmCalls:
      typeof value.remainingLlmCalls === "number" &&
      Number.isFinite(value.remainingLlmCalls)
        ? value.remainingLlmCalls
        : null,
    remainingTokens:
      typeof value.remainingTokens === "number" &&
      Number.isFinite(value.remainingTokens)
        ? value.remainingTokens
        : null,
    resetTimeZone:
      typeof value.resetTimeZone === "string" ? value.resetTimeZone : null,
    budgetDate: typeof value.budgetDate === "string" ? value.budgetDate : null,
  };
}

export function normalizeTaskExecutionAccounting(
  raw: unknown,
): Partial<TaskExecutionAccounting> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const usage = normalizeTaskExecutionUsage(value.usage);
  const budget = normalizeTaskExecutionBudget(value.budget);

  return {
    provider: typeof value.provider === "string" ? value.provider : null,
    model: typeof value.model === "string" ? value.model : null,
    metered: value.metered === true,
    pricingSource:
      value.pricingSource === "catalog" ||
      value.pricingSource === "override" ||
      value.pricingSource === "unpriced" ||
      value.pricingSource === "not-applicable"
        ? value.pricingSource
        : "not-applicable",
    usage,
    budget,
    note: typeof value.note === "string" ? value.note : null,
  };
}

export function extractTaskExecutionAccounting(
  result: Record<string, unknown>,
): Partial<TaskExecutionAccounting> | null {
  if (result.accounting && typeof result.accounting === "object") {
    return normalizeTaskExecutionAccounting(result.accounting);
  }

  const usage = normalizeTaskExecutionUsage(result.usage);
  if (!usage) {
    return null;
  }

  return {
    provider: "openai",
    model: typeof result.model === "string" ? result.model : null,
    metered: true,
    pricingSource: "unpriced",
    usage,
  };
}

function resolvePricingEntry(
  model: string | null | undefined,
): { entry: PricingCatalogEntry | null; pricingSource: TaskExecutionAccounting["pricingSource"] } {
  if (!model || model.trim().length === 0) {
    return { entry: null, pricingSource: "not-applicable" };
  }

  const normalizedModel = normalizeModelKey(model);
  const overrides = readPricingOverrideCatalog();
  const override = overrides.get(normalizedModel);
  if (override) {
    return { entry: override, pricingSource: "override" };
  }

  const fallback = DEFAULT_MODEL_PRICING[normalizedModel] ?? null;
  if (!fallback) {
    return { entry: null, pricingSource: "unpriced" };
  }

  return { entry: fallback, pricingSource: "catalog" };
}

export function estimateUsageCostUsd(args: {
  model: string | null | undefined;
  usage?: TaskExecutionUsage | null;
}) {
  const usage = args.usage ?? null;
  const { entry, pricingSource } = resolvePricingEntry(args.model);

  if (!entry || !usage) {
    return { costUsd: null, provider: entry?.provider ?? null, pricingSource };
  }

  const promptTokens = usage.promptTokens ?? null;
  const completionTokens = usage.completionTokens ?? null;

  if (promptTokens === null && completionTokens === null) {
    return { costUsd: null, provider: entry.provider, pricingSource };
  }

  const inputCost =
    promptTokens === null ? 0 : (promptTokens / 1_000_000) * entry.inputUsdPer1M;
  const outputCost =
    completionTokens === null
      ? 0
      : (completionTokens / 1_000_000) * entry.outputUsdPer1M;

  return {
    costUsd: Number((inputCost + outputCost).toFixed(6)),
    provider: entry.provider,
    pricingSource,
  };
}

export function finalizeTaskExecutionAccounting(args: {
  existing?: TaskExecutionAccounting | null;
  startedAt?: string | null;
  completedAt?: string | null;
}): TaskExecutionAccounting {
  const existing = args.existing ?? null;
  const startedAt = args.startedAt ?? null;
  const completedAt = args.completedAt ?? null;
  const latencyMs =
    startedAt && completedAt
      ? Math.max(
          0,
          new Date(completedAt).getTime() - new Date(startedAt).getTime(),
        )
      : existing?.latencyMs ?? null;
  const metered = existing?.metered === true;
  const usage = existing?.usage ?? null;
  const model = existing?.model ?? null;
  const estimated = estimateUsageCostUsd({ model, usage });

  return {
    provider: existing?.provider ?? estimated.provider ?? null,
    model,
    metered,
    pricingSource:
      metered && estimated.pricingSource !== "not-applicable"
        ? estimated.pricingSource
        : existing?.pricingSource ?? "not-applicable",
    latencyMs,
    costUsd: estimated.costUsd ?? existing?.costUsd ?? 0,
    usage,
    budget: existing?.budget ?? null,
    note:
      existing?.note ??
      (metered && estimated.costUsd === null
        ? "Billable model used, but token split or pricing catalog was unavailable."
        : !metered
          ? "Local-only or unmetered execution."
          : null),
  };
}

export function summarizeExecutionAccounting(taskExecutions: TaskExecutionRecord[]) {
  let totalCostUsd = 0;
  let meteredRunCount = 0;
  let unmeteredRunCount = 0;
  let pricedRunCount = 0;
  let unpricedRunCount = 0;
  let totalLatencyMs = 0;
  let latencySamples = 0;
  let totalTokens = 0;
  const byModel: Record<string, { runs: number; costUsd: number; tokens: number }> = {};

  for (const execution of taskExecutions) {
    const accounting = finalizeTaskExecutionAccounting({
      existing: execution.accounting ?? null,
      startedAt: execution.startedAt ?? null,
      completedAt: execution.completedAt ?? execution.lastHandledAt ?? null,
    });

    totalCostUsd += accounting.costUsd ?? 0;
    if (accounting.metered) {
      meteredRunCount += 1;
      if (accounting.pricingSource === "catalog" || accounting.pricingSource === "override") {
        pricedRunCount += 1;
      } else {
        unpricedRunCount += 1;
      }
    } else {
      unmeteredRunCount += 1;
    }

    if (typeof accounting.latencyMs === "number" && Number.isFinite(accounting.latencyMs)) {
      totalLatencyMs += accounting.latencyMs;
      latencySamples += 1;
    }

    const runTokens = accounting.usage?.totalTokens ?? 0;
    totalTokens += runTokens;
    const modelKey = accounting.model ?? "local-only";
    byModel[modelKey] = byModel[modelKey] ?? { runs: 0, costUsd: 0, tokens: 0 };
    byModel[modelKey].runs += 1;
    byModel[modelKey].costUsd += accounting.costUsd ?? 0;
    byModel[modelKey].tokens += runTokens;
  }

  return {
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    meteredRunCount,
    unmeteredRunCount,
    pricedRunCount,
    unpricedRunCount,
    averageLatencyMs:
      latencySamples > 0 ? Math.round(totalLatencyMs / latencySamples) : null,
    totalTokens,
    byModel,
  };
}
