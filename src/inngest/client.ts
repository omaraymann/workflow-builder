import { Inngest } from "inngest";

/**
 * The Inngest client. Every event sent and every function defined goes through
 * this one instance, so its id identifies this app in the dev dashboard.
 */
export const inngest = new Inngest({ id: "workflow-builder" });
