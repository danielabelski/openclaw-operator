import {
  formatHelp,
  formatRecentRuns,
  formatRunStatus,
  formatTaskList,
  normalizeBridgeConfig,
  orchestratorRequest,
  parseBridgeCommand,
  resolveBridgeApiKey,
} from "./src/bridge.ts";

export default function registerOrchestratorBridge(api: any) {
  api.registerCommand({
    name: "orch",
    description: "Trigger allowed orchestrator tasks and inspect recent runs",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx: any) => {
      try {
        const workspaceDir =
          typeof api.config?.agents?.defaults?.workspace === "string"
            ? api.config.agents.defaults.workspace
            : undefined;
        const config = normalizeBridgeConfig(api.pluginConfig, workspaceDir);
        const command = parseBridgeCommand(ctx.args, config.allowedTasks);
        const apiKey = await resolveBridgeApiKey(config);

        if (!apiKey) {
          return {
            text: [
              "Orchestrator bridge is enabled but no operator API key was resolved.",
              "Set plugins.entries.orchestrator-bridge.config.apiKey,",
              "or plugins.entries.orchestrator-bridge.config.apiKeyEnv,",
              "or keep a valid operator key in orchestrator/.env.",
            ].join(" "),
          };
        }

        if (command.kind === "help") {
          return { text: formatHelp(config.allowedTasks) };
        }

        if (command.kind === "list") {
          const catalog = await orchestratorRequest({
            config,
            apiKey,
            pathname: "/api/tasks/catalog",
          });
          return { text: formatTaskList(config.allowedTasks, catalog) };
        }

        if (command.kind === "recent") {
          const recentRuns = await orchestratorRequest({
            config,
            apiKey,
            pathname: `/api/tasks/runs?limit=${command.limit}`,
          });
          return { text: formatRecentRuns(recentRuns) };
        }

        if (command.kind === "status") {
          const runDetail = await orchestratorRequest({
            config,
            apiKey,
            pathname: `/api/tasks/runs/${encodeURIComponent(command.runId)}`,
          });
          return { text: formatRunStatus(runDetail) };
        }

        const queued = (await orchestratorRequest({
          config,
          apiKey,
          pathname: "/api/tasks/trigger",
          method: "POST",
          body: {
            type: command.taskType,
            payload: command.payload,
          },
        })) as Record<string, unknown>;

        const taskId = typeof queued.taskId === "string" ? queued.taskId : "unknown";
        const createdAt =
          typeof queued.createdAt === "string" ? queued.createdAt : "unknown";
        const payloadSummary =
          Object.keys(command.payload).length > 0
            ? ` payload keys: ${Object.keys(command.payload).join(", ")}`
            : "";

        return {
          text: `Queued ${command.taskType} as ${taskId} at ${createdAt}.${payloadSummary} Use /orch status ${taskId} for detail.`,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown bridge error";
        api.logger.warn(`[orchestrator-bridge] ${message}`);
        return { text: `Orchestrator bridge error: ${message}` };
      }
    },
  });
}
