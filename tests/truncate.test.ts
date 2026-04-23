import { describe, it, expect } from "vitest";
import { truncate } from "../src/formatter";

describe("truncate", () => {
  it("returns the original string when length is under maxLength", () => {
    expect(truncate("hello", 50)).toBe("hello");
  });

  it("returns the original string when length equals maxLength", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and appends '...' when length exceeds maxLength", () => {
    expect(truncate("hello world", 5)).toBe("hello...");
  });

  it("truncates game names at 50 chars", () => {
    const name = "The Legend of Zelda - Tears of the Kingdom Special Edition";
    const result = truncate(name, 50);
    expect(result).toBe(name.slice(0, 50) + "...");
    expect(result.length).toBe(53);
  });

  it("truncates URLs at 80 chars", () => {
    const url = "https://example.com/very/long/path/to/some/game/file/that/exceeds/eighty/characters/download.nsp";
    const result = truncate(url, 80);
    expect(result).toBe(url.slice(0, 80) + "...");
    expect(result.length).toBe(83);
  });

  it("handles empty string", () => {
    expect(truncate("", 10)).toBe("");
  });

  it("handles single character maxLength", () => {
    expect(truncate("ab", 1)).toBe("a...");
  });
});
