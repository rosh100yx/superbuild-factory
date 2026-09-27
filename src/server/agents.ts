import { getAgentByName } from "agents";

import type { Env } from "./env";
import type { FactoryAgent, FactoryIndex } from "./factory-agent";

/**
 * `wrangler types` cannot infer DO class types from the namespace, so the casts are
 * deliberate: the binding name is typed, the class is ours.
 */
export async function getBuildAgent(env: Env, buildId: string): Promise<FactoryAgent> {
  const stub = await getAgentByName<Env, FactoryAgent>(
    env.FACTORY_AGENT as unknown as DurableObjectNamespace<FactoryAgent>,
    buildId,
  );
  return stub as unknown as FactoryAgent;
}

export async function getIndexAgent(env: Env): Promise<FactoryIndex> {
  const stub = await getAgentByName<Env, FactoryIndex>(
    env.FACTORY_INDEX as unknown as DurableObjectNamespace<FactoryIndex>,
    "index",
  );
  return stub as unknown as FactoryIndex;
}
