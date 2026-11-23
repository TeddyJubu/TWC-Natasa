import { generateSystemPrompt } from "@openuidev/lang-core";
import { defineInstructions } from "eve/instructions";
import librarySpec from "../generated/spec.json" with { type: "json" };

const { promptOptions, ...library } = librarySpec;

const WHEN = `
## When to use components

For a short answer, reply in plain markdown. Use the component language below only when showing several records, a comparison or a chart. Never include images or links to other websites.
`;

export default defineInstructions({
  content: `${WHEN}\n${generateSystemPrompt({ library, promptOptions } as Parameters<typeof generateSystemPrompt>[0])}`,
});
