@AGENTS.md

# Newsletter for One

Personal newsletters researched and written by an agent. Entry for the Nebius x NVIDIA Global AI
Hackathon, **Personal AI** track. Deadline **2026-10-30 10:00 PDT (18:00 Madrid)**. Rules, prizes
and judging notes live one folder up: `../BRIEF.md`, `../SUBMISSION.md`, `../STACK.md`.

Everything in this repo is English (it becomes public for the submission). No em dashes.

## Run it locally

```bash
# local Postgres is not a login service; the pg_ctl on PATH is v16, use the v17 binary
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /opt/homebrew/var/postgresql@17 -l /opt/homebrew/var/log/pg17.log start
npm run db:migrate
npm run dev -- -p 3007
# Since 2026-10-09 the real data lives in Supabase (project htnykjjfsjvzjfehlvhk, eu-north-1,
# role n41_app, private schema n41; URL in SSM newsletter-for-one.env). The Nebius job writes
# there. Point any local command at it with NFO_DB_FROM_SSM=1, e.g.:
NFO_DB_FROM_SSM=1 npm run dev -- -p 3007
npm run worker          # writes every automatic newsletter that is due, once
npm run cli -- issue <newsletterId>
```

Production (since 2026-10-13): web at https://n41.javi.link (Vercel Hobby, project
`newsletter-for-one`; CNAME `n41` in the javi.link Route 53 zone, AWS profile `default`). Vercel
env: DATABASE_URL (Supabase transaction pooler, port 6543), NEBIUS_API_KEY, TAVILY_API_KEY,
DEMO_ACCESS_CODE, GH_DISPATCH_TOKEN. "Write one now" dispatches the schedule workflow with a
newsletter id and a Nebius job (project eu-west1, service account n41-scheduler, CLI profile
`n41-sa`) writes it. Deploy: `npx vercel deploy --prod --yes` (GitHub is connected in Vercel since 2026-10-13).
`vercel link` writes a `.env.local`: delete it.

Secrets come from env vars or AWS SSM (`lib/secrets.ts`, profile `servikaki-secrets`,
`/servikaki/secrets/nebius.env` and `tavily.env`). Never write keys to disk or to `.env` files.

## How it works (decisions already made, don't relitigate)

Pipeline per issue (`lib/core/issue.ts`), every step recorded in `issue.trace`:

| Step | Runs on | Notes |
|------|---------|-------|
| Plan | Nemotron 3.5 Lightning | At least half the searches name watchlist entries; reads click signals |
| Subscriptions | Nemotron 3 Nano, reasoning off | Runs in parallel with Search. Emails, podcast transcripts and feed posts in the window, split into news items (cached in `inbox_items.extracted`); +1 score because the reader chose them |
| Search | Tavily, advanced, 20 results | Language filtered; social networks excluded; trusted sites get their own search |
| Score | Nemotron 3 Nano | Relevance 0-10, event key, source language |
| Verify dates | Page metadata, no model | YouTube upload date; Reddit is never contacted (blocks without API key), dated by the search window |
| Filter | Rules | Drops wrong language, too old, undated (unless allowed), low score, blocked |
| Check memory | Nemotron 3.5 Lightning | Whole history in context, no RAG needed at this scale; failure degrades to exact key match |
| Write | Nemotron 3 Ultra | Max 2 stories per publisher; style preset, jokes, "by the numbers"; `alsoIn` = other sources with the same news (coverage = importance) |

