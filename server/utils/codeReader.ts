import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "../../");
export const SRC_ROOT = path.join(PROJECT_ROOT, "src");

export interface SourceFile {
  relativePath: string;
  content: string;
  lines: number;
}

/** Read a single file relative to project root */
export async function readSourceFile(relPath: string): Promise<SourceFile> {
  const absPath = path.join(PROJECT_ROOT, relPath);
  const content = await fs.readFile(absPath, "utf-8");
  return {
    relativePath: relPath,
    content,
    lines: content.split("\n").length,
  };
}

/** Read multiple files in parallel, skipping missing ones */
export async function readSourceFiles(
  relPaths: string[]
): Promise<SourceFile[]> {
  const settled = await Promise.allSettled(relPaths.map(readSourceFile));
  return settled
    .filter((r): r is PromiseFulfilledResult<SourceFile> => r.status === "fulfilled")
    .map((r) => r.value);
}

/** Recursively list all .ts / .tsx files under a directory */
export async function listSourceFiles(
  dir: string,
  extensions = [".ts", ".tsx", ".css"],
  _visited = new Set<string>(),
): Promise<string[]> {
  const realDir = await fs.realpath(dir);
  if (_visited.has(realDir)) return [];
  _visited.add(realDir);

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
      results.push(...(await listSourceFiles(full, extensions, _visited)));
    } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
      results.push(path.relative(PROJECT_ROOT, full));
    }
  }
  return results;
}

/** Format source files into a prompt-friendly string block */
export function formatFilesForPrompt(files: SourceFile[]): string {
  return files
    .map(
      (f) =>
        `\n=== ${f.relativePath} (${f.lines} lines) ===\n${f.content}\n`
    )
    .join("\n");
}

/** Read package.json as an object */
export async function readPackageJson(): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(path.join(PROJECT_ROOT, "package.json"), "utf-8");
  return JSON.parse(raw);
}
