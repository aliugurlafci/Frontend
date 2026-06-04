/** Phase 5 — Query engine & data layer barrel. */
export * from "./query";
export type { Repository } from "./repository";
export { QueryEngine } from "./query-engine";
export type { UpdateOptions } from "./query-engine";
export { InMemoryRepository } from "./memory-repository";
export { getQueryEngine, getRepository } from "./store";
export { seedInto } from "./seed";
