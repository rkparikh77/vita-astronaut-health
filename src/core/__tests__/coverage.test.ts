import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coverageSummary, REQUIREMENTS } from "../coverage";

describe("requirements coverage", () => {
  it("links only to pages that exist", () => {
    for (const r of REQUIREMENTS.filter((x) => x.href)) {
      const route = r.href!.split("?")[0];
      const dir = route === "/" ? "" : route.startsWith("/crew/") ? "crew/[id]" : route.slice(1);
      expect(existsSync(path.join(process.cwd(), "src/app", dir, "page.tsx")), r.href).toBe(true);
    }
  });

  it("is honest: requirements marked 'next' have no link", () => {
    for (const r of REQUIREMENTS.filter((x) => x.status === "next")) expect(r.href).toBeUndefined();
    const s = coverageSummary();
    expect(s.built + s.partial + s.next).toBe(s.total);
  });
});
