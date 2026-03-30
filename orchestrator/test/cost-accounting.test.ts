import { describe, expect, it } from "vitest";
import {
  estimateUsageCostUsd,
  finalizeTaskExecutionAccounting,
  summarizeExecutionAccounting,
} from "../src/accounting/cost-accounting.js";
import type { TaskExecutionRecord } from "../src/types.js";

describe("cost accounting", () => {
  it("prices known models deterministically from token splits", () => {
    const estimate = estimateUsageCostUsd({
      model: "gpt-4",
      usage: {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      },
    });

    expect(estimate.provider).toBe("openai");
    expect(estimate.pricingSource).toBe("catalog");
    expect(estimate.costUsd).toBeCloseTo(0.06, 6);
  });

  it("finalizes non-metered runs with latency and zero cost", () => {
    const accounting = finalizeTaskExecutionAccounting({
      existing: null,
      startedAt: "2026-03-21T10:00:00.000Z",
      completedAt: "2026-03-21T10:00:01.250Z",
    });

    expect(accounting.metered).toBe(false);
    expect(accounting.costUsd).toBe(0);
    expect(accounting.latencyMs).toBe(1250);
    expect(accounting.pricingSource).toBe("not-applicable");
  });

  it("summarizes mixed metered and local execution", () => {
    const executions: TaskExecutionRecord[] = [
      {
        taskId: "local-task",
        idempotencyKey: "local-run",
        type: "system-monitor",
        status: "success",
        attempt: 1,
        maxRetries: 0,
        startedAt: "2026-03-21T10:00:00.000Z",
        completedAt: "2026-03-21T10:00:01.000Z",
        lastHandledAt: "2026-03-21T10:00:01.000Z",
        accounting: finalizeTaskExecutionAccounting({
          existing: null,
          startedAt: "2026-03-21T10:00:00.000Z",
          completedAt: "2026-03-21T10:00:01.000Z",
        }),
      },
      {
        taskId: "metered-task",
        idempotencyKey: "metered-run",
        type: "reddit-response",
        status: "success",
        attempt: 1,
        maxRetries: 0,
        startedAt: "2026-03-21T10:01:00.000Z",
        completedAt: "2026-03-21T10:01:02.000Z",
        lastHandledAt: "2026-03-21T10:01:02.000Z",
        accounting: finalizeTaskExecutionAccounting({
          existing: {
            provider: "openai",
            model: "gpt-4",
            metered: true,
            pricingSource: "catalog",
            latencyMs: null,
            costUsd: 0,
            usage: {
              promptTokens: 1000,
              completionTokens: 500,
              totalTokens: 1500,
            },
            budget: null,
            note: null,
          },
          startedAt: "2026-03-21T10:01:00.000Z",
          completedAt: "2026-03-21T10:01:02.000Z",
        }),
      },
    ];

    const summary = summarizeExecutionAccounting(executions);

    expect(summary.totalCostUsd).toBeCloseTo(0.06, 6);
    expect(summary.meteredRunCount).toBe(1);
    expect(summary.unmeteredRunCount).toBe(1);
    expect(summary.totalTokens).toBe(1500);
    expect(summary.averageLatencyMs).toBe(1500);
    expect(summary.byModel["gpt-4"]?.runs).toBe(1);
    expect(summary.byModel["local-only"]?.runs).toBe(1);
  });
});
