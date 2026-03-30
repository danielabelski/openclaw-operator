import { describe, expect, it } from "vitest";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectGitHubWorkflowMonitorState,
  parseGitHubRepositoryFromRemote,
  resolveGitRepositoryWorkspace,
  resolveGitHubCliBinary,
} from "../src/githubWorkflowMonitor.js";

describe("GitHub workflow monitor", () => {
  it("parses GitHub repositories from HTTPS and SSH remotes", () => {
    expect(
      parseGitHubRepositoryFromRemote(
        "https://github.com/AyobamiH/openclaw-operator.git",
      ),
    ).toBe("AyobamiH/openclaw-operator");
    expect(
      parseGitHubRepositoryFromRemote(
        "git@github.com:AyobamiH/openclaw-operator.git",
      ),
    ).toBe("AyobamiH/openclaw-operator");
    expect(parseGitHubRepositoryFromRemote("https://example.com/not-github")).toBeNull();
  });

  it("reports a failed latest workflow run from gh output", async () => {
    const state = await collectGitHubWorkflowMonitorState({
      enabled: true,
      cwd: process.cwd(),
      repo: "AyobamiH/openclaw-operator",
      branch: "master",
      now: () => new Date("2026-03-29T10:00:00.000Z"),
      execFileFn: async (_file, args) => {
        if (args[0] === "run" && args[1] === "list") {
          return {
            stdout: JSON.stringify([
              {
                databaseId: 23706445086,
                workflowName: "Test & Validate",
                displayTitle:
                  "feat(operator): harden agent workflows and improve onboarding",
                status: "completed",
                conclusion: "failure",
                url: "https://github.com/AyobamiH/openclaw-operator/actions/runs/23706445086",
                headBranch: "master",
                headSha: "bd79be33d00e6f79ba491473e56104f074fddc5e",
                event: "push",
                updatedAt: "2026-03-29T09:53:42Z",
              },
            ]),
            stderr: "",
          };
        }
        throw new Error(`Unexpected command: ${args.join(" ")}`);
      },
    });

    expect(state.status).toBe("failed");
    expect(state.available).toBe(true);
    expect(state.repository).toBe("AyobamiH/openclaw-operator");
    expect(state.branch).toBe("master");
    expect(state.summary).toContain("Latest GitHub Actions run failed");
    expect(state.latestRun?.workflowName).toBe("Test & Validate");
    expect(state.latestRun?.url).toContain("/actions/runs/23706445086");
  });

  it("resolves the nearest git repository root before reading remotes", async () => {
    const calls: Array<{ file: string; args: string[]; cwd?: string }> = [];
    const workspaceRoot = "/tmp/openclaw-workspace";
    const state = await collectGitHubWorkflowMonitorState({
      enabled: true,
      cwd: `${workspaceRoot}/orchestrator`,
      now: () => new Date("2026-03-29T10:00:00.000Z"),
      execFileFn: async (file, args, options) => {
        calls.push({ file, args, cwd: typeof options?.cwd === "string" ? options.cwd : undefined });
        if (args[0] === "rev-parse") {
          return {
            stdout: `${workspaceRoot}\n`,
            stderr: "",
          };
        }
        if (args[0] === "config" && args[1] === "--get") {
          return {
            stdout: "https://github.com/AyobamiH/openclaw-operator.git\n",
            stderr: "",
          };
        }
        if (args[0] === "branch" && args[1] === "--show-current") {
          return {
            stdout: "master\n",
            stderr: "",
          };
        }
        if (args[0] === "run" && args[1] === "list") {
          return {
            stdout: JSON.stringify([
              {
                databaseId: 23706445086,
                workflowName: "Test & Validate",
                displayTitle: "repo-root monitor smoke",
                status: "completed",
                conclusion: "success",
                url: "https://github.com/AyobamiH/openclaw-operator/actions/runs/23706445086",
                headBranch: "master",
                headSha: "bd79be33d00e6f79ba491473e56104f074fddc5e",
                event: "push",
                updatedAt: "2026-03-29T09:53:42Z",
              },
            ]),
            stderr: "",
          };
        }
        throw new Error(`Unexpected command: ${args.join(" ")}`);
      },
    });

    expect(state.status).toBe("healthy");
    expect(calls[0]).toMatchObject({
      file: "git",
      args: ["rev-parse", "--show-toplevel"],
      cwd: `${workspaceRoot}/orchestrator`,
    });
    expect(calls[1]).toMatchObject({
      file: "which",
      args: ["gh"],
      cwd: workspaceRoot,
    });
    expect(calls[2]).toMatchObject({
      file: "git",
      args: ["config", "--get", "remote.origin.url"],
      cwd: workspaceRoot,
    });
    expect(calls[3]).toMatchObject({
      file: "git",
      args: ["branch", "--show-current"],
      cwd: workspaceRoot,
    });
  });

  it("returns disabled state when the monitor is turned off", async () => {
    const state = await collectGitHubWorkflowMonitorState({
      enabled: false,
      cwd: process.cwd(),
    });

    expect(state.status).toBe("disabled");
    expect(state.enabled).toBe(false);
    expect(state.available).toBe(false);
  });

  it("falls back to the current cwd when git root discovery is unavailable", async () => {
    const workspace = await resolveGitRepositoryWorkspace({
      cwd: "/tmp/openclaw-workspace/orchestrator",
      execFileFn: async () => {
        throw new Error("git unavailable");
      },
    });

    expect(workspace).toBe("/tmp/openclaw-workspace/orchestrator");
  });

  it("prefers the OpenClaw gh binary when gh is not on PATH", async () => {
    const originalHome = process.env.HOME;
    const tempHome = await mkdtemp(join(tmpdir(), "openclaw-gh-home-"));
    const openclawGhBin = join(tempHome, ".openclaw", "bin", "gh");
    process.env.HOME = tempHome;

    try {
      await mkdir(join(tempHome, ".openclaw", "bin"), { recursive: true });
      await writeFile(openclawGhBin, "#!/bin/sh\nexit 0\n", "utf8");
      await chmod(openclawGhBin, 0o755);

      const ghBin = await resolveGitHubCliBinary({
        cwd: "/tmp/openclaw-workspace/orchestrator",
        execFileFn: async () => {
          throw new Error("which unavailable");
        },
      });

      expect(ghBin).toBe(openclawGhBin);
    } finally {
      process.env.HOME = originalHome;
      await rm(tempHome, { recursive: true, force: true });
    }
  });
});
