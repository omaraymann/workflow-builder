import type { Branch } from "./types";

/** One hop through the graph, as the browser needs to display it. */
export type RunStep = {
  nodeId: string;
  question: string;
  answer: Branch;
  reasoning: string;
  next: string | null;
};

export type RunState = {
  id: string;
  status: "running" | "done" | "error";
  /** Steps completed so far. Grows while status is "running". */
  path: RunStep[];
  /** The node currently being asked, so the canvas can highlight it. */
  currentNodeId: string | null;
  /** Set when the run ends at an outcome node. */
  outcome: string | null;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
};

/**
 * Progress for recent runs, held in memory.
 *
 * The Inngest function and the status route run inside the same Next.js process,
 * so a module-level map is enough to get progress from one to the other. This is
 * deliberately the simplest thing that works for a local tool: it does not survive
 * a restart, and it would not work across several server instances. A real
 * deployment would put this in Redis or a database - the shape would not change.
 */
const runs = new Map<string, RunState>();

/** Keeps the last N runs so execution history has something to show. */
const HISTORY_LIMIT = 20;

export function createRun(id: string): RunState {
  const state: RunState = {
    id,
    status: "running",
    path: [],
    currentNodeId: null,
    outcome: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
  };
  runs.set(id, state);

  // Oldest first in insertion order, so dropping from the front trims history.
  while (runs.size > HISTORY_LIMIT) {
    const oldest = runs.keys().next().value;
    if (oldest === undefined) break;
    runs.delete(oldest);
  }

  return state;
}

export function getRun(id: string): RunState | undefined {
  return runs.get(id);
}

export function listRuns(): RunState[] {
  return [...runs.values()].sort((a, b) => b.startedAt - a.startedAt);
}

export function updateRun(id: string, patch: Partial<RunState>): void {
  const existing = runs.get(id);
  if (!existing) return;
  runs.set(id, { ...existing, ...patch });
}
