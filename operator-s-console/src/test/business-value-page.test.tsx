import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BusinessValuePage from "@/pages/BusinessValuePage";
import * as consoleHooks from "@/hooks/use-console-api";
import * as authContext from "@/contexts/AuthContext";

vi.mock("@/hooks/use-console-api");
vi.mock("@/contexts/AuthContext");

const triggerMutate = vi.fn();
const schedulerMutate = vi.fn();
const retryMutate = vi.fn();

function baseOverview() {
  return {
    generatedAt: "2026-07-11T08:00:00.000Z",
    mission: {
      businessName: "Tail Wagging Website Design Factory",
      mission: "Continuously select evidence-backed work that improves commercial outcomes.",
      supportedOutcomes: ["commercial-readiness"],
      approvalBoundarySummary: "Production actions remain approval-gated.",
    },
    registry: { updatedAt: "2026-07-11T07:00:00.000Z", projects: [], kpiSnapshots: [] },
    businessValue: { candidates: [], approvalGatedCandidates: [] },
    operations: {
      loopStatus: "stopped",
      scheduler: {
        mode: "disabled",
        cadenceMinutes: 360,
        lastTriggeredAt: null,
        lastTriggerSource: null,
        lastTriggerReason: null,
        nextRunAt: null,
        lastProgressAt: null,
        consecutiveFailures: 0,
        backoffUntil: null,
        activeTaskId: null,
        lastSkippedAt: null,
        lastSkipReason: null,
      },
      latestCycle: null,
      lastSuccessfulCycle: null,
      lastFailedCycle: null,
      selectedCandidate: null,
      selectedTask: null,
      selectedExecution: null,
      activeTaskExecution: null,
      activeWorker: null,
      activeModel: null,
      verificationStatus: "not-verified",
      nextSafeTask: null,
      approvalGatedCandidates: [],
      blockers: [],
    },
    status: {
      loop: "stopped",
      activeCycleId: null,
      lastSuccessfulCycleId: null,
      lastFailedCycleId: null,
      nextSelectedTask: null,
    },
  };
}

