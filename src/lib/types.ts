import type { Edge, Node } from "@xyflow/react";

/**
 * The only two answers a decision node may receive.
 *
 * This is the constraint the whole design rests on: a model that can return one
 * of two words is returning a bit, and a bit is something a graph can branch on.
 * Widen this and the project stops being a workflow engine.
 */
export type Branch = "yes" | "no";

export const BRANCHES: Branch[] = ["yes", "no"];

/**
 * What each node on the canvas carries. The index signature is required by
 * React Flow, which stores node data as an open record.
 */
export type DecisionNodeData = {
  question: string;
  [key: string]: unknown;
};

/** A node in this app is always a decision - there is only one node type. */
export type DecisionNodeType = Node<DecisionNodeData, "decision">;

/** An edge is one branch: it leaves a node through either the yes or no handle. */
export type WorkflowEdge = Edge;

/** Colours shared by the handles, the edges and their labels. */
export const BRANCH_COLOR: Record<Branch, string> = {
  yes: "#15803d",
  no: "#b91c1c",
};
