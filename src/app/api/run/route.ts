import { inngest } from "@/inngest/client";

type IncomingNode = { id: string; data?: { question?: string } };
type IncomingEdge = { source: string; sourceHandle: string | null; target: string };

/**
 * Start a workflow run.
 *
 * This route does not execute anything. It validates the graph, works out where
 * to start, and hands the job to Inngest - so it answers in milliseconds no
 * matter how many nodes the workflow has. Watching it run is the dashboard's job.
 */
export async function POST(request: Request) {
  let body: { nodes?: IncomingNode[]; edges?: IncomingEdge[]; input?: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const nodes = body.nodes ?? [];
  const edges = body.edges ?? [];
  const input = typeof body.input === "string" ? body.input : "";

  if (nodes.length === 0) {
    return Response.json({ error: "Add at least one node before running" }, { status: 400 });
  }
  if (!input.trim()) {
    return Response.json({ error: "Enter some text for the workflow to judge" }, { status: 400 });
  }

  const unanswered = nodes.filter((node) => !node.data?.question?.trim());
  if (unanswered.length > 0) {
    return Response.json(
      { error: `${unanswered.length} node(s) have no question written in them` },
      { status: 400 },
    );
  }

  // The starting node is the one nothing points at. Checking this here, rather
  // than inside the job, means a malformed graph fails immediately with a clear
  // message instead of a few seconds later in a dashboard the user may not have open.
  const targeted = new Set(edges.map((edge) => edge.target));
  const roots = nodes.filter((node) => !targeted.has(node.id));

  if (roots.length === 0) {
    return Response.json(
      { error: "Every node has an arrow into it, so there is no place to start" },
      { status: 400 },
    );
  }
  if (roots.length > 1) {
    return Response.json(
      { error: `${roots.length} nodes have no incoming arrow - connect them so there is one start` },
      { status: 400 },
    );
  }

  const { ids } = await inngest.send({
    name: "workflow/run",
    data: {
      nodes: nodes.map((node) => ({ id: node.id, data: { question: node.data?.question ?? "" } })),
      edges: edges.map((edge) => ({
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
      })),
      input,
      startNodeId: roots[0].id,
    },
  });

  return Response.json({ eventId: ids[0], startNodeId: roots[0].id }, { status: 202 });
}
