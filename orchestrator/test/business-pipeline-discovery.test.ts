import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverBusinessCandidates, loadBusinessRegistry } from "../src/business/discovery.ts";
import { scoreCandidates } from "../src/business/scoring.ts";
import { createDefaultState } from "../src/state.ts";
import type { OrchestratorConfig } from "../src/types.ts";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("business pipeline discovery", () => {
  it("turns a durable draft-ready case into a full-body approval-packet candidate", async () => {
    const root = await mkdtemp(join(tmpdir(), "openclaw-business-registry-"));
    tempRoots.push(root);
    const registryPath = join(root, "registry.json");
    await mkdir(root, { recursive: true });
    await writeFile(
      registryPath,
      JSON.stringify({
        businessId: "openclaw-business",
        businessName: "OpenClaw",
        mission: "Prioritize governed work that creates measurable business value.",
        registryVersion: "test",
        updatedAt: "2026-07-14T20:00:00.000Z",
        kpis: [
          {
            id: "qualified-leads",
            label: "Qualified leads",
            outcome: "qualified-leads",
            measurement: "count",
            confidence: "estimated",
          },
        ],
        kpiSnapshots: [],
        projects: [],
        pipeline: [
          {
            id: "lead:the-posh-paw",
            type: "lead",
            title: "The Posh Paw outreach",
            source: "public read-only lead audit",
            stage: "draft_ready",
            expectedOutcome: "qualified-leads",
            kpiId: "qualified-leads",
            valueEstimate: 350,
            probability: 0.45,
            nextAction: "Present the complete proposed message for approval.",
            approvalStatus: "needs-packet",
            approvalAction: "Approve sending the reviewed outreach message.",
            draftSubject: "The Posh Paw: quick customer-journey polish review",
            draftBody: "Hello, this is the complete proposed message body.",
            evidence: ["artifacts/system/operator/the-posh-paw-approval-packet-2026-07-14.md"],
          },
        ],
      }),
      "utf8",
    );

    const config = {
      docsPath: root,
      logsDir: root,
      stateFile: join(root, "state.json"),
      businessRegistryPath: registryPath,
    } satisfies OrchestratorConfig;

    const registry = await loadBusinessRegistry(config);
    const candidates = await discoverBusinessCandidates(registry, createDefaultState());
    const packet = candidates.find(
      (candidate) => candidate.id === "approval-packet:lead:the-posh-paw",
    );

    expect(registry.pipeline[0]).toMatchObject({
      stage: "draft_ready",
      approvalStatus: "needs-packet",
    });
    expect(packet).toMatchObject({
      kind: "approval",
      approval: "safe-autonomous",
      taskType: "content-generate",
      taskPayload: {
        type: "operator_notice",
        style: "approval-packet",
        source: {
          draftSubject: "The Posh Paw: quick customer-journey polish review",
          draftBody: "Hello, this is the complete proposed message body.",
          metadata: {
            pipelineId: "lead:the-posh-paw",
            stage: "draft_ready",
          },
        },
      },
    });
    expect(String((packet?.taskPayload.source as { operatorNote?: string })?.operatorNote)).toContain(
      "must not send",
    );

    const scored = scoreCandidates(candidates);
    expect(scored[0].id).toBe("approval-packet:lead:the-posh-paw");
  });

  it("accepts the requested durable case states and normalizes unknown states safely", async () => {
    const root = await mkdtemp(join(tmpdir(), "openclaw-business-states-"));
    tempRoots.push(root);
    const registryPath = join(root, "registry.json");
    await writeFile(
      registryPath,
      JSON.stringify({
        businessId: "openclaw-business",
        businessName: "OpenClaw",
        mission: "Test durable business cases.",
        registryVersion: "test",
        updatedAt: "2026-07-14T20:00:00.000Z",
        kpis: [],
        kpiSnapshots: [],
        projects: [],
        pipeline: [
          { id: "a", type: "lead", title: "A", stage: "waiting_reply", source: "test", nextAction: "Monitor", evidence: [] },
          { id: "b", type: "lead", title: "B", stage: "hold", source: "test", nextAction: "Verify", evidence: [] },
          { id: "c", type: "lead", title: "C", stage: "invalid", source: "test", nextAction: "Audit", evidence: [] },
        ],
      }),
      "utf8",
    );
    const registry = await loadBusinessRegistry({
      docsPath: root,
      logsDir: root,
      stateFile: join(root, "state.json"),
      businessRegistryPath: registryPath,
    });
    expect(registry.pipeline.map((item) => item.stage)).toEqual([
      "waiting_reply",
      "hold",
      "discovered",
    ]);
  });

  it("loads expanded registry strategy and turns safe planning work into bounded candidates", async () => {
    const root = await mkdtemp(join(tmpdir(), "openclaw-business-expanded-"));
    tempRoots.push(root);
    const registryPath = join(root, "registry-v2.json");
    await writeFile(
      registryPath,
      JSON.stringify({
        businessId: "openclaw-business",
        businessName: "OpenClaw",
        mission: "Test expanded autonomous business planning.",
        vision: "Evidence-backed business execution.",
        northStar: "Verified business value.",
        registryVersion: "2.0.1",
        schemaVersion: "2.0.0",
        sourceRegistryVersion: "1",
        updatedAt: "2026-07-15T04:42:37.000Z",
        kpis: [],
        kpiSnapshots: [],
        projects: [],
        pipeline: [
          {
            id: "sent-lead",
            type: "lead",
            title: "Sent lead",
            source: "test",
            stage: "sent",
            expectedOutcome: "qualified-leads",
            approvalStatus: "approved-and-executed",
            nextAction: "Monitor only.",
            evidence: [],
          },
        ],
        initiatives: [
          {
            id: "initiative:case-study",
            title: "Create an evidence-backed case study",
            type: "commercialisation-programme",
            status: "active",
            businessFunction: "marketing-and-sales",
            expectedOutcomes: ["market-credibility", "qualified-leads"],
            deliverables: ["technical proof", "limitations"],
            priorityProjects: ["demo-project"],
            nextSafeAction: "Prepare an internal case-study brief.",
            approvalBoundaries: ["public publishing"],
            confidence: "verified-goal",
          },
        ],
        riskRegister: [
          {
            id: "risk:claims",
            title: "Unsupported claims",
            severity: "high",
            status: "open",
            mitigation: "Keep claims evidence-backed.",
            confidence: "verified",
          },
        ],
        coverageGaps: [
          {
            id: "gap:financials",
            area: "Financial performance",
            coverageStatus: "not-represented",
            missing: ["revenue", "gross margin"],
            priority: "critical",
            nextEvidenceNeeded: "Source-backed monthly financial snapshot.",
          },
        ],
        approvalPolicy: {
          policy: "External actions require operator approval.",
          approvalAuthority: "John",
          alwaysApprovalRequired: ["sending outreach"],
          normallySafeWithoutAdditionalApproval: ["internal drafts"],
          requiredApprovalRecord: ["decision"],
          postActionRequirement: "Record the result.",
        },
      }),
      "utf8",
    );

    const registry = await loadBusinessRegistry({
      docsPath: root,
      logsDir: root,
      stateFile: join(root, "state.json"),
      businessRegistryPath: registryPath,
    });
    const candidates = await discoverBusinessCandidates(registry, createDefaultState());

    expect(registry).toMatchObject({
      registryVersion: "2.0.1",
      schemaVersion: "2.0.0",
      sourceRegistryVersion: "1",
      vision: "Evidence-backed business execution.",
      northStar: "Verified business value.",
    });
    expect(registry.pipeline[0].approvalStatus).toBe("approved-and-executed");
    expect(registry.initiatives).toHaveLength(1);
    expect(registry.riskRegister).toHaveLength(1);
    expect(registry.coverageGaps).toHaveLength(1);
    expect(registry.approvalPolicy?.approvalAuthority).toBe("John");
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "strategic-initiative:initiative:case-study",
        taskType: "content-generate",
        approval: "safe-autonomous",
        expectedOutcome: "search-visibility",
      }),
      expect.objectContaining({
        id: "coverage-gap-plan:gap:financials",
        taskType: "content-generate",
        approval: "safe-autonomous",
      }),
    ]));
  });
});
