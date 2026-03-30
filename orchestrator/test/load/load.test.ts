/**
 * STAGE 2: Load Testing
 * 
 * Vitest integration test that runs the 3,000-task load test
 */

import { beforeAll, describe, it, expect } from 'vitest';
import LoadTestHarness from '../load/harness';
import { scenarios, getScenario, TaskGenerator, CostCalculator } from '../load/scenarios';

describe('STAGE 2: Load Testing (3,000 Tasks)', () => {
  const scenarioResults = new Map<string, Awaited<ReturnType<LoadTestHarness['run']>>>();

  const requireScenarioResult = (scenarioName: string) => {
    const result = scenarioResults.get(scenarioName);
    if (!result) {
      throw new Error(`Missing cached load-test result for scenario: ${scenarioName}`);
    }
    return result;
  };

  beforeAll(async () => {
    for (const scenarioName of Object.keys(scenarios)) {
      const harness = new LoadTestHarness(getScenario(scenarioName));
      scenarioResults.set(scenarioName, await harness.run());
    }
  }, 180000);

  it('should execute production standard scenario (40 agents × 75 tasks)', async () => {
    const result = requireScenarioResult('production_standard');

    // Verify all tasks executed
    expect(result.totalTasks).toBe(3000);

    // Verify SLA targets met
    expect(result.metrics.latency.p95).toBeLessThan(2500); // 2.5 seconds
    expect(result.metrics.errorRate).toBeLessThan(1); // 1%
    expect(result.metrics.costSummary.withinBudget).toBe(true); // £20 cap

    // Verify approval gates
    expect(result.tasksRequiringApproval).toBeGreaterThan(400); // ~15%
    expect(result.approvalsCompleted).toBeGreaterThan(0);

    // Print detailed results
    console.log(LoadTestHarness.formatResults(result));
  });

  it('should meet latency targets (p95 < 2.5s)', async () => {
    const result = requireScenarioResult('production_standard');

    expect(result.metrics.latency.p95).toBeLessThan(2500);
    expect(result.metrics.latency.p50).toBeLessThan(1000);
    expect(result.metrics.latency.p99).toBeLessThan(5000);
  });

  it('should maintain error rate below 1%', async () => {
    const result = requireScenarioResult('production_standard');

    expect(result.metrics.errorRate).toBeLessThan(1);
    expect(result.failedTasks).toBeLessThan(30); // <1% of 3000
  });

  it('should process approval gates within 60s turnaround', async () => {
    const result = requireScenarioResult('production_standard');

    expect(result.metrics.approvalTurnaround.mean).toBeLessThan(60000);
    expect(result.metrics.approvalTurnaround.p95).toBeLessThan(60000);
  });

  it('should stay within £20 cost budget', async () => {
    const result = requireScenarioResult('production_standard');

    expect(result.metrics.costSummary.totalCost).toBeLessThanOrEqual(20);
    expect(result.metrics.costSummary.withinBudget).toBe(true);
  });

  it('should handle high failure rate gracefully', async () => {
    const result = requireScenarioResult('stress_test');

    // Should complete even with 25% failure rate
    expect(result.totalTasks).toBeGreaterThan(0);

    // But should fail SLA (expected)
    expect(result.metrics.errorRate).toBeGreaterThan(5);
  });

  it('should scale to 5,000 tasks efficiently', async () => {
    const result = requireScenarioResult('high_load');

    expect(result.totalTasks).toBe(5000);

    // Should still maintain reasonable latency
    expect(result.metrics.latency.p95).toBeLessThan(5000);
  });

  it('should run smoke test quickly', async () => {
    const result = requireScenarioResult('smoke_test');

    expect(result.totalTasks).toBe(50);
    expect(result.duration).toBeLessThan(10000); // Should complete in <10 seconds
  });

  it('should distribute load evenly across agents', async () => {
    const result = requireScenarioResult('production_standard');

    // Check agent statistics
    const agentCompletions = Object.values(result.agentStats).map((s) => s.tasksCompleted);
    const avgCompletion = agentCompletions.reduce((a, b) => a + b, 0) / agentCompletions.length;

    // Should be relatively balanced (no agent significantly overloaded)
    for (const completion of agentCompletions) {
      const variance = Math.abs(completion - avgCompletion) / avgCompletion;
      expect(variance).toBeLessThan(0.5); // <50% deviation
    }
  });

  it('should track per-agent metrics', async () => {
    const result = requireScenarioResult('production_standard');

    // Verify agent stats are populated
    expect(Object.keys(result.agentStats).length).toBeGreaterThan(0);

    for (const [agentId, stats] of Object.entries(result.agentStats)) {
      expect(stats.tasksCompleted).toBeGreaterThanOrEqual(0);
      expect(stats.tasksFailed).toBeGreaterThanOrEqual(0);
      expect(stats.averageLatency).toBeGreaterThanOrEqual(0);
      expect(stats.totalCost).toBeGreaterThanOrEqual(0);
    }
  });

  it('should generate reproducible latency distributions', async () => {
    // Run scenario twice
    const harness1 = new LoadTestHarness(getScenario('baseline'));
    const result1 = await harness1.run();

    const harness2 = new LoadTestHarness(getScenario('baseline'));
    const result2 = await harness2.run();

    // Latency profiles should be similar (within 20%)
    const diff = Math.abs(result1.metrics.latency.p95 - result2.metrics.latency.p95) /
      result1.metrics.latency.p95;
    expect(diff).toBeLessThan(0.2);
  });

  it('should handle all configured scenarios', async () => {
    for (const scenarioName of Object.keys(scenarios)) {
      const result = requireScenarioResult(scenarioName);

      expect(result.totalTasks).toBe(
        result.config.totalAgents * result.config.tasksPerAgent,
      );
      expect(result.metrics).toBeDefined();
      expect(result.agentStats).toBeDefined();
    }
  });

  it('should validate task generator', () => {
    const generator = new TaskGenerator(getScenario('production_standard'));

    // Generate first 100 tasks
    for (let i = 0; i < 100; i++) {
      const task = generator.nextTask();

      expect(task.taskId).toBeDefined();
      expect(task.agentId).toBeDefined();
      expect(task.skillId).toBeDefined();
      expect(typeof task.requiresApproval).toBe('boolean');
      expect(typeof task.shouldFail).toBe('boolean');
    }

    // Verify progress
    const progress = generator.getProgress();
    expect(progress.completed).toBe(100);
    expect(progress.percentage).toBe((100 / 3000) * 100);
  });

  it('should calculate costs accurately', () => {
    const calculator = new CostCalculator();
    const scenario = getScenario('production_standard');

    const estimatedCost = calculator.estimateTotalCost(scenario);

    // Should estimate reasonable cost (~£3 for 3,000 tasks)
    expect(estimatedCost).toBeGreaterThan(0);
    expect(estimatedCost).toBeLessThan(100); // Sanity check

    // Should be well under budget
    expect(estimatedCost).toBeLessThan(20);
  });

  it('should report detailed latency percentiles', async () => {
    const result = requireScenarioResult('production_standard');

    // Verify percentile ordering
    expect(result.metrics.latency.p50).toBeLessThanOrEqual(result.metrics.latency.p95);
    expect(result.metrics.latency.p95).toBeLessThanOrEqual(result.metrics.latency.p99);

    // All should be reasonable (between min and max)
    expect(result.metrics.latency.min).toBeLessThanOrEqual(result.metrics.latency.p50);
    expect(result.metrics.latency.p99).toBeLessThanOrEqual(result.metrics.latency.max);
  });

  it('should track approval gate metrics', async () => {
    const result = requireScenarioResult('production_standard');

    const approvalRate = (result.tasksRequiringApproval / result.totalTasks) * 100;
    const expectedRate = result.config.approvalGatePercentage;

    // Should be within 5% of configured rate
    expect(Math.abs(approvalRate - expectedRate)).toBeLessThan(5);

    // Approved + rejected should equal total requiring approval
    expect(result.approvalsCompleted + result.approvalsRejected).toBe(
      result.tasksRequiringApproval,
    );
  });

  it('should validate cost breakdown by agent', async () => {
    const result = requireScenarioResult('production_standard');

    // Sum of costs by agent should equal total
    const costSum = Object.values(result.metrics.costSummary.costByAgent).reduce(
      (a, b) => a + b,
      0,
    );

    expect(Math.abs(costSum - result.metrics.costSummary.totalCost)).toBeLessThan(0.01);
  });

  it('should output formatted results', async () => {
    const result = requireScenarioResult('production_standard');

    const formatted = LoadTestHarness.formatResults(result);

    // Check that formatted output contains expected sections
    expect(formatted).toContain('LOAD TEST RESULTS');
    expect(formatted).toContain('EXECUTION SUMMARY');
    expect(formatted).toContain('LATENCY METRICS');
    expect(formatted).toContain('ERROR RATE');
    expect(formatted).toContain('APPROVAL GATES');
    expect(formatted).toContain('COST ANALYSIS');
    expect(formatted).toContain('TEST RESULTS');

    console.log(formatted);
  });

  it('should validate all SLA targets in one comprehensive test', async () => {
    const result = requireScenarioResult('production_standard');

    // All SLAs must pass
    const slaResults = {
      latencyP95: result.metrics.latency.p95 < 2500,
      errorRate: result.metrics.errorRate < 1,
      approvalTurnaround: result.metrics.approvalTurnaround.mean < 60000,
      costBudget: result.metrics.costSummary.withinBudget,
    };

    // Display SLA status
    console.log('\n📋 SLA VALIDATION:');
    console.log(`  ✅ p95 Latency: ${result.metrics.latency.p95.toFixed(0)}ms < 2500ms: ${slaResults.latencyP95 ? '✅' : '❌'}`);
    console.log(`  ✅ Error Rate: ${result.metrics.errorRate.toFixed(2)}% < 1%: ${slaResults.errorRate ? '✅' : '❌'}`);
    console.log(`  ✅ Approval: ${result.metrics.approvalTurnaround.mean.toFixed(0)}ms < 60000ms: ${slaResults.approvalTurnaround ? '✅' : '❌'}`);
    console.log(`  ✅ Cost: £${result.metrics.costSummary.totalCost.toFixed(2)} < £${result.config.costBudgetCap}: ${slaResults.costBudget ? '✅' : '❌'}\n`);

    expect(slaResults.latencyP95).toBe(true);
    expect(slaResults.errorRate).toBe(true);
    expect(slaResults.approvalTurnaround).toBe(true);
    expect(slaResults.costBudget).toBe(true);
  });
});
