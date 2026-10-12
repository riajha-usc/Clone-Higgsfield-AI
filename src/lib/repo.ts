/**
 * The only module that talks to IndexedDB. UI and client logic call these
 * functions; swapping in a server database later means reimplementing this file.
 */
import Dexie, { liveQuery, type Table } from "dexie";
import type {
  Generation,
  LedgerEntry,
  LedgerReason,
  Plan,
  Project,
  Settings,
  Term,
} from "@/lib/types";

class CloneDatabase extends Dexie {
  settings!: Table<Settings, string>;
  ledger!: Table<LedgerEntry, string>;
  projects!: Table<Project, string>;
  generations!: Table<Generation, string>;

  constructor() {
    super("higgsfield_clone");
    this.version(1).stores({
      settings: "id",
      ledger: "id, createdAt, reason, generationId",
      projects: "id, createdAt, updatedAt",
      generations: "id, projectId, status, createdAt, parentGenerationId, [projectId+createdAt]",
    });
  }
}

let instance: CloneDatabase | null = null;
function db(): CloneDatabase {
  if (typeof indexedDB === "undefined") {
    throw new Error("repo is browser-only: IndexedDB is not available here");
  }
  instance ??= new CloneDatabase();
  return instance;
}

export const DEMO_PROJECT_ID = "demo";

// ---------------------------------------------------------------- credits

export async function getBalance(): Promise<number> {
  let sum = 0;
  await db().ledger.each((entry) => {
    sum += entry.delta;
  });
  // Costs go down to 0.125, so round away float noise at three decimals.
  return Math.round(sum * 1000) / 1000;
}

export async function addLedgerEntry(entry: {
  delta: number;
  reason: LedgerReason;
  generationId?: string | null;
}): Promise<LedgerEntry> {
  const row: LedgerEntry = {
    id: crypto.randomUUID(),
    delta: entry.delta,
    reason: entry.reason,
    generationId: entry.generationId ?? null,
    createdAt: Date.now(),
  };
  await db().ledger.add(row);
  return row;
}

/** Oldest first, so a running balance can be summed down the list. */
export async function listLedger(): Promise<LedgerEntry[]> {
  return db().ledger.orderBy("createdAt").toArray();
}

// ---------------------------------------------------------------- settings

export async function getSettings(): Promise<Settings | undefined> {
  return db().settings.get("settings");
}

/** Grants the plan's credits and records the plan, together or not at all. */
export async function upgradePlan(plan: Plan, term: Term, credits: number): Promise<void> {
  const d = db();
  await d.transaction("rw", d.settings, d.ledger, async () => {
    await d.ledger.add({
      id: crypto.randomUUID(),
      delta: credits,
      reason: "upgrade_grant",
      generationId: null,
      createdAt: Date.now(),
    });
    await d.settings.update("settings", { plan, term });
  });
}

/** Back to free. Credits already granted stay. */
export async function cancelPlan(): Promise<void> {
  await db().settings.update("settings", { plan: "free", term: "monthly" });
}

/** Deletes the whole local database and seeds a fresh first-run state. */
export async function resetDemo(): Promise<void> {
  const d = db();
  await d.delete();
  instance = null;
  await ensureSeeded();
}

// ---------------------------------------------------------------- projects

/** Newest first by creation, so the list does not reshuffle as projects are used. */
export async function listProjects(): Promise<Project[]> {
  return db().projects.orderBy("createdAt").reverse().toArray();
}

export async function createProject(name: string): Promise<Project> {
  const now = Date.now();
  const project: Project = { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now };
  await db().projects.add(project);
  return project;
}

export async function renameProject(id: string, name: string): Promise<void> {
  await db().projects.update(id, { name, updatedAt: Date.now() });
}

// ---------------------------------------------------------------- generations

/** Newest first. Pass a projectId to scope to one project, or nothing for all. */
export async function listGenerations(projectId?: string): Promise<Generation[]> {
  const table = db().generations;
  if (projectId === undefined) {
    return table.orderBy("createdAt").reverse().toArray();
  }
  return table
    .where("[projectId+createdAt]")
    .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey])
    .reverse()
    .toArray();
}

export type NewGeneration = Pick<
  Generation,
  "projectId" | "type" | "prompt" | "modelId" | "params" | "cost"
> &
  Partial<Generation>;

export async function createGeneration(input: NewGeneration): Promise<Generation> {
  const now = Date.now();
  const generation: Generation = {
    id: crypto.randomUUID(),
    status: "queued",
    enhancedPrompt: null,
    provider: "",
    providerJobId: null,
    outputUrl: null,
    thumbnailUrl: null,
    error: null,
    parentGenerationId: null,
    favourite: false,
    createdAt: now,
    completedAt: null,
    ...input,
  };
  const d = db();
  await d.transaction("rw", d.generations, d.projects, async () => {
    await d.generations.add(generation);
    await d.projects.update(generation.projectId, { updatedAt: now });
  });
  return generation;
}

export async function updateGeneration(
  id: string,
  patch: Partial<Omit<Generation, "id">>,
): Promise<void> {
  await db().generations.update(id, patch);
}

