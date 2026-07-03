import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { registerCodingAgentSkillsTools } from "./src/coding-agent-skills.ts";

export default definePluginEntry({
  id: "coding-agent-skills",
  name: "Coding Agent Skills",
  description:
    "Exposes dependency-free, read-only coding-agent-skills CLI audits as optional OpenClaw tools.",
  register(api) {
    registerCodingAgentSkillsTools(api);
  },
});