describe("business value page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: { actor: "operator", role: "operator", roles: ["operator"] },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      apiKeyExpires: null,
      login: vi.fn(),
      testConnection: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(() => true),
    });
    vi.mocked(consoleHooks.useBusinessOverview).mockReturnValue({
      data: baseOverview(), isLoading: false, isError: false,
    } as ReturnType<typeof consoleHooks.useBusinessOverview>);
    vi.mocked(consoleHooks.useBusinessCycles).mockReturnValue({
      data: { generatedAt: "2026-07-11T08:00:00.000Z", cycles: [] }, isLoading: false,
    } as ReturnType<typeof consoleHooks.useBusinessCycles>);
    vi.mocked(consoleHooks.useBusinessCycle).mockReturnValue({
      data: undefined,
    } as ReturnType<typeof consoleHooks.useBusinessCycle>);
    vi.mocked(consoleHooks.useBusinessCycleTrigger).mockReturnValue({ mutate: triggerMutate, isPending: false } as unknown as ReturnType<typeof consoleHooks.useBusinessCycleTrigger>);
    vi.mocked(consoleHooks.useBusinessSchedulerUpdate).mockReturnValue({ mutate: schedulerMutate, isPending: false } as unknown as ReturnType<typeof consoleHooks.useBusinessSchedulerUpdate>);
    vi.mocked(consoleHooks.useBusinessCycleRetry).mockReturnValue({ mutate: retryMutate, isPending: false } as unknown as ReturnType<typeof consoleHooks.useBusinessCycleRetry>);
  });

  it("renders truthful empty and unknown states", () => {
    render(<MemoryRouter><BusinessValuePage /></MemoryRouter>);
    expect(screen.getByText("Business Value")).toBeInTheDocument();
    expect(screen.getByText(/Continuously select evidence-backed work/)).toBeInTheDocument();
    expect(screen.getByText("No evidence-backed candidates are currently available.")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText("No cycle history has been recorded.")).toBeInTheDocument();
  });

  it("displays failed cycle evidence, worker, model, and retry control", () => {
    const cycle = {
      cycleId: "business-cycle-failed",
      triggerSource: "operator",
      triggerReason: "operator-trigger",
      status: "failed",
      startedAt: "2026-07-11T08:00:00.000Z",
      completedAt: "2026-07-11T08:01:00.000Z",
      registrySource: "business/registry.json",
      candidates: [{
        id: "candidate-1",
        kind: "risk",
        title: "Verify delivery risk",
        projectId: "operator",
        objective: "Verify the failed lane.",
        expectedOutcome: "risk-reduction",
        kpiId: "verification-failures",
        evidence: ["run-1"],
        taskType: "qa-verification",
        approval: "safe-autonomous",
        acceptanceCriteria: ["Failure is classified."],
        dependencies: [],
        risk: "low",
        score: { value: 81, formula: "weighted", components: { confidence: 8 }, rationale: [] },
      }],
      selectedTask: {
        candidateId: "candidate-1",
        taskType: "qa-verification",
        taskId: "task-1",
        idempotencyKey: "business-value:candidate-1",
        title: "Verify delivery risk",
        score: 81,
        evidence: ["run-1"],
        worker: "qa-verification-agent",
        model: "openai/gpt-5.5",
        executionStatus: "failed",
        verificationStatus: "failed",
      },
      approvalGatedCandidates: [],
      unsupportedCandidates: [],
      verificationStatus: "failed",
      evidence: [{ path: "artifacts/cycle.json", summary: "Cycle failed.", createdAt: "2026-07-11T08:01:00.000Z" }],
      nextSafeAction: "Inspect the failed task evidence.",
      failureReason: "Verifier failed.",
    };
    const overview = baseOverview();
    overview.operations.loopStatus = "failed";
    overview.operations.latestCycle = cycle;
    overview.operations.lastFailedCycle = cycle;
    overview.operations.selectedCandidate = cycle.candidates[0];
    overview.operations.selectedTask = cycle.selectedTask;
    overview.operations.activeWorker = "qa-verification-agent";
    overview.operations.activeModel = "openai/gpt-5.5";
    overview.operations.verificationStatus = "failed";
    overview.operations.nextSafeTask = cycle.nextSafeAction;
    overview.businessValue!.candidates = cycle.candidates;

    vi.mocked(consoleHooks.useBusinessOverview).mockReturnValue({ data: overview, isLoading: false, isError: false } as ReturnType<typeof consoleHooks.useBusinessOverview>);
    vi.mocked(consoleHooks.useBusinessCycles).mockReturnValue({ data: { generatedAt: overview.generatedAt, cycles: [cycle] }, isLoading: false } as ReturnType<typeof consoleHooks.useBusinessCycles>);
    vi.mocked(consoleHooks.useBusinessCycle).mockReturnValue({ data: { generatedAt: overview.generatedAt, cycle } } as ReturnType<typeof consoleHooks.useBusinessCycle>);

    render(<MemoryRouter><BusinessValuePage /></MemoryRouter>);
    expect(screen.getAllByText("qa-verification-agent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("openai/gpt-5.5").length).toBeGreaterThan(0);
    expect(screen.getByText("artifacts/cycle.json")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(retryMutate).toHaveBeenCalledWith("business-cycle-failed");
  });

  it("routes manual and scheduler controls through governed mutations", () => {
    render(<MemoryRouter><BusinessValuePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Run one cycle/ }));
    fireEvent.click(screen.getByRole("button", { name: /Resume/ }));
    expect(triggerMutate).toHaveBeenCalledTimes(1);
    expect(schedulerMutate).toHaveBeenCalledWith("resume", expect.any(Object));
  });
});
