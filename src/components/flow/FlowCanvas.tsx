"use client";

import {
  addEdge,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";

import type { RunState } from "@/lib/runStore";
import { downloadJSON, fromJSON, loadLocal, saveLocal } from "@/lib/storage";
import {
  BRANCH_COLOR,
  type Branch,
  type NodeStatus,
  type WorkflowEdge,
  type WorkflowNode,
} from "@/lib/types";
import { DecisionNode } from "./DecisionNode";
import { OutcomeNode } from "./OutcomeNode";
import { RunPanel } from "./RunPanel";

// Declared outside the component on purpose. React Flow compares this object by
// reference on every render; rebuilding it inline would remount every node on the
// canvas each time anything changes.
const nodeTypes = { decision: DecisionNode, outcome: OutcomeNode };

const INITIAL_NODES: WorkflowNode[] = [
  {
    id: "n1",
    type: "decision",
    position: { x: 260, y: 40 },
    data: { question: "Is this a support request?", label: "", status: "idle" },
  },
];

/** How often to ask the server how a run is going. */
const POLL_MS = 500;

function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([]);

  const nextId = useRef(2);
  const fileInput = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState(
    "A customer wrote: my order never arrived and I want a refund.",
  );
  const [run, setRun] = useState<RunState | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // ---------------------------------------------------------------- persistence

  // Restore once on mount. localStorage does not exist during server rendering,
  // so this cannot happen at module level or in the initial state.
  useEffect(() => {
    const saved = loadLocal();
    if (saved && saved.nodes.length > 0) {
      setNodes(saved.nodes);
      setEdges(saved.edges);
      const highest = saved.nodes
        .map((node) => Number(node.id.replace(/\D/g, "")))
        .filter((value) => Number.isFinite(value));
      nextId.current = (highest.length ? Math.max(...highest) : 1) + 1;
    }
    setRestored(true);
  }, [setNodes, setEdges]);

  // Autosave. Guarded on "restored" so the empty starting graph cannot overwrite
  // a saved workflow in the moment before it loads.
  useEffect(() => {
    if (!restored) return;
    saveLocal(nodes, edges);
  }, [nodes, edges, restored]);

  // ---------------------------------------------------------------- editing

  const addNode = useCallback(
    (kind: "decision" | "outcome") => {
      const id = `n${nextId.current++}`;
      setNodes((current) => [
        ...current,
        {
          id,
          type: kind,
          // Cascade slightly so a new node never lands exactly on the last one.
          position: { x: 120 + current.length * 36, y: 260 + current.length * 28 },
          data: { question: "", label: "", status: "idle" },
        },
      ]);
    },
    [setNodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const branch: Branch = connection.sourceHandle === "yes" ? "yes" : "no";
      const color = BRANCH_COLOR[branch];

      setEdges((current) => {
        // One answer leads to exactly one place. Replacing any existing edge from
        // this same handle means "yes" can never point at two nodes at once,
        // which would make traversal ambiguous.
        const withoutDuplicate = current.filter(
          (edge) =>
            !(edge.source === connection.source && edge.sourceHandle === connection.sourceHandle),
        );

        return addEdge(
          {
            ...connection,
            id: `${connection.source}-${branch}-${connection.target}`,
            label: branch.toUpperCase(),
            style: { stroke: color, strokeWidth: 2 },
            labelStyle: { fill: color, fontWeight: 700, fontSize: 11 },
            labelBgStyle: { fill: "#ffffff" },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 3,
            markerEnd: { type: MarkerType.ArrowClosed, color },
          },
          withoutDuplicate,
        );
      });
    },
    [setEdges],
  );

  // ---------------------------------------------------------------- running

  const applyRunState = useCallback(
    (state: RunState) => {
      setRun(state);

      // Paint the canvas from the run: which node is being asked now, and how each
      // finished node answered.
      const answered = new Map<string, NodeStatus>();
      for (const visit of state.path) answered.set(visit.nodeId, visit.answer);
      if (state.currentNodeId && state.status === "running") {
        answered.set(state.currentNodeId, "running");
      }
      if (state.status === "done" && state.outcome && state.currentNodeId) {
        answered.set(state.currentNodeId, "reached");
      }

      setNodes((current) =>
        current.map((node) => {
          const status = answered.get(node.id) ?? "idle";
          return node.data.status === status ? node : { ...node, data: { ...node.data, status } };
        }),
      );

      // Animate only the edges the run actually took.
      const taken = new Set(
        state.path
          .filter((visit) => visit.next)
          .map((visit) => `${visit.nodeId}-${visit.answer}-${visit.next}`),
      );
      setEdges((current) =>
        current.map((edge) => {
          const active = taken.has(edge.id);
          return edge.animated === active
            ? edge
            : { ...edge, animated: active, style: { ...edge.style, strokeWidth: active ? 3 : 2 } };
        }),
      );
    },
    [setNodes, setEdges],
  );

  const runWorkflow = useCallback(async () => {
    setRunning(true);
    setError(null);
    setRun(null);
    setNodes((current) =>
      current.map((node) => ({ ...node, data: { ...node.data, status: "idle" as NodeStatus } })),
    );

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges, input }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Something went wrong");
        setRunning(false);
        return;
      }

      // Poll until the run finishes. The server answers instantly and works in the
      // background, so this is how the browser finds out what happened.
      const runId: string = result.runId;
      const poll = window.setInterval(async () => {
        const statusResponse = await fetch(`/api/run/${runId}`);
        if (!statusResponse.ok) {
          window.clearInterval(poll);
          setError("Lost track of the run");
          setRunning(false);
          return;
        }
        const state: RunState = await statusResponse.json();
        applyRunState(state);

        if (state.status !== "running") {
          window.clearInterval(poll);
          setRunning(false);
        }
      }, POLL_MS);
    } catch {
      setError("Could not reach the server");
      setRunning(false);
    }
  }, [nodes, edges, input, setNodes, applyRunState]);

  // ---------------------------------------------------------------- import

  const importFile = useCallback(
    async (file: File) => {
      const parsed = fromJSON(await file.text());
      if (!parsed) {
        setError("That file is not a workflow");
        return;
      }
      setNodes(parsed.nodes);
      setEdges(parsed.edges);
      setError(null);
    },
    [setNodes, setEdges],
  );

  return (
    <div className="relative h-screen w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background gap={16} color="#e5e5e5" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-neutral-100" />
      </ReactFlow>

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex w-56 flex-col gap-2">
        <button
          type="button"
          onClick={() => addNode("decision")}
          className="pointer-events-auto rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-700"
        >
          Add question
        </button>
        <button
          type="button"
          onClick={() => addNode("outcome")}
          className="pointer-events-auto rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100"
        >
          Add outcome
        </button>

        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={() => downloadJSON(nodes, edges)}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-100"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-100"
          >
            Import
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
            event.target.value = "";
          }}
        />

        <p className="pointer-events-none rounded-md bg-white/90 px-3 py-2 text-xs leading-relaxed text-neutral-600 shadow-sm">
          Questions branch on the model&apos;s YES or NO. Outcomes end a run. Your
          workflow saves itself as you edit. Select anything and press Backspace to
          delete it.
        </p>
      </div>

      <RunPanel
        input={input}
        onInputChange={setInput}
        onRun={runWorkflow}
        running={running}
        error={error}
        run={run}
      />
    </div>
  );
}

/**
 * ReactFlowProvider supplies the context that useReactFlow reads, which is what
 * lets a node update its own data from inside itself.
 */
export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
