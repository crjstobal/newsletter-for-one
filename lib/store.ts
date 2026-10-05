import { promises as fs } from "fs";
import path from "path";
import type { CoveredEvent, Issue, Newsletter } from "./core/types";
import { pool, q } from "./db";

/** Persistence behind a small interface, so the pipeline never knows where data lives. */
export interface Store {
  getNewsletter(id: string): Promise<Newsletter | null>;
  listNewsletters(): Promise<Newsletter[]>;
  saveNewsletter(nl: Newsletter): Promise<void>;
  /** Deletes the newsletter with its issues, memory, subscriptions and clicks. */
  deleteNewsletter(id: string): Promise<void>;
  getIssue(id: string): Promise<Issue | null>;
  listIssues(newsletterId: string): Promise<Issue[]>;
  saveIssue(issue: Issue): Promise<void>;
}

// ---------------------------------------------------------------- Postgres (default)

type NewsletterRow = {
  id: string;
  description: string;
  profile: Newsletter["profile"];
  likes: string[];
  dislikes: string[];
  notes: string;
  auto_issues: boolean;
  created_at: Date;
  last_issue_date: string | null;
  delivery: Newsletter["delivery"] | null;
  paused_at: Date | null;
  paused_until: string | null;
  window_floor: string | null;
  inbox_token: string;
};

type SentRow = { newsletter_id: string; key: string; headline: string; summary: string | null; url: string | null; date: string };

const NEWSLETTER_COLS =
  "id, description, profile, likes, dislikes, notes, auto_issues, created_at, to_char(last_issue_date, 'YYYY-MM-DD') as last_issue_date, " +
  "delivery, paused_at, to_char(paused_until, 'YYYY-MM-DD') as paused_until, to_char(window_floor, 'YYYY-MM-DD') as window_floor, inbox_token";

function toNewsletter(r: NewsletterRow, sent: SentRow[]): Newsletter {
  return {
    id: r.id,
    description: r.description,
    profile: r.profile,
    memory: {
      likes: r.likes,
      dislikes: r.dislikes,
      notes: r.notes,
      covered: sent.map((s) => ({ key: s.key, headline: s.headline, date: s.date, summary: s.summary ?? undefined, url: s.url ?? undefined })),
    },
    createdAt: r.created_at.toISOString(),
    lastIssueDate: r.last_issue_date ?? undefined,
    autoIssues: r.auto_issues,
    delivery: r.delivery ?? undefined,
    pausedAt: r.paused_at?.toISOString(),
    pausedUntil: r.paused_until ?? undefined,
    windowFloor: r.window_floor ?? undefined,
    inboxToken: r.inbox_token,
  };
}

async function sentFor(ids: string[]) {
  if (!ids.length) return [];
  return (
    await q<SentRow>(
      "select newsletter_id, key, headline, summary, url, to_char(date, 'YYYY-MM-DD') as date from sent_stories where newsletter_id = any($1) order by date, key",
      [ids],
    )
  ).rows;
}

type IssueRow = {
  id: string;
  newsletter_id: string;
  number: number;
  date: string;
  subject: string;
  intro: string;
  quiet: boolean;
  stories: Issue["stories"];
  trace: Issue["trace"];
  numbers: Issue["numbers"] | null;
};

const ISSUE_COLS = "id, newsletter_id, number, to_char(date, 'YYYY-MM-DD') as date, subject, intro, quiet, stories, trace, numbers";

const toIssue = (r: IssueRow): Issue => ({
  id: r.id,
  newsletterId: r.newsletter_id,
  number: r.number,
  date: r.date,
  subject: r.subject,
  intro: r.intro,
  quiet: r.quiet,
  stories: r.stories,
  numbers: r.numbers ?? undefined,
  trace: r.trace,
});

