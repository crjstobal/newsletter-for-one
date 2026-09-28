import { promises as fs } from "fs";
import path from "path";
import type { Issue, Newsletter } from "./core/types";

/**
 * Persistence behind a small interface. The file store is for local development;
 * a Postgres implementation replaces it for the hosted demo.
 */
export interface Store {
  getNewsletter(id: string): Promise<Newsletter | null>;
  listNewsletters(): Promise<Newsletter[]>;
  saveNewsletter(nl: Newsletter): Promise<void>;
  getIssue(id: string): Promise<Issue | null>;
  listIssues(newsletterId: string): Promise<Issue[]>;
  saveIssue(issue: Issue): Promise<void>;
}

const DIR = process.env.NFO_DATA_DIR ?? path.join(process.cwd(), "data");

async function readJSON<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJSON(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

async function listDir<T>(dir: string): Promise<T[]> {
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    return (await Promise.all(files.map((f) => readJSON<T>(path.join(dir, f))))).filter(Boolean) as T[];
  } catch {
    return [];
  }
}

export const fileStore: Store = {
  getNewsletter: (id) => readJSON<Newsletter>(path.join(DIR, "newsletters", `${id}.json`)),
  listNewsletters: () => listDir<Newsletter>(path.join(DIR, "newsletters")),
  saveNewsletter: (nl) => writeJSON(path.join(DIR, "newsletters", `${nl.id}.json`), nl),
  getIssue: (id) => readJSON<Issue>(path.join(DIR, "issues", `${id}.json`)),
  listIssues: async (newsletterId) =>
    (await listDir<Issue>(path.join(DIR, "issues")))
      .filter((i) => i.newsletterId === newsletterId)
      .sort((a, b) => b.id.localeCompare(a.id)),
  saveIssue: (issue) => writeJSON(path.join(DIR, "issues", `${issue.id}.json`), issue),
};
