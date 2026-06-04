/**
 * Phase 5 — Data store wiring (in-memory singleton).
 *
 * Builds the repository + query engine once per server process and seeds it on
 * first access. Held on `globalThis` so Next's dev HMR doesn't create duplicate
 * stores. Swap `InMemoryRepository` here for a PostgreSQL adapter in production.
 */
import { metadata } from "@/lib/metadata";
import { permissionEngine } from "@/lib/permissions/engine";
import { InMemoryRepository } from "./memory-repository";
import { QueryEngine } from "./query-engine";
import { seedInto } from "./seed";

interface Singletons {
  repo: InMemoryRepository;
  queryEngine: QueryEngine;
  seedPromise: Promise<void> | null;
}

const globalRef = globalThis as unknown as { __aulaStore?: Singletons };

function create(): Singletons {
  const repo = new InMemoryRepository();
  const queryEngine = new QueryEngine(repo, metadata, permissionEngine);
  return { repo, queryEngine, seedPromise: null };
}

const singletons: Singletons = (globalRef.__aulaStore ??= create());

/** Resolve the query engine, seeding the store exactly once. */
export async function getQueryEngine(): Promise<QueryEngine> {
  singletons.seedPromise ??= seedInto(singletons.repo);
  await singletons.seedPromise;
  return singletons.queryEngine;
}

export function getRepository(): InMemoryRepository {
  return singletons.repo;
}
