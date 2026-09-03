import type { WorkflowEdge, WorkflowNode } from "./types";

const STORAGE_KEY = "workflow-builder:graph";

export type SavedGraph = {
  version: 1;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

/**
 * Strip anything that belongs to a run rather than to the workflow.
 *
 * Node status is how the last run went, not part of the design. Saving it would
 * mean reloading a workflow that claims to be mid-execution.
 */
function clean(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => ({
    ...node,
    selected: false,
    data: { ...node.data, status: "idle" as const },
  }));
}

export function toJSON(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const payload: SavedGraph = { version: 1, nodes: clean(nodes), edges };
  return JSON.stringify(payload, null, 2);
}

/**
 * Read a graph back, rejecting anything that is not one.
 *
 * A file the user picked is untrusted input like any other - the same rule the
 * model's answers follow. Returning null rather than throwing lets the caller
 * show a message instead of crashing the canvas.
 */
export function fromJSON(text: string): SavedGraph | null {
  try {
    const parsed = JSON.parse(text) as Partial<SavedGraph>;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return { version: 1, nodes: clean(parsed.nodes as WorkflowNode[]), edges: parsed.edges };
  } catch {
    return null;
  }
}

/** Browser storage can be unavailable or full; a failed save must not break editing. */
export function saveLocal(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, toJSON(nodes, edges));
  } catch {
    // Nothing to do - the workflow stays usable, it just will not survive a reload.
  }
}

export function loadLocal(): SavedGraph | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? fromJSON(raw) : null;
  } catch {
    return null;
  }
}

/** Hand the graph to the browser as a file download. */
export function downloadJSON(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
  const blob = new Blob([toJSON(nodes, edges)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "workflow.json";
  link.click();
  URL.revokeObjectURL(url);
}
