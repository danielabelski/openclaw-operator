#!/usr/bin/env node

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const workspaceRoot = process.cwd();

const seedPaths = [
  'README.md',
  'QUICKSTART.md',
  'DEPLOYMENT.md',
  'docs',
  'orchestrator/README.md',
  'operator-s-console/README.md',
  'agents/README.md',
];

function collectMarkdownFiles(entryPath, results) {
  if (!existsSync(entryPath)) return;
  const stats = statSync(entryPath);
  if (stats.isFile()) {
    if (entryPath.endsWith('.md')) results.push(entryPath);
    return;
  }
  if (!stats.isDirectory()) return;

  for (const child of readdirSync(entryPath)) {
    collectMarkdownFiles(join(entryPath, child), results);
  }
}

const markdownFiles = [];
for (const seed of seedPaths) {
  collectMarkdownFiles(resolve(workspaceRoot, seed), markdownFiles);
}

const markdownLinkPattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const problems = [];

for (const filePath of markdownFiles) {
  const contents = readFileSync(filePath, 'utf-8');
  for (const match of contents.matchAll(markdownLinkPattern)) {
    const rawTarget = match[1]?.trim();
    if (!rawTarget) continue;
    if (
      rawTarget.startsWith('#') ||
      /^[a-z]+:/i.test(rawTarget) ||
      rawTarget.startsWith('//')
    ) {
      continue;
    }

    const [relativeTarget] = rawTarget.split('#');
    if (!relativeTarget) continue;

    const resolvedTarget = resolve(filePath, '..', relativeTarget);
    if (!existsSync(resolvedTarget)) {
      problems.push({
        filePath,
        rawTarget,
      });
    }
  }
}

if (problems.length > 0) {
  console.error('[docs-links] broken relative markdown links detected');
  for (const problem of problems) {
    console.error(`- ${problem.filePath}: ${problem.rawTarget}`);
  }
  process.exit(1);
}

console.log(`[docs-links] PASS (${markdownFiles.length} markdown files checked)`);
