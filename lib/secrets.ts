import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { fromIni } from "@aws-sdk/credential-providers";

/**
 * Secrets are never stored in the repo or in local .env files.
 * Resolution order:
 *   1. process.env[key]  (set by the hosting platform in production)
 *   2. AWS SSM Parameter Store, /servikaki/secrets/<envFile> (local development)
 * The SSM parameter value is a whole .env file (KEY=value lines).
 */
const cache = new Map<string, Promise<Record<string, string>>>();

function parseEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const l = line.trim();
    if (!l || l.startsWith("#") || !l.includes("=")) continue;
    const i = l.indexOf("=");
    out[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function loadFromSSM(envFile: string) {
  if (!cache.has(envFile)) {
    const client = new SSMClient({
      region: process.env.SSM_REGION ?? "eu-west-1",
      credentials: fromIni({ profile: process.env.SSM_PROFILE ?? "servikaki-secrets" }),
    });
    cache.set(
      envFile,
      client
        .send(new GetParameterCommand({ Name: `/servikaki/secrets/${envFile}`, WithDecryption: true }))
        .then((r) => parseEnv(r.Parameter?.Value ?? "")),
    );
  }
  return cache.get(envFile)!;
}

export async function getKey(envFile: string, key: string): Promise<string> {
  const fromEnv = process.env[key];
  if (fromEnv) return fromEnv;
  const value = (await loadFromSSM(envFile))[key];
  if (!value) throw new Error(`Secret ${key} not found in env or SSM (${envFile})`);
  return value;
}
