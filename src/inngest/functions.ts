import { askYesNo } from "@/lib/model";
import type { Branch } from "@/lib/types";

import { inngest } from "./client";

/** A node as it arrives from the canvas - only the parts execution needs. */
type RunNode = { id: string; data: { question: string } };

/** An edge as it arrives from the canvas. sourceHandle is "yes" or "no". */
type RunEdge = { source: string; sourceHandle: string | null; target: string };

/** One hop, recorded so the caller can see the path that was taken and why. */
type Visit = {
  nodeId: string;
  question: string;
  answer: Branch;
  reasoning: string;
  next: string | null;
};

/**
 * A graph can contain a cycle, and a cycle would walk forever. This caps a run at
 * a length no sensible workflow reaches, so a mistake costs a few calls rather
 * than an unbounded number of them.
 */
const MAX_STEPS = 20;

export const runWorkflow = inngest.createFunction(
  {
    id: "run-workflow",
    name: "Run workflow",
    // Inngest v4 takes triggers inside the config object. In v3 they were a
    // separate second argument, which is what most tutorials still show.
    triggers: [{ event: "workflow/run" }],
  },
  async ({ event, step }) => {
    const nodes = event.data.nodes as RunNode[];
    const edges = event.data.edges as RunEdge[];
    const input = event.data.input as string;

    let currentId: string | null = event.data.startNodeId as string;
    const path: Visit[] = [];

    for (let i = 0; i < MAX_STEPS && currentId; i++) {
      const nodeId: string = currentId;
      const node = nodes.find((candidate) => candidate.id === nodeId);

      if (!node) {
        throw new Error(`Edge points at node "${nodeId}", which is not on the canvas`);
      }
      if (!node.data.question.trim()) {
        throw new Error(`Node "${nodeId}" has no question to ask`);
      }

      // Each node is its own step. Inngest records the result, so a retry re-runs
      // only the step that failed rather than replaying the whole workflow - and
      // the dashboard shows each one arriving. The index keeps step ids unique
      // even if a node is visited more than once.
      const decision = await step.run(`ask-${i}-${nodeId}`, () =>
        askYesNo(node.data.question, input),
      );
      const answer: Branch = decision.branch;

      // The answer selects the edge. This is the entire branching mechanism:
      // a word from the model becomes a choice of which arrow to follow.
      const edge = edges.find(
        (candidate) => candidate.source === nodeId && candidate.sourceHandle === answer,
      );
      const next: string | null = edge ? edge.target : null;

      path.push({
        nodeId,
        question: node.data.question,
        answer,
        reasoning: decision.reasoning,
        next,
      });

      // No edge for that answer means this branch ends here. That is a finished
      // run, not a failure - a leaf node is how a workflow terminates.
      currentId = next;
    }

    if (currentId) {
      throw new Error(
        `Workflow did not finish within ${MAX_STEPS} steps - the graph probably contains a loop`,
      );
    }

    return { steps: path.length, path };
  },
);
