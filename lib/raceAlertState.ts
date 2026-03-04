import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type RaceAlertState = {
  postedByAlertKey: Record<string, string>;
};

const STATE_PATH = path.join(
  process.cwd(),
  "data",
  "race-alert-posted.json",
);
const memoryPostedByAlertKey: Record<string, string> = {};

function defaultState(): RaceAlertState {
  return { postedByAlertKey: {} };
}

export async function readRaceAlertState(): Promise<RaceAlertState> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<RaceAlertState>;
    return {
      postedByAlertKey: {
        ...(parsed.postedByAlertKey ?? {}),
        ...memoryPostedByAlertKey,
      },
    };
  } catch {
    return {
      postedByAlertKey: { ...memoryPostedByAlertKey },
    };
  }
}

export async function markRaceAlertPosted(alertKey: string): Promise<void> {
  const nowIso = new Date().toISOString();
  memoryPostedByAlertKey[alertKey] = nowIso;

  const state = await readRaceAlertState();
  state.postedByAlertKey[alertKey] = nowIso;

  try {
    const dir = path.dirname(STATE_PATH);
    await mkdir(dir, { recursive: true });
    const tmpPath = `${STATE_PATH}.tmp`;
    await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tmpPath, STATE_PATH);
  } catch {
    // In serverless/read-only environments we keep best-effort state in memory.
  }
}

export async function hasRaceAlertBeenPosted(alertKey: string): Promise<boolean> {
  const state = await readRaceAlertState();
  return Boolean(state.postedByAlertKey[alertKey]);
}

