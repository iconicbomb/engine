// The planner CLI's only contact with secrets: .env at the repo root (gitignored). Parsed with dotenv, never logged,
// never written. A file holding just a bare key (one `sk-ant-...` line) is read as ANTHROPIC_API_KEY.
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export interface PlannerEnv { apiKey?: string; model: string; workspaceId?: string }

export function loadEnv(path = ".env", env: NodeJS.ProcessEnv = process.env): PlannerEnv {
  let vars: Record<string, string> = {};
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf8");
    vars = parse(raw);
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    if (!vars.ANTHROPIC_API_KEY && lines.length === 1 && /^sk-ant-[\w-]+$/.test(lines[0])) vars.ANTHROPIC_API_KEY = lines[0];
  }
  return {
    apiKey: env.ANTHROPIC_API_KEY || vars.ANTHROPIC_API_KEY || undefined,
    model: env.PLANNER_MODEL || vars.PLANNER_MODEL || DEFAULT_MODEL,
    // keys not scoped to a workspace must name one on every request
    workspaceId: env.ANTHROPIC_WORKSPACE_ID || vars.ANTHROPIC_WORKSPACE_ID || undefined,
  };
}
