import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCliArgs,
  CODING_AGENT_TOOL_DEFINITIONS,
  formatCliResult,
  normalizePluginConfig,
  registerCodingAgentSkillsTools,
  sanitizeForOpenClawText,
} from "./coding-agent-skills.ts";

test("registerCodingAgentSkillsTools exposes only the approved optional tools", () => {
  const registered: Array<{ tool: { name: string }; options: { optional?: boolean } }> = [];
  const fakeApi = {
    pluginConfig: {},
    registerTool(tool: { name: string }, options: { optional?: boolean }) {
      registered.push({ tool, options });
    },
  };

  registerCodingAgentSkillsTools(fakeApi);

  assert.deepEqual(
    registered.map((entry) => entry.tool.name),
    CODING_AGENT_TOOL_DEFINITIONS.map((definition) => definition.name),
  );
  assert.equal(registered.length, 11);
  assert.ok(registered.every((entry) => entry.options.optional === true));
});

test("buildCliArgs maps tool names to fixed coding-agent-skills commands", () => {
  assert.deepEqual(buildCliArgs("coding_validate_pack", {}), ["validate-pack", "--json"]);
  assert.deepEqual(buildCliArgs("coding_repo_map", { projectRoot: "/project" }), [
    "repo-map",
    "/project",
    "--json",
  ]);
  assert.deepEqual(buildCliArgs("coding_validate_adapters", { adapterRoot: "/adapters" }), [
    "validate-adapters",
    "/adapters",
    "--json",
  ]);
});

test("buildCliArgs rejects option injection and secret-like paths", () => {
  assert.throws(
    () => buildCliArgs("coding_repo_map", { projectRoot: "--help" }),
    /must be a path/i,
  );
  assert.throws(
    () => buildCliArgs("coding_repo_map", { projectRoot: "/project/.env" }),
    /must not point at an env/i,
  );
  assert.throws(
    () => buildCliArgs("coding_repo_map", { projectRoot: "/project/secrets/local" }),
    /secret or credential/i,
  );
  assert.throws(
    () => buildCliArgs("coding_repo_map", { projectRoot: "/project/private/local" }),
    /secret or credential/i,
  );
});

test("normalizePluginConfig applies safe defaults and bounded timeout", () => {
  assert.deepEqual(normalizePluginConfig({}), {
    binaryPath: "coding-agent-skills",
    timeoutMs: 45000,
  });
  assert.deepEqual(
    normalizePluginConfig({ binaryPath: "/tmp/coding-agent-skills", timeoutMs: 2000 }),
    {
      binaryPath: "/tmp/coding-agent-skills",
      timeoutMs: 2000,
    },
  );
  assert.equal(normalizePluginConfig({ timeoutMs: 999 }).timeoutMs, 45000);
});

test("formatCliResult preserves JSON output from successful CLI runs", () => {
  const output = formatCliResult({
    command: "coding-agent-skills",
    args: ["validate-pack", "--json"],
    code: 0,
    stdout: '{"success":true,"status":"complete"}',
    stderr: "",
  });

  assert.deepEqual(JSON.parse(output), { success: true, status: "complete" });
});

test("sanitizeForOpenClawText redacts local paths and secret-like values", () => {
  const sanitized = sanitizeForOpenClawText(
    "path /home/alice/project token github_pat_abcdef1234567890secretvalue",
  );

  assert.match(sanitized, /\[REDACTED:local-home-path\]/);
  assert.match(sanitized, /\[REDACTED:secret-like\]/);
});