export const pgStore: Store = {
  async getNewsletter(id) {
    const r = (await q<NewsletterRow>(`select ${NEWSLETTER_COLS} from newsletters where id = $1`, [id])).rows[0];
    return r ? toNewsletter(r, await sentFor([id])) : null;
  },

  async listNewsletters() {
    const rows = (await q<NewsletterRow>(`select ${NEWSLETTER_COLS} from newsletters order by created_at desc`)).rows;
    const sent = await sentFor(rows.map((r) => r.id));
    return rows.map((r) => toNewsletter(r, sent.filter((s) => s.newsletter_id === r.id)));
  },

  async saveNewsletter(nl) {
    const client = await (await pool()).connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into newsletters (id, description, profile, likes, dislikes, notes, auto_issues, created_at, last_issue_date,
           delivery, paused_at, paused_until, window_floor, inbox_token)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, coalesce($14, substr(md5(random()::text || $1), 1, 12)))
         on conflict (id) do update set description = excluded.description, profile = excluded.profile,
           likes = excluded.likes, dislikes = excluded.dislikes, notes = excluded.notes,
           auto_issues = excluded.auto_issues, last_issue_date = excluded.last_issue_date,
           delivery = excluded.delivery, paused_at = excluded.paused_at, paused_until = excluded.paused_until,
           window_floor = excluded.window_floor`,
        [
          nl.id,
          nl.description,
          JSON.stringify(nl.profile),
          JSON.stringify(nl.memory.likes),
          JSON.stringify(nl.memory.dislikes),
          nl.memory.notes,
          Boolean(nl.autoIssues),
          nl.createdAt,
          nl.lastIssueDate ?? null,
          nl.delivery ? JSON.stringify(nl.delivery) : null,
          nl.pausedAt ?? null,
          nl.pausedUntil ?? null,
          nl.windowFloor ?? null,
          nl.inboxToken ?? null,
        ],
      );
      // The sent-stories memory mirrors memory.covered exactly (the reader can make it forget).
      const keys = nl.memory.covered.map((c) => c.key);
      await client.query("delete from sent_stories where newsletter_id = $1 and not (key = any($2))", [nl.id, keys]);
      for (const c of nl.memory.covered) await insertSent(client, nl.id, c);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  },

  async deleteNewsletter(id) {
    await q("delete from newsletters where id = $1", [id]); // everything else cascades
  },

  async getIssue(id) {
    const r = (await q<IssueRow>(`select ${ISSUE_COLS} from issues where id = $1`, [id])).rows[0];
    return r ? toIssue(r) : null;
  },

  async listIssues(newsletterId) {
    return (await q<IssueRow>(`select ${ISSUE_COLS} from issues where newsletter_id = $1 order by number desc`, [newsletterId])).rows.map(toIssue);
  },

  async saveIssue(issue) {
    await q(
      `insert into issues (id, newsletter_id, number, date, subject, intro, quiet, stories, trace, numbers)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (id) do update set subject = excluded.subject, intro = excluded.intro, quiet = excluded.quiet,
         stories = excluded.stories, trace = excluded.trace, numbers = excluded.numbers`,
      [issue.id, issue.newsletterId, issue.number ?? 1, issue.date, issue.subject, issue.intro, issue.quiet, JSON.stringify(issue.stories), JSON.stringify(issue.trace), issue.numbers ? JSON.stringify(issue.numbers) : null],
    );
  },
};

async function insertSent(client: { query: (t: string, p: unknown[]) => Promise<unknown> }, newsletterId: string, c: CoveredEvent) {
  await client.query(
    `insert into sent_stories (newsletter_id, key, headline, summary, url, date) values ($1, $2, $3, $4, $5, $6)
     on conflict (newsletter_id, key) do nothing`,
    [newsletterId, c.key, c.headline, c.summary ?? null, c.url ?? null, c.date],
  );
}

export const store: Store = pgStore;

// ---------------------------------------------------------------- JSON files (legacy, import only)

const DIR = process.env.NFO_DATA_DIR ?? path.join(process.cwd(), "data");

async function readDir<T>(dir: string): Promise<T[]> {
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    return Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as T));
  } catch {
    return [];
  }
}

/** Reads the JSON store used before Postgres, so its data can be imported. */
export const legacyFiles = {
  newsletters: () => readDir<Newsletter>(path.join(DIR, "newsletters")),
  issues: () => readDir<Issue>(path.join(DIR, "issues")),
};
