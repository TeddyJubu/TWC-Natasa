import { defineAgent } from "eve";
import { anthropic } from "eve/models/anthropic";

// No shell, files, web or subagents: Eve can only reach the club through the three tools in ./tools.
export default defineAgent({
  defaultTools: false,
  model: anthropic("claude-opus-5-5"),
  modelContextWindowTokens: 1_000_000,
  build: { externalDependencies: ["@openuidev/lang-core"] },
});
