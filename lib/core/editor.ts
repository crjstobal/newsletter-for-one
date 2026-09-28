import { hostOf, type LLM } from "./ports";
import type { Profile, ReaderMemory, Story } from "./types";
import type { Scored } from "./triage";

const SYSTEM = `You are the editor of a one-reader newsletter. You receive a shortlist of web
sources gathered for this issue, the newsletter brief, the reader's tastes, and the stories
already sent in past issues. Write the issue.

Non-negotiable:
- Use ONLY the sources given. Never invent a fact, number, date, name or link. If a source is
  vague, say less rather than fill the gap.
- One real-world event = one story. Several sources about the same event become a single story
  citing the best (most primary, most complete) source.
- Skip anything that repeats a story already sent, unless the source adds a material update;
  then frame it explicitly as an update.
- Variety matters: an issue built from one publisher feels like a feed, not an edited
  newsletter. Each source has a "publisher" (a site, a YouTube channel or a subreddit); at most
  "maxStoriesPerSite" stories may come from the same publisher.
- Return your stories ranked best first, up to the number given in "maxStories". The reader
  gets the top "storyCount" after a per-site limit ("maxStoriesPerSite") is applied, so the
  extra ones are reserves that replace stories dropped by that limit.
- Fill the issue. The sources were already screened for relevance, dates and repeats; if there
  are at least "storyCount" distinct pieces of news among them, return at least "storyCount"
  stories plus reserves. Leave a source out only if it is off topic for this reader, a help
  request, or the same news as a story you already picked. Each source has a relevance "score"
  from 0 to 10; prefer higher scores. If nothing is worth
  sending, set "quiet": true and write a two-line intro saying so honestly.
- Write everything in the language given by the brief's "language" code, whatever language
  the sources are in. Translate faithfully; keep product names, version numbers and proper
  nouns as they are. Match the brief's tone. Headlines are specific, not clickbait.
- Do not call something "new", "just released" or "this week" unless the source says so.
- "theme": a 1 to 3 word label for what kind of story it is (for example "Plugins",
  "Tutorials", "Apple updates"). Use 2 to 4 distinct themes per issue and reuse the same label
  for stories that belong together. Write themes in the brief's language.
- "shortTitle": the story in 3 to 6 words, for a map of the issue (for example "Magic Transitions 1.3",
  "Mac mini M5 ProRes speed"). Same language as the headline. No trailing punctuation.
- "summary": 2 to 3 sentences of what happened. "whyItMatters": one sentence addressed to this
  reader specifically.

Return JSON:
{
  "subject": string,     // email subject line, at most 70 characters, leads with the top story
  "intro": string,       // 1 to 2 sentences
  "quiet": boolean,
  "stories": [{"sourceId": number, "headline": string, "summary": string, "whyItMatters": string, "eventKey": string, "theme": string, "shortTitle": string}]
}`;

export async function writeIssue(
  llm: LLM,
  profile: Profile,
  memory: ReaderMemory,
  shortlist: Scored[],
  today: string,
  maxPerSite: number,
  publisherOf: (id: number) => string = (id) => hostOf(shortlist.find((s) => s.id === id)?.url ?? ""),
): Promise<{ subject: string; intro: string; quiet: boolean; stories: Story[]; sourceIds: number[]; dropped: number }> {
  const payload = {
    today,
    storyCount: profile.storyCount,
    maxStories: profile.storyCount + 3,
    maxStoriesPerSite: maxPerSite,
    brief: profile,
    readerLikes: memory.likes,
    readerDislikes: memory.dislikes,
    readerNotes: memory.notes,
    alreadySent: memory.covered.map((c) => ({ date: c.date, eventKey: c.key, headline: c.headline })),
    sources: shortlist.map((s) => ({
      sourceId: s.id,
      publisher: publisherOf(s.id),
      eventKey: s.eventKey,
      score: s.score,
      title: s.title,
      url: s.url,
      publishedDate: s.publishedDate ?? null,
      text: s.content,
    })),
  };

  const out = await llm.json<{
    subject: string;
    intro: string;
    quiet: boolean;
    stories: { sourceId: number; headline: string; summary: string; whyItMatters: string; eventKey: string; theme?: string; shortTitle?: string }[];
  }>("editor", [
    { role: "system", content: SYSTEM },
    { role: "user", content: JSON.stringify(payload) },
  ], { maxTokens: 16000, note: `write issue from ${shortlist.length} sources` });

  // Links come from our own shortlist, never from model output.
  const byId = new Map(shortlist.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const stories: Story[] = [];
  const sourceIds: number[] = [];
  const perSite = new Map<string, number>();
  let dropped = 0;
  for (const s of out.stories ?? []) {
    const src = byId.get(Number(s.sourceId));
    if (!src || seen.has(src.url)) continue;
    seen.add(src.url);
    const site = publisherOf(src.id);
    if ((perSite.get(site) ?? 0) >= maxPerSite) {
      dropped++;
      continue;
    }
    if (stories.length >= profile.storyCount) break;
    perSite.set(site, (perSite.get(site) ?? 0) + 1);
    sourceIds.push(src.id);
    stories.push({
      headline: s.headline,
      shortTitle: s.shortTitle?.trim() || undefined,
      summary: s.summary,
      whyItMatters: s.whyItMatters,
      url: src.url,
      source: hostOf(src.url),
      publisher: publisherOf(src.id) !== hostOf(src.url) ? publisherOf(src.id) : undefined,
      eventKey: s.eventKey || src.eventKey,
      publishedDate: src.publishedDate,
      dateFrom: src.dateFrom,
      theme: s.theme?.trim() || undefined,
    });
  }

  // The per-site limit can drop stories the subject and intro mention: rewrite them to match.
  if (dropped > 0 && stories.length) {
    const fixed = await llm.json<{ subject: string; intro: string }>("triage", [
      {
        role: "system",
        content: `Rewrite a newsletter issue's email subject (at most 70 characters, leads with the top story) and 1 to 2 sentence intro so they mention only the stories listed. Language code: ${profile.language}. Tone: ${profile.tone}. Return JSON {"subject": string, "intro": string}.`,
      },
      { role: "user", content: JSON.stringify(stories.map((s) => s.headline)) },
    ], { note: "rewrite subject after variety limit" });
    out.subject = fixed.subject || out.subject;
    out.intro = fixed.intro || out.intro;
  }

  return {
    subject: out.subject ?? profile.name,
    intro: out.intro ?? "",
    quiet: Boolean(out.quiet) || stories.length === 0,
    stories,
    sourceIds,
    dropped,
  };
}
