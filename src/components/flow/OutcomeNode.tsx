"use client";

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { STATUS_RING, type WorkflowNode } from "@/lib/types";

/**
 * Where a branch ends.
 *
 * An outcome is never sent to the model. "Accept" is not a question, and asking
 * it wasted a call and produced a meaningless answer that happened to end the run
 * only because nothing was connected after it. Making outcomes their own kind of
 * node means an endpoint is an endpoint by design rather than by accident - it
 * has an entry point and no exits, so it cannot lead anywhere.
 */
function OutcomeNodeComponent({ id, data, selected }: NodeProps<WorkflowNode>) {
  const { updateNodeData } = useReactFlow();
  const reached = data.status === "reached";

  return (
    <div
      className={`w-56 rounded-lg border-2 shadow-sm transition-all ${
        reached ? "border-neutral-900 bg-neutral-900" : `${STATUS_RING.idle} bg-neutral-50`
      } ${selected ? "shadow-md" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-neutral-400"
      />

      <div className="px-3 pt-2 pb-1">
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest ${
            reached ? "text-neutral-400" : "text-neutral-400"
          }`}
        >
          {reached ? "Outcome - reached" : "Outcome"}
        </span>
      </div>

      <div className="px-3 pb-3">
        <input
          className={`nodrag w-full rounded border p-2 text-sm font-medium outline-none ${
            reached
              ? "border-neutral-700 bg-neutral-800 text-white"
              : "border-neutral-200 bg-white text-neutral-900 focus:border-neutral-400"
          }`}
          value={data.label ?? ""}
          placeholder="Accept"
          onChange={(event) => updateNodeData(id, { label: event.target.value })}
        />
      </div>
    </div>
  );
}

export const OutcomeNode = memo(OutcomeNodeComponent);
