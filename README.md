# Newsletter for One

**Seven newsletters, one launch, the same news seven times. Newsletter for One reads the web and
the sources you follow, tells each piece of news once, and writes it the way you like to read,
on the days you choose.**

Built for the Nebius x NVIDIA Global AI Hackathon, **Best Apps and Agents** track, with NVIDIA Nemotron
models on **Nebius Token Factory** and **Nebius AI Cloud Serverless Jobs**.

**Live demo: https://n41.javi.link** (read-only for visitors; the access code to create
newsletters and write issues is in the submission's testing instructions).

## What it does

1. **Pick a topic, make it yours.** Start from a topic or describe the newsletter you wish
   existed. Nemotron turns it into an editable brief: who it is for, what to cover and skip, the
   companies and creators that make news in the niche, and the sites and communities to watch.
2. **Point it at your sources.** Sites you trust are searched every issue and, when they publish
   a feed, read directly. Follow YouTube channels, add Reddit communities, block sites you never
   want. It searches the rest of the web anyway.
3. **Choose when and how.** Days of the week and the hour, in your time zone. Length (rundown,
   straight, dense or in depth), voice (neutral or playful), optional jokes and a mind map of the
   issue.
4. **It writes itself.** On each delivery day a Nebius Serverless Job researches and writes the
   issue. Every story has a verified date, links always come from the sources, and the same
   news is never told twice: not within an issue, and not across issues.
5. **It learns.** Vote stories useful or not, with a reason if you like. It also counts which
   stories you open. Both steer the next issue, and everything it learned is visible and
   editable.
6. **Pause it without losing anything.** Resume with a catch-up issue of the best of what you
   missed, or start fresh.

Every issue carries a full trace ("Under the hood"): each search, each result and why it was
kept or dropped, each model call, and what all of it cost.

## How an issue is made

| Step | What happens | Runs on |
|------|--------------|---------|
| Plan | Decides what to search since the last issue, naming the companies and creators to watch, steered by what you liked and what you open | Nemotron 3.5 Lightning |
| Read your sources | New posts from the sites and YouTube channels you follow, split into separate pieces of news | Nemotron 3 Nano, reasoning off |
| Search | Web, news, Reddit, YouTube and your trusted sites, limited to the window and the newsletter's languages | Tavily |
| Score | Scores every result 0 to 10 for this reader, labels the real-world event behind it and its language | Nemotron 3 Nano |
| Verify dates | Opens each promising page and reads its real publication date | Page metadata, no model |
| Filter | Drops old, undated, off-language, low-score and blocked results | Rules, no model |
| Check memory | Compares candidates with every story ever sent: the same news, however worded, is dropped | Nemotron 3.5 Lightning |
| Write | Writes the issue in the reader's language and style, at most 2 stories per publisher, and says which other sources covered each story | Nemotron 3 Ultra |
| Final review | Cuts drafts that misreport their source or nearly repeat a story above; reserves fill the gap | Nemotron 3 Nano |

## NVIDIA Nemotron on Nebius Token Factory

Every model call goes to Token Factory's OpenAI-compatible API. Each job gets the Nemotron model
that fits its cost and context needs:

| Job | Model | Why this one |
|-----|-------|--------------|
| Brief, search planning, memory check, learning from feedback | `nvidia/Nemotron-3_5-Lightning` | 1M-token context at the lowest price: it reads the reader's whole history, so no retrieval step is needed |
| Scoring every search result, final review | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | Cheapest and fast: runs over 100+ results per issue in parallel batches |
| Splitting feeds into pieces of news | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, reasoning off | A mechanical job, so `chat_template_kwargs: {enable_thinking: false}`: about 100 times fewer output tokens. Judgment calls keep reasoning on: we measured that "is this the same news?" gets wrong answers without it |
| Writing the issue | `nvidia/Nemotron-3-Ultra-550b-a55b` | NVIDIA's largest model where the reader sees the quality: a few cents per issue |

Prices are read live from Token Factory's `/v1/models` endpoint, so every trace shows real
costs. A typical issue costs about **$0.19**: about $0.14 of Tavily search and $0.05 of Nemotron.

