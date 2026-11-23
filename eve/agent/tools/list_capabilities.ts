import { defineTool } from "eve/tools";
import { z } from "zod";
import { callApp } from "../lib/app";

export default defineTool({
  description: "List every read and write operation available for the club, with each one's input shape. Call this before your first read or change in a conversation.",
  inputSchema: z.object({}),
  label: { start: () => "Checking what I can do" },
  execute: (_input, ctx) => callApp(ctx, { action: "catalog" }),
});
