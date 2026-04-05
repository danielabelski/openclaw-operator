import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function expandReferences(
  value: string,
  scopedEnv: Record<string, string>,
) {
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, key: string) => {
    return scopedEnv[key] ?? process.env[key] ?? "";
  });
}

function parseLine(
  line: string,
  scopedEnv: Record<string, string>,
): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const normalized = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length).trim()
    : trimmed;
  const separatorIndex = normalized.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  const rawValue = normalized.slice(separatorIndex + 1).trim();
  const expanded = expandReferences(unquote(rawValue), scopedEnv);
  return [key, expanded];
}

function loadEnvFile(targetPath: string) {
  const resolvedPath = resolve(targetPath);
  if (!existsSync(resolvedPath)) {
    return false;
  }

  const scopedEnv: Record<string, string> = {};
  const lines = readFileSync(resolvedPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseLine(line, scopedEnv);
    if (!parsed) continue;
    const [key, value] = parsed;
    scopedEnv[key] = value;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return true;
}

const configuredEnvPath = process.env.ORCHESTRATOR_ENV_FILE?.trim();
if (configuredEnvPath) {
  loadEnvFile(configuredEnvPath);
} else {
  loadEnvFile(".env");
}