Routing is what keeps it that cheap. Every issue's trace has a **Model routing** card: which
Nemotron did which job, its share of the cost, and what the same calls would have cost on
Ultra alone. On issue 3 of a handheld-consoles newsletter (2026-10-21), routed Nemotron cost $0.068;
the same tokens on Ultra would have cost $0.41, six times more, before counting the extra reasoning tokens a
bigger model spends.

## Tavily: the live web, searched the way a researcher would

Nothing is pasted in. Each issue starts from a plan (Nemotron 3.5 Lightning) and Tavily runs
it (9 searches for that handheld-consoles issue). Each kind of search is a different Tavily configuration
([`lib/adapters/tavily.ts`](lib/adapters/tavily.ts)):

| Search kind | Tavily settings | Why |
|-------------|-----------------|-----|
| News | `topic: "news"` | Press coverage of launches and announcements |
| Web | `topic: "general"` | Blogs, changelogs and official sites that news search misses |
| Reddit, YouTube | `include_domains` limited to that site | Community discussion and new videos, kept as their own kind so the trace shows where a story came from |
| Your sources | `include_domains` = the reader's trusted sites | One extra search per issue over the sites the reader chose |

Every search uses `search_depth: "advanced"` with `chunks_per_source: 3`, `max_results: 20`
(Tavily charges per search, not per result), `start_date` set to the date of the previous
issue, `language` with `filter_by_language` for the newsletter's languages, and
`exclude_domains` with the reader's blocked sites plus social networks (their pages can't be
opened to verify a date). The trace lists every search, its parameters, how many results it
returned and how many ended up in the issue, so a reader can see which searches earn their cost.

## What we learned building it

- **Reasoning off is a cost lever, not a free one.** `chat_template_kwargs: {enable_thinking:
  false}` cut output tokens about 100 times on mechanical jobs (splitting a 38K-character
  transcript: 2.1 s, $0.0006). But asked whether two differently worded iPhone headlines were
  the same news, Lightning said yes with reasoning and no without it. Judgment calls keep
  reasoning on.
- **The biggest model was the faster editor.** Ultra replaced Super as the writer: 5.8 s
  against 16 s on the same issue, more specific writing, about $0.004 more.
- **Search engines date pages badly.** A query about this week happily returns a plugin page
  from 2016. Every promising result is opened and its real publication date read from the page;
  no verified date, no story.
- **A recent source can report old news.** A video from this month about a fix shipped in May
  passes the date check. Scoring should also judge when the event happened (see limitations).
- **Coverage is a signal.** When several searches find the same news, it is usually a big
  story, so the issue says which other sources covered it.

## Known limitations

- **Broad topics are weaker than niches.** Tested mostly on niches (handheld consoles, Final Cut
  Pro, Godot, espresso). A brief like "Marketing" or "AI" returns more material than the scorer
  can rank by importance, so issues get more generic.
- **Undated sources are dropped by default.** Small sites without date metadata are left out
  unless the reader allows undated results, which can make local or slow topics thin.
- **Event date vs publication date.** Only the publication date is checked; old news in a new
  article can still slip through.
- **Reddit posts are dated by the search window**, not exactly: Reddit blocks automated access
  without an API key.
- **Podcasts and your other newsletters** are built but switched off (see Coming soon): Token
  Factory has no speech-to-text model, and inbound email needs a domain with MX records.
- **One issue takes 3 to 6 minutes.** Fine for a newsletter, slow for a live demo.

## Nebius AI Cloud: Serverless Jobs

Issues are written in the background by a **Nebius Serverless AI Job** on a small CPU VM, billed
only for the minutes it runs:

- [`.github/workflows/schedule.yml`](.github/workflows/schedule.yml) launches the job on a
  schedule (Nebius jobs have no built-in schedule). The worker writes every newsletter whose
  delivery slot has arrived, three at a time, and exits.
- **"Write one now"** in the web app launches the same job for a single newsletter, through the
  same workflow. The page shows progress and updates itself when the issue is ready.
