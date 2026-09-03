import { getRun } from "@/lib/runStore";

/**
 * Report a run's progress.
 *
 * The browser polls this while a run is in flight. It is a read of in-memory
 * state, so it is cheap enough to call every few hundred milliseconds.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = getRun(runId);

  if (!run) {
    // Runs live in memory, so a server restart loses them. Saying so is more
    // useful than a bare 404 when someone reloads mid-run.
    return Response.json(
      { error: "No such run - it may have been lost when the server restarted" },
      { status: 404 },
    );
  }

  return Response.json(run);
}