- After writing, `reviewDraft` (Nano, reasoning on) cuts stories that misreport their source or nearly repeat one above; reserves fill the gap. Added 2026-10-05 after a Nintendo headline linked to another story's patch notes.
- Style = length (`rundown | straight | dense | deep`) + voice (`neutral | playful`) + extras (jokes, visual summary, mind map). Old "playful"/"brief" presets are read through `normalizeStyle`.
- Reasoning off (`thinking: false` -> `chat_template_kwargs.enable_thinking=false`) only for mechanical jobs. Measured 2026-10-05: Lightning without reasoning got "same news?" wrong. Never for dedup.
- Subscriptions (`lib/subscriptions.ts`): each newsletter has an inbox address `<inbox_token>@INBOX_DOMAIN`; inbound mail must be POSTed to `/api/inbound/email?key=INBOUND_SECRET` (any provider; payload normalized in `lib/adapters/email.ts`). Podcasts and sites by RSS (`lib/adapters/feeds.ts`, Apple Podcasts search, no key). Token Factory has no speech-to-text: podcasts use the publisher's `<podcast:transcript>` or show notes.
- Delivery: days of the week + hour + time zone (`lib/core/schedule.ts`), at most one issue a day. Pause keeps everything; resume either catches up (window from last issue) or starts fresh (`window_floor`). Schedule workflow is hourly now.
- Clicks: story links go through `/r/<issueId>/<index>`; `readingSignals()` turns them into opened/shown per theme and publisher for planner and editor. Computed, never stored in memory.
- Product vs jury (decided 2026-10-05): reader tabs are Issue, Sources, Settings. "Under the hood" (trace, costs, checks, the brief, reset memory) is set apart for the jury and becomes internal later. Costs never appear in reader views. Spending and schedule live at `/admin`.
- Public demo: anyone reads; every write/paid API route calls `denyWithoutAccess()` (`lib/access.ts`). Set `DEMO_ACCESS_CODE` in production and put the code in the Devpost testing instructions. Unset locally = open.
- Email newsletters and podcasts are built but shown as "Coming soon" (`lib/features.ts`, enable with `N41_FEATURES=newsletters,podcasts`); while off, issues ignore those items. Trusted sites double as RSS follows; YouTube channels are followed by their feed.
- Issues always write themselves on delivery days (`autoIssues` true for every newsletter); Pause is the only off switch. "Write one now" stays for demos.
- Only NVIDIA models on Nebius Token Factory are allowed by the rules. Model per role in `lib/adapters/nebius.ts`.
- Core in `lib/core` is vendor-free; adapters in `lib/adapters` (house rule of the HACKATON folder).
- Daily spending cap (`lib/budget.ts`, `DAILY_CAP_EUR=5`): everything paid reserves an estimate, then settles the real cost.
- Automatic issues (`lib/worker.ts`) are off by default per newsletter.
- Nebius Jobs have no native schedule: `.github/workflows/schedule.yml` launches the worker job every 5 days (06:05 UTC) while testing, 3 newsletters in parallel (`WORKER_PARALLEL`). Inactive until repo variable `NEBIUS_JOBS_ENABLED=true`.
- A typical issue: about $0.19 ($0.14 Tavily) and 3 to 5 minutes. Slow is fine: it's a newsletter.
- Record every platform friction in `FEEDBACK.md` with date and repro as it happens (required for submission, and a prize).

## What's next, in order

1. **Broad topics.** Only niches were tested (Final Cut Pro, Godot, espresso). Measure first:
   create "Marketing", "AI" and "Pesca en España" (Spanish) test newsletters, one issue each
   (about EUR 0.60), and read the traces. Expected problems: too much material and no sense of
   importance (AI), vague briefs (Marketing), few dated sources and too short a window (fishing).
   Planned fixes, after measuring: clarifying questions at creation for broad descriptions;
   sections (sub-beats) per broad brief; importance from coverage count (duplicates + foundBy);
   monthly cadence and honest quiet issues.
2. **Email delivery** with useful / not useful links in the email itself. This is the "acts on
   your behalf" part the judges named as the ceiling of the Personal AI track.
3. **Deploy** (the demo URL is mandatory in this track): hosted Postgres reachable from the web
   host and from the Nebius job; web host for the Next.js app; Nebius AI Cloud account with a
   service account, then fill the variables and secrets listed at the top of `schedule.yml`.
   The worker image and schedule have never run yet (no Docker or AI Cloud account locally).
4. **Public demo safety:** a few ready-made example newsletters, minimal identity for readers
   (email magic link or none), and per-visitor limits on top of the daily cap.
5. **Submission:** make the repo public, run
   `git log -p | grep -iE 'api[_-]?key|secret|token'`, finish `FEEDBACK.md` (five questions per
   piece: Token Factory and each Nemotron model), a 3 minute video with audio naming the models
   and why, and name Nebius Token Factory and Nemotron in the description and Built With.

## Known issues

- Inbound email needs a real domain with MX to an inbound provider before it works outside
  localhost. Locally, use "Paste an email" in Subscriptions or POST to the webhook.
- The hourly schedule launches a Nebius Job every hour even when nothing is due. Cheap, but the
  check could move into the GitHub Action before launching.
- Lightning sometimes returns broken JSON or its reasoning instead of JSON; the adapter retries
  once showing the model its own output. Watch for it in traces.
- A recent source can report old news (a 2026-09 video about a fix released in May). Triage
  should also judge when the event happened, not only when the source was published.
- The memory check takes 20 s to 2 min with Lightning.
- The worker image's `npm ci` includes dev dependencies because the worker runs through `tsx`.
