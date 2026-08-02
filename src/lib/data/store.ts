/**
 * Phase 5 — Data store wiring (in-memory singleton).
 *
 * Builds the repository + query engine once per server process, held on
 * `globalThis` so Next's dev HMR doesn't create duplicate stores. It starts
 * empty — the app reads its data from the backend service (lib/http/server-api),
 * so nothing is seeded here.
 */
import { metadata } from "@/lib/metadata";
import { permissionEngine } from "@/lib/permissions/engine";
import { InMemoryRepository } from "./memory-repository";
import { QueryEngine } from "./query-engine";

interface Singletons {
  repo: InMemoryRepository;
  queryEngine: QueryEngine;
}

const globalRef = globalThis as unknown as { __aulaStore?: Singletons };

function create(): Singletons {
  const repo = new InMemoryRepository();
  const queryEngine = new QueryEngine(repo, metadata, permissionEngine);
  return { repo, queryEngine };
}

const singletons: Singletons = (globalRef.__aulaStore ??= create());

export async function getQueryEngine(): Promise<QueryEngine> {
  return singletons.queryEngine;
}

export function getRepository(): InMemoryRepository {
  return singletons.repo;
}
