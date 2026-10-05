import { hostOf, type LLM } from "./ports";
import { reviewDraft, type ReviewFlag } from "./review";
import { DEFAULT_STYLE, normalizeStyle, type IssueNumber, type Profile, type ReaderMemory, type Story, type Style } from "./types";
import type { Scored } from "./triage";

const SYSTEM = `You are the editor of a one-reader newsletter. You receive a shortlist of web
sources gathered for this issue, the newsletter brief, the reader's tastes, and the stories
already sent in past issues. Write the issue.

Non-negotiable:
- Use ONLY the sources given. Never invent a fact, number, date, name or link. If a source is
  vague, say less rather than fill the gap.
- Each story is about its own source. Never put one source's facts under another source's
  link. Routine updates from the same store or catalog in the same days are one story.
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
- "summary": what happened, at the length the style asks for. "whyItMatters": one sentence
  addressed to this reader specifically.
- Some sources come from the reader's own subscriptions ("via": a newsletter, podcast or feed
  they follow). Treat them like any source: one event is still one story. When a podcast is the
  only source, say what the hosts said, not that it is a fact.
- "coveredBy" lists the different sources that reported the same news. Coverage by several of
  the reader's sources is a strong sign of importance: rank widely covered news higher.
- "readerReads" says what the reader actually opens (clicks), by theme and publisher. Favor
  what they open; it is weaker evidence than their explicit likes and dislikes.
- Follow "style" (see below) for voice and length.

Return JSON:
{
  "subject": string,     // email subject line, at most 70 characters, leads with the top story
  "intro": string,       // 1 to 2 sentences
  "quiet": boolean,
  "stories": [{"sourceId": number, "headline": string, "summary": string, "whyItMatters": string, "eventKey": string, "theme": string, "shortTitle": string, "joke": string|null}],
  "numbers": [{"value": string, "label": string, "sourceId": number}]
}
"joke" and "numbers" follow the style rules; when not asked for, use null and [].`;

/** Style rules, in words the editor can follow. Facts never change with the style. */
export function styleRules(input: Style = DEFAULT_STYLE): string {
  const style = normalizeStyle(input);
  const length = {
    rundown: "Rundown: the reader only scans headlines. Headlines of at most 10 words that say what happened. Summaries are one short sentence; whyItMatters at most 10 words.",
    straight: "Summaries of 2 to 3 sentences.",
    dense: "Dense: summaries of 3 to 4 sentences packed with concrete facts (names, versions, numbers, dates) and no filler words.",
    deep: "In depth: summaries of 4 to 6 sentences with background, what changed compared to before, and what to watch next, still only from the sources.",
  }[style.preset];
  const voice = style.voice === "playful"
    ? "Voice: cheeky and irreverent, like a smart friend who doesn't take the industry too seriously. Wordplay and light teasing of companies are welcome, never of the reader, and never at the cost of accuracy."
    : "Voice: clear, direct and neutral.";
  const rules = [`Length: ${length}`, voice, "Never use em dashes; use commas, colons or parentheses."];
  rules.push(
    style.jokes && style.preset !== "rundown"
      ? '"joke": one short, good-natured one-liner about each story (a pun, an aside). It must not add facts. Use null when no joke would land.'
      : '"joke": always null.',
  );
  // Figures ("numbers") are not shown anywhere for now: never ask for them.
  rules.push('"numbers": always [].');
  return rules.join("\n");
}

