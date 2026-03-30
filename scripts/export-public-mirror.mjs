import { copyFile, cp, lstat, mkdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, "..");

const EXCLUDED_PATHS = [
  "MEMORY.md",
  ".openclaw/workspace-state.json",
  ".codex",
];

function printUsage() {
  console.error(
    "Usage: node scripts/export-public-mirror.mjs <destination> [--force] [--git-init]",
  );
}

function shouldExclude(relativePath) {
  return EXCLUDED_PATHS.some(
    (excluded) =>
      relativePath === excluded || relativePath.startsWith(`${excluded}/`),
  );
}

async function readGitFileList() {
  const { stdout } = await execFile(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: workspaceRoot, maxBuffer: 1024 * 1024 * 20 },
  );
  return stdout
    .split("\u0000")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

async function copyEntry(sourcePath, destinationPath) {
  const stats = await lstat(sourcePath);
  await mkdir(dirname(destinationPath), { recursive: true });

  if (stats.isSymbolicLink()) {
    const target = await readlink(sourcePath);
    await symlink(target, destinationPath);
    return;
  }

  if (stats.isDirectory()) {
    await cp(sourcePath, destinationPath, { recursive: true });
    return;
  }

  await copyFile(sourcePath, destinationPath);
}

async function detectDirtyState() {
  const { stdout } = await execFile("git", ["status", "--short"], {
    cwd: workspaceRoot,
  });
  return stdout.trim().length > 0;
}

async function readHeadSha() {
  const { stdout } = await execFile("git", ["rev-parse", "HEAD"], {
    cwd: workspaceRoot,
  });
  return stdout.trim();
}

async function readCurrentBranch() {
  const { stdout } = await execFile("git", ["branch", "--show-current"], {
    cwd: workspaceRoot,
  });
  return stdout.trim() || null;
}

async function maybeInitGit(destination) {
  await execFile("git", ["init", "-b", "main"], { cwd: destination });
}

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const force = args.includes("--force");
  const gitInit = args.includes("--git-init");

  if (positional.length !== 1) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const destination = isAbsolute(positional[0])
    ? positional[0]
    : resolve(workspaceRoot, positional[0]);

  const relativeDestination = relative(workspaceRoot, destination);
  if (
    relativeDestination === "" ||
    (!relativeDestination.startsWith("..") && !isAbsolute(relativeDestination))
  ) {
    throw new Error(
      "Destination must be outside the current repo root to avoid recursive export.",
    );
  }

  if (force) {
    await rm(destination, { recursive: true, force: true });
  }

  await mkdir(destination, { recursive: true });

  const files = await readGitFileList();
  const exported = [];

  for (const relativePath of files) {
    if (shouldExclude(relativePath)) {
      continue;
    }
    const sourcePath = resolve(workspaceRoot, relativePath);
    const destinationPath = resolve(destination, relativePath);
    await copyEntry(sourcePath, destinationPath);
    exported.push(relativePath);
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    sourceBranch: await readCurrentBranch(),
    sourceHead: await readHeadSha(),
    includesUncommittedChanges: await detectDirtyState(),
    exportedFileCount: exported.length,
    excludedPaths: EXCLUDED_PATHS,
    notes: [
      "This mirror is a fresh export of the current working tree, not a history rewrite.",
      "Initialize and publish it as a separate repository if you want a public release.",
    ],
  };

  await writeFile(
    resolve(destination, "PUBLIC_MIRROR_MANIFEST.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  if (gitInit) {
    await maybeInitGit(destination);
  }

  console.log(
    `[public-mirror] exported ${exported.length} files to ${destination}`,
  );
}

main().catch((error) => {
  console.error("[public-mirror] export failed:", error);
  process.exitCode = 1;
});
