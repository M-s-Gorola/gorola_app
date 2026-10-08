import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// eslint-disable-next-line security/detect-unsafe-regex
const AGE_REGEX = /\b(\d{1,3})\s*(?:\+\s*)?years?\s*(?:old|of age)\b|\b(?:aged?|age of)\s+(\d{1,3})\b|\b(\d{1,3})\s*\+?\s*(?:and (?:over|above|older)|only)\b/i;

function getSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "node_modules" && entry.name !== "test") {
        files.push(...getSourceFiles(fullPath));
      }
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.includes(".test.") &&
      !entry.name.includes(".spec.")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("Age Copy Guard (Rule: The only age number permitted is 18)", () => {
  it("ensures no non-test source file in web app contains an age number other than 18", () => {
    const srcDir = path.resolve(__dirname, "..");
    const files = getSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; line: number; text: string; matchedNumber: number }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        // Global search on line
        const globalRegex = new RegExp(AGE_REGEX.source, "gi");
        let match: RegExpExecArray | null;
        while ((match = globalRegex.exec(line)) !== null) {
          const numStr = match[1] || match[2] || match[3];
          if (!numStr) {
            continue;
          }
          const ageNum = parseInt(numStr, 10);
          if (ageNum !== 18) {
            violations.push({
              file: path.relative(srcDir, file),
              line: idx + 1,
              text: line.trim(),
              matchedNumber: ageNum
            });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
