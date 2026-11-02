/**
 * Tracks locally which devices have been blocked.
 * Also persisted to JSON so state survives restarts.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_FILE = join(process.cwd(), "data", "blocked.json");

function ensureFile(): void {
  const dir = join(process.cwd(), "data");
  try {
    if (!existsSync(dir)) {
      const { mkdirSync } = require("fs");
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(DATA_FILE)) {
      writeFileSync(DATA_FILE, "[]", "utf-8");
    }
  } catch {}
}

export function getBlocked(): string[] {
  try {
    ensureFile();
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function addBlocked(mac: string): void {
  const list = new Set(getBlocked());
  list.add(mac.toUpperCase());
  writeFileSync(DATA_FILE, JSON.stringify([...list], null, 2), "utf-8");
}

export function removeBlocked(mac: string): void {
  const list = new Set(getBlocked());
  list.delete(mac.toUpperCase());
  writeFileSync(DATA_FILE, JSON.stringify([...list], null, 2), "utf-8");
}

export function isBlocked(mac: string): boolean {
  return getBlocked().includes(mac.toUpperCase());
}
