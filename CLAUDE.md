@AGENTS.md

# Newsletter for One

Personal newsletters researched and written by an agent. Entry for the Nebius x NVIDIA Global AI
Hackathon, **Personal AI** track. Deadline **2026-10-30 10:00 PDT (18:00 Madrid)**. Rules, prizes
and judging notes live one folder up: `../BRIEF.md`, `../SUBMISSION.md`, `../STACK.md`.

Everything in this repo is English (it becomes public for the submission). No em dashes.

## Run it locally

```bash
pg_ctl -D /opt/homebrew/var/postgresql@17 start   # local Postgres is not a login service
npm run db:migrate
npm run dev -- -p 3007
npm run worker          # writes every automatic newsletter that is due, once
npm run cli -- issue <newsletterId>
```

Secrets come from env vars or AWS SSM (`lib/secrets.ts`, profile `servikaki-secrets`,
`/servikaki/secrets/nebius.env` and `tavily.env`). Never write keys to disk or to `.env` files.

## How it works (decisions already made, don't relitigate)

Pipeline per issue (`lib/core/issue.ts`), every step recorded in `issue.trace`:

| Step | Runs on | Notes |
|------|---------|-------|
| Plan | Nemotron 3.5 Lightning | At least half the searches name watchlist entries |
| Search | Tavily, advanced, 20 results | Language filtered; social networks excluded; trusted sites get their own search |
| Score | Nemotron 3 Nano | Relevance 0-10, event key, source language |
| Verify dates | Page metadata, no model | YouTube upload date; Reddit is never contacted (blocks without API key), dated by the search window |
| Filter | Rules | Drops wrong language, too old, undated (unless allowed), low score, blocked |
| Check memory | Nemotron 3.5 Lightning | Whole history in context, no RAG needed at this scale; failure degrades to exact key match |
| Write | Nemotron 3 Ultra | Max 2 stories per publisher (YouTube channel / subreddit, not domain) |

- Only NVIDIA models on Nebius Token Factory are allowed by the rules. Model per role in `lib/adapters/nebius.ts`.
- Core in `lib/core` is vendor-free; adapters in `lib/adapters` (house rule of the HACKATON folder).
- Daily spending cap (`lib/budget.ts`, `DAILY_CAP_EUR=5`): everything paid reserves an estimate, then settles the real cost.
- Automatic issues (`lib/worker.ts`) are off by default per newsletter.
- Nebius Jobs have no native schedule: `.github/workflows/schedule.yml` launches the worker job daily. Inactive until repo variable `NEBIUS_JOBS_ENABLED=true`.
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

- Lightning sometimes returns broken JSON or its reasoning instead of JSON; the adapter retries
  once showing the model its own output. Watch for it in traces.
- A recent source can report old news (a 2026-09 video about a fix released in May). Triage
  should also judge when the event happened, not only when the source was published.
- The memory check takes 20 s to 2 min with Lightning.
- The worker image's `npm ci` includes dev dependencies because the worker runs through `tsx`.
