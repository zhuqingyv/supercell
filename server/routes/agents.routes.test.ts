import { describe, expect, it, vi } from "vitest";

vi.mock("../agents/orchestrator.js", () => ({
  runAgent: vi.fn(),
  runTeamAgents: vi.fn(),
  runAgents: vi.fn(),
  scheduleCron: vi.fn(),
  stopCron: vi.fn(),
  getStatus: vi.fn(() => ({})),
  getCachedResult: vi.fn(),
  getAgentInfo: vi.fn(() => []),
  normalizeAgentName: vi.fn(() => null),
}));

vi.mock("../db/index.js", () => ({
  getLatestRun: vi.fn(),
  getAllLatestRuns: vi.fn(() => []),
  getFindings: vi.fn(() => []),
  getPendingIterations: vi.fn(() => []),
  updateIterationStatus: vi.fn(() => 1),
  getRunHistory: vi.fn(() => []),
}));

describe("agents route ordering", () => {
  it("registers /findings/all before /:name/findings", async () => {
    const { default: router } = await import("./agents.js");
    const paths = (router as { stack: Array<{ route?: { path?: string } }> }).stack
      .map((layer) => layer.route?.path)
      .filter((path): path is string => typeof path === "string");

    const allFindingsIndex = paths.indexOf("/findings/all");
    const singleFindingsIndex = paths.indexOf("/:name/findings");

    expect(allFindingsIndex).toBeGreaterThanOrEqual(0);
    expect(singleFindingsIndex).toBeGreaterThanOrEqual(0);
    expect(allFindingsIndex).toBeLessThan(singleFindingsIndex);
  });
});
