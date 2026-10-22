import { DEFAULT_MODELS, modelPrices } from "@/lib/adapters/nebius";

/** Live Token Factory prices of the models in use. Free to call: reads the model list, runs nothing. */
export async function GET() {
  return Response.json({ models: DEFAULT_MODELS, prices: await modelPrices() });
}
