import { describe, it, expect } from "vitest";
import { buildSummary, formatResults } from "../src/formatter";
import { GameEntry } from "../src/types";

function makeEntry(overrides: Partial<GameEntry> = {}): GameEntry {
  return {
    index: 1,
    gameName: "Test Game",
    downloadUrl: "https://example.com/test.nsp",
    sourceName: "FMHY",
    sourceUrl: "https://fmhy.net",
    ...overrides,
  };
}

describe("buildSummary", () => {
  it("shows correct total and single source", () => {
    const entries = [makeEntry(), makeEntry({ index: 2 })];
    const summary = buildSummary(entries);
    expect(summary).toBe("Found 2 NSP links across 1 sources:\n  FMHY: 2");
  });

  it("shows correct per-source breakdown for multiple sources", () => {
    const entries = [
      makeEntry({ sourceName: "FMHY" }),
      makeEntry({ sourceName: "FMHY" }),
      makeEntry({ sourceName: "SwitchRom" }),
      makeEntry({ sourceName: "NSWTL" }),
      makeEntry({ sourceName: "NSWTL" }),
      makeEntry({ sourceName: "NSWTL" }),
    ];
    const summary = buildSummary(entries);
    expect(summary).toBe(
      "Found 6 NSP links across 3 sources:\n  FMHY: 2 | SwitchRom: 1 | NSWTL: 3"
    );
  });

  it("handles empty entries", () => {
    const summary = buildSummary([]);
    expect(summary).toBe("Found 0 NSP links across 0 sources:\n  ");
  });
});

describe("formatResults with summary", () => {
  it("includes summary before the table", () => {
    const entries = [
      makeEntry({ sourceName: "FMHY" }),
      makeEntry({ sourceName: "SwitchRom", index: 2 }),
    ];
    const output = formatResults(entries, []);
    expect(output).toContain("Found 2 NSP links across 2 sources:");
    expect(output).toContain("FMHY: 1 | SwitchRom: 1");
    // Summary should appear before the first rendered result
    const summaryIdx = output.indexOf("Found 2");
    const firstResultIdx = output.indexOf("1. Test Game");
    expect(summaryIdx).toBeLessThan(firstResultIdx);
  });

  it("does not include summary when no entries", () => {
    const output = formatResults([], []);
    expect(output).toBe("No .nsp files were found on any source.");
    expect(output).not.toContain("Found");
  });
});

describe("formatResults edge cases", () => {
  it("shows global no-results message when all sources returned 0 entries", () => {
    const output = formatResults([], []);
    expect(output).toBe("No .nsp files were found on any source.");
  });

  it("shows no-results message plus errors when all sources failed", () => {
    const errors = [
      "HTTP error 500 fetching https://a.com",
      "Connection failed fetching https://b.com: ECONNREFUSED",
    ];
    const output = formatResults([], errors);
    expect(output).toContain("No .nsp files were found on any source.");
    expect(output).toContain("Errors:");
    expect(output).toContain("HTTP error 500 fetching https://a.com");
    expect(output).toContain("Connection failed fetching https://b.com: ECONNREFUSED");
  });

  it("shows no-results message plus errors when mix of failures and 0 entries", () => {
    const errors = ["HTTP error 500 fetching https://a.com"];
    const output = formatResults([], errors);
    expect(output).toContain("No .nsp files were found on any source.");
    expect(output).toContain("Errors:");
    expect(output).toContain("HTTP error 500 fetching https://a.com");
  });

  it("shows results with errors when some sources succeeded and some failed", () => {
    const entries = [makeEntry({ sourceName: "FMHY" })];
    const errors = ["HTTP error 500 fetching https://b.com"];
    const output = formatResults(entries, errors);
    expect(output).toContain("Found 1 NSP links across 1 sources:");
    expect(output).toContain("Errors:");
    expect(output).toContain("HTTP error 500 fetching https://b.com");
    expect(output).toContain("Test Game");
  });
});