/** Removes the generation row. Ledger entries that reference it stay, so the balance is unchanged. */
export async function deleteGeneration(id: string): Promise<void> {
  await db().generations.delete(id);
}

export async function getGeneration(id: string): Promise<Generation | undefined> {
  return db().generations.get(id);
}

/**
 * Ancestors of a generation, root first, ending with the generation itself.
 * maxAncestors caps how far up it walks (the chain then has at most that many + 1).
 */
export async function getLineage(id: string, maxAncestors = Infinity): Promise<Generation[]> {
  const chain: Generation[] = [];
  const seen = new Set<string>();
  let current = await getGeneration(id);
  while (current && !seen.has(current.id) && chain.length <= maxAncestors) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentGenerationId
      ? await getGeneration(current.parentGenerationId)
      : undefined;
  }
  return chain;
}

/** Generations made from this one (its direct children), newest first. */
export async function listChildren(id: string): Promise<Generation[]> {
  const children = await db().generations.where("parentGenerationId").equals(id).toArray();
  return children.sort((a, b) => b.createdAt - a.createdAt);
}

// ---------------------------------------------------------------- live queries

/**
 * Subscribe to a query built from the functions above. Re-runs whenever the
 * tables it read change (in this tab or another). Returns an unsubscribe function.
 */
export function observe<T>(
  query: () => Promise<T>,
  onValue: (value: T) => void,
  onError?: (error: unknown) => void,
): () => void {
  const subscription = liveQuery(query).subscribe({ next: onValue, error: onError });
  return () => subscription.unsubscribe();
}

// ---------------------------------------------------------------- first run

const HOUR = 60 * 60 * 1000;

/** Creates settings, the signup grant and the demo project on the first visit. Safe to call repeatedly. */
export async function ensureSeeded(): Promise<void> {
  const d = db();
  await d.transaction("rw", [d.settings, d.ledger, d.projects, d.generations], async () => {
    if ((await d.settings.count()) > 0) return;

    const now = Date.now();
    await d.settings.add({
      id: "settings",
      plan: "free",
      term: "monthly",
      createdAt: now,
      enhancePromptDefault: false,
    });
    await d.ledger.add({
      id: crypto.randomUUID(),
      delta: 10,
      reason: "signup_grant",
      generationId: null,
      createdAt: now,
    });

    const alleyAt = now - 46 * HOUR;
    const dunesAt = now - 27 * HOUR;
    const motionAt = now - 26 * HOUR;
    const dunesId = crypto.randomUUID();

    await d.projects.add({
      id: DEMO_PROJECT_ID,
      name: "Demo project",
      createdAt: alleyAt - 5 * 60 * 1000,
      updatedAt: motionAt,
    });

    // Demo content ships pre-made, so it carries its list cost but no ledger debit.
    const demo: Generation[] = [
      {
        id: crypto.randomUUID(),
        projectId: DEMO_PROJECT_ID,
        type: "image",
        status: "succeeded",
        prompt:
          "Rain-soaked neon alley in Tokyo at night, reflections on wet asphalt, a lone figure with a clear umbrella, cinematic 35mm, shallow depth of field",
        enhancedPrompt: null,
        modelId: "soul-2",
        params: { aspect: "3:4", quality: "2k", seed: 48213 },
        cost: 0.125,
        provider: "pollinations",
        providerJobId: null,
        outputUrl: "/samples/01-neon-alley.png",
        thumbnailUrl: "/samples/01-neon-alley.png",
        error: null,
        parentGenerationId: null,
        favourite: true,
        createdAt: alleyAt,
        completedAt: alleyAt + 9_000,
      },
      {
        id: dunesId,
        projectId: DEMO_PROJECT_ID,
        type: "image",
        status: "succeeded",
        prompt:
          "Golden hour over rolling sand dunes, long shadows, a camel caravan cresting the ridge, warm haze, wide-angle landscape photography",
        enhancedPrompt: null,
        modelId: "flux-schnell",
        params: { aspect: "3:4", quality: "1k", seed: 90117 },
        cost: 0.5,
        provider: "pollinations",
        providerJobId: null,
        outputUrl: "/samples/02-desert-dawn.png",
        thumbnailUrl: "/samples/02-desert-dawn.png",
        error: null,
        parentGenerationId: null,
        favourite: false,
        createdAt: dunesAt,
        completedAt: dunesAt + 6_500,
      },
      {
        id: crypto.randomUUID(),
        projectId: DEMO_PROJECT_ID,
        type: "video",
        status: "succeeded",
        prompt: "Slow push in on the caravan as the sun clears the dunes",
        enhancedPrompt: null,
        modelId: "motion-preview",
        params: {
          aspect: "16:9",
          quality: "480p",
          duration: 5,
          presetId: "push-in",
          startFrameGenerationId: dunesId,
        },
        cost: 1,
        provider: "motion",
        providerJobId: null,
        outputUrl: "/samples/02-desert-dawn.png",
        thumbnailUrl: "/samples/02-desert-dawn.png",
        error: null,
        parentGenerationId: dunesId,
        favourite: false,
        createdAt: motionAt,
        completedAt: motionAt + 1_200,
      },
    ];
    await d.generations.bulkAdd(demo);
  });
}
