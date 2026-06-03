import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// Helper to recursively find all TypeScript/React files
function getAllFiles(dir: string, extList: string[]): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, extList));
    } else if (extList.includes(path.extname(item))) {
      files.push(fullPath);
    }
  }
  return files;
}

// Helper to find the matching closing character for an opening brace/parenthesis
function getBlock(content: string, startIndex: number, openChar: string, closeChar: string): string {
  let depth = 0;
  let inString: string | null = null;
  let escapeNext = false;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    // Handle string literal boundaries to avoid counting braces inside strings
    if (char === '"' || char === "'" || char === "`") {
      if (inString === char) {
        inString = null;
      } else if (!inString) {
        inString = char;
      }
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return content.substring(startIndex, i + 1);
      }
    }
  }
  return content.substring(startIndex);
}

type QueryOccurrence = {
  file: string;
  line: number;
  queryKey: string;
  returnShape: "res.data.data" | "res.data" | "other";
  rawReturn: string;
};

describe("React Query Cache Shape Consistency", () => {
  it("enforces that all queryFn observers for the same queryKey return the exact same data shape", () => {
    const srcDir = path.resolve(__dirname, "..");
    const files = getAllFiles(srcDir, [".ts", ".tsx"]);

    const occurrences: QueryOccurrence[] = [];

    for (const file of files) {
      // Skip test files themselves to avoid testing mock implementations
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx") || file.endsWith(".spec.ts")) {
        continue;
      }

      const content = fs.readFileSync(file, "utf8");
      let index = 0;

      while (true) {
        const queryIndex = content.indexOf("useQuery", index);
        if (queryIndex === -1) break;

        // Advance scan index past the match
        index = queryIndex + 8;

        // Find the start of the useQuery configuration block
        const openParenIndex = content.indexOf("(", queryIndex);
        if (openParenIndex === -1 || openParenIndex > queryIndex + 50) continue;

        // Extract the full useQuery(...) block
        const fullBlock = getBlock(content, openParenIndex, "(", ")");

        // Calculate line number for reporting
        const line = content.substring(0, queryIndex).split("\n").length;

        // Parse queryKey from the block
        // Matches queryKey: [ 'a', 'b', ... ] or queryKey: ["a", "b", ...]
        // eslint-disable-next-line security/detect-unsafe-regex
        const keyRegex = /queryKey:\s*\[\s*(?:"|')([^"']+)(?:"|')\s*(?:,\s*(?:"|')([^"']+)(?:"|'))?/;
        const keyMatch = keyRegex.exec(fullBlock);
        if (!keyMatch) continue;

        const mainKey = keyMatch[1];
        if (!mainKey) continue;
        const subKey = keyMatch[2];
        const canonicalKey = subKey ? `${mainKey}.${subKey}` : mainKey;

        // Extract return statements inside the useQuery block
        // Find the return statement inside queryFn
        const returnRegex = /return\s+([a-zA-Z0-9_.?!\][()]+)/g;
        let returnMatch;
        let returnShape: "res.data.data" | "res.data" | "other" = "other";
        let rawReturn = "none";

        while ((returnMatch = returnRegex.exec(fullBlock)) !== null) {
          const retExpr = returnMatch[1];
          if (retExpr) {
            rawReturn = retExpr;
            if (retExpr.endsWith(".data.data")) {
              returnShape = "res.data.data";
              break;
            } else if (retExpr.endsWith(".data")) {
              returnShape = "res.data";
              break;
            }
          }
        }

        occurrences.push({
          file: path.relative(srcDir, file),
          line,
          queryKey: canonicalKey,
          returnShape,
          rawReturn
        });
      }
    }

    // Group occurrences by canonical queryKey
    const groups: Record<string, QueryOccurrence[]> = {};
    for (const occ of occurrences) {
      if (!groups[occ.queryKey]) {
        groups[occ.queryKey] = [];
      }
      groups[occ.queryKey]!.push(occ);
    }

    // Assert cache shape consistency per queryKey
    const mismatches: string[] = [];

    for (const [queryKey, list] of Object.entries(groups)) {
      if (list.length < 2) continue; // Only check queryKeys used in multiple places

      const shapes = list.map((o) => o.returnShape);
      const uniqueShapes = Array.from(new Set(shapes));

      if (uniqueShapes.length > 1) {
        const details = list
          .map((o) => `  - File: ${o.file}:${o.line} | Return shape: ${o.returnShape} (raw: '${o.rawReturn}')`)
          .join("\n");
        mismatches.push(`Query key '${queryKey}' has inconsistent cached return shapes:\n${details}`);
      }
    }

    if (mismatches.length > 0) {
      const errorMessage =
        "React Query cache shape mismatch detected! All observers of the same queryKey MUST return the same data shape to prevent cache corruption:\n\n" +
        mismatches.join("\n\n");
      throw new Error(errorMessage);
    }

    expect(mismatches.length).toBe(0);
  });
});