export async function writeIssue(
  llm: LLM,
  profile: Profile,
  memory: ReaderMemory,
  shortlist: Scored[],
  today: string,
  maxPerSite: number,
  publisherOf: (id: number) => string = (id) => hostOf(shortlist.find((s) => s.id === id)?.url ?? ""),
  coveredBy: (id: number) => { name: string; url?: string }[] = () => [],
): Promise<{ subject: string; intro: string; quiet: boolean; stories: Story[]; sourceIds: number[]; dropped: number; numbers: IssueNumber[]; rejected: ReviewFlag[] }> {
  const style = normalizeStyle(profile.style);
  const payload = {
    today,
    storyCount: profile.storyCount,
    maxStories: profile.storyCount + 3,
    maxStoriesPerSite: maxPerSite,
    brief: profile,
    readerLikes: memory.likes,
    readerDislikes: memory.dislikes,
    readerNotes: memory.notes,
    readerReads: (memory.reads ?? []).map((r) => `${r.by} "${r.name}": opened ${r.opened} of ${r.shown}`),
    style: styleRules(style),
    alreadySent: memory.covered.map((c) => ({ date: c.date, eventKey: c.key, headline: c.headline })),
    sources: shortlist.map((s) => ({
      sourceId: s.id,
      publisher: publisherOf(s.id),
      via: s.via ?? null,
      coveredBy: coveredBy(s.id).map((c) => c.name),
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
    stories: { sourceId: number; headline: string; summary: string; whyItMatters: string; eventKey: string; theme?: string; shortTitle?: string; joke?: string | null }[];
    numbers?: { value: string; label: string; sourceId: number }[];
  }>("editor", [
    { role: "system", content: SYSTEM },
    { role: "user", content: JSON.stringify(payload) },
  ], { maxTokens: 16000, note: `write issue from ${shortlist.length} sources` });

  // House style: no em dashes, whatever the model writes.
  const plain = (t?: string | null) => (t ? t.replace(/\s*\u2014\s*/g, ", ") : t ?? undefined);
  for (const st of out.stories ?? []) {
    st.headline = plain(st.headline)!;
    st.summary = plain(st.summary)!;
    st.whyItMatters = plain(st.whyItMatters)!;
    st.joke = plain(st.joke);
  }
  out.intro = plain(out.intro)!;
  out.subject = plain(out.subject)!;

  // Links come from our own shortlist, never from model output.
  const byId = new Map(shortlist.map((s) => [s.id, s]));

  // Second opinion: drop stories that misreport their source or repeat one ranked above.
  // The editor wrote reserves, so the issue still fills up. A failed review changes nothing.
  const drafted = (out.stories ?? []).filter((s) => byId.has(Number(s.sourceId)));
  const flags: ReviewFlag[] = await reviewDraft(llm, drafted.map((s) => {
    const src = byId.get(Number(s.sourceId))!;
    return { headline: s.headline, summary: s.summary, source: { title: src.title, text: src.content } };
  })).catch(() => []);
  for (const f of flags) {
    f.headline = drafted[f.index]?.headline;
    f.sameAsHeadline = f.sameAs !== undefined ? drafted[f.sameAs]?.headline : undefined;
  }
  const rejected = new Set(flags.map((f) => f.index));
  out.stories = drafted.filter((_, i) => !rejected.has(i));
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
    const own = publisherOf(src.id);
    const others = coveredBy(src.id).filter((c) => c.name !== own && c.name !== src.via && c.url !== src.url);
    const alsoIn = others.map((c) => c.name);
    stories.push({
      headline: s.headline,
      shortTitle: s.shortTitle?.trim() || undefined,
      summary: s.summary,
      whyItMatters: s.whyItMatters,
      url: src.url,
      source: src.url.startsWith("/") ? (src.via ?? "inbox") : hostOf(src.url),
      publisher: own !== hostOf(src.url) ? own : undefined,
      origin: src.origin ?? "web",
      via: src.via,
      alsoIn: alsoIn.length ? alsoIn : undefined,
      alsoInLinks: others.length ? others : undefined,
      joke: style.jokes && s.joke ? String(s.joke).trim() || undefined : undefined,
      eventKey: s.eventKey || src.eventKey,
      publishedDate: src.publishedDate,
      dateFrom: src.dateFrom,
      theme: s.theme?.trim() || undefined,
    });
  }

  // The per-site limit can drop stories the subject and intro mention: rewrite them to match.
  if ((dropped > 0 || flags.length > 0) && stories.length) {
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

  const numbers: IssueNumber[] = []; // not offered for now

  return {
    rejected: flags,
    numbers,
    subject: out.subject ?? profile.name,
    intro: out.intro ?? "",
    quiet: Boolean(out.quiet) || stories.length === 0,
    stories,
    sourceIds,
    dropped,
  };
}
