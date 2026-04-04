import { defineConfig } from "vitepress";

const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "openclaw-operator";
const base = process.env.GITHUB_ACTIONS === "true" ? `/${repositoryName}/` : "/";

export default defineConfig({
  title: "OpenClaw Operator",
  description: "Canonical docs for the OpenClaw Operator control plane and operator console.",
  base,
  appearance: "dark",
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: `${base}favicon.svg` }],
    ["meta", { name: "theme-color", content: "#090c10" }],
    ["meta", { property: "og:image", content: `${base}favicon.svg` }],
    ["meta", { property: "og:image:type", content: "image/svg+xml" }],
    ["meta", { property: "og:image:alt", content: "OpenClaw Operator lobster mark" }],
    ["meta", { name: "twitter:image", content: `${base}favicon.svg` }],
  ],
  themeConfig: {
    logo: `${base}favicon.svg`,
    nav: [
      { text: "Home", link: "/" },
      { text: "Start", link: "/docs/start/getting-started" },
      { text: "Deploy", link: "/DEPLOYMENT" },
      { text: "Console", link: "/docs/architecture/OPERATOR_CONSOLE_AUDIT_AND_SPEC" },
      { text: "API", link: "/docs/reference/api" },
      { text: "GitHub", link: "https://github.com/AyobamiH/openclaw-operator" },
    ],
    sidebar: [
      {
        text: "Product",
        items: [
          { text: "Site Home", link: "/" },
          { text: "Repository Overview", link: "/README" },
          { text: "Docs Hub", link: "/docs/README" },
          { text: "Documentation Index", link: "/docs/INDEX" },
          { text: "Documentation Navigation", link: "/docs/NAVIGATION" },
          { text: "Documentation Summary", link: "/docs/SUMMARY" },
        ],
      },
      {
        text: "Install And Deploy",
        items: [
          { text: "Getting Started", link: "/docs/start/getting-started" },
          { text: "Quick Start Checklist", link: "/docs/start/quickstart" },
          { text: "Root Quickstart", link: "/QUICKSTART" },
          { text: "Deployment Guide", link: "/DEPLOYMENT" },
          { text: "Deployment Checklist", link: "/docs/operations/deployment" },
          { text: "Configuration", link: "/docs/guides/configuration" },
          { text: "Backup And Recovery", link: "/docs/operations/backup-recovery" },
        ],
      },
      {
        text: "Operate",
        items: [
          { text: "Operator Guide", link: "/docs/OPERATOR_GUIDE" },
          { text: "Monitoring", link: "/docs/guides/monitoring" },
          { text: "Running Agents", link: "/docs/guides/running-agents" },
          { text: "Knowledge Mirror Policy", link: "/docs/operations/KNOWLEDGE_MIRROR_POLICY" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API", link: "/docs/reference/api" },
          { text: "Task Types", link: "/docs/reference/task-types" },
          { text: "State Schema", link: "/docs/reference/state-schema" },
          { text: "Webhook Signing Contract", link: "/docs/WEBHOOK_SIGNING_CONTRACT" },
        ],
      },
      {
        text: "Architecture",
        items: [
          { text: "Architecture Overview", link: "/docs/start/architecture-overview" },
          { text: "Technical Architecture", link: "/docs/concepts/architecture" },
          { text: "Operator Console Audit And Spec", link: "/docs/architecture/OPERATOR_CONSOLE_AUDIT_AND_SPEC" },
          { text: "Operator Surface Capability Matrix", link: "/docs/architecture/OPERATOR_SURFACE_CAPABILITY_MATRIX" },
          { text: "Agent Capability Model", link: "/docs/architecture/AGENT_CAPABILITY_MODEL" },
          { text: "Agent Capability Implementation Matrix", link: "/docs/architecture/AGENT_CAPABILITY_IMPLEMENTATION_MATRIX" },
          { text: "Documentation Site IA", link: "/docs/architecture/DOCUMENTATION_SITE_INFORMATION_ARCHITECTURE" },
        ],
      },
      {
        text: "Troubleshooting",
        items: [
          { text: "Common Issues", link: "/docs/troubleshooting/common-issues" },
          { text: "Debugging", link: "/docs/troubleshooting/debugging" },
        ],
      },
    ],
    search: {
      provider: "local",
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/AyobamiH/openclaw-operator" },
    ],
    footer: {
      message: "Built from the canonical repo docs and generated site source.",
      copyright: "OpenClaw Operator",
    },
  },
});
