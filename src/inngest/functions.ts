import { askYesNo } from "@/lib/model";
import { createRun, getRun, updateRun, type RunStep } from "@/lib/runStore";
import type { Branch } from "@/lib/types";

import { inngest } from "./client";

/** A node as it arrives from the canvas - only the parts execution needs. */
type RunNode = {
  id: string;
  kind: "decision" | "outcome";
  question: string;
  label: string;
};

/** An edge as it arrives from the canvas. sourceHandle is "yes" or "no". */
type RunEdge = { source: string; sourceHandle: string | null; target: string };

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
    const runId = event.data.runId as string;
    const nodes = event.data.nodes as RunNode[];
    const edges = event.data.edges as RunEdge[];
    const input = event.data.input as string;

    // The route creates the run before sending the event, but a replayed event
    // would not have one. Creating it here too keeps the status endpoint honest
    // rather than answering "unknown run".
    if (!getRun(runId)) createRun(runId);

    let currentId: string | null = event.data.startNodeId as string;
    const path: RunStep[] = [];

    try {
      for (let i = 0; i < MAX_STEPS && currentId; i++) {
        const nodeId: string = currentId;
        const node = nodes.find((candidate) => candidate.id === nodeId);

        if (!node) {
          throw new Error(`Edge points at node "${nodeId}", which is not on the canvas`);
        }

        // An outcome ends the run. It is never sent to the model - it reports a
        // verdict rather than asking anything.
        if (node.kind === "outcome") {
          updateRun(runId, {
            status: "done",
            currentNodeId: nodeId,
            outcome: node.label || "(unnamed outcome)",
            finishedAt: Date.now(),
          });
          return { steps: path.length, path, outcome: node.label };
        }

        if (!node.question.trim()) {
          throw new Error(`Node "${nodeId}" has no question to ask`);
        }

        updateRun(runId, { currentNodeId: nodeId });

        // Each node is its own step. Inngest records the result, so a retry
        // re-runs only the step that failed rather than replaying the whole
        // workflow - and the dashboard shows each one arriving. The index keeps
        // step ids unique even if a node is visited more than once.
        const decision = await step.run(`ask-${i}-${nodeId}`, () =>
          askYesNo(node.question, input),
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
          question: node.question,
          answer,
          reasoning: decision.reasoning,
          next,
        });
        updateRun(runId, { path: [...path], currentNodeId: next });

        // No edge for that answer means the branch ends here. That is a finished
        // run rather than a failure, though without an outcome node the caller
        // gets no verdict - which the logs panel points out.
        currentId = next;
      }

      if (currentId) {
        throw new Error(
          `Workflow did not finish within ${MAX_STEPS} steps - the graph probably contains a loop`,
        );
      }

      updateRun(runId, {
        status: "done",
        currentNodeId: null,
        outcome: null,
        finishedAt: Date.now(),
      });
      return { steps: path.length, path, outcome: null };
    } catch (error) {
      updateRun(runId, {
        status: "error",
        currentNodeId: null,
        error: error instanceof Error ? error.message : String(error),
        finishedAt: Date.now(),
      });
      throw error;
    }
  },
);
