// Guardrail: the answer key is for grading only. No code that produces results may read it.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

describe("answer key isolation", () => {
  it("only the scorecard reads the answer key", () => {
    const allowed = /(^|\/)(scorecard\.ts|scorecard\/)/;
    const offenders = walk("src")
      .filter((f) => /\.(ts|tsx)$/.test(f) && !allowed.test(f))
      .filter((f) => /answer_key|06_answer_key|from ["'][^"']*scorecard["']/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
