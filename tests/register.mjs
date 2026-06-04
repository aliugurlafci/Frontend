// Phase 12 — registers the resolve hook for the node:test runner.
import { register } from "node:module";
register("./resolve-hook.mjs", import.meta.url);
