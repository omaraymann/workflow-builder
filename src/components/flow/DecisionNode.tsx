"use client";

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { BRANCH_COLOR, STATUS_RING, type WorkflowNode } from "@/lib/types";

/**
 * One question on the canvas.
 *
 * It has one entry point at the top and exactly two exits at the bottom, one per
 * answer. Giving every node both handles from the moment it is created is
 * deliberate: the alternative - draw a line first, label it afterwards - lets a
 * user leave a branch unlabelled, or label both the same, and the workflow is
 * then broken in a way that is hard to see. Here that state cannot be expressed.
 */
function DecisionNodeComponent({ id, data, selected }: NodeProps<WorkflowNode>) {
  const { updateNodeData } = useReactFlow();
  const status = data.status ?? "idle";

  return (
    <div
      className={`w-64 rounded-lg border-2 bg-white shadow-sm transition-all ${
        STATUS_RING[status]
      } ${selected ? "shadow-md" : ""} ${status === "running" ? "animate-pulse" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-neutral-400"
      />

      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          Question
        </span>
        {status !== "idle" && (
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{
              color:
                status === "yes"
                  ? BRANCH_COLOR.yes
                  : status === "no"
                    ? BRANCH_COLOR.no
                    : status === "error"
                      ? BRANCH_COLOR.no
                      : "#b45309",
            }}
          >
            {status === "running" ? "asking..." : status}
          </span>
        )}
      </div>

      <div className="px-3 pb-3">
        <textarea
          // "nodrag" stops React Flow treating a drag inside the box as a drag of
          // the box itself - without it you cannot select text to edit it.
          className="nodrag w-full resize-none rounded border border-neutral-200 bg-neutral-50 p-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
          rows={3}
          value={data.question ?? ""}
          placeholder="Is this a support request?"
          onChange={(event) => updateNodeData(id, { question: event.target.value })}
        />
      </div>

      <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-1.5">
        <span
          className="text-[10px] font-bold tracking-widest"
          style={{ color: BRANCH_COLOR.yes }}
        >
          YES
        </span>
        <span className="text-[10px] font-bold tracking-widest" style={{ color: BRANCH_COLOR.no }}>
          NO
        </span>
      </div>

      <Handle
        id="yes"
        type="source"
        position={Position.Bottom}
        style={{ left: "22%", backgroundColor: BRANCH_COLOR.yes }}
        className="!h-3 !w-3 !border-2 !border-white"
      />
      <Handle
        id="no"
        type="source"
        position={Position.Bottom}
        style={{ left: "78%", backgroundColor: BRANCH_COLOR.no }}
        className="!h-3 !w-3 !border-2 !border-white"
      />
    </div>
  );
}

export const DecisionNode = memo(DecisionNodeComponent);
