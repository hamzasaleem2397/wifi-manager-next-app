/**
 * Persists MAC → nickname mappings to a local JSON file.
 * Simple file-based storage — no database needed.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_FILE = join(process.cwd(), "data", "aliases.json");

function ensureFile(): void {
  const dir = join(process.cwd(), "data");
  try {
    if (!existsSync(dir)) {
      const { mkdirSync } = require("fs");
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(DATA_FILE)) {
      writeFileSync(DATA_FILE, "{}", "utf-8");
    }
  } catch {
    // ignore in read-only environments
  }
}

export function getAliases(): Record<string, string> {
  try {
    ensureFile();
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function setAlias(mac: string, alias: string): void {
  const aliases = getAliases();
  aliases[mac.toUpperCase()] = alias;
  writeFileSync(DATA_FILE, JSON.stringify(aliases, null, 2), "utf-8");
}

export function removeAlias(mac: string): void {
  const aliases = getAliases();
  delete aliases[mac.toUpperCase()];
  writeFileSync(DATA_FILE, JSON.stringify(aliases, null, 2), "utf-8");
}
