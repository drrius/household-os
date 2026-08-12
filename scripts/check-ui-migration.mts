import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

const sourceRoot = "src";
const checkedExtensions = new Set([".css", ".ts", ".tsx"]);
const forbiddenPaths = [
  "src/app/design-system.css",
  "src/ui/primitives",
  "src/ui/groceries/groceries.module.css",
  "src/ui/groceries/shopping-session-rail.module.css",
  "src/ui/plan/meal-board.module.css",
];
const forbiddenReferences = [
  {
    label: "legacy primitive import",
    pattern: /@\/ui\/primitives/,
  },
  {
    label: "legacy stylesheet reference",
    pattern: /design-system\.css/,
  },
];

function sourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (checkedExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

const failures = forbiddenPaths
  .filter((path) => existsSync(path))
  .map((path) => `legacy path remains: ${path}`);

for (const path of sourceFiles(sourceRoot)) {
  const contents = readFileSync(path, "utf8");

  for (const reference of forbiddenReferences) {
    if (reference.pattern.test(contents)) {
      failures.push(`${reference.label}: ${relative(process.cwd(), path)}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`UI migration is incomplete:\n${failures.join("\n")}`);
}

console.log("UI migration gate: legacy primitives and styles are absent.");
