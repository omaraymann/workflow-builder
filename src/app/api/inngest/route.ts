import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { runWorkflow } from "@/inngest/functions";

/**
 * The endpoint Inngest talks to.
 *
 * The dev server discovers this route, reads the list of functions below, and
 * calls back into it to run each step.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runWorkflow],
});
