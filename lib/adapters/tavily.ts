import { getKey } from "../secrets";
import { toIsoDate, type Search, type SearchHit, type SearchRequest, type Tracker } from "../core/ports";

type TavilyResult = { url: string; title?: string; content?: string; published_date?: string; score?: number };

/** Pay-as-you-go price per Tavily API credit (docs.tavily.com/guides/api-credits). */
const USD_PER_CREDIT = Number(process.env.TAVILY_USD_PER_CREDIT ?? 0.008);
const DEPTH = "advanced";
/** Results per search. Tavily charges per search, not per result, so we take the maximum. */
const MAX_RESULTS = 20;
/** Social networks can't be opened to verify a date or read in full, so they only waste slots. */
const SOCIAL = ["facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com", "linkedin.com", "threads.net", "pinterest.com"];
const CREDITS_PER_SEARCH = DEPTH === "advanced" ? 2 : 1;

/** Tavily Search adapter. Each search kind maps to a different Tavily configuration. */
export function tavilySearch(tracker: Tracker): Search {
  return {
    async search(req: SearchRequest): Promise<SearchHit[]> {
      const key = await getKey("tavily.env", "TAVILY_API_KEY");
      const includeDomains =
        req.kind === "reddit" ? ["reddit.com"] :
        req.kind === "youtube" ? ["youtube.com"] :
        req.includeDomains ?? [];
      const excludeDomains = [...new Set([...(req.excludeDomains ?? []), ...(includeDomains.length ? [] : SOCIAL)])];
      const topic = req.kind === "news" ? "news" : "general";

      const trace = {
        query: req.query,
        kind: req.kind,
        why: req.why,
        params: { topic, since: req.since, includeDomains, excludeDomains, depth: DEPTH, language: req.language },
        hits: 0,
        credits: 0,
        costUsd: 0,
        ms: 0,
      } as Tracker["searches"][number];
      tracker.searches.push(trace);

      const t0 = Date.now();
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: req.query,
            topic,
            search_depth: DEPTH,
            chunks_per_source: 3,
            max_results: req.maxResults ?? MAX_RESULTS,
            ...(req.language ? { language: req.language, filter_by_language: true } : {}),
            start_date: req.since,
            include_domains: includeDomains,
            exclude_domains: excludeDomains,
            include_answer: false,
            include_raw_content: false,
          }),
        });
        if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
        const data = (await res.json()) as { results?: TavilyResult[] };
        const hits = (data.results ?? []).map((r) => ({
          url: r.url,
          title: r.title ?? "",
          content: r.content ?? "",
          publishedDate: toIsoDate(r.published_date),
          score: r.score,
        }));
        trace.hits = hits.length;
        trace.credits = CREDITS_PER_SEARCH;
        trace.costUsd = CREDITS_PER_SEARCH * USD_PER_CREDIT;
        return hits;
      } catch (err) {
        trace.error = (err as Error).message;
        throw err;
      } finally {
        trace.ms = Date.now() - t0;
      }
    },
  };
}
