import { defineTool } from "eve/tools";
import { z } from "zod";
import { callApp } from "../lib/app";

export default defineTool({
  description: "Prepare one write operation from list_capabilities. This does NOT make the change: it shows the admin a card with Confirm and Cancel, and only her click runs it. After calling this, tell her what you prepared and stop until she answers.",
  inputSchema: z.object({
    operation: z.string().describe("A write operation's name"),
    input: z.record(z.string(), z.unknown()).describe("The operation's complete input"),
  }),
  label: { start: () => "Preparing a change for you to confirm" },
  execute: ({ operation, input }, ctx) => callApp(ctx, { action: "propose", operation, input }),
});
