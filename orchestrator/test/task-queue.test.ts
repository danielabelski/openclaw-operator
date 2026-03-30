import { describe, expect, it } from "vitest";
import { TaskQueue } from "../src/taskQueue.ts";

describe("TaskQueue idempotency", () => {
  it("assigns unique run ids when no explicit idempotency key is provided", () => {
    const queue = new TaskQueue();

    const first = queue.enqueue("heartbeat", {
      reason: "shared-payload",
    });
    const second = queue.enqueue("heartbeat", {
      reason: "shared-payload",
    });

    expect(first.id).not.toBe(second.id);
    expect(first.idempotencyKey).toBe(first.id);
    expect(second.idempotencyKey).toBe(second.id);
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
  });

  it("preserves an explicit idempotency key for replay and retry flows", () => {
    const queue = new TaskQueue();

    const replay = queue.enqueue("build-refactor", {
      idempotencyKey: "repair-run-1",
      target: "incident-1",
    });

    expect(replay.idempotencyKey).toBe("repair-run-1");
  });
});