- The image is built by [`worker-image.yml`](.github/workflows/worker-image.yml) on every
  change to the worker.

Everything that costs money goes through a **daily spending cap** (`DAILY_CAP_EUR`, default 20):
work reserves its estimated cost before starting and settles the real cost when done, so the web
app, the command line and the jobs together can never go over it.

## Run it locally

Requirements: Node 22+, PostgreSQL 16+, a Nebius Token Factory API key, a Tavily API key.

```bash
npm install
createdb newsletter_for_one        # or point DATABASE_URL at any Postgres
npm run db:migrate
export NEBIUS_API_KEY=...          # Token Factory
export TAVILY_API_KEY=...
npm run dev                        # http://localhost:3000
```

Locally, "Write one now" writes the issue inside the request and streams each step. Without
`DEMO_ACCESS_CODE` everything is open.

Command line:

```bash
npm run cli -- create "A weekly newsletter about ..."
npm run cli -- issue <newsletterId>
npm run cli -- vote <issueId> 0:up 2:down:"too basic"
npm run worker                     # write every newsletter that is due, once
NFO_NEWSLETTER=<id> npm run worker # write one newsletter now
```

## Deploy

The live demo runs as:

| Piece | Where |
|-------|-------|
| Web app (Next.js) | Vercel |
| Database | Supabase Postgres (transaction pooler for the web app) |
| Issue writing | Nebius Serverless Jobs, launched from GitHub Actions |
| Models | NVIDIA Nemotron on Nebius Token Factory |

Configuration:

| Variable | Where | What |
|----------|-------|------|
| `DATABASE_URL` | web, job | Postgres connection string |
| `NEBIUS_API_KEY` | web, job | Nebius Token Factory API key |
| `TAVILY_API_KEY` | web, job | Tavily API key |
| `DEMO_ACCESS_CODE` | web | Code visitors enter to create newsletters and write issues |
| `GH_DISPATCH_TOKEN` | web | GitHub token allowed to run the schedule workflow ("Write one now") |
| `DAILY_CAP_EUR` | web, job | Daily spending cap, default 20 |
| `NEBIUS_JOBS_ENABLED`, `NEBIUS_PROJECT_ID`, `NEBIUS_SA_ID`, `NEBIUS_PUBLIC_KEY_ID` | GitHub variables | Turn the schedule on and identify the Nebius project and service account |
| `NEBIUS_SA_PRIVATE_KEY`, `GHCR_TOKEN` | GitHub secrets | Service account key; token to pull the worker image |

Secrets are read from environment variables, with an AWS SSM Parameter Store fallback for local
development. No key is stored in the repository.

## Coming soon

Built and tested, not offered yet (`N41_FEATURES=newsletters,podcasts` turns them on):

- **Your other newsletters**: each newsletter gets an inbox address; subscribe to the newsletters
  you already read with it, and launches covered by several of them become one story. Point any
  inbound-email provider at `POST /api/inbound/email?key=INBOUND_SECRET`.
- **Podcasts**: followed from the Apple Podcasts directory, read from the transcript the
  publisher ships. (Token Factory has no speech-to-text model yet.)
- **Email delivery** of each issue.

## Architecture

```
lib/core/            vendor-free pipeline: profile, planner, subscriptions, triage, dedup,
                     editor, review, memory, schedule
lib/adapters/        Nebius Token Factory (OpenAI-compatible), Tavily, page dates and images,
                     feeds, email
lib/service.ts       application service: wires adapters, core and storage
lib/subscriptions.ts feeds, inbox and clicks (Postgres)
lib/worker.ts        the job's entry: everything due, or one newsletter
lib/dispatch.ts      "Write one now" in production: launches the Nebius job
lib/budget.ts        daily spending cap
db/migrations/       Postgres schema
app/                 Next.js web app and API routes
scripts/             command line, worker, migrations
```

Platform feedback, kept as we built: [`FEEDBACK.md`](FEEDBACK.md).

## License

MIT, see [LICENSE](LICENSE).
