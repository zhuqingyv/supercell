import { describe, expect, it } from "vitest";
import { parseAgentList, parseHistoryLimit } from "./agents.validation.js";

describe("parseAgentList", () => {
  it("accepts valid unique names", () => {
    const result = parseAgentList(["developer", "tester"]);
    expect(result).toEqual({ ok: true, names: ["developer", "tester"] });
  });

  it("rejects duplicate agent names", () => {
    const result = parseAgentList(["developer", "developer"]);
    expect(result).toEqual({
      ok: false,
      error: "duplicate agent name is not allowed: developer",
    });
  });

  it("rejects invalid agent names", () => {
    const result = parseAgentList(["developer", "unknown"]);
    expect(result).toEqual({
      ok: false,
      error: "agents must be an array of: product, pm, developer, tester, xiao-q",
    });
  });

  it("normalizes aliases, whitespace, and letter case", () => {
    const result = parseAgentList([" Dev ", "QA"]);
    expect(result).toEqual({ ok: true, names: ["developer", "tester"] });
  });

  it("still rejects duplicated names after normalization", () => {
    const result = parseAgentList(["tester", " QA "]);
    expect(result).toEqual({
      ok: false,
      error: "duplicate agent name is not allowed: tester",
    });
  });
});

describe("parseHistoryLimit", () => {
  it("uses fallback when value is invalid", () => {
    expect(parseHistoryLimit("not-a-number")).toBe(20);
  });

  it("uses fallback for malformed numeric strings", () => {
    expect(parseHistoryLimit("10abc")).toBe(20);
    expect(parseHistoryLimit("1e2")).toBe(20);
  });

  it("uses fallback for non-string/number inputs", () => {
    expect(parseHistoryLimit(["50"])).toBe(20);
  });

  it("clamps lower bound to 1", () => {
    expect(parseHistoryLimit("-10")).toBe(1);
    expect(parseHistoryLimit("0")).toBe(1);
  });

  it("clamps upper bound to 100", () => {
    expect(parseHistoryLimit("120")).toBe(100);
  });

  it("keeps valid values", () => {
    expect(parseHistoryLimit("50")).toBe(50);
  });
});
