#!/usr/bin/env node

import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const includeBuilds = args.has("--include-builds");

const cacheDirs = [
  "operator-s-console/node_modules/.vite",
  "orchestrator/node_modules/.vite"
];

const optionalBuildDirs = [
  "operator-s-console/dist"
];

const optionalBuildBackupPrefixes = [
  "operator-s-console/dist.vitest-bak-"
];

const walkRoots = [
  "orchestrator",
  "operator-s-console"
];

const EXCLUDED_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "data",
  "dist",
  "logs",
  "memory"
]);

const PROTECTED_PREFIXES = [
  "orchestrator/dist",
  "openclaw-docs/.generated",
  "logs",
  "memory",
  "node_modules"
];

function normalizeRelative(targetPath) {
  return path.relative(repoRoot, targetPath).split(path.sep).join("/");
}

function ensureInsideRepo(targetPath) {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside repo root: ${targetPath}`);
  }
  return resolved;
}

function assertNotProtectedTarget(relativeTarget) {
  for (const prefix of PROTECTED_PREFIXES) {
    if (relativeTarget === prefix || relativeTarget.startsWith(`${prefix}/`)) {
      throw new Error(`Refusing to remove protected path: ${relativeTarget}`);
    }
  }
}

function collectRecursiveTargets(startRelative, matcher, bucket) {
  const startPath = ensureInsideRepo(path.join(repoRoot, startRelative));
  if (!existsSync(startPath)) {
    return;
  }

  let startStats;
  try {
    startStats = statSync(startPath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EACCES") {
      return;
    }
    throw error;
  }

  if (!startStats.isDirectory()) {
    return;
  }

  const queue = [startPath];
  while (queue.length > 0) {
    const currentPath = queue.pop();
    let entries;
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EACCES") {
        continue;
      }
      throw error;
    }
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = normalizeRelative(absolutePath);

      if (entry.isDirectory()) {
        if (EXCLUDED_DIR_NAMES.has(entry.name)) {
          continue;
        }

        if (matcher(relativePath, entry)) {
          bucket.add(relativePath);
          continue;
        }

        queue.push(absolutePath);
        continue;
      }

      if (matcher(relativePath, entry)) {
        bucket.add(relativePath);
      }
    }
  }
}

const removalTargets = new Set();

try {
  const rootEntries = readdirSync(repoRoot, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isDirectory() && entry.name === "coverage") {
      removalTargets.add("coverage");
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".tsbuildinfo")) {
      removalTargets.add(entry.name);
    }
  }
} catch (error) {
  if (!(error && typeof error === "object" && "code" in error && error.code === "EACCES")) {
    throw error;
  }
}

for (const target of cacheDirs) {
  const absoluteTarget = ensureInsideRepo(path.join(repoRoot, target));
  if (existsSync(absoluteTarget)) {
    removalTargets.add(target);
  }
}

for (const walkRoot of walkRoots) {
  collectRecursiveTargets(
    walkRoot,
    (relativePath, entry) => entry.isDirectory() && path.basename(relativePath) === "coverage",
    removalTargets
  );
  collectRecursiveTargets(
    walkRoot,
    (relativePath, entry) => entry.isFile() && relativePath.endsWith(".tsbuildinfo"),
    removalTargets
  );
}

const skippedBuilds = [];
if (includeBuilds) {
  for (const target of optionalBuildDirs) {
    const absoluteTarget = ensureInsideRepo(path.join(repoRoot, target));
    if (existsSync(absoluteTarget)) {
      removalTargets.add(target);
    }
  }

  for (const prefix of optionalBuildBackupPrefixes) {
    const parentDir = ensureInsideRepo(path.join(repoRoot, path.dirname(prefix)));
    if (!existsSync(parentDir)) {
      continue;
    }

    for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const relativePath = normalizeRelative(path.join(parentDir, entry.name));
      if (relativePath.startsWith(prefix)) {
        removalTargets.add(relativePath);
      }
    }
  }
} else {
  for (const target of optionalBuildDirs) {
    const absoluteTarget = ensureInsideRepo(path.join(repoRoot, target));
    if (existsSync(absoluteTarget)) {
      skippedBuilds.push(target);
    }
  }
  for (const prefix of optionalBuildBackupPrefixes) {
    const parentDir = ensureInsideRepo(path.join(repoRoot, path.dirname(prefix)));
    if (!existsSync(parentDir)) {
      continue;
    }

    for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const relativePath = normalizeRelative(path.join(parentDir, entry.name));
      if (relativePath.startsWith(prefix)) {
        skippedBuilds.push(relativePath);
      }
    }
  }
}

const sortedTargets = [...removalTargets].sort();

for (const target of sortedTargets) {
  assertNotProtectedTarget(target);
}

if (sortedTargets.length === 0) {
  console.log(
    dryRun
      ? "clean-workspace: nothing to remove (dry run)"
      : "clean-workspace: nothing to remove"
  );
} else {
  console.log(
    dryRun
      ? "clean-workspace: would remove:"
      : "clean-workspace: removing:"
  );
  for (const target of sortedTargets) {
    console.log(` - ${target}`);
  }
}

if (skippedBuilds.length > 0) {
  console.log("clean-workspace: skipped build outputs by default:");
  for (const target of skippedBuilds) {
    console.log(` - ${target}`);
  }
  console.log("clean-workspace: rerun with --include-builds to remove those untracked dist outputs.");
}

if (!dryRun) {
  for (const target of sortedTargets) {
    rmSync(path.join(repoRoot, target), { recursive: true, force: true });
  }
}
