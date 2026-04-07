import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type SessionState = {
  threadKey: string;       // slack thread_ts or "dm:<channel>"
  channel: string;
  sessionId?: string;      // claude session id; filled after first system/init
  worktree: string;
  slackMsgTs?: string;     // the bot message we're streaming into
  createdAt: number;
};

const STORE = join(dirname(new URL(import.meta.url).pathname), "sessions.json");

let map = new Map<string, SessionState>();

export function load() {
  if (!existsSync(STORE)) return;
  try {
    const raw = JSON.parse(readFileSync(STORE, "utf8")) as SessionState[];
    map = new Map(raw.map((s) => [s.threadKey, s]));
  } catch {}
}

export function save() {
  if (!existsSync(dirname(STORE))) mkdirSync(dirname(STORE), { recursive: true });
  writeFileSync(STORE, JSON.stringify([...map.values()], null, 2));
}

export function get(key: string) { return map.get(key); }
export function set(s: SessionState) { map.set(s.threadKey, s); save(); }
export function del(key: string) { map.delete(key); save(); }
export function all() { return [...map.values()]; }

/**
 * Discover existing Claude Code sessions on disk. Conductor spawns the same
 * `claude` CLI under the hood, so its sessions live here too — which is how we
 * achieve "seamless co-work" without any Conductor source code or API.
 *
 * Layout: ~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl
 */
export function discoverClaudeSessions(limit = 20) {
  const root = join(homedir(), ".claude", "projects");
  if (!existsSync(root)) return [];
  const out: { sessionId: string; cwd: string; mtime: number }[] = [];
  for (const proj of readdirSync(root)) {
    const dir = join(root, proj);
    // Conductor/Claude Code encodes the cwd by replacing "/" with "-"
    const cwd = "/" + proj.replace(/^-/, "").replace(/-/g, "/");
    let files: string[] = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")); } catch { continue; }
    for (const f of files) {
      try {
        const mtime = statSync(join(dir, f)).mtimeMs;
        out.push({ sessionId: f.replace(/\.jsonl$/, ""), cwd, mtime });
      } catch {}
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, limit);
}
