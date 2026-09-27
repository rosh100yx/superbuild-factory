/**
 * Secrets are not emitted by `wrangler types`, so they are declared here and
 * intersected with the generated `Cloudflare.Env`.
 */
export type FactorySecrets = {
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  OPENROUTER_API_KEY: string;
  OPENAI_API_KEY: string;
  FACTORY_TOKEN: string;
};

export type Env = Cloudflare.Env & FactorySecrets;
