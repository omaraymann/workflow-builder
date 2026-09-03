import type { Edge, Node } from "@xyflow/react";

/**
 * The only two answers a decision node may receive.
 *
 * This is the constraint the whole design rests on: a model that can return one
 * of two words is returning a bit, and a bit is something a graph can branch on.
 * Widen this and the project stops being a workflow engine.
 */
export type Branch = "yes" | "no";

/**
 * What a node is for.
 *
 * A decision asks the model something. An outcome ends the run and reports a
 * verdict - it is never sent to the model, because "accept" is not a question.
 */
export type NodeKind = "decision" | "outcome";

/** How a node is drawn during and after a run. */
export type NodeStatus = "idle" | "running" | "yes" | "no" | "reached" | "error";

/**
 * One data shape for both node kinds, with node.type saying which fields matter.
 * A union type would be tidier but fights React Flow's state hooks for no gain
 * at this size.
 */
export type WorkflowNodeData = {
  /** Decision nodes: the question put to the model. */
  question: string;
  /** Outcome nodes: the verdict this endpoint represents. */
  label: string;
  status: NodeStatus;
  [key: string]: unknown;
};

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

/** Colours shared by the handles, the edges and their labels. */
export const BRANCH_COLOR: Record<Branch, string> = {
  yes: "#15803d",
  no: "#b91c1c",
};

export const STATUS_RING: Record<NodeStatus, string> = {
  idle: "border-neutral-300",
  running: "border-amber-500",
  yes: "border-emerald-600",
  no: "border-red-600",
  reached: "border-neutral-900",
  error: "border-red-600",
};
