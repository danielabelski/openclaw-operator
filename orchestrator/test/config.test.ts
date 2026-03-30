import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("config loader", () => {
  it("resolves relative path fields from the config file location", async () => {
    const root = await mkdtemp(join(tmpdir(), "openclaw-config-"));
    tempRoots.push(root);

    await mkdir(join(root, "logs", "knowledge-packs"), { recursive: true });
    await writeFile(
      join(root, "orchestrator_config.json"),
      JSON.stringify({
        docsPath: "./openclaw-docs",
        logsDir: "./logs",
        stateFile: "mongo:test-runtime-state",
        knowledgePackDir: "./logs/knowledge-packs",
        redditDraftsPath: "./logs/reddit-drafts.jsonl",
      }),
      "utf8",
    );

    const config = await loadConfig(join(root, "orchestrator_config.json"));

    expect(config.docsPath).toBe(join(root, "openclaw-docs"));
    expect(config.logsDir).toBe(join(root, "logs"));
    expect(config.knowledgePackDir).toBe(join(root, "logs", "knowledge-packs"));
    expect(config.redditDraftsPath).toBe(join(root, "logs", "reddit-drafts.jsonl"));
    expect(config.stateFile).toBe("mongo:test-runtime-state");
  });
});
