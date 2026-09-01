import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";

/**
 * The endpoint Inngest talks to.
 *
 * The dev server discovers this route, reads the list of functions below, and
 * calls back into it to run each step. Functions are registered here - an empty
 * list is correct until Phase 3 defines the workflow runner.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
});
