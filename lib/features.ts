/**
 * Features that exist in the code but are not offered yet. Email newsletters need a real inbound
 * domain; podcasts depend on publishers shipping transcripts. Turn them on with
 * N41_FEATURES="newsletters,podcasts". While off, the UI says "coming soon" and issues ignore them.
 */
const on = new Set((process.env.N41_FEATURES ?? "").split(",").map((s) => s.trim()).filter(Boolean));

export const FEATURES = {
  newsletters: on.has("newsletters"),
  podcasts: on.has("podcasts"),
};
