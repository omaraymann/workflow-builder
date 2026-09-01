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
import { useCallback, useRef } from "react";

import { BRANCH_COLOR, type Branch, type DecisionNodeType, type WorkflowEdge } from "@/lib/types";
import { DecisionNode } from "./DecisionNode";

// Declared outside the component on purpose. React Flow compares this object by
// reference on every render; rebuilding it inline would remount every node on
// the canvas each time anything changes.
const nodeTypes = { decision: DecisionNode };

const INITIAL_NODES: DecisionNodeType[] = [
  {
    id: "n1",
    type: "decision",
    position: { x: 240, y: 40 },
    data: { question: "Is this a support request?" },
  },
];

function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<DecisionNodeType>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([]);

  // Ids only have to be unique, not meaningful. A counter avoids the collisions
  // you get from using nodes.length after something has been deleted.
  const nextId = useRef(2);

  const addNode = useCallback(() => {
    const id = `n${nextId.current++}`;
    setNodes((current) => [
      ...current,
      {
        id,
        type: "decision",
        // Cascade slightly so a new node never lands exactly on the last one.
        position: { x: 120 + current.length * 40, y: 260 + current.length * 30 },
        data: { question: "" },
      },
    ]);
  }, [setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const branch: Branch = connection.sourceHandle === "yes" ? "yes" : "no";
      const color = BRANCH_COLOR[branch];

      setEdges((current) => {
        // One answer leads to exactly one place. Replacing any existing edge from
        // this same handle means "yes" can never point at two nodes at once -
        // which would make execution ambiguous once Phase 3 starts traversing.
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

  return (
    // React Flow measures its container and renders nothing if that container
    // has no height. An explicit viewport height is used rather than flex-1,
    // which only resolves when every ancestor has a definite height.
    <div className="relative h-screen w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={16} color="#e5e5e5" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-neutral-100" />
      </ReactFlow>

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={addNode}
          className="pointer-events-auto rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-700"
        >
          Add node
        </button>
        <p className="pointer-events-none max-w-56 rounded-md bg-white/90 px-3 py-2 text-xs leading-relaxed text-neutral-600 shadow-sm">
          Type a question into a node, then drag from its green or red dot to
          another node to set where that answer leads. Select a node or edge and
          press Backspace to delete it.
        </p>
      </div>
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
