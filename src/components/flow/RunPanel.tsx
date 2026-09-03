"use client";

import type { RunState } from "@/lib/runStore";
import { BRANCH_COLOR } from "@/lib/types";

type Props = {
  input: string;
  onInputChange: (value: string) => void;
  onRun: () => void;
  running: boolean;
  error: string | null;
  run: RunState | null;
};

/**
 * The right-hand column: what to judge, the run button, and what happened.
 *
 * The log is the point of this panel. A screening tool that rejects someone and
 * cannot say why is one you cannot defend, so every step shows the question, the
 * verdict, and the model's own reasoning for it.
 */
export function RunPanel({ input, onInputChange, onRun, running, error, run }: Props) {
  const finished = run?.status === "done" || run?.status === "error";

  return (
    <aside className="pointer-events-auto absolute right-4 top-4 z-10 flex max-h-[calc(100vh-2rem)] w-80 flex-col rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 p-3">
        <label
          htmlFor="workflow-input"
          className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-neutral-400"
        >
          Text to judge
        </label>
        <textarea
          id="workflow-input"
          className="w-full resize-none rounded border border-neutral-200 bg-neutral-50 p-2 text-sm outline-none focus:border-neutral-400"
          rows={4}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Paste the text each question should be asked about."
        />
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="mt-2 w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:bg-neutral-300"
        >
          {running ? "Running..." : "Run workflow"}
        </button>
        {error && <p className="mt-2 text-xs leading-relaxed text-red-700">{error}</p>}
      </div>

      {run && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Execution log
            </span>
            <span className="text-[10px] font-medium text-neutral-500">
              {run.path.length} step{run.path.length === 1 ? "" : "s"}
            </span>
          </div>

          <ol className="flex flex-col gap-2">
            {run.path.map((visit, index) => (
              <li
                key={`${visit.nodeId}-${index}`}
                className="rounded border border-neutral-200 bg-neutral-50 p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium leading-snug text-neutral-800">
                    {visit.question}
                  </p>
                  <span
                    className="shrink-0 text-[10px] font-bold tracking-widest"
                    style={{ color: BRANCH_COLOR[visit.answer] }}
                  >
                    {visit.answer.toUpperCase()}
                  </span>
                </div>
                {visit.reasoning && (
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                    {visit.reasoning}
                  </p>
                )}
              </li>
            ))}
          </ol>

          {run.status === "running" && (
            <p className="mt-2 text-xs text-amber-700">Asking the model...</p>
          )}

          {run.status === "done" && run.outcome && (
            <p className="mt-3 rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white">
              {run.outcome}
            </p>
          )}

          {run.status === "done" && !run.outcome && finished && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              The run ended without reaching an outcome - that branch has no arrow
              leaving it. Connect it to an outcome node to get a verdict.
            </p>
          )}

          {run.status === "error" && (
            <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">
              {run.error}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
